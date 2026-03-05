/**
 * Translator Tests
 *
 * Verifies the translator in src/status-agent/translator.ts:
 * - All event type mappings produce valid StatusLine
 * - Unknown events return fallback
 * - Voice rules (8 words max, present tense)
 * - No banned words in translations
 * - StatusLine has required fields
 * - expandable and progress fields
 *
 * Run with: npx ts-node tests/translator.test.ts
 */

import {
  translate,
  translateBatch,
  TRANSLATIONS,
  parseDetail,
  extractFileName,
  extractStepId,
  extractProgress,
  extractUrl,
  defaultTranslation,
  generateId,
  humanizeFileName,
  humanizeTask,
  simplifyReason,
} from '../src/status-agent/translator';

import { BANNED_WORDS, MAX_WORDS_PER_STATUS } from '../src/status-agent/voice';
import type { StatusEvent, StatusLine, StatusState } from '../src/status-agent/types';

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

function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to be defined');
  }
}

// Helper to create test events
function makeEvent(source: string, type: string, detail: Record<string, unknown> = {}): StatusEvent {
  return {
    source,
    type,
    detail: JSON.stringify(detail),
    timestamp: Date.now(),
  };
}

// Get word count from text
function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// Check if text contains any banned words
function containsBannedWord(text: string): string | null {
  const bannedSet = new Set(BANNED_WORDS.map(w => w.toLowerCase()));
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    const cleanWord = word.replace(/[.,!?;:'"()\[\]{}]+/g, '');
    if (bannedSet.has(cleanWord)) {
      return cleanWord;
    }
  }
  return null;
}

// Valid states
const VALID_STATES: StatusState[] = ['pending', 'active', 'done', 'error', 'paused', 'waiting_user'];

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Translator Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // 1. STATUSLINE REQUIRED FIELDS
  // ==========================================================================
  console.log('1. StatusLine required fields:');

  test('translate returns object with id field', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertDefined(result.id);
    assertTrue(result.id.startsWith('status-'), 'ID should start with status-');
  });

  test('translate returns object with text field', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertDefined(result.text);
    assertTrue(result.text.length > 0, 'Text should not be empty');
  });

  test('translate returns object with state field', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertDefined(result.state);
    assertTrue(VALID_STATES.includes(result.state), `State should be valid: ${result.state}`);
  });

  test('translate returns object with icon field', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertDefined(result.icon);
    assertTrue(result.icon.length > 0, 'Icon should not be empty');
  });

  test('translate returns expandable boolean', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertEqual(typeof result.expandable, 'boolean');
  });

  // ==========================================================================
  // 2. UNKNOWN EVENT FALLBACK
  // ==========================================================================
  console.log('');
  console.log('2. Unknown event fallback:');

  test('unknown event type returns fallback translation', () => {
    const event = makeEvent('unknown-source', 'unknown-type');
    const result = translate(event);
    assertDefined(result.text);
    assertDefined(result.icon);
    assertEqual(result.state, 'active');
  });

  test('defaultTranslation produces active state', () => {
    const event = makeEvent('foo', 'bar');
    const result = defaultTranslation(event);
    assertEqual(result.state, 'active');
  });

  test('defaultTranslation produces working text for empty type', () => {
    const event = makeEvent('test', '');
    const result = defaultTranslation(event);
    assertTrue(result.text.length > 0);
  });

  // ==========================================================================
  // 3. VOICE RULES - 8 WORDS MAX
  // ==========================================================================
  console.log('');
  console.log('3. Voice rules - 8 words max:');

  test('conductor:classify has <= 8 words', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertTrue(wordCount(result.text) <= MAX_WORDS_PER_STATUS, `Text too long: "${result.text}"`);
  });

  test('worker:file-created has <= 8 words', () => {
    const event = makeEvent('worker', 'file-created', { path: '/src/components/MyLongComponentName.tsx' });
    const result = translate(event);
    assertTrue(wordCount(result.text) <= MAX_WORDS_PER_STATUS, `Text too long: "${result.text}"`);
  });

  test('deploy:start has <= 8 words', () => {
    const event = makeEvent('deploy', 'start', { target: 'vercel-production-us-east-1' });
    const result = translate(event);
    assertTrue(wordCount(result.text) <= MAX_WORDS_PER_STATUS, `Text too long: "${result.text}"`);
  });

  test('All translations have <= 8 words', () => {
    const keys = Object.keys(TRANSLATIONS);
    for (const key of keys) {
      const [source, type] = key.split(':');
      const event = makeEvent(source, type, { stepId: 1, file: 'test.ts', item: 'test' });
      const result = translate(event);
      assertTrue(
        wordCount(result.text) <= MAX_WORDS_PER_STATUS,
        `${key} has too many words: "${result.text}"`
      );
    }
  });

  // ==========================================================================
  // 4. NO BANNED WORDS
  // ==========================================================================
  console.log('');
  console.log('4. No banned words in translations:');

  test('conductor:classify has no banned words', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    const banned = containsBannedWord(result.text);
    assertTrue(banned === null, `Contains banned word: "${banned}" in "${result.text}"`);
  });

  test('worker:spawn has no banned words', () => {
    const event = makeEvent('worker', 'spawn', { task: 'create_file' });
    const result = translate(event);
    const banned = containsBannedWord(result.text);
    assertTrue(banned === null, `Contains banned word: "${banned}" in "${result.text}"`);
  });

  test('All translations have no banned words', () => {
    const keys = Object.keys(TRANSLATIONS);
    for (const key of keys) {
      const [source, type] = key.split(':');
      const event = makeEvent(source, type, {});
      const result = translate(event);
      const banned = containsBannedWord(result.text);
      assertTrue(
        banned === null,
        `${key} contains banned word: "${banned}" in "${result.text}"`
      );
    }
  });

  // ==========================================================================
  // 5. CONDUCTOR TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('5. Conductor translations:');

  test('conductor:classify returns active state', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertEqual(result.state, 'active');
  });

  test('conductor:plan-ready includes step count', () => {
    const event = makeEvent('conductor', 'plan-ready', { stepCount: 5 });
    const result = translate(event);
    assertTrue(result.text.includes('5'), 'Should include step count');
  });

  test('conductor:complete returns done state', () => {
    const event = makeEvent('conductor', 'complete');
    const result = translate(event);
    assertEqual(result.state, 'done');
  });

  test('conductor:error returns error state', () => {
    const event = makeEvent('conductor', 'error', { reason: 'Connection failed' });
    const result = translate(event);
    assertEqual(result.state, 'error');
  });

  // ==========================================================================
  // 6. WORKER TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('6. Worker translations:');

  test('worker:file-created returns done state', () => {
    const event = makeEvent('worker', 'file-created', { path: '/src/App.tsx' });
    const result = translate(event);
    assertEqual(result.state, 'done');
  });

  test('worker:file-created is expandable', () => {
    const event = makeEvent('worker', 'file-created', { path: '/src/App.tsx' });
    const result = translate(event);
    assertEqual(result.expandable, true);
  });

  test('worker:step-progress includes progress', () => {
    const event = makeEvent('worker', 'step-progress', { progress: 50, stepId: 1 });
    const result = translate(event);
    assertEqual(result.progress, 50);
  });

  test('worker:error returns error state', () => {
    const event = makeEvent('worker', 'error', { reason: 'Build failed' });
    const result = translate(event);
    assertEqual(result.state, 'error');
  });

  // ==========================================================================
  // 7. BODYGUARD TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('7. Bodyguard translations:');

  test('bodyguard:pass returns done state', () => {
    const event = makeEvent('bodyguard', 'pass');
    const result = translate(event);
    assertEqual(result.state, 'done');
  });

  test('bodyguard:fail-definitive returns error state', () => {
    const event = makeEvent('bodyguard', 'fail-definitive', { reason: 'Tests failed' });
    const result = translate(event);
    assertEqual(result.state, 'error');
  });

  test('bodyguard:fail-heuristic is expandable', () => {
    const event = makeEvent('bodyguard', 'fail-heuristic', { issue: 'Potential memory leak' });
    const result = translate(event);
    assertEqual(result.expandable, true);
  });

  // ==========================================================================
  // 8. PA TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('8. PA translations:');

  test('pa:question returns waiting_user state', () => {
    const event = makeEvent('pa', 'question');
    const result = translate(event);
    assertEqual(result.state, 'waiting_user');
  });

  test('pa:waiting returns waiting_user state', () => {
    const event = makeEvent('pa', 'waiting');
    const result = translate(event);
    assertEqual(result.state, 'waiting_user');
  });

  test('pa:response-received returns active state', () => {
    const event = makeEvent('pa', 'response-received');
    const result = translate(event);
    assertEqual(result.state, 'active');
  });

  // ==========================================================================
  // 9. RATE LIMIT TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('9. Rate limit translations:');

  test('rate-limit:hit returns paused state', () => {
    const event = makeEvent('rate-limit', 'hit', { retryAfter: 5000 });
    const result = translate(event);
    assertEqual(result.state, 'paused');
  });

  test('rate-limit:resumed returns active state', () => {
    const event = makeEvent('rate-limit', 'resumed');
    const result = translate(event);
    assertEqual(result.state, 'active');
  });

  // ==========================================================================
  // 10. IMAGE GEN TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('10. Image generation translations:');

  test('image-gen:complete returns done state', () => {
    const event = makeEvent('image-gen', 'complete');
    const result = translate(event);
    assertEqual(result.state, 'done');
  });

  test('image-gen:progress includes progress', () => {
    const event = makeEvent('image-gen', 'progress', { percent: 75 });
    const result = translate(event);
    assertEqual(result.progress, 75);
  });

  test('image-gen:complete is expandable', () => {
    const event = makeEvent('image-gen', 'complete');
    const result = translate(event);
    assertEqual(result.expandable, true);
  });

  // ==========================================================================
  // 11. DEPLOY TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('11. Deploy translations:');

  test('deploy:live returns done state', () => {
    const event = makeEvent('deploy', 'live', { url: 'https://app.vercel.app' });
    const result = translate(event);
    assertEqual(result.state, 'done');
  });

  test('deploy:uploading includes progress', () => {
    const event = makeEvent('deploy', 'uploading', { percent: 30 });
    const result = translate(event);
    assertEqual(result.progress, 30);
  });

  test('deploy:error returns error state', () => {
    const event = makeEvent('deploy', 'error', { reason: 'Build failed' });
    const result = translate(event);
    assertEqual(result.state, 'error');
  });

  // ==========================================================================
  // 12. GIT TRANSLATIONS
  // ==========================================================================
  console.log('');
  console.log('12. Git translations:');

  test('git:commit is expandable when message provided', () => {
    const event = makeEvent('git', 'commit', { message: 'Fix bug in auth flow' });
    const result = translate(event);
    assertEqual(result.expandable, true);
  });

  test('git:complete returns done state', () => {
    const event = makeEvent('git', 'complete');
    const result = translate(event);
    assertEqual(result.state, 'done');
  });

  // ==========================================================================
  // 13. HELPER FUNCTIONS
  // ==========================================================================
  console.log('');
  console.log('13. Helper functions:');

  test('parseDetail parses valid JSON', () => {
    const result = parseDetail('{"foo": "bar"}');
    assertDefined(result);
    assertEqual((result as any).foo, 'bar');
  });

  test('parseDetail returns null for invalid JSON', () => {
    const result = parseDetail('not json');
    assertEqual(result, null);
  });

  test('extractFileName extracts file name', () => {
    const result = extractFileName(JSON.stringify({ path: '/src/components/App.tsx' }));
    assertTrue(result.includes('app'), `Should extract App: ${result}`);
  });

  test('extractStepId extracts step number', () => {
    const result = extractStepId(JSON.stringify({ stepId: 5 }));
    assertEqual(result, 5);
  });

  test('extractProgress extracts percentage', () => {
    const result = extractProgress(JSON.stringify({ progress: 75 }));
    assertEqual(result, 75);
  });

  test('extractProgress clamps to 0-100', () => {
    const over = extractProgress(JSON.stringify({ progress: 150 }));
    assertEqual(over, 100);

    const under = extractProgress(JSON.stringify({ progress: -10 }));
    assertEqual(under, 0);
  });

  test('extractUrl extracts URL', () => {
    const result = extractUrl(JSON.stringify({ url: 'https://example.com' }));
    assertEqual(result, 'https://example.com');
  });

  // ==========================================================================
  // 14. HUMANIZE FUNCTIONS
  // ==========================================================================
  console.log('');
  console.log('14. Humanize functions:');

  test('humanizeFileName extracts name without extension', () => {
    const result = humanizeFileName('/Users/test/MyComponent.tsx');
    assertTrue(result.includes('component'), `Should include component: ${result}`);
  });

  test('humanizeFileName handles empty input', () => {
    const result = humanizeFileName('');
    assertEqual(result, 'file');
  });

  test('humanizeTask converts create_file', () => {
    const result = humanizeTask('create_file');
    assertTrue(result.toLowerCase().includes('creat'), `Should include creating: ${result}`);
  });

  test('simplifyReason handles timeout', () => {
    const result = simplifyReason('ETIMEDOUT: connection timed out');
    assertTrue(result.includes('too long'), `Should simplify timeout: ${result}`);
  });

  test('simplifyReason handles rate limit', () => {
    const result = simplifyReason('rate_limit exceeded');
    assertTrue(result.includes('requests'), `Should simplify rate limit: ${result}`);
  });

  // ==========================================================================
  // 15. BATCH TRANSLATION
  // ==========================================================================
  console.log('');
  console.log('15. Batch translation:');

  test('translateBatch handles multiple events', () => {
    const events = [
      makeEvent('conductor', 'classify'),
      makeEvent('worker', 'spawn', { task: 'build' }),
      makeEvent('deploy', 'start', { target: 'vercel' }),
    ];

    const results = translateBatch(events);

    assertEqual(results.length, 3);
    assertTrue(results.every(r => r.id !== undefined));
    assertTrue(results.every(r => r.text !== undefined));
  });

  test('translateBatch handles empty array', () => {
    const results = translateBatch([]);
    assertEqual(results.length, 0);
  });

  // ==========================================================================
  // 16. ID GENERATION
  // ==========================================================================
  console.log('');
  console.log('16. ID generation:');

  test('generateId returns unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    assertTrue(id1 !== id2, 'IDs should be unique');
  });

  test('generateId starts with status-', () => {
    const id = generateId();
    assertTrue(id.startsWith('status-'), `ID should start with status-: ${id}`);
  });

  // ==========================================================================
  // 17. ALL TRANSLATIONS PRODUCE VALID OUTPUT
  // ==========================================================================
  console.log('');
  console.log('17. All translations produce valid output:');

  test('All translations return valid StatusLine', () => {
    const keys = Object.keys(TRANSLATIONS);
    for (const key of keys) {
      const [source, type] = key.split(':');
      const event = makeEvent(source, type, {
        stepId: 1,
        file: 'test.ts',
        path: '/test/file.ts',
        item: 'test',
        message: 'test message',
        reason: 'test reason',
        progress: 50,
        percent: 50,
        url: 'https://test.com',
      });

      const result = translate(event);

      // Verify all required fields
      assertDefined(result.id, `${key} missing id`);
      assertDefined(result.text, `${key} missing text`);
      assertDefined(result.state, `${key} missing state`);
      assertDefined(result.icon, `${key} missing icon`);
      assertEqual(typeof result.expandable, 'boolean', `${key} expandable not boolean`);

      // Verify state is valid
      assertTrue(VALID_STATES.includes(result.state), `${key} has invalid state: ${result.state}`);
    }
  });

  // ==========================================================================
  // 18. PROGRESS FIELD
  // ==========================================================================
  console.log('');
  console.log('18. Progress field:');

  test('Progress is null when not provided', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertEqual(result.progress, null);
  });

  test('Progress is set for progress events', () => {
    const event = makeEvent('worker', 'step-progress', { progress: 60 });
    const result = translate(event);
    assertEqual(result.progress, 60);
  });

  // ==========================================================================
  // 19. STEP ID EXTRACTION
  // ==========================================================================
  console.log('');
  console.log('19. Step ID extraction:');

  test('stepId is extracted from detail', () => {
    const event = makeEvent('worker', 'step-start', { stepId: 3, description: 'Building' });
    const result = translate(event);
    assertEqual(result.stepId, 3);
  });

  test('stepId is null when not provided', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertEqual(result.stepId, null);
  });

  // ==========================================================================
  // 20. EXPANDED TEXT
  // ==========================================================================
  console.log('');
  console.log('20. Expanded text:');

  test('expandedText is set for commit with message', () => {
    const event = makeEvent('git', 'commit', { message: 'Add feature X' });
    const result = translate(event);
    assertEqual(result.expandedText, 'Add feature X');
  });

  test('expandedText is null when not applicable', () => {
    const event = makeEvent('conductor', 'classify');
    const result = translate(event);
    assertEqual(result.expandedText, null);
  });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Translator Tests: ${testsPassed} passed, ${testsFailed} failed`);
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
