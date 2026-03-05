# v1.0 Milestone Master Verification Report

**Date:** 2026-03-04
**Reviewed By:** 4 Parallel Agents (Note: SKILLS-GLUE-REVIEW.md was not created by parallel agents)
**Overall Status:** ISSUES_FOUND

---

## Executive Summary

The Hardcoded Enforcement Engine v1.0 milestone has a **production-ready backend architecture** with correct 10-step enforcement flow, DAG execution, and circuit breaker logic implemented in the worktree branch. However, **critical integration gaps prevent release**: the main branch is missing CircuitBreakerModal integration and IPC fixes, the enforcer script paths do not match actual Python script names, and "E2E" tests are mislabeled integration tests that never launch a real Electron app. The adapter layer is solid for Codex but has API key security concerns. Overall, the system is architecturally sound but needs merge work, path corrections, and genuine E2E testing before v1.0 sign-off.

---

## Critical Issues (Must Fix Before Release)

| # | Issue | Location | Impact | Owner |
|---|-------|----------|--------|-------|
| 1 | **Main branch missing CircuitBreakerModal** | `src/renderer/components/App.tsx` | Users cannot respond to circuit breaker failures; app hangs on MAX_RETRIES | Wiring |
| 2 | **Main branch has broken conductor:user-decision IPC** | `src/main/index.ts` lines 2002-2013 | Sends decision back to renderer instead of resolving scheduler Promise | Wiring |
| 3 | **Enforcer script path mismatch** | `bodyguard.ts` line 96-98 | All bodyguard checks fail - generates `check_test_exit_code.py` but actual file is `check_tests.py` | Enforcement |
| 4 | **E2E tests are NOT E2E** | `tests/e2e/electron-dispatch.test.ts` | Zero confidence app works when run; Electron mocked via require.cache | Tests |
| 5 | **CircuitBreakerModal completely untested** | No test file exists | Unknown if modal renders, functions, or is accessible | Tests |

---

## Major Issues (Should Fix)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | **API key exposure in CLI arguments** | `agent-spawner.ts` lines 61-67 | API keys visible in `ps aux`, shell history, system logs |
| 7 | **Main branch missing step-needs-user IPC forwarding** | `setupConductorIPC()` in `index.ts` | Renderer never receives circuit breaker events |
| 8 | **Missing constants from spec** | `constants.ts` | CRON_INTERVALS, TIMEOUTS, FILE_THRESHOLDS, PROJECT_STATE, SUB_AGENT_RULES, LATENCY_BUDGET not implemented |
| 9 | **Plugin count mismatch** | `COMPATIBILITY.md` | Spec says 29 plugins, actual count is 16 |
| 10 | **Enforcer completely mocked in integration tests** | `conductor-scheduler-executor.test.ts` lines 122-132 | No validation that bodyguard checks actually integrate |
| 11 | **Main branch global.d.ts missing IPC declarations** | `src/renderer/global.d.ts` | TypeScript errors if CircuitBreakerModal added without updates |
| 12 | **WebExecutor registration is conditional** | `index.ts` executor registration | Plans requiring web steps before provider selection will fail |
| 13 | **CHECK_TIMEOUT_MS discrepancy** | `constants.ts` | Uses 10s but spec says 60s; may cause premature timeouts |

---

## Minor Issues (Nice to Have)

| # | Issue | Location |
|---|-------|----------|
| 14 | Inconsistent Tool type definition | `codex-adapter/types.ts` vs `13-tool-permissions.ts` |
| 15 | Duplicate updateProjectState() call | `runtime/index.ts` lines 61 and 72 |
| 16 | Unsafe type assertions (`as any`) | `step-scheduler.ts` lines 145, 325-326, 354-355 |
| 17 | CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS case mismatch | constants.ts uses lowercase, spec uses user-facing labels |
| 18 | Hardcoded model names in tests may drift | `claude-adapter.test.ts` lines 213-215 |
| 19 | Mock DOM may not match real ChatGPT | `tests/e2e/mocks.ts` |
| 20 | No test timeouts configured | All test files |
| 21 | Custom test framework instead of Vitest/Jest | All test files |
| 22 | SpineState.projectState always returns "OPEN" | `spine.ts` - no pause/closed detection |
| 23 | Adapter code in /docs/ONGOING_WORK/ instead of /src/adapters/ | Unconventional location |
| 24 | Missing input validation in buildCLIArguments() | `runtime/adapters/agent-adapter.ts` |

---

## Known Flaws Verification Summary

