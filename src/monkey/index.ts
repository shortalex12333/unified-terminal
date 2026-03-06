/**
 * Curious-Monkey-Agent Index
 *
 * The Monkey is a READ-ONLY observer of sub_spines that writes ONE-WAY
 * detections to PA. It never communicates directly with Status Agent,
 * Frontend, or agents. It learns by observing outcomes in sub_spines.
 *
 * Key constraints:
 * - READ: sub_spines, agent outputs
 * - WRITE: detections.jsonl, patterns.jsonl (one-way to PA)
 * - NEVER: write to queries/, status agent, or sub_spines
 * - NEVER: receive direct replies (observes transcribed answers only)
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

import { CURIOUS_MONKEY } from '../enforcement/constants';
import {
  analyzeCheckpoint,
  analyzeOutput,
  DEFAULT_MONKEY_CONFIG,
} from './detector';

// =============================================================================
// RE-EXPORTS
// =============================================================================

export * from './types';
export {
  analyzeCheckpoint,
  analyzeOutput,
  detectGenericLanguage,
  calculateBuzzwordDensity,
  detectSilentAssumptions,
  detectNoQuestions,
  detectTechnicalQuestion,
  detectCopyPasteSmell,
  DEFAULT_MONKEY_CONFIG,
} from './detector';

// =============================================================================
// TYPES
// =============================================================================

import type {
  MonkeyDetection,
  MonkeyConfig,
  MonkeyState,
  ObservedCheckpoint,
  DetectionLogEntry,
} from './types';

export interface CuriousMonkeyObserverOptions {
  /** Root directory containing .kenoki folder */
  projectRoot: string;
  /** Custom configuration (uses defaults if not provided) */
  config?: Partial<MonkeyConfig>;
}

// =============================================================================
// CHECKPOINT PARSER
// =============================================================================

/**
 * Parse a sub_spine markdown file into ObservedCheckpoint
 * Expected format:
 * ```
 * # Sub-Spine: agent-id
 * ## Checkpoint N | Context: XX%
 * Status: GREEN|AMBER|RED
 *
 * ### Completed
 * - item
 *
 * ### In Progress
 * - item
 *
 * ### Blocked
 * - item
 *
 * ### Files Touched
 * - path/to/file
 *
 * ### Assumptions
 * ASSUMED: something
 *
 * ### Questions for User
 * - question?
 * ```
 */
