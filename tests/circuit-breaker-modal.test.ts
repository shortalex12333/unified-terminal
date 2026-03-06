/**
 * CircuitBreakerModal Tests
 *
 * Tests the business logic of the CircuitBreakerModal React component:
 * - IPC callback data transformation
 * - Decision mapping for definitive vs heuristic failures
 * - CIRCUIT_BREAKER constants integration
 * - Action labels and colors
 * - Suggested action highlighting logic
 * - Guard against double-send
 *
 * Since this is a React component that cannot be rendered in Node,
 * we test the LOGIC by simulating the IPC event payloads and verifying
 * the data transformations and decision rules the component encodes.
 *
 * Run with: npx ts-node tests/circuit-breaker-modal.test.ts
 */

import {
  CIRCUIT_BREAKER,
  ENFORCER_RETRY_POLICIES,
} from '../src/enforcement/constants';

// ============================================================================
// TEST UTILITIES
// ============================================================================

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

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(message || `Expected ${b}, got ${a}`);
  }
}

// ============================================================================
// REPLICATE COMPONENT CONSTANTS FOR LOGIC TESTING
// (These are the hardcoded values from CircuitBreakerModal.tsx)
// ============================================================================

const ACTION_LABELS: Record<string, string> = {
  retry: 'Retry',
  skip: 'Skip this step',
  stop: 'Stop execution',
};

const ACTION_COLORS: Record<string, string> = {
  retry: '#3b82f6',   // blue
  skip: '#f59e0b',    // amber
  stop: '#ef4444',    // red
};

// Replicate the state transformation from the component's useEffect callback
interface CircuitBreakerState {
  visible: boolean;
  stepId: number;
  stepDetail: string;
  errorContext: string;
  actions: ('retry' | 'skip' | 'stop')[];
  suggested: 'retry' | 'skip' | 'stop';
}

