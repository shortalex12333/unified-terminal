/**
 * Unified Verification Harness
 *
 * Tests all adapters against specification requirements.
 * Run with: npx ts-node tests/harness.ts
 */

import { getAdapter, getAvailableRuntimes } from '../src/factory';
import {
  isReadOnly,
  hasWritePermission,
  getCodexSandbox,
  getGeminiApproval,
  PLUGINS,
  isCompatible,
} from '../src/permissions';
import type { Runtime, Tool } from '../src/types';

// =============================================================================
// TEST INFRASTRUCTURE
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function test(name: string, expected: string, actual: string, condition: boolean): void {
  results.push({ name, expected, actual, passed: condition });
  const icon = condition ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (!condition) {
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual:   ${actual}`);
  }
}

// =============================================================================
// PERMISSION TESTS
// =============================================================================

function testPermissions(): void {
  console.log('\n📋 Permission Logic Tests\n');

  // isReadOnly tests
  test(
    'isReadOnly([read]) = true',
    'true',
    String(isReadOnly(['read'])),
    isReadOnly(['read']) === true
  );

  test(
    'isReadOnly([read, bash]) = true',
    'true',
    String(isReadOnly(['read', 'bash'])),
    isReadOnly(['read', 'bash']) === true
  );

  test(
    'isReadOnly([read, write]) = false',
    'false',
    String(isReadOnly(['read', 'write'])),
    isReadOnly(['read', 'write']) === false
  );

  test(
    'isReadOnly([read, edit]) = false',
    'false',
    String(isReadOnly(['read', 'edit'])),
    isReadOnly(['read', 'edit']) === false
  );

  // hasWritePermission tests
  test(
    'hasWritePermission([read]) = false',
    'false',
    String(hasWritePermission(['read'])),
    hasWritePermission(['read']) === false
  );

  test(
    'hasWritePermission([write]) = true',
    'true',
    String(hasWritePermission(['write'])),
    hasWritePermission(['write']) === true
  );
}

// =============================================================================
// CODEX SANDBOX TESTS
// =============================================================================

function testCodexSandbox(): void {
  console.log('\n📋 Codex Sandbox Mapping Tests\n');

  test(
    'getCodexSandbox([read]) = read-only',
    'read-only',
    getCodexSandbox(['read']),
    getCodexSandbox(['read']) === 'read-only'
  );

  test(
    'getCodexSandbox([read, bash]) = read-only',
    'read-only',
    getCodexSandbox(['read', 'bash']),
    getCodexSandbox(['read', 'bash']) === 'read-only'
  );

  test(
    'getCodexSandbox([read, write]) = workspace-write',
    'workspace-write',
    getCodexSandbox(['read', 'write']),
    getCodexSandbox(['read', 'write']) === 'workspace-write'
  );

  test(
    'getCodexSandbox([read, write, bash]) = workspace-write',
    'workspace-write',
    getCodexSandbox(['read', 'write', 'bash']),
    getCodexSandbox(['read', 'write', 'bash']) === 'workspace-write'
  );
}

// =============================================================================
// GEMINI APPROVAL TESTS
// =============================================================================

function testGeminiApproval(): void {
  console.log('\n📋 Gemini Approval Mapping Tests\n');

  test(
    'getGeminiApproval([read]) = plan',
    'plan',
    getGeminiApproval(['read']),
    getGeminiApproval(['read']) === 'plan'
  );

  test(
    'getGeminiApproval([read, bash]) = plan',
    'plan',
    getGeminiApproval(['read', 'bash']),
    getGeminiApproval(['read', 'bash']) === 'plan'
  );

  test(
    'getGeminiApproval([read, write]) = yolo',
    'yolo',
    getGeminiApproval(['read', 'write']),
    getGeminiApproval(['read', 'write']) === 'yolo'
  );

  test(
    'getGeminiApproval([read, write, bash]) = yolo',
    'yolo',
    getGeminiApproval(['read', 'write', 'bash']),
    getGeminiApproval(['read', 'write', 'bash']) === 'yolo'
  );
}

// =============================================================================
// PLUGIN REQUIREMENTS TESTS
// =============================================================================

function testPluginRequirements(): void {
  console.log('\n📋 Plugin Requirements Tests\n');

  // Critical: read-only plugins
  test(
    'code-reviewer is read-only',
    'true',
    String(PLUGINS['code-reviewer'].readOnly),
    PLUGINS['code-reviewer'].readOnly === true
  );

  test(
    'security-reviewer is read-only',
    'true',
    String(PLUGINS['security-reviewer'].readOnly),
    PLUGINS['security-reviewer'].readOnly === true
  );

  // Critical: gsd-planner and gsd-verifier are NOT read-only (they write docs)
  test(
    'gsd-planner is NOT read-only (writes PLAN.md)',
    'false',
    String(PLUGINS['gsd-planner'].readOnly),
    PLUGINS['gsd-planner'].readOnly === false
  );

  test(
    'gsd-verifier is NOT read-only (writes VERIFICATION.md)',
    'false',
    String(PLUGINS['gsd-verifier'].readOnly),
    PLUGINS['gsd-verifier'].readOnly === false
  );

  // Check gsd-planner has write tools
  const plannerTools = PLUGINS['gsd-planner'].tools;
  test(
    'gsd-planner has write tool',
    'true',
    String(plannerTools.includes('write')),
    plannerTools.includes('write')
  );

  // Check gsd-verifier has write tools
  const verifierTools = PLUGINS['gsd-verifier'].tools;
  test(
    'gsd-verifier has write tool',
    'true',
    String(verifierTools.includes('write')),
    verifierTools.includes('write')
  );
}

// =============================================================================
// ADAPTER CAPABILITY TESTS
// =============================================================================

function testCapabilities(): void {
  console.log('\n📋 Adapter Capability Tests\n');

  const codex = getAdapter('codex');
  const gemini = getAdapter('gemini');

  // Codex capabilities
  test(
    'Codex supports session resume',
    'true',
    String(codex.capabilities().sessionResume),
    codex.capabilities().sessionResume === true
  );

  test(
    'Codex supports JSON output',
    'true',
    String(codex.capabilities().jsonOutput),
    codex.capabilities().jsonOutput === true
  );

  // Gemini capabilities - CRITICAL: no session resume
  test(
    'Gemini does NOT support session resume',
    'false',
    String(gemini.capabilities().sessionResume),
    gemini.capabilities().sessionResume === false
  );

  test(
    'Gemini supports JSON output',
    'true',
    String(gemini.capabilities().jsonOutput),
    gemini.capabilities().jsonOutput === true
  );

  // Tool support
  const codexTools = codex.capabilities().supportedTools;
  const geminiTools = gemini.capabilities().supportedTools;

  test(
    'Codex supports grep tool',
    'true',
    String(codexTools.includes('grep')),
    codexTools.includes('grep')
  );

  test(
    'Gemini supports grep tool',
    'true',
    String(geminiTools.includes('grep')),
    geminiTools.includes('grep')
  );
}

// =============================================================================
// AVAILABILITY TESTS
// =============================================================================

async function testAvailability(): Promise<void> {
  console.log('\n📋 Adapter Availability Tests\n');

  const codex = getAdapter('codex');
  const gemini = getAdapter('gemini');

  const codexAvailable = await codex.isAvailable();
  const geminiAvailable = await gemini.isAvailable();

  test(
    'Codex availability check runs',
    'boolean',
    typeof codexAvailable,
    typeof codexAvailable === 'boolean'
  );

  test(
    'Gemini availability check runs',
    'boolean',
    typeof geminiAvailable,
    typeof geminiAvailable === 'boolean'
  );

  console.log(`\n   Codex available: ${codexAvailable}`);
  console.log(`   Gemini available: ${geminiAvailable}`);
}

// =============================================================================
// COMPATIBILITY TESTS
// =============================================================================

function testCompatibility(): void {
  console.log('\n📋 Plugin Compatibility Tests\n');

  // GSD workers should work on both
  test(
    'gsd-executor compatible with Codex',
    'true',
    String(isCompatible('gsd-executor', 'codex')),
    isCompatible('gsd-executor', 'codex')
  );

  test(
    'gsd-executor compatible with Gemini',
    'true',
    String(isCompatible('gsd-executor', 'gemini')),
    isCompatible('gsd-executor', 'gemini')
  );

  // Code reviewers should work on both (read-only)
  test(
    'code-reviewer compatible with Codex',
    'true',
    String(isCompatible('code-reviewer', 'codex')),
    isCompatible('code-reviewer', 'codex')
  );

  test(
    'code-reviewer compatible with Gemini',
    'true',
    String(isCompatible('code-reviewer', 'gemini')),
    isCompatible('code-reviewer', 'gemini')
  );

  // Image gen should NOT work on CLI adapters
  test(
    'worker-image-gen NOT compatible with Codex',
    'false',
    String(isCompatible('worker-image-gen', 'codex')),
    !isCompatible('worker-image-gen', 'codex')
  );

  test(
    'worker-image-gen NOT compatible with Gemini',
    'false',
    String(isCompatible('worker-image-gen', 'gemini')),
    !isCompatible('worker-image-gen', 'gemini')
  );
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     UNIFIED ADAPTER VERIFICATION HARNESS                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  testPermissions();
  testCodexSandbox();
  testGeminiApproval();
  testPluginRequirements();
  testCapabilities();
  testCompatibility();
  await testAvailability();

  // Summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                    VERIFICATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nVERDICT: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}`);
      });
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(console.error);
