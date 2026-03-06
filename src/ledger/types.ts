/**
 * Ledger System Types
 *
 * Ledgers are the file-based communication backbone between actors:
 * - Bodyguard → Spine (gate verdicts)
 * - Spine → PA (state diffs)
 * - Monkey → PA (detections, ONE-WAY)
 * - PA → Orchestrator (decisions, handovers)
 * - Orchestrator → Workers (assignments)
 *
 * Each ledger is append-only JSONL for auditability.
 * Hard rails watch ledgers and act on new entries.
 */

// =============================================================================
// LEDGER ENTRY BASE
// =============================================================================

/**
 * Base interface for all ledger entries.
 * Every entry is immutable once written.
 */
export interface LedgerEntry {
  /** Unique entry ID (uuid v7 for time-ordering) */
  id: string;
  /** ISO timestamp when entry was written */
  timestamp: string;
  /** Actor that wrote this entry */
  source: LedgerSource;
  /** Entry type for routing */
  type: string;
  /** Correlation ID for tracking related entries across ledgers */
  correlationId?: string;
}

/**
 * Actors that can write to ledgers
 */
export type LedgerSource =
  | 'bodyguard'
  | 'spine'
  | 'monkey'
  | 'pa'
  | 'orchestrator'
  | 'worker'
  | 'storekeeper'
  | 'context_warden'
  | 'carl';

// =============================================================================
// BODYGUARD LEDGER — Gate verdicts
// =============================================================================

/**
 * Entry written by Bodyguard after gate check
 * Path: .kenoki/ledgers/bodyguard.jsonl
 */
export interface BodyguardLedgerEntry extends LedgerEntry {
  source: 'bodyguard';
  type: 'GATE_VERDICT';
  payload: {
    stepId: string;
    verdict: 'PASS' | 'HARD_FAIL' | 'SOFT_FAIL';
    checksRun: number;
    checksTimedOut: number;
    executionTimeMs: number;
    reasons: string[];
    /** Which checks failed */
    failedChecks: Array<{
      name: string;
      confidence: 'definitive' | 'heuristic';
      output?: string;
    }>;
  };
}

// =============================================================================
// SPINE LEDGER — State snapshots and diffs
// =============================================================================

/**
 * Snapshot payload for STATE_SNAPSHOT type
 */
export interface SpineSnapshotPayload {
  projectDir: string;
  fileCount: number;
  gitBranch: string;
  uncommittedCount: number;
}

/**
 * Diff payload for STATE_DIFF type
 */
export interface SpineDiffPayload {
  projectDir: string;
  filesAdded: number;
  filesModified: number;
  filesRemoved: number;
  testStateChanged: boolean;
  buildStateChanged: boolean;
}

// ============================================================================
// SPINE REVIEW — Enhanced spine output with "what's next"
// ============================================================================

export interface RemainingWorkItem {
  description: string;
  agentType: 'cli' | 'web' | 'research' | 'image_gen' | 'hybrid';
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  source: 'blocker' | 'question' | 'assumption' | 'incomplete';
}

export interface SpineReviewPayload {
  stepId: string;
  workerId: string;
  gateVerdict: 'ACCEPTED';

  // Snapshot data
  filesChanged: string[];
  testsPassing: boolean;

  // "What's next" recommendations
  remainingWork: RemainingWorkItem[];
  nextStepSuggestion: string | null;

  // Timing
  reviewedAt: string;
}

/**
 * Entry written by Spine after state capture
 * Path: .kenoki/ledgers/spine.jsonl
 */
export interface SpineLedgerEntry extends LedgerEntry {
  source: 'spine';
  type: 'STATE_SNAPSHOT' | 'STATE_DIFF' | 'REVIEW';
  payload: SpineSnapshotPayload | SpineDiffPayload | SpineReviewPayload;
}

// =============================================================================
// MONKEY LEDGER — Slop detections (ONE-WAY to PA)
// =============================================================================

/**
 * Entry written by Monkey when slop is detected
 * Path: .kenoki/ledgers/monkey_detections.jsonl
 *
 * KEY CONSTRAINT: Monkey ONLY writes, NEVER reads responses.
 * It learns by observing sub_spine changes after PA acts.
 */
export interface MonkeyLedgerEntry extends LedgerEntry {
  source: 'monkey';
  type: 'DETECTION';
  payload: {
    detectionType:
      | 'GENERIC_LANGUAGE'
      | 'SILENT_ASSUMPTION'
      | 'NO_QUESTIONS'
      | 'TECHNICAL_QUESTION'
      | 'BUZZWORD_DENSITY'
      | 'COPY_PASTE_SMELL';
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
  };
}

/**
 * Entry written by Monkey after observing outcome
 * Path: .kenoki/ledgers/monkey_patterns.jsonl
 */
export interface MonkeyPatternEntry extends LedgerEntry {
  source: 'monkey';
  type: 'LEARNED_PATTERN';
  payload: {
    originalDetectionId: string;
    detectionType: string;
    /** Did PA act on the detection? */
    paActed: boolean;
    /** Did user respond? */
    userAnswered: boolean;
    /** Did work improve after? */
    workImproved: boolean;
    /** What Monkey learned */
    lesson: string;
    /** Confidence adjustment for future */
    confidenceAdjustment: number;
  };
}

