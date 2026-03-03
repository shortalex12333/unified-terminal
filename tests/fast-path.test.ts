/**
 * Fast-Path Tests
 *
 * Verifies the fast-path bypass logic correctly classifies messages into
 * 'bypass_to_chatgpt' (trivial) or 'send_to_tier1' (requires classification).
 *
 * Run with: npx ts-node tests/fast-path.test.ts
 */

import {
  fastPathCheck,
  fastPathCheckWithReason,
  fastPathCheckBatch,
  containsActionVerb,
  containsCLIKeyword,
  isImageRequest,
  FastPathResult,
  FastPathResultWithReason,
} from '../src/main/fast-path';

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

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Fast-Path Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // 1. EMPTY/TRIVIAL MESSAGES (bypass)
  // ==========================================================================
  console.log('1. Empty/trivial messages (should bypass):');

  test('Empty string bypasses', () => {
    const result = fastPathCheck('');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Empty string has reason "empty_message"', () => {
    const result = fastPathCheckWithReason('');
    assertEqual(result.reason, 'empty_message');
  });

  test('Single character bypasses', () => {
    const result = fastPathCheck('a');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Two characters bypasses', () => {
    const result = fastPathCheck('ok');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Single emoji bypasses', () => {
    const result = fastPathCheckWithReason('!');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'single_char_or_emoji');
  });

  test('Whitespace only bypasses', () => {
    const result = fastPathCheck('   ');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  // ==========================================================================
  // 2. GREETINGS (bypass)
  // ==========================================================================
  console.log('');
  console.log('2. Greetings (should bypass):');

  test('"hi" bypasses (2 chars triggers single_char_or_emoji first)', () => {
    const result = fastPathCheckWithReason('hi');
    assertEqual(result.result, 'bypass_to_chatgpt');
    // "hi" is 2 chars, so it triggers single_char_or_emoji before greeting check
    assertEqual(result.reason, 'single_char_or_emoji');
  });

  test('"Hello there" bypasses as greeting', () => {
    const result = fastPathCheckWithReason('Hello there');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'greeting');
  });

  test('"Hey" bypasses as greeting', () => {
    const result = fastPathCheck('Hey');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"Good morning" bypasses as greeting', () => {
    const result = fastPathCheckWithReason('Good morning');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'greeting');
  });

  test('"Good afternoon" bypasses as greeting', () => {
    const result = fastPathCheck('Good afternoon');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"howdy" bypasses as greeting', () => {
    const result = fastPathCheck('howdy');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  // ==========================================================================
  // 3. CONFIRMATIONS (bypass)
  // ==========================================================================
  console.log('');
  console.log('3. Confirmations (should bypass):');

  test('"thanks" bypasses as confirmation', () => {
    const result = fastPathCheckWithReason('thanks');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'confirmation');
  });

  test('"thank you" bypasses as confirmation', () => {
    const result = fastPathCheck('thank you');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"ok" bypasses as confirmation', () => {
    const result = fastPathCheckWithReason('ok');
    // Note: "ok" is 2 chars, may trigger single_char_or_emoji first
    assertEqual(result.result, 'bypass_to_chatgpt');
  });

  test('"okay" bypasses as confirmation', () => {
    const result = fastPathCheckWithReason('okay');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'confirmation');
  });

  test('"yes" bypasses as confirmation', () => {
    const result = fastPathCheck('yes');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"got it" bypasses as confirmation', () => {
    const result = fastPathCheckWithReason('got it');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'confirmation');
  });

  test('"cool" bypasses as confirmation', () => {
    const result = fastPathCheck('cool');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"perfect" bypasses as confirmation', () => {
    const result = fastPathCheck('perfect');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"awesome" bypasses as confirmation', () => {
    const result = fastPathCheck('awesome');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  // ==========================================================================
  // 4. CONTINUATIONS (bypass)
  // ==========================================================================
  console.log('');
  console.log('4. Continuations (should bypass):');

  test('"continue" bypasses as continuation', () => {
    const result = fastPathCheckWithReason('continue');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'continuation');
  });

  test('"tell me more" bypasses as continuation', () => {
    const result = fastPathCheckWithReason('tell me more');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'continuation');
  });

  test('"go on" bypasses as continuation', () => {
    const result = fastPathCheck('go on');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"keep going" bypasses as continuation', () => {
    const result = fastPathCheck('keep going');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"explain more" bypasses as continuation', () => {
    const result = fastPathCheck('explain more');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"more details" bypasses as continuation', () => {
    const result = fastPathCheck('more details');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  // ==========================================================================
  // 5. SHORT QUESTIONS WITHOUT ACTION VERBS (bypass)
  // ==========================================================================
  console.log('');
  console.log('5. Short questions without action verbs (should bypass):');

  test('"what is that?" bypasses', () => {
    const result = fastPathCheckWithReason('what is that?');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'short_question_no_action');
  });

  test('"why?" bypasses', () => {
    const result = fastPathCheck('why?');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"how does it work?" bypasses', () => {
    const result = fastPathCheckWithReason('how does it work?');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'short_question_no_action');
  });

  test('"what time is it?" bypasses', () => {
    const result = fastPathCheck('what time is it?');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"who invented the telephone?" bypasses', () => {
    const result = fastPathCheck('who invented the telephone?');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  // ==========================================================================
  // 6. ACTION VERB DETECTION (tier1)
  // ==========================================================================
  console.log('');
  console.log('6. Action verb detection (should go to tier1):');

  test('"build a website" goes to tier1', () => {
    const result = fastPathCheck('build a website');
    assertEqual(result, 'send_to_tier1');
  });

  test('"create a new project" goes to tier1', () => {
    const result = fastPathCheck('create a new project');
    assertEqual(result, 'send_to_tier1');
  });

  test('"deploy my app" goes to tier1', () => {
    const result = fastPathCheck('deploy my app');
    assertEqual(result, 'send_to_tier1');
  });

  test('"fix the bug" goes to tier1', () => {
    const result = fastPathCheck('fix the bug');
    assertEqual(result, 'send_to_tier1');
  });

  test('"write a Python script" goes to tier1', () => {
    const result = fastPathCheck('write a Python script');
    assertEqual(result, 'send_to_tier1');
  });

  test('"refactor this code" goes to tier1', () => {
    const result = fastPathCheck('refactor this code');
    assertEqual(result, 'send_to_tier1');
  });

  test('"test the application" goes to tier1', () => {
    const result = fastPathCheck('test the application');
    assertEqual(result, 'send_to_tier1');
  });

  // ==========================================================================
  // 7. CLI KEYWORD DETECTION (tier1)
  // ==========================================================================
  console.log('');
  console.log('7. CLI keyword detection (should go to tier1):');

  test('"use codex to help" goes to tier1', () => {
    const result = fastPathCheck('use codex to help');
    assertEqual(result, 'send_to_tier1');
  });

  test('"run npm install" goes to tier1', () => {
    const result = fastPathCheck('run npm install');
    assertEqual(result, 'send_to_tier1');
  });

  test('"check the git repo" goes to tier1', () => {
    const result = fastPathCheck('check the git repo');
    assertEqual(result, 'send_to_tier1');
  });

  test('"open my project folder" goes to tier1', () => {
    const result = fastPathCheck('open my project folder');
    assertEqual(result, 'send_to_tier1');
  });

  test('"use docker for this" goes to tier1', () => {
    const result = fastPathCheck('use docker for this');
    assertEqual(result, 'send_to_tier1');
  });

  // ==========================================================================
  // 8. IMAGE GENERATION (bypass unless code context)
  // ==========================================================================
  console.log('');
  console.log('8. Image generation requests:');

  test('"draw a cat" bypasses (short_statement check runs before image check)', () => {
    const result = fastPathCheckWithReason('draw a cat');
    assertEqual(result.result, 'bypass_to_chatgpt');
    // "draw a cat" is short (<50 chars, <10 words) and "draw" is not in ACTION_VERBS
    // so it triggers short_statement before the image request check
    assertEqual(result.reason, 'short_statement');
  });

  test('"generate an image of a sunset" bypasses', () => {
    const result = fastPathCheckWithReason('generate an image of a sunset');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'image_generation_request');
  });

  test('"create a logo for my company" bypasses', () => {
    const result = fastPathCheck('create a logo for my company');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"create an image processing script" goes to tier1 (code context)', () => {
    const result = fastPathCheck('create an image processing script');
    assertEqual(result, 'send_to_tier1');
  });

  test('"build an image upload function" goes to tier1 (code context)', () => {
    const result = fastPathCheck('build an image upload function');
    assertEqual(result, 'send_to_tier1');
  });

  test('"write code to resize images" goes to tier1 (code context)', () => {
    const result = fastPathCheck('write code to resize images');
    assertEqual(result, 'send_to_tier1');
  });

  // ==========================================================================
  // 9. COMPLEX REQUESTS (tier1)
  // ==========================================================================
  console.log('');
  console.log('9. Complex requests (should go to tier1):');

  test('Long message with action verbs goes to tier1', () => {
    const longMessage = 'Build me a complete e-commerce website with user authentication, product catalog, shopping cart, and payment processing using Stripe';
    const result = fastPathCheck(longMessage);
    assertEqual(result, 'send_to_tier1');
  });

  test('Multi-step task goes to tier1', () => {
    const result = fastPathCheck('First create a database schema, then implement the API endpoints');
    assertEqual(result, 'send_to_tier1');
  });

  test('Question with action verb goes to tier1', () => {
    const result = fastPathCheck('Can you build me a landing page?');
    assertEqual(result, 'send_to_tier1');
  });

  // ==========================================================================
  // 10. HELPER FUNCTION TESTS
  // ==========================================================================
  console.log('');
  console.log('10. Helper function tests:');

  // containsActionVerb
  test('containsActionVerb detects "build"', () => {
    assertTrue(containsActionVerb('build a website'));
  });

  test('containsActionVerb detects "create"', () => {
    assertTrue(containsActionVerb('create something new'));
  });

  test('containsActionVerb detects "deploy"', () => {
    assertTrue(containsActionVerb('deploy to production'));
  });

  test('containsActionVerb returns false for no verbs', () => {
    assertFalse(containsActionVerb('hello world'));
  });

  test('containsActionVerb is case insensitive', () => {
    assertTrue(containsActionVerb('BUILD this'));
    assertTrue(containsActionVerb('Deploy NOW'));
  });

  test('containsActionVerb matches whole words only', () => {
    // "builder" should not match "build" as whole word
    assertFalse(containsActionVerb('the builder pattern'));
  });

  // containsCLIKeyword
  test('containsCLIKeyword detects "npm"', () => {
    assertTrue(containsCLIKeyword('run npm install'));
  });

  test('containsCLIKeyword detects "git"', () => {
    assertTrue(containsCLIKeyword('check git status'));
  });

  test('containsCLIKeyword detects "codex"', () => {
    assertTrue(containsCLIKeyword('use codex for this'));
  });

  test('containsCLIKeyword returns false for no keywords', () => {
    assertFalse(containsCLIKeyword('make me happy'));
  });

  test('containsCLIKeyword is case insensitive', () => {
    assertTrue(containsCLIKeyword('NPM install'));
    assertTrue(containsCLIKeyword('DOCKER compose'));
  });

  // isImageRequest
  test('isImageRequest detects "image"', () => {
    assertTrue(isImageRequest('create an image'));
  });

  test('isImageRequest detects "draw"', () => {
    assertTrue(isImageRequest('draw me a picture'));
  });

  test('isImageRequest detects "logo"', () => {
    assertTrue(isImageRequest('design a logo'));
  });

  test('isImageRequest detects "dall-e"', () => {
    assertTrue(isImageRequest('use dall-e to generate'));
  });

  test('isImageRequest returns false for non-image text', () => {
    assertFalse(isImageRequest('write some code'));
  });

  // ==========================================================================
  // 11. BATCH PROCESSING
  // ==========================================================================
  console.log('');
  console.log('11. Batch processing tests:');

  test('fastPathCheckBatch processes multiple messages', () => {
    const messages = ['hi', 'build a website', 'thanks'];
    const results = fastPathCheckBatch(messages);

    assertEqual(results.length, 3);
    assertEqual(results[0].message, 'hi');
    assertEqual(results[0].result.result, 'bypass_to_chatgpt');
    assertEqual(results[1].message, 'build a website');
    assertEqual(results[1].result.result, 'send_to_tier1');
    assertEqual(results[2].message, 'thanks');
    assertEqual(results[2].result.result, 'bypass_to_chatgpt');
  });

  test('fastPathCheckBatch handles empty array', () => {
    const results = fastPathCheckBatch([]);
    assertEqual(results.length, 0);
  });

  test('fastPathCheckBatch preserves order', () => {
    const messages = ['a', 'bb', 'ccc', 'dddd'];
    const results = fastPathCheckBatch(messages);
    assertEqual(results[0].message, 'a');
    assertEqual(results[3].message, 'dddd');
  });

  // ==========================================================================
  // 12. EDGE CASES
  // ==========================================================================
  console.log('');
  console.log('12. Edge cases:');

  test('Mixed case "HELLO" bypasses as greeting', () => {
    const result = fastPathCheck('HELLO');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Mixed case "Build" still triggers tier1', () => {
    const result = fastPathCheck('Build something');
    assertEqual(result, 'send_to_tier1');
  });

  test('Punctuation: "hi!" bypasses as greeting', () => {
    const result = fastPathCheck('hi!');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Punctuation: "thanks!!!" bypasses', () => {
    const result = fastPathCheck('thanks!!!');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Numbers only bypasses as short statement', () => {
    const result = fastPathCheck('12345');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Leading/trailing whitespace is trimmed', () => {
    const result = fastPathCheck('  hi  ');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Short statement without action verb bypasses', () => {
    const result = fastPathCheckWithReason('I like cats');
    assertEqual(result.result, 'bypass_to_chatgpt');
    assertEqual(result.reason, 'short_statement');
  });

  test('Result includes reason field', () => {
    const result = fastPathCheckWithReason('hello');
    assertTrue(result.reason !== undefined);
    assertTrue(result.reason.length > 0);
  });

  test('Result includes matchedPattern when applicable', () => {
    const result = fastPathCheckWithReason('hello');
    assertTrue(result.matchedPattern !== undefined);
  });

  test('Result does not include matchedPattern for short_statement', () => {
    const result = fastPathCheckWithReason('cats are cute');
    assertEqual(result.reason, 'short_statement');
    assertEqual(result.matchedPattern, undefined);
  });

  // ==========================================================================
  // 13. ADDITIONAL COVERAGE
  // ==========================================================================
  console.log('');
  console.log('13. Additional coverage:');

  test('"yo" bypasses as greeting', () => {
    const result = fastPathCheck('yo');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"nope" bypasses as confirmation', () => {
    const result = fastPathCheck('nope');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"roger" bypasses as confirmation', () => {
    const result = fastPathCheck('roger');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"proceed" bypasses as continuation', () => {
    const result = fastPathCheck('proceed');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"elaborate" bypasses as continuation', () => {
    const result = fastPathCheck('elaborate');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"what about this?" bypasses as continuation', () => {
    const result = fastPathCheck('what about this?');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('Long question with action verb goes to tier1', () => {
    const result = fastPathCheck('How do I build a React application with TypeScript?');
    assertEqual(result, 'send_to_tier1');
  });

  test('Short question with CLI keyword goes to tier1', () => {
    const result = fastPathCheck('how to use git?');
    assertEqual(result, 'send_to_tier1');
  });

  test('"visualize this data" bypasses as image request', () => {
    const result = fastPathCheck('visualize this data');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  test('"create a banner for my website" bypasses as image request', () => {
    const result = fastPathCheck('create a banner for my website');
    assertEqual(result, 'bypass_to_chatgpt');
  });

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