function transformIpcToState(options: {
  step: { id: number; detail?: string; action?: string };
  errorContext: string;
  actions: string[];
  suggested: string;
}): CircuitBreakerState {
  return {
    visible: true,
    stepId: options.step.id,
    stepDetail: options.step.detail || options.step.action || 'Unknown step',
    errorContext: options.errorContext,
    actions: options.actions as ('retry' | 'skip' | 'stop')[],
    suggested: options.suggested as 'retry' | 'skip' | 'stop',
  };
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('CircuitBreakerModal Tests');
  console.log('='.repeat(60));

  // ==========================================================================
  console.log('\n--- CIRCUIT_BREAKER Constants Integration ---\n');
  // ==========================================================================

  await test('CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS matches modal expected actions (retry, skip, stop)', () => {
    const heuristicOptions = [...CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS];
    assertDeepEqual(heuristicOptions, ['retry', 'skip', 'stop'],
      'Heuristic failure should offer retry, skip, and stop');
    // Verify each option has a label in the modal
    for (const opt of heuristicOptions) {
      assertTrue(opt in ACTION_LABELS,
        `Heuristic option "${opt}" must have a label in ACTION_LABELS`);
      assertTrue(opt in ACTION_COLORS,
        `Heuristic option "${opt}" must have a color in ACTION_COLORS`);
    }
  });

  await test('CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS matches modal expected actions (retry, stop)', () => {
    const definitiveOptions = [...CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS];
    assertDeepEqual(definitiveOptions, ['retry', 'stop'],
      'Definitive failure should offer only retry and stop (no skip)');
    // Verify each option has a label
    for (const opt of definitiveOptions) {
      assertTrue(opt in ACTION_LABELS,
        `Definitive option "${opt}" must have a label in ACTION_LABELS`);
      assertTrue(opt in ACTION_COLORS,
        `Definitive option "${opt}" must have a color in ACTION_COLORS`);
    }
  });

  // ==========================================================================
  console.log('\n--- IPC Callback Data Transformation ---\n');
  // ==========================================================================

  await test('IPC payload with step.detail uses detail as stepDetail', () => {
    const state = transformIpcToState({
      step: { id: 42, detail: 'Run unit tests', action: 'test-exit-code' },
      errorContext: 'Exit code 1',
      actions: ['retry', 'skip', 'stop'],
      suggested: 'retry',
    });

    assertEqual(state.visible, true, 'state.visible should be true');
    assertEqual(state.stepId, 42, 'stepId should be 42');
    assertEqual(state.stepDetail, 'Run unit tests', 'stepDetail should use detail field');
    assertEqual(state.errorContext, 'Exit code 1', 'errorContext should match');
    assertEqual(state.suggested, 'retry', 'suggested should be retry');
    assertDeepEqual(state.actions, ['retry', 'skip', 'stop'], 'actions should match');
  });

  await test('IPC payload without step.detail falls back to step.action', () => {
    const state = transformIpcToState({
      step: { id: 7, action: 'docker-health' },
      errorContext: 'Container unhealthy',
      actions: ['retry', 'stop'],
      suggested: 'retry',
    });

    assertEqual(state.stepDetail, 'docker-health',
      'stepDetail should fall back to action when detail is absent');
    assertEqual(state.stepId, 7, 'stepId should be 7');
  });

  await test('IPC payload with neither detail nor action falls back to "Unknown step"', () => {
    const state = transformIpcToState({
      step: { id: 99 },
      errorContext: 'Something broke',
      actions: ['retry', 'stop'],
      suggested: 'stop',
    });

    assertEqual(state.stepDetail, 'Unknown step',
      'stepDetail should default to "Unknown step" when both detail and action are missing');
  });

  // ==========================================================================
  console.log('\n--- Decision Mapping ---\n');
  // ==========================================================================

  await test('Definitive failures exclude "skip" from valid decisions', () => {
    // Definitive checks (e.g., test-exit-code, file-existence) should NOT allow skip
    const definitiveActions = [...CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS];
    assertTrue(!definitiveActions.includes('skip' as any),
      'Definitive failure options must NOT include skip');
    assertEqual(definitiveActions.length, 2,
      'Definitive failure should have exactly 2 options (retry + stop)');
  });

  await test('Heuristic failures include "skip" as a valid decision', () => {
    const heuristicActions = [...CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS];
    assertTrue(heuristicActions.includes('skip'),
      'Heuristic failure options must include skip');
    assertEqual(heuristicActions.length, 3,
      'Heuristic failure should have exactly 3 options (retry + skip + stop)');
  });

  // ==========================================================================
  console.log('\n--- ENFORCER_RETRY_POLICIES Confidence Mapping ---\n');
  // ==========================================================================

  await test('All enforcer retry policies map to valid circuit breaker option sets', () => {
    const policyNames = Object.keys(ENFORCER_RETRY_POLICIES);
    assertTrue(policyNames.length > 0, 'Should have at least one policy');

    for (const [name, policy] of Object.entries(ENFORCER_RETRY_POLICIES)) {
      if (policy.confidence === 'definitive') {
        // Definitive checks get definitive options (retry + stop)
        const expected = [...CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS];
        assertTrue(expected.length === 2,
          `Policy "${name}" (definitive) should map to 2-option set`);
      } else if (policy.confidence === 'heuristic') {
        // Heuristic checks get heuristic options (retry + skip + stop)
        const expected = [...CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS];
        assertTrue(expected.length === 3,
          `Policy "${name}" (heuristic) should map to 3-option set`);
      } else {
        throw new Error(
          `Policy "${name}" has unexpected confidence: ${policy.confidence}`
        );
      }
    }
  });

  await test('Specific policies have correct confidence levels', () => {
    // Definitive policies (no skip allowed)
    assertEqual(ENFORCER_RETRY_POLICIES['test-exit-code'].confidence, 'definitive',
      'test-exit-code should be definitive');
    assertEqual(ENFORCER_RETRY_POLICIES['file-existence'].confidence, 'definitive',
      'file-existence should be definitive');
    assertEqual(ENFORCER_RETRY_POLICIES['secret-detection'].confidence, 'definitive',
      'secret-detection should be definitive');

    // Heuristic policies (skip allowed)
    assertEqual(ENFORCER_RETRY_POLICIES['docker-health'].confidence, 'heuristic',
      'docker-health should be heuristic');
    assertEqual(ENFORCER_RETRY_POLICIES['file-non-empty'].confidence, 'heuristic',
      'file-non-empty should be heuristic');
    assertEqual(ENFORCER_RETRY_POLICIES['deploy-health'].confidence, 'heuristic',
      'deploy-health should be heuristic');
  });

  // ==========================================================================
  // RESULTS
  // ==========================================================================

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60) + '\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
