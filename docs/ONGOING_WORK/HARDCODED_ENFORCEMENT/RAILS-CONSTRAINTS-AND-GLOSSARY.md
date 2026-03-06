## Section III: Hard vs Soft Rails, Constraints, Deployment, and Glossary

---

### Hard Rails vs Soft Rails: The Enforcement Spectrum

The enforcement engine distinguishes between **hard rails** (unbreakable boundaries that stop execution) and **soft rails** (warnings that allow human override). This section explains each, shows the ASCII comparison, and defines consequences.

#### The Distinction

A **hard rail** is a check whose failure means the entire step stops immediately—no escape hatch, no user decision. Hard rails are non-negotiable: tests must pass, secrets must be cleared, build must succeed. The philosophy is **"code enforces, not polite requests"**.

A **soft rail** is a check whose failure triggers a warning and offers the user three options: Retry (run check again), Skip Step (proceed despite warning), or Stop Build (terminate). Soft rails are guidance, not law. Examples: token usage under threshold, responsive design valid, deployment health green.

The distinction is encoded in each check's `on_fail` property:
- `on_fail: "stop_build"` → Hard rail (Tier 0-1)
- `on_fail: "warn"` → Soft rail (Tier 2-3)

#### ASCII Comparison Table: Hard Rails vs Soft Rails

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

#### Hard Rail Checks (Tier 0-1)

These eleven checks are **non-negotiable**. If any fails, the build stops immediately.

1. **check_files_exist** (Tier 0, 5s timeout)
   - Verifies declared files present in filesystem
   - Failure: Required file missing (e.g., `src/App.tsx`)
   - Consequence: STOP (cannot proceed without declared files)

2. **check_files_nonempty** (Tier 0, 10s timeout)
   - Verifies no stub files (< 50 bytes)
   - Failure: Stub file found (e.g., empty placeholder)
   - Consequence: STOP (stub files indicate incomplete work)

3. **check_secrets** (Tier 0, 15s timeout, via `check_secrets.sh` + gitleaks)
   - Verifies no secrets in git index
   - Failure: API key, password, token detected
   - Consequence: STOP (security breach, must be fixed before deploy)

4. **check_tests** (Tier 1, 45s timeout)
   - Verifies `npm test` exits with code 0
   - Failure: Test suite fails (≥1 failing test)
   - Consequence: STOP (broken tests block production)

5. **check_build_artifact** (Tier 1, 60s timeout)
   - Verifies `dist/` contains `.html`, `.js`, `.css` files
   - Failure: Build artifacts missing (syntax error, build step failed)
   - Consequence: STOP (no artifacts = no deploy)

6. **check_docker_health** (Tier 1, 15s timeout, 3 retries)
   - Verifies `docker ps` returns container list
   - Failure: Docker daemon unreachable
   - Consequence: STOP (infrastructure required for testing)

7. **check_scope** (Tier 1, 10s timeout)
   - Verifies `git diff --name-only` changes within declared scope
   - Failure: Out-of-scope file modified (e.g., modified `package-lock.json` when not declared)
   - Consequence: STOP (scope drift indicates unplanned changes)

**Special: check_uninstall** (Tier 1, 10s timeout, optional post-step)
   - Verifies removed packages absent from `node_modules/`
   - Failure: Package still present after uninstall
   - Consequence: STOP if enabled (indicates failed cleanup)

**Special: check_lesson** (Tier 1, 5s timeout, post-step)
   - Verifies `tasks/lessons.md` has new entry with required fields
   - Failure: Lesson missing or incomplete
   - Consequence: STOP (learning enforcement)

#### Soft Rail Checks (Tier 2-3)

These nine checks warn but allow user override. Useful for best practices and non-blocking validations.

1. **check_tokens** (Tier 2, 10s timeout)
   - Verifies token usage < TOKEN_THRESHOLDS[model].killAt
   - Failure: Token budget exceeded (85%+ of limit)
   - Consequence: SOFT_FAIL (warn, allow skip if <85% done, else pre-select skip)

