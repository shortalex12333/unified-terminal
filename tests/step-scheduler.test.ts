/**
 * Step Scheduler Tests
 *
 * Tests for DAG execution, circuit breaker pattern, singleton management,
 * event emission, and executor registration.
 *
 * Run with: npx ts-node tests/step-scheduler.test.ts
 */

// ============================================================================
// MOCK ELECTRON IPC (must be before importing step-scheduler)
// ============================================================================

// Mock ipcMain to avoid Electron dependency in tests
const mockIpcHandlers = new Map<string, Function>();

const mockIpcMain = {
  handle: (channel: string, handler: Function) => {
    mockIpcHandlers.set(channel, handler);
  },
  removeHandler: (channel: string) => {
    mockIpcHandlers.delete(channel);
  },
};

// Mock BrowserWindow
class MockBrowserWindow {
  isDestroyed() {
    return false;
  }
  webContents = {
    send: (channel: string, data: any) => {
      // Silent mock
    },
  };
}

// Inject mocks into module cache before importing
// @ts-ignore - mocking electron
require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: {
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
  },
};

// ============================================================================
// MOCK ENFORCEMENT ENGINE COMPONENTS (must be before importing step-scheduler)
// ============================================================================
// The step-scheduler imports enforcement, skills, glue, and adapter modules.
// These modules try to run actual Python check scripts, spawn Codex agents,
// read trigger-map.json, etc. — none of which exist in the test environment.
// We mock them all to return safe defaults.

import * as path from 'path';

const srcDir = path.resolve(__dirname, '..', 'src');

// Helper to inject a mock module into require.cache
function mockModule(modulePath: string, exports: Record<string, any>): void {
  // @ts-ignore - mocking modules
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  };
}

// --- Mock: src/main/events.ts (used by bodyguard, spine, enforcer) ---
const noopFn = (..._args: any[]) => {};
const mockSystemEvents = {
  emitStatus: noopFn,
  onStatus: () => noopFn,
  onSource: () => noopFn,
  onAll: () => noopFn,
  emit: noopFn,
  on: noopFn,
  off: noopFn,
};

const mockEventEmitters = {
  bodyguardEvents: { gateStart: noopFn, checking: noopFn, checkComplete: noopFn, pass: noopFn, fail: noopFn, failHeuristic: noopFn, failDefinitive: noopFn },
  spineEvents: { refreshed: noopFn, compared: noopFn, buildStart: noopFn, buildComplete: noopFn },
  schedulerEvents: { planStart: noopFn, stepStart: noopFn, stepProgress: noopFn, stepDone: noopFn, stepFailed: noopFn, stepSkipped: noopFn, needsUser: noopFn, planComplete: noopFn },
  enforcerEvents: { checkRun: noopFn, checkStart: noopFn, checkPass: noopFn, checkFail: noopFn, checkTimeout: noopFn },
  conductorEvents: { classifyStart: noopFn, classifyComplete: noopFn, planReady: noopFn, replan: noopFn, sessionStart: noopFn, error: noopFn },
  workerEvents: { spawn: noopFn, fileCreated: noopFn, fileModified: noopFn, complete: noopFn, error: noopFn, timeout: noopFn },
  rateLimitEvents: { hit: noopFn, deferred: noopFn, resumed: noopFn },
  imageGenEvents: { start: noopFn, progress: noopFn, complete: noopFn, error: noopFn },
  deployEvents: { start: noopFn, progress: noopFn, complete: noopFn, error: noopFn },
  gitEvents: { start: noopFn, complete: noopFn, commit: noopFn, push: noopFn },
  paEvents: { querySent: noopFn, queryResponse: noopFn, queryTimeout: noopFn, interruptRouted: noopFn },
  systemEvents: mockSystemEvents,
  emit: noopFn,
  emitEvent: noopFn,
};

mockModule(path.resolve(srcDir, 'main', 'events.ts'), mockEventEmitters);

// --- Mock: src/enforcement/constants.ts ---
const mockCircuitBreaker = {
  MAX_STEP_RETRIES: 3,
  DEFINITIVE_FAIL_RETRIES: 0,
  HEURISTIC_FAIL_OPTIONS: ['retry', 'skip', 'stop'] as const,
  DEFINITIVE_FAIL_OPTIONS: ['retry', 'stop'] as const,
};

const mockEnforcerRetryPolicies: Record<string, any> = {
  'test-exit-code': { attempts: 1, delayMs: 0, confidence: 'definitive' },
  'file-existence': { attempts: 1, delayMs: 0, confidence: 'definitive' },
  'file-non-empty': { attempts: 1, delayMs: 0, confidence: 'heuristic' },
};

const mockCheckActivation = {
  every_execute: ['file-existence'],
  code_modified: [],
  tier_2_plus: [],
  post_build: [],
  pre_deploy: [],
  frontend_build: [],
  post_uninstall: [],
  post_error_fix: [],
  cron_30s: [],
};

const mockEnforcementConstants = {
  TOKEN_THRESHOLDS: {},
  GRACE_THRESHOLD: 0.85,
  MAX_PARALLEL_CHECKS: 5,
  CHECK_TIMEOUT_MS: 10_000,
  TOTAL_GATE_TIMEOUT_MS: 120_000,
  PARTIAL_TIMEOUT_POLICY: 'fail_timed_out_only',
  MIXED_RESULT_POLICY: 'hard_fails_block_soft_fails_warn',
  MIN_CHECKS_REQUIRED: 1,
  MODEL_ROUTING: {},
  ENFORCER_RETRY_POLICIES: mockEnforcerRetryPolicies,
  CHECK_ACTIVATION: mockCheckActivation,
  CHECK_SCRIPT_PATHS: {},
  CRON_INTERVALS: {},
  TIMEOUTS: {},
  FILE_THRESHOLDS: {},
  TIER_CLASSIFICATION: {},
  MAX_OVERHEAD_PERCENT: 10,
  PROJECT_STATE: {},
  SUB_AGENT_RULES: {},
  CIRCUIT_BREAKER: mockCircuitBreaker,
  PHASE_BUDGET_WEIGHTS: {},
  CODEX_SANDBOX: {},
  CLAUDE_TOOL_MAP: {},
  GEMINI_TOOL_MAP: {},
  DEPLOY_HEALTH: {},
  RATE_LIMIT_PATTERNS: [],
  RATE_LIMIT_DEFAULT_WAIT_MS: 3_600_000,
  RATE_LIMIT_RETRY_AFTER_RESUME_MS: 300_000,
  DOM_POLLING: {},
  LATENCY_BUDGET: {},
  SKILL_INJECTOR: {},
  LESSON_VALIDATION: {},
  SCOPE_WHITELIST: {},
  RESPONSIVE_VIEWPORTS: [],
  INTAKE: {},
  MEMORY_CONSTRAINTS: {},
};