// =============================================================================
// PA LEDGER — Decisions, corrections, handovers
// =============================================================================

/**
 * Entry written by PA when making a decision
 * Path: .kenoki/ledgers/pa_decisions.jsonl
 */
export interface PADecisionLedgerEntry extends LedgerEntry {
  source: 'pa';
  type: 'DECISION';
  payload: {
    decisionType:
      | 'CORRECTION'
      | 'SKILL_INJECTION'
      | 'HANDOVER_INITIATED'
      | 'ESCALATION'
      | 'OBSERVATION'
      | 'DISPATCH';
    targetAgent: string | null;
    trigger: {
      /** What triggered this decision */
      source: 'pattern' | 'monkey' | 'user_correction' | 'threshold' | 'spine';
      description: string;
    };
    action: string;
    /** File written as part of this decision */
    fileWritten?: string;
    /** Additional metadata for decisions (e.g., dispatch details) */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Entry written by PA when routing a query to user
 * Path: .kenoki/ledgers/pa_queries.jsonl
 */
export interface PAQueryLedgerEntry extends LedgerEntry {
  source: 'pa';
  type: 'USER_QUERY';
  payload: {
    queryId: string;
    question: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    /** Who triggered the question */
    triggeredBy: 'monkey' | 'pattern' | 'checkpoint' | 'agent';
    /** Target agent if applicable */
    targetAgent?: string;
    /** Auto-skip timeout in ms */
    autoSkipMs: number;
    /** Status of the query */
    status: 'pending' | 'answered' | 'skipped' | 'timeout';
    /** User's answer if provided */
    answer?: string;
    /** When answered/skipped */
    resolvedAt?: string;
  };
}

// =============================================================================
// ORCHESTRATOR LEDGER — Task assignments and status
// =============================================================================

/**
 * Entry written by Orchestrator when assigning work
 * Path: .kenoki/ledgers/orchestrator.jsonl
 */
export interface OrchestratorLedgerEntry extends LedgerEntry {
  source: 'orchestrator';
  type: 'ASSIGNMENT' | 'REASSIGNMENT' | 'COMPLETION' | 'FAILURE';
  payload: {
    stepId: string;
    planId: string;
    /** Assigned worker agent ID */
    workerId?: string;
    /** Task being assigned */
    task?: string;
    /** For REASSIGNMENT */
    previousWorker?: string;
    reason?: string;
    /** For COMPLETION/FAILURE */
    result?: 'success' | 'failure' | 'skipped';
    error?: string;
    /** Priority for dispatched work */
    priority?: 'high' | 'medium' | 'low';
    /** Agent type for dispatched work */
    agentType?: 'cli' | 'web' | 'research' | 'image_gen' | 'hybrid';
    /** Dependencies that must complete before this step */
    dependencies?: string[];
    /** Parent step that spawned this work */
    parentStep?: string;
  };
}

// =============================================================================
// WORKER LEDGER — Sub-spine updates (read by PA and Monkey)
// =============================================================================

/**
 * Entry written by Worker at each checkpoint
 * Path: .kenoki/ledgers/worker_checkpoints.jsonl
 */
export interface WorkerCheckpointLedgerEntry extends LedgerEntry {
  source: 'worker';
  type: 'CHECKPOINT';
  payload: {
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
  };
}

// =============================================================================
// LEDGER PATHS — Canonical locations
// =============================================================================

/**
 * All ledger file paths relative to .kenoki/
 */
export const LEDGER_PATHS = {
  BODYGUARD: 'ledgers/bodyguard.jsonl',
  SPINE: 'ledgers/spine.jsonl',
  MONKEY_DETECTIONS: 'ledgers/monkey_detections.jsonl',
  MONKEY_PATTERNS: 'ledgers/monkey_patterns.jsonl',
  PA_DECISIONS: 'ledgers/pa_decisions.jsonl',
  PA_QUERIES: 'ledgers/pa_queries.jsonl',
  ORCHESTRATOR: 'ledgers/orchestrator.jsonl',
  WORKER_CHECKPOINTS: 'ledgers/worker_checkpoints.jsonl',
  CARL: 'ledgers/carl.jsonl',
} as const;

// =============================================================================
// CARL LEDGER - Token budget enforcement
// =============================================================================

/**
 * Entry written by CARL when monitoring agents
 * Path: .kenoki/ledgers/carl.jsonl
 */
export interface CARLLedgerEntry extends LedgerEntry {
  source: 'carl';
  type: 'KILL_DECISION' | 'GRACE_GRANTED' | 'TOKEN_UPDATE' | 'AGENT_REGISTERED' | 'AGENT_UNREGISTERED';
  payload: {
    agentId: string;
    reason?: string;
    tokensUsed?: number;
    taskProgress?: number;
    model?: string;
    tier?: 1 | 2 | 3;
  };
}

// =============================================================================
// UNION TYPES
// =============================================================================

/**
 * Any ledger entry type
 */
export type AnyLedgerEntry =
  | BodyguardLedgerEntry
  | SpineLedgerEntry
  | MonkeyLedgerEntry
  | MonkeyPatternEntry
  | PADecisionLedgerEntry
  | PAQueryLedgerEntry
  | OrchestratorLedgerEntry
  | WorkerCheckpointLedgerEntry
  | CARLLedgerEntry;