2. **check_responsive** (Tier 3, 60s timeout via Playwright)
   - Verifies screenshots at 3 viewports (mobile/tablet/desktop) pass visual regression
   - Failure: Responsive design breaks at viewport
   - Consequence: SOFT_FAIL (can skip if urgent)

3. **check_scope** (Tier 2, 10s timeout) — *Listed in both for flexibility*
   - When tier 2: Warn about out-of-scope, allow skip
   - When tier 1: Block on out-of-scope (hard)

4. **check_deploy_health** (Tier 2, 30s timeout, 3 retries)
   - Verifies deployed URL responds with 200 OK
   - Failure: Deployed endpoint returns 503 or timeout
   - Consequence: SOFT_FAIL (might be transient, allow retry)

5. **check_docker_health** (Tier 2, 15s timeout, 3 retries) — *Also listed in hard for pre-step*
   - Same as hard, but tier 2 allows skip if necessary
   - Consequence: SOFT_FAIL when tier 2

6. **check_lesson** (Tier 2, 5s timeout) — *Also listed in hard for post-step enforcement*
   - When tier 2: Warn if lesson incomplete, allow skip
   - Consequence: SOFT_FAIL (learning is encouraged, not required)

7. **check_uninstall** (Tier 2, 10s timeout) — *Also listed in hard if critical*
   - When tier 2: Warn if package still present, allow skip
   - Consequence: SOFT_FAIL (cleanup is best-effort)

8. **check_tokens** (Tier 3, 10s timeout) — *Can escalate to tier 3 for stricter enforcement*
   - Same token check, but slower models hit tier 3
   - Consequence: SOFT_FAIL (warning only)

9. **check_deploy_health** (Tier 3, 30s timeout) — *Same check, tier 3 for slow deploys*
   - Consequence: SOFT_FAIL (health check can timeout gracefully)

#### Failure Mode Severity Table

```
┌────────────────────────────────────────────────────────────────────────┐
│ FAILURE MODE SEVERITY & RECOVERY                                       │
├──────────────────────────────┬──────────────┬──────────────────────────┤
│ Check                        │ Severity     │ Recovery Path            │
├──────────────────────────────┼──────────────┼──────────────────────────┤
│ check_secrets                │ CRITICAL     │ Fix code, retryStep      │
│ (API key in code)            │ (Hard Fail)  │ → re-authenticate        │
│                              │              │                          │
│ check_tests                  │ CRITICAL     │ Fix tests, retryStep     │
│ (npm test = 1)               │ (Hard Fail)  │ → debug locally          │
│                              │              │                          │
│ check_build_artifact         │ CRITICAL     │ Fix build, retryStep     │
│ (dist/ empty)                │ (Hard Fail)  │ → check syntax errors    │
│                              │              │                          │
│ check_files_exist            │ CRITICAL     │ Create files, retryStep  │
│ (required file missing)       │ (Hard Fail)  │ → ensure declaration OK  │
│                              │              │                          │
│ check_files_nonempty         │ HIGH         │ Fill stub, retryStep     │
│ (stub file < 50 bytes)       │ (Hard Fail)  │ → write real code        │
│                              │              │                          │
│ check_docker_health (Tier1)  │ HIGH         │ Restart docker, retry    │
│ (docker unreachable)         │ (Hard Fail)  │ → check daemon running   │
│                              │              │                          │
│ check_scope (Tier1)          │ HIGH         │ Revert changes, retry    │
│ (out-of-scope changes)       │ (Hard Fail)  │ → only modify declared   │
│                              │              │                          │
│ check_deploy_health          │ MEDIUM       │ Wait + Retry             │
│ (deployed URL 503)           │ (Soft Fail)  │ → skip if > 85% done     │
│                              │              │                          │
│ check_tokens                 │ MEDIUM       │ Wait for tokens, Skip    │
│ (usage > threshold)          │ (Soft Fail)  │ → resume later           │
│                              │              │                          │
│ check_responsive             │ LOW          │ Fix CSS, Retry           │
│ (viewport fails)             │ (Soft Fail)  │ → or skip if not blocking│
│                              │              │                          │
│ check_lesson                 │ LOW          │ Add lesson, Retry        │
│ (missing fields)             │ (Soft Fail)  │ → or skip if time-bound  │
│                              │              │                          │
│ check_uninstall              │ LOW          │ Cleanup, Retry           │
│ (package still present)       │ (Soft Fail)  │ → or skip if partial     │
│                              │              │                          │
└──────────────────────────────┴──────────────┴──────────────────────────┘
```

