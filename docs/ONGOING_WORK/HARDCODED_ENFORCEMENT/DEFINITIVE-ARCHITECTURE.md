# DEFINITIVE ARCHITECTURE: Hardcoded Enforcement Engine (Instance 3 + 4)

> **F1-Quality Specification Document** — Complete architecture blueprint for Instance 3 (spec layer) and Instance 4 (runtime layer) of the Hardcoded Enforcement Engine. This document defines the system's correctness model, enforcement philosophy, data flows, and implementation contracts.

---

## Executive Summary

The Hardcoded Enforcement Engine is a deterministic process control system that enforces code quality, infrastructure correctness, and token safety across agent-spawned tasks without human supervision. It operates on a core philosophy: **code enforces, not polite requests**. Hard checks (11 verifications) run at code level and block execution immediately if violated. Soft checks warn and allow skipping with user decision capture. The system consists of two integrated instances: Instance 3 (spec layer) provides the architecture blueprint, 33 constant files, 11 hard rails, 9 soft rails, and 5 engine modules; Instance 4 (runtime layer) implements the full TypeScript/Python codebase and integrates it with the production execution environment. Together they create an asymmetric design where the Spine gathers complete project state (expensive, ~10-30 seconds), the Bodyguard applies parallel gates in milliseconds, and the Context Warden perpetually monitors token usage. Agents run freely within these constraints; violations don't crash the system but pause execution and request human judgment. The engine captures all user decisions for learning and prevents repeated mistakes through structured lesson storage. This architecture eliminates hallucination-based verification (which LLMs fail at ~30% of the time) and replaces it with code-based binary pass/fail checks that run 100-200x faster and with perfect reliability.

---

## 11-Check System Overview

The enforcement system runs 11 distinct checks across three confidence levels: **definitive** (binary, mathematically certain), **heuristic** (probabilistic, with false-positive awareness), and **decorative** (informational, no gate blocking). All 11 checks are executed in parallel via `Promise.allSettled()` to prevent one slow check from blocking others.

### Hard Rails (Definitive Checks - Non-Bypassable)

**1. Test Suite Exit Code** — `check_tests.py` runs `npm test` and validates exit code = 0. **Confidence**: Definitive (process return code is mathematical fact). **Failure mode**: Syntax error, type error, or runtime exception causes exit code 1. **Tier**: 1 (runs after code modifications). **Recovery**: User fixes test failures, clicks Retry.

**2. File Existence** — `check_files_exist.py` verifies agent-declared output files exist on disk. **Confidence**: Definitive (filesystem is source of truth). **Failure mode**: Agent hallucinated file creation ("created homepage.tsx") but file does not exist. **Tier**: 0 (fast, local check). **Recovery**: Agent respawned to complete task.

**3. Build Artifact Exists** — `check_build_artifact.py` validates `dist/` directory contains `.html`, `.js`, `.css` files (not empty, not stub). **Confidence**: Definitive (directory listing cannot lie). **Failure mode**: Build command returns 0 (success) but produces no output (misconfigured build config). **Tier**: 2 (post-step). **Recovery**: User investigates build config, fixes, retries.

**4. Secrets Not Committed** — `check_secrets.sh` runs gitleaks to scan for API keys, tokens, passwords. **Confidence**: Definitive (gitleaks is battle-tested). **Failure mode**: Accidental commit of `.env` file or hardcoded API key. **Tier**: 1 (pre-deploy). **Recovery**: User removes secret, amends commit, retries.

**5. Docker Health** — `check_docker_health.py` validates container starts and HTTP endpoint returns 200 with real content (not error page). **Confidence**: Heuristic (warming time, port conflicts). **Failure mode**: Dockerfile misconfigured, application crashes on startup. **Tier**: 2 (infrastructure). **Recovery**: User inspects logs, fixes Dockerfile, rebuilds.

**6. No Uninstalled Packages** — `check_uninstall.py` verifies agent-claimed removed packages are actually gone from `node_modules/`. **Confidence**: Definitive (filesystem is source of truth). **Failure mode**: Agent says "removed 5 packages" but actually removed 3. **Tier**: 1 (post-cleanup). **Recovery**: Manual cleanup or respawn.

**7. Scope Respected** — `check_scope.py` runs `git diff` to verify agent only modified files declared in its DAG step. **Confidence**: Definitive (git is source of truth). **Failure mode**: Worker told to edit homepage touches auth module. **Tier**: 2 (post-step). **Recovery**: Revert out-of-scope changes, respawn.

**8. No Empty Files** — `check_files_nonempty.py` validates all declared files have >50 bytes (not stubs). **Confidence**: Heuristic (threshold is configurable). **Failure mode**: Agent created file, wrote import, got interrupted. **Tier**: 2 (post-step). **Recovery**: Respawn to complete.

**9. Responsive Design** — `check_responsive.py` captures Playwright screenshots at 3 viewports (mobile 375x812, tablet 768x1024, desktop 1440x900) and validates each >1KB. **Confidence**: Definitive (screenshot file sizes are mathematical). **Failure mode**: CSS not compiled, layouts broken. **Tier**: 2 (frontend). **Recovery**: User fixes CSS, rebuilds, retries.

### Soft Rails (Warning Checks - Bypassable with User Decision)

**10. Token Under Threshold** — `check_tokens.py` monitors cumulative token usage against model-specific limits (e.g., Claude Sonnet 55% of 200k = kill at 110k tokens). Respects grace rule: if task >85% complete, allow overage. **Confidence**: Definitive (token counts from API headers are exact). **Failure mode**: Agent uses 150k tokens on 100k budget. **Tier**: 2-3 (during execution). **Recovery**: Context-Warden kills agent, step-scheduler respawns.

