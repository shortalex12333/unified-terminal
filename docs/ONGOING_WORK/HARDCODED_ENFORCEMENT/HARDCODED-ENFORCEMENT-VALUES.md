# HARDCODED ENFORCEMENT VALUES

## What This Document Is

Every number in this document is a constant that gets written into code. Not a guideline. Not a suggestion. Not "the AI should try to." A value that a `setInterval`, an `if` statement, a `process.kill`, or a `sys.exit(1)` enforces.

If a value is not in this document, it is not enforced. If it IS in this document, the code MUST implement it exactly as specified.

Source files referenced: HARD-RAILS.md, DOMAIN-G-TIERED-ENFORCEMENT.md, DOMAIN-F-PERSISTENCE.md, DOMAIN-B-CODE-QUALITY.md, DOMAIN-E-DEPLOYMENT.md, CONDUCTOR-ARCHITECTURE.md, AGENT-TOPOLOGY-MVP.md, ADAPTERS.md, PRODUCT-STRATEGY.md, BOTTLENECKS.md, OVERCOMING_LIMITATIONS_FIRST_PRINCIPLES.md, CLAUDE-CODE-GATE5-6.md.

---

## 1. CONTEXT WARDEN: TOKEN THRESHOLDS

These are the exact values for when to KILL an agent and respawn at the current step. Source: DOMAIN-G-TIERED-ENFORCEMENT.md, HARD-RAILS.md.

```typescript
const TOKEN_THRESHOLDS: Record<string, { window: number; killAt: number; effective: number; maxOutput: number }> = {
  "claude-sonnet-4":  { window: 200_000,   killAt: 0.55, effective: 110_000, maxOutput: 64_000  },
  "claude-opus-4":    { window: 200_000,   killAt: 0.65, effective: 130_000, maxOutput: 64_000  },
  "gpt-5-codex":      { window: 400_000,   killAt: 0.60, effective: 240_000, maxOutput: 128_000 },
  "gpt-5":            { window: 400_000,   killAt: 0.60, effective: 240_000, maxOutput: 128_000 },
  "default":          { window: 400_000,   killAt: 0.55, effective: 220_000, maxOutput: 128_000 },
};
```

Grace rule (two conditions, both must be true for grace):
```typescript
const GRACE_THRESHOLD = 0.85; // task progress ratio

if (tokenUtilization > model.killAt) {
  if (taskProgress > GRACE_THRESHOLD) {
    // LET FINISH — killing costs more than completing
    log("WARN: over threshold but task nearly done, allowing completion");
  } else {
    // KILL — summarize from Spine, fresh spawn at current step
    agent.kill("SIGTERM");
    // after 5s grace: agent.kill("SIGKILL")
  }
}
```

---

## 2. CRON INTERVALS

Every timer in the system. Source: AGENT-TOPOLOGY-MVP.md, CONDUCTOR-ARCHITECTURE.md, DOMAIN-F-PERSISTENCE.md, PRODUCT-STRATEGY.md.

```typescript
const CRON_INTERVALS = {
  // Context Warden: check all active agents' token usage
  CONTEXT_CHECK_MS:        30_000,    // 30 seconds. Source: AGENT-TOPOLOGY-MVP.md

  // Rate limit recovery: poll ChatGPT to see if limit lifted
  RATE_LIMIT_POLL_MS:      60_000,    // 60 seconds. Source: CONDUCTOR-ARCHITECTURE.md

  // Rate limit retry: try sending test message to detect recovery
  RATE_LIMIT_RETRY_MS:     120_000,   // 2 minutes. Source: PRODUCT-STRATEGY.md

  // Stale agent cleanup: kill agents with no output for N ms
  STALE_AGENT_CLEANUP_MS:  1_800_000, // 30 minutes. Source: AGENT-TOPOLOGY-MVP.md

  // Regression check: re-run test suite every N steps
  REGRESSION_CHECK_STEPS:  5,         // every 5 completed steps. Source: AGENT-TOPOLOGY-MVP.md

  // Mandatory stop: force Conductor to re-read goal
  MANDATORY_STOP_TURNS:    5,         // every 5 turns. Source: OVERCOMING_LIMITATIONS_FIRST_PRINCIPLES.md

  // Spine refresh: filesystem scan frequency during active execution
  SPINE_REFRESH_TRIGGER:   "PER_STEP", // twice per step: pre-step + post-step. NOT timed.
};
```