| Flaw from User | Status | Details |
|----------------|--------|---------|
| Enforcer check scripts don't exist | **PARTIALLY CONFIRMED** | Scripts exist in `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/` (11 Python + 1 Bash), but bodyguard generates incorrect path names |
| spine.ts has real filesystem dependency | **CONFIRMED** | Lines 67-72 use `execFile("find")`, lines 94-106 use `execFile("git")` - intentional for production but requires test mocking |
| Definitive failures: retry/stop only (no skip) | **CONFIRMED** | `CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS: ['retry', 'stop']` correctly excludes 'skip' per spec |
| The broken conductor:user-decision IPC handler was removed | **PARTIALLY CONFIRMED** | Removed in WORKTREE (L2031 comment), still PRESENT in main branch (L2002-2013) |
| CircuitBreakerModal never tested in running Electron | **CONFIRMED** | No test verifies modal display or button clicks; tests mock IPC events |
| --test-mode flag skips BrowserView, auto-updater, tray | **CONFIRMED** | Lines 170-184 in worktree index.ts correctly implement test mode |
| E2E tests don't launch real Electron | **CONFIRMED** | `require.cache` mocking at line 97 in electron-dispatch.test.ts; `launchTestApp()` in fixtures.ts never called |
| 15 pre-existing step-scheduler test failures | **UNVERIFIED** | Would need to run tests to confirm |
| CircuitBreakerModal was auto-approved | **CONFIRMED** | No test file exists; grep for "CircuitBreakerModal" in tests/ returns zero results |

---

## Positive Findings

### Adapter Layer
1. Well-structured type definitions in `codex-adapter/types.ts` - clean separation of AgentConfig, AgentResult, AgentHandle
2. Comprehensive error handling in codex-adapter with timeout handling (SIGTERM then SIGKILL fallback)
3. Good sandbox mode logic - `getSandboxMode()` correctly identifies write tools
4. Clear documentation in `INSTANCE-2-ADAPTERS.md` and `COMPATIBILITY.md`
5. Sound architecture decision to skip Claude adapter (native runtime)

### Enforcement Engine
1. Parallel check execution using `Promise.allSettled()` with batch limits (MAX_PARALLEL_CHECKS = 5)
2. Correct verdict aggregation - HARD_FAIL (definitive) vs SOFT_FAIL (heuristic)
3. Per-check retry logic with configurable attempts and delays
4. Proper timeout handling with SIGTERM for both inline commands and Python scripts
5. Clean state snapshot design using `execFile` to avoid shell injection
6. SpineDiff correctly computes file additions, removals, modifications
7. `checkCompliance()` prevents "all checks timed out so gate passes" bug

### Wiring & Integration
1. All 10 steps of enforcement flow correctly implemented in step-scheduler.ts
2. Correct executor registration (cli, service, web) in worktree branch
3. Complete IPC pipeline in worktree - step-needs-user flows properly to CircuitBreakerModal
4. Test mode correctly skips BrowserView, auto-updater, tray

### Test Infrastructure
1. claude-adapter.test.ts has good boundary testing and clear assertions
2. Thorough event ordering validation in integration tests
3. Well-structured mock data in mocks.ts
4. Good capability verification in compatibility-matrix-validation.ts

---

## Action Items (Prioritized)

### P0 - Blockers (Must Complete Before Any Release)

1. **Merge CircuitBreakerModal to main branch**
   - Copy `CircuitBreakerModal.tsx` from worktree to `src/renderer/components/`
   - Import and render in `App.tsx`
   - Update `global.d.ts` with `onStepNeedsUser` and `sendStepDecision` declarations

2. **Fix main branch IPC wiring**
   - Add `scheduler.on('step-needs-user', ...)` to `setupConductorIPC()` in index.ts
   - Remove or fix the broken `conductor:user-decision` handler (lines 2002-2013)

3. **Fix enforcer script path mapping**
   - Create `CHECK_SCRIPT_MAP` in bodyguard.ts to map check names to actual script filenames:
     - `test-exit-code` -> `check_tests.py`
     - `file-existence` -> `check_files_exist.py`
     - `file-non-empty` -> `check_files_nonempty.py`
   - Configure `CHECKS_DIR` constant pointing to actual script location

4. **Add CircuitBreakerModal test**
   - Render test verifying modal appears with step info
   - Interaction test for retry/skip/stop buttons
   - IPC integration test verifying decision reaches scheduler

### P1 - Before Release

5. **Fix API key security issue**
   - Pass API keys via environment variables to child processes, not CLI arguments
   ```typescript
   const env = { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
   spawn(cmd, args, { env });
   ```

6. **Add actual E2E test**
   - Use existing `launchTestApp()` from fixtures.ts
   - Launch real Electron, navigate to provider, inject message, verify response
   - Test CircuitBreakerModal appearance on simulated failure