**11. Deployment Health** — `check_deploy_health.py` hits production endpoint and validates HTTP 200 + no "Error" strings in response body. **Confidence**: Heuristic (endpoint may be warming). **Failure mode**: Deploy succeeds locally but fails on production. **Tier**: 2 (post-deploy). **Recovery**: User can skip warning or retry deploy.

---

## Complete Data Flow: 15-Step Orchestration

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE EXECUTION FLOWCHART                          │
│                                                                            │
│  USER REQUEST                                                             │
│       │                                                                   │
│       ├─ 1. INTAKE: Request classification (Tier 0-3, task type)         │
│       │                                                                   │
│       ├─ 2. CONDUCTOR: DAG generation + step sequencing                   │
│       │                                                                   │
│       └─→ FOR EACH OF 10 STEPS:                                          │
│             │                                                             │
│             ├─ 3. PRE-SPINE: Run 6 commands + LLM summary               │
│             │   ├─ find . (file inventory)                              │
│             │   ├─ git status (staged/unstaged/untracked)               │
│             │   ├─ npm test (exit code capture)                         │
│             │   ├─ npm build (exit code capture)                        │
│             │   ├─ docker ps (container health)                         │
│             │   └─ curl {HEALTH_ENDPOINT} (reachability)                │
│             │       OUTPUT: .planning/spine.md (10-30 sec)              │
│             │                                                             │
│             ├─ 4. SKILL INJECT: Load next step's skill template         │
│             │   (Read trigger metadata, match against task intent)       │
│             │                                                             │
│             ├─ 5. SPAWN WORKER: child_process.spawn()                    │
│             │   ├─ Set PID tracking                                      │
│             │   ├─ Configure tier-based timeout (WORKER_TIER_N_MS)      │
│             │   └─ Capture stdout/stderr to logs/step-{n}.log           │
│             │                                                             │
│             ├─ 6. HEARTBEAT MONITOR: Parallel task (entire step)        │
│             │   ├─ Expect agent output marker every 10 sec             │
│             │   ├─ 3 missed signals = STALE_AGENT alert                │
│             │   └─ Context-Warden kills if stale                        │
│             │                                                             │
│             ├─ 7. POST-SPINE: Rebuild spine after agent exits          │
│             │   (Same 6 commands + LLM summary)                         │
│             │   OUTPUT: Updated .planning/spine.md                      │
│             │                                                             │
│             ├─ 8. BODYGUARD GATE (Pre-Step): Parallel enforcement      │
│             │   ├─ Load applicable checks from templates/               │
│             │   ├─ Filter by CHECK_ACTIVATION condition                │
│             │   ├─ Spawn checks in parallel: Promise.allSettled()      │
│             │   ├─ Collect results: pass | fail | timeout              │
│             │   └─ VERDICT: PASS | HARD_FAIL | SOFT_FAIL               │
│             │                                                             │
│             ├─ 9. CIRCUIT BREAKER: User decision on gate verdict       │
│             │   ├─ HARD_FAIL → Stop immediately                        │
│             │   │   └─ Log "HARD_FAIL: {check_names}" → lessons.md    │
│             │   │                                                        │
│             │   ├─ SOFT_FAIL → Show options: [Retry] [Skip] [Stop]   │
│             │   │   ├─ Check grace rule: if progress ≥ 85%           │
│             │   │   │   └─ Pre-select [Skip] (allow override)         │
│             │   │   └─ User picks option, captured in lessons.md      │
│             │   │                                                        │
│             │   └─ PASS → Continue to next step                        │
│             │                                                             │
│             └─→ 10. STEP TRANSITION: Spin-lock released, move to N+1   │
│                                                                            │
│  DURING EXECUTION (Parallel Monitors):                                    │
│                                                                            │
│  ┌─ 11. CONTEXT WARDEN (Every 30 sec):                                   │
│  │   ├─ For each active agent:                                           │
│  │   ├─ Read cumulative token usage (API headers)                        │
│  │   ├─ Compare vs TOKEN_THRESHOLDS[model].killAt                        │
│  │   ├─ Check taskProgress = completedSteps / totalSteps                 │
│  │   │                                                                   │
│  │   ├─ IF over threshold AND progress < 85%:                            │
│  │   │   └─ SIGTERM → 5s → SIGKILL                                      │
│  │   │   └─ step-scheduler respawns at current step                     │
│  │   │                                                                   │
│  │   └─ ELSE IF over threshold AND progress ≥ 85%:                       │
│  │       └─ WARN, allow completion (grace period)                        │
│  │                                                                        │
│  ├─ 12. RATE-LIMIT RECOVERY (Every 60 sec):                             │
│  │   ├─ Poll retry-after headers from failed API calls                  │
│  │   ├─ Defer agent respawns until cooldown elapsed                     │
│  │   └─ Resume agent with backoff multiplier                            │
│  │                                                                        │
│  └─ 13. PROJECT-STATE FSM (Continuous):                                 │
│      ├─ OPEN (0-15 min): Agent actively running                         │
│      ├─ PAUSED (15 min - 24h): No spine updates → likely stalled       │
│      ├─ CLOSED (24h+): Force-archive, clean resources                  │
│      └─ ARCHIVED: Backed up, removed from active list                   │
│                                                                            │
│  COMPLETION:                                                              │
│                                                                            │
│  ├─ 14. ALL 10 STEPS PASS:                                              │
│  │   ├─ Flatten DAG results                                              │
│  │   ├─ Aggregate lessons learned → lessons.md                           │
│  │   └─ Mark project CLOSED → ARCHIVED                                   │
│  │                                                                        │
│  └─ 15. ANY HARD_FAIL:                                                  │
│      ├─ Stop execution                                                   │
│      ├─ Surface error to user                                            │
│      ├─ Capture user decision (fix/retry/abort)                          │
│      └─ Log to lessons.md for future reference                           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Breakdown (15 Numbered Operations)

