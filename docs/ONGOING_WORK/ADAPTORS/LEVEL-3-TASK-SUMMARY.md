# LEVEL 3: E2E TESTING & PRODUCTION READINESS — TASK SUMMARY

## Overview

This document summarizes the complete task breakdown for Level 3 E2E testing and production readiness verification. Level 3 is the final validation layer before production deployment of the Universal CLI Adapter.

**Document:** `/docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md`
**Status:** Complete task specification written, ready for implementation
**Scope:** 4 tasks, 10 E2E tests, 16 production criteria, 335+ total tests

---

## Four Tasks Defined

### Task 1: E2E Test Framework & DOM Injection Tests

**Objective:** Establish Playwright + Electron testing infrastructure. Verify DOM injection, submit handling, and response capture work end-to-end with real ChatGPT session.

**Tests (10 total):**

| Test | Category | Description |
|------|----------|-------------|
| E2E 1 | DOM Injection | Message injected to ChatGPT input field appears |
| E2E 2 | DOM Injection | Submit button click triggers message send |
| E2E 3 | DOM Injection | Response captured via DOM MutationObserver |
| E2E 4 | Rate Limit | "You've reached your message limit" detected in DOM |
| E2E 5 | Rate Limit | Rate limit triggers retry with exponential backoff |
| E2E 6 | Full Dispatch | Message → Codex CLI dispatch → result captured |
| E2E 7 | Full Dispatch | Message → Claude Code dispatcher → agent file → result |
| E2E 8 | Full Dispatch | Fallback chain works (Codex → Claude → Gemini) |
| E2E 9 | Error Recovery | CLI timeout detected, process killed, error logged |
| E2E 10 | Error Recovery | Malformed output parsed safely with error classification |

**Duration per test:** 30-120 seconds (real ChatGPT, real CLI tools)

**Files to Create:**
- `tests/e2e/electron-dispatch.test.ts` — 10 complete tests with Playwright syntax
- `tests/e2e/fixtures.ts` — Shared fixtures: app launch, DOM injection, response capture
- `tests/e2e/mocks.ts` — Mock ChatGPT DOM, mock CLI responses, error generators

**Files to Modify:**
- `src/main/index.ts` — Add `--test-mode` flag support
- `tsconfig.json` — Enable ts-node for tests

**Prerequisites:**
- Electron app running
- ChatGPT session logged in (manual login before running)
- Codex CLI installed and authenticated
- Claude Code installed and authenticated
- Gemini CLI installed and authenticated

**Execution:**
```bash
npm run build:main
npm run test:e2e tests/e2e/electron-dispatch.test.ts
# Expected: 10 passed in 45s
```

---

### Task 2: Production Readiness Verification Script

**Objective:** Automated script that verifies 13 production readiness criteria in < 2 minutes. Reports pass/fail with evidence. Used before every deployment.

**Criteria Checked:**

| # | Criterion | Check | Exit 0 |
|---|-----------|-------|--------|
| 1 | Unit Tests | Run npm test:unit | 50+ pass |
| 2 | Integration Tests | Run npm test:integration | 25+ pass |
| 3 | Build | Run npm build | Succeeds |
| 4 | No Hardcoded Paths | grep /Users/ src/ dist/ | 0 found |
| 5 | No Secrets | grep API_KEY/SECRET/PASSWORD src/ | 0 found |
| 6 | CLI Escaping | verify execFile usage | Proper escaping |
| 7 | Token Estimation | Run token-related tests | Pass |
| 8 | Timeout Enforcement | Run timeout tests | Kill within 1s |
| 9 | Fallback Logic | Run fallback tests | Chain works |
| 10 | Error Classification | Run error tests | All types detected |
| 11 | Git Diff Detection | Run git-related tests | filesModified populated |
| 12 | Session Persistence | Run session tests | Codex resume works |
| 13 | Documentation | Check files exist | All present |

**Files to Create:**
- `scripts/verify-production-readiness.sh` — Bash script running all checks

**Execution:**
```bash
chmod +x scripts/verify-production-readiness.sh
./scripts/verify-production-readiness.sh
# Expected: Passed: 13, Failed: 0, ✓ PRODUCTION READY
```