7. **Rename tests/e2e/ to tests/integration/**
   - Current naming is misleading; tests do not launch real Electron

8. **Add missing constants from spec**
   - CRON_INTERVALS, TIMEOUTS, FILE_THRESHOLDS, PROJECT_STATE, SUB_AGENT_RULES, LATENCY_BUDGET

9. **Increase CHECK_TIMEOUT_MS from 10_000 to 60_000**
   - Per spec, vitest can be slow and needs 60 seconds

### P2 - Post-Release

10. Migrate to Vitest/Jest for proper test isolation and coverage
11. Consolidate Tool type definitions to single source of truth
12. Add lazy WebExecutor wrapper that queues requests until chatGPTView available
13. Reconcile App.tsx divergence (103-line main vs 35-line worktree)
14. Add integration test for full circuit breaker flow with real Electron
15. Relocate adapter code from `/docs/ONGOING_WORK/` to `/src/adapters/`
16. Clarify plugin count requirement (29 vs 16)
17. Add input validation to `buildCLIArguments()` in agent-adapter.ts
18. Remove unsafe type assertions (replace `as any` with proper typing)

---

## Files to Relocate

| Current Location | Should Be | Reason |
|------------------|-----------|--------|
| `/docs/ONGOING_WORK/ADAPTORS/codex-adapter/` | `/src/adapters/codex/` | Production code in docs folder |
| `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/` | `/src/enforcement/` | Production code in docs folder |
| `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/` | `/src/enforcement/checks/` | Bodyguard script path resolution |

---

## Merge Requirements

The worktree branch `instance3-instance4-implementation` contains critical fixes that must be merged to main:

| File | Worktree Path | Changes to Merge |
|------|---------------|------------------|
| CircuitBreakerModal.tsx | `.claude/worktrees/.../src/renderer/components/` | **Entire file** (103 lines) |
| index.ts | `.claude/worktrees/.../src/main/` | step-needs-user forwarding (L1909-1912), executor registration (L782-810), broken handler removal |
| global.d.ts | `.claude/worktrees/.../src/renderer/` | onStepNeedsUser and sendStepDecision declarations (L122-130) |
| App.tsx | `.claude/worktrees/.../src/renderer/components/` | Add CircuitBreakerModal render |

**Merge Strategy:**
1. Cherry-pick IPC fixes from worktree index.ts
2. Copy CircuitBreakerModal.tsx
3. Update global.d.ts with type declarations
4. Decide on App.tsx approach (keep main 103-line version and add modal, or adopt worktree 35-line version)

---

## Test Coverage Summary

| Category | Tests | Status | Notes |
|----------|-------|--------|-------|
| Claude Adapter | 8 | PASS | Good unit test coverage, clear assertions |
| Integration Pipeline | 23 | PARTIAL | Heavy mocking undermines confidence |
| "E2E" Dispatch | 10 | FAIL | Not actual E2E; Electron mocked |
| Compatibility Matrix | 4 | PASS | Validates adapter capabilities |
| CircuitBreakerModal | 0 | MISSING | No test file exists |
| **Total** | **45** | **ISSUES** | Need actual E2E and modal tests |

**Coverage Gaps:**
- Real Electron app launch (never tested)
- CircuitBreakerModal UI (never tested)
- Real IPC communication (always mocked)
- Actual CLI spawning (never runs Codex/Claude)
- Real ChatGPT DOM interaction (mock structures only)
- Session resume across restarts (claimed but untested)
- Cross-process state persistence (StateManager mocked)

---

## Sign-off Checklist

- [ ] **All P0 blockers resolved**
  - [ ] CircuitBreakerModal merged to main
  - [ ] IPC pipeline fixed in main branch
  - [ ] Script path mapping corrected
  - [ ] Modal test added
- [ ] **IPC pipeline complete** (currently complete in worktree only)
- [ ] **Worktree merged to main** (4 files need merge)
- [ ] **10-step enforcement verified** (PASS in step-scheduler.ts)
- [ ] **Tests passing**
  - [ ] Existing 45 tests pass
  - [ ] New CircuitBreakerModal test passes
  - [ ] Actual E2E test passes

---

## Appendix: Review Status by Agent

| Agent | Review File | Status | Critical Issues |
|-------|-------------|--------|-----------------|
| Agent-1 (Adapters) | ADAPTER-REVIEW.md | ISSUES_FOUND | API key exposure, plugin count mismatch, missing files |
| Agent-2 (Enforcement) | ENFORCEMENT-REVIEW.md | ISSUES_FOUND | Script path mismatch, missing constants |
| Agent-4 (Tests) | TEST-QUALITY-REVIEW.md | ISSUES_FOUND | E2E not real E2E, CircuitBreakerModal untested |
| Agent-5 (Wiring) | WIRING-REVIEW.md | ISSUES_FOUND | Main branch missing modal + IPC fixes |
| Agent-3 (Skills/Glue) | NOT CREATED | N/A | Review file does not exist |

---

## Recommendation

**DO NOT release v1.0 until P0 blockers are resolved.**

The architecture is sound and the worktree branch has working code, but the main branch is not ready. Estimated effort to reach v1.0:

| Task | Effort |
|------|--------|
| Merge 4 worktree files | 1-2 hours |
| Fix script path mapping | 30 minutes |
| Add CircuitBreakerModal test | 1 hour |
| Add actual E2E test | 2-3 hours |
| Fix API key security | 30 minutes |
| **Total** | **5-7 hours** |

After P0 blockers are resolved, v1.0 can be signed off with known minor issues tracked for P2.

---

*Master Report Generated: 2026-03-04*
*Consolidated from 4 parallel agent reviews*
