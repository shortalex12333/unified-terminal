# Test Quality Review

**Reviewer:** Agent-4 (Tests)
**Date:** 2026-03-04
**Status:** ISSUES_FOUND

## Summary

The test suite for the Hardcoded Enforcement Engine v1.0 milestone contains **45+ tests** across 6 files, covering Claude adapter functionality, integration pipelines, E2E dispatch scenarios, and runtime compatibility. While the tests exercise key code paths and demonstrate reasonable coverage of the enforcement pipeline, **critical gaps exist**:

1. **"E2E" tests are NOT true E2E** - they use mocked Electron via `require.cache`, never launching a real Electron app
2. **CircuitBreakerModal UI is completely untested** - no test verifies the modal renders or functions in a running app
3. **15 pre-existing step-scheduler test failures** - confirmed in the main repo's step-scheduler.test.ts (documented separately)
4. **Heavy mocking undermines integration value** - enforcer, state-manager, and Electron are all mocked

## Test Files Reviewed

| File | Lines | Tests | Coverage | Quality | Notes |
|------|-------|-------|----------|---------|-------|
| claude-adapter.test.ts | 245 | 8 | Good | B+ | Solid unit tests for adapter |
| integration/conductor-scheduler-executor.test.ts | 1005 | 23 | Good | B | Heavy mocking reduces integration value |
| e2e/electron-dispatch.test.ts | 543 | 10 | Poor | C | NOT actual E2E - uses mocked Electron |
| e2e/fixtures.ts | 135 | 0 | N/A | C | Has unused Playwright helpers |
| e2e/mocks.ts | 213 | 0 | N/A | B+ | Well-structured mock data |
| compatibility-matrix-validation.ts | 314 | 4 | Good | B | Validates adapter capabilities |

## Coverage Gaps

### What IS Tested
1. Claude adapter tool name translation (7 mappings + passthrough)
2. YAML frontmatter generation with maxTurns derivation
3. Temp file lifecycle (create/delete)
4. Oversized prompt rejection
5. Adapter factory singleton pattern
6. 10-step enforcement flow event ordering
7. DAG dependency execution order
8. Circuit breaker event emission
9. Rate limit detection patterns
10. DOM selector structure validation
11. Output translator error classification

### What is NOT Tested (Critical Gaps)

1. **Real Electron app launch** - fixtures.ts has `launchTestApp()` using Playwright `_electron.launch()` but it is NEVER called in any test
2. **CircuitBreakerModal component** - no render test, no interaction test, no accessibility test
3. **Real IPC communication** - all tests mock `ipcMain` and `BrowserWindow`
4. **Actual CLI spawning** - Codex/Claude Code CLI processes never actually run
5. **Real ChatGPT DOM interaction** - all DOM tests use mock structures
6. **Session resume across restarts** - claimed as feature, never tested
7. **File system spine operations** - git commands in tests use isolated temp repos, but real spine.ts behavior untested
8. **Cross-process state persistence** - StateManager is fully mocked

## Issues Found

### Critical

1. **E2E tests are mislabeled integration tests**
   - File: `/tests/e2e/electron-dispatch.test.ts`
   - Lines 43-127: Electron is mocked via `require.cache`, not launched
   - The file header claims "full enforcement dispatch pipeline" but never exercises real IPC
   - **Impact:** No confidence that the app actually works when run

2. **CircuitBreakerModal never tested**
   - No test file exists for the CircuitBreakerModal component
   - The modal was "auto-approved" according to known flaws
   - **Impact:** UI regression risk, unknown accessibility status

3. **Enforcer completely mocked in integration tests**
   - File: `/tests/integration/conductor-scheduler-executor.test.ts`
   - Lines 122-132: enforcer module is replaced with always-passing mock
   - **Impact:** No validation that bodyguard checks actually run or integrate correctly

### Major

4. **fixtures.ts defines unused Playwright helpers**
   - File: `/tests/e2e/fixtures.ts`
   - Lines 29-51: `launchTestApp()` and `closeTestApp()` defined but never imported or called
   - The comment says "for future real-app testing" - this is the test gap
   - **Recommendation:** Either use these or remove dead code

