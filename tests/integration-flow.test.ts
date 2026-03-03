/**
 * Integration Flow Test
 *
 * Tests the full flow:
 * 1. CLI spawn and communication (Codex)
 * 2. ChatGPT DOM injection/capture simulation
 * 3. Task routing decisions
 *
 * Run with: npx ts-node tests/integration-flow.test.ts
 */

import { spawn, ChildProcess } from 'child_process';
import { getCLIRunner, cleanupCLIRunner } from '../src/main/cli-runner';
import { routeTask } from '../src/main/task-router';
import { classifyTask } from '../src/intake/task-classifier';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve(fn())
    .then(() => {
      passed++;
      console.log(`  [PASS] ${name}`);
    })
    .catch((err) => {
      failed++;
      console.log(`  [FAIL] ${name}`);
      console.log(`         ${err instanceof Error ? err.message : err}`);
    });
}

function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition: boolean, msg?: string): void {
  if (!condition) {
    throw new Error(msg || 'Assertion failed');
  }
}

// ============================================================================
// TEST: CODEX CLI SPAWN
// ============================================================================

async function testCodexSpawn(): Promise<void> {
  console.log('\n=== Test 1: Codex CLI Spawn ===\n');

  await test('Codex is installed', async () => {
    const result = await runCommand('which codex');
    assertTrue(result.includes('/codex'), 'Codex binary not found');
  });

  await test('Codex version check', async () => {
    const result = await runCommand('codex --version');
    assertTrue(result.includes('codex'), 'Version check failed');
  });

  await test('Codex help accessible', async () => {
    const result = await runCommand('codex --help');
    assertTrue(result.includes('Usage:'), 'Help not accessible');
  });

  await test('Codex exec mode available', async () => {
    const result = await runCommand('codex exec --help');
    assertTrue(result.includes('non-interactively'), 'Exec mode not available');
  });
}

// ============================================================================
// TEST: CLI RUNNER INTEGRATION
// ============================================================================

async function testCLIRunner(): Promise<void> {
  console.log('\n=== Test 2: CLI Runner Integration ===\n');

  const runner = getCLIRunner();

  await test('CLI Runner spawns echo command', async () => {
    const processId = runner.spawn('echo', ['hello from CLI runner']);
    assertTrue(processId.startsWith('proc_'), 'Invalid process ID');

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 500));

    const info = runner.getProcess(processId);
    assertTrue(info !== null, 'Process info not found');
    assertEqual(info?.status, 'completed', 'Process should complete');
  });

  await test('CLI Runner captures output', async () => {
    let capturedOutput = '';

    runner.on('output', (data) => {
      capturedOutput += data.data;
    });

    const processId = runner.spawn('echo', ['test output capture']);
    await new Promise(resolve => setTimeout(resolve, 500));

    assertTrue(capturedOutput.includes('test output capture'), 'Output not captured');
  });

  await test('CLI Runner can spawn Codex --version', async () => {
    const processId = runner.spawn('codex', ['--version']);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const info = runner.getProcess(processId);
    assertTrue(info !== null, 'Codex process not found');
  });

  // Cleanup
  runner.killAll();
  runner.removeAllListeners();
}

// ============================================================================
// TEST: TASK ROUTING FOR CLI VS BROWSER
// ============================================================================

