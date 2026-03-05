// Enforcement Engine — Type Definitions
// All interfaces used by bodyguard, spine, enforcer, and constants modules.

// ============================================================================
// AGENT HANDLE — process + tracking
// ============================================================================

export interface AgentHandle {
  process: NodeJS.Process;
  id: string;
  model: string;
  tier: 1 | 2 | 3;
  startTime: number;
  tokensUsed: number;
  taskProgress: number; // 0.0 to 1.0
  exitCode?: number | null;
}

// ============================================================================
// SPINE STATE — project snapshot
// ============================================================================

export interface SpineState {
  // Metadata
  timestamp: number;
  projectDir: string;

  // File inventory
  files: {
    total: number;
    byType: Record<string, number>;
    list: string[];
  };

  // Git state
  gitStatus: {
    branch: string;
    uncommitted: string[];
    untracked: string[];
  };

  // Project state
  projectState: "OPEN" | "PAUSED" | "CLOSED";
  lastActivity: number;

  // DAG progress
  dagProgress: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: string[];
    currentStep?: string;
  };

  // Summary of changes (generated locally, no LLM)
  changesSummary?: string;

  // Errors encountered during spine build
  errors: Array<{
    command: string;
    error: string;
    timestamp: number;
  }>;
}

// ============================================================================
// SPINE DIFF — difference between two snapshots
// ============================================================================

export interface SpineDiff {
  filesAdded: string[];
  filesModified: string[];
  filesRemoved: string[];
  gitChanges: {
    uncommittedBefore: string[];
    uncommittedAfter: string[];
    untrackedBefore: string[];
    untrackedAfter: string[];
  };
  testStateChanged: boolean;
  buildStateChanged: boolean;
}

// ============================================================================
// HEARTBEAT — worker liveness
// ============================================================================

export interface HeartbeatSignal {
  timestamp: number;
  type: "stdout" | "file_created" | "file_modified" | "api_call";
  detail: string;
}

export interface HeartbeatState {
  agentId: string;
  lastSignal: number;
  missedBeats: number;
  signals: HeartbeatSignal[];
  isStale: boolean;
}

// ============================================================================
// PROJECT STATE MACHINE
// ============================================================================

export interface ProjectStateContext {
  state: "OPEN" | "PAUSED" | "CLOSED";
  lastActivity: number;
  pauseTimestamp?: number;
  shouldAutoArchive?: boolean;
}

// ============================================================================
// CRON REGISTRY
// ============================================================================

export interface CronEntry {
  name: string;
  interval: number;
  timerId: ReturnType<typeof setInterval>;
  fn: () => void | Promise<void>;
  active: boolean;
}

// ============================================================================
// LOCK PROTOCOL
// ============================================================================

export interface LockAcquireResult {
  acquired: boolean;
  lockFile: string;
  timeout?: boolean;
}

// ============================================================================
// WARDEN STATE
// ============================================================================

export interface WardenState {
  active: boolean;
  agents: Map<string, AgentHandle>;
  timerId?: ReturnType<typeof setInterval>;
  lastCheck: number;
}

// ============================================================================
// CONTEXT WARDEN KILL DECISION
// ============================================================================

export interface WardenKillDecision {
  shouldKill: boolean;
  reason?: string;
  grace?: boolean;
}

// ============================================================================
// ENFORCER — Check execution
// ============================================================================

export interface EnforcerCheck {
  name: string;
  script: string;
  pass: string;
  confidence: "definitive" | "heuristic";
  retry: {
    attempts: number;
    delayMs: number;
  };
}

export interface EnforcerResult {
  passed: boolean;
  output: string;
  evidence?: Record<string, unknown>;
  timedOut?: boolean;
  error?: string;
}

export interface EnforcerOptions {
  projectDir: string;
  timeoutMs: number;
  retryOnTimeout?: boolean;
}

// ============================================================================
// BODYGUARD — Gate checking
// ============================================================================

export interface GateResult {
  verdict: "PASS" | "HARD_FAIL" | "SOFT_FAIL";
  reasons: string[];
  checksRun: number;
  checksTimedOut: number;
  checksSkipped: number;
}

export interface BodyguardVerdict {
  gate: GateResult;
  checksRun: number;
  checksTimedOut: number;
  executionTimeMs: number;
  checkDetails: Array<{
    name: string;
    passed: boolean;
    timedOut: boolean;
    skipped: boolean;
    output?: string;
  }>;
}

export interface CheckActivationContext {
  stepAction: "execute" | "build" | "deploy" | "test" | "cleanup" | "verify";
  modifiedCodeFiles: boolean;
  tier: 1 | 2 | 3;
  isFrontend: boolean;
  isDoctorAvailable: boolean;
}

export interface DagStep {
  id: string;
  phase: string;
  task: string;
  action: "execute" | "build" | "deploy" | "test" | "cleanup" | "verify";
  worker: "cli" | "web" | "hybrid";
  tools: string[];
  declaredFiles: string[];
  modifiedCodeFiles: boolean;
  isFrontend: boolean;
  tier: 1 | 2 | 3;
  timeout: number;
  dependsOn: string[];
  instructions?: string;
}

// ============================================================================
// CIRCUIT BREAKER — User action on failure
// ============================================================================

export type UserAction = "Retry" | "Skip" | "Stop build";

export interface FailureResponse {
  check: string;
  severity: "warning" | "error" | "fatal";
  message: string;
  technicalDetails: string;
  options: UserAction[];
  suggestion: string;
}

// ============================================================================
// MODEL ROUTING
// ============================================================================

export interface ModelRouting {
  fast?: string;
  standard?: string;
  reasoning?: string;
  default?: string;
}
