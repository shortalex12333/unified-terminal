#!/usr/bin/env npx ts-node
/**
 * Codex Adapter Verification
 *
 * Run from terminal (not inside Claude Code):
 *   cd /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/codex-adapter
 *   npx ts-node verify.ts
 *
 * This script verifies the adapter works correctly.
 */

import { spawnCodexAgent, isCodexAvailable, getSandboxMode } from './adapter';
import type { AgentConfig } from './types';

// =============================================================================
// TEST INFRASTRUCTURE
// =============================================================================

interface TestResult {
  name: string;
  pass: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => boolean | Promise<boolean>): Promise<void> {
  return Promise.resolve(fn())
    .then((pass) => {
      results.push({ name, pass });
      console.log(`${pass ? '✅' : '❌'} ${name}`);
    })
    .catch((err) => {
      results.push({ name, pass: false, error: err.message });
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}`);
    });
}

// =============================================================================
// UNIT TESTS (No CLI needed)
// =============================================================================

async function runUnitTests(): Promise<void> {
  console.log('\n📋 UNIT TESTS (Pure Logic)\n');

  await test('getSandboxMode([read]) = read-only', () => {
    return getSandboxMode(['read']) === 'read-only';
  });

  await test('getSandboxMode([read, grep]) = read-only', () => {
    return getSandboxMode(['read', 'grep']) === 'read-only';
  });

  await test('getSandboxMode([read, write]) = workspace-write', () => {
    return getSandboxMode(['read', 'write']) === 'workspace-write';
  });

  await test('getSandboxMode([read, edit]) = workspace-write', () => {
    return getSandboxMode(['read', 'edit']) === 'workspace-write';
  });
}

// =============================================================================
// INTEGRATION TESTS (Requires CLI)
// =============================================================================

async function runIntegrationTests(): Promise<void> {
  console.log('\n📋 INTEGRATION TESTS (Requires Codex CLI)\n');

  // Check availability
  const available = await isCodexAvailable();
  await test('Codex CLI is available', () => available);

  if (!available) {
    console.log('\n⚠️  Skipping spawn tests - Codex CLI not available\n');
    return;
  }

  // Spawn test
  await test('Spawn agent with simple prompt', async () => {
    const config: AgentConfig = {
      id: 'verify-001',
      name: 'verification-test',
      prompt: 'What is 2+2? Reply with just the number.',
      tools: ['read'],
      workingDir: process.cwd(),
      timeout: 30000,
    };

    console.log('   Spawning Codex agent...');
    const handle = spawnCodexAgent(config);

    // Stream output
    handle.onOutput((chunk) => {
      const preview = chunk.substring(0, 80).replace(/\n/g, '\\n');
      if (preview.trim()) {
        console.log(`   [stream] ${preview}...`);
      }
    });

    const result = await handle.onComplete();

    console.log(`   Status: ${result.status}`);
    console.log(`   Exit code: ${result.exitCode}`);
    console.log(`   Duration: ${result.duration}ms`);

    return result.status === 'completed' && result.exitCode === 0;
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           CODEX ADAPTER VERIFICATION                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await runUnitTests();
  await runIntegrationTests();

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Total:  ${results.length}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`\n  VERDICT: ${failed === 0 ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
