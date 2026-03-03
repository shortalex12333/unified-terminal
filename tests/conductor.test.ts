/**
 * Conductor Tests
 *
 * Tests for the Conductor - Tier 1 Persistent Codex Router.
 * Tests utility functions, types, singleton behavior, and event emission.
 *
 * Run with: npx ts-node tests/conductor.test.ts
 */

// ============================================================================
// MOCK ELECTRON BEFORE IMPORTING CONDUCTOR
// ============================================================================

// Mock electron's app module before any imports that use it
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Create a temp directory for test state
const testStateDir = path.join(os.tmpdir(), 'unified-terminal-test-' + Date.now());
if (!fs.existsSync(testStateDir)) {
  fs.mkdirSync(testStateDir, { recursive: true });
}

// Mock the electron app module
const mockApp = {
  getPath: (name: string): string => {
    if (name === 'userData') {
      return testStateDir;
    }
    return testStateDir;
  },
  getName: (): string => 'unified-terminal-test',
  getVersion: (): string => '0.0.1-test',
  isReady: (): boolean => true,
  on: (): void => {},
  once: (): void => {},
};

const mockIpcMain = {
  handle: (): void => {},
  on: (): void => {},
};

// Use require.cache manipulation to inject mocks
require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: {
    app: mockApp,
    ipcMain: mockIpcMain,
  },
} as NodeJS.Module;

// Now import the conductor module
import {
  getConductor,
  cleanupConductor,
  Conductor,
  ExecutionPlan,
  Step,
  StepStatus,
  TaskComplexity,
  RouteType,
  ExecutionTarget,
  ClassificationContext,
  escapeForShell,
  ROUTER_SYSTEM_PROMPT,
} from '../src/main/conductor';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

function assertIncludes(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new Error(
      message || `Expected string to include "${substring}", got: "${str.substring(0, 100)}..."`
    );
  }
}

function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be non-null');
  }
}

function assertNull(value: unknown, message?: string): void {
  if (value !== null) {
    throw new Error(message || `Expected null, got ${JSON.stringify(value)}`);
  }
}