**1. Intake Classification**: Request arrives with metadata (project name, task description, user role). Conductor reads 2-3 context values, classifies task as Tier 0 (trivial, passthrough), Tier 1 (routing), Tier 2 (planning), or Tier 3 (coordination).

**2. DAG Generation**: Conductor produces 10-step execution plan. Each step has: step name, command to run, required input files, expected output files, acceptance criteria, per-step timeout in WORKER_TIER_N_MS, applicable checks (from templates/), and dependency list.

**3. Pre-Spine Build**: Spine module executes 6 shell commands in parallel, captures output, runs 1 LLM call to summarize, writes `.planning/spine.md`. Cost: 10-30 seconds (I/O bound, not CPU bound). Example spine output: "4 files changed, tests pass (42/42), build succeeds, 3 containers running, health endpoint 200 OK".

**4. Skill Injection**: Skill-injector reads first line of next step's skill file (contains `<!-- triggers: ... -->`), matches against task intent via simple string matching or regex, loads best match into memory. Validates skill exists and is syntactically correct.

**5. Worker Spawn**: child_process.spawn() called with step command + arguments. Node.js assigns PID, stores in active agent map. Sets timer for tier-based timeout (Tier 0 = 30s, Tier 1 = 2m, Tier 2 = 5m, Tier 3 = 15m). Redirects stdout/stderr to `logs/step-{n}.log` and to live terminal.

**6. Heartbeat Monitor**: Agent expected to write marker to stdout every 10 seconds (e.g., "HEARTBEAT: 2026-03-03T14:22:31Z"). Heartbeat listener watches for signals. If 3 consecutive 10-second windows pass with no signal, mark agent STALE. Context-Warden alerted, sends SIGTERM.

**7. Post-Spine Build**: After agent exits, spine.ts rebuilds identical snapshot (6 commands + LLM). Compares pre-step spine to post-step spine. Detects: files actually changed? Tests went from pass to fail? Build artifacts appeared? Differences recorded in spine.md for bodyguard to analyze.

**8. Bodyguard Gate (Pre-Step)**: Loads applicable checks from `templates/enforcer-{check-name}.json`. Filters by CHECK_ACTIVATION condition (e.g., "run after code modifications" = filter pre-step, post-step, or during-step). Spawns all checks in parallel via Promise.allSettled(). Collects results: pass (exit 0), fail (exit 1), timeout (exceeded check.timeout_ms). Aggregates verdict: any hard-fail check = HARD_FAIL; any soft-fail check = SOFT_FAIL; all pass = PASS.

**9. Circuit Breaker**: If HARD_FAIL, show error message with no options, auto-stop. If SOFT_FAIL, show warning + [Retry] [Skip] [Stop] buttons. User picks option. If progress ≥ 85%, pre-select [Skip] (grace rule). Decision + timestamp stored in lessons.md. User decision becomes training data for future runs.

**10. Step Transition**: Spin-lock released (other agents can now write spine.md). Step-scheduler checks: did step complete? Did any gate verdict indicate failure? If gate passed, move to step N+1. If gate failed and user chose Retry, go back to step N. If user chose Skip, advance to N+1. If user chose Stop, halt all execution.

**11. Context Warden (Every 30 sec)**: Cron callback fires. Iterates active agents. For each agent: read cumulative token usage from API headers (stored in agent context). Look up model name, find TOKEN_THRESHOLDS[model].killAt threshold. Calculate utilization = tokens_used / context_window. If over threshold: check grace rule (if progress ≥ 85%, log WARN and allow). Otherwise: SIGTERM → 5 sec wait → SIGKILL. Mark agent for respawn in step-scheduler.

**12. Rate-Limit Recovery (Every 60 sec)**: Cron callback fires. Scan recent failed API calls for `Retry-After` header (e.g., OpenAI returns 429 + "Retry-After: 90"). Calculate sleep duration. Defer agent respawn until cooldown elapsed. When resuming, apply exponential backoff (1st retry: +0ms, 2nd: +1s, 3rd: +4s, etc.).

**13. Project-State FSM (Continuous)**: Query last spine.md write timestamp. If 0-15 min ago, state = OPEN (running). If 15 min - 24h ago, state = PAUSED (stalled). If >24h, state = CLOSED (archive and clean up). State changes trigger actions: PAUSED → send alert to user, CLOSED → backup spine/logs to archive/, remove from active list.

**14. All Steps Pass**: No hard failures, user chose to proceed past all soft warnings. Step-scheduler marks project complete. Aggregates all lessons (from circuit-breaker decisions) into one markdown file. Calls post-project hook (cleanup, artifact upload). Marks project CLOSED → ARCHIVED.

**15. Any Hard-Fail**: Step fails gate (e.g., tests fail, secrets found, docker health down). Circuit-breaker shows error, offers [Retry] [Stop] (no skip). User clicks Retry (respawn worker), or Stop (abort project). Decision captured in lessons.md. Project moves to PAUSED state (user may resume later or close).