---

## 3. TIMEOUTS AND KILL SIGNALS

How long things are allowed to run before forced termination. Source: ADAPTERS.md, CONDUCTOR-ARCHITECTURE.md, CLAUDE-CODE-GATE5-6.md.

```typescript
const TIMEOUTS = {
  // Agent spawn: how long to wait for process to start
  AGENT_SPAWN_MS:          10_000,    // 10 seconds

  // Worker execution: per-tier defaults (overridden by AgentConfig.timeout)
  WORKER_TIER_1_MS:        60_000,    // 1 minute
  WORKER_TIER_2_MS:        300_000,   // 5 minutes
  WORKER_TIER_3_MS:        900_000,   // 15 minutes
  WORKER_MAX_MS:           1_800_000, // 30 minutes absolute max, any tier

  // Conductor session: no timeout (persistent, app lifetime)
  CONDUCTOR_TIMEOUT_MS:    null,      // never times out, runs for project duration

  // CLI auth flow: how long to wait for user to complete OAuth in browser
  AUTH_FLOW_TIMEOUT_MS:    300_000,   // 5 minutes. Source: CLAUDE-CODE-GATE5-6.md

  // Auth polling: how often to check if OAuth completed
  AUTH_POLL_INTERVAL_MS:   2_000,     // 2 seconds. Source: CLAUDE-CODE-GATE5-6.md

  // Docker health check: total wait time for container to become healthy
  DOCKER_HEALTH_TIMEOUT_MS: 30_000,  // 30 seconds (3 retries × 5s + startup buffer)

  // Post-deploy health check: total wait time for deployed URL to respond
  DEPLOY_HEALTH_TIMEOUT_MS: 40_000,  // ~40 seconds (3 retries × 10s intervals)

  // Bodyguard single check: max time for any one enforcement check
  ENFORCER_CHECK_TIMEOUT_MS: 60_000, // 60 seconds (vitest can be slow)

  // Kill grace period: time between SIGTERM and SIGKILL
  KILL_GRACE_MS:           5_000,     // 5 seconds
};
```

Kill sequence (every agent, no exceptions):
```typescript
async function killAgent(handle: AgentHandle): Promise<void> {
  handle.process.kill("SIGTERM");                          // polite
  await new Promise(r => setTimeout(r, TIMEOUTS.KILL_GRACE_MS));
  if (handle.process.exitCode === null) {
    handle.process.kill("SIGKILL");                        // forceful
  }
}
```

---

## 4. CIRCUIT BREAKER

When to stop retrying and ask the user. Source: CONDUCTOR-ARCHITECTURE.md, HARD-RAILS.md.

```typescript
const CIRCUIT_BREAKER = {
  // Step-level: how many times a single DAG step can fail before asking user
  MAX_STEP_RETRIES:        3,

  // Definitive hard rail: NO retries, NO skip. Must fix.
  DEFINITIVE_FAIL_RETRIES: 0,

  // Heuristic check: user gets [Retry] [Skip] [Stop]
  HEURISTIC_FAIL_OPTIONS:  ["Retry", "Skip this check", "Stop build"],

  // Definitive check: user gets [Retry] [Stop] only. NO SKIP.
  DEFINITIVE_FAIL_OPTIONS: ["Retry", "Stop build"],
};
```

