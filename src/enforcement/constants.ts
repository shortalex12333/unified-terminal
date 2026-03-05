// Enforcement Engine — Consolidated Constants
// Combined from 01-context-warden.ts, 12-model-routing.ts, and other constant files.
// Single source of truth for all enforcement thresholds and configuration.

import type { ModelRouting } from "./types";

// ============================================================================
// TOKEN THRESHOLDS — Context warden kill decisions
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 1
// ============================================================================

export const TOKEN_THRESHOLDS: Record<
  string,
  { window: number; killAt: number; effective: number; maxOutput: number }
> = {
  "claude-sonnet-4": {
    window: 200_000,
    killAt: 0.55,
    effective: 110_000,
    maxOutput: 64_000,
  },
  "claude-opus-4": {
    window: 200_000,
    killAt: 0.65,
    effective: 130_000,
    maxOutput: 64_000,
  },
  "gpt-5-codex": {
    window: 400_000,
    killAt: 0.6,
    effective: 240_000,
    maxOutput: 128_000,
  },
  "gpt-5": {
    window: 400_000,
    killAt: 0.6,
    effective: 240_000,
    maxOutput: 128_000,
  },
  default: {
    window: 400_000,
    killAt: 0.55,
    effective: 220_000,
    maxOutput: 128_000,
  },
};

// Task progress ratio: if agent is past this point, grant grace before killing
export const GRACE_THRESHOLD = 0.85;

// ============================================================================
// BODYGUARD CONSTANTS — Gate checking configuration
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 25
// ============================================================================

export const MAX_PARALLEL_CHECKS = 5;
export const CHECK_TIMEOUT_MS = 10_000;
export const TOTAL_GATE_TIMEOUT_MS = 120_000;
export const PARTIAL_TIMEOUT_POLICY: "fail_timed_out_only" | "fail_all" | "warn_and_continue" =
  "fail_timed_out_only";
export const MIXED_RESULT_POLICY = "hard_fails_block_soft_fails_warn" as const;
export const MIN_CHECKS_REQUIRED = 1;

// ============================================================================
// MODEL ROUTING — Which model to use per runtime and tier
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 13
// ============================================================================

export const MODEL_ROUTING: Record<string, ModelRouting> = {
  codex: {
    fast: "gpt-5-codex",
    standard: "gpt-5-codex",
    reasoning: "gpt-5",
  },
  claude: {
    fast: "claude-haiku-4",
    standard: "claude-sonnet-4",
    reasoning: "claude-opus-4",
  },
  chatgpt_web: {
    default: "user_subscription_model",
  },
};

// ============================================================================
// ENFORCER RETRY POLICIES — Per-check retry configuration
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 9
// ============================================================================

export const ENFORCER_RETRY_POLICIES: Record<
  string,
  { attempts: number; delayMs: number; confidence: "definitive" | "heuristic" }
> = {
  "test-exit-code": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "file-existence": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "file-non-empty": { attempts: 1, delayMs: 0, confidence: "heuristic" },
  "build-artifact": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "scope-enforcement": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "token-threshold": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "secret-detection": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "uninstall-verify": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "docker-health": { attempts: 3, delayMs: 5_000, confidence: "heuristic" },
  "lesson-template": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "responsive-screenshots": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "deploy-health": { attempts: 3, delayMs: 10_000, confidence: "heuristic" },
};

// ============================================================================
// CHECK ACTIVATION MAP — Which checks run under which conditions
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 10
// ============================================================================

export interface CheckActivationMap {
  every_execute: string[];
  code_modified: string[];
  tier_2_plus: string[];
  post_build: string[];
  pre_deploy: string[];
  frontend_build: string[];
  post_uninstall: string[];
  post_error_fix: string[];
  cron_30s: string[];
}

export const CHECK_ACTIVATION: CheckActivationMap = {
  every_execute: ["file-existence"],
  code_modified: ["test-exit-code", "scope-enforcement"],
  tier_2_plus: ["file-non-empty", "scope-enforcement"],
  post_build: ["build-artifact"],
  pre_deploy: ["secret-detection", "docker-health"],
  frontend_build: ["responsive-screenshots"],
  post_uninstall: ["uninstall-verify"],
  post_error_fix: ["lesson-template"],
  cron_30s: ["token-threshold"],
};

// ============================================================================
// CHECK SCRIPT PATHS — Actual filenames for each check name
// Maps check names to their real script filenames in the checks/ directory.
// Source: docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/
// ============================================================================