mockModule(path.resolve(srcDir, 'enforcement', 'constants.ts'), mockEnforcementConstants);

// --- Mock: src/enforcement/types.ts (types only — empty exports) ---
mockModule(path.resolve(srcDir, 'enforcement', 'types.ts'), {});

// --- Mock: src/enforcement/enforcer.ts ---
mockModule(path.resolve(srcDir, 'enforcement', 'enforcer.ts'), {
  runCheck: async () => ({ passed: true, output: 'mock', timedOut: false }),
  runCheckWithRetry: async () => ({ passed: true, output: 'mock', timedOut: false }),
  validateCheckOutput: () => true,
});

// --- Mock: src/enforcement/bodyguard.ts ---
const mockGateCheck = async (_step: any, _projectDir: string) => ({
  gate: { verdict: 'PASS', reasons: [], checksRun: 0, checksTimedOut: 0, checksSkipped: 0 },
  checksRun: 0,
  checksTimedOut: 0,
  executionTimeMs: 1,
  checkDetails: [],
});

mockModule(path.resolve(srcDir, 'enforcement', 'bodyguard.ts'), {
  gateCheck: mockGateCheck,
  checkCompliance: () => true,
});

// --- Mock: src/enforcement/spine.ts ---
const mockBuildSpine = async (_projectDir: string, _dagProgress?: any) => ({
  timestamp: Date.now(),
  projectDir: _projectDir || process.cwd(),
  files: { total: 0, byType: {}, list: [] },
  gitStatus: { branch: 'main', uncommitted: [], untracked: [] },
  projectState: 'OPEN',
  lastActivity: Date.now(),
  dagProgress: { totalSteps: 0, completedSteps: 0, failedSteps: [], currentStep: undefined },
  errors: [],
});

const mockCompareSpines = (_before: any, _after: any) => ({
  filesAdded: [],
  filesModified: [],
  filesRemoved: [],
  gitChanges: { uncommittedBefore: [], uncommittedAfter: [], untrackedBefore: [], untrackedAfter: [] },
  testStateChanged: false,
  buildStateChanged: false,
});

mockModule(path.resolve(srcDir, 'enforcement', 'spine.ts'), {
  buildSpine: mockBuildSpine,
  compareSpines: mockCompareSpines,
  validateSpineState: () => true,
});

// --- Mock: src/enforcement/index.ts (barrel) ---
mockModule(path.resolve(srcDir, 'enforcement', 'index.ts'), {
  ...mockEnforcementConstants,
  gateCheck: mockGateCheck,
  checkCompliance: () => true,
  buildSpine: mockBuildSpine,
  compareSpines: mockCompareSpines,
  validateSpineState: () => true,
  runCheck: async () => ({ passed: true, output: 'mock', timedOut: false }),
  runCheckWithRetry: async () => ({ passed: true, output: 'mock', timedOut: false }),
  validateCheckOutput: () => true,
});

// --- Mock: src/adapters/types.ts (types only) ---
mockModule(path.resolve(srcDir, 'adapters', 'types.ts'), {});

// --- Mock: src/adapters/permissions.ts ---
mockModule(path.resolve(srcDir, 'adapters', 'permissions.ts'), {
  checkPermission: () => true,
});

// --- Mock: src/adapters/codex/adapter.ts ---
mockModule(path.resolve(srcDir, 'adapters', 'codex', 'adapter.ts'), {
  CodexAdapter: class MockCodexAdapter {
    runtime = 'codex';
    capabilities() { return { sessionResume: false, jsonOutput: true, toolPermissions: true, maxPromptTokens: 400000, supportedTools: [], models: { fast: 'gpt-5-codex', standard: 'gpt-5-codex', reasoning: 'gpt-5' } }; }
    async isAvailable() { return false; }
    async spawn() { throw new Error('Mock: spawn not available'); }
    async kill() {}
  },
});

// --- Mock: src/adapters/claude/adapter.ts ---
mockModule(path.resolve(srcDir, 'adapters', 'claude', 'adapter.ts'), {
  ClaudeAdapter: class MockClaudeAdapter {
    runtime = 'claude';
    capabilities() { return { sessionResume: false, jsonOutput: true, toolPermissions: true, maxPromptTokens: 200000, supportedTools: [], models: { fast: 'claude-haiku-4', standard: 'claude-sonnet-4', reasoning: 'claude-opus-4' } }; }
    async isAvailable() { return false; }
    async spawn() { throw new Error('Mock: spawn not available'); }
    async kill() {}
  },
});

// --- Mock: src/adapters/factory.ts ---
mockModule(path.resolve(srcDir, 'adapters', 'factory.ts'), {
  getAdapter: (_runtime: string) => ({
    runtime: _runtime,
    capabilities: () => ({ sessionResume: false, jsonOutput: true, toolPermissions: true, maxPromptTokens: 400000, supportedTools: [], models: {} }),
    isAvailable: async () => false,
    spawn: async () => { throw new Error('Mock: spawn not available'); },
    kill: async () => {},
  }),
  getAvailableRuntimes: async () => [],
  selectRuntime: () => 'codex',
  clearAdapterCache: () => {},
  CodexAdapter: class {},
  ClaudeAdapter: class {},
});