User escape hatch logic:
```typescript
function onCheckFail(check: EnforcerCheck, result: CheckResult): UserAction {
  if (check.confidence === "definitive") {
    // No skip button. Must fix or stop.
    return askUser(check.name, CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS);
  } else {
    // Heuristic: user can skip
    return askUser(check.name, CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS);
  }
  // ALL overrides logged to Spine. Archivist records which checks were skipped.
}
```

---

## 5. FILE SIZE THRESHOLDS

Binary checks on file size. Source: HARD-RAILS.md.

```typescript
const FILE_THRESHOLDS = {
  // Minimum file size to NOT be considered a stub
  MIN_MEANINGFUL_BYTES:    50,       // < 50 bytes = suspicious. Source: check_files_nonempty.py

  // Minimum screenshot size to be valid
  MIN_SCREENSHOT_BYTES:    1_000,    // < 1KB screenshot = blank/broken. Source: check_responsive.py

  // Minimum archive size
  MIN_ARCHIVE_BYTES:       500,      // PROJECT-ARCHIVE.md must be > 500 bytes

  // Maximum prompt size before stdin pipe (not CLI arg)
  MAX_CLI_ARG_CHARS:       2_000,    // > 2000 chars = use stdin pipe. Source: ADAPTERS.md

  // Maximum skill prompt tokens
  MAX_SKILL_TOKENS:        2_000,    // Any skill file > 2000 tokens should be split
};
```

---

## 6. TIER CLASSIFICATION

How user requests map to enforcement levels. Source: DOMAIN-G-TIERED-ENFORCEMENT.md, CONDUCTOR-ARCHITECTURE.md.

```typescript
const TIER_CLASSIFICATION = {
  TIER_0: {
    name:       "trivial",
    timeRange:  "<1 min",
    agents:     0,
    overhead:   "50ms",
    actors:     [],                                   // Fast-path regex to ChatGPT
    examples:   ["What is X?", "Generate image", "Thanks!"],
  },
  TIER_1: {
    name:       "simple",
    timeRange:  "1-5 min",
    agents:     1,
    overhead:   "3-5s",
    actors:     ["worker", "bodyguard"],               // 1 worker + bodyguard post-completion
    examples:   ["Fix typo", "Change hero image", "Update copyright"],
  },
  TIER_2: {
    name:       "medium",
    timeRange:  "5-30 min",
    agents:     "3-7",
    overhead:   "15-30s per step",
    actors:     ["worker", "bodyguard", "scope", "skill_injector", "pa_on_handoff", "context_warden"],
    examples:   ["Add contact form", "Set up Stripe", "Create admin page"],
  },
  TIER_3: {
    name:       "complex",
    timeRange:  "30+ min",
    agents:     "8-15",
    overhead:   "2-4 min total (6-9% of task)",
    actors:     ["conductor", "worker", "bodyguard", "scope", "skill_injector", "pa", "context_warden", "archivist"],
    examples:   ["Build candle store", "SaaS dashboard with auth", "Portfolio with CMS"],
  },
};
```

Overhead budget (hard ceiling):
```typescript
const MAX_OVERHEAD_PERCENT = 10; // enforcement overhead must NEVER exceed 10% of task time
```

---

## 7. PROJECT STATE MACHINE TIMERS

When projects transition between states. Source: DOMAIN-F-PERSISTENCE.md.

```typescript
const PROJECT_STATE = {
  // OPEN -> PAUSED: inactivity timer
  INACTIVITY_TO_PAUSE_MS:  900_000,     // 15 minutes no user activity

  // PAUSED -> CLOSED: abandonment timer
  PAUSE_TO_CLOSE_MS:       86_400_000,  // 24 hours

  // On CLOSE: Archivist runs automatically. No user action needed.
  // On REOPEN (user returns after CLOSED): PA reads archive, PAUL mode activates.
};
```