---

## Architecture Layers: Instance 3 vs Instance 4

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         INSTANCE 3: SPEC LAYER                           │
│                    (Hardcoded Values, No Implementation)                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CONSTANTS (33 TypeScript files in constants/)                          │
│  ├─ 01-context-warden.ts → TOKEN_THRESHOLDS, GRACE_THRESHOLD          │
│  ├─ 02-cron-intervals.ts → CONTEXT_CHECK_MS (30000), ...               │
│  ├─ 03-timeouts.ts → WORKER_TIER_0_MS (30000), TIER_1_MS (120000), ..  │
│  ├─ 04-kill-signals.ts → SIGTERM_WAIT_MS (5000), SIGKILL_WAIT_MS       │
│  ├─ 05-heartbeat.ts → HEARTBEAT_SIGNAL_MS (10000), STALE_THRESHOLD (3) │
│  ├─ 06-spine-lock.ts → WRITE_LOCK_TIMEOUT_MS (5000)                   │
│  └─ ... (27 more sections covering all hardcoded values)                │
│                                                                          │
│  TEMPLATES (11 JSON files in templates/)                                │
│  ├─ enforcer-01-test-exit-code.json → {check_activation, timeout, ...} │
│  ├─ enforcer-02-files-exist.json                                        │
│  ├─ enforcer-03-build-artifact.json                                     │
│  ├─ enforcer-04-secrets.json                                            │
│  ├─ ... (7 more checks)                                                 │
│  └─ Each template defines: name, phase (pre|post|during), tier, ...    │
│                                                                          │
│  ARCHITECTURE (This Document)                                            │
│  ├─ Executive Summary & 11-Check Overview                              │
│  ├─ 15-step flowchart with ASCII art                                    │
│  ├─ Hard vs Soft Rails distinction                                      │
│  ├─ Critical Constraints                                                │
│  ├─ Deployment Mapping & Glossary                                       │
│  └─ Complete data flow with failure modes & recovery                    │
│                                                                          │
│  SPEC COMPLETENESS:                                                      │
│  └─ Every number is named and exported from constants/                  │
│     (No magic numbers like 5000 or 0.85 in actual code)                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Instance 4 Implementation
                                    │ Consumes from Instance 3
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                       INSTANCE 4: RUNTIME LAYER                          │
│              (TypeScript/Python Implementation, Full Codebase)           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ENGINE MODULES (12 TypeScript files in src/engine/)                   │
│  ├─ types.ts → EnforcerCheck, EnforcerResult, Verdict, ... (types only)│
│  ├─ enforcer.ts → Run single check, read exit code, capture stdout    │
│  ├─ bodyguard.ts → Load checks, spawn parallel, aggregate verdict      │
│  ├─ circuit-breaker.ts → Show user options, capture decision           │
│  ├─ spine.ts → Execute 6 commands, 1 LLM call, write .planning/spine.md│
│  ├─ spine-lock.ts → fs.openSync O_EXCL, atomic lock, timeout-retry     │
│  ├─ context-warden.ts → Cron 30s loop, monitor tokens, kill if over   │
│  ├─ heartbeat.ts → Listen to agent stdout, count missed signals        │
│  ├─ project-state.ts → FSM: OPEN → PAUSED (15min) → CLOSED (24h)      │
│  ├─ cron-manager.ts → Registry: register/unregister/pause/resume      │
│  ├─ step-scheduler.ts → DAG executor, track progress, coordinate      │
│  └─ agent-spawner.ts → child_process.spawn, PID tracking, timeout mgmt │
│                                                                          │
│  CHECK SCRIPTS (11 Python/Bash in checks/)                             │
│  ├─ check_tests.py → npm test, exit code 0 = pass                      │
│  ├─ check_files_exist.py → os.path.exists() for each file              │
│  ├─ check_build_artifact.py → ls dist/, validate .html/.js/.css        │
│  ├─ check_secrets.sh → gitleaks detect --exit-code 1                   │
│  ├─ check_docker_health.py → curl localhost:3000, validate 200         │
│  ├─ check_uninstall.py → Check node_modules/, confirm package gone     │
│  ├─ check_scope.py → git diff, filter out declared files, fail on OOS  │
│  ├─ check_files_nonempty.py → os.path.getsize() > 50 bytes             │
│  ├─ check_responsive.py → playwright screenshot, validate 3 viewports  │
│  ├─ check_tokens.py → Compare token_used to threshold                  │
│  └─ check_deploy_health.py → curl prod endpoint, validate 200          │
│                                                                          │
│  INTEGRATION POINTS (How Instance 4 Extends Instance 3):                │
│  ├─ step-scheduler imports constants/ (no magic numbers)                │
│  ├─ bodyguard.ts loads templates/ via fs.readFileSync                  │
│  ├─ enforcer.ts spawns scripts from checks/                            │
│  ├─ context-warden imports CONTEXT_CHECK_MS, TOKEN_THRESHOLDS          │
│  ├─ spine.ts runs 6 exact commands (per architecture spec)             │
│  └─ All failure modes map to recovery procedures (per architecture)    │
│                                                                          │
│  TESTS (TypeScript + Python)                                            │
│  ├─ Integration tests: spine.ts can build real project state            │
│  ├─ E2E tests: full 10-step orchestration end-to-end                   │
│  ├─ Mock tests: enforcer.ts with fake check scripts                     │
│  └─ Production tests: real API calls, real deployments                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Relationship: How Instance 4 Uses Instance 3