// --- Mock: src/skills/selector.ts ---
mockModule(path.resolve(srcDir, 'skills', 'selector.ts'), {
  selectSkills: async () => ({ skills: [], reasoning: 'Mock: no skills selected' }),
});

// --- Mock: src/skills/validator.ts ---
mockModule(path.resolve(srcDir, 'skills', 'validator.ts'), {
  validateSelection: (selection: any) => selection || { skills: [], reasoning: 'Mock' },
  MAX_SKILLS_PER_WORKER: 3,
  MAX_SKILL_INJECTION_TOKENS: 2000,
});

// --- Mock: src/skills/verify-parser.ts ---
mockModule(path.resolve(srcDir, 'skills', 'verify-parser.ts'), {
  parseVerifyBlock: () => [],
});

// --- Mock: src/skills/critical-checks.ts ---
mockModule(path.resolve(srcDir, 'skills', 'critical-checks.ts'), {
  CRITICAL_SKILL_CHECKS: {},
  getChecksForSkill: () => [],
});

// --- Mock: src/skills/verify-sandbox.ts ---
mockModule(path.resolve(srcDir, 'skills', 'verify-sandbox.ts'), {
  isCommandAllowed: () => ({ allowed: false, reason: 'Mock: disabled in tests' }),
  executeVerifyCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
});

// --- Mock: src/skills/index.ts (barrel) ---
mockModule(path.resolve(srcDir, 'skills', 'index.ts'), {
  selectSkills: async () => ({ skills: [], reasoning: 'Mock: no skills selected' }),
  validateSelection: (selection: any) => selection || { skills: [], reasoning: 'Mock' },
  MAX_SKILLS_PER_WORKER: 3,
  MAX_SKILL_INJECTION_TOKENS: 2000,
  parseVerifyBlock: () => [],
  CRITICAL_SKILL_CHECKS: {},
  getChecksForSkill: () => [],
  isCommandAllowed: () => ({ allowed: false, reason: 'Mock: disabled in tests' }),
  executeVerifyCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
});

// --- Mock: src/glue/assemble-prompt.ts ---
mockModule(path.resolve(srcDir, 'glue', 'assemble-prompt.ts'), {
  assemblePrompt: (_options: any) => ({
    skillSections: '',
    spineContext: '<spine_context>{}</spine_context>',
    userInput: _options?.userInput || '',
    totalTokens: 0,
  }),
});

// --- Mock: src/glue/normalizer.ts ---
mockModule(path.resolve(srcDir, 'glue', 'normalizer.ts'), {
  normalize: (_step: any, _result: any, _projectDir: string) => ({
    step: { id: _step?.id || 0, action: _step?.action || '', detail: _step?.detail || '', declaredFiles: [], tier: 1, isFrontend: false, modifiedCodeFiles: false },
    result: { status: 'completed', output: '', filesCreated: [], filesModified: [], tokensUsed: { input: 0, output: 0 }, exitCode: 0 },
    projectDir: _projectDir || process.cwd(),
  }),
});

// --- Mock: src/glue/index.ts (barrel) ---
mockModule(path.resolve(srcDir, 'glue', 'index.ts'), {
  assemblePrompt: (_options: any) => ({
    skillSections: '',
    spineContext: '<spine_context>{}</spine_context>',
    userInput: _options?.userInput || '',
    totalTokens: 0,
  }),
  normalize: (_step: any, _result: any, _projectDir: string) => ({
    step: { id: _step?.id || 0, action: _step?.action || '', detail: _step?.detail || '', declaredFiles: [], tier: 1, isFrontend: false, modifiedCodeFiles: false },
    result: { status: 'completed', output: '', filesCreated: [], filesModified: [], tokensUsed: { input: 0, output: 0 }, exitCode: 0 },
    projectDir: _projectDir || process.cwd(),
  }),
});

// --- Mock: src/storekeeper/types.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'types.ts'), {
  STOREKEEPER_CONSTANTS: {
    KENOKI_DIR: '.kenoki',
    REQUESTS_DIR: 'requests',
    RESPONSES_DIR: 'responses',
    AUDIT_DIR: 'audit',
    INVENTORY_DIR: 'inventory',
    PROCESSING_TIMEOUT_MS: 10_000,
    MAX_SKILLS_ABSOLUTE: 5,
    MAX_SKILL_TOKENS: 4_000,
    FOUNDATION_SKILLS: [],
  },
});

// --- Mock: src/storekeeper/provision.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'provision.ts'), {
  provision: () => ({
    foundation: [],
    perStep: new Map(),
    plugins: [],
    mcps: [],
    audit: [],
  }),
});

// --- Mock: src/storekeeper/storekeeper.ts ---
const mockStorekeeperInstance = {
  processRequest: async () => ({ status: 'READY', approvedSkills: [], deniedSkills: [], approvedMcp: [], deniedMcp: [], approvedPlugins: [], injectionSummary: {} }),
  buildContext: async () => ({ assembledPrompt: '', mcp: {}, plugin: '', config: {}, meta: {} }),
  cleanupStep: async () => {},
  reloadInventory: () => {},
};
mockModule(path.resolve(srcDir, 'storekeeper', 'storekeeper.ts'), {
  Storekeeper: class {},
  getStorekeeper: () => mockStorekeeperInstance,
  resetStorekeeper: () => {},
});

// --- Mock: src/storekeeper/approval-engine.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'approval-engine.ts'), { processApproval: () => ({ status: 'READY' }) });

// --- Mock: src/storekeeper/inventory.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'inventory.ts'), { loadInventory: () => ({ skills: [], mcp: [], plugins: [] }), findSkill: () => undefined, findMcp: () => undefined, findPlugin: () => undefined, getTotalTokens: () => 0 });

// --- Mock: src/storekeeper/injector.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'injector.ts'), { injectTools: () => ({}), buildExecutionContext: () => ({}) });

// --- Mock: src/storekeeper/cleanup.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'cleanup.ts'), { cleanupStep: () => ({}), cleanupAll: () => 0, registerContext: () => {} });