export const CHECK_SCRIPT_PATHS: Record<string, string> = {
  "test-exit-code": "checks/check_tests.py",
  "file-existence": "checks/check_files_exist.py",
  "file-non-empty": "checks/check_files_nonempty.py",
  "build-artifact": "checks/check_build_artifact.py",
  "scope-enforcement": "checks/check_scope.py",
  "token-threshold": "checks/check_tokens.py",
  "secret-detection": "checks/check_secrets.sh",
  "uninstall-verify": "checks/check_uninstall.py",
  "docker-health": "checks/check_docker_health.py",
  "lesson-template": "checks/check_lesson.py",
  "responsive-screenshots": "checks/check_responsive.py",
  "deploy-health": "checks/check_deploy_health.py",
};

// ============================================================================
// CRON INTERVALS — Every timer in the system
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 2
// ============================================================================

export const CRON_INTERVALS = {
  // Context Warden: check all active agents' token usage
  CONTEXT_CHECK_MS: 30_000, // 30 seconds

  // Rate limit recovery: poll ChatGPT to see if limit lifted
  RATE_LIMIT_POLL_MS: 60_000, // 60 seconds

  // Rate limit retry: try sending test message to detect recovery
  RATE_LIMIT_RETRY_MS: 120_000, // 2 minutes

  // Stale agent cleanup: kill agents with no output for N ms
  STALE_AGENT_CLEANUP_MS: 1_800_000, // 30 minutes

  // Regression check: re-run test suite every N steps
  REGRESSION_CHECK_STEPS: 5, // every 5 completed steps

  // Mandatory stop: force Conductor to re-read goal
  MANDATORY_STOP_TURNS: 5, // every 5 turns

  // Spine refresh: filesystem scan frequency during active execution
  SPINE_REFRESH_TRIGGER: "PER_STEP" as const, // twice per step: pre-step + post-step
};

// ============================================================================
// TIMEOUTS AND KILL SIGNALS — How long things run before forced termination
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 3
// ============================================================================

export const TIMEOUTS = {
  // Agent spawn: how long to wait for process to start
  AGENT_SPAWN_MS: 10_000, // 10 seconds

  // Worker execution: per-tier defaults (overridden by AgentConfig.timeout)
  WORKER_TIER_1_MS: 60_000, // 1 minute
  WORKER_TIER_2_MS: 300_000, // 5 minutes
  WORKER_TIER_3_MS: 900_000, // 15 minutes
  WORKER_MAX_MS: 1_800_000, // 30 minutes absolute max, any tier

  // Conductor session: no timeout (persistent, app lifetime)
  CONDUCTOR_TIMEOUT_MS: null as null, // never times out, runs for project duration

  // CLI auth flow: how long to wait for user to complete OAuth in browser
  AUTH_FLOW_TIMEOUT_MS: 300_000, // 5 minutes

  // Auth polling: how often to check if OAuth completed
  AUTH_POLL_INTERVAL_MS: 2_000, // 2 seconds

  // Docker health check: total wait time for container to become healthy
  DOCKER_HEALTH_TIMEOUT_MS: 30_000, // 30 seconds

  // Post-deploy health check: total wait time for deployed URL to respond
  DEPLOY_HEALTH_TIMEOUT_MS: 40_000, // ~40 seconds

  // Bodyguard single check: max time for any one enforcement check
  ENFORCER_CHECK_TIMEOUT_MS: 60_000, // 60 seconds (vitest can be slow)

  // Kill grace period: time between SIGTERM and SIGKILL
  KILL_GRACE_MS: 5_000, // 5 seconds
};

// ============================================================================
// FILE THRESHOLDS — Binary checks on file size
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 5
// ============================================================================

export const FILE_THRESHOLDS = {
  // Minimum file size to NOT be considered a stub
  MIN_MEANINGFUL_BYTES: 50, // < 50 bytes = suspicious

  // Minimum screenshot size to be valid
  MIN_SCREENSHOT_BYTES: 1_000, // < 1KB screenshot = blank/broken

  // Minimum archive size
  MIN_ARCHIVE_BYTES: 500, // PROJECT-ARCHIVE.md must be > 500 bytes

  // Maximum prompt size before stdin pipe (not CLI arg)
  MAX_CLI_ARG_CHARS: 2_000, // > 2000 chars = use stdin pipe

  // Maximum skill prompt tokens
  MAX_SKILL_TOKENS: 2_000, // Any skill file > 2000 tokens should be split
};

// ============================================================================
// TIER CLASSIFICATION — How user requests map to enforcement levels
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 6
// ============================================================================

