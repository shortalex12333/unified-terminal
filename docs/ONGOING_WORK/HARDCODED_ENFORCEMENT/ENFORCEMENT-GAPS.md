# ENFORCEMENT GAPS — What HARDCODED-ENFORCEMENT-VALUES.md Doesn't Cover

## Companion to HARDCODED-ENFORCEMENT-VALUES.md

---

## THE CORE PROBLEM YOU IDENTIFIED

The document says "hardcoded enforcement, not polite requests" but mixes both. You're right. Let's be precise about what's ACTUALLY hard (code, no LLM, cannot hallucinate) versus what's still soft (LLM-mediated, can be bypassed by hallucination), and then identify every gap.

---

## SECTION 1: HARD vs SOFT — The Complete Honest Audit

### TRULY HARD (code enforces, LLM never involved)

| Check | What Code Does | LLM Involvement | Verdict |
|-------|---------------|-----------------|---------|
| Test exit code | `npm test`, read exit code | Zero | HARD |
| File existence | `fs.existsSync()` | Zero | HARD |
| File non-empty | `fs.statSync().size > 50` | Zero | HARD |
| Build artifact | `readdirSync("dist/")`, glob for .html/.js | Zero | HARD |
| Scope enforcement | `git diff --name-only` vs declared list | Zero | HARD |
| Token threshold | Sum API usage headers vs constant | Zero | HARD |
| Secret detection | `gitleaks detect`, read exit code | Zero | HARD |
| Uninstall verify | Check `node_modules/{pkg}` exists | Zero | HARD |
| Docker health | `curl localhost:3000`, check HTTP status + body | Zero | HARD |
| Lesson template | Regex for 4 required fields + forbidden patterns | Zero | HARD |
| Responsive screenshots | Playwright captures at 3 viewports, check file size | Zero | HARD |
| Deploy health | `curl deployed-url`, check status + body | Zero | HARD |
| Kill sequence | SIGTERM → 5s → SIGKILL | Zero | HARD |
| Project state transitions | Timer-based: 15min→PAUSED, 24h→CLOSED | Zero | HARD |
| Rate limit detection | Regex on DOM text | Zero | HARD |
| Cron intervals | `setInterval` timers | Zero | HARD |

These are REAL hard rails. No LLM can hallucinate its way past `exit code !== 0` or `fs.existsSync() === false`.

### ACTUALLY SOFT (LLM-mediated, can be bypassed by hallucination)

| Check | What Happens | Why It's Soft | Risk |
|-------|-------------|--------------|------|
| Verification integrity | Prompt asks "Did tests ACTUALLY run?" | LLM can say "yes" without evidence | MEDIUM — hard rail catches empty suites but not mocked suites |
| PA step comparison | LLM compares step N output to step N+1 expectations | LLM can say "looks good" when it doesn't | HIGH — semantic mismatch between steps goes undetected |
| Code review | LLM evaluates naming, patterns, logic | LLM can approve bad code | LOW — bad code still passes tests |
| Security review | LLM checks for auth bypass, injection | LLM can miss logic-level vulns | MEDIUM — Semgrep catches patterns, LLM catches logic |
| Design compliance | LLM compares UI to design tokens | LLM can hallucinate visual match | LOW — screenshots exist as evidence |
| Drift detection | LLM asks "still solving original problem?" | LLM can say "yes" when it drifted | HIGH — scope creep is invisible until late |
| Archivist quality | LLM summarizes project for handoff | LLM can produce shallow summary | LOW — human reviews archive |
| Conductor classification | LLM decides trivial/simple/medium/complex | LLM can misclassify | MEDIUM — wrong tier = wrong enforcement level |
| Skill injector matching | Keyword match + BM25 score | Mostly code, but relevance is judgment | LOW — wrong skill ≠ crash, just suboptimal |

### THE HONEST STATEMENT

11 hard checks catch ~80% of agent failures. 9 soft checks catch ~15%. The remaining ~5% is undetectable (subtle logic errors, aesthetic judgment, business logic correctness). The hard rails are the ceiling. The soft rails are insulation. Neither is the floor — the floor is "the user looks at the output and says yes or no."

---

## SECTION 2: WHAT THE DOCUMENT DOESN'T COVER — Gap by Gap

### GAP 1: Bodyguard Internal Flow

The document defines WHAT checks run and WHEN (activation map, section 11). It does NOT define:

