/**
 * Ledger Writer
 *
 * Append-only writes to JSONL ledger files.
 * Each actor uses this to record decisions, detections, and state changes.
 *
 * Key properties:
 * - Atomic appends (no partial writes)
 * - UUID v7 for time-ordered IDs
 * - File locking to prevent corruption
 * - Automatic directory creation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  LedgerEntry,
  LedgerSource,
  AnyLedgerEntry,
  BodyguardLedgerEntry,
  SpineLedgerEntry,
  MonkeyLedgerEntry,
  MonkeyPatternEntry,
  PADecisionLedgerEntry,
  PAQueryLedgerEntry,
  OrchestratorLedgerEntry,
  WorkerCheckpointLedgerEntry,
  CARLLedgerEntry,
  SpineReviewPayload,
  LEDGER_PATHS,
} from './types';

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a UUID v7 (time-ordered).
 * Format: timestamp (48 bits) + random (74 bits)
 */
export function generateLedgerId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = crypto.randomBytes(8).toString('hex');

  // Format as UUID: 8-4-4-4-12
  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    '7' + randomHex.slice(0, 3), // Version 7
    '8' + randomHex.slice(3, 6), // Variant
    randomHex.slice(6, 18),
  ].join('-');
}

// =============================================================================
// LEDGER WRITER CLASS
// =============================================================================

/**
 * LedgerWriter handles append-only writes to ledger files.
 */