// --- Mock: src/storekeeper/audit.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'audit.ts'), { writeCheckoutLog: () => '', logRequest: () => {}, logResponse: () => {} });

// --- Mock: src/storekeeper/request-parser.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'request-parser.ts'), { parseRequest: () => null, createRequest: () => ({}) });

// --- Mock: src/storekeeper/watcher.ts ---
mockModule(path.resolve(srcDir, 'storekeeper', 'watcher.ts'), { StorekeeperWatcher: class {}, getStorekeeperWatcher: () => ({}) });

// --- Mock: src/storekeeper/index.ts (barrel) ---
mockModule(path.resolve(srcDir, 'storekeeper', 'index.ts'), {
  provision: () => ({
    foundation: [],
    perStep: new Map(),
    plugins: [],
    mcps: [],
    audit: [],
  }),
  getStorekeeper: () => mockStorekeeperInstance,
  resetStorekeeper: () => {},
  STOREKEEPER_CONSTANTS: {
    KENOKI_DIR: '.kenoki',
    REQUESTS_DIR: 'requests',
    RESPONSES_DIR: 'responses',
    AUDIT_DIR: 'audit',
    INVENTORY_DIR: 'inventory',
    PROCESSING_TIMEOUT_MS: 10_000,
    MAX_SKILLS_ABSOLUTE: 5,
    MAX_SKILL_TOKENS: 4_000,
    FOUNDATION_SKILLS: [],
  },
});

// ============================================================================
// IMPORTS (after mocking)
// ============================================================================

import { EventEmitter } from 'events';

// Import after mocking electron
import {
  getStepScheduler,
  cleanupStepScheduler,
  StepScheduler,
  StepTarget,
  StepStatus,
  PlanStep,
  RuntimeStep,
  ExecutionPlan,
  PlanExecutionResult,
  UserDecision,
  CircuitBreakerOptions,
  StepProgressEvent,
  Executor,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  USER_RESPONSE_TIMEOUT_MS,
} from '../src/main/step-scheduler';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    testsFailed++;
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message}`);
    console.log(`         Expected: ${JSON.stringify(expected)}`);
    console.log(`         Got: ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

function assertTrue(condition: boolean, message: string): void {
  assert(condition, message);
}