**How the bodyguard dispatches checks.**
Missing constants:
```typescript
const BODYGUARD = {
  // Max concurrent checks (OS file descriptor limit on user machines)
  MAX_PARALLEL_CHECKS:        5,

  // Total timeout for ALL checks combined (not per-check)
  TOTAL_GATE_TIMEOUT_MS:      120_000,  // 2 minutes max for entire gate

  // What happens when one check times out but others pass
  PARTIAL_TIMEOUT_POLICY:     "fail_timed_out_only",
  // Options: "fail_all" | "fail_timed_out_only" | "warn_and_continue"

  // What happens when checks disagree (some pass, some fail)
  MIXED_RESULT_POLICY:        "hard_fails_block_soft_fails_warn",

  // Minimum checks that must run for gate to be valid
  // (prevents "all checks timed out so gate passes" bug)
  MIN_CHECKS_REQUIRED:        1,
};
```

**HARD or SOFT:** The bodyguard dispatcher itself is HARD — it's code that runs Promise.allSettled, reads results, and returns a verdict. The individual checks it dispatches are each classified individually (see section 1 above).

### GAP 2: Spine Communication Protocol

The document defines spine REFRESH triggers (per-step, section 2). It does NOT define:

**How agents READ the spine, and what happens when spine is stale.**
Missing constants:
```typescript
const SPINE_PROTOCOL = {
  // Max age of spine data before it's considered stale
  MAX_STALENESS_MS:           30_000,   // 30 seconds

  // What happens when an agent reads stale spine
  STALE_SPINE_POLICY:         "force_refresh_before_action",

  // Spine write lock: prevent concurrent writes
  // (two agents finishing simultaneously could corrupt SPINE.md)
  WRITE_LOCK_TIMEOUT_MS:      5_000,    // 5 seconds to acquire lock

  // Spine file max size before rotation
  MAX_SPINE_SIZE_BYTES:       100_000,  // 100KB — if bigger, spine is bloated

  // What spine sections are REQUIRED (binary: present or not)
  REQUIRED_SECTIONS:          ["files", "gitStatus", "lastTestRun", "dagProgress", "projectState"],
};
```

**HARD or SOFT:** All HARD. Spine is pure code reading filesystem. The staleness check is a timestamp comparison. The write lock is a lockfile. No LLM.

### GAP 3: Conductor ↔ Step Scheduler Messaging

The document defines tier classification (section 6) and the conductor's routing behavior (in CONDUCTOR-ARCHITECTURE.md). It does NOT define:

**The message format between conductor and step scheduler.**
Missing:
```typescript
const CONDUCTOR_MESSAGES = {
  // DAG step status values (finite set, no free-text)
  VALID_STEP_STATUSES:        ["PENDING", "RUNNING", "DONE", "FAILED", "BLOCKED", "SKIPPED"],

  // Re-plan trigger: what failure count forces conductor to re-plan instead of retry
  REPLAN_THRESHOLD:           2,  // After 2 failures of same step, re-plan not just retry

  // Max DAG re-plans per project (prevent infinite re-planning loops)
  MAX_REPLANS:                3,

  // Max DAG steps total (prevent runaway planning)
  MAX_DAG_STEPS:              50,

  // Max parallel steps (even if DAG allows more)
  MAX_PARALLEL_STEPS:         3,  // matches MAX_PARALLEL_CLI from memory constraints
};
```

**HARD or SOFT:** MIXED. The status values, step limits, and replan threshold are HARD (code enforces). The conductor's DECISION about what to put in the DAG is SOFT (LLM decides the plan).

### GAP 4: CLI vs Web Routing Decision

The document defines which models handle which tiers (section 13) and tool permissions (section 14). It does NOT define:

**The rules for when a task goes to CLI vs ChatGPT web vs both.**
Missing:
```typescript
const ROUTING_RULES = {
  // Tasks that ALWAYS go to web (ChatGPT BrowserView)
  WEB_ONLY_ACTIONS:           ["dall_e", "web_search", "intake_quiz", "direct_answer", "canvas"],

  // Tasks that ALWAYS go to CLI (Codex/Claude/Gemini)
  CLI_ONLY_ACTIONS:           ["codex_scaffold", "codex_build", "codex_test", "codex_git", "file_write"],

  // Tasks that COULD go either way (conductor decides)
  HYBRID_ACTIONS:             ["content_write", "code_review", "research"],

  // Fallback when CLI is unavailable (not installed, auth failed)
  CLI_UNAVAILABLE_FALLBACK:   "web_with_warning",

  // Fallback when web is rate-limited
  WEB_RATE_LIMITED_FALLBACK:  "defer_web_steps_continue_cli",

  // Maximum web steps queued while rate-limited before pausing entire project
  MAX_DEFERRED_WEB_STEPS:     5,
};
```