State transition logic:
```typescript
// This runs on a timer, not on AI judgment
let lastActivity = Date.now();

setInterval(() => {
  const idle = Date.now() - lastActivity;
  if (state === "OPEN" && idle > PROJECT_STATE.INACTIVITY_TO_PAUSE_MS) {
    state = "PAUSED";
    pauseTimestamp = Date.now();
  }
  if (state === "PAUSED" && (Date.now() - pauseTimestamp) > PROJECT_STATE.PAUSE_TO_CLOSE_MS) {
    state = "CLOSED";
    runArchivist(); // produces PROJECT-ARCHIVE.md + llms.txt
  }
}, 60_000); // check every minute
```

---

## 8. SUB-AGENT SPAWNING RULES

When workers split into sub-agents. Source: AGENT-TOPOLOGY-MVP.md.

```typescript
const SUB_AGENT_RULES = {
  // File count thresholds
  DIRECT_EXECUTION_MAX_FILES:  2,   // 1-2 files: execute directly, no sub-agents
  MAY_SUB_AGENT_MIN_FILES:     3,   // 3-5 files: MAY sub-agent
  SHOULD_SUB_AGENT_MIN_FILES:  6,   // 6+ files: SHOULD sub-agent

  // Concern count threshold (independent of file count)
  MAY_SUB_AGENT_MIN_CONCERNS:  2,   // 2+ distinct concerns: MAY sub-agent

  // Depth limit (practical, not enforced — overhead makes it self-limiting)
  MAX_NESTING_DEPTH:           4,   // Level 4+ theoretically possible, practically never needed

  // Budget inheritance
  BUDGET_FORMULA:              "parent_budget / num_sub_agents",

  // Max parallel workers (memory constraint on user machines)
  MAX_PARALLEL_WORKERS:        3,   // Source: conductor-system.md (gap analysis)
};
```

---

## 9. RETRY POLICIES PER CHECK

Every enforcement check with its retry configuration. Source: HARD-RAILS.md, DOMAIN-B-CODE-QUALITY.md.

```typescript
const ENFORCER_RETRY_POLICIES: Record<string, { attempts: number; delayMs: number; confidence: string }> = {
  "test-exit-code":       { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "file-existence":       { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "file-non-empty":       { attempts: 1, delayMs: 0,     confidence: "heuristic"  }, // 50-byte threshold is arbitrary
  "build-artifact":       { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "scope-enforcement":    { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "token-threshold":      { attempts: 1, delayMs: 0,     confidence: "definitive" }, // token counts are exact
  "secret-detection":     { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "uninstall-verify":     { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "docker-health":        { attempts: 3, delayMs: 5_000, confidence: "heuristic"  }, // container warming
  "lesson-template":      { attempts: 1, delayMs: 0,     confidence: "definitive" },
  "responsive-screenshots": { attempts: 1, delayMs: 0,   confidence: "definitive" },
  "deploy-health":        { attempts: 3, delayMs: 10_000, confidence: "heuristic" }, // DNS propagation
};
```

---

## 10. THE 11 HARD RAIL CHECKS (Complete)

Each check, its exact command, pass condition, and false positive handling. Source: HARD-RAILS.md.

### Check 1: Test Suite Exit Code
```
COMMAND:          npm test
PASS:             exit code === 0
FALSE POSITIVE:   0 tests run (empty suite)
SECONDARY:        npx vitest --reporter=json | parse numTotalTests > 0
CONFIDENCE:       definitive
TIER:             1+
WHEN:             after every EXECUTE step that modifies code files
```

### Check 2: File Existence
```
COMMAND:          fs.existsSync(path) for each declared file
PASS:             all declared files exist on disk
FALSE POSITIVE:   none
CONFIDENCE:       definitive
TIER:             1+
WHEN:             after every EXECUTE step
```

### Check 3: File Non-Empty
```
COMMAND:          fs.statSync(path).size for each declared file
PASS:             all files > 50 bytes
FALSE POSITIVE:   some config files legitimately < 50 bytes
SECONDARY:        check if file is a known config type (.env, .eslintrc)
CONFIDENCE:       heuristic
TIER:             2+
WHEN:             after file existence passes
```

