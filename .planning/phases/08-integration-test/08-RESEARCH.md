# Phase 8: Integration Test - Research

**Researched:** 2026-03-04
**Domain:** Integration testing of Conductor -> Scheduler -> Executor -> Enforcement pipeline
**Confidence:** HIGH

## Summary

Phase 8 must prove that the full pipeline -- from message classification through DAG execution to enforcement checks -- works as a connected system. The existing 444+ tests are all **unit tests** that mock boundaries between components. Critically, the step-scheduler tests never exercise the enforcement, skills, or glue modules that `executeStep()` imports and calls. The integration test must verify these cross-module interactions without spawning real AI services.

The codebase uses a **custom test framework** (no Jest, no Vitest, no Mocha) with hand-rolled `test()`, `assertEqual()`, `assertTrue()` helpers, Electron IPC mocking via `require.cache` injection, and test execution via `npx ts-node`. The integration test must follow this exact pattern. There are no test fixtures, no test utilities shared across files -- each test file is self-contained.

The key insight is that the enforcement pipeline's 10-step flow already runs during existing tests (since steps 1-10 are wrapped in try/catch with "non-fatal" handling), but nobody is **asserting** that those steps fire. The integration test needs mock executors that produce realistic results (filesCreated, filesModified, tokensUsed) and spy on enforcement calls to verify the 10-step flow fires in the correct order.

**Primary recommendation:** Build a single integration test file that mocks Electron + Codex CLI spawning, injects a mock conductor response, and uses event-based assertions to verify the 10-step enforcement flow fires in sequence for each DAG step.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.4.5 | Language | Already used throughout project |
| ts-node | 10.9.2 | Test runner | `npx ts-node tests/*.test.ts` pattern used by all 12 existing test files |
| Node.js child_process | built-in | Mock target for CLI spawning | Conductor/executor spawn real processes |
| EventEmitter | built-in | Assertion hooks | StepScheduler emits all progress events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path, fs, os | built-in | Test fixtures | Creating temp dirs for spine snapshots |
| require.cache | Node.js | Module mocking | Injecting fake Electron before imports |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom test helpers | Jest/Vitest | Would break consistency with 12 existing test files using custom framework |
| require.cache mocking | jest.mock() | Custom approach already proven across all tests |
| Event-based assertions | Mock injection | EventEmitter is the native interface; events already emitted |

**Installation:**
No new dependencies needed. Everything required is already in package.json.

## Architecture Patterns

### Recommended Test File Structure
```
tests/
└── integration/
    └── conductor-scheduler-executor.test.ts    # Single file, ~600-900 lines
```

### Pattern 1: Electron Module Mocking (Copy from Existing Tests)
**What:** Inject mock Electron modules into require.cache before importing source modules
**When to use:** Every test file that imports from `src/main/` (which depends on Electron)
**Example:**
```typescript
// Source: tests/step-scheduler.test.ts (lines 16-48)
const mockIpcHandlers = new Map<string, Function>();

const mockIpcMain = {
  handle: (channel: string, handler: Function) => {
    mockIpcHandlers.set(channel, handler);
  },
  removeHandler: (channel: string) => {
    mockIpcHandlers.delete(channel);
  },
};

class MockBrowserWindow {
  isDestroyed() { return false; }
  webContents = {
    send: (channel: string, data: any) => { /* capture for assertions */ },
  };
}

require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: {
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
    app: {
      getPath: (name: string) => testStateDir,
      getName: () => 'test',
      getVersion: () => '0.0.1-test',
      isReady: () => true,
      on: () => {},
      once: () => {},
    },
  },
} as NodeJS.Module;
```

### Pattern 2: Mock Conductor That Returns Deterministic Plans
**What:** Instead of spawning a real Codex process, create a Conductor mock that immediately returns a pre-built ExecutionPlan
**When to use:** Integration tests that need classification without real AI
**Example:**
```typescript
// Create a mock conductor that returns a fixed classification
class MockConductor extends EventEmitter {
  private plan: ExecutionPlan;

  constructor(plan: ExecutionPlan) {
    super();
    this.plan = plan;
  }

  hasSession(): boolean { return true; }
  getSessionId(): string { return 'mock-session-id'; }

  async initialize(): Promise<void> {
    this.emit('session-started', 'mock-session-id');
  }

  async classify(message: string): Promise<ExecutionPlan> {
    this.emit('classification-complete', this.plan);
    return this.plan;
  }

  async reportStatus(): Promise<null> { return null; }
  cleanup(): void { this.removeAllListeners(); }
}
```

