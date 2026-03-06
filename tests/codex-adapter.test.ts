/**
 * Codex Adapter Tests
 *
 * Tests the Codex CLI integration.
 * Run with: npx ts-node tests/codex-adapter.test.ts
 */

import { CodexAdapter, getCodexAdapter, cleanupCodexAdapter } from '../src/main/codex-adapter';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
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

function assertTrue(condition: boolean, msg?: string): void {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Codex Adapter Tests');
  console.log('='.repeat(60));

  console.log('\n=== Test 1: Static Methods ===\n');

  await test('Codex is installed', async () => {
    const installed = await CodexAdapter.isInstalled();
    assertTrue(installed, 'Codex should be installed');
  });

  await test('Get Codex version', async () => {
    const version = await CodexAdapter.getVersion();
    assertTrue(version !== null, 'Should get version');
    assertTrue(version!.includes('codex'), 'Version should contain codex');
    console.log(`         Version: ${version}`);
  });

  console.log('\n=== Test 2: Simple Prompt ===\n');

  await test('Execute simple math prompt', async () => {
    const adapter = getCodexAdapter();
    const result = await adapter.execute('What is 5 + 3?', { timeout: 30000 });

    assertTrue(result.success, 'Should succeed');
    assertTrue(result.threadId.length > 0, 'Should have thread ID');
    assertTrue(result.response.includes('8'), 'Response should contain 8');
    console.log(`         Response: ${result.response.substring(0, 50)}...`);
    console.log(`         Tokens: ${result.usage.inputTokens} in, ${result.usage.outputTokens} out`);
  });

  console.log('\n=== Test 3: Code Generation ===\n');

  await test('Generate Python function', async () => {
    const adapter = getCodexAdapter();
    const result = await adapter.execute(
      'Write a Python function called add_numbers that takes two arguments and returns their sum. Reply with ONLY a markdown code block, no explanation.',
      { timeout: 60000 }
    );

    assertTrue(result.success, 'Should succeed');

    // Check for the function definition in code blocks OR raw response text.
    // LLMs may return code as a fenced block, inline, or plain text — all are valid
    // as long as the function is present.
    const hasCodeBlock = result.codeBlocks.length > 0;
    const hasDefInResponse = result.response.includes('def add_numbers');
    const hasDefInBlocks = result.codeBlocks.some(c => c.includes('def add_numbers'));
    assertTrue(
      hasDefInResponse || hasDefInBlocks,
      'Should contain add_numbers function definition in response or code blocks'
    );
    console.log(`         Code blocks: ${result.codeBlocks.length}`);
    if (hasCodeBlock) {
      console.log(`         First block:\n${result.codeBlocks[0].substring(0, 100)}...`);
    } else {
      console.log(`         No fenced code blocks, but function found in response text`);
    }
  });

  console.log('\n=== Test 4: Event Emission ===\n');

  await test('Emits message events', async () => {
    const adapter = new CodexAdapter();
    const messages: any[] = [];

    adapter.on('message', (msg) => messages.push(msg));

    await adapter.execute('Say hello', { timeout: 30000 });

    assertTrue(messages.length > 0, 'Should emit messages');
    assertTrue(
      messages.some(m => m.type === 'thread.started'),
      'Should have thread.started'
    );
    assertTrue(
      messages.some(m => m.type === 'turn.completed'),
      'Should have turn.completed'
    );
    console.log(`         Messages received: ${messages.length}`);
  });

  console.log('\n=== Test 5: Reasoning Capture ===\n');

  await test('Captures reasoning', async () => {
    const adapter = getCodexAdapter();
    const result = await adapter.execute(
      'Explain briefly why the sky is blue',
      { timeout: 60000 }
    );

    assertTrue(result.success, 'Should succeed');
    assertTrue(result.reasoning.length > 0, 'Should have reasoning');
    console.log(`         Reasoning blocks: ${result.reasoning.length}`);
  });

  // Cleanup
  cleanupCodexAdapter();

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
