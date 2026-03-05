# Enforcement Engine Review

**Reviewer:** Agent-2 (Enforcement)
**Date:** 2026-03-04
**Status:** ISSUES_FOUND

## Summary

The enforcement engine implementation is architecturally sound with clean separation of concerns across types, constants, enforcer, bodyguard, and spine modules. The parallel check execution, verdict aggregation, and circuit breaker logic are well-implemented. However, there are script path mismatches between TypeScript and actual Python scripts, and the constants module is missing several spec-defined values.

## Files Reviewed

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/types.ts` | 259 | PASS | Comprehensive type definitions covering all enforcement entities |
| `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/constants.ts` | 148 | ISSUES | Missing several spec constants (TIMEOUTS, CRON_INTERVALS, etc.) |
| `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/enforcer.ts` | 311 | PASS | Well-implemented check execution with retry logic |
| `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/bodyguard.ts` | 326 | ISSUES | Script path generation mismatches actual script names |
| `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/spine.ts` | 242 | PASS | Reliable state snapshots with proper error handling |
| `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/index.ts` | 63 | PASS | Clean barrel exports |

## Issues Found

### Critical

**None** - No critical issues that would block the system from functioning.

### Major

**1. Script Path Mismatch in bodyguard.ts (Lines 96-98)**

The `createCheckFromName` function generates Python script paths like:
```typescript
script: `checks/check_${checkName.replace(/-/g, "_")}.py`
```

This produces paths like:
- `checks/check_test_exit_code.py` for "test-exit-code"
- `checks/check_file_existence.py` for "file-existence"
- `checks/check_file_non_empty.py` for "file-non-empty"

However, the actual Python scripts in `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/` are named:
- `check_tests.py` (not `check_test_exit_code.py`)
- `check_files_exist.py` (not `check_file_existence.py`)
- `check_files_nonempty.py` (not `check_file_non_empty.py`)

**Impact:** All bodyguard checks will fail to find their Python scripts.

**2. Missing Constants from Spec**

The `constants.ts` file implements TOKEN_THRESHOLDS, GRACE_THRESHOLD, bodyguard constants, MODEL_ROUTING, ENFORCER_RETRY_POLICIES, CHECK_ACTIVATION, and CIRCUIT_BREAKER. However, the spec (HARDCODED-ENFORCEMENT-VALUES.md) defines additional constants that are missing:

Missing from constants.ts:
- `CRON_INTERVALS` (section 2) - timer intervals for context warden, rate limit polling, etc.
- `TIMEOUTS` (section 3) - agent spawn, worker tier defaults, kill grace period
- `FILE_THRESHOLDS` (section 5) - MIN_MEANINGFUL_BYTES, MIN_SCREENSHOT_BYTES
- `PROJECT_STATE` (section 7) - INACTIVITY_TO_PAUSE_MS, PAUSE_TO_CLOSE_MS
- `SUB_AGENT_RULES` (section 8) - file count thresholds for sub-agent spawning
- `LATENCY_BUDGET` (section 18) - FAST_PATH_MS, TIER_1_CLASSIFY_MS

**3. Relative vs Absolute Script Paths**

The bodyguard generates relative paths (`checks/check_*.py`) but enforcer.ts resolves paths with `resolve(scriptPath)`. This assumes scripts are relative to the current working directory, but the scripts actually live in:
```
/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/
```

Not in the `src/enforcement/checks/` directory.

### Minor

**1. CHECK_TIMEOUT_MS Discrepancy**

In `constants.ts`, `CHECK_TIMEOUT_MS = 10_000` (10 seconds), but the spec (section 3) states:
```typescript
ENFORCER_CHECK_TIMEOUT_MS: 60_000, // 60 seconds (vitest can be slow)
```

This may cause premature timeouts for longer checks like test suites.

**2. Missing PARTIAL_TIMEOUT_POLICY Values**

The constant `PARTIAL_TIMEOUT_POLICY` is typed as a union but only uses one value:
```typescript
export const PARTIAL_TIMEOUT_POLICY: "fail_timed_out_only" | "fail_all" | "warn_and_continue" =
  "fail_timed_out_only";