### Check 4: Build Artifact Exists
```
COMMAND:          fs.readdirSync("dist/") + glob for .html/.js/.css
PASS:             dist/ exists AND contains at least one .html, .js, or .css file
FALSE POSITIVE:   dist/ has only sourcemaps
SECONDARY:        find dist/ -name '*.html' -o -name '*.js' | head -1
CONFIDENCE:       definitive
TIER:             2+
WHEN:             after build step, before deploy
```

### Check 5: Scope Enforcement
```
COMMAND:          git diff --name-only HEAD
PASS:             every modified file is in step.declaredFiles[]
FALSE POSITIVE:   auto-generated files (package-lock.json, .next/, node_modules/)
SECONDARY:        filter out known auto-gen patterns before comparison
AUTO-GEN WHITELIST: package-lock.json, yarn.lock, .next/*, node_modules/*, __pycache__/*
CONFIDENCE:       definitive
TIER:             2+
WHEN:             after every EXECUTE step
```

### Check 6: Token Threshold (Context Warden)
```
COMMAND:          compare agent.tokensUsed against per-model threshold
PASS:             utilization < model.killAt OR (utilization > killAt AND taskProgress > 0.85)
FALSE POSITIVE:   none (token counts are exact)
CONFIDENCE:       definitive
TIER:             2+ (Tier 0-1 complete before threshold matters)
WHEN:             cron, every 30 seconds, all active agents
```

### Check 7: Secret Detection
```
COMMAND:          gitleaks detect --source . --no-git --exit-code 1
PASS:             exit code === 0
FALSE POSITIVE:   test fixtures with fake keys (rare)
CONFIDENCE:       definitive
TIER:             1+
WHEN:             before ANY deploy step
```

### Check 8: Uninstall Verification
```
COMMAND:          check node_modules/{package} for each claimed-uninstalled package
PASS:             none of the claimed-removed packages exist on disk
FALSE POSITIVE:   none
CONFIDENCE:       definitive
TIER:             any
WHEN:             after any cleanup/uninstall step
```

### Check 9: Docker Health
```
COMMAND:          docker build . && docker run -d && curl -s http://localhost:3000
PASS:             curl returns HTTP 200 AND body does not contain error strings
ERROR STRINGS:    "Cannot GET", "Error", "Internal Server Error", "not found"
FALSE POSITIVE:   container warming (502 during startup)
RETRY:            3 attempts, 5 second delay between each
CONFIDENCE:       heuristic (port conflicts, warming)
TIER:             2+
WHEN:             before deploy (if Docker available)
```

### Check 10: Lesson Template Validation
```
COMMAND:          regex check on lesson content
PASS:             all 4 fields present AND no placeholder text
REQUIRED FIELDS:  "what broke", "root cause", "fix applied", "prevention rule"
FORBIDDEN TEXT:   "one sentence", "TODO", "TBD", "fill in", "[placeholder]"
CONFIDENCE:       definitive
TIER:             any
WHEN:             after any error is logged and resolved
```

### Check 11: Responsive Screenshots
```
COMMAND:          npx playwright screenshot at 3 viewports
VIEWPORTS:        375×812 (mobile), 768×1024 (tablet), 1440×900 (desktop)
PASS:             all 3 screenshot files exist AND each > 1000 bytes
FALSE POSITIVE:   none (if Playwright captures, file is valid)
TIMEOUT:          30 seconds per viewport
CONFIDENCE:       definitive
TIER:             2+ (frontend tasks only)
WHEN:             after frontend build, before deploy
```

---

## 11. ACTIVATION MAP

Which checks fire when. Source: HARD-RAILS.md.

