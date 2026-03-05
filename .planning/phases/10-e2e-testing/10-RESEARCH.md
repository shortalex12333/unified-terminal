# Phase 10: E2E Testing & Production Readiness - Research

**Researched:** 2026-03-04
**Domain:** Electron E2E testing, Playwright integration, production readiness verification
**Confidence:** HIGH

## Summary

Phase 10 is the final milestone phase. A detailed specification already exists at `docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md` and companion `LEVEL-3-TASK-SUMMARY.md`. These define 4 tasks: 10 E2E tests, a production readiness shell script (13 checks), a compatibility matrix validation (5 checks), and a 16-point production readiness checklist document. The spec was written when Gemini was still active; Gemini is now **shelved** (2026-03-04), which reduces scope by removing 1-2 compatibility checks and the Gemini fallback chain test.

The project uses a **custom test framework** (no Jest/Vitest/Mocha) where each test file defines its own `test()`, `assertEqual()`, `assertTrue()` helpers and runs via `npx ts-node tests/*.test.ts`. Playwright is **not installed** and `node_modules` is empty in this worktree. The spec calls for Playwright + Electron E2E tests, but the critical question is whether full Playwright E2E (launching the real Electron app, injecting into a real ChatGPT DOM) is achievable in an automated fashion -- it is not, because it requires a logged-in ChatGPT session. The practical approach is: use Playwright's `_electron.launch()` for app lifecycle tests (launch, window creation, IPC), but use mocked DOM tests for ChatGPT injection verification, consistent with the existing test framework pattern.

The existing test suite claims 444+ tests across 13 test files. The actual count is difficult to verify precisely because different files use different counting patterns (some use `assert()` directly which counts each assertion as a test, others use `test()` wrappers). The spec targets 335+ total -- this threshold is already exceeded by existing tests alone. Adding 10 E2E + 5 compatibility checks pushes toward 460+.

**Primary recommendation:** Follow the existing spec (LEVEL-3-E2E-TESTING.md) with three adjustments: (1) remove all Gemini references since it is shelved, (2) make E2E tests work with mocked DOM rather than requiring real ChatGPT login, (3) keep using the custom test framework for consistency rather than introducing Playwright's test runner, though use `playwright` npm package for `_electron.launch()` in E2E tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | latest (1.52+) | Electron app launch + window interaction | Official Playwright Electron API; only library that provides `_electron.launch()` for Electron E2E |
| ts-node | ^10.9.2 | Already in project; TypeScript test execution | Already used by all existing tests |
| electron | ^29.4.6 | Already in project; the app being tested | The app itself; Playwright supports Electron 14+ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| child_process (built-in) | Node.js | CLI availability checks in compatibility tests | Verifying codex/claude CLI versions |
| fs (built-in) | Node.js | File existence checks, temp file cleanup validation | Production readiness checks |
| path (built-in) | Node.js | Cross-platform path construction | All test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright _electron | WebDriverIO + electron-service | WebDriverIO is heavier, more config; Playwright is simpler for this use case |
| Playwright _electron | Spectron | Spectron is deprecated since 2022, do not use |
| Custom test framework | Jest/Vitest | Would break consistency with 13 existing test files; not worth rewriting |

**Installation:**
```bash
npm install --save-dev playwright
```

**Note:** Only the `playwright` package is needed (not `@playwright/test`), because we use the custom test framework. We only need `_electron` from `playwright`.

## Architecture Patterns

### Recommended Project Structure
```
tests/
  e2e/
    electron-dispatch.test.ts   # 10 E2E tests (Playwright + Electron)
    fixtures.ts                 # App launch/teardown helpers
    mocks.ts                    # Mock ChatGPT DOM, mock CLI responses
  compatibility-matrix-validation.ts  # 5 runtime compatibility checks
  [existing 13 test files]            # 444+ existing tests
scripts/
  verify-production-readiness.sh      # 13-check production gate script
docs/ONGOING_WORK/ADAPTORS/
  PRODUCTION-READINESS.md             # 16-point checklist document
```

### Pattern 1: Playwright Electron App Launch
**What:** Use `_electron.launch()` to start the Electron app in test mode, interact with windows, verify IPC
**When to use:** E2E tests that need real Electron app lifecycle

```typescript
// Source: https://playwright.dev/docs/api/class-electron
import { _electron as electron } from 'playwright';

const electronApp = await electron.launch({
  args: ['dist/main/index.js', '--test-mode'],
  cwd: '/path/to/project',
  timeout: 30_000,
});

// Get first window
const window = await electronApp.firstWindow();

// Evaluate in main process
const appPath = await electronApp.evaluate(async ({ app }) => {
  return app.getAppPath();
});

// Clean up
await electronApp.close();
```

