# Production Readiness Checklist -- Universal CLI Adapter v1.0

## Overview

This checklist documents the 16 production readiness criteria for the Universal CLI Adapter system. Each criterion has a verification method, expected result, and current status based on Phase 10 test results.

**When to use:** Before any production deployment, run the automated verification gate (see bottom of document). All 16 criteria must show PASS before deployment proceeds.

**Scope:** Covers adapter layer (Codex + Claude), enforcement pipeline (bodyguard, spine, enforcer), skills system, glue layer, and E2E dispatch. Gemini CLI is SHELVED and excluded from all criteria.

**Fallback chain:** Codex -> Claude (two runtimes only).

---

## 16 Production Readiness Criteria

### 1. Unit Tests

**Description:** All unit tests pass across the full test suite. Covers adapters, enforcement, skills, glue, conductor, fast-path, step-scheduler, CLI auth, and CLI runner.

**Verification method:** `npm run test:unit`

**Expected result:** 444+ tests pass with 0 failures.

**Current status:** PASS -- 444+ tests passing across 13 test files (verified 2026-03-04).

---

### 2. Integration Tests

**Description:** Full pipeline integration test proves Conductor classifies, Scheduler creates DAG, Executor spawns CLI, and Enforcement runs at each step.

**Verification method:** `npm run test:integration`

**Expected result:** 23+ tests pass with 0 failures.

**Current status:** PASS -- 23/23 tests passing in `tests/integration/conductor-scheduler-executor.test.ts` (verified 2026-03-04, commit de2d362).

---

### 3. E2E Tests

**Description:** End-to-end dispatch tests covering DOM injection, rate limit detection, adapter dispatch, and error recovery through the full Electron pipeline.

**Verification method:** `npm run test:e2e`

**Expected result:** 10 tests pass with 0 failures.

**Current status:** PASS -- 10/10 tests passing in `tests/e2e/electron-dispatch.test.ts` (verified 2026-03-04, commit c2c7bdc).

---

### 4. No Hardcoded Paths

**Description:** No `/Users/` references exist in production source code. Hardcoded paths break portability and expose usernames.

**Verification method:** `./scripts/verify-production-readiness.sh` (check 3)

**Expected result:** 0 hardcoded path references found in `src/`.

**Current status:** PASS -- No hardcoded paths found (verified 2026-03-04, commit d692fe0).

---

### 5. CLI Command Safety

**Description:** All CLI process spawning uses safe methods (`spawn`, `execFile`) rather than shell-based string execution. Prevents shell injection attacks.

**Verification method:** `./scripts/verify-production-readiness.sh` (check 5)

**Expected result:** 0 unsafe process spawning calls found in files importing `child_process`.

**Current status:** PASS -- All CLI commands use `spawn`/`execFile` (verified 2026-03-04).

---

### 6. Token Estimation

**Description:** Adapter token estimates are accurate within 10% of actual usage. Prevents budget overruns and truncation surprises.

**Verification method:** Unit tests in `tests/codex-adapter.test.ts` and `tests/claude-adapter.test.ts`.

**Expected result:** Token estimation assertions pass for all adapter types.

**Current status:** PASS -- Token estimation validated by unit tests (verified 2026-03-04).

---

### 7. Timeout Enforcement

**Description:** CLI processes are killed within 1 second of timeout expiry. Prevents zombie processes and resource leaks.

**Verification method:** Unit tests in `tests/cli-runner.test.ts` and E2E error recovery tests.

**Expected result:** Process termination within 1s of timeout, verified by test assertions.

**Current status:** PASS -- Timeout enforcement validated by CLI runner tests and E2E test 10 (verified 2026-03-04).

---

### 8. Fallback Logic

**Description:** Fallback chain works: Codex -> Claude. If Codex fails, Claude is tried. (Gemini is shelved and excluded from the chain.)

**Verification method:** E2E test 8 (`tests/e2e/electron-dispatch.test.ts` -- fallback chain test).

**Expected result:** When Codex adapter fails, Claude adapter is tried and produces output.

**Current status:** PASS -- Fallback chain validated by E2E dispatch tests (verified 2026-03-04, commit c2c7bdc).

---

### 9. Truncation Handling

**Description:** Oversized prompts that exceed adapter token limits are rejected rather than silently truncated.

**Verification method:** Unit tests in adapter test files (token budget assertions).

**Expected result:** Prompts exceeding limits produce error, not truncated output.

**Current status:** PASS -- Truncation handling validated by unit tests (verified 2026-03-04).

---

### 10. Error Classification

**Description:** Network, auth, timeout, and parse errors are correctly detected and classified for appropriate handling (retry, escalate, or fail).

**Verification method:** E2E tests 9-10 (`tests/e2e/electron-dispatch.test.ts` -- error recovery tests).

**Expected result:** Each error type is classified and handled differently.