```

The alternative policies are never implemented in bodyguard.ts.

**3. CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS Case Mismatch**

In constants.ts:
```typescript
HEURISTIC_FAIL_OPTIONS: ['retry', 'skip', 'stop'] as const,
```

In spec (section 4):
```typescript
HEURISTIC_FAIL_OPTIONS: ["Retry", "Skip this check", "Stop build"],
```

The TypeScript uses lowercase abbreviations while the spec uses user-facing labels.

**4. SpineState.projectState Inconsistency**

The `SpineState` type defines `projectState: "OPEN" | "PAUSED" | "CLOSED"` but `buildSpine()` always returns `"OPEN"`. There's no logic to detect paused/closed state.

## Known Flaw Verification

| Flaw | Confirmed | Details |
|------|-----------|---------|
| Enforcer check scripts don't exist | **PARTIALLY CONFIRMED** | Scripts exist in `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/` but bodyguard generates incorrect paths. The scripts exist (11 Python + 1 Bash), but the naming convention mismatches. |
| spine.ts has real filesystem dependency | **CONFIRMED** | Lines 67-72 use `execFile("find", ...)` and lines 94-106 use `execFile("git", ...)`. These are real filesystem operations, not mocked. This is intentional for production but requires test mocking. |
| Definitive failures: retry/stop only (no skip) | **CONFIRMED** | `CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS: ['retry', 'stop']` correctly excludes 'skip'. The spec explicitly states "NO SKIP" for definitive checks. This is correct behavior. |

## Positive Findings

1. **Parallel Check Execution (bodyguard.ts lines 188-210):** Uses `Promise.allSettled()` correctly to run checks in parallel within batches. Batches respect `MAX_PARALLEL_CHECKS = 5`.

2. **Verdict Aggregation (bodyguard.ts lines 271-313):** Correctly distinguishes HARD_FAIL (definitive confidence) from SOFT_FAIL (heuristic confidence). Logic matches spec: hard fails block, soft fails warn.

3. **Retry Logic (enforcer.ts lines 262-291):** `runCheckWithRetry()` correctly implements per-check retry policies with configurable attempts and delays. Early exit on success.

4. **Timeout Handling (enforcer.ts lines 164-168, 203-206):** Both inline commands and Python scripts have proper timeout handling with SIGTERM.

5. **State Snapshot Design (spine.ts):** Clean separation of concerns. Uses `execFile` (not `exec`) to avoid shell injection. Excludes heavy operations (npm test, npm build, docker) per spec comment.

6. **Type Safety:** All interfaces are well-typed with proper discriminated unions (e.g., `UserAction = "Retry" | "Skip" | "Stop build"`).

7. **Error Collection (spine.ts lines 58-62):** Spine captures errors encountered during snapshot building with command, error message, and timestamp.

8. **SpineDiff Implementation (spine.ts lines 167-226):** Correctly computes file additions, removals, modifications, and detects test/build state changes via file patterns.

9. **Compliance Check (bodyguard.ts lines 323-325):** `checkCompliance()` prevents the "all checks timed out so gate passes" bug by requiring `MIN_CHECKS_REQUIRED`.

## Recommendations

1. **Fix Script Path Generation:** Update `createCheckFromName()` in bodyguard.ts to map check names to actual script paths:
```typescript
const CHECK_SCRIPT_MAP: Record<string, string> = {
  "test-exit-code": "check_tests.py",
  "file-existence": "check_files_exist.py",
  "file-non-empty": "check_files_nonempty.py",
  "build-artifact": "check_build_artifact.py",
  "scope-enforcement": "check_scope.py",
  "token-threshold": "check_tokens.py",
  "secret-detection": "check_secrets.sh",
  "uninstall-verify": "check_uninstall.py",
  "docker-health": "check_docker_health.py",
  "lesson-template": "check_lesson.py",
  "responsive-screenshots": "check_responsive.py",
  "deploy-health": "check_deploy_health.py",
};
```

2. **Configure Script Base Path:** Add a constant for the scripts directory and use absolute paths:
```typescript
export const CHECKS_DIR = path.join(__dirname, '../../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks');
```

3. **Add Missing Spec Constants:** Create additional constant sections for CRON_INTERVALS, TIMEOUTS, FILE_THRESHOLDS, PROJECT_STATE, SUB_AGENT_RULES, and LATENCY_BUDGET.

4. **Increase CHECK_TIMEOUT_MS:** Change from 10_000 to 60_000 per spec to allow test suites sufficient time.

5. **Add Integration Tests:** Write tests that verify actual script invocation with known project fixtures.

## Checklist

- [x] Enforcement flow verified (pre-gate execute via `gateCheck()` with step context)
- [x] Circuit breaker logic correct (definitive = no skip, heuristic = skip available)
- [x] Verdict aggregation works (PASS/SOFT_FAIL/HARD_FAIL based on confidence)
- [x] State snapshots reliable (git + find with proper error handling)
- [ ] Constants match spec (PARTIAL - missing CRON_INTERVALS, TIMEOUTS, etc.)
- [ ] Script paths align with actual files (FAIL - naming mismatch)
