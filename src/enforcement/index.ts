// Enforcement Engine — Public API
// Re-exports all types, constants, and functions from the enforcement modules.

// Types
export type {
  AgentHandle,
  SpineState,
  SpineDiff,
  HeartbeatSignal,
  HeartbeatState,
  ProjectStateContext,
  CronEntry,
  LockAcquireResult,
  WardenState,
  WardenKillDecision,
  EnforcerCheck,
  EnforcerResult,
  EnforcerOptions,
  GateResult,
  BodyguardVerdict,
  CheckActivationContext,
  DagStep,
  UserAction,
  FailureResponse,
  ModelRouting,
} from "./types";

// Constants
export {
  TOKEN_THRESHOLDS,
  GRACE_THRESHOLD,
  MAX_PARALLEL_CHECKS,
  CHECK_TIMEOUT_MS,
  TOTAL_GATE_TIMEOUT_MS,
  PARTIAL_TIMEOUT_POLICY,
  MIXED_RESULT_POLICY,
  MIN_CHECKS_REQUIRED,
  MODEL_ROUTING,
  ENFORCER_RETRY_POLICIES,
  CHECK_ACTIVATION,
  CHECK_SCRIPT_PATHS,
  CRON_INTERVALS,
  TIMEOUTS,
  FILE_THRESHOLDS,
  TIER_CLASSIFICATION,
  MAX_OVERHEAD_PERCENT,
  PROJECT_STATE,
  SUB_AGENT_RULES,
  CIRCUIT_BREAKER,
  PHASE_BUDGET_WEIGHTS,
  CODEX_SANDBOX,
  CLAUDE_TOOL_MAP,
  GEMINI_TOOL_MAP,
  DEPLOY_HEALTH,
  RATE_LIMIT_PATTERNS,
  RATE_LIMIT_DEFAULT_WAIT_MS,
  RATE_LIMIT_RETRY_AFTER_RESUME_MS,
  DOM_POLLING,
  LATENCY_BUDGET,
  SKILL_INJECTOR,
  LESSON_VALIDATION,
  SCOPE_WHITELIST,
  RESPONSIVE_VIEWPORTS,
  INTAKE,
  MEMORY_CONSTRAINTS,
} from "./constants";
export type { CheckActivationMap } from "./constants";

// Enforcer
export {
  runCheck,
  runCheckWithRetry,
  validateCheckOutput,
} from "./enforcer";

// Bodyguard
export {
  gateCheck,
  checkCompliance,
} from "./bodyguard";

// Spine
export {
  buildSpine,
  compareSpines,
  validateSpineState,
} from "./spine";
