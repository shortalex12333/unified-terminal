# LEVEL 3: E2E TESTING & PRODUCTION READINESS

## Overview

Level 3 covers the final validation layer: end-to-end tests with real Electron app, real ChatGPT session, and real CLI tools. These tests verify the complete pipeline from user message → DOM injection → CLI dispatch → result capture. After Level 3, the Universal Adapter is production-ready.

**Test Categories:**
- DOM Injection Message Flow (3 tests)
- Rate Limit Detection (2 tests)
- Full Dispatch Through Universal Adapter (3 tests)
- Error Capture and Recovery (2 tests)

**Total E2E Tests:** 10
**Test Duration:** 30-120 seconds each (requires real ChatGPT, app launch)
**Prerequisites:** Electron app running, ChatGPT logged in, Codex/Claude/Gemini CLIs installed

---

## Task 1: Write E2E Test Framework & DOM Injection Tests

**Files to Create:**
- `tests/e2e/electron-dispatch.test.ts` (main E2E test file)
- `tests/e2e/fixtures.ts` (shared test fixtures)
- `tests/e2e/mocks.ts` (ChatGPT DOM mocks)

**Files to Modify:**
- `src/main/index.ts` (add `--test-mode` flag)
- `tsconfig.json` (allow ts-node, test files)

**Purpose:** Establish Playwright + Electron test harness. Verify message injection to ChatGPT input field works. Verify submit button click and response capture via DOM MutationObserver.

### Step 1: Understand Current Architecture

Read `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/main/chatgpt-adapter.ts` to understand:
- How messages are injected into ChatGPT DOM
- MutationObserver setup for response capture
- DOM selector strategy (input field, submit button, response container)

### Step 2: Create Test Fixtures File

Create `tests/e2e/fixtures.ts` with Playwright/Electron lifecycle management, ChatGPT mock setup, and DOM interaction helpers.

### Step 3: Create Test Mocks File

Create `tests/e2e/mocks.ts` with mock ChatGPT DOM structure, mock CLI responses for Codex/Claude/Gemini, and error response generators.

### Step 4: Write E2E Test Suite

Create `tests/e2e/electron-dispatch.test.ts` with 10 complete E2E tests covering:
- DOM message injection verification
- Submit button click handling
- Response capture via MutationObserver
- Rate limit detection in DOM
- Rate limit retry logic
- Full Codex dispatch flow
- Full Claude Code dispatch flow
- Fallback runtime chain
- CLI timeout detection and handling
- Malformed output error classification

### Step 5: Modify src/main/index.ts to Support Test Mode

Add `--test-mode` flag handling to support test-specific behavior.

### Step 6: Update tsconfig.json

Ensure TypeScript compilation includes test files.

### Step 7: Run Tests

```bash
npm run build:main
npm run test:e2e tests/e2e/electron-dispatch.test.ts
```

### Step 8: Commit

```bash
git add tests/e2e/ src/main/index.ts tsconfig.json
git commit -m "test(e2e): Add Level 3 DOM injection and dispatch tests (10 tests)

- E2E 1-3: DOM injection message flow
- E2E 4-5: Rate limit detection
- E2E 6-8: Full dispatch through universal adapter
- E2E 9-10: Error capture and recovery

All tests verify complete Electron pipeline with real ChatGPT session.
Requires Codex/Claude/Gemini CLIs installed and authenticated.

Test duration: 30-120s per test (manual trigger, not CI)
Playwright + electron.launch() framework
DOM MutationObserver for response capture"
```

---

## Task 2: Production Readiness Verification Script

**Files to Create:**
- `scripts/verify-production-readiness.sh` (main verification script)

**Purpose:** Automated verification that all production readiness criteria are met before deployment.

### Create `scripts/verify-production-readiness.sh`

Verify:
1. Unit tests pass (50+ tests, < 1 second each)
2. Integration tests pass (25+ tests, 10-60 seconds)
3. Build succeeds without errors
4. No hardcoded user paths found
5. No hardcoded secrets in code
6. CLI commands properly escaped (using execFile, not exec)
7. Token estimation accurate within 10%
8. Timeout enforcement working (process killed within 1s)
9. Fallback runtime logic tested
10. Error classification working
11. Git diff detection implemented
12. Session persistence tested
13. Required documentation present

Exit code 0 if all pass, 1 if any fail.

### Run Verification

