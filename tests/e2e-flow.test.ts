/**
 * End-to-End Flow Test
 *
 * Tests the complete flow:
 * 1. User message → Task Router → decides CLI or browser
 * 2. If CLI: spawn Codex → get response → return to user
 * 3. If browser: stays in ChatGPT
 *
 * Run with: npx ts-node tests/e2e-flow.test.ts
 */

import { routeTask } from '../src/main/task-router';
import { getCodexAdapter, cleanupCodexAdapter } from '../src/main/codex-adapter';
import { classifyTask } from '../src/intake/task-classifier';

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

// ============================================================================
// SIMULATED USER MESSAGES
// ============================================================================

const CLI_MESSAGES = [
  {
    input: 'Build me a simple calculator in Python',
    expectCLI: true,
    expectCodeInResponse: true,
  },
  {
    input: 'Create a function to reverse a string in JavaScript',
    expectCLI: true,
    expectCodeInResponse: true,
  },
  {
    input: 'Write a bash script to list all files in a directory',
    expectCLI: true,
    expectCodeInResponse: true,
  },
];

const BROWSER_MESSAGES = [
  {
    input: 'What is the capital of France?',
    expectCLI: false,
  },
  {
    input: 'Explain photosynthesis in simple terms',
    expectCLI: false,
  },
  {
    input: 'Help me write an email to my manager',
    expectCLI: false,
  },
];

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('End-to-End Flow Tests');
  console.log('='.repeat(60));

  // -------------------------------------------------------------------------
  // Test 1: Routing correctly identifies CLI vs Browser tasks
  // -------------------------------------------------------------------------
  console.log('\n=== Test 1: Task Routing ===\n');

  for (const msg of CLI_MESSAGES) {
    await test(`Routes to CLI: "${msg.input.substring(0, 35)}..."`, async () => {
      const decision = routeTask(msg.input);
      assertTrue(
        decision.path === 'local' || decision.path === 'hybrid',
        `Expected local/hybrid, got ${decision.path}`
      );
      assertTrue(decision.requiresCLI, 'Should require CLI');
    });
  }

  for (const msg of BROWSER_MESSAGES) {
    await test(`Routes to browser: "${msg.input.substring(0, 35)}..."`, async () => {
      const decision = routeTask(msg.input);
      assertTrue(
        decision.path === 'browser' || (decision.path === 'hybrid' && !decision.requiresCLI),
        `Expected browser path, got ${decision.path}`
      );
    });
  }

  // -------------------------------------------------------------------------
  // Test 2: CLI Flow - Route → Codex → Response
  // -------------------------------------------------------------------------
  console.log('\n=== Test 2: Full CLI Flow (Route → Codex → Response) ===\n');

  const cliTestCases = [
    {
      input: 'Write a Python function to check if a number is prime',
      expectInResponse: ['def', 'prime'],
    },
    {
      input: 'Create a JavaScript function to calculate factorial',
      expectInResponse: ['function', 'factorial'],
    },
  ];

  for (const testCase of cliTestCases) {
    await test(`Full flow: "${testCase.input.substring(0, 40)}..."`, async () => {
      // Step 1: Route the message
      const decision = routeTask(testCase.input);
      console.log(`         Routing: ${decision.path} (CLI: ${decision.requiresCLI})`);

      assertTrue(decision.requiresCLI, 'Should route to CLI');

      // Step 2: If CLI required, execute with Codex
      if (decision.requiresCLI) {
        const adapter = getCodexAdapter();
        const result = await adapter.execute(testCase.input, { timeout: 60000 });

        console.log(`         Codex response length: ${result.response.length} chars`);
        console.log(`         Code blocks: ${result.codeBlocks.length}`);
        console.log(`         Tokens: ${result.usage.inputTokens} in, ${result.usage.outputTokens} out`);

        assertTrue(result.success, 'Codex should succeed');
        assertTrue(result.response.length > 0, 'Should have response');

        // Check expected content
        const fullText = result.response.toLowerCase() + result.codeBlocks.join('\n').toLowerCase();
        for (const expected of testCase.expectInResponse) {
          assertTrue(
            fullText.includes(expected.toLowerCase()),
            `Response should contain "${expected}"`
          );
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Test 3: Browser Flow - Stays in ChatGPT
  // -------------------------------------------------------------------------
  console.log('\n=== Test 3: Browser Flow (No CLI) ===\n');

  for (const msg of BROWSER_MESSAGES) {
    await test(`Browser only: "${msg.input.substring(0, 35)}..."`, async () => {
      const decision = routeTask(msg.input);

      // These should NOT require CLI
      assertTrue(
        !decision.requiresCLI || decision.path === 'hybrid',
        'Browser tasks should not require CLI (or be hybrid with browser-first)'
      );

      // Primary tool should be chatgpt or similar
      assertTrue(
        decision.primaryTool === 'chatgpt' || decision.path === 'browser',
        `Primary tool should be chatgpt for browser tasks, got ${decision.primaryTool}`
      );
    });
  }

  // -------------------------------------------------------------------------
  // Test 4: Hybrid Flow - Browser + CLI
  // -------------------------------------------------------------------------
  console.log('\n=== Test 4: Hybrid Flow Detection ===\n');

  const hybridMessages = [
    'Research React best practices and build me a component based on what you find',
    'Look up the latest Node.js features and create a demo script',
    'Find examples of REST APIs and build one for a todo app',
  ];

  for (const msg of hybridMessages) {
    await test(`Hybrid detection: "${msg.substring(0, 40)}..."`, async () => {
      const decision = routeTask(msg);

      assertTrue(
        decision.path === 'hybrid',
        `Expected hybrid, got ${decision.path}`
      );
      assertTrue(decision.requiresCLI, 'Hybrid should require CLI');
      assertTrue(decision.requiresWebSearch, 'Hybrid should require web search');
    });
  }

  // -------------------------------------------------------------------------
  // Test 5: Task Classification Accuracy
  // -------------------------------------------------------------------------
  console.log('\n=== Test 5: Task Classification ===\n');

  const classifications = [
    { input: 'Build a website', expectedType: 'build_product' },
    { input: 'Write a blog post', expectedType: 'build_content' },
    { input: 'Scrape data from Amazon', expectedType: 'automate' },
    { input: 'Research market trends', expectedType: 'research' },
  ];

  for (const c of classifications) {
    await test(`Classifies "${c.input}" as ${c.expectedType}`, async () => {
      const result = classifyTask(c.input);
      assertTrue(
        result.taskType === c.expectedType,
        `Expected ${c.expectedType}, got ${result.taskType}`
      );
    });
  }

  // Cleanup
  cleanupCodexAdapter();

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