### Pattern 3: Event Spy for 10-Step Enforcement Flow Verification
**What:** Register event listeners on StepScheduler to capture the order and content of all progress events, then assert the 10-step sequence
**When to use:** Verifying enforcement steps fire in correct order
**Example:**
```typescript
const progressEvents: StepProgressEvent[] = [];

scheduler.on('progress', (event: StepProgressEvent) => {
  progressEvents.push(event);
});

// After execution, verify the 10-step enforcement flow:
const activities = progressEvents
  .filter(e => e.step.id === targetStepId)
  .map(e => e.activity);

assertTrue(activities.includes('Capturing pre-state...'), 'Step 1: Pre-spine runs');
assertTrue(activities.includes('Selecting skills...'), 'Step 2: Skill selection runs');
assertTrue(activities.includes('Assembling prompt...'), 'Step 3: Prompt assembly runs');
assertTrue(activities.includes('Pre-step gate check...'), 'Step 4: Pre-gate bodyguard runs');
assertTrue(activities.includes('Executing...'), 'Step 5: Executor runs');
assertTrue(activities.includes('Normalizing result...'), 'Step 6: Normalization runs');
assertTrue(activities.includes('Capturing post-state...'), 'Step 7: Post-spine runs');
assertTrue(activities.includes('Post-step gate check...'), 'Step 8: Post-gate bodyguard runs');
assertTrue(activities.includes('Verifying skills...'), 'Step 9: Skill verification runs');
assertTrue(activities.includes('Comparing state...'), 'Step 10: PA comparison runs');
```

### Pattern 4: Realistic Mock Executor With File Metadata
**What:** Mock executor that returns structured results with filesCreated/filesModified to trigger enforcement normalization logic
**When to use:** Testing the normalization and post-gate flow
**Example:**
```typescript
function createRealisticExecutor(): Executor {
  return {
    async execute(step: RuntimeStep, context?: Record<string, any>): Promise<any> {
      return {
        success: true,
        stepId: step.id,
        filesCreated: ['src/components/NewFile.tsx'],
        filesModified: ['src/App.tsx'],
        tokensUsed: { input: 1500, output: 800 },
        exitCode: 0,
      };
    },
    canHandle(step: RuntimeStep): boolean {
      return true;
    },
  };
}
```

### Pattern 5: Temp Git Repository for Spine Operations
**What:** Create a temporary directory, initialize git, and add initial files so buildSpine() can run real git/find commands
**When to use:** Any test that exercises the spine module
**Example:**
```typescript
// Source: Pattern derived from enforcement/spine.ts requirements
import { execFileSync } from 'child_process';

const testStateDir = path.join(os.tmpdir(), 'ut-integration-' + Date.now());
const mockProjectDir = path.join(testStateDir, 'mock-project');
fs.mkdirSync(mockProjectDir, { recursive: true });

// Initialize as git repo (buildSpine calls git rev-parse and git status)
execFileSync('git', ['init'], { cwd: mockProjectDir, stdio: 'ignore' });
execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: mockProjectDir, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Test'], { cwd: mockProjectDir, stdio: 'ignore' });
fs.writeFileSync(path.join(mockProjectDir, 'index.ts'), 'console.log("hello");');
execFileSync('git', ['add', '.'], { cwd: mockProjectDir, stdio: 'ignore' });
execFileSync('git', ['commit', '-m', 'initial'], { cwd: mockProjectDir, stdio: 'ignore' });
```

### Anti-Patterns to Avoid
- **Spawning real CLI processes:** The integration test must NOT spawn real `codex` or `claude` processes. This is an integration test of internal module wiring, not an E2E test (that is Phase 10).
- **Testing enforcement modules in isolation:** That is unit testing. The integration test must verify the modules work together through StepScheduler.
- **Skipping event assertions:** The enforcement flow uses `emitProgress()` at each step. These events are the primary observable side effect for verifying correct flow.
- **Using different test framework:** All 12 existing test files use the same custom test() / assertEqual() pattern. Do NOT introduce Jest or Vitest.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test framework | Custom assertion library | Copy existing test()/assertEqual()/assertTrue() | Consistency with 12 existing test files |
| Module mocking | Complex monkey-patching | require.cache injection (proven pattern) | Already works in conductor.test.ts, step-scheduler.test.ts |
| Temp directories | Manual cleanup | `os.tmpdir()` + `Date.now()` suffix | Pattern from conductor.test.ts line 20-23 |
| Process spawning mocks | Fake child_process | Mock at the Conductor/Executor level | Don't mock spawn() -- mock the classes that use it |