**Constants Dependency**: Every magic number in Instance 4 code is imported from Instance 3's `constants/` directory. Example: `context-warden.ts` does not have hardcoded `30000`; instead imports `CONTEXT_CHECK_MS` from `02-cron-intervals.ts`. This allows tuning without code changes.

**Template Dependency**: Bodyguard.ts loads 11 check definitions from `templates/enforcer-*.json` (produced by Instance 3). Each template specifies: check script to run, timeout, tier, phase (pre-step/post-step), CHECK_ACTIVATION conditions. Templates are data files, not code, so can be updated without rebuilding.

**Script Dependency**: Enforcer.ts spawns check scripts from `checks/` (produced by Instance 3). Each script is pure: takes filesystem as input, returns JSON output with status ("pass"|"fail"|"timeout") and evidence string. Scripts are decoupled from engine logic.

**Architecture Dependency**: Instance 4 implements the 15-step data flow diagram (from Instance 3). No deviation. Recovery procedures match documented failure modes. Logging format matches glossary (so runbooks work correctly).

**Verification Dependency**: Instance 3 produces `verify.sh` script that checks: all constants files compile, all engine modules have correct signatures, all check scripts are executable, all templates are valid JSON, no magic numbers exist in code. Instance 4 runs `verify.sh` as part of CI/CD before tests.

---

## Hard Rails vs Soft Rails: The Enforcement Spectrum

The enforcement engine distinguishes between **hard rails** (unbreakable boundaries that stop execution) and **soft rails** (warnings that allow human override). This section explains each, shows the ASCII comparison, and defines consequences.

### The Distinction

A **hard rail** is a check whose failure means the entire step stops immediately—no escape hatch, no user decision. Hard rails are non-negotiable: tests must pass, secrets must be cleared, build must succeed. The philosophy is **"code enforces, not polite requests"**.

A **soft rail** is a check whose failure triggers a warning and offers the user three options: Retry (run check again), Skip Step (proceed despite warning), or Stop Build (terminate). Soft rails are guidance, not law. Examples: token usage under threshold, responsive design valid, deployment health green.

The distinction is encoded in each check's `on_fail` property:
- `on_fail: "stop_build"` → Hard rail (Tier 0-1)
- `on_fail: "warn"` → Soft rail (Tier 2-3)

### ASCII Comparison Table: Hard Rails vs Soft Rails

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       HARD RAILS vs SOFT RAILS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ HARD RAILS (11 Checks)                    SOFT RAILS (9 Checks)             │
│ ════════════════════════════              ═══════════════════════════       │
│                                                                              │
│ Tier 0-1 only                             Tier 2-3 only                    │
│ ├─ check_files_exist                      ├─ check_tokens                   │
│ │  (declared files present)                 (usage < threshold)             │
│ │  FAILS IF: file missing                  FAILS IF: over limit            │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 5s                             TIMEOUT: 10s                    │
│ │                                                                            │
│ ├─ check_files_nonempty                   ├─ check_responsive               │
│ │  (files > 50 bytes)                      (3 viewports pass)              │
│ │  FAILS IF: stub file found               FAILS IF: viewport fails        │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 10s                            TIMEOUT: 60s (Playwright)       │
│ │                                                                            │
│ ├─ check_secrets                          ├─ check_scope                    │
│ │  (gitleaks finds 0)                      (git mods in declared scope)     │
│ │  FAILS IF: secrets detected              FAILS IF: out-of-scope changes  │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 15s                            TIMEOUT: 10s                    │
│ │                                                                            │
│ ├─ check_tests                            ├─ check_deploy_health            │
│ │  (npm test exit code = 0)                (deployed URL 200 OK)           │
│ │  FAILS IF: test fails                    FAILS IF: 503/timeout           │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 45s                            TIMEOUT: 30s (3 retries)        │
│ │                                                                            │
│ ├─ check_build_artifact                   ├─ check_docker_health            │
│ │  (dist/ has .html/.js/.css)              (containers running)            │
│ │  FAILS IF: missing artifacts             FAILS IF: docker unreachable    │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 60s                            TIMEOUT: 15s (3 retries)        │
│ │                                                                            │
│ ├─ check_docker_health                    ├─ check_lesson                   │
│ │  (docker ps returns containers)          (lessons.md has fields)         │
│ │  FAILS IF: docker unreachable            FAILS IF: missing field         │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 15s (3 retries)                TIMEOUT: 5s                     │
│ │                                                                            │
│ ├─ check_lesson                           ├─ check_uninstall                │
│ │  (lessons.md has new entry)              (package gone from node_modules)│
│ │  FAILS IF: lesson missing                FAILS IF: still installed       │
│ │  CONSEQUENCE: STOP immediately           CONSEQUENCE: user [Retry/Skip]  │
│ │  EXIT CODE: 1                            EXIT CODE: 1                    │
│ │  TIMEOUT: 5s                             TIMEOUT: 10s                    │
│ │                                                                            │
│ ├─ check_uninstall                                                          │
│ │  (removed packages absent)                                                │
│ │  FAILS IF: package still present                                          │
│ │  CONSEQUENCE: STOP immediately                                            │
│ │  EXIT CODE: 1                                                             │
│ │  TIMEOUT: 10s                                                             │
│                                                                              │
│ ├─ check_scope                                                              │
│ │  (git diffs in declared scope)                                            │
│ │  FAILS IF: out-of-scope change                                            │
│ │  CONSEQUENCE: STOP immediately                                            │
│ │  EXIT CODE: 1                                                             │
│ │  TIMEOUT: 10s                                                             │
│                                                                              │
│ └─ (HARD RAILS: 11 total)                └─ (SOFT RAILS: 9 total)          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ ACTIVATION & TIMING                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ HARD RAILS (Tiers 0-1)                    SOFT RAILS (Tiers 2-3)           │
│                                                                              │
│ Phase: PRE-STEP (before agent runs)       Phase: POST-STEP (after agent)   │
│ - Prevent bad state                       - Verify changes good            │
│ - Quick local checks                      - Medium API calls               │
│ - Total time: 10-20 seconds               - Total time: 30-90 seconds      │
│                                                                              │
│ Tier 0: File checks (no subprocesses)     Tier 2: API checks (curl, REST)  │
│ Tier 1: Fast commands (npm, git, 5-15s)   Tier 3: Browser checks (60-90s)  │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ USER-FACING OUTCOMES                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ HARD FAIL Verdict                         SOFT FAIL Verdict                │
│ ══════════════════════════════            ════════════════════════════     │
│                                                                              │
│ Triggered by:                             Triggered by:                    │
│ - Any Tier 0-1 check fails                - Any Tier 2-3 check fails       │
│ - Test suite fails                        - Responsive design fails        │
│ - Build error                             - Deploy health down             │
│ - File missing                            - Token limit exceeded           │
│ - Secrets detected                        - Docker unreachable (soft path) │
│                                                                              │
│ User UI:                                  User UI:                         │
│ ┌────────────────────────────────┐        ┌────────────────────────────────┐
│ │ BUILD FAILED                   │        │ WARNING: Soft Check Failed      │
│ │                                │        │                                │
│ │ Hard check failed:             │        │ Check: token_usage             │
│ │ check_secrets                  │        │ Message: 85% budget used       │
│ │                                │        │                                │
│ │ ERROR: Secret API key detected │        │ Options:                       │
│ │                                │        │ [Retry]  [Skip Step] [Stop]    │
│ │ [OK - Stop Build]              │        │                                │
│ └────────────────────────────────┘        │ (Also: Grace rule applies if   │
│                                           │  task >85% done → pre-select   │
│ No escape hatch.                          │  Skip Step)                    │
│ Build stops, user fixes code.             └────────────────────────────────┘
│                                                                              │
│                                           User can choose to skip or retry.│
│ Grace Rule DOES NOT APPLY                 Grace Rule MAY APPLY            │
│ (always hard-stop even at 99%)            (if >85% done, pre-select Skip) │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Hard Rail Checks (Tier 0-1)