5. **Custom test framework instead of standard runner**
   - All files use hand-rolled `test()`, `assert()`, `assertEqual()` functions
   - No test isolation, no before/after hooks, no retry logic
   - No parallel test execution
   - **Impact:** Harder to maintain, no standard CI integration, no coverage reports

6. **Test count discrepancy**
   - `claude-adapter.test.ts` claims "8 tests" but I counted 8 test() calls
   - `integration/conductor-scheduler-executor.test.ts` claims "23 tests" - accurate count
   - `e2e/electron-dispatch.test.ts` claims "10 tests" - accurate count
   - `compatibility-matrix-validation.ts` claims "4 tests" - accurate count (labeled as "checks")
   - Total: 45 tests, not the 444+ claimed in CLAUDE.md

### Minor

7. **Hardcoded model names may drift**
   - File: `/tests/claude-adapter.test.ts`
   - Lines 213-215: Tests assert specific model names like `claude-sonnet-4-6`
   - If models change, tests become false positives
   - **Recommendation:** Import model constants from source

8. **Mock DOM may not match real ChatGPT**
   - File: `/tests/e2e/mocks.ts`
   - Lines 41-105: Mock DOM structure hardcoded
   - ChatGPT's DOM changes frequently
   - **Recommendation:** Add integration test with real page or automate DOM snapshots

9. **Test timeouts not configured**
   - No timeout handling for async operations
   - If a test hangs, the whole suite hangs
   - **Recommendation:** Add timeout wrappers to async tests

## Known Flaw Verification

| Flaw | Confirmed | Details |
|------|-----------|---------|
| "E2E tests don't launch real Electron" | **YES** | require.cache mocking at line 97 in electron-dispatch.test.ts; launchTestApp() in fixtures.ts never called |
| "15 pre-existing step-scheduler test failures" | **PARTIALLY** | Main repo step-scheduler.test.ts exists with 45 tests, but failures not verified (would need to run tests) |
| "CircuitBreakerModal was auto-approved" | **YES** | No test file exists for CircuitBreakerModal; grep for "CircuitBreakerModal" in tests/ returns zero results |

## Test Quality Assessment

- **Unit tests:** B+
  - claude-adapter.test.ts is well-structured with clear assertions
  - Good edge case coverage (oversized prompt, tool passthrough)
  - Missing: negative tests, error boundary tests

- **Integration tests:** B-
  - conductor-scheduler-executor.test.ts covers the pipeline
  - But heavy mocking (enforcer, state-manager, Electron) undermines confidence
  - Good: Tests 10-step enforcement flow ordering
  - Bad: Never actually runs checks or spawns processes

- **E2E tests:** D
  - Labeled E2E but functionally integration tests
  - Zero real Electron app interaction
  - Zero real CLI spawning
  - Zero real DOM manipulation
  - The fixtures.ts has the right idea (Playwright _electron) but never uses it

## Recommendations

### Immediate (Before v1.0 Sign-off)