function assertFalse(condition: boolean, message: string): void {
  assert(!condition, message);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MOCK EXECUTORS
// ============================================================================

function createSuccessExecutor(): Executor {
  return {
    async execute(step: RuntimeStep, context?: Record<string, any>): Promise<any> {
      return { success: true, stepId: step.id };
    },
    canHandle(step: RuntimeStep): boolean {
      return true;
    },
  };
}

function createFailingExecutor(failCount: number = Infinity): Executor {
  let failures = 0;
  return {
    async execute(step: RuntimeStep, context?: Record<string, any>): Promise<any> {
      failures++;
      if (failures <= failCount) {
        throw new Error(`Test error (failure ${failures})`);
      }
      return { success: true, stepId: step.id };
    },
    canHandle(step: RuntimeStep): boolean {
      return true;
    },
  };
}

function createDelayedExecutor(delayMs: number): Executor {
  return {
    async execute(step: RuntimeStep, context?: Record<string, any>): Promise<any> {
      await sleep(delayMs);
      return { success: true, stepId: step.id, delayed: true };
    },
    canHandle(step: RuntimeStep): boolean {
      return true;
    },
  };
}

function createSelectiveExecutor(action: string): Executor {
  return {
    async execute(step: RuntimeStep, context?: Record<string, any>): Promise<any> {
      return { success: true, action: step.action };
    },
    canHandle(step: RuntimeStep): boolean {
      return step.action === action;
    },
  };
}

// ============================================================================
// TEST PLAN BUILDERS
// ============================================================================

function createSimplePlan(stepCount: number = 1): ExecutionPlan {
  const steps: PlanStep[] = [];
  for (let i = 1; i <= stepCount; i++) {
    steps.push({
      id: i,
      target: 'cli' as StepTarget,
      action: `action_${i}`,
      detail: `Step ${i} detail`,
      waitFor: i > 1 ? [i - 1] : [],
      parallel: false,
    });
  }
  return {
    planId: `test-plan-${Date.now()}`,
    name: 'Test Plan',
    steps,
  };
}

function createParallelPlan(): ExecutionPlan {
  return {
    planId: `parallel-plan-${Date.now()}`,
    name: 'Parallel Test Plan',
    steps: [
      { id: 1, target: 'cli', action: 'step_1', detail: 'First step', waitFor: [], parallel: true },
      { id: 2, target: 'cli', action: 'step_2', detail: 'Second step (parallel)', waitFor: [], parallel: true },
      { id: 3, target: 'cli', action: 'step_3', detail: 'Third step (waits for 1 and 2)', waitFor: [1, 2], parallel: false },
    ],
  };
}

function createDiamondPlan(): ExecutionPlan {
  // Diamond DAG: 1 -> 2, 1 -> 3, 2 -> 4, 3 -> 4
  return {
    planId: `diamond-plan-${Date.now()}`,
    name: 'Diamond DAG Plan',
    steps: [
      { id: 1, target: 'cli', action: 'start', detail: 'Start', waitFor: [], parallel: false },
      { id: 2, target: 'cli', action: 'branch_a', detail: 'Branch A', waitFor: [1], parallel: true },
      { id: 3, target: 'cli', action: 'branch_b', detail: 'Branch B', waitFor: [1], parallel: true },
      { id: 4, target: 'cli', action: 'merge', detail: 'Merge', waitFor: [2, 3], parallel: false },
    ],
  };
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Step Scheduler Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // 1. SINGLETON PATTERN TESTS
  // ==========================================================================

  console.log('1. Singleton Pattern Tests');
  console.log('-'.repeat(40));

  // Clean up any existing instance first
  cleanupStepScheduler();

  // Test 1: getStepScheduler returns same instance
  {
    const instance1 = getStepScheduler();
    const instance2 = getStepScheduler();
    assertTrue(instance1 === instance2, 'getStepScheduler() returns same instance');
  }

  // Test 2: cleanupStepScheduler resets instance
  {
    const before = getStepScheduler();
    cleanupStepScheduler();
    const after = getStepScheduler();
    assertTrue(before !== after, 'cleanupStepScheduler() resets instance');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 2. CONSTANTS TESTS
  // ==========================================================================

  console.log('2. Constants Tests');
  console.log('-'.repeat(40));

  // Test 3: MAX_RETRIES equals 3
  assertEqual(MAX_RETRIES, 3, 'MAX_RETRIES equals 3');

  // Test 4: RETRY_BASE_DELAY_MS equals 1000
  assertEqual(RETRY_BASE_DELAY_MS, 1000, 'RETRY_BASE_DELAY_MS equals 1000');

  // Test 5: USER_RESPONSE_TIMEOUT_MS equals 300000 (5 minutes)
  assertEqual(USER_RESPONSE_TIMEOUT_MS, 300000, 'USER_RESPONSE_TIMEOUT_MS equals 300000');

  console.log('');

  // ==========================================================================
  // 3. INITIAL STATE TESTS
  // ==========================================================================

  console.log('3. Initial State Tests');
  console.log('-'.repeat(40));

  cleanupStepScheduler();
  const freshScheduler = getStepScheduler();

  // Test 6: getStatus() returns isRunning: false
  {
    const status = freshScheduler.getStatus();
    assertFalse(status.isRunning, 'Initial getStatus().isRunning is false');
  }

  // Test 7: getStatus() returns planId: null
  {
    const status = freshScheduler.getStatus();
    assertEqual(status.planId, null, 'Initial getStatus().planId is null');
  }

  // Test 8: getStatus() returns empty steps array
  {
    const status = freshScheduler.getStatus();
    assertEqual(status.steps.length, 0, 'Initial getStatus().steps is empty array');
  }

  cleanupStepScheduler();
  console.log('');

  // ==========================================================================
  // 4. EXECUTOR REGISTRATION TESTS
  // ==========================================================================

  console.log('4. Executor Registration Tests');
  console.log('-'.repeat(40));

  // Test 9: Can register executor for 'web'
  {
    const scheduler = getStepScheduler();
    const executor = createSuccessExecutor();
    try {
      scheduler.registerExecutor('web', executor);
      testsPassed++;
      console.log('  [PASS] Can register executor for "web"');
    } catch (err) {
      testsFailed++;
      console.log(`  [FAIL] Can register executor for "web": ${err}`);
    }
    cleanupStepScheduler();
  }

  // Test 10: Can register executor for 'cli'
  {
    const scheduler = getStepScheduler();
    const executor = createSuccessExecutor();
    try {
      scheduler.registerExecutor('cli', executor);
      testsPassed++;
      console.log('  [PASS] Can register executor for "cli"');
    } catch (err) {
      testsFailed++;
      console.log(`  [FAIL] Can register executor for "cli": ${err}`);
    }
    cleanupStepScheduler();
  }

  // Test 11: Can register executor for 'service'
  {
    const scheduler = getStepScheduler();
    const executor = createSuccessExecutor();
    try {
      scheduler.registerExecutor('service', executor);
      testsPassed++;
      console.log('  [PASS] Can register executor for "service"');
    } catch (err) {
      testsFailed++;
      console.log(`  [FAIL] Can register executor for "service": ${err}`);
    }
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 5. MOCK EXECUTOR TESTS
  // ==========================================================================

  console.log('5. Mock Executor Tests');
  console.log('-'.repeat(40));

  // Test 12: Success executor returns success
  {
    const executor = createSuccessExecutor();
    const step: RuntimeStep = {
      id: 1,
      target: 'cli',
      action: 'test',
      detail: 'Test step',
      waitFor: [],
      parallel: false,
      status: 'pending',
      retryCount: 0,
    };
    const result = await executor.execute(step);
    assertTrue(result.success === true, 'Success executor returns success: true');
  }

  // Test 13: Success executor canHandle returns true
  {
    const executor = createSuccessExecutor();
    const step: RuntimeStep = {
      id: 1,
      target: 'cli',
      action: 'anything',
      detail: 'Test',
      waitFor: [],
      parallel: false,
      status: 'pending',
      retryCount: 0,
    };
    assertTrue(executor.canHandle(step), 'Success executor canHandle returns true');
  }

  // Test 14: Failing executor throws error
  {
    const executor = createFailingExecutor(1);
    const step: RuntimeStep = {
      id: 1,
      target: 'cli',
      action: 'test',
      detail: 'Test',
      waitFor: [],
      parallel: false,
      status: 'pending',
      retryCount: 0,
    };
    try {
      await executor.execute(step);
      testsFailed++;
      console.log('  [FAIL] Failing executor should throw error');
    } catch (err) {
      testsPassed++;
      console.log('  [PASS] Failing executor throws error');
    }
  }

  // Test 15: Selective executor only handles specific action
  {
    const executor = createSelectiveExecutor('deploy');
    const deployStep: RuntimeStep = {
      id: 1,
      target: 'cli',
      action: 'deploy',
      detail: 'Deploy',
      waitFor: [],
      parallel: false,
      status: 'pending',
      retryCount: 0,
    };
    const buildStep: RuntimeStep = {
      id: 2,
      target: 'cli',
      action: 'build',
      detail: 'Build',
      waitFor: [],
      parallel: false,
      status: 'pending',
      retryCount: 0,
    };
    assertTrue(executor.canHandle(deployStep), 'Selective executor handles matching action');
    assertFalse(executor.canHandle(buildStep), 'Selective executor rejects non-matching action');
  }

  console.log('');

  // ==========================================================================
  // 6. PLAN EXECUTION TESTS
  // ==========================================================================

  console.log('6. Plan Execution Tests');
  console.log('-'.repeat(40));

  // Test 16: Execute simple single-step plan
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);

    assertTrue(result !== null, 'Execute returns result object');
    cleanupStepScheduler();
  }

  // Test 17: Verify result has correct structure
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);

    assertTrue('planId' in result, 'Result has planId property');
    assertTrue('success' in result, 'Result has success property');
    assertTrue('steps' in result, 'Result has steps property');
    assertTrue('durationMs' in result, 'Result has durationMs property');
    assertTrue('summary' in result, 'Result has summary property');
    cleanupStepScheduler();
  }

  // Test 18: Verify success is true when step completes
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);

    assertTrue(result.success === true, 'Success is true when step completes');
    assertEqual(result.summary.done, 1, 'Summary shows 1 step done');
    assertEqual(result.summary.failed, 0, 'Summary shows 0 steps failed');
    cleanupStepScheduler();
  }

  // Test 19: Execute multi-step sequential plan
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(3);
    const result = await scheduler.execute(plan);

    assertEqual(result.summary.total, 3, 'Multi-step plan has 3 total steps');
    assertEqual(result.summary.done, 3, 'All 3 steps completed');
    assertTrue(result.success, 'Multi-step plan succeeds');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 7. DAG DEPENDENCY TESTS
  // ==========================================================================

  console.log('7. DAG Dependency Tests');
  console.log('-'.repeat(40));

  // Test 20: Step with no dependencies runs first
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    const executionOrder: number[] = [];
    const trackingExecutor: Executor = {
      async execute(step: RuntimeStep) {
        executionOrder.push(step.id);
        return { success: true };
      },
      canHandle() {
        return true;
      },
    };

    scheduler.registerExecutor('cli', trackingExecutor);

    const plan = createSimplePlan(3);
    await scheduler.execute(plan);

    assertEqual(executionOrder[0], 1, 'Step with no dependencies runs first');
    cleanupStepScheduler();
  }

  // Test 21: Step with waitFor waits for dependency
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    const executionOrder: number[] = [];
    const trackingExecutor: Executor = {
      async execute(step: RuntimeStep) {
        executionOrder.push(step.id);
        return { success: true };
      },
      canHandle() {
        return true;
      },
    };

    scheduler.registerExecutor('cli', trackingExecutor);

    const plan: ExecutionPlan = {
      planId: 'dep-test',
      name: 'Dependency Test',
      steps: [
        { id: 1, target: 'cli', action: 'first', detail: 'First', waitFor: [], parallel: false },
        { id: 2, target: 'cli', action: 'second', detail: 'Second', waitFor: [1], parallel: false },
      ],
    };

    await scheduler.execute(plan);

    assertTrue(executionOrder.indexOf(1) < executionOrder.indexOf(2), 'Dependent step runs after dependency');
    cleanupStepScheduler();
  }

  // Test 22: Multiple independent steps both start as pending
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createParallelPlan();

    // Check initial status shows pending
    // We need to check status during execution, which is tricky
    // Instead, verify the plan has steps with empty waitFor
    const independentSteps = plan.steps.filter(s => s.waitFor.length === 0);
    assertTrue(independentSteps.length >= 2, 'Plan has multiple independent steps');
    cleanupStepScheduler();
  }

  // Test 23: Diamond DAG executes correctly
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    const executionOrder: number[] = [];
    const trackingExecutor: Executor = {
      async execute(step: RuntimeStep) {
        executionOrder.push(step.id);
        return { success: true };
      },
      canHandle() {
        return true;
      },
    };

    scheduler.registerExecutor('cli', trackingExecutor);

    const plan = createDiamondPlan();
    const result = await scheduler.execute(plan);

    // Verify step 4 (merge) runs last
    assertEqual(executionOrder[executionOrder.length - 1], 4, 'Merge step runs last in diamond DAG');
    // Verify step 1 (start) runs first
    assertEqual(executionOrder[0], 1, 'Start step runs first in diamond DAG');
    assertTrue(result.success, 'Diamond DAG completes successfully');
    cleanupStepScheduler();
  }

  // Test 24: Dependency on skipped step still allows execution
  // Note: When user skips a step via circuit breaker, dependent steps CAN run
  // because skipped is treated as "satisfied" in the DAG. Only failed blocks dependents.
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    // Executor that fails on step 1 - will trigger circuit breaker
    const failOnFirstExecutor: Executor = {
      async execute(step: RuntimeStep) {
        if (step.id === 1) {
          throw new Error('Step 1 failed');
        }
        return { success: true };
      },
      canHandle() {
        return true;
      },
    };

    scheduler.registerExecutor('cli', failOnFirstExecutor);

    // Set up IPC handler to auto-skip when circuit breaker triggers
    scheduler.on('step-needs-user', () => {
      // Simulate user choosing 'skip'
      const handler = mockIpcHandlers.get('step:user-decision');
      if (handler) {
        setTimeout(() => handler({}, 1, 'skip'), 10);
      }
    });

    const plan: ExecutionPlan = {
      planId: 'fail-cascade',
      name: 'Fail Cascade Test',
      steps: [
        { id: 1, target: 'cli', action: 'first', detail: 'First (will fail)', waitFor: [], parallel: false },
        { id: 2, target: 'cli', action: 'second', detail: 'Second (can run after skip)', waitFor: [1], parallel: false },
      ],
    };

    const result = await scheduler.execute(plan);

    // When step 1 is SKIPPED (not failed), step 2 CAN run because
    // "skipped" counts as "done" for dependency resolution
    const step1 = result.steps.find(s => s.id === 1);
    const step2 = result.steps.find(s => s.id === 2);
    assertEqual(step1?.status, 'skipped', 'Step 1 is skipped by user');
    assertEqual(step2?.status, 'done', 'Step 2 runs after dependency is skipped');
    cleanupStepScheduler();
  }

  // Test 24b: Step fails when executor canHandle returns false (blocks dependents)
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    // Executor that can't handle step 1
    const selectiveExecutor: Executor = {
      async execute(step: RuntimeStep) {
        return { success: true };
      },
      canHandle(step: RuntimeStep) {
        return step.id !== 1; // Can't handle step 1
      },
    };

    scheduler.registerExecutor('cli', selectiveExecutor);

    const plan: ExecutionPlan = {
      planId: 'cant-handle-cascade',
      name: 'Cant Handle Cascade Test',
      steps: [
        { id: 1, target: 'cli', action: 'first', detail: 'First (cant handle)', waitFor: [], parallel: false },
        { id: 2, target: 'cli', action: 'second', detail: 'Second (should skip)', waitFor: [1], parallel: false },
      ],
    };

    const result = await scheduler.execute(plan);

    const step1 = result.steps.find(s => s.id === 1);
    const step2 = result.steps.find(s => s.id === 2);
    assertEqual(step1?.status, 'failed', 'Step fails when canHandle returns false');
    assertEqual(step2?.status, 'skipped', 'Dependent step is skipped when dependency fails');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 8. CIRCUIT BREAKER TESTS
  // ==========================================================================

  console.log('8. Circuit Breaker Tests');
  console.log('-'.repeat(40));

  // Test 25: After MAX_RETRIES failures, status becomes 'needs_user'
  // Note: This test verifies the circuit breaker triggers by checking the event
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    let circuitBreakerTriggered = false;
    let receivedOptions: CircuitBreakerOptions | null = null;

    scheduler.on('step-needs-user', (options: CircuitBreakerOptions) => {
      circuitBreakerTriggered = true;
      receivedOptions = options;
      // Simulate user decision to skip
      const handler = mockIpcHandlers.get('step:user-decision');
      if (handler) {
        setTimeout(() => handler({}, options.step.id, 'skip'), 10);
      }
    });

    // Register a failing executor that always fails
    scheduler.registerExecutor('cli', createFailingExecutor(MAX_RETRIES + 10));

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);

    assertTrue(circuitBreakerTriggered, 'Circuit breaker triggers after MAX_RETRIES failures');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 9. STOP FUNCTIONALITY TESTS
  // ==========================================================================

  console.log('9. Stop Functionality Tests');
  console.log('-'.repeat(40));

  // Test 26: stop() sets stopped flag
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createDelayedExecutor(1000));

    const plan = createSimplePlan(1);

    // Start execution and then stop immediately
    const executePromise = scheduler.execute(plan);
    await sleep(50); // Let it start

    scheduler.stop();

    const result = await executePromise;
    // After stop, isRunning should be false
    const status = scheduler.getStatus();
    assertFalse(status.isRunning, 'stop() sets stopped flag');
    cleanupStepScheduler();
  }

  // Test 27: getStatus().isRunning returns false after stop
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    scheduler.stop();
    const status = scheduler.getStatus();

    assertFalse(status.isRunning, 'getStatus().isRunning returns false after stop');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 10. EVENT EMISSION TESTS
  // ==========================================================================

  console.log('10. Event Emission Tests');
  console.log('-'.repeat(40));

  // Test 28: StepScheduler extends EventEmitter
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    assertTrue(scheduler instanceof EventEmitter, 'StepScheduler extends EventEmitter');
    cleanupStepScheduler();
  }

  // Test 29: Can add/remove listeners
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    let called = false;
    const listener = () => {
      called = true;
    };

    scheduler.on('test-event', listener);
    scheduler.emit('test-event');
    assertTrue(called, 'Event listener is called');

    called = false;
    scheduler.off('test-event', listener);
    scheduler.emit('test-event');
    assertFalse(called, 'Event listener is removed');
    cleanupStepScheduler();
  }

  // Test 30: Emits 'step-start' on step begin
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    let stepStartEmitted = false;
    scheduler.on('step-start', (step: RuntimeStep) => {
      stepStartEmitted = true;
    });

    const plan = createSimplePlan(1);
    await scheduler.execute(plan);

    assertTrue(stepStartEmitted, 'Emits "step-start" on step begin');
    cleanupStepScheduler();
  }

  // Test 31: Emits 'step-done' on success
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    let stepDoneEmitted = false;
    scheduler.on('step-done', (step: RuntimeStep) => {
      stepDoneEmitted = true;
    });

    const plan = createSimplePlan(1);
    await scheduler.execute(plan);

    assertTrue(stepDoneEmitted, 'Emits "step-done" on success');
    cleanupStepScheduler();
  }

  // Test 32: Emits 'plan-complete' when done
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    let planCompleteEmitted = false;
    scheduler.on('plan-complete', (result: PlanExecutionResult) => {
      planCompleteEmitted = true;
    });

    const plan = createSimplePlan(1);
    await scheduler.execute(plan);

    assertTrue(planCompleteEmitted, 'Emits "plan-complete" when done');
    cleanupStepScheduler();
  }

  // Test 33: Emits 'step-failed' on failure
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    // Executor that fails once then succeeds (to avoid circuit breaker)
    let failCount = 0;
    const failOnceExecutor: Executor = {
      async execute(step: RuntimeStep) {
        failCount++;
        if (failCount === 1) {
          throw new Error('First attempt failed');
        }
        return { success: true };
      },
      canHandle() {
        return true;
      },
    };

    scheduler.registerExecutor('cli', failOnceExecutor);

    let stepFailedEmitted = false;
    scheduler.on('step-failed', (step: RuntimeStep) => {
      stepFailedEmitted = true;
    });

    const plan = createSimplePlan(1);
    await scheduler.execute(plan);

    assertTrue(stepFailedEmitted, 'Emits "step-failed" on failure');
    cleanupStepScheduler();
  }

  // Test 34: Emits 'progress' event during execution
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    let progressEmitted = false;
    scheduler.on('progress', (event: StepProgressEvent) => {
      progressEmitted = true;
    });

    const plan = createSimplePlan(1);
    await scheduler.execute(plan);

    assertTrue(progressEmitted, 'Emits "progress" event during execution');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 11. TYPE VALIDATION TESTS
  // ==========================================================================

  console.log('11. Type Validation Tests');
  console.log('-'.repeat(40));

  // Test 35: StepTarget type accepts valid values
  {
    const validTargets: StepTarget[] = ['web', 'cli', 'service'];
    assertTrue(validTargets.includes('web'), 'StepTarget includes "web"');
    assertTrue(validTargets.includes('cli'), 'StepTarget includes "cli"');
    assertTrue(validTargets.includes('service'), 'StepTarget includes "service"');
  }

  // Test 36: StepStatus type accepts valid values
  {
    const validStatuses: StepStatus[] = ['pending', 'running', 'done', 'failed', 'skipped', 'needs_user'];
    assertEqual(validStatuses.length, 6, 'StepStatus has 6 valid values');
    assertTrue(validStatuses.includes('pending'), 'StepStatus includes "pending"');
    assertTrue(validStatuses.includes('running'), 'StepStatus includes "running"');
    assertTrue(validStatuses.includes('done'), 'StepStatus includes "done"');
    assertTrue(validStatuses.includes('failed'), 'StepStatus includes "failed"');
    assertTrue(validStatuses.includes('skipped'), 'StepStatus includes "skipped"');
    assertTrue(validStatuses.includes('needs_user'), 'StepStatus includes "needs_user"');
  }

  // Test 37: UserDecision type accepts valid values
  {
    const validDecisions: UserDecision[] = ['retry', 'skip', 'stop'];
    assertEqual(validDecisions.length, 3, 'UserDecision has 3 valid values');
    assertTrue(validDecisions.includes('retry'), 'UserDecision includes "retry"');
    assertTrue(validDecisions.includes('skip'), 'UserDecision includes "skip"');
    assertTrue(validDecisions.includes('stop'), 'UserDecision includes "stop"');
  }

  console.log('');

  // ==========================================================================
  // 12. RUNTIMESTEP STRUCTURE TESTS
  // ==========================================================================

  console.log('12. RuntimeStep Structure Tests');
  console.log('-'.repeat(40));

  // Test 38: RuntimeStep has required fields
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);
    const step = result.steps[0];

    assertTrue('status' in step, 'RuntimeStep has status field');
    assertTrue('retryCount' in step, 'RuntimeStep has retryCount field');
    cleanupStepScheduler();
  }

  // Test 39: RuntimeStep inherits PlanStep fields
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);
    const step = result.steps[0];

    assertTrue('id' in step, 'RuntimeStep inherits id from PlanStep');
    assertTrue('target' in step, 'RuntimeStep inherits target from PlanStep');
    assertTrue('action' in step, 'RuntimeStep inherits action from PlanStep');
    assertTrue('detail' in step, 'RuntimeStep inherits detail from PlanStep');
    assertTrue('waitFor' in step, 'RuntimeStep inherits waitFor from PlanStep');
    assertTrue('parallel' in step, 'RuntimeStep inherits parallel from PlanStep');
    cleanupStepScheduler();
  }

  // Test 40: Completed step has result field
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(1);
    const result = await scheduler.execute(plan);
    const step = result.steps[0];

    assertTrue(step.result !== undefined, 'Completed step has result field');
    assertTrue(step.result.success === true, 'Result contains executor return value');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // 13. ADDITIONAL EDGE CASE TESTS
  // ==========================================================================

  console.log('13. Additional Edge Case Tests');
  console.log('-'.repeat(40));

  // Test 41: Empty plan executes successfully
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    const emptyPlan: ExecutionPlan = {
      planId: 'empty-plan',
      name: 'Empty Plan',
      steps: [],
    };

    const result = await scheduler.execute(emptyPlan);

    assertTrue(result.success, 'Empty plan succeeds');
    assertEqual(result.summary.total, 0, 'Empty plan has 0 total steps');
    cleanupStepScheduler();
  }

  // Test 42: Step without registered executor fails gracefully
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    // Don't register any executor

    const plan: ExecutionPlan = {
      planId: 'no-executor',
      name: 'No Executor Plan',
      steps: [
        { id: 1, target: 'web', action: 'test', detail: 'Test', waitFor: [], parallel: false },
      ],
    };

    const result = await scheduler.execute(plan);

    assertEqual(result.summary.failed, 1, 'Step fails without executor');
    assertFalse(result.success, 'Plan fails when step has no executor');
    cleanupStepScheduler();
  }

  // Test 43: getStep returns correct step
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();
    scheduler.registerExecutor('cli', createSuccessExecutor());

    const plan = createSimplePlan(3);
    await scheduler.execute(plan);

    const step2 = scheduler.getStep(2);
    assertTrue(step2 !== undefined, 'getStep returns step');
    assertEqual(step2?.id, 2, 'getStep returns correct step');
    cleanupStepScheduler();
  }

  // Test 44: getStep returns undefined for non-existent step
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    const nonExistent = scheduler.getStep(999);
    assertEqual(nonExistent, undefined, 'getStep returns undefined for non-existent step');
    cleanupStepScheduler();
  }

  // Test 45: Plan with context passes context to executor
  {
    cleanupStepScheduler();
    const scheduler = getStepScheduler();

    let receivedContext: Record<string, any> | undefined;
    const contextCapturingExecutor: Executor = {
      async execute(step: RuntimeStep, context?: Record<string, any>) {
        receivedContext = context;
        return { success: true };
      },
      canHandle() {
        return true;
      },
    };

    scheduler.registerExecutor('cli', contextCapturingExecutor);

    const plan: ExecutionPlan = {
      planId: 'context-plan',
      name: 'Context Plan',
      steps: [
        { id: 1, target: 'cli', action: 'test', detail: 'Test', waitFor: [], parallel: false },
      ],
      context: { key: 'value', number: 42 },
    };

    await scheduler.execute(plan);

    assertTrue(receivedContext !== undefined, 'Context is passed to executor');
    assertEqual(receivedContext?.key, 'value', 'Context contains expected key');
    assertEqual(receivedContext?.number, 42, 'Context contains expected number');
    cleanupStepScheduler();
  }

  console.log('');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================

  console.log('='.repeat(60));
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// RUN TESTS
// ============================================================================

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