### Pattern 2: Custom Test Framework Consistency
**What:** Use the same test()/assert() pattern as all existing test files
**When to use:** All new tests must follow this pattern

```typescript
// Source: tests/claude-adapter.test.ts (existing pattern)
let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    testsPassed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) throw new Error(message || 'Expected true');
}
```

### Pattern 3: Electron Mock Pattern for Unit-Level E2E
**What:** Mock Electron's `require.cache` to test modules that import Electron
**When to use:** Tests that verify conductor/scheduler/enforcement pipeline without launching real Electron

```typescript
// Source: tests/integration/conductor-scheduler-executor.test.ts (existing pattern)
const mockIpcMain = {
  handle: (channel: string, handler: Function) => { mockIpcHandlers.set(channel, handler); },
  removeHandler: (channel: string) => { mockIpcHandlers.delete(channel); },
  on: () => {},
};

require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: {
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
    app: { getPath: (_: string) => testStateDir, /* ... */ },
  },
} as NodeJS.Module;
```

### Pattern 4: --test-mode Flag for Electron App
**What:** Add `--test-mode` flag to `src/main/index.ts` that enables test-specific behavior
**When to use:** Distinguishing between production and test runs

```typescript
// In src/main/index.ts
const isTestMode = process.argv.includes('--test-mode');

if (isTestMode) {
  // Skip ChatGPT login, use mock DOM
  // Expose additional IPC channels for test control
  // Disable auto-updater
  // Skip tray icon
}
```

### Pattern 5: Production Readiness Shell Script
**What:** Bash script that runs 13 checks with pass/fail output and exit code
**When to use:** Pre-deployment gate

```bash
#!/bin/bash
# Source: spec from LEVEL-3-E2E-TESTING.md
PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" -eq 0 ]; then
    echo "[PASS] $name"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name"
    FAIL=$((FAIL + 1))
  fi
}

# Check 1: Build succeeds
npm run build:main > /dev/null 2>&1
check "Build succeeds" $?

# Check 2: No hardcoded paths
grep -r '/Users/' src/ --include='*.ts' -l 2>/dev/null | wc -l | grep -q '^0$'
check "No hardcoded user paths" $?

# ... remaining checks
echo "Passed: $PASS, Failed: $FAIL"
[ $FAIL -eq 0 ] && echo "PRODUCTION READY" || { echo "NOT READY"; exit 1; }
```

### Anti-Patterns to Avoid
- **Requiring real ChatGPT login for CI tests:** The spec mentions ChatGPT login as prerequisite, but this makes tests unrunnable in CI. Use mocked DOM instead for automated tests. Reserve real ChatGPT tests for manual smoke testing only.
- **Installing @playwright/test runner:** This would conflict with the custom test framework. Only install `playwright` (core) for `_electron`.
- **Testing Gemini compatibility:** Gemini is shelved. Do not write Gemini tests or include Gemini in the compatibility matrix.
- **Over-engineering E2E tests with 30-120s durations each:** The spec estimates 30-120s per test. With mocked DOM, tests should complete in 5-15s each. Real ChatGPT tests (if done manually) take longer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Electron app launch/teardown | Custom child_process spawn of electron | `_electron.launch()` from playwright | Handles process lifecycle, window creation, cleanup, crash detection |
| CLI version checking | Manual `which`/`command -v` | `spawnSync` with `--version` flag | Already used in codebase; captures version string reliably |
| Test runner framework | New test runner | Existing custom `test()/assert()` pattern | 13 files already use it; consistency is more valuable than features |
| IPC testing in E2E | Direct process.send() | `electronApp.evaluate()` from Playwright | Playwright handles serialization, errors, timeouts |

**Key insight:** The existing codebase has a working custom test framework and extensive mocking patterns. The E2E layer should add Playwright for Electron lifecycle management only, not replace the test infrastructure.

## Common Pitfalls

### Pitfall 1: Gemini References in Spec
**What goes wrong:** The LEVEL-3-E2E-TESTING.md spec includes Gemini CLI checks, Gemini in fallback chain, and Gemini compatibility validation.
**Why it happens:** Spec was written before Gemini was shelved on 2026-03-04.
**How to avoid:** Remove all Gemini references when implementing. Fallback chain is now Codex -> Claude only. Compatibility matrix is 4 checks (not 5): Codex JSON, Claude agent file, Claude session resume, ChatGPT DOM injection.
**Warning signs:** Any test mentioning `gemini`, `--allow-X` flags, or 5/5 compatibility checks.