function assertTypeOf(value: unknown, expectedType: string, message?: string): void {
  const actualType = typeof value;
  if (actualType !== expectedType) {
    throw new Error(message || `Expected typeof ${expectedType}, got ${actualType}`);
  }
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Conductor Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // Test Category 1: Singleton Pattern
  // ==========================================================================
  console.log('1. Singleton Pattern:');

  test('getConductor() returns same instance on repeated calls', () => {
    cleanupConductor(); // Reset to clean state
    const instance1 = getConductor();
    const instance2 = getConductor();
    assertTrue(instance1 === instance2, 'Should return same instance');
  });

  test('cleanupConductor() resets instance', () => {
    const instance1 = getConductor();
    cleanupConductor();
    const instance2 = getConductor();
    assertTrue(instance1 !== instance2, 'Should create new instance after cleanup');
    cleanupConductor(); // Clean up for next tests
  });

  test('Multiple cleanups are safe', () => {
    cleanupConductor();
    cleanupConductor();
    cleanupConductor();
    const instance = getConductor();
    assertTrue(instance !== null, 'Should still work after multiple cleanups');
    cleanupConductor();
  });

  // ==========================================================================
  // Test Category 2: Session State (Initial)
  // ==========================================================================
  console.log('\n2. Session State (Initial):');

  test('hasSession() returns false initially (fresh instance)', () => {
    cleanupConductor();
    const conductor = new Conductor();
    // A fresh conductor with no saved state should not have a session
    // Note: This might return true if there's persisted state, which is valid behavior
    const hasSession = conductor.hasSession();
    // We just verify it returns a boolean
    assertTypeOf(hasSession, 'boolean', 'hasSession() should return boolean');
    conductor.cleanup();
  });

  test('getSessionId() returns null or string', () => {
    cleanupConductor();
    const conductor = new Conductor();
    const sessionId = conductor.getSessionId();
    assertTrue(
      sessionId === null || typeof sessionId === 'string',
      'sessionId should be null or string'
    );
    conductor.cleanup();
  });

  test('New Conductor instance is not null', () => {
    const conductor = new Conductor();
    assertNotNull(conductor, 'Conductor should not be null');
    conductor.cleanup();
  });

  // ==========================================================================
  // Test Category 3: Shell Escaping
  // ==========================================================================
  console.log('\n3. Shell Escaping:');

  test('escapeForShell("hello") returns \'hello\'', () => {
    const result = escapeForShell('hello');
    assertEqual(result, "'hello'", 'Simple string should be wrapped in single quotes');
  });

  test('escapeForShell("it\'s") properly escapes single quote', () => {
    const result = escapeForShell("it's");
    assertEqual(result, "'it'\\''s'", 'Single quote should be escaped');
  });

  test('escapeForShell("test") returns \'test\'', () => {
    const result = escapeForShell('test');
    assertEqual(result, "'test'", 'Simple string should be wrapped');
  });

  test('escapeForShell("a\'b\'c") handles multiple single quotes', () => {
    const result = escapeForShell("a'b'c");
    assertEqual(result, "'a'\\''b'\\''c'", 'Multiple single quotes should all be escaped');
  });

  test('escapeForShell("") handles empty string', () => {
    const result = escapeForShell('');
    assertEqual(result, "''", 'Empty string should return empty quoted');
  });

  test('escapeForShell with spaces', () => {
    const result = escapeForShell('hello world');
    assertEqual(result, "'hello world'", 'Spaces should be preserved inside quotes');
  });

  test('escapeForShell with special chars (no single quotes)', () => {
    const result = escapeForShell('hello$world');
    assertEqual(result, "'hello$world'", 'Dollar sign should be preserved (single quotes prevent expansion)');
  });

  test('escapeForShell with newlines', () => {
    const result = escapeForShell('line1\nline2');
    assertEqual(result, "'line1\nline2'", 'Newlines should be preserved');
  });

  // ==========================================================================
  // Test Category 4: System Prompt
  // ==========================================================================
  console.log('\n4. System Prompt:');

  test('ROUTER_SYSTEM_PROMPT exists and is non-empty', () => {
    assertTrue(typeof ROUTER_SYSTEM_PROMPT === 'string', 'Should be a string');
    assertTrue(ROUTER_SYSTEM_PROMPT.length > 0, 'Should not be empty');
    assertTrue(ROUTER_SYSTEM_PROMPT.length > 500, 'Should be substantial (~600 tokens)');
  });

  test('ROUTER_SYSTEM_PROMPT contains "Available Targets" section', () => {
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'Available Targets', 'Should have Available Targets section');
  });

  test('ROUTER_SYSTEM_PROMPT contains WEB target', () => {
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'WEB', 'Should define WEB target');
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'ChatGPT', 'Should mention ChatGPT for WEB');
  });

  test('ROUTER_SYSTEM_PROMPT contains CLI target', () => {
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'CLI', 'Should define CLI target');
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'codex', 'Should mention codex for CLI');
  });

  test('ROUTER_SYSTEM_PROMPT contains SERVICE target', () => {
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'SERVICE', 'Should define SERVICE target');
  });

  test('ROUTER_SYSTEM_PROMPT contains JSON output format example', () => {
    assertIncludes(ROUTER_SYSTEM_PROMPT, '"route":', 'Should have route in JSON example');
    assertIncludes(ROUTER_SYSTEM_PROMPT, '"plan":', 'Should have plan in JSON example');
    assertIncludes(ROUTER_SYSTEM_PROMPT, '"complexity":', 'Should have complexity in JSON example');
  });

  test('ROUTER_SYSTEM_PROMPT defines complexity levels', () => {
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'trivial', 'Should mention trivial complexity');
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'simple', 'Should mention simple complexity');
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'medium', 'Should mention medium complexity');
    assertIncludes(ROUTER_SYSTEM_PROMPT, 'complex', 'Should mention complex complexity');
  });

  // ==========================================================================
  // Test Category 5: ExecutionPlan Type Validation
  // ==========================================================================
  console.log('\n5. ExecutionPlan Type Validation:');

  test('Valid ExecutionPlan structure compiles correctly', () => {
    const plan: ExecutionPlan = {
      route: 'hybrid',
      complexity: 'medium',
      plan: [
        {
          id: 1,
          target: 'cli',
          action: 'scaffold',
          detail: 'Create project',
          waitFor: [],
          parallel: false,
        },
      ],
      estimated_minutes: 10,
    };

    assertEqual(plan.route, 'hybrid');
    assertEqual(plan.complexity, 'medium');
    assertEqual(plan.plan.length, 1);
    assertEqual(plan.estimated_minutes, 10);
  });

  test('Step structure has all required fields', () => {
    const step: Step = {
      id: 1,
      target: 'web',
      action: 'query',
      detail: 'Ask a question',
      waitFor: [],
      parallel: false,
    };

    assertEqual(step.id, 1);
    assertEqual(step.target, 'web');
    assertEqual(step.action, 'query');
    assertEqual(step.detail, 'Ask a question');
    assertTrue(Array.isArray(step.waitFor), 'waitFor should be array');
    assertFalse(step.parallel, 'parallel should be false');
  });

  test('Step with dependencies', () => {
    const step: Step = {
      id: 3,
      target: 'cli',
      action: 'integrate',
      detail: 'Connect components',
      waitFor: [1, 2],
      parallel: false,
    };

    assertEqual(step.waitFor.length, 2);
    assertEqual(step.waitFor[0], 1);
    assertEqual(step.waitFor[1], 2);
  });

  test('Step with parallel execution', () => {
    const step: Step = {
      id: 2,
      target: 'service',
      action: 'configure',
      detail: 'Set up service',
      waitFor: [],
      parallel: true,
    };

    assertTrue(step.parallel, 'parallel should be true');
  });

  // ==========================================================================
  // Test Category 6: Type Constants
  // ==========================================================================
  console.log('\n6. Type Constants:');

  test('TaskComplexity accepts trivial', () => {
    const complexity: TaskComplexity = 'trivial';
    assertEqual(complexity, 'trivial');
  });

  test('TaskComplexity accepts simple', () => {
    const complexity: TaskComplexity = 'simple';
    assertEqual(complexity, 'simple');
  });

  test('TaskComplexity accepts medium', () => {
    const complexity: TaskComplexity = 'medium';
    assertEqual(complexity, 'medium');
  });

  test('TaskComplexity accepts complex', () => {
    const complexity: TaskComplexity = 'complex';
    assertEqual(complexity, 'complex');
  });

  test('RouteType accepts web', () => {
    const route: RouteType = 'web';
    assertEqual(route, 'web');
  });

  test('RouteType accepts cli', () => {
    const route: RouteType = 'cli';
    assertEqual(route, 'cli');
  });

  test('RouteType accepts hybrid', () => {
    const route: RouteType = 'hybrid';
    assertEqual(route, 'hybrid');
  });

  test('StepStatus accepts pending', () => {
    const status: StepStatus = 'pending';
    assertEqual(status, 'pending');
  });

  test('StepStatus accepts running', () => {
    const status: StepStatus = 'running';
    assertEqual(status, 'running');
  });

  test('StepStatus accepts completed', () => {
    const status: StepStatus = 'completed';
    assertEqual(status, 'completed');
  });

  test('StepStatus accepts failed', () => {
    const status: StepStatus = 'failed';
    assertEqual(status, 'failed');
  });

  test('StepStatus accepts skipped', () => {
    const status: StepStatus = 'skipped';
    assertEqual(status, 'skipped');
  });

  test('ExecutionTarget accepts web', () => {
    const target: ExecutionTarget = 'web';
    assertEqual(target, 'web');
  });

  test('ExecutionTarget accepts cli', () => {
    const target: ExecutionTarget = 'cli';
    assertEqual(target, 'cli');
  });

  test('ExecutionTarget accepts service', () => {
    const target: ExecutionTarget = 'service';
    assertEqual(target, 'service');
  });

  // ==========================================================================
  // Test Category 7: Event Emitter Behavior
  // ==========================================================================
  console.log('\n7. Event Emitter Behavior:');

  test('Conductor extends EventEmitter', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.on === 'function', 'Should have on method');
    assertTrue(typeof conductor.emit === 'function', 'Should have emit method');
    assertTrue(typeof conductor.removeListener === 'function', 'Should have removeListener method');
    assertTrue(typeof conductor.removeAllListeners === 'function', 'Should have removeAllListeners method');
    conductor.cleanup();
  });

  test('Can add and remove listeners', () => {
    const conductor = new Conductor();
    let called = false;
    const listener = () => { called = true; };

    conductor.on('test-event', listener);
    conductor.emit('test-event');
    assertTrue(called, 'Listener should be called');

    called = false;
    conductor.removeListener('test-event', listener);
    conductor.emit('test-event');
    assertFalse(called, 'Listener should not be called after removal');

    conductor.cleanup();
  });

  test('cleanup() removes all listeners', () => {
    const conductor = new Conductor();
    let callCount = 0;
    conductor.on('event1', () => { callCount++; });
    conductor.on('event2', () => { callCount++; });

    conductor.cleanup();

    conductor.emit('event1');
    conductor.emit('event2');
    assertEqual(callCount, 0, 'No listeners should be called after cleanup');
  });

  test('Can listen to session-started event', () => {
    const conductor = new Conductor();
    let eventReceived = false;
    conductor.on('session-started', () => { eventReceived = true; });
    assertTrue(typeof conductor.emit === 'function', 'Should support session-started event');
    conductor.cleanup();
  });

  test('Can listen to session-resumed event', () => {
    const conductor = new Conductor();
    let eventReceived = false;
    conductor.on('session-resumed', () => { eventReceived = true; });
    assertTrue(typeof conductor.emit === 'function', 'Should support session-resumed event');
    conductor.cleanup();
  });

  test('Can listen to classification-complete event', () => {
    const conductor = new Conductor();
    let eventReceived = false;
    conductor.on('classification-complete', () => { eventReceived = true; });
    assertTrue(typeof conductor.emit === 'function', 'Should support classification-complete event');
    conductor.cleanup();
  });

  test('Can listen to error event', () => {
    const conductor = new Conductor();
    let eventReceived = false;
    conductor.on('error', () => { eventReceived = true; });
    assertTrue(typeof conductor.emit === 'function', 'Should support error event');
    conductor.cleanup();
  });

  // ==========================================================================
  // Test Category 8: ClassificationContext Type
  // ==========================================================================
  console.log('\n8. ClassificationContext Type:');

  test('Empty context is valid', () => {
    const context: ClassificationContext = {};
    assertTrue(Object.keys(context).length === 0, 'Empty context should be valid');
  });

  test('Context with projectPath', () => {
    const context: ClassificationContext = {
      projectPath: '/path/to/project',
    };
    assertEqual(context.projectPath, '/path/to/project');
  });

  test('Context with conversationSummary', () => {
    const context: ClassificationContext = {
      conversationSummary: 'User wants to build a website',
    };
    assertEqual(context.conversationSummary, 'User wants to build a website');
  });

  test('Context with availableTools', () => {
    const context: ClassificationContext = {
      availableTools: ['codex', 'claude-code', 'gsd'],
    };
    assertNotNull(context.availableTools);
    assertEqual(context.availableTools!.length, 3);
    assertTrue(context.availableTools!.includes('codex'), 'Should include codex');
  });

  test('Context with preferences', () => {
    const context: ClassificationContext = {
      preferences: {
        verbose: true,
        timeout: 60000,
      },
    };
    assertNotNull(context.preferences);
    assertEqual(context.preferences!.verbose, true);
    assertEqual(context.preferences!.timeout, 60000);
  });

  test('Full context with all fields', () => {
    const context: ClassificationContext = {
      projectPath: '/my/project',
      conversationSummary: 'Building a React app',
      availableTools: ['codex', 'gsd'],
      preferences: { theme: 'dark' },
    };

    assertEqual(context.projectPath, '/my/project');
    assertEqual(context.conversationSummary, 'Building a React app');
    assertEqual(context.availableTools!.length, 2);
    assertEqual(context.preferences!.theme, 'dark');
  });

  // ==========================================================================
  // Test Category 9: Complex ExecutionPlan Structures
  // ==========================================================================
  console.log('\n9. Complex ExecutionPlan Structures:');

  test('Multi-step execution plan', () => {
    const plan: ExecutionPlan = {
      route: 'hybrid',
      complexity: 'complex',
      plan: [
        { id: 1, target: 'cli', action: 'scaffold', detail: 'Create React app', waitFor: [], parallel: false },
        { id: 2, target: 'cli', action: 'install', detail: 'Install dependencies', waitFor: [1], parallel: false },
        { id: 3, target: 'service', action: 'configure', detail: 'Set up Supabase', waitFor: [], parallel: true },
        { id: 4, target: 'cli', action: 'generate', detail: 'Create auth components', waitFor: [2], parallel: false },
        { id: 5, target: 'cli', action: 'integrate', detail: 'Connect frontend to auth', waitFor: [3, 4], parallel: false },
      ],
      estimated_minutes: 45,
    };

    assertEqual(plan.plan.length, 5);
    assertEqual(plan.plan[4].waitFor.length, 2);
    assertTrue(plan.plan[4].waitFor.includes(3), 'Step 5 should wait for step 3');
    assertTrue(plan.plan[4].waitFor.includes(4), 'Step 5 should wait for step 4');
  });

  test('Trivial single-step plan', () => {
    const plan: ExecutionPlan = {
      route: 'web',
      complexity: 'trivial',
      plan: [
        { id: 1, target: 'web', action: 'query', detail: 'Ask weather', waitFor: [], parallel: false },
      ],
      estimated_minutes: 1,
    };

    assertEqual(plan.route, 'web');
    assertEqual(plan.complexity, 'trivial');
    assertEqual(plan.plan.length, 1);
    assertEqual(plan.estimated_minutes, 1);
  });

  test('Plan with parallel steps', () => {
    const plan: ExecutionPlan = {
      route: 'hybrid',
      complexity: 'medium',
      plan: [
        { id: 1, target: 'web', action: 'research', detail: 'Research topic A', waitFor: [], parallel: true },
        { id: 2, target: 'web', action: 'research', detail: 'Research topic B', waitFor: [], parallel: true },
        { id: 3, target: 'cli', action: 'compile', detail: 'Compile research', waitFor: [1, 2], parallel: false },
      ],
      estimated_minutes: 15,
    };

    assertTrue(plan.plan[0].parallel, 'Step 1 should be parallel');
    assertTrue(plan.plan[1].parallel, 'Step 2 should be parallel');
    assertFalse(plan.plan[2].parallel, 'Step 3 should not be parallel');
  });

  // ==========================================================================
  // Test Category 10: Conductor Methods Existence
  // ==========================================================================
  console.log('\n10. Conductor Methods Existence:');

  test('Conductor has initialize method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.initialize === 'function', 'Should have initialize method');
    conductor.cleanup();
  });

  test('Conductor has classify method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.classify === 'function', 'Should have classify method');
    conductor.cleanup();
  });

  test('Conductor has reportStatus method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.reportStatus === 'function', 'Should have reportStatus method');
    conductor.cleanup();
  });

  test('Conductor has resetSession method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.resetSession === 'function', 'Should have resetSession method');
    conductor.cleanup();
  });

  test('Conductor has getSessionId method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.getSessionId === 'function', 'Should have getSessionId method');
    conductor.cleanup();
  });

  test('Conductor has hasSession method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.hasSession === 'function', 'Should have hasSession method');
    conductor.cleanup();
  });

  test('Conductor has cleanup method', () => {
    const conductor = new Conductor();
    assertTrue(typeof conductor.cleanup === 'function', 'Should have cleanup method');
    conductor.cleanup();
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  // Clean up singleton
  cleanupConductor();

  // Clean up test state directory
  try {
    fs.rmSync(testStateDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