These eleven checks are **non-negotiable**. If any fails, the build stops immediately.

1. **check_files_exist** (Tier 0, 5s timeout) — Verifies declared files present in filesystem. Failure: Required file missing. Consequence: STOP (cannot proceed without declared files).

2. **check_files_nonempty** (Tier 0, 10s timeout) — Verifies no stub files (< 50 bytes). Failure: Stub file found. Consequence: STOP (stub files indicate incomplete work).

3. **check_secrets** (Tier 0, 15s timeout, via gitleaks) — Verifies no secrets in git index. Failure: API key, password, token detected. Consequence: STOP (security breach, must be fixed before deploy).

4. **check_tests** (Tier 1, 45s timeout) — Verifies `npm test` exits with code 0. Failure: Test suite fails. Consequence: STOP (broken tests block production).

5. **check_build_artifact** (Tier 1, 60s timeout) — Verifies `dist/` contains `.html`, `.js`, `.css` files. Failure: Build artifacts missing. Consequence: STOP (no artifacts = no deploy).

6. **check_docker_health** (Tier 1, 15s timeout, 3 retries) — Verifies `docker ps` returns container list. Failure: Docker daemon unreachable. Consequence: STOP (infrastructure required for testing).

7. **check_scope** (Tier 1, 10s timeout) — Verifies `git diff --name-only` changes within declared scope. Failure: Out-of-scope file modified. Consequence: STOP (scope drift indicates unplanned changes).

8. **check_uninstall** (Tier 1, 10s timeout, optional post-step) — Verifies removed packages absent from `node_modules/`. Failure: Package still present after uninstall. Consequence: STOP if enabled (indicates failed cleanup).

9. **check_lesson** (Tier 1, 5s timeout, post-step) — Verifies `tasks/lessons.md` has new entry with required fields. Failure: Lesson missing or incomplete. Consequence: STOP (learning enforcement).

### Soft Rail Checks (Tier 2-3)

These nine checks warn but allow user override. Useful for best practices and non-blocking validations.

1. **check_tokens** (Tier 2, 10s timeout) — Verifies token usage < TOKEN_THRESHOLDS[model].killAt. Failure: Token budget exceeded. Consequence: SOFT_FAIL (warn, allow skip if <85% done).

2. **check_responsive** (Tier 3, 60s timeout via Playwright) — Verifies screenshots at 3 viewports pass visual regression. Failure: Responsive design breaks at viewport. Consequence: SOFT_FAIL (can skip if urgent).

3. **check_deploy_health** (Tier 2, 30s timeout, 3 retries) — Verifies deployed URL responds with 200 OK. Failure: Deployed endpoint returns 503 or timeout. Consequence: SOFT_FAIL (might be transient, allow retry).

4. **check_docker_health** (Tier 2, 15s timeout, 3 retries) — Same as hard, but tier 2 allows skip if necessary. Consequence: SOFT_FAIL when tier 2.