export const TIER_CLASSIFICATION = {
  TIER_0: {
    name: "trivial" as const,
    timeRange: "<1 min",
    agents: 0,
    overhead: "50ms",
    actors: [] as string[],
    examples: ["What is X?", "Generate image", "Thanks!"],
  },
  TIER_1: {
    name: "simple" as const,
    timeRange: "1-5 min",
    agents: 1,
    overhead: "3-5s",
    actors: ["worker", "bodyguard"],
    examples: ["Fix typo", "Change hero image", "Update copyright"],
  },
  TIER_2: {
    name: "medium" as const,
    timeRange: "5-30 min",
    agents: "3-7",
    overhead: "15-30s per step",
    actors: ["worker", "bodyguard", "scope", "skill_injector", "pa_on_handoff", "context_warden"],
    examples: ["Add contact form", "Set up Stripe", "Create admin page"],
  },
  TIER_3: {
    name: "complex" as const,
    timeRange: "30+ min",
    agents: "8-15",
    overhead: "2-4 min total (6-9% of task)",
    actors: ["conductor", "worker", "bodyguard", "scope", "skill_injector", "pa", "context_warden", "archivist"],
    examples: ["Build candle store", "SaaS dashboard with auth", "Portfolio with CMS"],
  },
};

export const MAX_OVERHEAD_PERCENT = 10; // enforcement overhead must NEVER exceed 10% of task time

// ============================================================================
// PROJECT STATE MACHINE TIMERS — When projects transition between states
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 7
// ============================================================================

export const PROJECT_STATE = {
  // OPEN -> PAUSED: inactivity timer
  INACTIVITY_TO_PAUSE_MS: 900_000, // 15 minutes no user activity

  // PAUSED -> CLOSED: abandonment timer
  PAUSE_TO_CLOSE_MS: 86_400_000, // 24 hours
};

// ============================================================================
// SUB-AGENT SPAWNING RULES — When workers split into sub-agents
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 8
// ============================================================================

export const SUB_AGENT_RULES = {
  // File count thresholds
  DIRECT_EXECUTION_MAX_FILES: 2, // 1-2 files: execute directly
  MAY_SUB_AGENT_MIN_FILES: 3, // 3-5 files: MAY sub-agent
  SHOULD_SUB_AGENT_MIN_FILES: 6, // 6+ files: SHOULD sub-agent

  // Concern count threshold
  MAY_SUB_AGENT_MIN_CONCERNS: 2, // 2+ distinct concerns: MAY sub-agent

  // Depth limit
  MAX_NESTING_DEPTH: 4, // practically never needed past 4

  // Budget inheritance
  BUDGET_FORMULA: "parent_budget / num_sub_agents" as const,

  // Max parallel workers (memory constraint)
  MAX_PARALLEL_WORKERS: 3,
};

// ============================================================================
// CIRCUIT BREAKER — User escalation configuration
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 4
// ============================================================================

export const CIRCUIT_BREAKER = {
  MAX_STEP_RETRIES: 3,
  DEFINITIVE_FAIL_RETRIES: 0,
  HEURISTIC_FAIL_OPTIONS: ['retry', 'skip', 'stop'] as const,
  DEFINITIVE_FAIL_OPTIONS: ['retry', 'stop'] as const,
};

// ============================================================================
// TOKEN BUDGET ALLOCATION — How total token budget splits across phases
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 12
// ============================================================================

export const PHASE_BUDGET_WEIGHTS = {
  discuss: 0.10,
  plan: 0.15,
  execute: 0.60,
  verify: 0.10,
  archive: 0.05,
};

// ============================================================================
// TOOL PERMISSION MAPPING — Generic tool names to runtime-specific translations
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 14
// ============================================================================

export const CODEX_SANDBOX: Record<string, string> = {
  '["read"]': "--sandbox read-only",
  '["read","bash"]': "--sandbox read-only",
  '["read","write"]': "--sandbox workspace-write",
  '["read","write","bash"]': "--sandbox workspace-write --full-auto",
  '["read","write","bash","web"]': "--sandbox danger-full-access",
};

export const CLAUDE_TOOL_MAP: Record<string, string> = {
  read: "Read",
  write: "Write",
  bash: "Bash",
  web_search: "WebSearch",
  edit: "Edit",
};

export const GEMINI_TOOL_MAP: Record<string, string> = {
  read: "read_file",
  write: "write_file",
  bash: "run_command",
  web_search: "google_search",
  edit: "edit_file",
};

// ============================================================================
// DEPLOY HEALTH CHECK — Post-deploy verification
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 15
// ============================================================================

export const DEPLOY_HEALTH = {
  RETRIES: 3,
  RETRY_DELAY_MS: 10_000, // 10 seconds between retries
  EXPECTED_STATUS: 200,
  ERROR_BODY_STRINGS: ["Cannot GET", "Error", "Internal Server Error", "404", "not found"],
};