```bash
chmod +x scripts/verify-production-readiness.sh
./scripts/verify-production-readiness.sh
```

---

## Task 3: Compatibility Matrix Validation

**Files to Create:**
- `tests/compatibility-matrix-validation.ts` (verify Instance 2 discoveries)

**Purpose:** Confirm that the Universal Adapter's implementations match the actual CLI behavior discovered in Instance 2.

### Verify Each Runtime

**Codex CLI:**
- Check `codex --version` available
- Verify `--json` flag outputs newline-delimited JSON
- Confirm session resume with `codex resume <session_id>`

**Claude Code:**
- Check `claude-code --version` available
- Verify agent file support (YAML frontmatter)
- Confirm settings.json tool permissions

**Gemini CLI:**
- Check `gemini --version` available
- Verify `--allow-X` flags exist
- Confirm NO `--json` flag (CLI flags only)
- Confirm NO session resume (Worker-only)

**ChatGPT Web:**
- Verify DOM injection to BrowserView works
- Verify MutationObserver captures responses
- Confirm no CLI required

### Run Validation

```bash
npx ts-node tests/compatibility-matrix-validation.ts
```

Expected output:
```
Runtime      | Feature                    | Matches
-------------|---------------------------|--------
codex        | --json output              | ✓
claude       | agent file support         | ✓
gemini       | --allow-X flags            | ✓
gemini       | no --json output           | ✓
chatgpt-web  | DOM injection + Mutation   | ✓

COMPATIBILITY: 5/5 checks passed
✓ COMPATIBLE - Instance 2 discoveries match adapter implementations
```

---

## Task 4: Production Readiness Checklist Document

**Files to Create:**
- `docs/ONGOING_WORK/ADAPTORS/PRODUCTION-READINESS.md` (comprehensive checklist)

**Purpose:** Document all 16 production readiness criteria and their verification status.

### Criterion Checklist (16 total)

1. **Unit Tests** — All 50+ unit tests pass in < 1 second each
2. **Integration Tests** — All 25+ integration tests pass (10-60s each, requires CLI auth)
3. **E2E Tests** — All 10 E2E tests pass (requires logged-in ChatGPT)
4. **No Hardcoded Paths** — No `/Users/celeste/...` paths found
5. **CLI Command Escaping** — All commands use execFile (no shell injection)
6. **Token Estimation** — Accurate within 10% for all runtimes
7. **Timeout Enforcement** — Process killed within 1s of timeout
8. **Fallback Logic** — Chain works: Codex → Claude → Gemini
9. **Truncation Handling** — Oversized prompts fall back to next runtime
10. **Error Classification** — Network/auth/timeout/parse errors detected
11. **Git Diff Detection** — filesModified array populated correctly
12. **Bodyguard Ready** — Scope check ready for integration
13. **Session Persistence** — Codex resume across calls verified
14. **Documentation Complete** — All architecture, test, and spec docs present
15. **All Tests Green** — Unit + Integration + E2E: 335+ tests passing
16. **No Undefined Behavior** — TypeScript strict mode, no race conditions

### Document Structure

- Overview and status
- 16 criteria with verification methods
- Implementation details for each
- Test scenarios
- Final sign-off table
- Deployment gate checklist

---

## Summary of Task Breakdown

**Task 1: E2E Test Framework**
- 10 complete E2E tests
- DOM injection + rate limit + dispatch + error recovery
- Playwright + Electron + real ChatGPT
- 30-120s per test (manual trigger)

**Task 2: Production Readiness Verification**
- Automated shell script
- 13 production criteria checks
- Unit + integration + E2E validation
- Exit code: 0 (ready) or 1 (not ready)

**Task 3: Compatibility Matrix Validation**
- Verify Instance 2 discoveries
- Codex, Claude Code, Gemini, ChatGPT Web
- 5/5 compatibility checks
- TypeScript-based validation

**Task 4: Production Readiness Checklist**
- 16 criteria documented
- Verification method for each
- Implementation details
- Test scenarios
- Deployment sign-off

**Total Coverage:**
- 335+ tests (295 unit, 25 integration, 10 E2E, 5 compatibility)
- All production readiness criteria verified
- Zero hardcoded secrets/paths
- All documentation complete

**Timeline:** 2-3 days for implementation and manual testing
**Deliverable:** Production-ready Universal CLI Adapter with full E2E validation

---