**Key insight:** The integration test does NOT need to mock `child_process.spawn` directly. Instead, mock at the component level: replace the real Conductor's classify() with a deterministic mock, and use mock Executors. The enforcement modules (bodyguard, spine, enforcer) should run FOR REAL against a temp project directory.

## Common Pitfalls

### Pitfall 1: Enforcement modules running against wrong directory
**What goes wrong:** `buildSpine()` runs `find` and `git` commands. If `projectDir` is the actual project directory, it will scan the entire repo and produce non-deterministic results.
**Why it happens:** `process.cwd()` is the default when no `projectDir` is in context.
**How to avoid:** Create a temp git repo in `os.tmpdir()` for each test. Initialize with `git init`, add a test file, commit. Pass this as `context.projectDir`.
**Warning signs:** Tests take too long (buildSpine scanning thousands of files) or produce flaky results.

### Pitfall 2: Mocking Electron IPC AFTER importing step-scheduler
**What goes wrong:** `StepScheduler` constructor calls `setupIPC()` which references `ipcMain.handle()`. If Electron is not mocked before import, the import crashes.
**Why it happens:** Module-level side effects in the constructor.
**How to avoid:** ALWAYS set up `require.cache[require.resolve('electron')]` BEFORE any `import` from `src/main/`.
**Warning signs:** `Cannot read property 'handle' of undefined` error on import.

### Pitfall 3: Skill selector trying to spawn real Codex agent
**What goes wrong:** `selectSkills()` in selector.ts tries to call `getAdapter('codex').isAvailable()` and then `adapter.spawn()`. In test environment, this may hang or fail unpredictably.
**Why it happens:** The skill selector uses agent-based selection as primary, keyword fallback as secondary.
**How to avoid:** Ensure `resources/skills/trigger-map.json` does NOT exist in the test environment (it already does not exist -- the directory is empty). This causes `loadCatalog()` to return null, which makes `selectSkills()` return `{ skills: [], reasoning: 'Trigger map unavailable' }` immediately. No Codex spawn happens.
**Warning signs:** Tests hanging for 15 seconds (SELECTOR_TIMEOUT_MS).

### Pitfall 4: Bodyguard gateCheck running real Python check scripts
**What goes wrong:** The enforcer tries to spawn `python3 checks/check_file_existence.py` which does not exist.
**Why it happens:** `gateCheck` creates check scripts from names, resolving to `checks/check_file_existence.py`.
**How to avoid:** This is already handled gracefully -- `runPythonScript` catches spawn errors and returns `{ passed: false }`. The bodyguard aggregates a SOFT_FAIL or PASS depending on confidence levels. This is actually correct behavior for integration testing: the enforcement pipeline runs, check scripts fail (expected), and the step continues because failures are non-fatal in the current flow.
**Warning signs:** None -- this is by design. The integration test should VERIFY that checks are attempted, not that they pass.

### Pitfall 5: Async test leaks and hanging process
**What goes wrong:** Tests hang after completion because setTimeout callbacks from circuit breaker (5-minute timeout), retry delays, or spine commands are still pending.
**Why it happens:** StepScheduler uses `setTimeout` for retry delays and user decision timeouts.
**How to avoid:** Call `cleanupStepScheduler()` after each test group. Use `scheduler.stop()` to cancel running executors. Set `process.exit()` at the end of the test file (pattern from existing tests).
**Warning signs:** Test process does not exit after printing results.

### Pitfall 6: Circular dependency between step-scheduler and conductor types
**What goes wrong:** Both step-scheduler.ts and conductor.ts define `ExecutionPlan` and `Step` types with slightly different shapes.
**Why it happens:** The Conductor's `ExecutionPlan` has `{ plan: Step[] }` with route/complexity, while the StepScheduler's `ExecutionPlan` has `{ steps: PlanStep[] }` with planId/name. The send-interceptor manually translates between them.
**How to avoid:** In the integration test, create plans that match the **StepScheduler's** `ExecutionPlan` format (with `steps`, `planId`, `name`). If testing the full send-interceptor flow, create plans in the **Conductor's** format and verify the translation.
**Warning signs:** Type errors at compile time, or runtime property access failures.

## Code Examples

Verified patterns from the existing codebase:

### Test File Boilerplate (from conductor.test.ts + step-scheduler.test.ts)
```typescript
// Source: tests/conductor.test.ts lines 16-55, tests/step-scheduler.test.ts lines 16-48
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

// Create temp directory for test state AND mock project
const testStateDir = path.join(os.tmpdir(), 'ut-integration-' + Date.now());
const mockProjectDir = path.join(testStateDir, 'mock-project');
fs.mkdirSync(mockProjectDir, { recursive: true });

// Initialize mock project as git repo for spine operations
execFileSync('git', ['init'], { cwd: mockProjectDir, stdio: 'ignore' });
execFileSync('git', ['config', 'user.email', 'test@test.com'], {
  cwd: mockProjectDir, stdio: 'ignore'
});
execFileSync('git', ['config', 'user.name', 'Test'], {
  cwd: mockProjectDir, stdio: 'ignore'
});
fs.writeFileSync(path.join(mockProjectDir, 'index.ts'), 'console.log("hello");');
execFileSync('git', ['add', '.'], { cwd: mockProjectDir, stdio: 'ignore' });
execFileSync('git', ['commit', '-m', 'initial'], { cwd: mockProjectDir, stdio: 'ignore' });

// Mock Electron BEFORE any src/ imports
const mockIpcHandlers = new Map<string, Function>();
require.cache[require.resolve('electron')] = {
  id: 'electron', filename: 'electron', loaded: true,
  exports: {
    ipcMain: {
      handle: (ch: string, fn: Function) => mockIpcHandlers.set(ch, fn),
      removeHandler: (ch: string) => mockIpcHandlers.delete(ch),
    },
    BrowserWindow: class {
      isDestroyed() { return false; }
      webContents = { send: () => {} };
    },
    app: {
      getPath: () => testStateDir,
      getName: () => 'test',
      getVersion: () => '0.0.1',
      isReady: () => true,
      on: () => {}, once: () => {},
    },
  },
} as NodeJS.Module;
```

### DAG Execution With Dependency Order Verification
```typescript
// Source: tests/step-scheduler.test.ts lines 614-640
const executionOrder: number[] = [];
const trackingExecutor: Executor = {
  async execute(step: RuntimeStep) {
    executionOrder.push(step.id);
    return { success: true };
  },
  canHandle() { return true; },
};

scheduler.registerExecutor('cli', trackingExecutor);

const plan: ExecutionPlan = {
  planId: 'diamond-dag',
  name: 'Diamond DAG',
  steps: [
    { id: 1, target: 'cli', action: 'start', detail: 'Start', waitFor: [], parallel: false },
    { id: 2, target: 'cli', action: 'branch_a', detail: 'Branch A', waitFor: [1], parallel: true },
    { id: 3, target: 'cli', action: 'branch_b', detail: 'Branch B', waitFor: [1], parallel: true },
    { id: 4, target: 'cli', action: 'merge', detail: 'Merge', waitFor: [2, 3], parallel: false },
  ],
};

const result = await scheduler.execute(plan);
assertEqual(executionOrder[0], 1, 'Start runs first');
assertEqual(executionOrder[executionOrder.length - 1], 4, 'Merge runs last');
```

### Circuit Breaker With Auto-Skip
```typescript
// Source: tests/step-scheduler.test.ts lines 738-764
scheduler.on('step-needs-user', (options: CircuitBreakerOptions) => {
  const handler = mockIpcHandlers.get('step:user-decision');
  if (handler) {
    setTimeout(() => handler({}, options.step.id, 'skip'), 10);
  }
});

scheduler.registerExecutor('cli', createFailingExecutor(MAX_RETRIES + 10));
const result = await scheduler.execute(plan);
assertEqual(result.steps[0].status, 'skipped', 'Circuit breaker triggered and user skipped');
```