// ============================================================================
// RATE LIMIT DETECTION — Regex patterns for ChatGPT rate limits
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 16
// ============================================================================

export const RATE_LIMIT_PATTERNS: RegExp[] = [
  /you['']ve reached (the|your) (message |usage )?limit/i,
  /too many (messages|requests)/i,
  /please try again (in |after )/i,
  /limit (reached|exceeded|hit)/i,
];

export const RATE_LIMIT_DEFAULT_WAIT_MS = 3_600_000; // 1 hour default
export const RATE_LIMIT_RETRY_AFTER_RESUME_MS = 300_000; // 5 minutes between resume attempts

// ============================================================================
// DOM POLLING INTERVALS — ChatGPT Web Adapter timers
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 17
// ============================================================================

export const DOM_POLLING = {
  CAPTURE_POLL_MS: 150, // 150ms response capture
  RATE_LIMIT_SCAN_MS: 5_000, // 5 seconds rate limit scan
  AUTH_STATE_POLL_MS: 200, // 200ms auth state detection
  POST_PASTE_DELAY_MS: 300, // 300ms for React state to update
  COMPLETION_DETECT_MS: 500, // 500ms buffer after generation ends
};

// ============================================================================
// LATENCY BUDGET — Maximum acceptable overhead per tier
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 18
// ============================================================================

export const LATENCY_BUDGET = {
  FAST_PATH_MS: 50, // Tier 0: 50ms max
  TIER_1_CLASSIFY_MS: 3_000, // Tier 1: 3 seconds
  TIER_2_PLANNING_MS: 10_000, // Tier 2: 5-10 seconds
  INTAKE_QUIZ_RANGE_MS: [30_000, 120_000] as const, // 30s to 2 minutes
  TOTAL_ROUTING_OVERHEAD_MS: 6_000, // ~6 seconds total
};

// ============================================================================
// SKILL INJECTOR THRESHOLDS — Match scoring and injection
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 19
// ============================================================================

export const SKILL_INJECTOR = {
  MIN_MATCH_SCORE: 0.2, // below this, no skill loaded
  FRONTEND_DEFAULT_QUERY: "SaaS premium minimal clean apple whitespace",
  BM25_MAX_RESULTS: 5,
};

// ============================================================================
// LESSON TEMPLATE VALIDATION — Regex patterns for lesson completeness
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 20
// ============================================================================

export const LESSON_VALIDATION = {
  REQUIRED_FIELDS: [
    /what broke/i,
    /root cause/i,
    /fix applied/i,
    /prevention rule/i,
  ],
  FORBIDDEN_PLACEHOLDERS: [
    /one sentence/i,
    /\bTODO\b/,
    /\bTBD\b/,
    /fill in/i,
    /\[placeholder\]/i,
    /\[.*?\]/,
  ],
};

// ============================================================================
// SCOPE ENFORCEMENT WHITELIST — Files excluded from scope checks
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 21
// ============================================================================

export const SCOPE_WHITELIST = {
  EXACT: [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ],
  PREFIXES: [
    ".next/",
    "node_modules/",
    "__pycache__/",
    "dist/",
    ".git/",
  ],
};

// ============================================================================
// RESPONSIVE VIEWPORT SIZES — Screenshot viewports
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 22
// ============================================================================

export const RESPONSIVE_VIEWPORTS: Array<{ width: number; height: number; name: string }> = [
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1440, height: 900, name: "desktop" },
];

// ============================================================================
// INTAKE CONSTRAINTS — Meta-prompt intake configuration
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 23
// ============================================================================

export const INTAKE = {
  MAX_QUESTIONS: 5,
  MIN_QUESTIONS: 3,
  SKIP_BEHAVIOR: "proceed_with_defaults" as const,
  BRIEF_MARKER_START: "===BRIEF_START===",
  BRIEF_MARKER_END: "===BRIEF_END===",
  ALLOWED_TASK_TYPES: ["build_product", "build_content", "research", "automate", "general"],
  ALLOWED_DESIGN_PREFS: ["minimal", "playful", "corporate", "no_preference"],
};

// ============================================================================
// MEMORY CONSTRAINTS — Parallel agent limits
// Source: HARDCODED-ENFORCEMENT-VALUES.md section 24
// ============================================================================

export const MEMORY_CONSTRAINTS = {
  MAX_BROWSER_AGENTS: 1, // Playwright and Browser-Use never concurrent
  MAX_PARALLEL_CLI: 3, // user machine RAM constraint
  MAX_PARALLEL_WEB: 1, // rate limit constraint
};