```typescript
const CHECK_ACTIVATION: Record<string, string[]> = {
  // ALWAYS after any EXECUTE step
  "every_execute": [
    "file-existence",         // #2
  ],

  // After EXECUTE step that modifies code
  "code_modified": [
    "test-exit-code",         // #1
    "scope-enforcement",      // #5
  ],

  // After EXECUTE step at Tier 2+
  "tier_2_plus": [
    "file-non-empty",         // #3
    "scope-enforcement",      // #5
  ],

  // After build step
  "post_build": [
    "build-artifact",         // #4
  ],

  // Before deploy
  "pre_deploy": [
    "secret-detection",       // #7
    "docker-health",          // #9 (if Docker available)
  ],

  // After deploy
  "post_deploy": [
    "deploy-health",          // separate from docker — checks live URL
  ],

  // After frontend build
  "frontend_build": [
    "responsive-screenshots", // #11
  ],

  // After cleanup/uninstall
  "post_uninstall": [
    "uninstall-verify",       // #8
  ],

  // After error resolution
  "post_error_fix": [
    "lesson-template",        // #10
  ],

  // CRON (independent, not triggered by steps)
  "cron_30s": [
    "token-threshold",        // #6
  ],
};
```

Bodyguard dispatches ALL applicable checks in parallel (`Promise.allSettled`), NEVER sequential:
```typescript
async function gateCheck(step: DAGStep, tier: number): Promise<GateResult> {
  const applicableChecks: string[] = [];

  applicableChecks.push(...CHECK_ACTIVATION["every_execute"]);

  if (step.modifiedCodeFiles)  applicableChecks.push(...CHECK_ACTIVATION["code_modified"]);
  if (tier >= 2)               applicableChecks.push(...CHECK_ACTIVATION["tier_2_plus"]);
  if (step.action === "build") applicableChecks.push(...CHECK_ACTIVATION["post_build"]);
  if (step.action === "deploy") applicableChecks.push(...CHECK_ACTIVATION["pre_deploy"]);
  if (step.isFrontend)         applicableChecks.push(...CHECK_ACTIVATION["frontend_build"]);

  // ALL in parallel. Never sequential.
  return runChecks(deduplicate(applicableChecks));
}
```

---

## 12. TOKEN BUDGET ALLOCATION

How the total token budget splits across phases. Source: AGENT-TOPOLOGY-MVP.md.

```typescript
const PHASE_BUDGET_WEIGHTS = {
  discuss:  0.10,   // 10% of total budget
  plan:     0.15,   // 15%
  execute:  0.60,   // 60% (the actual work)
  verify:   0.10,   // 10%
  archive:  0.05,   // 5%
};

// Per-worker budget within a phase:
// worker_budget = (total_budget × phase_weight) / num_workers_in_phase
```

---

## 13. ADAPTER MODEL ROUTING

Which model handles which task tier per runtime. Source: ADAPTERS.md, AGENT-TOPOLOGY-MVP.md.

```typescript
const MODEL_ROUTING = {
  codex: {
    fast:      "gpt-5-codex",    // Optimized for coding tasks with many tools
    standard:  "gpt-5-codex",    // Default for all coding/agent work
    reasoning: "gpt-5",          // Broad world knowledge with strong general reasoning
  },
  claude: {
    fast:      "claude-haiku-4",
    standard:  "claude-sonnet-4",
    reasoning: "claude-opus-4",
  },
  chatgpt_web: {
    // Model determined by user's ChatGPT subscription, not our choice
    default:   "user_subscription_model",
  },
};
```

---

## 14. TOOL PERMISSION MAPPING

Generic tool names to runtime-specific translations. Source: ADAPTERS.md, Instance 2 verification data.