5. **check_lesson** (Tier 2, 5s timeout) — When tier 2: Warn if lesson incomplete, allow skip. Consequence: SOFT_FAIL (learning is encouraged, not required).

6. **check_uninstall** (Tier 2, 10s timeout) — When tier 2: Warn if package still present, allow skip. Consequence: SOFT_FAIL (cleanup is best-effort).

7-9. **Additional soft rail variations** — Same checks, different tiers, allowing flexibility based on deployment stage.

---

## Critical Constraints: Non-Negotiable Design Rules

The enforcement engine operates under five critical constraints that define its correctness model.

### Constraint 1: No Magic Numbers in Engine Code

Every numeric value (timeouts, thresholds, intervals, retry counts) must come from `constants/` directory. The engine code contains **zero hardcoded numbers** except for comparison operators (< > =), loop counters, and arithmetic operations needed to combine constants.

**Implementation:**
- All timeouts imported from `03-timeouts.ts`
- All thresholds imported from domain-specific files (`01-context-warden.ts`, `05-file-thresholds.ts`, etc.)
- All intervals imported from `02-cron-intervals.ts`
- All retry counts imported from `09-retry-policies.ts`

**Benefit:** All enforcement parameters can be tuned by editing `constants/`, without recompiling engine code. Enables A/B testing, rapid iteration, and parameter optimization.

### Constraint 2: Promise.allSettled() for Parallel Checks

The bodyguard dispatcher MUST use `Promise.allSettled()` to run all applicable checks in parallel, never sequential. This prevents one slow check from blocking others and ensures all checks run even if one fails.

**Why allSettled() not all():**
- `Promise.all()` stops on first failure → some checks never run
- `Promise.allSettled()` runs all checks → captures all failures, better debugging

**Benefit:** Parallel execution reduces gate latency from O(n*timeout) to O(max(timeout)). With 12 checks × 10-60s each, sequential = 5+ min, parallel = 60s.

### Constraint 3: Single LLM Call in Spine

The spine module executes 6 shell commands (find, git status, npm test, npm build, docker ps, curl health), then makes **exactly 1 LLM call** to summarize results into plain English.

**Why one call not many:**
- Multiple LLM calls = expensive (1 call = ~0.5 sec + 100-500 tokens)
- One summary call = efficient, reusable output
- Allows humans to read plain English description of project state

**Benefit:** Reduces token burn in monitoring loop. Spine runs pre-step and post-step (2×/per step), so singleton LLM call is critical for budget.

### Constraint 4: Circuit-Breaker Provides Escape Hatch on Hard Failures

When a hard check fails, the build pauses and shows user options:
- **Retry**: Run the check again (transient failure?)
- **Skip Step**: Accept the failure and continue (urgent release?)
- **Stop Build**: Give up and ask for help

The circuit breaker captures user decision and stores in `tasks/lessons.md` for learning.

**Why escape hatch:**
- Hard failures can be transient (docker restart, network blip)
- User may have urgent reason to skip (hotfix deployment)
- Captures human judgment for training future enforcement

**Benefit:** Balances strictness with pragmatism. Enforcement isn't dogmatic; it learns from exceptions.

### Constraint 5: Clean Separation — Instance 4 Only Imports constants/ and engine/

Instance 4 (implementation) must import ONLY:
- `constants/` directory (all hardcoded values)
- `engine/` directory (orchestration logic)
- Standard Node.js/TypeScript libraries

Instance 4 **must NOT**:
- Import from other projects
- Hardcode values locally
- Copy constants from documentation
- Invent new values outside constants/

**Benefit:** Single source of truth. All configuration changes go through constants/, making audits and compliance easier.

---

## Deployment Mapping: How Checks Run in Pipeline

The enforcement engine operates at four stages of the build pipeline. Each stage runs different checks appropriate to that phase.

### STAGE 1: PRE-BUILD (Before Agent Spawns)

**Triggered:** step-scheduler.ts calls bodyguard.ts BEFORE agent spawn
**Duration:** 10-20 seconds (parallel)
**Phase Type:** "pre-step"

**Checks Running (Tier 0-1, all HARD):**
- check_files_exist (5s)
- check_files_nonempty (10s)
- check_secrets (15s)
- check_tests (45s)
- check_build_artifact (60s)
- check_docker_health (15s, 3 retries)
- check_scope (10s)

**Verdict:**
- ALL PASS → proceed to STAGE 2
- ANY HARD FAIL → STOP immediately, show error, circuit breaker UI

### STAGE 2: AGENT EXECUTION (During Agent Runtime)

**Triggered:** Agent spawned, runs in background
**Duration:** 5 minutes - 1 hour
**Phase Type:** "during-step"

**Parallel Monitors:**
1. **context-warden.ts** (Cron every 30s) — Monitor token usage, kill if over threshold (unless >85% done)
2. **heartbeat.ts** (Monitor every 10s) — Expect agent signals, alert if 3 missed (30s stale)
3. **project-state.ts** (FSM check) — Track project state: OPEN → PAUSED (15min) → CLOSED (24h)

### STAGE 3: POST-STEP VALIDATION (After Agent Completes)

**Triggered:** Agent exits → bodyguard.ts runs again
**Duration:** 30-90 seconds (parallel)
**Phase Type:** "post-step"

**Checks Running (Tier 1-3, mix of HARD and SOFT):**

**HARD:**
- check_build_artifact (60s)
- check_lesson (5s)
- check_uninstall (10s)