function parseCheckpointFromMarkdown(
  content: string,
  filePath: string
): ObservedCheckpoint | null {
  // Extract agent ID from filename or header
  const agentIdMatch = content.match(/# Sub-Spine:\s*(\S+)/i)
    || filePath.match(/sub_spine_([^.]+)\.md$/);
  if (!agentIdMatch) return null;
  const agentId = agentIdMatch[1];

  // Extract checkpoint number and context
  const checkpointMatch = content.match(/## Checkpoint\s+(\d+)\s*\|\s*Context:\s*(\d+)%/i);
  const checkpointNumber = checkpointMatch ? parseInt(checkpointMatch[1], 10) : 0;
  const contextPercent = checkpointMatch ? parseInt(checkpointMatch[2], 10) : 0;

  // Extract status
  const statusMatch = content.match(/Status:\s*(GREEN|AMBER|RED)/i);
  const status = (statusMatch?.[1]?.toUpperCase() || 'GREEN') as 'GREEN' | 'AMBER' | 'RED';

  // Extract sections
  const extractSection = (sectionName: string): string[] => {
    const regex = new RegExp(`### ${sectionName}\\s*\\n([\\s\\S]*?)(?=###|$)`, 'i');
    const match = content.match(regex);
    if (!match) return [];

    return match[1]
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  };

  // Extract ASSUMED: lines
  const assumptions = content
    .split('\n')
    .filter(line => line.trim().startsWith('ASSUMED:'))
    .map(line => line.replace(/^ASSUMED:\s*/i, '').trim());

  return {
    agentId,
    checkpointNumber,
    contextPercent,
    status,
    completed: extractSection('Completed'),
    inProgress: extractSection('In Progress'),
    blocked: extractSection('Blocked'),
    filesTouched: extractSection('Files Touched'),
    assumptions,
    questions: extractSection('Questions for User'),
    rawContent: content,
    observedAt: new Date(),
  };
}

// =============================================================================
// CURIOUS MONKEY OBSERVER
// =============================================================================

/**
 * CuriousMonkeyObserver watches sub_spines directory and detects patterns.
 *
 * - Polls sub_spines at configured interval
 * - Parses checkpoint format from markdown
 * - Runs detection pipeline on each checkpoint
 * - Appends detections to JSONL file (one-way to PA)
 * - Never communicates directly with Status Agent or Frontend
 * - Is READ-ONLY on sub_spines, ONE-WAY write to PA
 */
export class CuriousMonkeyObserver extends EventEmitter {
  private projectRoot: string;
  private config: MonkeyConfig;
  private state: MonkeyState;
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Paths derived from projectRoot
  private get kenokiDir(): string {
    return path.join(this.projectRoot, '.kenoki');
  }

  private get subSpinesDir(): string {
    return path.join(this.kenokiDir, 'sub_spines');
  }

  private get monkeyDir(): string {
    return path.join(this.kenokiDir, 'monkey');
  }

  private get detectionsPath(): string {
    return path.join(this.monkeyDir, CURIOUS_MONKEY.PATHS.DETECTIONS.split('/').pop()!);
  }

  constructor(options: CuriousMonkeyObserverOptions) {
    super();
    this.projectRoot = options.projectRoot;

    // Merge provided config with defaults
    this.config = {
      ...DEFAULT_MONKEY_CONFIG,
      ...options.config,
    };

    // Initialize state
    this.state = {
      startedAt: new Date(),
      observationCycle: 0,
      observedAgents: [],
      recentDetections: [],
      pendingDetections: [],
      learnedPatterns: [],
      config: this.config,
    };
  }

  /**
   * Start the observation loop.
   * Begins polling sub_spines directory at configured interval.
   */
  start(): void {
    if (this.isRunning) {
      console.log('[CuriousMonkey] Already running');
      return;
    }

    console.log(`[CuriousMonkey] Starting observation on: ${this.projectRoot}`);
    console.log(`[CuriousMonkey] Poll interval: ${this.config.observationIntervalMs}ms`);

    // Ensure directories exist
    this.ensureDirectories();

    this.isRunning = true;
    this.state.startedAt = new Date();

    // Run initial observation
    this.observe();

    // Start polling loop
    this.pollTimer = setInterval(() => {
      this.observe();
    }, this.config.observationIntervalMs);

    this.emit('started', { projectRoot: this.projectRoot });
  }

  /**
   * Stop the observation loop.
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[CuriousMonkey] Not running');
      return;
    }

    console.log('[CuriousMonkey] Stopping observation');

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.isRunning = false;
    this.emit('stopped', { observationCycles: this.state.observationCycle });
  }

  /**
   * Get current observer state.
   */
  getState(): Readonly<MonkeyState> {
    return { ...this.state };
  }

  /**
   * Check if observer is currently running.
   */
  isObserving(): boolean {
    return this.isRunning;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Ensure required directories exist for writing detections.
   */
  private ensureDirectories(): void {
    // Only create the monkey output directory - never create sub_spines
    if (!fs.existsSync(this.monkeyDir)) {
      fs.mkdirSync(this.monkeyDir, { recursive: true });
      console.log(`[CuriousMonkey] Created directory: ${this.monkeyDir}`);
    }
  }

  /**
   * Main observation cycle - read sub_spines, detect patterns, write detections.
   */
  private observe(): void {
    this.state.observationCycle++;
    console.log(`[CuriousMonkey] Observation cycle ${this.state.observationCycle}`);

    // Check if sub_spines directory exists (READ-ONLY check)
    if (!fs.existsSync(this.subSpinesDir)) {
      console.log('[CuriousMonkey] No sub_spines directory found');
      return;
    }

    // Read all sub_spine files
    const checkpoints = this.readSubSpines();

    if (checkpoints.length === 0) {
      console.log('[CuriousMonkey] No checkpoints found');
      return;
    }

    // Update observed agents
    this.state.observedAgents = checkpoints.map(c => c.agentId);

    // Run detection pipeline on each checkpoint
    const allDetections: MonkeyDetection[] = [];
    for (const checkpoint of checkpoints) {
      const detections = analyzeCheckpoint(checkpoint, this.config);
      allDetections.push(...detections);
    }

    if (allDetections.length > 0) {
      console.log(`[CuriousMonkey] Found ${allDetections.length} detection(s)`);

      // Write detections to JSONL (ONE-WAY to PA)
      this.writeDetections(allDetections);

      // Update state
      this.state.recentDetections = [
        ...allDetections,
        ...this.state.recentDetections,
      ].slice(0, 100); // Keep last 100

      this.state.pendingDetections.push(...allDetections);

      // Emit event for monitoring
      this.emit('detections', allDetections);
    }
  }

  /**
   * Read all sub_spine markdown files (READ-ONLY).
   */
  private readSubSpines(): ObservedCheckpoint[] {
    const checkpoints: ObservedCheckpoint[] = [];

    try {
      const files = fs.readdirSync(this.subSpinesDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(this.subSpinesDir, file);

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const checkpoint = parseCheckpointFromMarkdown(content, filePath);

          if (checkpoint) {
            checkpoints.push(checkpoint);
          }
        } catch (error) {
          console.warn(`[CuriousMonkey] Could not read: ${filePath}`);
        }
      }
    } catch (error) {
      console.warn(`[CuriousMonkey] Could not read sub_spines directory`);
    }

    return checkpoints;
  }

  /**
   * Append detections to JSONL file (ONE-WAY write to PA).
   * PA reads this file to decide on actions.
   * Monkey never receives direct replies.
   */
  private writeDetections(detections: MonkeyDetection[]): void {
    try {
      // Build JSONL lines
      const lines = detections.map(detection => {
        const entry: DetectionLogEntry = {
          detection,
          processed: false,
          paDecision: undefined,
        };
        return JSON.stringify(entry);
      });

      // Append to JSONL file
      const content = lines.join('\n') + '\n';
      fs.appendFileSync(this.detectionsPath, content, 'utf-8');

      console.log(`[CuriousMonkey] Wrote ${detections.length} detection(s) to ${this.detectionsPath}`);
    } catch (error) {
      console.error('[CuriousMonkey] Failed to write detections:', error);
      this.emit('error', { type: 'write_failed', error });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new CuriousMonkeyObserver instance.
 */
export function createMonkeyObserver(
  projectRoot: string,
  config?: Partial<MonkeyConfig>
): CuriousMonkeyObserver {
  return new CuriousMonkeyObserver({ projectRoot, config });
}