async function testTaskRouting(): Promise<void> {
  console.log('\n=== Test 3: Task Routing (CLI vs Browser) ===\n');

  // Tasks that should go to CLI (local)
  const cliTasks = [
    'Build me a React landing page',
    'Create a Python script to process CSV files',
    'Set up a Node.js API with Express',
    'Generate a Next.js application',
    'Write code to scrape websites',
  ];

  // Tasks that should stay in browser (pure conversation/research)
  const browserTasks = [
    'What is the best way to learn cooking?',
    'Help me write an email to my boss',
    'Summarize this article for me',
    'Give me ideas for my startup name',
    'Explain the history of computers',
  ];

  for (const task of cliTasks) {
    await test(`Routes to LOCAL: "${task.substring(0, 40)}..."`, () => {
      const decision = routeTask(task);
      assertTrue(
        decision.path === 'local' || decision.path === 'hybrid',
        `Expected local/hybrid, got ${decision.path}`
      );
      assertTrue(decision.requiresCLI, 'Should require CLI');
    });
  }

  for (const task of browserTasks) {
    await test(`Routes to BROWSER/HYBRID: "${task.substring(0, 40)}..."`, () => {
      const decision = routeTask(task);
      assertTrue(
        decision.path === 'browser' || decision.path === 'hybrid',
        `Expected browser/hybrid, got ${decision.path}`
      );
      // Browser tasks should NOT require CLI for core functionality
      assertTrue(!decision.requiresCLI || decision.path === 'hybrid',
        'Pure browser task should not require CLI');
    });
  }
}

// ============================================================================
// TEST: CODEX PROMPT SIMULATION
// ============================================================================

async function testCodexPromptFlow(): Promise<void> {
  console.log('\n=== Test 4: Codex Prompt Flow Simulation ===\n');

  await test('Classify build task for Codex', () => {
    const result = classifyTask('Build me a landing page with React');
    assertEqual(result.taskType, 'build_product', 'Should classify as build');
    assertTrue(result.suggestedPlugins.includes('claude'), 'Should suggest claude');
  });

  await test('Route build task to local CLI', () => {
    const decision = routeTask('Create a REST API with Node.js');
    assertEqual(decision.path, 'local', 'Should route to local');
    assertTrue(decision.requiresCLI, 'Should require CLI');
    assertTrue(
      decision.suggestedPlugins.includes('claude-code') ||
      decision.suggestedPlugins.includes('codex'),
      'Should suggest code tool'
    );
  });

  await test('Codex exec with simple prompt (dry run)', async () => {
    // Test that we CAN spawn codex exec (but don't actually run a real task)
    // This verifies the spawn mechanism works
    const runner = getCLIRunner();

    // Just test spawning with --help to verify the path works
    const processId = runner.spawn('codex', ['exec', '--help']);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const info = runner.getProcess(processId);
    assertTrue(info !== null, 'Codex exec spawn failed');

    runner.killAll();
  });
}

// ============================================================================
// TEST: CHATGPT DOM SELECTORS
// ============================================================================

async function testChatGPTSelectors(): Promise<void> {
  console.log('\n=== Test 5: ChatGPT DOM Selectors ===\n');

  // Import selectors
  const { CHATGPT_SELECTORS } = await import('../src/utils/dom-selectors');

  await test('Textarea selectors defined', () => {
    assertTrue(Array.isArray(CHATGPT_SELECTORS.textarea), 'Textarea selectors missing');
    assertTrue(CHATGPT_SELECTORS.textarea.length > 0, 'No textarea selectors');
  });

  await test('Send button selectors defined', () => {
    assertTrue(Array.isArray(CHATGPT_SELECTORS.sendButton), 'Send button selectors missing');
    assertTrue(CHATGPT_SELECTORS.sendButton.length > 0, 'No send button selectors');
  });

  await test('Response container selectors defined', () => {
    assertTrue(Array.isArray(CHATGPT_SELECTORS.responseContainer), 'Response selectors missing');
  });

  await test('Stop button selectors defined', () => {
    assertTrue(Array.isArray(CHATGPT_SELECTORS.stopButton), 'Stop button selectors missing');
  });
}

// ============================================================================
// HELPER: Run shell command
// ============================================================================

function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin`,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout + stderr);
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });

    child.on('error', reject);

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Command timed out'));
    }, 10000);
  });
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Integration Flow Tests');
  console.log('='.repeat(60));

  await testCodexSpawn();
  await testCLIRunner();
  await testTaskRouting();
  await testCodexPromptFlow();
  await testChatGPTSelectors();

  // Cleanup
  cleanupCLIRunner();

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
