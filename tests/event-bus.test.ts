/**
 * Event Bus Tests
 *
 * Verifies the SystemEventBus in src/main/events.ts:
 * - Singleton pattern
 * - Event emission and subscription
 * - Wildcard listeners
 * - Source filtering
 * - Typed emitters
 *
 * Run with: npx ts-node tests/event-bus.test.ts
 */

import {
  systemEvents,
  emit,
  emitEvent,
  conductorEvents,
  schedulerEvents,
  workerEvents,
  bodyguardEvents,
  spineEvents,
  enforcerEvents,
  rateLimitEvents,
  imageGenEvents,
  deployEvents,
  gitEvents,
  paEvents,
} from '../src/main/events';

import type { StatusEvent } from '../src/status-agent/types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Event Bus Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // 1. SINGLETON PATTERN
  // ==========================================================================
  console.log('1. Singleton pattern:');

  test('systemEvents is defined', () => {
    assertTrue(systemEvents !== null && systemEvents !== undefined);
  });

  test('systemEvents has emitStatus method', () => {
    assertTrue(typeof systemEvents.emitStatus === 'function');
  });

  test('systemEvents has onStatus method', () => {
    assertTrue(typeof systemEvents.onStatus === 'function');
  });

  test('systemEvents has onSource method', () => {
    assertTrue(typeof systemEvents.onSource === 'function');
  });

  test('systemEvents has onAll method', () => {
    assertTrue(typeof systemEvents.onAll === 'function');
  });

  // ==========================================================================
  // 2. EMIT STATUS
  // ==========================================================================
  console.log('');
  console.log('2. emitStatus:');

  test('emitStatus emits to correct key', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('conductor', 'test-emit', (event) => {
      receivedEvent = event;
    });

    const testEvent: StatusEvent = {
      source: 'conductor',
      type: 'test-emit',
      detail: '{}',
      timestamp: Date.now(),
    };

    systemEvents.emitStatus(testEvent);

    assertTrue(receivedEvent !== null, 'Event should be received');
    assertEqual(receivedEvent!.source, 'conductor');
    assertEqual(receivedEvent!.type, 'test-emit');

    cleanup();
  });

  test('emit helper function works', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('worker', 'spawn-test', (event) => {
      receivedEvent = event;
    });

    emit({
      source: 'worker',
      type: 'spawn-test',
      detail: JSON.stringify({ stepId: '123' }),
      timestamp: Date.now(),
    });

    assertTrue(receivedEvent !== null, 'Event should be received via emit helper');
    assertEqual(receivedEvent!.source, 'worker');

    cleanup();
  });

  test('emitEvent helper constructs and emits event', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('bodyguard', 'check-test', (event) => {
      receivedEvent = event;
    });

    emitEvent('bodyguard', 'check-test', { stepId: 1 });

    assertTrue(receivedEvent !== null, 'Event should be received via emitEvent helper');
    assertEqual(receivedEvent!.source, 'bodyguard');
    assertEqual(receivedEvent!.type, 'check-test');
    assertTrue(receivedEvent!.detail.includes('stepId'));

    cleanup();
  });

  // ==========================================================================
  // 3. WILDCARD LISTENER
  // ==========================================================================
  console.log('');
  console.log('3. Wildcard listener:');

  test('wildcard listener receives all events', () => {
    const receivedEvents: StatusEvent[] = [];
    const cleanup = systemEvents.onAll((event) => {
      receivedEvents.push(event);
    });

    emit({
      source: 'conductor',
      type: 'wildcard-test-1',
      detail: '{}',
      timestamp: Date.now(),
    });

    emit({
      source: 'worker',
      type: 'wildcard-test-2',
      detail: '{}',
      timestamp: Date.now(),
    });

    assertTrue(receivedEvents.length >= 2, 'Should receive at least 2 events');
    assertTrue(
      receivedEvents.some(e => e.type === 'wildcard-test-1'),
      'Should receive conductor event'
    );
    assertTrue(
      receivedEvents.some(e => e.type === 'wildcard-test-2'),
      'Should receive worker event'
    );

    cleanup();
  });

  // ==========================================================================
  // 4. ON STATUS
  // ==========================================================================
  console.log('');
  console.log('4. onStatus subscription:');

  test('onStatus subscribes to specific source:type', () => {
    let received = false;
    const cleanup = systemEvents.onStatus('pa', 'query-test', () => {
      received = true;
    });

    emit({
      source: 'pa',
      type: 'query-test',
      detail: '{}',
      timestamp: Date.now(),
    });

    assertTrue(received, 'Should receive subscribed event');

    cleanup();
  });

  test('onStatus does not receive unsubscribed events', () => {
    let received = false;
    const cleanup = systemEvents.onStatus('pa', 'query-test-2', () => {
      received = true;
    });

    emit({
      source: 'pa',
      type: 'different-event',
      detail: '{}',
      timestamp: Date.now(),
    });

    assertTrue(!received, 'Should not receive different event type');

    cleanup();
  });

  // ==========================================================================
  // 5. ON SOURCE
  // ==========================================================================
  console.log('');
  console.log('5. onSource subscription:');

  test('onSource filters by source', () => {
    const receivedEvents: StatusEvent[] = [];
    const cleanup = systemEvents.onSource('deploy', (event) => {
      receivedEvents.push(event);
    });

    emit({
      source: 'deploy',
      type: 'start',
      detail: '{}',
      timestamp: Date.now(),
    });

    emit({
      source: 'deploy',
      type: 'complete',
      detail: '{}',
      timestamp: Date.now(),
    });

    emit({
      source: 'git',
      type: 'commit',
      detail: '{}',
      timestamp: Date.now(),
    });

    assertEqual(receivedEvents.length, 2, 'Should only receive deploy events');
    assertTrue(
      receivedEvents.every(e => e.source === 'deploy'),
      'All events should be from deploy source'
    );

    cleanup();
  });

  // ==========================================================================
  // 6. CLEANUP FUNCTION
  // ==========================================================================
  console.log('');
  console.log('6. Cleanup function:');

  test('cleanup function removes listener', () => {
    let callCount = 0;
    const cleanup = systemEvents.onStatus('git', 'cleanup-test', () => {
      callCount++;
    });

    emit({
      source: 'git',
      type: 'cleanup-test',
      detail: '{}',
      timestamp: Date.now(),
    });

    assertEqual(callCount, 1, 'Should receive event before cleanup');

    cleanup();

    emit({
      source: 'git',
      type: 'cleanup-test',
      detail: '{}',
      timestamp: Date.now(),
    });

    assertEqual(callCount, 1, 'Should not receive event after cleanup');
  });

  test('onAll cleanup function works', () => {
    let callCount = 0;
    const cleanup = systemEvents.onAll(() => {
      callCount++;
    });

    emit({
      source: 'conductor',
      type: 'all-cleanup-test',
      detail: '{}',
      timestamp: Date.now(),
    });

    const countAfterFirst = callCount;
    assertTrue(countAfterFirst >= 1, 'Should receive at least one event');

    cleanup();

    emit({
      source: 'conductor',
      type: 'all-cleanup-test-2',
      detail: '{}',
      timestamp: Date.now(),
    });

    // Count should not have increased by more than from other listeners
    assertTrue(callCount === countAfterFirst, 'Should not receive events after cleanup');
  });

  // ==========================================================================
  // 7. CONDUCTOR EVENTS
  // ==========================================================================
  console.log('');
  console.log('7. conductorEvents typed emitter:');

  test('classifyStart emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('conductor', 'classify-start', (event) => {
      receivedEvent = event;
    });

    conductorEvents.classifyStart('Building a React app');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'conductor');
    assertEqual(receivedEvent!.type, 'classify-start');
    assertTrue(receivedEvent!.detail.includes('Building a React app'));

    cleanup();
  });

  test('classifyComplete emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('conductor', 'classify-complete', (event) => {
      receivedEvent = event;
    });

    conductorEvents.classifyComplete('plan-123', 5);

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('plan-123'));
    assertTrue(receivedEvent!.detail.includes('5'));

    cleanup();
  });

  // ==========================================================================
  // 8. SCHEDULER EVENTS
  // ==========================================================================
  console.log('');
  console.log('8. schedulerEvents typed emitter:');

  test('stepStart emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('scheduler', 'step-start', (event) => {
      receivedEvent = event;
    });

    schedulerEvents.stepStart(1, 'create_file', 'Creating component');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'scheduler');
    assertTrue(receivedEvent!.detail.includes('create_file'));

    cleanup();
  });

  test('stepDone emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('scheduler', 'step-done', (event) => {
      receivedEvent = event;
    });

    schedulerEvents.stepDone(2, 'edit_file');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('edit_file'));

    cleanup();
  });

  // ==========================================================================
  // 9. WORKER EVENTS
  // ==========================================================================
  console.log('');
  console.log('9. workerEvents typed emitter:');

  test('spawn emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('worker', 'spawn', (event) => {
      receivedEvent = event;
    });

    workerEvents.spawn('step-1', 'create_file', '/project');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'worker');
    assertTrue(receivedEvent!.detail.includes('/project'));

    cleanup();
  });

  test('fileCreated emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('worker', 'file-created', (event) => {
      receivedEvent = event;
    });

    workerEvents.fileCreated('/src/component.tsx');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('component.tsx'));

    cleanup();
  });

  // ==========================================================================
  // 10. BODYGUARD EVENTS
  // ==========================================================================
  console.log('');
  console.log('10. bodyguardEvents typed emitter:');

  test('pass emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('bodyguard', 'pass', (event) => {
      receivedEvent = event;
    });

    bodyguardEvents.pass(1);

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'bodyguard');

    cleanup();
  });

  test('fail emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('bodyguard', 'fail', (event) => {
      receivedEvent = event;
    });

    bodyguardEvents.fail(2, 'TypeScript errors found');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('TypeScript errors'));

    cleanup();
  });

  // ==========================================================================
  // 11. RATE LIMIT EVENTS
  // ==========================================================================
  console.log('');
  console.log('11. rateLimitEvents typed emitter:');

  test('hit emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('rate-limit', 'hit', (event) => {
      receivedEvent = event;
    });

    rateLimitEvents.hit('openai', 30000);

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'rate-limit');
    assertTrue(receivedEvent!.detail.includes('30000'));

    cleanup();
  });

  test('resumed emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('rate-limit', 'resumed', (event) => {
      receivedEvent = event;
    });

    rateLimitEvents.resumed('task-123');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('task-123'));

    cleanup();
  });

  // ==========================================================================
  // 12. IMAGE GEN EVENTS
  // ==========================================================================
  console.log('');
  console.log('12. imageGenEvents typed emitter:');

  test('start emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('image-gen', 'start', (event) => {
      receivedEvent = event;
    });

    imageGenEvents.start('A sunset over mountains');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'image-gen');
    assertTrue(receivedEvent!.detail.includes('sunset'));

    cleanup();
  });

  test('complete emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('image-gen', 'complete', (event) => {
      receivedEvent = event;
    });

    imageGenEvents.complete('https://example.com/image.png');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('example.com'));

    cleanup();
  });

  // ==========================================================================
  // 13. DEPLOY EVENTS
  // ==========================================================================
  console.log('');
  console.log('13. deployEvents typed emitter:');

  test('start emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('deploy', 'start', (event) => {
      receivedEvent = event;
    });

    deployEvents.start('vercel');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'deploy');
    assertTrue(receivedEvent!.detail.includes('vercel'));

    cleanup();
  });

  test('complete emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('deploy', 'complete', (event) => {
      receivedEvent = event;
    });

    deployEvents.complete('https://myapp.vercel.app');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('vercel.app'));

    cleanup();
  });

  // ==========================================================================
  // 14. GIT EVENTS
  // ==========================================================================
  console.log('');
  console.log('14. gitEvents typed emitter:');

  test('commit emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('git', 'commit', (event) => {
      receivedEvent = event;
    });

    gitEvents.commit('Add new feature', 'abc123');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'git');
    assertTrue(receivedEvent!.detail.includes('abc123'));

    cleanup();
  });

  test('push emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('git', 'push', (event) => {
      receivedEvent = event;
    });

    gitEvents.push('main', 'origin');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('main'));
    assertTrue(receivedEvent!.detail.includes('origin'));

    cleanup();
  });

  // ==========================================================================
  // 15. PA EVENTS
  // ==========================================================================
  console.log('');
  console.log('15. paEvents typed emitter:');

  test('querySent emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('pa', 'query-sent', (event) => {
      receivedEvent = event;
    });

    paEvents.querySent('q-123', 'Which framework do you prefer?');

    assertTrue(receivedEvent !== null);
    assertEqual(receivedEvent!.source, 'pa');
    assertTrue(receivedEvent!.detail.includes('q-123'));
    assertTrue(receivedEvent!.detail.includes('framework'));

    cleanup();
  });

  test('queryResponse emits correctly', () => {
    let receivedEvent: StatusEvent | null = null;
    const cleanup = systemEvents.onStatus('pa', 'query-response', (event) => {
      receivedEvent = event;
    });

    paEvents.queryResponse('q-123', 'React');

    assertTrue(receivedEvent !== null);
    assertTrue(receivedEvent!.detail.includes('React'));

    cleanup();
  });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Event Bus Tests: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