---

### Critical Constraints: Non-Negotiable Design Rules

The enforcement engine operates under five critical constraints that define its correctness model.

#### Constraint 1: No Magic Numbers in Engine Code

Every numeric value (timeouts, thresholds, intervals, retry counts) must come from `constants/` directory. The engine code contains **zero hardcoded numbers** except for comparison operators (< > =), loop counters, and arithmetic operations needed to combine constants.

**Implementation:**
- All timeouts imported from `03-timeouts.ts`
- All thresholds imported from domain-specific files (`01-context-warden.ts`, `05-file-thresholds.ts`, etc.)
- All intervals imported from `02-cron-intervals.ts`
- All retry counts imported from `09-retry-policies.ts`

**Verification:**
```bash
# Scan engine/ for hardcoded numbers (should find none)
grep -E "[0-9]{2,}" engine/*.ts | grep -v "// " | wc -l
# Should output: 0
```

**Benefit:** All enforcement parameters can be tuned by editing `constants/`, without recompiling engine code. Enables A/B testing, rapid iteration, and parameter optimization.

#### Constraint 2: Promise.allSettled() for Parallel Checks

The bodyguard dispatcher MUST use `Promise.allSettled()` to run all applicable checks in parallel, never sequential. This prevents one slow check from blocking others and ensures all checks run even if one fails.

**Implementation:**
```typescript
// bodyguard.ts enforces parallel execution
const promises = checks.map(check => runCheckWithRetry(check, options));
const results = await Promise.allSettled(promises);
```

**Why allSettled() not all():**
- `Promise.all()` stops on first failure → some checks never run
- `Promise.allSettled()` runs all checks → captures all failures, better debugging

**Benefit:** Parallel execution reduces gate latency from O(n*timeout) to O(max(timeout)). With 12 checks × 10-60s each, sequential = 5+ min, parallel = 60s.

**Verification:**
- bodyguard.ts line ~150-160 must show `Promise.allSettled()`
- No `await` inside loop (would be sequential)
- All check timeouts respected via enforcer.ts timeout mechanism

#### Constraint 3: Single LLM Call in Spine

The spine module (project state snapshot) executes 6 shell commands (find, git status, npm test, npm build, docker ps, curl health), then makes **exactly 1 LLM call** to summarize results into plain English.

This one call is marked with comment: `// LLM CALL:`

**Implementation:**
```typescript
// spine.ts structure:
1. find . -type f → file count
2. git status → staged/unstaged/untracked
3. npm test → test result (0=pass, 1=fail)
4. npm build → build result (0=pass, 1=fail)
5. docker ps → container statuses
6. curl $HEALTH_ENDPOINT → endpoint health

// LLM CALL: Summarize above into plain English
const summary = await summarizeState(results);
```

**Why one call not many:**
- Multiple LLM calls = expensive (1 call = ~0.5 sec + 100-500 tokens)
- One summary call = efficient, reusable output
- Allows humans to read plain English description of project state

**Benefit:** Reduces token burn in monitoring loop. Spine runs pre-step and post-step (2×/per step), so singleton LLM call is critical for budget.

