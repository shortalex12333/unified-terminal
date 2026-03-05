/**
 * Checkpoint Tests
 *
 * Tests for the forced checkpoint system in src/status-agent/query.ts.
 * Checkpoints are mandatory pause points that solve the "Codex one-shots everything"
 * problem by forcing explicit user approval at key decision points.
 *
 * Run with: npx ts-node tests/checkpoint.test.ts
 */

// ============================================================================
// IMPORTS
// ============================================================================

import {
  FORCED_CHECKPOINTS,
  QUERY_TIMEOUT_MS,
  BLOCKING_TIMEOUT_MS,
  DEPLOY_TIMEOUT_MS,
  createQuery,
  isCheckpointTrigger,
  getCheckpointQuery,
  getCheckpointByName,
  isQueryTimedOut,
  getTimeoutDefault,
  isValidQueryResponse,
} from '../src/status-agent/query';

import type { StatusEvent, UserQuery } from '../src/status-agent/types';

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

function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be non-null');
  }
}

function assertNull(value: unknown, message?: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(message || `Expected null/undefined, got ${JSON.stringify(value)}`);
  }
}

function assertIncludes(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new Error(
      message || `Expected string to include "${substring}", got: "${str.substring(0, 100)}..."`
    );
  }
}

// Helper to create a status event for testing
function createStatusEvent(source: string, type: string, detail: object = {}): StatusEvent {
  return {
    source,
    type,
    detail: JSON.stringify(detail),
    timestamp: Date.now(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

function runTests(): void {
  console.log('='.repeat(60));
  console.log('Checkpoint Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // Test Category 1: PLAN_REVIEW Checkpoint
  // ==========================================================================
  console.log('1. PLAN_REVIEW Checkpoint:');

  test('PLAN_REVIEW checkpoint exists', () => {
    const checkpoint = FORCED_CHECKPOINTS.PLAN_REVIEW;
    assertNotNull(checkpoint, 'PLAN_REVIEW checkpoint should exist');
  });

  test('PLAN_REVIEW has 120s (2 minute) timeout', () => {
    const checkpoint = FORCED_CHECKPOINTS.PLAN_REVIEW;
    assertEqual(checkpoint.query.timeout, 120_000, 'PLAN_REVIEW should have 120s timeout');
  });

  test('PLAN_REVIEW is blocking', () => {
    const checkpoint = FORCED_CHECKPOINTS.PLAN_REVIEW;
    assertEqual(checkpoint.query.priority, 'blocking', 'PLAN_REVIEW should be blocking');
  });

  test('PLAN_REVIEW triggers on conductor:plan-ready', () => {
    const checkpoint = FORCED_CHECKPOINTS.PLAN_REVIEW;
    assertEqual(checkpoint.trigger, 'conductor:plan-ready', 'Should trigger on conductor:plan-ready');
  });

  test('PLAN_REVIEW has approve and modify options', () => {
    const checkpoint = FORCED_CHECKPOINTS.PLAN_REVIEW;
    const optionValues = checkpoint.query.options.map((o) => o.value);
    assertTrue(optionValues.includes('approve'), 'Should have approve option');
    assertTrue(optionValues.includes('modify'), 'Should have modify option');
  });

  // ==========================================================================
  // Test Category 2: FIRST_OUTPUT Checkpoint
  // ==========================================================================
  console.log('\n2. FIRST_OUTPUT Checkpoint:');

  test('FIRST_OUTPUT checkpoint exists', () => {
    const checkpoint = FORCED_CHECKPOINTS.FIRST_OUTPUT;
    assertNotNull(checkpoint, 'FIRST_OUTPUT checkpoint should exist');
  });

  test('FIRST_OUTPUT has 60s (1 minute) timeout', () => {
    const checkpoint = FORCED_CHECKPOINTS.FIRST_OUTPUT;
    assertEqual(checkpoint.query.timeout, 60_000, 'FIRST_OUTPUT should have 60s timeout');
  });

  test('FIRST_OUTPUT is blocking', () => {
    const checkpoint = FORCED_CHECKPOINTS.FIRST_OUTPUT;
    assertEqual(checkpoint.query.priority, 'blocking', 'FIRST_OUTPUT should be blocking');
  });

  test('FIRST_OUTPUT triggers on worker:first-visible-output', () => {
    const checkpoint = FORCED_CHECKPOINTS.FIRST_OUTPUT;
    assertEqual(checkpoint.trigger, 'worker:first-visible-output', 'Should trigger on worker:first-visible-output');
  });

  test('FIRST_OUTPUT has approve, modify, and restart options', () => {
    const checkpoint = FORCED_CHECKPOINTS.FIRST_OUTPUT;
    const optionValues = checkpoint.query.options.map((o) => o.value);
    assertTrue(optionValues.includes('approve'), 'Should have approve option');
    assertTrue(optionValues.includes('modify'), 'Should have modify option');
    assertTrue(optionValues.includes('restart'), 'Should have restart option');
  });

  // ==========================================================================
  // Test Category 3: PRE_DEPLOY Checkpoint
  // ==========================================================================
  console.log('\n3. PRE_DEPLOY Checkpoint:');

  test('PRE_DEPLOY checkpoint exists', () => {
    const checkpoint = FORCED_CHECKPOINTS.PRE_DEPLOY;
    assertNotNull(checkpoint, 'PRE_DEPLOY checkpoint should exist');
  });

  test('PRE_DEPLOY has NO timeout (null)', () => {
    const checkpoint = FORCED_CHECKPOINTS.PRE_DEPLOY;
    assertNull(checkpoint.query.timeout, 'PRE_DEPLOY should NEVER auto-timeout');
  });

  test('PRE_DEPLOY is blocking', () => {
    const checkpoint = FORCED_CHECKPOINTS.PRE_DEPLOY;
    assertEqual(checkpoint.query.priority, 'blocking', 'PRE_DEPLOY should be blocking');
  });

  test('PRE_DEPLOY triggers on conductor:pre-deploy', () => {
    const checkpoint = FORCED_CHECKPOINTS.PRE_DEPLOY;
    assertEqual(checkpoint.trigger, 'conductor:pre-deploy', 'Should trigger on conductor:pre-deploy');
  });

  test('PRE_DEPLOY has approve, review, and cancel options', () => {
    const checkpoint = FORCED_CHECKPOINTS.PRE_DEPLOY;
    const optionValues = checkpoint.query.options.map((o) => o.value);
    assertTrue(optionValues.includes('approve'), 'Should have approve option');
    assertTrue(optionValues.includes('review'), 'Should have review option');
    assertTrue(optionValues.includes('cancel'), 'Should have cancel option');
  });

  test('PRE_DEPLOY question mentions LIVE deployment', () => {
    const checkpoint = FORCED_CHECKPOINTS.PRE_DEPLOY;
    assertIncludes(checkpoint.query.question, 'LIVE', 'Question should mention LIVE deployment');
  });

  // ==========================================================================
  // Test Category 4: PROGRESS_CHECK Checkpoint
  // ==========================================================================
  console.log('\n4. PROGRESS_CHECK Checkpoint:');

  test('PROGRESS_CHECK checkpoint exists', () => {
    const checkpoint = FORCED_CHECKPOINTS.PROGRESS_CHECK;
    assertNotNull(checkpoint, 'PROGRESS_CHECK checkpoint should exist');
  });

  test('PROGRESS_CHECK is NON-blocking (normal priority)', () => {
    const checkpoint = FORCED_CHECKPOINTS.PROGRESS_CHECK;
    assertEqual(checkpoint.query.priority, 'normal', 'PROGRESS_CHECK should be non-blocking');
  });

  test('PROGRESS_CHECK has 30s timeout', () => {
    const checkpoint = FORCED_CHECKPOINTS.PROGRESS_CHECK;
    assertEqual(checkpoint.query.timeout, 30_000, 'PROGRESS_CHECK should have 30s timeout');
  });

  test('PROGRESS_CHECK triggers on conductor:steps-completed-modulo-5', () => {
    const checkpoint = FORCED_CHECKPOINTS.PROGRESS_CHECK;
    assertEqual(
      checkpoint.trigger,
      'conductor:steps-completed-modulo-5',
      'Should trigger on conductor:steps-completed-modulo-5'
    );
  });

  test('PROGRESS_CHECK has pause option', () => {
    const checkpoint = FORCED_CHECKPOINTS.PROGRESS_CHECK;
    const optionValues = checkpoint.query.options.map((o) => o.value);
    assertTrue(optionValues.includes('pause'), 'Should have pause option');
  });

  // ==========================================================================
  // Test Category 5: Checkpoint Detection
  // ==========================================================================
  console.log('\n5. Checkpoint Detection:');

  test('isCheckpointTrigger returns true for conductor:plan-ready', () => {
    const event = createStatusEvent('conductor', 'plan-ready');
    assertTrue(isCheckpointTrigger(event), 'Should detect PLAN_REVIEW checkpoint');
  });

  test('isCheckpointTrigger returns true for worker:first-visible-output', () => {
    const event = createStatusEvent('worker', 'first-visible-output');
    assertTrue(isCheckpointTrigger(event), 'Should detect FIRST_OUTPUT checkpoint');
  });

  test('isCheckpointTrigger returns true for conductor:pre-deploy', () => {
    const event = createStatusEvent('conductor', 'pre-deploy');
    assertTrue(isCheckpointTrigger(event), 'Should detect PRE_DEPLOY checkpoint');
  });

  test('isCheckpointTrigger returns false for non-checkpoint events', () => {
    const event = createStatusEvent('worker', 'file-created');
    assertFalse(isCheckpointTrigger(event), 'Should not detect non-checkpoint event');
  });

  test('isCheckpointTrigger returns false for unknown source', () => {
    const event = createStatusEvent('unknown', 'plan-ready');
    assertFalse(isCheckpointTrigger(event), 'Should not match wrong source');
  });

  // ==========================================================================
  // Test Category 6: Checkpoint Query Creation
  // ==========================================================================
  console.log('\n6. Checkpoint Query Creation:');

  test('getCheckpointQuery returns UserQuery for PLAN_REVIEW', () => {
    const event = createStatusEvent('conductor', 'plan-ready', { stepId: 1 });
    const query = getCheckpointQuery(event);
    assertNotNull(query, 'Should return a query');
    assertEqual(query.type, 'confirm', 'Should be confirm type');
    assertIncludes(query.agentHandle, 'plan_review', 'Should have checkpoint name in handle');
  });

  test('getCheckpointQuery returns null for non-checkpoint events', () => {
    const event = createStatusEvent('worker', 'file-created');
    const query = getCheckpointQuery(event);
    assertNull(query, 'Should return null for non-checkpoint');
  });

  test('getCheckpointQuery extracts stepId from event detail', () => {
    const event = createStatusEvent('conductor', 'plan-ready', { stepId: 42 });
    const query = getCheckpointQuery(event);
    assertNotNull(query);
    assertEqual(query.stepId, 42, 'Should extract stepId from detail');
  });

  test('getCheckpointQuery sets defaultChoice only for non-blocking', () => {
    // PROGRESS_CHECK is non-blocking, should have default
    const progressEvent = createStatusEvent('conductor', 'steps-completed-modulo-5');
    const progressQuery = getCheckpointQuery(progressEvent);
    assertNotNull(progressQuery);
    assertEqual(progressQuery.defaultChoice, 'approve', 'Non-blocking should have default');

    // PLAN_REVIEW is blocking, should NOT have default
    const planEvent = createStatusEvent('conductor', 'plan-ready');
    const planQuery = getCheckpointQuery(planEvent);
    assertNotNull(planQuery);
    assertNull(planQuery.defaultChoice, 'Blocking should not have default');
  });

  // ==========================================================================
  // Test Category 7: Query Creation (createQuery)
  // ==========================================================================
  console.log('\n7. Query Creation (createQuery):');

  test('createQuery generates unique IDs', () => {
    const query1 = createQuery('test', null, 'agent1', { question: 'Q1' });
    const query2 = createQuery('test', null, 'agent2', { question: 'Q2' });
    assertTrue(query1.id !== query2.id, 'Query IDs should be unique');
  });

  test('createQuery uses default timeout for normal priority', () => {
    const query = createQuery('test', null, 'agent', { priority: 'normal' });
    assertEqual(query.timeout, QUERY_TIMEOUT_MS, 'Should use QUERY_TIMEOUT_MS for normal');
  });

  test('createQuery uses blocking timeout for blocking priority', () => {
    const query = createQuery('test', null, 'agent', { priority: 'blocking' });
    assertEqual(query.timeout, BLOCKING_TIMEOUT_MS, 'Should use BLOCKING_TIMEOUT_MS for blocking');
  });

  test('createQuery allows custom timeout override', () => {
    const query = createQuery('test', null, 'agent', { timeout: 5000 });
    assertEqual(query.timeout, 5000, 'Should use custom timeout');
  });

  test('createQuery sets correct fields', () => {
    const query = createQuery('conductor', 5, 'my-agent', {
      type: 'choice',
      question: 'Pick one',
      options: [
        { label: 'A', value: 'a', detail: null, icon: null },
        { label: 'B', value: 'b', detail: null, icon: null },
      ],
    });

    assertEqual(query.source, 'conductor');
    assertEqual(query.stepId, 5);
    assertEqual(query.agentHandle, 'my-agent');
    assertEqual(query.type, 'choice');
    assertEqual(query.question, 'Pick one');
    assertEqual(query.options.length, 2);
  });

  // ==========================================================================
  // Test Category 8: Timeout Handling
  // ==========================================================================
  console.log('\n8. Timeout Handling:');

  test('isQueryTimedOut returns false when within timeout', () => {
    const query = createQuery('test', null, 'agent', { timeout: 30_000 });
    const createdAt = Date.now();
    assertFalse(isQueryTimedOut(query, createdAt), 'Should not be timed out immediately');
  });

  test('isQueryTimedOut returns true when past timeout', () => {
    const query = createQuery('test', null, 'agent', { timeout: 100 });
    const createdAt = Date.now() - 200; // 200ms ago
    assertTrue(isQueryTimedOut(query, createdAt), 'Should be timed out after 200ms');
  });

  test('isQueryTimedOut returns false for null timeout', () => {
    const query = createQuery('test', null, 'agent', { timeout: 0 });
    // Manually set null timeout (like PRE_DEPLOY)
    (query as { timeout: number | null }).timeout = null;
    const createdAt = Date.now() - 1_000_000; // Very old
    assertFalse(isQueryTimedOut(query, createdAt), 'Null timeout should never expire');
  });

  test('isQueryTimedOut returns false for zero timeout', () => {
    const query = createQuery('test', null, 'agent', { timeout: 0 });
    const createdAt = Date.now() - 1_000_000;
    assertFalse(isQueryTimedOut(query, createdAt), 'Zero timeout should never expire');
  });

  test('getTimeoutDefault returns null for blocking queries', () => {
    const query = createQuery('test', null, 'agent', {
      priority: 'blocking',
      defaultChoice: 'approve',
    });
    assertNull(getTimeoutDefault(query), 'Blocking queries should not auto-default');
  });

  test('getTimeoutDefault returns defaultChoice for normal queries', () => {
    const query = createQuery('test', null, 'agent', {
      priority: 'normal',
      defaultChoice: 'continue',
    });
    assertEqual(getTimeoutDefault(query), 'continue', 'Should return defaultChoice');
  });

  // ==========================================================================
  // Test Category 9: Query Response Validation
  // ==========================================================================
  console.log('\n9. Query Response Validation:');

  test('isValidQueryResponse validates choice queries', () => {
    const query = createQuery('test', null, 'agent', {
      type: 'choice',
      options: [
        { label: 'A', value: 'opt-a', detail: null, icon: null },
        { label: 'B', value: 'opt-b', detail: null, icon: null },
      ],
    });
    assertTrue(isValidQueryResponse('opt-a', query), 'Valid option should be accepted');
    assertTrue(isValidQueryResponse('opt-b', query), 'Valid option should be accepted');
    assertFalse(isValidQueryResponse('opt-c', query), 'Invalid option should be rejected');
  });

  test('isValidQueryResponse validates text queries', () => {
    const query = createQuery('test', null, 'agent', { type: 'text' });
    assertTrue(isValidQueryResponse('some text', query), 'Non-empty text should be valid');
    assertFalse(isValidQueryResponse('', query), 'Empty text should be invalid');
    assertFalse(isValidQueryResponse('   ', query), 'Whitespace-only should be invalid');
  });

  test('isValidQueryResponse validates upload queries', () => {
    const query = createQuery('test', null, 'agent', { type: 'upload' });
    assertTrue(isValidQueryResponse('/path/to/file', query), 'Absolute path should be valid');
    assertTrue(isValidQueryResponse('~/Documents/file.txt', query), 'Home path should be valid');
    assertFalse(isValidQueryResponse('relative/path', query), 'Relative path should be invalid');
  });

  // ==========================================================================
  // Test Category 10: getCheckpointByName
  // ==========================================================================
  console.log('\n10. getCheckpointByName:');

  test('getCheckpointByName returns PLAN_REVIEW', () => {
    const checkpoint = getCheckpointByName('PLAN_REVIEW');
    assertNotNull(checkpoint);
    assertEqual(checkpoint.trigger, 'conductor:plan-ready');
  });

  test('getCheckpointByName returns FIRST_OUTPUT', () => {
    const checkpoint = getCheckpointByName('FIRST_OUTPUT');
    assertNotNull(checkpoint);
    assertEqual(checkpoint.trigger, 'worker:first-visible-output');
  });

  test('getCheckpointByName returns PRE_DEPLOY', () => {
    const checkpoint = getCheckpointByName('PRE_DEPLOY');
    assertNotNull(checkpoint);
    assertEqual(checkpoint.trigger, 'conductor:pre-deploy');
  });

  test('getCheckpointByName returns undefined for unknown name', () => {
    const checkpoint = getCheckpointByName('UNKNOWN_CHECKPOINT');
    assertEqual(checkpoint, undefined, 'Should return undefined for unknown checkpoint');
  });

  // ==========================================================================
  // Test Category 11: Timeout Constants
  // ==========================================================================
  console.log('\n11. Timeout Constants:');

  test('QUERY_TIMEOUT_MS is 30 seconds', () => {
    assertEqual(QUERY_TIMEOUT_MS, 30_000, 'Default timeout should be 30s');
  });

  test('BLOCKING_TIMEOUT_MS is 60 seconds', () => {
    assertEqual(BLOCKING_TIMEOUT_MS, 60_000, 'Blocking timeout should be 60s');
  });

  test('DEPLOY_TIMEOUT_MS is null', () => {
    assertEqual(DEPLOY_TIMEOUT_MS, null, 'Deploy timeout should be null (never auto-deploys)');
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests();