**Current status:** PASS -- Error classification validated by E2E tests (verified 2026-03-04, commit c2c7bdc).

---

### 11. Git Diff Detection

**Description:** `filesModified` array is populated from CLI output, enabling the system to track which files were changed by a CLI operation.

**Verification method:** Unit tests in adapter test files.

**Expected result:** After CLI execution, `filesModified` contains paths extracted from CLI output.

**Current status:** PASS -- Git diff detection validated by unit tests (verified 2026-03-04).

---

### 12. Bodyguard Ready

**Description:** Scope check integration point exists in the enforcement pipeline. Bodyguard runs parallel gate checks and produces a verdict.

**Verification method:** Code review + `./scripts/verify-production-readiness.sh` (check 7).

**Expected result:** `src/enforcement/bodyguard.ts` exists and exports scope check functions.

**Current status:** PASS -- Bodyguard module exists with verdict aggregation (verified 2026-03-04).

---

### 13. Session Persistence

**Description:** Codex adapter supports session resume and Claude adapter supports session IDs. Enables multi-turn conversations without context loss.

**Verification method:** Compatibility matrix check 3 (`tests/compatibility-matrix-validation.ts`).

**Expected result:** `capabilities().sessionResume` returns true for both adapters.

**Current status:** PASS -- Session persistence validated by compatibility matrix (verified 2026-03-04, commit 335f51c).

---

### 14. Documentation Complete

**Description:** All architecture, test, and specification documents are present. Enables onboarding and maintenance.

**Verification method:** `./scripts/verify-production-readiness.sh` (check 10).

**Expected result:** All 3 required documentation files exist.

**Current status:** PASS -- All documentation files present (verified 2026-03-04).

---

### 15. All Tests Green

**Description:** Complete test suite passes: unit (444+) + integration (23) + E2E (10) + compatibility (4) = 480+ total tests with 0 failures.

**Verification method:** `npm run test:all`

**Expected result:** All test categories report 0 failures.

**Current status:** PASS -- 480+ total tests passing across all categories (verified 2026-03-04).

---

### 16. No Undefined Behavior

**Description:** TypeScript strict mode enabled, no race conditions, no untyped code paths. Prevents runtime surprises.

**Verification method:** `tsc --noEmit` + `./scripts/verify-production-readiness.sh` (check 13).

**Expected result:** 0 TypeScript errors, strict mode enabled in tsconfig.json.

**Current status:** PASS -- TypeScript strict mode enabled, 0 compile errors (verified 2026-03-04).

---

## Sign-Off Table

| # | Criterion | Status | Verified By | Date |
|---|-----------|--------|-------------|------|
| 1 | Unit Tests (444+) | PASS | npm run test:unit | 2026-03-04 |
| 2 | Integration Tests (23) | PASS | npm run test:integration | 2026-03-04 |
| 3 | E2E Tests (10) | PASS | npm run test:e2e | 2026-03-04 |
| 4 | No Hardcoded Paths | PASS | verify-production-readiness.sh | 2026-03-04 |
| 5 | CLI Command Safety | PASS | verify-production-readiness.sh | 2026-03-04 |
| 6 | Token Estimation | PASS | unit tests | 2026-03-04 |
| 7 | Timeout Enforcement | PASS | unit tests + E2E | 2026-03-04 |
| 8 | Fallback Logic (Codex -> Claude) | PASS | E2E test 8 | 2026-03-04 |
| 9 | Truncation Handling | PASS | unit tests | 2026-03-04 |
| 10 | Error Classification | PASS | E2E tests 9-10 | 2026-03-04 |
| 11 | Git Diff Detection | PASS | unit tests | 2026-03-04 |
| 12 | Bodyguard Ready | PASS | code review + script | 2026-03-04 |
| 13 | Session Persistence | PASS | compatibility check 3 | 2026-03-04 |
| 14 | Documentation Complete | PASS | verify-production-readiness.sh | 2026-03-04 |
| 15 | All Tests Green (480+) | PASS | npm run test:all | 2026-03-04 |
| 16 | No Undefined Behavior | PASS | tsc --noEmit | 2026-03-04 |

**Result: 16/16 PASS -- PRODUCTION READY**

---

## Deployment Gate

Run this one-liner before any production deployment:

```bash
# Automated deployment gate
./scripts/verify-production-readiness.sh && \
  npm run test:e2e && \
  npm run test:compat && \
  echo "READY FOR PRODUCTION DEPLOYMENT"
```

If any command exits non-zero, deployment is blocked. Fix the failing checks before retrying.

### Full verification (includes slow test suites):

```bash
# Complete verification including all test suites
npm run test:all && \
  ./scripts/verify-production-readiness.sh && \
  echo "FULL VERIFICATION COMPLETE -- READY FOR PRODUCTION DEPLOYMENT"
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-04 | Phase 10 Plan 03 | Initial checklist -- all 16 criteria verified |