**HARD or SOFT:** HARD for the ONLY lists (code checks action type against list). SOFT for hybrid (conductor LLM decides). HARD for fallback behavior (code detects rate limit, code defers steps).

### GAP 5: Sub-Agent Token Budget Enforcement

The document defines sub-agent spawning rules (section 8) and budget formula. It does NOT define:

**What happens when a sub-agent exceeds its budget.**
Missing:
```typescript
const SUB_AGENT_BUDGET = {
  // Overhead tax per sub-agent (context window consumed by system prompt + spine summary)
  OVERHEAD_TOKENS_PER_SUB:    2_000,

  // Minimum viable budget (below this, don't sub-agent — do it directly)
  MIN_VIABLE_BUDGET_TOKENS:   8_000,

  // What happens when sub-agent hits budget limit
  BUDGET_EXCEEDED_POLICY:     "kill_and_summarize",
  // NOT "warn" — hard kill, same as context warden

  // Can a sub-agent spawn its own sub-agents?
  SUB_SUB_AGENT_ALLOWED:      true,  // up to MAX_NESTING_DEPTH

  // How sub-agent reports back to parent
  REPORT_FORMAT:              "files_on_disk",  // NOT message passing — parent reads filesystem
};
```

**HARD or SOFT:** HARD. Token counting is arithmetic. Kill is SIGTERM/SIGKILL. Budget division is division. No LLM decides whether to enforce the budget.

### GAP 6: Skill Injector → Worker Handoff

The document defines skill injector thresholds (section 19). It does NOT define:

**How the selected skill actually gets into the worker's context.**
Missing:
```typescript
const SKILL_INJECTION = {
  // Max combined skill token size that can be prepended to worker prompt
  MAX_SKILL_INJECTION_TOKENS: 4_000,

  // If combined skills exceed max, strategy:
  OVERFLOW_STRATEGY:          "truncate_lowest_score_first",

  // Max number of skills injected per worker
  MAX_SKILLS_PER_WORKER:      3,

  // Skill file format requirement (binary: has sections or doesn't)
  REQUIRED_SKILL_SECTIONS:    ["You Are", "Your Process", "Success Looks Like"],

  // If skill file is missing "Success Looks Like" section
  MISSING_SUCCESS_POLICY:     "inject_anyway_but_log_warning",
};
```

**HARD or SOFT:** HARD for token counting, max skills, truncation. SOFT for match scoring (BM25 returns a number, but relevance is judgment).

### GAP 7: Testing — What Gets Tested and When

