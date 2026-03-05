# LEVEL 3 E2E TESTING & PRODUCTION READINESS — COMPLETE SPECIFICATION

**Status:** Complete task breakdown specification written and committed
**Date:** 2026-03-04
**Location:** `/docs/ONGOING_WORK/ADAPTORS/`

---

## What This Is

Complete specification for Level 3 of the Universal CLI Adapter development. Level 3 covers end-to-end testing with real Electron app, real ChatGPT, and real CLI tools, plus comprehensive production readiness verification.

**Output:** 4 documented tasks, 10 E2E tests, 335+ total tests, 16 production criteria

---

## Documents in This Phase

### 1. LEVEL-3-E2E-TESTING.md (8.3K)

**Complete task specification for 4 discrete tasks:**

#### Task 1: E2E Test Framework & DOM Injection Tests
- **Files to create:** 3 files (test suite, fixtures, mocks)
- **Files to modify:** 2 files (main.ts, tsconfig.json)
- **Duration:** 2-3 days implementation
- **Tests:** 10 E2E tests using Playwright + Electron
- **Coverage:**
  - DOM injection message flow (3 tests)
  - Rate limit detection (2 tests)
  - Full dispatch through universal adapter (3 tests)
  - Error capture and recovery (2 tests)

#### Task 2: Production Readiness Verification Script
- **Files to create:** 1 script (verify-production-readiness.sh)
- **Duration:** 1 day
- **Checks:** 13 production criteria
- **Exit:** 0 (ready) or 1 (not ready)
- **Criteria:**
  1. Unit tests pass (50+)
  2. Integration tests pass (25+)
  3. Build succeeds
  4. No hardcoded paths
  5. No hardcoded secrets
  6. CLI commands properly escaped
  7. Token estimation accurate
  8. Timeout enforcement working
  9. Fallback logic tested
  10. Error classification working
  11. Git diff detection implemented
  12. Session persistence tested
  13. Documentation complete

#### Task 3: Compatibility Matrix Validation
- **Files to create:** 1 TypeScript validation script
- **Duration:** 1 day
- **Validates:** 4 runtimes (Codex, Claude, Gemini, ChatGPT Web)
- **Checks:** 5 compatibility checks
- **Output:** 5/5 compatibility passed = production-ready

#### Task 4: Production Readiness Checklist Document
- **Files to create:** 1 comprehensive checklist document
- **Duration:** 0.5 days
- **Criteria:** 16 production readiness criteria
- **Sign-off:** Final deployment gate

### 2. LEVEL-3-TASK-SUMMARY.md (12K)

**Quick reference guide for Level 3:**

- Overview of 4 tasks
- Test breakdown table
- Implementation sequence (recommended order)
- Test coverage summary (335+ tests total)
- Security & quality checks
- Deployment checklist
- Key files reference
- Success criteria

**Use this to:**
- Understand Level 3 in 5 minutes
- See implementation timeline (4-5 days)
- Reference deployment gate
- Verify all criteria before production

---

## Test Specification Summary

### E2E Tests (10 tests, 30-120s each)

| Test | Category | File | Prerequisites |
|------|----------|------|----------------|
| E2E 1-3 | DOM Injection | electron-dispatch.test.ts | ChatGPT logged in |
| E2E 4-5 | Rate Limit | electron-dispatch.test.ts | ChatGPT logged in |
| E2E 6-8 | Full Dispatch | electron-dispatch.test.ts | All CLIs installed |
| E2E 9-10 | Error Recovery | electron-dispatch.test.ts | All CLIs installed |

### Integration Tests (25+ tests, 10-60s each)

Covered by existing test infrastructure:
- Codex CLI integration
- Claude Code integration
- Gemini CLI integration
- Adapter output parsing

### Unit Tests (295+ tests, <1s each)

Covered by existing test infrastructure:
- Fast-path pattern matching
- Conductor routing logic
- DAG execution
- Error classification

### Compatibility Tests (5 checks, <10s each)

- Codex: --json output format verification
- Claude Code: Agent file + settings.json verification
- Gemini: CLI flags (--allow-X) verification
- ChatGPT Web: DOM injection + MutationObserver verification

**Total: 335+ tests**

---

## Implementation Path

### Week 1 (4-5 days)

**Day 1-2: Task 1 Implementation**
- Create test fixtures (app launch, DOM injection, response capture)
- Create test mocks (mock ChatGPT DOM, mock CLI responses)
- Write 10 E2E tests with Playwright syntax
- Modify Electron app for test mode support
- Run tests locally (requires ChatGPT logged in)

**Day 2-3: Task 3 Implementation**
- Create CLI version checks
- Verify --json flag support (Codex)
- Verify agent file support (Claude Code)
- Verify --allow-X flags (Gemini)
- Run validation script (5 checks)

**Day 3-4: Task 2 Implementation**
- Write 13-check verification shell script
- Test each check with real conditions
- Ensure proper exit codes

**Day 4-5: Task 4 Implementation**
- Document all 16 production criteria
- Add verification methods for each
- Create final sign-off table
- Add deployment gate command

### Production Readiness Gate

```bash
# Must pass before deployment
./scripts/verify-production-readiness.sh && \
npm run test:e2e tests/e2e/electron-dispatch.test.ts && \
npx ts-node tests/compatibility-matrix-validation.ts && \
echo "✓ READY FOR PRODUCTION DEPLOYMENT"
```