### Fast-Path Integration (from send-interceptor.ts)
```typescript
// Source: src/main/send-interceptor.ts lines 307-314
const fastPathResult = fastPathCheckWithReason(text);
if (fastPathResult.result === 'bypass_to_chatgpt') {
  return { route: 'web', fastPath: true };
}
// Otherwise: Tier 1 conductor classification
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex task-router | Conductor + Fast-path tiered routing | Phase 5 (Conductor) | AI-powered classification replaces brittle regex |
| No enforcement | 10-step bodyguard flow in executeStep() | Phase 5 (Wiring) | Every step gets pre/post gate checks |
| Mocked enforcement in unit tests | Real enforcement in integration tests | Phase 8 (this phase) | First time enforcement is actually asserted |

**Deprecated/outdated:**
- `src/main/task-router.ts`: Legacy regex-based routing. Still exists but bypassed by Conductor/Fast-path. Not tested in integration.

## Open Questions

1. **Should the integration test create real files in the mock project to trigger post-spine diffs?**
   - What we know: `buildSpine()` runs `git status --porcelain` and `find -type f`. `compareSpines()` diffs file lists.
   - What's unclear: Whether a mock executor should actually write files to the mock project directory, or whether the spine diff can be tested with the mock executor's reported files only.
   - Recommendation: The mock executor should write at least one file to `mockProjectDir` during execution. This makes the spine diff produce real results, which is more valuable for integration testing. Keep it minimal: one file create, one file modify.

2. **How should the send-interceptor integration be tested without a real BrowserView?**
   - What we know: `routeMessage()` in send-interceptor.ts chains fast-path check -> conductor classify -> scheduler execute. It imports singletons.
   - What's unclear: Whether to test `routeMessage()` directly or test each tier separately.
   - Recommendation: Test `routeMessage()` directly with mocked conductor singleton. This validates the full chain. The BrowserView/DOM interceptor part (installInterceptor) is out of scope -- that requires E2E testing (Phase 10).

3. **Should the test validate that check scripts are ATTEMPTED even though they fail?**
   - What we know: `gateCheck()` determines applicable checks, creates EnforcerCheck configs, and spawns processes. In the test environment, the check scripts do not exist, so they return `{ passed: false }`.
   - What's unclear: Whether asserting "checks were attempted" is valuable vs just asserting "gate returned a verdict."
   - Recommendation: Assert that `gateCheck()` returns a `BodyguardVerdict` with `checksRun > 0`. This proves the enforcement pipeline ran. Do NOT assert specific check pass/fail since scripts don't exist.

## Sources

### Primary (HIGH confidence)
- **src/main/step-scheduler.ts** - 10-step enforcement flow implementation (lines 441-743)
- **src/main/conductor.ts** - Classification API and types
- **src/main/send-interceptor.ts** - Full pipeline chain
- **src/enforcement/** - bodyguard, spine, enforcer, constants, types (6 files)
- **src/skills/** - selector, validator, verify-parser, critical-checks, verify-sandbox (6 files)
- **src/glue/** - assemble-prompt, normalizer (3 files)
- **tests/step-scheduler.test.ts** - 83 unit tests with mock executor patterns
- **tests/conductor.test.ts** - 63 unit tests with Electron mock pattern

### Secondary (MEDIUM confidence)
- **.planning/STATE.md** - Project state and known gaps
- **.planning/ROADMAP.md** - Phase descriptions and acceptance criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing tools and patterns already proven in 12 test files
- Architecture: HIGH - Following exact patterns from step-scheduler.test.ts and conductor.test.ts
- Pitfalls: HIGH - Identified from direct code reading of all 6 enforcement modules, 6 skills modules, 3 glue modules, and 12 existing test files

**Key codebase facts for the planner:**
- Test runner: `npx ts-node tests/integration/conductor-scheduler-executor.test.ts`
- tsconfig rootDir is `./src`, but tests are NOT in src/. Tests run via ts-node which has its own resolution.
- `resources/skills/` directory exists but is EMPTY (no trigger-map.json). This means skill selection will always return empty. Integration test should NOT create skill files -- that changes production behavior.
- StepScheduler emits specific activity strings at each enforcement step via `emitProgress()`. These are the primary assertion targets.
- The two `ExecutionPlan` types (Conductor vs StepScheduler) have different shapes. The integration test must handle both.
- All enforcement steps in `executeStep()` are wrapped in try/catch with "non-fatal" handling. The test should verify they RUN (via progress events), not that they SUCCEED.
- `buildSpine()` calls `find` and `git` -- requires a real directory with git init. Use temp dir.
- `gateCheck()` calls `runCheckWithRetry()` which spawns processes for Python scripts or inline commands. Scripts don't exist in test env, so checks will fail gracefully.
- The step-scheduler `executeStep()` progress activity strings (exact values from source):
  - `'Capturing pre-state...'` (step 1 - line 478)
  - `'Selecting skills...'` (step 2 - line 489)
  - `'Assembling prompt...'` (step 3 - line 516)
  - `'Pre-step gate check...'` (step 4 - line 541)
  - `'Executing...'` (step 5 - line 578)
  - `'Normalizing result...'` (step 6 - line 588)
  - `'Capturing post-state...'` (step 7 - line 613)
  - `'Post-step gate check...'` (step 8 - line 624)
  - `'Verifying skills...'` (step 9 - line 653)
  - `'Comparing state...'` (step 10 - line 682)
  - `'Starting...'` (initial - line 472)
  - `'Complete'` (success - line 707)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- internal codebase, no external dependency changes)