```typescript
// Codex: sandbox model, NOT --allowed-tools (corrected by Instance V)
const CODEX_SANDBOX: Record<string, string> = {
  '["read"]':                      '--sandbox read-only',
  '["read","bash"]':               '--sandbox read-only',       // bash for analysis (find, grep)
  '["read","write"]':              '--sandbox workspace-write',
  '["read","write","bash"]':       '--sandbox workspace-write --full-auto',
  '["read","write","bash","web"]': '--sandbox danger-full-access',
};

// Claude Code: tool names in settings.json / YAML frontmatter
const CLAUDE_TOOL_MAP: Record<string, string> = {
  read: "Read", write: "Write", bash: "Bash",
  web_search: "WebSearch", edit: "Edit",
};

// Gemini: CLI flags
const GEMINI_TOOL_MAP: Record<string, string> = {
  read: "read_file", write: "write_file", bash: "run_command",
  web_search: "google_search", edit: "edit_file",
};
```

---

## 15. DEPLOY HEALTH CHECK

Post-deploy verification. Source: DOMAIN-E-DEPLOYMENT.md.

```typescript
const DEPLOY_HEALTH = {
  RETRIES:                 3,
  RETRY_DELAY_MS:          10_000,    // 10 seconds between retries
  EXPECTED_STATUS:         200,
  ERROR_BODY_STRINGS:      ["Cannot GET", "Error", "Internal Server Error", "404", "not found"],
  // Response body must NOT contain any error strings AND status must be 200
};
```

---

## 16. RATE LIMIT DETECTION

Regex patterns for detecting ChatGPT rate limits in DOM text. Source: PRODUCT-STRATEGY.md, CONDUCTOR-ARCHITECTURE.md.

```typescript
const RATE_LIMIT_PATTERNS: RegExp[] = [
  /you['']ve reached (the|your) (message |usage )?limit/i,
  /too many (messages|requests)/i,
  /please try again (in |after )/i,
  /limit (reached|exceeded|hit)/i,
];

const RATE_LIMIT_DEFAULT_WAIT_MS = 3_600_000; // 1 hour default if wait time not parseable
const RATE_LIMIT_RETRY_AFTER_RESUME_MS = 300_000; // 5 minutes between resume attempts after initial recovery
```

---

## 17. DOM POLLING INTERVALS (ChatGPT Web Adapter)

Source: BOTTLENECKS.md, PRODUCT-STRATEGY.md.

```typescript
const DOM_POLLING = {
  // Response capture: how often to check for new content
  CAPTURE_POLL_MS:         150,       // 150ms

  // Rate limit detection: how often to scan page for limit messages
  RATE_LIMIT_SCAN_MS:      5_000,     // 5 seconds

  // Auth state detection: how often to check if user is logged in
  AUTH_STATE_POLL_MS:      200,       // 200ms (main process polls BrowserView)

  // Message injection: delay after pasting before clicking send
  POST_PASTE_DELAY_MS:    300,        // 300ms for React state to update

  // Completion detection: delay after stop button disappears
  COMPLETION_DETECT_MS:   500,        // 500ms buffer after generation ends
};
```

---

## 18. LATENCY BUDGET

Maximum acceptable overhead per tier. Source: CONDUCTOR-ARCHITECTURE.md.

```typescript
const LATENCY_BUDGET = {
  FAST_PATH_MS:            50,        // Tier 0: 50ms max for regex + bypass
  TIER_1_CLASSIFY_MS:      3_000,     // Tier 1: 3 seconds for Conductor to classify
  TIER_2_PLANNING_MS:      10_000,    // Tier 2 complex only: 5-10 seconds for detailed planning
  INTAKE_QUIZ_RANGE_MS:    [30_000, 120_000],  // 30s to 2 minutes for intake conversation
  TOTAL_ROUTING_OVERHEAD_MS: 6_000,   // Total routing overhead for all tiers: ~6 seconds
};
```

---

## 19. SKILL INJECTOR THRESHOLDS

Source: ROLE-GAP-ANALYSIS.md (derived from architecture).

```typescript
const SKILL_INJECTOR = {
  // Minimum match score to inject a skill (0-1 scale)
  MIN_MATCH_SCORE:         0.2,       // Below this, no skill loaded (generic worker)

  // Frontend design default query (hardcoded Apple-like fallback)
  FRONTEND_DEFAULT_QUERY:  "SaaS premium minimal clean apple whitespace",

  // Max results from BM25 CSV search to append to prompt
  BM25_MAX_RESULTS:        5,
};
```

