/**
 * Ledger Reader
 *
 * Read and watch ledger files for new entries.
 * PA and Orchestrator use this to react to ledger writes.
 *
 * Key features:
 * - Tail mode: read only new entries since last read
 * - Watch mode: emit events on new entries
 * - Filtered reads: query by type, source, time range
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type {
  AnyLedgerEntry,
  LedgerSource,
  BodyguardLedgerEntry,
  SpineLedgerEntry,
  MonkeyLedgerEntry,
  MonkeyPatternEntry,
  PADecisionLedgerEntry,
  PAQueryLedgerEntry,
  OrchestratorLedgerEntry,
  WorkerCheckpointLedgerEntry,
  LEDGER_PATHS,
} from './types';

// =============================================================================
// LEDGER READER CLASS
// =============================================================================

/**
 * LedgerReader reads and watches ledger files.
 */
export class LedgerReader extends EventEmitter {
  private projectRoot: string;
  private ledgerDir: string;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private lastReadPositions: Map<string, number> = new Map();

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    this.ledgerDir = path.join(projectRoot, '.kenoki', 'ledgers');
  }

  // ===========================================================================
  // FILE READING
  // ===========================================================================

  /**
   * Read all entries from a ledger file.
   */
  readAll(ledgerPath: string): AnyLedgerEntry[] {
    const fullPath = path.join(this.projectRoot, '.kenoki', ledgerPath);

    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    return lines.map(line => {
      try {
        return JSON.parse(line) as AnyLedgerEntry;
      } catch {
        console.warn(`[LedgerReader] Failed to parse line in ${ledgerPath}: ${line.substring(0, 100)}`);
        return null;
      }
    }).filter((entry): entry is AnyLedgerEntry => entry !== null);
  }

  /**
   * Read only new entries since last read (tail mode).
   */
  readNew(ledgerPath: string): AnyLedgerEntry[] {
    const fullPath = path.join(this.projectRoot, '.kenoki', ledgerPath);

    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const lastPosition = this.lastReadPositions.get(ledgerPath) || 0;
    const stats = fs.statSync(fullPath);

    if (stats.size <= lastPosition) {
      return [];
    }

    // Read from last position
    const fd = fs.openSync(fullPath, 'r');
    const buffer = Buffer.alloc(stats.size - lastPosition);
    fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
    fs.closeSync(fd);

    // Update position
    this.lastReadPositions.set(ledgerPath, stats.size);

    // Parse lines
    const content = buffer.toString('utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    return lines.map(line => {
      try {
        return JSON.parse(line) as AnyLedgerEntry;
      } catch {
        return null;
      }
    }).filter((entry): entry is AnyLedgerEntry => entry !== null);
  }

  // ===========================================================================
  // FILTERED READS
  // ===========================================================================

  /**
   * Read entries matching a filter.
   */
  readFiltered(
    ledgerPath: string,
    filter: {
      source?: LedgerSource;
      type?: string;
      since?: Date;
      until?: Date;
      correlationId?: string;
    }
  ): AnyLedgerEntry[] {
    const entries = this.readAll(ledgerPath);

    return entries.filter(entry => {
      if (filter.source && entry.source !== filter.source) return false;
      if (filter.type && entry.type !== filter.type) return false;
      if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;

      const entryTime = new Date(entry.timestamp);
      if (filter.since && entryTime < filter.since) return false;
      if (filter.until && entryTime > filter.until) return false;

      return true;
    });
  }

  /**
   * Get the latest entry of a specific type.
   */
  getLatest(ledgerPath: string, type?: string): AnyLedgerEntry | null {
    const entries = this.readAll(ledgerPath);
    const filtered = type ? entries.filter(e => e.type === type) : entries;
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  /**
   * Get entries related to a correlation ID across all ledgers.
   */
  getCorrelated(correlationId: string): AnyLedgerEntry[] {
    const allEntries: AnyLedgerEntry[] = [];
    const ledgerFiles = [
      'ledgers/bodyguard.jsonl',
      'ledgers/spine.jsonl',
      'ledgers/monkey_detections.jsonl',
      'ledgers/monkey_patterns.jsonl',
      'ledgers/pa_decisions.jsonl',
      'ledgers/pa_queries.jsonl',
      'ledgers/orchestrator.jsonl',
      'ledgers/worker_checkpoints.jsonl',
    ];

    for (const ledgerPath of ledgerFiles) {
      const entries = this.readFiltered(ledgerPath, { correlationId });
      allEntries.push(...entries);
    }

    // Sort by timestamp
    return allEntries.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  // ===========================================================================
  // TYPED READERS
  // ===========================================================================

  /**
   * Read Monkey detections (for PA to process).
   */
  readMonkeyDetections(since?: Date): MonkeyLedgerEntry[] {
    return this.readFiltered('ledgers/monkey_detections.jsonl', {
      since,
    }) as MonkeyLedgerEntry[];
  }

  /**
   * Read unprocessed Monkey detections.
   * PA marks detections as processed by writing a PA_DECISION with the correlation ID.
   */
  readUnprocessedMonkeyDetections(): MonkeyLedgerEntry[] {
    const detections = this.readAll('ledgers/monkey_detections.jsonl') as MonkeyLedgerEntry[];
    const decisions = this.readAll('ledgers/pa_decisions.jsonl') as PADecisionLedgerEntry[];

    // Get correlation IDs of processed detections
    const processedIds = new Set(
      decisions
        .filter(d => d.payload.trigger.source === 'monkey')
        .map(d => d.correlationId)
        .filter((id): id is string => !!id)
    );

    // Return detections not yet processed
    return detections.filter(d => !processedIds.has(d.id));
  }

  /**
   * Read pending PA queries.
   */
  readPendingQueries(): PAQueryLedgerEntry[] {
    const entries = this.readAll('ledgers/pa_queries.jsonl') as PAQueryLedgerEntry[];

    // Get latest status per queryId
    const queryMap = new Map<string, PAQueryLedgerEntry>();
    for (const entry of entries) {
      const existing = queryMap.get(entry.payload.queryId);
      if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
        queryMap.set(entry.payload.queryId, entry);
      }
    }

    // Return only pending
    return Array.from(queryMap.values()).filter(q => q.payload.status === 'pending');
  }

  /**
   * Read Bodyguard verdicts for a step.
   */
  readVerdictForStep(stepId: string): BodyguardLedgerEntry | null {
    const entries = this.readAll('ledgers/bodyguard.jsonl') as BodyguardLedgerEntry[];
    const matching = entries.filter(e => e.payload.stepId === stepId);
    return matching.length > 0 ? matching[matching.length - 1] : null;
  }

  /**
   * Read Worker checkpoints for an agent.
   */
  readAgentCheckpoints(agentId: string): WorkerCheckpointLedgerEntry[] {
    return this.readFiltered('ledgers/worker_checkpoints.jsonl', {})
      .filter((e): e is WorkerCheckpointLedgerEntry =>
        e.source === 'worker' && (e as WorkerCheckpointLedgerEntry).payload.agentId === agentId
      );
  }

  // ===========================================================================
  // WATCH MODE
  // ===========================================================================

  /**
   * Watch a ledger file for new entries.
   * Emits 'entry' events with new entries.
   */
  watch(ledgerPath: string): void {
    const fullPath = path.join(this.projectRoot, '.kenoki', ledgerPath);

    // Ensure file exists
    if (!fs.existsSync(fullPath)) {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, '', 'utf-8');
    }

    // Initialize read position to end of file
    const stats = fs.statSync(fullPath);
    this.lastReadPositions.set(ledgerPath, stats.size);

    // Create watcher
    const watcher = fs.watch(fullPath, (eventType) => {
      if (eventType === 'change') {
        const newEntries = this.readNew(ledgerPath);
        for (const entry of newEntries) {
          this.emit('entry', { ledger: ledgerPath, entry });
          this.emit(`entry:${entry.source}`, entry);
          this.emit(`entry:${entry.source}:${entry.type}`, entry);
        }
      }
    });

    this.watchers.set(ledgerPath, watcher);
    console.log(`[LedgerReader] Watching ${ledgerPath}`);
  }

  /**
   * Stop watching a ledger file.
   */
  unwatch(ledgerPath: string): void {
    const watcher = this.watchers.get(ledgerPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(ledgerPath);
      console.log(`[LedgerReader] Stopped watching ${ledgerPath}`);
    }
  }

  /**
   * Stop all watchers.
   */
  unwatchAll(): void {
    this.watchers.forEach((watcher, _path) => {
      watcher.close();
    });
    this.watchers.clear();
    console.log('[LedgerReader] Stopped all watchers');
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Clean up resources.
   */
  cleanup(): void {
    this.unwatchAll();
    this.lastReadPositions.clear();
    this.removeAllListeners();
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let readerInstance: LedgerReader | null = null;

/**
 * Get or create the ledger reader for a project.
 */
export function getLedgerReader(projectRoot: string): LedgerReader {
  if (!readerInstance || (readerInstance as any).projectRoot !== projectRoot) {
    readerInstance = new LedgerReader(projectRoot);
  }
  return readerInstance;
}

/**
 * Reset the reader (for testing).
 */
export function resetLedgerReader(): void {
  if (readerInstance) {
    readerInstance.cleanup();
  }
  readerInstance = null;
}
