/**
 * Claude Adapter Tests
 *
 * Tests the Claude Code adapter: tool name translation, YAML frontmatter
 * generation, temp file lifecycle, oversized prompt rejection, capabilities,
 * and factory registration.
 *
 * Run with: npx ts-node tests/claude-adapter.test.ts
 */

import { mapToolName, generateFrontmatter, writeTempAgentFile, cleanupTempFile } from '../src/adapters/claude/frontmatter';
import { ClaudeAdapter } from '../src/adapters/claude/adapter';
import { getAdapter, clearAdapterCache } from '../src/adapters/factory';
import type { AgentConfig } from '../src/adapters/types';
import * as fs from 'fs/promises';

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

function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Claude Adapter Tests');
  console.log('='.repeat(60));

  // ==========================================================================
  console.log('\n--- Tool Name Translation ---\n');
  // ==========================================================================

  await test('mapToolName translates all 7 entries + passthrough', () => {
    assertEqual(mapToolName('read'), 'Read', 'read -> Read');
    assertEqual(mapToolName('write'), 'Write', 'write -> Write');
    assertEqual(mapToolName('bash'), 'Bash', 'bash -> Bash');
    assertEqual(mapToolName('edit'), 'Edit', 'edit -> Edit');
    assertEqual(mapToolName('web_search'), 'WebSearch', 'web_search -> WebSearch');
    assertEqual(mapToolName('grep'), 'Grep', 'grep -> Grep');
    assertEqual(mapToolName('glob'), 'Glob', 'glob -> Glob');
    assertEqual(mapToolName('unknown_tool'), 'unknown_tool', 'unknown_tool passthrough');
  });

  // ==========================================================================
  console.log('\n--- YAML Frontmatter Generation ---\n');
  // ==========================================================================

  await test('generateFrontmatter produces correct YAML structure', () => {
    const config: AgentConfig = {
      id: 'test-1',
      name: 'test',
      role: 'test',
      model: 'claude-sonnet-4-6',
      tools: ['read', 'write', 'bash'],
      maxTokens: 0,
      prompt: 'do the thing',
      declaredFiles: [],
      workingDir: '/tmp',
      timeout: 5000,
    };

    const output = generateFrontmatter(config);

    assertTrue(output.startsWith('---'), 'Starts with ---');
    assertTrue(output.includes('model: claude-sonnet-4-6'), 'Contains model');
    assertTrue(output.includes('allowedTools:'), 'Contains allowedTools');
    assertTrue(output.includes('  - Read'), 'Contains Read (PascalCase, 2-space indent)');
    assertTrue(output.includes('  - Write'), 'Contains Write (PascalCase, 2-space indent)');
    assertTrue(output.includes('  - Bash'), 'Contains Bash (PascalCase, 2-space indent)');
    assertTrue(output.includes('maxTurns: 10'), 'maxTokens=0 -> default maxTurns 10');
    assertTrue(output.includes('# Task'), 'Contains # Task header');
    assertTrue(output.includes('do the thing'), 'Contains prompt body');
  });

  await test('generateFrontmatter derives maxTurns from maxTokens', () => {
    const baseConfig: AgentConfig = {
      id: 'test-2',
      name: 'test',
      role: 'test',
      model: 'claude-sonnet-4-6',
      tools: ['read'],
      maxTokens: 8000,
      prompt: 'test',
      declaredFiles: [],
      workingDir: '/tmp',
      timeout: 5000,
    };

    // 8000 / 4000 = 2
    const output1 = generateFrontmatter(baseConfig);
    assertTrue(output1.includes('maxTurns: 2'), '8000 tokens -> maxTurns 2');

    // 400000 / 4000 = 100 (clamped to 100)
    const output2 = generateFrontmatter({ ...baseConfig, maxTokens: 400000 });
    assertTrue(output2.includes('maxTurns: 100'), '400000 tokens -> maxTurns 100 (clamped)');

    // 1000 / 4000 = 0.25, floor = 0, max(1, 0) = 1
    const output3 = generateFrontmatter({ ...baseConfig, maxTokens: 1000 });
    assertTrue(output3.includes('maxTurns: 1'), '1000 tokens -> maxTurns 1 (floor, min 1)');
  });

  // ==========================================================================
  console.log('\n--- Temp File Lifecycle ---\n');
  // ==========================================================================

  let tempFilePath: string = '';

  await test('writeTempAgentFile creates file, cleanupTempFile deletes it', async () => {
    const content = '---\nmodel: test\n---\n\n# Task\n\nhello\n';
    tempFilePath = await writeTempAgentFile(content);

    assertTrue(tempFilePath.includes('claude-agent-'), 'Path includes claude-agent-');
    assertTrue(tempFilePath.endsWith('.md'), 'Path ends with .md');

    const readBack = await fs.readFile(tempFilePath, 'utf-8');
    assertEqual(readBack, content, 'File content matches exactly');

    await cleanupTempFile(tempFilePath);

    let fileGone = false;
    try {
      await fs.access(tempFilePath);
    } catch {
      fileGone = true;
    }
    assertTrue(fileGone, 'File deleted after cleanupTempFile');
  });

  await test('Double cleanup is idempotent', async () => {
    // tempFilePath was already cleaned up in the previous test.
    // Calling cleanup again must NOT throw.
    await cleanupTempFile(tempFilePath);
    // If we reach here without throwing, the test passes.
  });

  // ==========================================================================
  console.log('\n--- ClaudeAdapter ---\n');
  // ==========================================================================

  await test('Oversized prompt returns failed handle', async () => {
    const adapter = new ClaudeAdapter();
    const config: AgentConfig = {
      id: 'oversize-test',
      name: 'test',
      role: 'test',
      model: 'claude-sonnet-4-6',
      tools: ['read'],
      maxTokens: 0,
      prompt: 'x'.repeat(400_001 * 4),
      declaredFiles: [],
      workingDir: '/tmp',
      timeout: 5000,
    };

    const handle = await adapter.spawn(config);
    assertEqual(handle.id, 'oversize-test', 'handle.id matches');
    assertEqual(handle.process, null, 'process is null for failed handle');

    const result = await handle.onComplete();
    assertEqual(result.status, 'failed', 'status is failed');
    assertTrue(
      result.error !== undefined && result.error.includes('Prompt too large'),
      'error includes "Prompt too large"'
    );
    assertEqual(result.filesCreated.length, 0, 'no files created');
    assertEqual(result.tokensUsed.input, 0, 'zero input tokens');
    assertEqual(result.runtime, 'claude' as any, 'runtime is claude');
  });

  await test('capabilities() returns correct values', () => {
    const adapter = new ClaudeAdapter();
    const caps = adapter.capabilities();

    assertEqual(caps.sessionResume, true, 'sessionResume is true');
    assertEqual(caps.jsonOutput, true, 'jsonOutput is true');
    assertEqual(caps.toolPermissions, true, 'toolPermissions is true');
    assertEqual(caps.models.fast, 'claude-haiku-4-5', 'fast model');
    assertEqual(caps.models.standard, 'claude-sonnet-4-6', 'standard model');
    assertEqual(caps.models.reasoning, 'claude-opus-4-6', 'reasoning model');
    assertTrue(caps.supportedTools.includes('read' as any), 'supportedTools includes read');
    assertTrue(caps.supportedTools.includes('web_search' as any), 'supportedTools includes web_search');
    assertEqual(adapter.runtime, 'claude' as any, 'adapter.runtime is claude');
  });

  await test('Factory returns ClaudeAdapter singleton', () => {
    clearAdapterCache();
    const first = getAdapter('claude');
    assertTrue(first instanceof ClaudeAdapter, 'getAdapter(claude) returns ClaudeAdapter');
    const second = getAdapter('claude');
    assertTrue(first === second, 'Same instance returned on second call (singleton)');
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