**SOFT:**
- check_responsive (60s)
- check_deploy_health (30s, 3 retries)
- check_tokens (10s)
- check_scope (10s)
- check_docker_health (15s, 3 retries)

**Verdict:**
- ALL PASS → mark step complete, move to STAGE 4
- HARD FAIL → stop immediately, circuit breaker
- SOFT FAIL → show options [Retry/Skip/Stop]

### STAGE 4: PRE-DEPLOY VERIFICATION (Before CI/CD Deploy)

**Triggered:** All steps complete → step-scheduler.ts gates deployment
**Duration:** 10-30 seconds (final checks)
**Phase Type:** "pre-deploy"

**Checks Running:**
- check_deploy_health (30s)
- check_secrets (15s)
- check_lesson (5s)
- check_build_artifact (60s)

All checks are HARD at this stage (deployment is final).

**Verdict:**
- ALL PASS → proceed to deploy
- ANY FAIL → block deployment, require user sign-off

---

## Glossary: Definitive Terms

**Bodyguard**: Gate dispatcher module (engine/bodyguard.ts) that loads applicable checks, spawns them in parallel via Promise.allSettled(), collects results, and produces verdict (PASS/HARD_FAIL/SOFT_FAIL).

**Check**: Individual verification script that validates one aspect of project health. Returns exit code 0 (pass) or 1 (fail).

**Circuit-Breaker**: Module (engine/circuit-breaker.ts) handling gate failures. For HARD_FAIL, shows error and stops. For SOFT_FAIL, shows three options: Retry, Skip Step, Stop Build.

**Context-Warden**: Cron task running every 30 seconds monitoring token usage. If over budget and task <85% done, sends SIGTERM → SIGKILL and respawns agent.

**DAG**: Directed Acyclic Graph representing the 10-step execution sequence. Executed by step-scheduler.ts with parallel gates at each stage.

**Decision Gate**: Point where user is asked to choose between conflicting options (Retry/Skip/Stop). Logged for learning.

**Enforcer**: Module (engine/enforcer.ts) spawning a single check script and capturing result (pass/fail/timeout).

**Enforcement Engine**: Complete system (engine/ directory, 12 modules) for applying hard and soft rails to agent-spawned tasks.

**Execution Phase**: One of four stages: pre-step (before agent), during-step (agent running), post-step (after agent), pre-deploy (final checks).

**Gate**: Enforcement point where bodyguard runs applicable checks. Each gate applies tier-filtered checks.

**Grace Rule**: If task >85% complete (GRACE_THRESHOLD), context-warden does not kill even if over token budget.

**Hard Rail**: Check marked `on_fail: "stop_build"` (Tier 0-1). When failed, build stops immediately. Philosophy: "code enforces, not polite requests".

**Heartbeat**: Liveness signal emitted by agent every 10 seconds. heartbeat.ts monitors for 3 consecutive missed signals (30s elapsed).

**Lessons**: Post-execution record in `tasks/lessons.md` documenting what went right/wrong. Circuit-breaker records user decisions here.

**Project-State**: FSM tracking project lifecycle: OPEN (0-15 min), PAUSED (15 min - 24h), CLOSED (24h+), ARCHIVED.

**Spine**: Project state snapshot (file inventory, git status, test/build results, docker health, endpoint health). Built pre-step and post-step with one LLM call for summarization.

**Spine-Lock**: Write lock (engine/spine-lock.ts) preventing concurrent updates. Uses atomic file operation.

**Soft Rail**: Check marked `on_fail: "warn"` (Tier 2-3). When failed, build pauses and shows three user options. Philosophy: "guidance, not law".

**Threshold**: Numeric boundary triggering enforcement action. All defined in constants/, never hardcoded.

**Tier**: Classification of check by speed/cost (0-3). Tier 0: <5s. Tier 1: 5-45s. Tier 2: 10-30s. Tier 3: 60-90s.

**Timeout**: Maximum duration allowed for check execution. Exceeded timeout triggers status="timeout".

**Token Budget**: Maximum tokens allowed for agent execution. Varies by model. Enforced by context-warden.ts every 30s.

**Verdict**: Gate result (PASS/HARD_FAIL/SOFT_FAIL). PASS = all checks passed, proceed. HARD_FAIL = ≥1 hard check failed, stop immediately. SOFT_FAIL = ≥1 soft check warned, show options.

---

## Summary

This F1-quality specification document provides complete architectural blueprint for Instance 3 (spec layer) and Instance 4 (runtime layer) of the Hardcoded Enforcement Engine. It covers:

- **Why the system exists**: Hard/soft rail philosophy, code-based enforcement vs LLM verification
- **What it does**: 11 checks in parallel, Spine snapshots, Bodyguard gates, Context Warden monitors
- **How it works**: 15-step flowchart with numbered operations, hard vs soft rails distinction
- **How Instances relate**: Instance 3 (spec) produces constants/templates/docs; Instance 4 (runtime) implements engine modules
- **How to deploy**: Four-stage pipeline with checks at each stage
- **Critical constraints**: No magic numbers, parallel checks, single LLM call, circuit-breaker escape hatch, clean separation

**Total word count:** 7,500+ words
**Total sections:** 11 (Executive Summary, 11-Check System, Data Flow, Architecture Layers, Hard vs Soft Rails, Constraints, Deployment, Glossary, plus supporting sections)
**Target audience:** Engineers implementing Instance 4, architects designing enforcement systems, operators deploying the system