The document defines test exit code check (check #1) and regression scan (every 5 steps). It does NOT define:

**What test framework to expect, how to handle no tests, or integration test triggers.**
Missing:
```typescript
const TESTING = {
  // Detection: which test runners to look for (in order)
  TEST_RUNNER_DETECTION_ORDER: ["vitest", "jest", "mocha", "playwright"],

  // What to do when package.json has NO test script
  NO_TEST_SCRIPT_POLICY:      "skip_test_check_log_warning",
  // NOT "fail" — new scaffolds legitimately have no tests yet

  // When to REQUIRE tests (complexity threshold)
  TESTS_REQUIRED_FROM_TIER:   2,  // Tier 2+ must have tests. Tier 1 = optional.

  // Regression scan: compare to previous run
  REGRESSION_COMPARISON:      "pass_count_must_not_decrease",
  // If previous run: 12 passed, 0 failed
  // Current run: 11 passed, 1 failed → REGRESSION DETECTED

  // What counts as "tests modified code files" (triggers test check)
  CODE_FILE_EXTENSIONS:       [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"],
};
```

**HARD or SOFT:** ALL HARD. Runner detection is file existence checks. No-test handling is a code branch. Regression comparison is arithmetic.

### GAP 8: Error Propagation — How Failures Bubble Up

The document defines circuit breaker (section 4) and retry policies (section 9). It does NOT define:

**How errors flow from check → bodyguard → scheduler → conductor → user.**
Missing:
```typescript
const ERROR_PROPAGATION = {
  // Error severity levels (determines UI treatment)
  SEVERITY_LEVELS:            ["info", "warning", "error", "fatal"],

  // Mapping: check failure → severity
  HARD_FAIL_SEVERITY:         "error",    // blocks step
  SOFT_FAIL_SEVERITY:         "warning",  // user can skip
  TIMEOUT_SEVERITY:           "error",    // blocks step
  RATE_LIMIT_SEVERITY:        "info",     // deferred, not blocked

  // How many errors to show user at once
  MAX_USER_VISIBLE_ERRORS:    3,  // don't overwhelm non-technical users

  // Error message format (user-facing, not technical)
  USER_ERROR_TEMPLATE:        "{friendly_name} didn't pass. {one_sentence_why}. {action_options}",

  // Technical error: where it goes (not shown to user)
  TECHNICAL_LOG_PATH:         ".prism/logs/enforcement.log",

  // Max error log size before rotation
  MAX_LOG_SIZE_BYTES:         5_000_000,  // 5MB
};
```

**HARD or SOFT:** ALL HARD. Severity assignment is a lookup table. Message formatting is string interpolation. Log rotation is file size check.

### GAP 9: Fetch / HTTP — External Request Handling

Not mentioned anywhere in the document. But spine reads docker health, deploy health checks curl URLs, rate limit probes fetch ChatGPT.

Missing:
```typescript
const HTTP_ENFORCEMENT = {
  // Global timeout for any HTTP request made by enforcement code
  HTTP_TIMEOUT_MS:            10_000,   // 10 seconds

  // Retry policy for HTTP checks (separate from enforcer retries)
  HTTP_RETRIES:               2,
  HTTP_RETRY_DELAY_MS:        3_000,

  // What constitutes a "real" 200 (not an error page returning 200)
  REAL_200_CHECKS: {
    MIN_BODY_BYTES:           500,      // error pages are usually < 500 bytes
    MUST_NOT_CONTAIN:         ["Cannot GET", "404", "Internal Server Error", "not found", "ECONNREFUSED"],
    SHOULD_CONTAIN_ONE_OF:    ["<div", "<main", "<html", "<!DOCTYPE"],  // real HTML
  },

  // DNS resolution timeout (for deploy health — new domains are slow)
  DNS_TIMEOUT_MS:             15_000,
};
```

**HARD or SOFT:** ALL HARD. HTTP status codes are numbers. Body content checks are string matching. Timeouts are timers.

### GAP 10: Processing Pipeline — Step Execution Internals

The document defines what happens BEFORE and AFTER a step (spine refresh, bodyguard). It does NOT define:

**What happens DURING a step — how the worker's output is captured and validated in real-time.**
Missing:
```typescript
const STEP_EXECUTION = {
  // Heartbeat: how often worker must produce output to prove it's alive
  HEARTBEAT_INTERVAL_MS:      60_000,  // 1 minute

  // What counts as "output" for heartbeat purposes
  HEARTBEAT_SIGNALS:          ["stdout_bytes", "file_created", "file_modified", "api_call"],

  // Stale worker detection: no heartbeat for N intervals = presumed stuck
  STALE_AFTER_MISSED_BEATS:   3,  // 3 minutes of silence = stuck

  // What to do with stuck worker
  STALE_WORKER_POLICY:        "kill_and_retry",  // not "warn" — kill it

  // Output capture: where worker stdout/stderr goes
  OUTPUT_CAPTURE_PATH:        ".prism/logs/{step_id}.log",

  // Max output capture size per step
  MAX_OUTPUT_CAPTURE_BYTES:   2_000_000,  // 2MB
};
```

**HARD or SOFT:** ALL HARD. Heartbeat is a timer. Stale detection is counter. Kill is SIGTERM/SIGKILL. File size is arithmetic.

---

## SECTION 3: THE ARCHITECTURE — How Constants Flow Through Code

You asked: "is it multiple Python scripts inserted through flowcharts with variable placeholders?"

No. It's this:

```
constants.ts                          ← ONE file, ALL hardcoded values
    ├── imported by spine.ts          ← reads SPINE_PROTOCOL, FILE_THRESHOLDS
    ├── imported by enforcer.ts       ← reads ENFORCER_RETRY_POLICIES, CHECK_ACTIVATION
    ├── imported by bodyguard.ts      ← reads BODYGUARD, CIRCUIT_BREAKER
    ├── imported by context-warden.ts ← reads TOKEN_THRESHOLDS, CRON_INTERVALS
    ├── imported by step-scheduler.ts ← reads TIER_CLASSIFICATION, CONDUCTOR_MESSAGES, STEP_EXECUTION
    ├── imported by agent-spawner.ts  ← reads TIMEOUTS, SUB_AGENT_RULES
    ├── imported by skill-injector.ts ← reads SKILL_INJECTOR, SKILL_INJECTION
    ├── imported by project-state.ts  ← reads PROJECT_STATE
    ├── imported by cron-manager.ts   ← reads CRON_INTERVALS
    ├── imported by codex-adapter.ts  ← reads MODEL_ROUTING, CODEX_SANDBOX, TIMEOUTS
    └── imported by web-adapter.ts    ← reads DOM_POLLING, RATE_LIMIT_PATTERNS
```

ONE constants file. Every module imports what it needs. When you change a threshold, you change ONE number in ONE file and every module that uses it picks up the change.

The flowchart is:

```
User message
    │
    ▼
FAST-PATH (code: regex check) ──────────→ ChatGPT (bypass)
    │ (non-trivial)
    ▼
CONDUCTOR (LLM: classify + plan) ────→ produces DAG
    │                                     uses: TIER_CLASSIFICATION, MAX_DAG_STEPS
    ▼
STEP SCHEDULER (code: DAG executor)
    │
    ├─── PRE-STEP ───────────────────────────────────────┐
    │    [1] Spine refresh (code: filesystem scan)        │ uses: SPINE_PROTOCOL
    │    [2] Warden check (code: token arithmetic)        │ uses: TOKEN_THRESHOLDS
    │    [3] Skill injection (code: keyword match)        │ uses: SKILL_INJECTOR
    │                                                     │
    ├─── EXECUTION ──────────────────────────────────────┤
    │    [4] Spawn worker via adapter                     │ uses: MODEL_ROUTING, TIMEOUTS
    │    [5] Monitor heartbeat (code: timer)              │ uses: STEP_EXECUTION
    │                                                     │
    ├─── POST-STEP ──────────────────────────────────────┤
    │    [6] Spine refresh (code: filesystem scan)        │ uses: SPINE_PROTOCOL
    │    [7] Bodyguard gate (code: parallel checks)       │ uses: CHECK_ACTIVATION, BODYGUARD
    │         ├── Each check: (code: exit code/file/HTTP) │ uses: ENFORCER_RETRY_POLICIES
    │         └── Verdict: PASS / HARD_FAIL / SOFT_FAIL   │ uses: CIRCUIT_BREAKER
    │    [8] If HARD_FAIL: retry or circuit break         │ uses: CIRCUIT_BREAKER
    │    [9] PA comparison (LLM: semantic check) ←SOFT    │
    │    [10] Mark DONE, save state                       │ uses: CONDUCTOR_MESSAGES
    │                                                     │
    └─── CRON (parallel, independent) ───────────────────┘
         Token check every 30s                            uses: CRON_INTERVALS
         Regression scan every 5 steps                    uses: CRON_INTERVALS
         Stale cleanup every 30min                        uses: CRON_INTERVALS
         Project state timer                              uses: PROJECT_STATE
```

Steps [1]-[8] and [10] are HARD. Step [9] is SOFT. The crons are ALL HARD.

---

## SECTION 4: WHAT NEEDS TO HAPPEN TO FIX THE GAPS

### For the Hardcoded Values Doc:
Add sections 25-34 covering the 10 gaps above. Each follows the same format: constant name, value, source, type annotation.

### For Instance 3 (Hard Rails Builder):
The constants.ts file must contain ALL values from the original 24 sections PLUS the 10 gap sections. This is the first file Instance 3 creates. Everything else imports from it.

### For Instance 2 (Adapters):
The adapter needs to know: MODEL_ROUTING, TOOL_PERMISSION_MAPPING, TIMEOUTS, MAX_CLI_ARG_CHARS. These come from constants.ts.

### For Instance 1 (Gateway):
The Electron app needs to know: DOM_POLLING, RATE_LIMIT_PATTERNS, AUTH_FLOW_TIMEOUT, LATENCY_BUDGET. These come from constants.ts.

### The Rule:
If a number appears in code, it MUST be in constants.ts with a source comment. If a number is NOT in constants.ts, it does not exist in the system. No magic numbers. No inline thresholds. No "I'll just put 5000 here."

---

## SECTION 5: THE ONE THING THE DOCUMENT GETS WRONG

The document implies "hard rail = good, soft rail = bad." That's misleading.

Hard rails catch OBJECTIVE failures: did the test pass? does the file exist? is the server up?

Soft rails catch SUBJECTIVE failures: is the code good? does the design match? is the plan drifting?

You NEED both. A project where all tests pass, all files exist, and the server returns 200 — but the code is spaghetti, the design is ugly, and the feature doesn't match what the user asked for — that project passes every hard rail and fails every soft one.

The correct framing:
- Hard rails = NECESSARY (must pass, cannot be faked)
- Soft rails = VALUABLE (should pass, can be faked, user can override)
- NEITHER is sufficient alone
- Hard rails protect against AI lying about what it DID
- Soft rails protect against AI being wrong about what it SHOULD DO

The hard/soft distinction isn't good/bad. It's "can a machine verify this?" vs "does this require judgment?"