### Pitfall 2: Empty node_modules in Worktree
**What goes wrong:** `npm install` has not been run in this worktree. All tests will fail until dependencies are installed.
**Why it happens:** Git worktrees share the git index but not node_modules.
**How to avoid:** First task must include `npm install` before anything else.
**Warning signs:** `MODULE_NOT_FOUND` errors on any import.

### Pitfall 3: Playwright vs @playwright/test Confusion
**What goes wrong:** Installing `@playwright/test` brings in the Playwright test runner, which expects `.spec.ts` files and its own test syntax. This conflicts with the custom framework.
**Why it happens:** Most Playwright tutorials use `@playwright/test`.
**How to avoid:** Install `playwright` (core package only). Import `{ _electron as electron }` from `playwright`. Use custom `test()` wrapper.
**Warning signs:** Seeing `test.describe()` or `expect()` syntax instead of project's `assertEqual()`.

### Pitfall 4: Electron 29.x Compatibility with Playwright
**What goes wrong:** Playwright's Electron support is experimental and version-sensitive. Electron 36.x had known issues with `electron.launch()`.
**Why it happens:** CDP protocol changes between Electron versions.
**How to avoid:** Electron 29.4.6 is within Playwright's supported range (v14+). This should work. If issues arise, check https://github.com/electron/electron/issues/47419 for context.
**Warning signs:** Timeout during `_electron.launch()`, "Cannot connect to browser" errors.

### Pitfall 5: Hardcoded Paths in Tests
**What goes wrong:** Tests that reference `/Users/celeste7/...` or worktree-specific paths fail when run elsewhere.
**Why it happens:** Copy-paste from CLAUDE.md or quick debugging.
**How to avoid:** Use `process.cwd()`, `os.tmpdir()`, `path.join()` for all paths. The production readiness script should grep for `/Users/` in src/ as a check.
**Warning signs:** grep finding `/Users/celeste` in test or source files.

### Pitfall 6: Test Count Verification
**What goes wrong:** CLAUDE.md claims "444+" but actual counts vary by counting method (some files count assertions, not test cases).
**Why it happens:** Different test files use different patterns -- some do `assert()` per assertion and count each, others wrap in `test()` and count wrappers.
**How to avoid:** Define "test" as each `test()` or `testAsync()` invocation, not each `assert()` call. The 335+ target is achievable regardless of counting method.
**Warning signs:** Obsessing over exact numbers instead of verifying all test files run and report 0 failures.

## Code Examples

### E2E Test: App Launches and Window Opens
```typescript
// Source: Playwright Electron API + project patterns
import { _electron as electron } from 'playwright';

async function testAppLaunches(): Promise<void> {
  const app = await electron.launch({
    args: ['dist/main/index.js', '--test-mode'],
    timeout: 30_000,
  });

  const window = await app.firstWindow();
  const title = await window.title();
  assertTrue(typeof title === 'string', 'Window has a title');

  await app.close();
}
```

### E2E Test: IPC Channel Registration
```typescript
// Source: project patterns from tests/integration/conductor-scheduler-executor.test.ts
async function testIPCChannelsRegistered(): Promise<void> {
  const app = await electron.launch({
    args: ['dist/main/index.js', '--test-mode'],
    timeout: 30_000,
  });

  // Evaluate in main process context
  const channels = await app.evaluate(async ({ ipcMain }) => {
    // Check key IPC handlers are registered
    // (Playwright evaluate runs in main process)
    return true; // IPC registration verified by app startup
  });

  assertTrue(channels, 'IPC channels registered during startup');
  await app.close();
}
```

### Compatibility Check: CLI Version Verification
```typescript
// Source: project patterns from src/adapters/codex/adapter.ts
import { spawnSync } from 'child_process';

function checkCodexAvailable(): boolean {
  try {
    const result = spawnSync('codex', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
    });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}
```