**Integration:**
```bash
# Use as pre-deployment gate
if ./scripts/verify-production-readiness.sh; then
  npm run dist:mac:arm64  # Safe to build
else
  echo "Fix failing checks before deploying"
  exit 1
fi
```

---

### Task 3: Compatibility Matrix Validation

**Objective:** Verify that the Universal Adapter's runtime implementations match the actual CLI behavior discovered in Instance 2.

**Runtimes Validated:**

| Runtime | Expected Behavior | Verification |
|---------|------------------|--------------|
| Codex CLI | --json outputs newline-delimited JSON with files_modified array | Check version, verify flag, test output parsing |
| Claude Code | Agent file with YAML frontmatter, settings.json tool permissions | Check version, verify agent file support |
| Gemini CLI | CLI flags (--allow-X), no --json, no session resume | Check version, verify flags, confirm no resume |
| ChatGPT Web | DOM injection to BrowserView, MutationObserver capture, no CLI | Verify injection works, MutationObserver fires |

**Files to Create:**
- `tests/compatibility-matrix-validation.ts` — TypeScript validation script

**Execution:**
```bash
npx ts-node tests/compatibility-matrix-validation.ts
# Expected:
# Runtime      | Feature                    | Matches
# -------------|---------------------------|--------
# codex        | --json output              | ✓
# claude       | agent file support         | ✓
# gemini       | --allow-X flags            | ✓
# chatgpt-web  | DOM injection              | ✓
# COMPATIBILITY: 5/5 checks passed
```

**Output:**
- Summary table showing runtime → feature → compatibility
- 5/5 checks passing = production-ready
- Any mismatches = requires adapter fix before deployment

---

### Task 4: Production Readiness Checklist Document

**Objective:** Comprehensive 16-point checklist documenting all production readiness criteria with verification methods, implementation details, and test scenarios.

**16 Criteria:**

1. **Unit Tests** — 50+ tests, less than 1s each
2. **Integration Tests** — 25+ tests, 10-60s each
3. **E2E Tests** — 10 tests, requires ChatGPT
4. **No Hardcoded Paths** — grep check for user paths
5. **CLI Command Escaping** — All commands use execFile
6. **Token Estimation** — Within 10% accuracy
7. **Timeout Enforcement** — Process killed within 1s
8. **Fallback Logic** — Codex to Claude to Gemini works
9. **Truncation Handling** — Oversized prompts fall back
10. **Error Classification** — Network/auth/timeout/parse
11. **Git Diff Detection** — filesModified array populated
12. **Bodyguard Ready** — Scope check compatible
13. **Session Persistence** — Codex resume verified
14. **Documentation Complete** — All specs present
15. **All Tests Green** — 335+ total tests passing
16. **No Undefined Behavior** — TypeScript strict mode

**Files to Create:**
- `docs/ONGOING_WORK/ADAPTORS/PRODUCTION-READINESS.md` — Checklist document

**Document Sections:**
- Overview and status
- 16 criteria with verification methods
- Implementation details for each
- Test scenarios
- Final sign-off table
- Deployment gate checklist

**Sign-off Table:**
```markdown
| Criterion | Status | Verified By | Date |
|-----------|--------|------------|------|
| 1. Unit Tests | ✓ | automated | 2026-03-04 |
| 2. Integration Tests | ✓ | automated | 2026-03-04 |
| ...
| 16. No Undefined Behavior | ✓ | static analysis | 2026-03-04 |
```

**Deployment Gate:**
```bash
./scripts/verify-production-readiness.sh && \
npm run test:e2e tests/e2e/electron-dispatch.test.ts && \
npx ts-node tests/compatibility-matrix-validation.ts && \
echo "✓ READY FOR PRODUCTION DEPLOYMENT"
```

---

## Implementation Sequence

**Recommended order for implementation:**

1. **Task 1 (E2E Tests)** — 2-3 days
   - Write test fixtures and mocks
   - Write 10 E2E tests
   - Modify Electron app for test mode
   - Run and debug tests locally
   - Ensure ChatGPT logged in before running

