/**
 * System Scanner Tests
 *
 * Tests for the system scanner and auto-installer modules.
 * Run with: npx ts-node tests/system-scanner.test.ts
 */

import { scanSystem, isToolInstalled, getToolInfo, SystemProfile } from '../src/main/system-scanner';
import { INSTALL_STEPS, estimateInstallTime, getInstallOrder } from '../src/main/auto-installer';

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('System Scanner & Auto-Installer Tests');
  console.log('='.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  // Test 1: Full system scan
  console.log('Test 1: Full system scan');
  try {
    const profile = await scanSystem();

    if (typeof profile.platform === 'string' && profile.platform.length > 0) {
      console.log('  [PASS] Platform detected:', profile.platform);
      passed++;
    } else {
      console.log('  [FAIL] Platform not detected');
      failed++;
    }

    if (typeof profile.arch === 'string' && profile.arch.length > 0) {
      console.log('  [PASS] Architecture detected:', profile.arch);
      passed++;
    } else {
      console.log('  [FAIL] Architecture not detected');
      failed++;
    }

    if (profile.tools && Object.keys(profile.tools).length === 7) {
      console.log('  [PASS] All 7 tools checked');
      passed++;
    } else {
      console.log('  [FAIL] Not all tools checked');
      failed++;
    }

    if (Array.isArray(profile.missingTools)) {
      console.log('  [PASS] Missing tools array present:', profile.missingTools.join(', ') || 'none');
      passed++;
    } else {
      console.log('  [FAIL] Missing tools array not present');
      failed++;
    }
  } catch (err) {
    console.log('  [FAIL] Error during scan:', err);
    failed++;
  }
  console.log('');

  // Test 2: Individual tool check
  console.log('Test 2: Individual tool checks');
  const toolsToCheck: Array<keyof SystemProfile['tools']> = ['homebrew', 'git', 'node', 'python'];

  for (const tool of toolsToCheck) {
    try {
      const installed = await isToolInstalled(tool);
      console.log(`  [PASS] ${tool}: ${installed ? 'installed' : 'not installed'}`);
      passed++;
    } catch (err) {
      console.log(`  [FAIL] Error checking ${tool}:`, err);
      failed++;
    }
  }
  console.log('');

  // Test 3: Get tool info
  console.log('Test 3: Get tool info');
  try {
    const nodeInfo = await getToolInfo('node');
    if (nodeInfo && nodeInfo.name === 'Node.js') {
      console.log('  [PASS] Node.js info retrieved');
      if (nodeInfo.version) {
        console.log('         Version:', nodeInfo.version);
      }
      if (nodeInfo.path) {
        console.log('         Path:', nodeInfo.path);
      }
      passed++;
    } else {
      console.log('  [FAIL] Node.js info not retrieved correctly');
      failed++;
    }
  } catch (err) {
    console.log('  [FAIL] Error getting Node.js info:', err);
    failed++;
  }
  console.log('');

  // Test 4: Install steps configuration
  console.log('Test 4: Install steps configuration');
  if (INSTALL_STEPS.length === 11) {
    console.log('  [PASS] 11 install steps defined');
    passed++;
  } else {
    console.log('  [FAIL] Expected 11 install steps, got', INSTALL_STEPS.length);
    failed++;
  }

  const totalWeight = INSTALL_STEPS.reduce((sum, step) => sum + step.weight, 0);
  if (totalWeight === 100) {
    console.log('  [PASS] Total weight equals 100');
    passed++;
  } else {
    console.log('  [FAIL] Total weight should be 100, got', totalWeight);
    failed++;
  }
  console.log('');

  // Test 5: Install order
  console.log('Test 5: Install order (dependency handling)');
  const brewDependents = INSTALL_STEPS.filter(s => s.requiresBrew);
  const nodeDependents = INSTALL_STEPS.filter(s => s.requiresNode);

  console.log('  Tools requiring Homebrew:', brewDependents.map(s => s.name).join(', '));
  console.log('  Tools requiring Node.js:', nodeDependents.map(s => s.name).join(', '));

  const xcodeIndex = INSTALL_STEPS.findIndex(s => s.key === 'xcodeClt');
  const brewIndex = INSTALL_STEPS.findIndex(s => s.key === 'homebrew');
  const nodeIndex = INSTALL_STEPS.findIndex(s => s.key === 'node');

  if (xcodeIndex === 0) {
    console.log('  [PASS] Xcode CLT is first in install order');
    passed++;
  } else {
    console.log('  [FAIL] Xcode CLT should be first');
    failed++;
  }

  if (brewIndex > xcodeIndex && nodeIndex > brewIndex) {
    console.log('  [PASS] Install order: Xcode -> Homebrew -> Node.js');
    passed++;
  } else {
    console.log('  [FAIL] Install order should be Xcode -> Homebrew -> Node.js');
    failed++;
  }
  console.log('');

  // Test 6: Time estimation
  console.log('Test 6: Time estimation');
  const allToolsTime = estimateInstallTime(INSTALL_STEPS.map(s => s.key));
  const singleToolTime = estimateInstallTime(['git']);

  if (allToolsTime > 0) {
    console.log('  [PASS] All tools estimated time:', allToolsTime, 'seconds');
    passed++;
  } else {
    console.log('  [FAIL] All tools time should be > 0');
    failed++;
  }

  if (singleToolTime > 0 && singleToolTime < allToolsTime) {
    console.log('  [PASS] Single tool (git) estimated time:', singleToolTime, 'seconds');
    passed++;
  } else {
    console.log('  [FAIL] Single tool time should be > 0 and < all tools time');
    failed++;
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