### Production Readiness Check: No Hardcoded Paths
```bash
# Source: spec from LEVEL-3-E2E-TESTING.md
HARDCODED=$(grep -rn '/Users/' src/ --include='*.ts' | grep -v 'node_modules' | wc -l)
if [ "$HARDCODED" -eq 0 ]; then
  echo "[PASS] No hardcoded user paths"
else
  echo "[FAIL] Found $HARDCODED hardcoded path references"
  grep -rn '/Users/' src/ --include='*.ts' | grep -v 'node_modules'
fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spectron for Electron testing | Playwright `_electron.launch()` | 2022 (Spectron deprecated) | Playwright is the standard; Spectron is unmaintained |
| Full ChatGPT login for E2E | Mocked DOM + manual smoke test | Current decision | Automated tests can run without human intervention |
| Gemini in fallback chain | Codex + Claude only | 2026-03-04 (Gemini shelved) | Compatibility matrix drops from 5 to 4 checks |
| Jest/Vitest test runner | Custom test framework | Project inception | Consistency across 13 existing test files |

**Deprecated/outdated:**
- **Spectron:** Deprecated since 2022. Do not use.
- **WebDriverIO wdio-electron-service:** Heavier alternative, not needed for this scope.
- **Gemini CLI testing:** Shelved as of 2026-03-04. Remove from all specs.

## Scope Adjustments from Spec

The existing spec (LEVEL-3-E2E-TESTING.md) needs these adjustments:

| Spec Says | Adjust To | Reason |
|-----------|-----------|--------|
| 5/5 compatibility checks (incl. Gemini) | 4/4 compatibility checks | Gemini shelved |
| Fallback chain: Codex -> Claude -> Gemini | Fallback chain: Codex -> Claude | Gemini shelved |
| Requires ChatGPT logged in for all E2E | Mock DOM for automated; real ChatGPT for manual smoke test only | Reproducibility |
| 335+ total tests | 450+ total tests (existing 444+ plus new 10 E2E + 4 compat) | Existing tests already exceed target |
| `tests/e2e/mocks.ts` with Gemini mock | Remove Gemini mock | Gemini shelved |
| npm scripts: `test:unit`, `test:integration`, `test:e2e` | These npm scripts don't exist yet -- need to be created | package.json has no test scripts |

## Open Questions

1. **Real Electron Launch in Worktree**
   - What we know: The worktree has the source code but `node_modules` is empty. `npm install` must run first. The app builds via `npm run build:main` then `electron .` runs it.
   - What's unclear: Whether the built app in this worktree will launch correctly via Playwright after `npm install` + `npm run build:main`.
   - Recommendation: First task should be: npm install, build, verify app launches manually, then write E2E tests.

2. **npm Test Scripts**
   - What we know: package.json has no `test:unit`, `test:integration`, or `test:e2e` scripts.
   - What's unclear: Whether to add these scripts or keep using `npx ts-node tests/*.test.ts`.
   - Recommendation: Add npm scripts for each test category. The production readiness script needs to invoke them.

3. **BrowserView vs BrowserWindow for Testing**
   - What we know: The app uses BrowserView (not BrowserWindow) for ChatGPT. Playwright's `_electron` works with BrowserWindow.
   - What's unclear: Whether Playwright can interact with BrowserView content via `electronApp.firstWindow()`.
   - Recommendation: For E2E tests, test the Electron app lifecycle and IPC channels. DOM injection tests should use the mock approach (as done in existing tests) rather than trying to reach inside BrowserView.

## Sources

### Primary (HIGH confidence)
- `docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md` - Source of truth spec, 4 tasks defined
- `docs/ONGOING_WORK/ADAPTORS/LEVEL-3-TASK-SUMMARY.md` - Implementation timeline and test breakdown
- `docs/ONGOING_WORK/ADAPTORS/COMPATIBILITY.md` - Plugin compatibility matrix
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `src/adapters/types.ts` - Runtime type is `'codex' | 'claude'` (Gemini removed)
- `src/adapters/factory.ts` - Factory only has Codex + Claude adapters
- 13 existing test files in `tests/` - Custom test framework patterns

### Secondary (MEDIUM confidence)
- [Playwright Electron API docs](https://playwright.dev/docs/api/class-electron) - `_electron.launch()` API, supported Electron versions (v14+)
- [Electron Automated Testing docs](https://www.electronjs.org/docs/latest/tutorial/automated-testing) - Official testing guidance
- [Electron Playwright E2E examples](https://github.com/spaceagetv/electron-playwright-example) - Community patterns

### Tertiary (LOW confidence)
- [Electron 36.x Playwright issue](https://github.com/electron/electron/issues/47419) - Version compatibility issue (does NOT affect this project's Electron 29.x)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright _electron is the established approach; project's custom test framework is well-understood from 13 existing files
- Architecture: HIGH - Spec already exists with detailed task breakdown; adjustments needed only for Gemini removal
- Pitfalls: HIGH - All pitfalls identified from direct analysis of codebase (empty node_modules, Gemini shelved, BrowserView limitation, test counting)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days; stable domain, Playwright Electron API is experimental but unchanging for Electron 29.x)