export class LedgerWriter {
  private projectRoot: string;
  private ledgerDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.ledgerDir = path.join(projectRoot, '.kenoki', 'ledgers');
  }

  /**
   * Ensure the ledger directory exists.
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.ledgerDir)) {
      fs.mkdirSync(this.ledgerDir, { recursive: true });
    }
  }

  /**
   * Write an entry to a ledger file.
   * Atomic append with newline.
   */
  private writeEntry(ledgerPath: string, entry: AnyLedgerEntry): void {
    this.ensureDir();
    const fullPath = path.join(this.projectRoot, '.kenoki', ledgerPath);
    const line = JSON.stringify(entry) + '\n';

    // Append atomically
    fs.appendFileSync(fullPath, line, { encoding: 'utf-8' });
  }

  // ===========================================================================
  // TYPED WRITE METHODS
  // ===========================================================================

  /**
   * Write a Bodyguard gate verdict.
   */
  writeBodyguardVerdict(
    stepId: string,
    verdict: 'PASS' | 'HARD_FAIL' | 'SOFT_FAIL',
    details: {
      checksRun: number;
      checksTimedOut: number;
      executionTimeMs: number;
      reasons: string[];
      failedChecks: Array<{
        name: string;
        confidence: 'definitive' | 'heuristic';
        output?: string;
      }>;
    },
    correlationId?: string
  ): BodyguardLedgerEntry {
    const entry: BodyguardLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'bodyguard',
      type: 'GATE_VERDICT',
      correlationId,
      payload: {
        stepId,
        verdict,
        ...details,
      },
    };

    this.writeEntry('ledgers/bodyguard.jsonl', entry);
    return entry;
  }

  /**
   * Write a Spine state snapshot.
   */
  writeSpineSnapshot(
    projectDir: string,
    details: {
      fileCount: number;
      gitBranch: string;
      uncommittedCount: number;
    },
    correlationId?: string
  ): SpineLedgerEntry {
    const entry: SpineLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'spine',
      type: 'STATE_SNAPSHOT',
      correlationId,
      payload: {
        projectDir,
        ...details,
      },
    };

    this.writeEntry('ledgers/spine.jsonl', entry);
    return entry;
  }

  /**
   * Write a Spine state diff.
   */
  writeSpineDiff(
    projectDir: string,
    diff: {
      filesAdded: number;
      filesModified: number;
      filesRemoved: number;
      testStateChanged: boolean;
      buildStateChanged: boolean;
    },
    correlationId?: string
  ): SpineLedgerEntry {
    const entry: SpineLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'spine',
      type: 'STATE_DIFF',
      correlationId,
      payload: {
        projectDir,
        ...diff,
      },
    };

    this.writeEntry('ledgers/spine.jsonl', entry);
    return entry;
  }

  /**
   * Write a Spine review entry.
   */
  writeSpineReview(
    payload: SpineReviewPayload,
    correlationId?: string
  ): SpineLedgerEntry {
    const entry: SpineLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'spine',
      type: 'REVIEW',
      correlationId,
      payload,
    };

    this.writeEntry('ledgers/spine.jsonl', entry);
    return entry;
  }

  /**
   * Write a Monkey detection (ONE-WAY to PA).
   */
  writeMonkeyDetection(
    detection: {
      detectionType: MonkeyLedgerEntry['payload']['detectionType'];
      agentId: string;
      evidence: string;
      suggestedQuestion?: string;
      confidence: number;
      severity: 'nudge' | 'flag' | 'escalate';
      location?: {
        file: string;
        section: string;
        lineNumber?: number;
      };
    },
    correlationId?: string
  ): MonkeyLedgerEntry {
    const entry: MonkeyLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'monkey',
      type: 'DETECTION',
      correlationId,
      payload: detection,
    };

    this.writeEntry('ledgers/monkey_detections.jsonl', entry);
    return entry;
  }

  /**
   * Write a Monkey learned pattern.
   */
  writeMonkeyPattern(
    pattern: {
      originalDetectionId: string;
      detectionType: string;
      paActed: boolean;
      userAnswered: boolean;
      workImproved: boolean;
      lesson: string;
      confidenceAdjustment: number;
    },
    correlationId?: string
  ): MonkeyPatternEntry {
    const entry: MonkeyPatternEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'monkey',
      type: 'LEARNED_PATTERN',
      correlationId,
      payload: pattern,
    };

    this.writeEntry('ledgers/monkey_patterns.jsonl', entry);
    return entry;
  }

  /**
   * Write a PA decision.
   */
  writePADecision(
    decision: {
      decisionType: PADecisionLedgerEntry['payload']['decisionType'];
      targetAgent: string | null;
      trigger: {
        source: 'pattern' | 'monkey' | 'user_correction' | 'threshold' | 'spine';
        description: string;
      };
      action: string;
      fileWritten?: string;
      metadata?: Record<string, unknown>;
    },
    correlationId?: string
  ): PADecisionLedgerEntry {
    const entry: PADecisionLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'pa',
      type: 'DECISION',
      correlationId,
      payload: decision,
    };

    this.writeEntry('ledgers/pa_decisions.jsonl', entry);
    return entry;
  }

  /**
   * Write a PA user query.
   */
  writePAQuery(
    query: {
      queryId: string;
      question: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      triggeredBy: 'monkey' | 'pattern' | 'checkpoint' | 'agent';
      targetAgent?: string;
      autoSkipMs: number;
    },
    correlationId?: string
  ): PAQueryLedgerEntry {
    const entry: PAQueryLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'pa',
      type: 'USER_QUERY',
      correlationId,
      payload: {
        ...query,
        status: 'pending',
      },
    };

    this.writeEntry('ledgers/pa_queries.jsonl', entry);
    return entry;
  }

  /**
   * Update a PA query with answer/resolution.
   */
  updatePAQuery(
    queryId: string,
    update: {
      status: 'answered' | 'skipped' | 'timeout';
      answer?: string;
    },
    correlationId?: string
  ): PAQueryLedgerEntry {
    const entry: PAQueryLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'pa',
      type: 'USER_QUERY',
      correlationId,
      payload: {
        queryId,
        question: '', // Not needed for update
        priority: 'low',
        triggeredBy: 'pattern',
        autoSkipMs: 0,
        status: update.status,
        answer: update.answer,
        resolvedAt: new Date().toISOString(),
      },
    };

    this.writeEntry('ledgers/pa_queries.jsonl', entry);
    return entry;
  }

  /**
   * Write an Orchestrator assignment.
   */
  writeOrchestratorAssignment(
    assignment: {
      type: 'ASSIGNMENT' | 'REASSIGNMENT' | 'COMPLETION' | 'FAILURE';
      stepId: string;
      planId: string;
      workerId?: string;
      task?: string;
      previousWorker?: string;
      reason?: string;
      result?: 'success' | 'failure' | 'skipped';
      error?: string;
      priority?: 'high' | 'medium' | 'low';
      agentType?: 'cli' | 'web' | 'research' | 'image_gen' | 'hybrid';
      dependencies?: string[];
      parentStep?: string;
    },
    correlationId?: string
  ): OrchestratorLedgerEntry {
    const entry: OrchestratorLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'orchestrator',
      type: assignment.type,
      correlationId,
      payload: {
        stepId: assignment.stepId,
        planId: assignment.planId,
        workerId: assignment.workerId,
        task: assignment.task,
        previousWorker: assignment.previousWorker,
        reason: assignment.reason,
        result: assignment.result,
        error: assignment.error,
        priority: assignment.priority,
        agentType: assignment.agentType,
        dependencies: assignment.dependencies,
        parentStep: assignment.parentStep,
      },
    };

    this.writeEntry('ledgers/orchestrator.jsonl', entry);
    return entry;
  }

  /**
   * Write a Worker checkpoint.
   */
  writeWorkerCheckpoint(
    checkpoint: {
      agentId: string;
      checkpointNumber: number;
      contextPercent: number;
      status: 'GREEN' | 'AMBER' | 'RED';
      completed: string[];
      inProgress: string[];
      blocked: string[];
      filesTouched: string[];
      assumptions: string[];
      questions: string[];
    },
    correlationId?: string
  ): WorkerCheckpointLedgerEntry {
    const entry: WorkerCheckpointLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'worker',
      type: 'CHECKPOINT',
      correlationId,
      payload: checkpoint,
    };

    this.writeEntry('ledgers/worker_checkpoints.jsonl', entry);
    return entry;
  }

  /**
   * Write a CARL entry (token budget enforcement).
   */
  writeCARLEntry(
    payload: {
      type: CARLLedgerEntry['type'];
      agentId: string;
      reason?: string;
      tokensUsed?: number;
      taskProgress?: number;
      model?: string;
      tier?: 1 | 2 | 3;
    },
    correlationId?: string
  ): CARLLedgerEntry {
    const entry: CARLLedgerEntry = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source: 'carl',
      type: payload.type,
      correlationId,
      payload: {
        agentId: payload.agentId,
        reason: payload.reason,
        tokensUsed: payload.tokensUsed,
        taskProgress: payload.taskProgress,
        model: payload.model,
        tier: payload.tier,
      },
    };

    this.writeEntry('ledgers/carl.jsonl', entry);
    return entry;
  }

  /**
   * Generic entry writer for new ledger types.
   * Use typed methods when available; this is for extensibility.
   */
  writeGenericEntry(
    ledgerPath: string,
    payload: Record<string, unknown>,
    correlationId?: string
  ): LedgerEntry {
    const source: LedgerSource = ledgerPath.includes('carl')
      ? 'carl'
      : ledgerPath.includes('bodyguard')
      ? 'bodyguard'
      : ledgerPath.includes('spine')
      ? 'spine'
      : ledgerPath.includes('monkey')
      ? 'monkey'
      : ledgerPath.includes('pa')
      ? 'pa'
      : ledgerPath.includes('orchestrator')
      ? 'orchestrator'
      : ledgerPath.includes('worker')
      ? 'worker'
      : 'context_warden';

    const entry: LedgerEntry & { payload: Record<string, unknown> } = {
      id: generateLedgerId(),
      timestamp: new Date().toISOString(),
      source,
      type: (payload.type as string) || 'ENTRY',
      correlationId,
      payload,
    };

    this.writeEntry(ledgerPath, entry as AnyLedgerEntry);
    return entry;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let writerInstance: LedgerWriter | null = null;

/**
 * Get or create the ledger writer for a project.
 */
export function getLedgerWriter(projectRoot: string): LedgerWriter {
  if (!writerInstance || (writerInstance as any).projectRoot !== projectRoot) {
    writerInstance = new LedgerWriter(projectRoot);
  }
  return writerInstance;
}

/**
 * Reset the writer (for testing).
 */
export function resetLedgerWriter(): void {
  writerInstance = null;
}