**Verification:**
- Count `// LLM CALL:` comments in spine.ts: must equal 1
- All 6 shell commands exist
- Summary output is prose, not JSON

#### Constraint 4: Circuit-Breaker Provides Escape Hatch on Hard Failures

When a hard check fails, the build pauses and shows user options:
- **Retry**: Run the check again (transient failure?)
- **Skip Step**: Accept the failure and continue (urgent release?)
- **Stop Build**: Give up and ask for help

The circuit breaker captures user decision and stores in `tasks/lessons.md` for learning.

**Implementation:**
```typescript
// circuit-breaker.ts
if (verdict === HARD_FAIL) {
  // Show UI with three buttons
  const decision = await showDecisionUI({
    failed_checks: failedCheckNames,
    timeout_ms: 120_000, // 2 min
  });

  // Store decision for learning
  await recordDecision(decision);
}
```

**Why escape hatch:**
- Hard failures can be transient (docker restart, network blip)
- User may have urgent reason to skip (hotfix deployment)
- Captures human judgment for training future enforcement

**Benefit:** Balances strictness with pragmatism. Enforcement isn't dogmatic; it learns from exceptions.

**Verification:**
- circuit-breaker.ts shows three options on hard fail
- User decision recorded to tasks/lessons.md
- Grace rule applied (>85% done → pre-select Skip)

#### Constraint 5: Clean Separation — Instance 4 Only Imports constants/ and engine/

Instance 4 (implementation) must import ONLY:
- `constants/` directory (all hardcoded values)
- `engine/` directory (orchestration logic)
- Standard Node.js/TypeScript libraries

Instance 4 **must NOT**:
- Import from other projects
- Hardcode values locally
- Copy constants from documentation
- Invent new values outside constants/

**Implementation:**
```typescript
// Instance 4 file - CORRECT
import { TOKEN_THRESHOLDS, GRACE_THRESHOLD } from '@/constants';
import { contextWarden } from '@/engine/context-warden';

// Instance 4 file - WRONG (do not do this)
import TOKEN_THRESHOLDS from '../../../docs/HARDCODED-ENFORCEMENT-VALUES.md';
const GRACE_THRESHOLD = 0.85; // Magic number!
```

**Benefit:** Single source of truth. All configuration changes go through constants/, making audits and compliance easier.

**Verification:**
- Instance 4 imports: `grep -r "^import.*from" | grep -v "constants\|engine\|node_modules"` should return 0
- No hardcoded numbers in Instance 4 source
- All values traceable to constants/

---

### Deployment Mapping: How Checks Run in Pipeline

The enforcement engine operates at four stages of the build pipeline. Each stage runs different checks appropriate to that phase.