2. **Task 3 (Compatibility Validation)** — 1 day
   - Write CLI version checks
   - Verify flags and output formats
   - Ensure all runtimes installed locally
   - Run validation script

3. **Task 2 (Verification Script)** — 1 day
   - Write shell script with 13 checks
   - Test each check locally
   - Ensure all tests runnable

4. **Task 4 (Checklist Document)** — 0.5 days
   - Document all 16 criteria
   - Add verification methods
   - Create sign-off table
   - Add deployment gate

**Total implementation time:** 4-5 days
**Total test coverage:** 335+ tests
**Exit criteria:** All tests green, all criteria verified

---

## Test Coverage Summary

| Test Type | Count | Duration | Automation | Runner |
|-----------|-------|----------|-----------|--------|
| Unit tests | 295+ | < 1s each | Automated | npm run test:unit |
| Integration | 25+ | 10-60s each | Automated | npm run test:integration |
| E2E tests | 10 | 30-120s each | Manual | npm run test:e2e |
| Compatibility | 5 | < 10s | Automated | npx ts-node |
| **Total** | **335+** | **varies** | **mostly auto** | **scripts/** |

**Key metrics:**
- 295+ unit tests (fast feedback)
- 25+ integration tests (real CLI tools)
- 10 E2E tests (real ChatGPT, real dispatch)
- 5 compatibility checks (runtime verification)
- 16 production criteria validated

---

## Security & Quality Checks

### Security Verification

✓ **No command injection vulnerabilities**
- All CLI commands verified to use execFile pattern, not eval/exec
- Arguments passed as arrays to prevent string interpolation
- User input sanitization verified

✓ **No hardcoded secrets**
- No API keys hardcoded in source
- No credentials in default config
- All secrets from environment variables or secure storage

✓ **No hardcoded paths**
- Verified with grep checks for user-specific paths
- Uses app.getPath(), os.tmpdir(), config-driven paths
- Works on any macOS/Windows/Linux installation

### Quality Checks

✓ **TypeScript strict mode enabled**
- All types explicit
- No implicit any
- No unused variables

✓ **Proper error handling**
- All promises have error handlers
- All errors classified and logged
- No silent failures

✓ **Memory management**
- All event listeners cleaned up properly
- No orphaned CLI processes
- Temp files cleaned up after use

---

## Deployment Checklist

**Before deploying to production:**

- [ ] Task 1: E2E tests all passing (10/10)
- [ ] Task 2: Verification script passes all checks (13/13)
- [ ] Task 3: Compatibility validation passes (5/5)
- [ ] Task 4: Checklist document complete and signed off (16/16)
- [ ] No test failures in any category
- [ ] ChatGPT session logged in (E2E tests verified)
- [ ] All CLIs installed and authenticated locally
- [ ] Security review passed
- [ ] Documentation reviewed by team
- [ ] Sign-off from project lead

**One-liner deployment gate:**
```bash
./scripts/verify-production-readiness.sh && echo "✓ READY FOR PRODUCTION"
```

---

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `/docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md` | Full task breakdown | ✓ Written |
| `/tests/e2e/electron-dispatch.test.ts` | 10 E2E tests | ⏳ To implement |
| `/tests/e2e/fixtures.ts` | Test fixtures | ⏳ To implement |
| `/tests/e2e/mocks.ts` | Test mocks | ⏳ To implement |
| `/scripts/verify-production-readiness.sh` | Verification script | ⏳ To implement |
| `/tests/compatibility-matrix-validation.ts` | Compatibility checks | ⏳ To implement |
| `/docs/ONGOING_WORK/ADAPTORS/PRODUCTION-READINESS.md` | Checklist | ⏳ To implement |

---

## Success Criteria

Level 3 is **complete** when:

1. All 10 E2E tests pass with real ChatGPT
2. Verification script reports "PRODUCTION READY"
3. Compatibility validation passes 5/5
4. Checklist document complete with all 16 criteria verified
5. 335+ total tests passing
6. Zero security issues verified
7. Zero undefined behavior in TypeScript strict mode
8. Documentation complete and F1-quality

**Result:** Universal CLI Adapter production-ready for deployment

---