---

## 20. LESSON TEMPLATE VALIDATION

Regex patterns for checking lesson completeness. Source: HARD-RAILS.md, DOMAIN-F-PERSISTENCE.md.

```typescript
const LESSON_VALIDATION = {
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
    /\[.*?\]/,              // any [bracketed placeholder]
  ],
  // All 4 fields must match. Zero forbidden patterns must match. Binary.
};
```

---

## 21. SCOPE ENFORCEMENT WHITELIST

Files automatically excluded from scope checks. Source: HARD-RAILS.md.

```typescript
const SCOPE_WHITELIST = {
  EXACT: [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ],
  PREFIXES: [
    ".next/",
    "node_modules/",
    "__pycache__/",
    "dist/",                // build output is expected side effect
    ".git/",
  ],
};
```

---

## 22. RESPONSIVE VIEWPORT SIZES

Source: HARD-RAILS.md.

```typescript
const RESPONSIVE_VIEWPORTS: Array<{ width: number; height: number; name: string }> = [
  { width: 375,  height: 812,  name: "mobile"  },
  { width: 768,  height: 1024, name: "tablet"  },
  { width: 1440, height: 900,  name: "desktop" },
];
```

---

## 23. INTAKE CONSTRAINTS

Source: CONTEXT.md, PRODUCT-STRATEGY.md.

```typescript
const INTAKE = {
  MAX_QUESTIONS:           5,         // never ask more than 5 clarifying questions
  MIN_QUESTIONS:           3,         // aim for at least 3
  SKIP_BEHAVIOR:           "proceed_with_defaults", // if user says "just build it"
  BRIEF_MARKER_START:      "===BRIEF_START===",
  BRIEF_MARKER_END:        "===BRIEF_END===",
  ALLOWED_TASK_TYPES:      ["build_product", "build_content", "research", "automate", "general"],
  ALLOWED_DESIGN_PREFS:    ["minimal", "playful", "corporate", "no_preference"],
};
```

---

## 24. MEMORY CONSTRAINTS

Source: DOMAIN-C-RESEARCH.md, AGENT-TOPOLOGY-MVP.md.

```typescript
const MEMORY_CONSTRAINTS = {
  // Playwright and Browser-Use are NEVER concurrent (both ~500MB RAM each)
  MAX_BROWSER_AGENTS:      1,

  // Max parallel CLI workers (user machine RAM constraint)
  MAX_PARALLEL_CLI:        3,

  // Max parallel web workers (rate limit constraint, not RAM)
  MAX_PARALLEL_WEB:        1,
};
```

---

## SUMMARY: WHAT CODE ENFORCES vs WHAT AI "PROMISES"

Every value above is CODE. Here is what is explicitly NOT code and relies on LLM judgment (soft rails):

| Soft Rail | What It Does | Why Not Code |
|-----------|-------------|-------------|
| PA comparison | Compares step output to expectations | Requires semantic understanding |
| Code review | Checks naming, patterns, logic | Static analysis catches patterns, not intent |
| Security review | Logic-level vulnerabilities | Auth bypass is a logic gap, not a code pattern |
| Design compliance | UI matches design tokens | Visual assessment requires judgment |
| Verification integrity | "Did tests actually run?" | Detecting mock-heavy test suites requires reasoning |
| Archivist quality | Summary covers key decisions | Completeness is subjective |
| Intake questioning | Asking the right follow-ups | Understanding user intent requires language understanding |

The hard rail ceiling: if it CAN be code, it MUST be code. The 11 checks above catch ~80% of agent failures. The soft rails catch the remaining ~20%. But the 80% that is code cannot be hallucinated away, skipped under pressure, or "forgotten" when context fills up.