```
┌────────────────────────────────────────────────────────────────────────────┐
│          ENFORCEMENT ENGINE DEPLOYMENT STAGES (Step-by-Step)              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ STAGE 1: PRE-BUILD (Before Agent Spawns)                                 │
│ ═════════════════════════════════════════════════════════════════════════ │
│                                                                            │
│ Triggered: step-scheduler.ts calls bodyguard.ts BEFORE agent spawn        │
│ Duration: 10-20 seconds (parallel)                                        │
│ Phase Type: "pre-step"                                                    │
│                                                                            │
│ Checks Running (Tier 0-1, all HARD):                                     │
│ ├─ check_files_exist (5s) — Are declared files present?                  │
│ ├─ check_files_nonempty (10s) — No stub files?                           │
│ ├─ check_secrets (15s) — gitleaks found 0?                               │
│ ├─ check_tests (45s) — npm test exit code = 0?                           │
│ ├─ check_build_artifact (60s) — dist/ has .html/.js/.css?                │
│ ├─ check_docker_health (15s, 3 retries) — docker ps OK?                  │
│ └─ check_scope (10s) — git diffs in declared scope?                      │
│                                                                            │
│ Verdict:                                                                  │
│ ├─ ALL PASS → proceed to STAGE 2 (Agent Spawn)                           │
│ └─ ANY HARD FAIL → STOP immediately, show error, circuit breaker UI      │
│                                                                            │
│ Source: enforcer.ts, bodyguard.ts, step-scheduler.ts (line ~200)         │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ STAGE 2: AGENT EXECUTION (During Agent Runtime)                          │
│ ═════════════════════════════════════════════════════════════════════════ │
│                                                                            │
│ Triggered: Agent spawned, runs in background (CLI tool, LLM, script)     │
│ Duration: 5 minutes - 1 hour (varies by task)                            │
│ Phase Type: "during-step"                                                 │
│ Parallel Monitors:                                                        │
│                                                                            │
│ 1. context-warden.ts (Cron every 30s)                                    │
│    ├─ Monitor token usage via API headers                                │
│    ├─ If utilization > TOKEN_THRESHOLDS[model].killAt:                  │
│    │  ├─ If taskProgress < 0.85 (GRACE_THRESHOLD):                       │
│    │  │   └─ Send SIGTERM, wait 5s, SIGKILL → respawn at step           │
│    │  └─ Else (>85% done):                                               │
│    │      └─ Log WARN, allow completion ("grace period")                 │
│    │                                                                     │
│    Source: context-warden.ts (cron-manager.ts registration)              │
│                                                                            │
│ 2. heartbeat.ts (Monitor every 10s)                                      │
│    ├─ Expect agent to write signal to stdout every 10s                   │
│    ├─ 3 missed signals (30s elapsed) = STALE_AGENT                       │
│    ├─ Alert context-warden: agent is hung                               │
│    └─ context-warden kills and respawns                                 │
│                                                                            │
│    Source: agent-spawner.ts (listener thread), context-warden.ts         │
│                                                                            │
│ 3. project-state.ts (FSM check)                                          │
│    ├─ Read last spine.md write timestamp                                │
│    ├─ If >15 min without update → PAUSED state                          │
│    ├─ If >24h without update → CLOSED state, archive                    │
│    └─ Used to detect agent stalls at project level                      │
│                                                                            │
│    Source: project-state.ts, queried by step-scheduler.ts               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ STAGE 3: POST-STEP VALIDATION (After Agent Completes)                   │
│ ═════════════════════════════════════════════════════════════════════════ │
│                                                                            │
│ Triggered: Agent exits (success or killed) → bodyguard.ts runs again     │
│ Duration: 30-90 seconds (parallel)                                       │
│ Phase Type: "post-step"                                                   │
│                                                                            │
│ Checks Running (Tier 1-3, mix of HARD and SOFT):                        │
│                                                                            │
│ HARD (Tier 1):                                                           │
│ ├─ check_build_artifact (60s) — dist/ has output?                       │
│ ├─ check_lesson (5s) — lessons.md has new entry?                        │
│ └─ check_uninstall (10s) — removed packages gone?                       │
│                                                                            │
│ SOFT (Tier 2-3):                                                         │
│ ├─ check_responsive (60s) — screenshots pass viewport test?              │
│ ├─ check_deploy_health (30s, 3 retries) — deployed URL 200 OK?          │
│ ├─ check_tokens (10s) — usage < threshold?                              │
│ ├─ check_scope (10s) — post-step changes in scope?                      │
│ └─ check_docker_health (15s, 3 retries) — docker still running?         │
│                                                                            │
│ Verdict:                                                                  │
│ ├─ ALL PASS → mark step complete, move to STAGE 4                       │
│ ├─ HARD FAIL → stop immediately, circuit breaker                        │
│ └─ SOFT FAIL → show options [Retry/Skip/Stop]                           │
│                                                                            │
│ Source: bodyguard.ts, step-scheduler.ts (line ~300)                     │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ STAGE 4: PRE-DEPLOY VERIFICATION (Before CI/CD Deploy)                  │
│ ═════════════════════════════════════════════════════════════════════════ │
│                                                                            │
│ Triggered: All steps complete → step-scheduler.ts gates deployment       │
│ Duration: 10-30 seconds (final checks)                                   │
│ Phase Type: "pre-deploy"                                                  │
│                                                                            │
│ Checks Running:                                                           │
│ ├─ check_deploy_health (30s) — is prod endpoint healthy?                 │
│ ├─ check_secrets (15s) — final gitleaks scan                             │
│ ├─ check_lesson (5s) — final lesson validation                           │
│ └─ check_build_artifact (60s) — final artifact check                     │
│                                                                            │
│ All checks are HARD at this stage (deployment is final).                 │
│                                                                            │
│ Verdict:                                                                  │
│ ├─ ALL PASS → proceed to deploy                                          │
│ └─ ANY FAIL → block deployment, require user sign-off                    │
│                                                                            │
│ Source: step-scheduler.ts, circuit-breaker.ts (final gate)               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Check Activation Rules: When Does Each Check Run?

Not every check runs at every stage. The `CHECK_ACTIVATION` constant in `10-check-activation.ts` defines which checks apply to which phases.

```typescript
// From constants/10-check-activation.ts
export const CHECK_ACTIVATION = {
  check_files_exist: {
    pre_step: true,    // Must exist before agent runs
    post_step: false,   // Don't recheck after
    during_step: false, // Not during
  },
  check_tests: {
    pre_step: true,     // Pre-step: tests must pass initially
    post_step: true,    // Post-step: tests still pass after?
    during_step: false, // Can't test during
  },
  check_tokens: {
    pre_step: false,
    post_step: true,    // Check token usage post-step
    during_step: true,  // Context-warden monitors during
  },
  check_responsive: {
    pre_step: false,    // No artifacts yet
    post_step: true,    // Post-step: responsive design OK?
    during_step: false,
  },
  // ... (12 total checks, each with 3-phase config)
};
```

---

### Glossary: Definitive Terms

**Bodyguard**: The gate dispatcher module (`engine/bodyguard.ts`) that loads applicable checks for a phase, spawns them in parallel via `Promise.allSettled()`, collects results, and produces a verdict (PASS/HARD_FAIL/SOFT_FAIL).

**Check**: Individual verification script (e.g., `check_tests.py`, `check_secrets.sh`) that validates one aspect of project health. Returns exit code 0 (pass) or 1 (fail), optionally with JSON output.

**Circuit-Breaker**: Module (`engine/circuit-breaker.ts`) that handles gate failures. For HARD_FAIL, shows error and stops. For SOFT_FAIL, shows three user options: Retry, Skip Step, or Stop Build. Records user decision in `tasks/lessons.md`.

**Context-Warden**: Cron task running every 30 seconds (`engine/context-warden.ts`) that monitors token usage of active agents. If token budget exceeded and task not >85% done, sends SIGTERM → SIGKILL and respawns agent. If >85% done (grace rule), allows completion with warning.

**DAG**: Directed Acyclic Graph representing the 10-step execution sequence. Each step has pre-conditions, agent command, and post-conditions. Executed by `step-scheduler.ts` in order, with parallel gates at each stage.

**Decision Gate**: Point where user is asked to choose between conflicting options (Retry/Skip/Stop). Triggered by SOFT_FAIL verdict or timeout. User decision is logged for learning and future model training.

**Enforcer**: Module (`engine/enforcer.ts`) that spawns a single check script and captures result (pass/fail/timeout). Handles timeout enforcement, stdout/stderr capture, and exit code interpretation.

**Enforcement Engine**: Complete system (`engine/` directory, 12 modules) for applying hard and soft rails to agent-spawned tasks. Ensures code quality, infrastructure correctness, and token safety without human intervention (except for user decisions at gates).

**Execution Phase**: One of four stages in deployment pipeline: pre-step (before agent), during-step (agent running), post-step (after agent), pre-deploy (final checks). Each phase has different applicable checks.

**Gate**: Enforcement point where bodyguard runs applicable checks. PRE-STEP gate (10-20s, all hard) blocks bad state. POST-STEP gate (30-90s, mix of hard/soft) validates changes. Each gate applies tier-filtered checks.

**Grace Rule**: If task is >85% complete (GRACE_THRESHOLD), context-warden does not kill even if over token budget. Rationale: killing at 85% and restarting = double work, better to burn 15% extra.

**Hard Rail** (or Hard Fail): Check marked `on_fail: "stop_build"` (typically Tier 0-1). When failed, build stops immediately with no user escape hatch. Examples: secrets detected, tests fail, build fails. Philosophy: "code enforces, not polite requests".

**Heartbeat**: Liveness signal emitted by agent every 10 seconds to stdout. `heartbeat.ts` monitors for 3 consecutive missed signals (30s elapsed), which triggers STALE_AGENT alert to context-warden. Detects hangs vs crashes.

**Lessons**: Post-execution record in `tasks/lessons.md` documenting what went right/wrong and why. Circuit-breaker records user decisions here. Used for learning and training future enforcement models.

**Project-State**: Finite state machine (`engine/project-state.ts`) tracking project lifecycle: OPEN (0-15 min), PAUSED (15 min - 24h, no spine updates), CLOSED (24h+), ARCHIVED. Detects stalled agents at project level.

**Spine**: Project state snapshot (file inventory, git status, test/build results, docker health, endpoint health) built pre-step and post-step. Includes one LLM call to summarize state in prose. Stored in `.planning/spine.md`.

**Spine-Lock**: Write lock (`engine/spine-lock.ts`) preventing concurrent updates to `.planning/spine.md`. Uses atomic file operation (fs.openSync with O_EXCL), 5s timeout. Prevents corruption when multiple agents try to update state simultaneously.

**Soft Rail** (or Soft Fail): Check marked `on_fail: "warn"` (typically Tier 2-3). When failed, build pauses and shows user three options: Retry, Skip Step, or Stop Build. Examples: token budget warning, responsive design validation, deploy health check. Philosophy: "guidance, not law".

**Threshold**: Numeric boundary triggering enforcement action. Examples: TOKEN_THRESHOLDS[model].killAt (token budget), FILE_THRESHOLDS.min_size_bytes (50 bytes for stub check), GRACE_THRESHOLD (0.85 for >85% done). All defined in constants/, never hardcoded.

**Tier**: Classification of check by speed/cost (0-3). Tier 0: local file checks, <5s. Tier 1: fast commands (npm, git), 5-45s. Tier 2: API calls (curl, health), 10-30s. Tier 3: browser tests (Playwright), 60-90s. Gate applies tier-filtered checks.

**Timeout**: Maximum duration allowed for check execution. Exceeded timeout triggers EnforcerResult.status="timeout". Hard-fail tier: timeout = failure. Soft-fail tier: timeout = warn + allow skip. All timeouts imported from `03-timeouts.ts`.

**Token Budget**: Maximum tokens allowed for agent execution. Varies by model (Sonnet = 110k, Opus = 200k). Enforced by context-warden.ts, checked every 30s. Exceeded before grace threshold = kill + respawn.

**Verdict**: Gate result (PASS/HARD_FAIL/SOFT_FAIL) produced by bodyguard.ts. PASS = all checks passed, proceed. HARD_FAIL = ≥1 hard check failed, stop immediately. SOFT_FAIL = ≥1 soft check warned, show user options.

---

**Word Count Summary:**

- Hard vs Soft Rails: ~580 words
- Critical Constraints: ~410 words
- Deployment Mapping: ~320 words
- Glossary: ~420 words
- **Total: ~1,730 words**