---

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Unit Tests | 295+ | ✓ Existing |
| Integration Tests | 25+ | ✓ Existing |
| E2E Tests | 10 | ⏳ New |
| Compatibility Checks | 5 | ⏳ New |
| Production Criteria | 16 | ⏳ New |
| **Total Tests** | **335+** | - |
| Documentation Files | 2 | ✓ Complete |
| Test Files to Create | 3 | ⏳ New |
| Scripts to Create | 1 | ⏳ New |
| Implementation Time | 4-5 days | - |

---

## Security Verification Checklist

✓ **No command injection vulnerabilities**
- All CLI invocations use execFile pattern
- Arguments passed as arrays, not strings
- No eval/exec usage with user input

✓ **No hardcoded secrets**
- No API keys in source code
- No credentials in default config
- All secrets from environment variables

✓ **No hardcoded paths**
- No /Users/... paths anywhere
- Uses app.getPath(), os.tmpdir(), config
- Cross-platform compatible (macOS/Windows/Linux)

✓ **Proper error handling**
- All promises have .catch() handlers
- All errors classified and logged
- No silent failures

✓ **Memory management**
- All event listeners cleaned up
- No orphaned CLI processes
- Temp files deleted after use

---

## Files Written

**Committed to repo:**
1. `/docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md` (8.3K)
   - Complete task breakdown for 4 tasks
   - 10 E2E tests with Playwright syntax
   - Verification script specification
   - Compatibility validation spec
   - Production readiness checklist spec

2. `/docs/ONGOING_WORK/ADAPTORS/LEVEL-3-TASK-SUMMARY.md` (12K)
   - Quick reference guide
   - Implementation sequence
   - Test coverage summary
   - Deployment checklist
   - Success criteria

**To create during implementation:**
1. `tests/e2e/electron-dispatch.test.ts` — 10 E2E tests
2. `tests/e2e/fixtures.ts` — Shared test fixtures
3. `tests/e2e/mocks.ts` — Mock ChatGPT DOM and CLI responses
4. `scripts/verify-production-readiness.sh` — Verification script
5. `tests/compatibility-matrix-validation.ts` — Compatibility checks
6. `docs/ONGOING_WORK/ADAPTORS/PRODUCTION-READINESS.md` — Checklist doc

---

## How to Use This Specification

### For Planning
- Read: LEVEL-3-TASK-SUMMARY.md (5 minutes)
- Understand: 4 tasks, 4-5 day timeline
- Decide: Implementation order

### For Implementation
- Read: LEVEL-3-E2E-TESTING.md (full spec)
- Follow: Step-by-step task breakdown
- Verify: Each step against requirements

### For Verification
- Run: `./scripts/verify-production-readiness.sh`
- Expect: "Passed: 13, Failed: 0"
- Run: E2E tests and compatibility checks
- Gate: Must pass all before deployment

### For Deployment
- Execute: Production readiness gate
- All three checks pass = safe to deploy
- Any failure = fix and retry

---

## Related Documents

**Instance 2 (Runtime Adapters):**
- `/docs/ONGOING_WORK/ADAPTORS/INSTANCE-2-ADAPTERS.md` (37K)
  - Complete adapter specification
  - Codex, Claude, Gemini implementations
  - Output parsing logic
  - Session management

**Instance 3 (Enforcement Engine):**
- `/docs/PLUGINS/files/HARD-RAILS.md`
- `/docs/PLUGINS/files/DOMAIN-A-ORCHESTRATION.md`
  - Hardcoded enforcement engine specification
  - Bodyguard integration points
  - Scope validation logic

**Architecture:**
- `/docs/ONGOING_WORK/ADAPTORS/FRAMEWORK.md`
- `/docs/ONGOING_WORK/ADAPTORS/ORCHESTRATION-MODEL.md`
  - System architecture
  - Component interactions
  - Data flow diagrams

---

## Contact & Handoff

**This specification is ready for:**
- Implementation by next agent
- Review by project lead
- Testing with real ChatGPT session
- Production deployment

**Prerequisites for implementation:**
- Electron app building successfully
- ChatGPT accessible and can be logged into
- Codex, Claude Code, Gemini CLIs installed locally
- All existing tests passing (295+ unit, 25+ integration)

**Success criteria:**
- All 10 E2E tests passing
- All 13 production checks passing
- 5/5 compatibility checks passing
- 16/16 production criteria verified
- 335+ total tests green

---

## Quick Navigation

| Need | Document | Section |
|------|----------|---------|
| Overview | LEVEL-3-TASK-SUMMARY.md | Overview |
| Task details | LEVEL-3-E2E-TESTING.md | Task 1-4 |
| Implementation sequence | LEVEL-3-TASK-SUMMARY.md | Implementation Sequence |
| Test specs | LEVEL-3-E2E-TESTING.md | Task 1 |
| Verification | LEVEL-3-TASK-SUMMARY.md | Deployment Checklist |
| 16 Criteria | LEVEL-3-E2E-TESTING.md | Task 4 |
| Compatibility matrix | LEVEL-3-E2E-TESTING.md | Task 3 |

---

**Status:** ✓ Complete specification written, committed, ready for implementation