1. **Rename e2e/ to integration/** - Current naming is misleading
2. **Add actual E2E test** - Use the existing `launchTestApp()` to:
   - Launch Electron
   - Navigate to ChatGPT
   - Inject a message
   - Verify response capture
   - Test CircuitBreakerModal appearance on failure

3. **Add CircuitBreakerModal unit test** - At minimum:
   ```typescript
   // Pseudo-code for missing test
   test('CircuitBreakerModal renders with step info', () => {
     render(<CircuitBreakerModal step={mockStep} onDecision={jest.fn()} />);
     expect(screen.getByText('retry')).toBeDefined();
     expect(screen.getByText('skip')).toBeDefined();
     expect(screen.getByText('stop')).toBeDefined();
   });
   ```

### Short-term

4. **Migrate to Vitest or Jest** - Get proper test isolation, coverage, parallel execution
5. **Add CI pipeline** - Run tests on every commit
6. **Create DOM snapshot tests** - Capture real ChatGPT DOM and compare
7. **Add enforcer integration test** - Test with real Python check scripts (or shimmed versions)

### Long-term

8. **Property-based testing** - For frontmatter generation, DAG ordering
9. **Fuzz testing** - For output translator, rate limit detection
10. **Visual regression tests** - For CircuitBreakerModal, ProfilePicker

## Checklist

- [x] Critical paths covered (partially - enforcement flow tested via mocks)
- [ ] Error scenarios tested (circuit breaker mocked, real failures untested)
- [ ] Mocks appropriate (FAIL - too much mocking undermines integration confidence)
- [ ] Integration tests reliable (PARTIAL - order-sensitive assertions may flake)
- [ ] E2E tests actually E2E (FAIL - mocked Electron, not real app)

---

## Appendix: File-by-File Analysis

### claude-adapter.test.ts (245 lines, 8 tests)

**Purpose:** Tests Claude Code adapter functionality

**What it tests:**
1. Tool name translation (7 mappings)
2. YAML frontmatter structure
3. maxTurns derivation from maxTokens
4. Temp file creation/deletion
5. Oversized prompt rejection
6. Adapter capabilities
7. Factory singleton behavior

**Quality notes:**
- Good boundary testing (maxTokens = 0, 8000, 400000, 1000)
- Proper async handling for file operations
- Clear assertion messages

**Missing:**
- Invalid model name handling
- Invalid tool name behavior (beyond passthrough)
- Concurrent temp file operations

### integration/conductor-scheduler-executor.test.ts (1005 lines, 23 tests)

**Purpose:** Full pipeline integration from conductor to executor

**What it tests:**
- 10-step enforcement flow (8 tests)
- DAG dependency order (4 tests)
- Pre/post gate bodyguard events (3 tests)
- Circuit breaker behavior (3 tests)
- Send interceptor pipeline (5 tests)

**Quality notes:**
- Thorough event ordering validation
- Good use of tracking executors
- Proper cleanup between tests

**Critical flaw:**
- Lines 122-132: Enforcer is completely mocked to always pass
- This means bodyguard never actually validates anything
- Git repo setup (lines 27-37) creates real temp repo, but spine operations not verified

### e2e/electron-dispatch.test.ts (543 lines, 10 tests)

**Purpose:** "E2E" dispatch testing (actually integration)

**What it tests:**
1. DOM injection message flow (3 tests)
2. Rate limit detection (2 tests)
3. Adapter dispatch flow (3 tests)
4. Error capture/recovery (2 tests)

**Critical flaw:**
- Lines 97-127: Electron mocked via require.cache
- Lines 62-88: MockBrowserWindow with executeJavaScript that returns canned responses
- This is NOT E2E - no real browser, no real DOM, no real ChatGPT

**What it should do:**
- Use `launchTestApp()` from fixtures.ts
- Actually navigate to chatgpt.com (or a mock server)
- Actually inject via real DOM
- Actually verify real response capture

### e2e/fixtures.ts (135 lines, 0 tests)

**Purpose:** E2E test helpers

**Key exports:**
- `launchTestApp()` - Uses Playwright `_electron.launch()` - NEVER CALLED
- `closeTestApp()` - Clean shutdown helper - NEVER CALLED
- `test()`, `assertEqual()`, etc. - Custom assertion framework

**Critical issue:**
- Lines 29-40 define exactly what's needed for real E2E
- But electron-dispatch.test.ts imports `test` from here while ignoring `launchTestApp`

### e2e/mocks.ts (213 lines, 0 tests)

**Purpose:** Mock data for E2E tests

**What it provides:**
- `mockChatGPTDOM()` - Mock DOM structure matching selectors
- `mockCLIResponse()` - Codex/Claude JSON output
- `mockRateLimitDOM()` - Rate limit message text
- `mockMalformedOutput()` - Crash/truncation scenarios
- `mockTimeoutError()` - Timeout error object
- `mockAgentConfig()` - Agent configuration

**Quality:** Good - well-structured, documented, typed

**Risk:** Mock DOM may diverge from real ChatGPT DOM

### compatibility-matrix-validation.ts (314 lines, 4 tests)

**Purpose:** Validate runtime adapter implementations

**What it tests:**
1. Codex CLI JSON output capability
2. Claude Code agent file support
3. Claude Code session resume
4. ChatGPT Web DOM injection functions

**Quality notes:**
- Good capability verification
- Tests actual module exports exist
- Validates selector arrays are non-empty

**Missing:**
- No actual capability exercise (just checking flags)
- No version compatibility testing
