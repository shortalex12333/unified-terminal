/**
 * Storekeeper Tests — Plan-Level Tool Provisioning
 *
 * Tests for provision() pure function: foundation skills, per-step selection,
 * keyword matching, token budgets, tier limits, plugin resolution, audit trail.
 *
 * Run with: npx ts-node tests/storekeeper.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// MOCK ELECTRON (storekeeper imports types from step-scheduler which imports electron)
// ============================================================================

const mockIpcMain = {
  handle: (_channel: string, _handler: Function) => {},
  removeHandler: (_channel: string) => {},
};

class MockBrowserWindow {
  isDestroyed() { return false; }
  webContents = { send: (_channel: string, _data: any) => {} };
}

// @ts-ignore - mocking electron
require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: {
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
  },
};

// ============================================================================
// MOCK DEPENDENCIES (storekeeper's imports chain into enforcement, adapters, etc.)
// ============================================================================

const srcDir = path.resolve(__dirname, '..', 'src');

function mockModule(modulePath: string, exports: Record<string, any>): void {
  // @ts-ignore - mocking modules
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  };
}

const noopFn = (..._args: any[]) => {};

// Mock events (used transitively)
mockModule(path.resolve(srcDir, 'main', 'events.ts'), {
  bodyguardEvents: { gateStart: noopFn, checking: noopFn, checkComplete: noopFn, pass: noopFn, fail: noopFn, failHeuristic: noopFn, failDefinitive: noopFn },
  spineEvents: { refreshed: noopFn, compared: noopFn, buildStart: noopFn, buildComplete: noopFn },
  schedulerEvents: { planStart: noopFn, stepStart: noopFn, stepProgress: noopFn, stepDone: noopFn, stepFailed: noopFn, stepSkipped: noopFn, needsUser: noopFn, planComplete: noopFn },
  enforcerEvents: { checkRun: noopFn, checkStart: noopFn, checkPass: noopFn, checkFail: noopFn, checkTimeout: noopFn },
  conductorEvents: { classifyStart: noopFn, classifyComplete: noopFn, planReady: noopFn, replan: noopFn, sessionStart: noopFn, error: noopFn },
  workerEvents: { spawn: noopFn, fileCreated: noopFn, fileModified: noopFn, complete: noopFn, error: noopFn, timeout: noopFn },
  rateLimitEvents: { hit: noopFn, deferred: noopFn, resumed: noopFn },
  imageGenEvents: { start: noopFn, progress: noopFn, complete: noopFn, error: noopFn },
  deployEvents: { start: noopFn, progress: noopFn, complete: noopFn, error: noopFn },
  gitEvents: { start: noopFn, complete: noopFn, commit: noopFn, push: noopFn },
  paEvents: { querySent: noopFn, queryResponse: noopFn, queryTimeout: noopFn, interruptRouted: noopFn },
  systemEvents: { emitStatus: noopFn, onStatus: () => noopFn, onSource: () => noopFn, onAll: () => noopFn, emit: noopFn, on: noopFn, off: noopFn },
  emit: noopFn,
  emitEvent: noopFn,
  checkpointEvents: { preDeployWaiting: noopFn, preDeployResolved: noopFn, firstOutputWaiting: noopFn, firstOutputResolved: noopFn, midpointWaiting: noopFn, midpointResolved: noopFn },
});

// Mock enforcement constants
mockModule(path.resolve(srcDir, 'enforcement', 'constants.ts'), {
  CIRCUIT_BREAKER: { MAX_STEP_RETRIES: 3, DEFINITIVE_FAIL_RETRIES: 0, HEURISTIC_FAIL_OPTIONS: ['retry', 'skip', 'stop'], DEFINITIVE_FAIL_OPTIONS: ['retry', 'stop'] },
  ENFORCER_RETRY_POLICIES: {},
  TOKEN_THRESHOLDS: {},
});
mockModule(path.resolve(srcDir, 'enforcement', 'types.ts'), {});
mockModule(path.resolve(srcDir, 'enforcement', 'enforcer.ts'), { runCheck: async () => ({ passed: true }) });
mockModule(path.resolve(srcDir, 'enforcement', 'bodyguard.ts'), { gateCheck: async () => ({ gate: { verdict: 'PASS' } }) });
mockModule(path.resolve(srcDir, 'enforcement', 'spine.ts'), { buildSpine: async () => ({}), compareSpines: () => ({}) });
mockModule(path.resolve(srcDir, 'enforcement', 'index.ts'), {
  CIRCUIT_BREAKER: { MAX_STEP_RETRIES: 3 },
  ENFORCER_RETRY_POLICIES: {},
  gateCheck: async () => ({ gate: { verdict: 'PASS' } }),
  buildSpine: async () => ({}),
  compareSpines: () => ({}),
});

// Mock adapters
mockModule(path.resolve(srcDir, 'adapters', 'types.ts'), {});
mockModule(path.resolve(srcDir, 'adapters', 'permissions.ts'), { checkPermission: () => true });
mockModule(path.resolve(srcDir, 'adapters', 'factory.ts'), {
  getAdapter: () => ({ isAvailable: async () => false, spawn: async () => { throw new Error('mock'); } }),
  getAvailableRuntimes: async () => [],
  selectRuntime: () => 'codex',
  clearAdapterCache: () => {},
});
mockModule(path.resolve(srcDir, 'adapters', 'codex', 'adapter.ts'), { CodexAdapter: class {} });
mockModule(path.resolve(srcDir, 'adapters', 'claude', 'adapter.ts'), { ClaudeAdapter: class {} });

// Mock skills
mockModule(path.resolve(srcDir, 'skills', 'selector.ts'), { selectSkills: async () => ({ skills: [], reasoning: 'Mock' }) });
mockModule(path.resolve(srcDir, 'skills', 'validator.ts'), { validateSelection: (s: any) => s, MAX_SKILLS_PER_WORKER: 3, MAX_SKILL_INJECTION_TOKENS: 4000 });
mockModule(path.resolve(srcDir, 'skills', 'verify-parser.ts'), { parseVerifyBlock: () => [] });
mockModule(path.resolve(srcDir, 'skills', 'critical-checks.ts'), { CRITICAL_SKILL_CHECKS: {}, getChecksForSkill: () => [] });
mockModule(path.resolve(srcDir, 'skills', 'verify-sandbox.ts'), { isCommandAllowed: () => ({ allowed: false }), executeVerifyCommand: async () => ({ exitCode: 0 }) });
mockModule(path.resolve(srcDir, 'skills', 'index.ts'), {
  selectSkills: async () => ({ skills: [], reasoning: 'Mock' }),
  validateSelection: (s: any) => s,
  MAX_SKILLS_PER_WORKER: 3,
  MAX_SKILL_INJECTION_TOKENS: 4000,
  parseVerifyBlock: () => [],
  CRITICAL_SKILL_CHECKS: {},
  getChecksForSkill: () => [],
  isCommandAllowed: () => ({ allowed: false }),
  executeVerifyCommand: async () => ({ exitCode: 0 }),
});

// Mock glue
mockModule(path.resolve(srcDir, 'glue', 'assemble-prompt.ts'), { assemblePrompt: () => ({ skillSections: '', spineContext: '', userInput: '', totalTokens: 0 }) });
mockModule(path.resolve(srcDir, 'glue', 'normalizer.ts'), { normalize: () => ({}) });
mockModule(path.resolve(srcDir, 'glue', 'index.ts'), { assemblePrompt: () => ({}), normalize: () => ({}) });

// Mock storekeeper runtime modules (not under test — we test provision.ts)
mockModule(path.resolve(srcDir, 'storekeeper', 'storekeeper.ts'), {
  Storekeeper: class { async processRequest() { return {}; } async buildContext() { return {}; } async cleanupStep() {} },
  getStorekeeper: () => ({ processRequest: async () => ({}), buildContext: async () => ({}), cleanupStep: async () => {} }),
  resetStorekeeper: noopFn,
});
mockModule(path.resolve(srcDir, 'storekeeper', 'approval-engine.ts'), { processApproval: () => ({ status: 'READY', approvedSkills: [], deniedSkills: [], approvedMcp: [], deniedMcp: [], approvedPlugins: [], injectionSummary: {} }) });
mockModule(path.resolve(srcDir, 'storekeeper', 'inventory.ts'), { loadInventory: () => ({ skills: [], mcp: [], plugins: [] }), findSkill: () => undefined, findMcp: () => undefined, findPlugin: () => undefined, getTotalTokens: () => 0 });
mockModule(path.resolve(srcDir, 'storekeeper', 'injector.ts'), { injectTools: () => ({ assembledPrompt: '', mcp: {}, plugin: '', config: {}, meta: {} }), buildExecutionContext: () => ({}) });
mockModule(path.resolve(srcDir, 'storekeeper', 'cleanup.ts'), { cleanupStep: noopFn, cleanupAll: () => 0, registerContext: noopFn });
mockModule(path.resolve(srcDir, 'storekeeper', 'audit.ts'), { writeCheckoutLog: () => '', logRequest: noopFn, logResponse: noopFn });
mockModule(path.resolve(srcDir, 'storekeeper', 'request-parser.ts'), { parseRequest: () => null, createRequest: () => ({}) });
mockModule(path.resolve(srcDir, 'storekeeper', 'watcher.ts'), { StorekeeperWatcher: class {}, getStorekeeperWatcher: () => ({}) });

// Mock PA modules
mockModule(path.resolve(srcDir, 'pa', 'types.ts'), {});
mockModule(path.resolve(srcDir, 'pa', 'spine-reader.ts'), { parseSubSpineMarkdown: () => ({ success: true }), readSubSpineFile: async () => null, readAllSubSpines: async () => [], calculateStatus: () => 'GREEN' });
mockModule(path.resolve(srcDir, 'pa', 'pattern-detector.ts'), { PatternDetector: class { detectPatterns() { return []; } }, createPatternDetector: () => ({ detectPatterns: () => [] }) });
mockModule(path.resolve(srcDir, 'pa', 'decision-writer.ts'), { DecisionWriter: class {}, createDecisionWriter: () => ({}) });
mockModule(path.resolve(srcDir, 'pa', 'event-handlers.ts'), { PAEventHandlers: class { unsubscribeAll() {} }, createPAEventHandlers: () => ({ unsubscribeAll: noopFn }) });
mockModule(path.resolve(srcDir, 'pa', 'index.ts'), { PAManager: class {}, getPA: () => ({}), initializePA: noopFn, cleanupPA: noopFn, resetPA: noopFn });

// Mock analytics, failure, dev-logger, checkpoint-manager
mockModule(path.resolve(srcDir, 'main', 'analytics.ts'), { getAnalyticsTracker: () => ({ trackBuildStarted: noopFn, trackBuildCompleted: noopFn, trackBuildCancelled: noopFn }) });
mockModule(path.resolve(srcDir, 'main', 'failure.ts'), { getProgressSaver: () => ({ save: noopFn }), detectFailureReason: () => 'unknown' });
mockModule(path.resolve(srcDir, 'main', 'dev-logger.ts'), { devLog: { scheduler: noopFn, conductor: noopFn, worker: noopFn, enforcer: noopFn, bodyguard: noopFn, spine: noopFn, info: noopFn, warn: noopFn, error: noopFn } });
mockModule(path.resolve(srcDir, 'main', 'checkpoint-manager.ts'), {
  getCheckpointManager: () => ({ reset: noopFn, isDeployAction: () => false, waitForPreDeploy: async () => ({ proceed: true }) }),
});

// ============================================================================
// NOW IMPORT THE MODULE UNDER TEST
// ============================================================================

import { provision } from '../src/storekeeper/provision';
import type { ProvisionInput, ToolManifest } from '../src/storekeeper/types';
import { STOREKEEPER_CONSTANTS } from '../src/storekeeper/types';
import { PluginRegistry, getPluginRegistry, resetPluginRegistry } from '../src/plugins/plugin-registry';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.log(`  [FAIL] ${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    testsFailed++;
  }
}

function assertTrue(condition: boolean, message: string): void {
  assert(condition, message);
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

let tmpDir: string;
let skillsDir: string;
let catalogPath: string;

function setupFixtures(): void {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storekeeper-test-'));
  skillsDir = path.join(tmpDir, 'skills');
  catalogPath = path.join(skillsDir, 'trigger-map.json');

  // Create skills directory
  fs.mkdirSync(skillsDir, { recursive: true });

  // Create foundation skill stubs
  fs.mkdirSync(path.join(skillsDir, 'phases'), { recursive: true });
  for (const skill of STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS) {
    fs.writeFileSync(path.join(skillsDir, skill), `# ${skill}\nFoundation skill content.`);
  }
}

function cleanupFixtures(): void {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function makePlan(steps: Array<{ id: number; target: 'web' | 'cli' | 'service'; action: string; detail: string }>): ProvisionInput['plan'] {
  return {
    planId: 'test-plan-1',
    name: 'Test Plan',
    steps: steps.map(s => ({ ...s, waitFor: [], parallel: false })),
  };
}

function writeCatalog(entries: Array<{ skill: string; keywords: string[] }>): void {
  fs.writeFileSync(catalogPath, JSON.stringify(entries));
}

function writeSkill(relPath: string, content: string): void {
  const fullPath = path.join(skillsDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Storekeeper Tests — Plan-Level Tool Provisioning');
  console.log('='.repeat(60));
  console.log('');

  // --------------------------------------------------------------------------
  // Test 1: Empty plan → empty perStep, foundation only
  // --------------------------------------------------------------------------
  {
    console.log('Test 1: Empty plan returns foundation only');
    setupFixtures();
    writeCatalog([]);

    const result = provision({
      plan: makePlan([]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    assertEqual(result.perStep.size, 0, 'perStep is empty for empty plan');
    assertEqual(result.foundation.length, STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS.length,
      `Foundation has ${STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS.length} skills`);
    assertTrue(result.audit.length > 0, 'Audit trail has entries');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 2: Single CLI step → keyword-matched skills returned
  // --------------------------------------------------------------------------
  {
    console.log('Test 2: Single CLI step with keyword match');
    setupFixtures();
    writeSkill('deploy/vercel.md', '# Vercel Deploy\nDeploy to Vercel.');
    writeCatalog([
      { skill: 'deploy/vercel.md', keywords: ['deploy', 'vercel', 'production'] },
      { skill: 'test/jest.md', keywords: ['test', 'jest', 'unit'] },
    ]);

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'deploy', detail: 'Deploy to vercel production' }]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    const step1Skills = result.perStep.get(1) || [];
    assertTrue(step1Skills.length > 0, 'Step 1 has matched skills');
    assertTrue(step1Skills[0].includes('vercel.md'), 'Matched vercel deploy skill');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 3: Multi-step plan → each step gets independent selections
  // --------------------------------------------------------------------------
  {
    console.log('Test 3: Multi-step plan with independent selections');
    setupFixtures();
    writeSkill('deploy/vercel.md', '# Vercel\nDeploy content.');
    writeSkill('test/jest.md', '# Jest\nTest content.');
    writeCatalog([
      { skill: 'deploy/vercel.md', keywords: ['deploy', 'vercel'] },
      { skill: 'test/jest.md', keywords: ['test', 'jest'] },
    ]);

    const result = provision({
      plan: makePlan([
        { id: 1, target: 'cli', action: 'test', detail: 'Run jest tests' },
        { id: 2, target: 'cli', action: 'deploy', detail: 'Deploy to vercel' },
      ]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    assertEqual(result.perStep.size, 2, 'Two steps in perStep');
    const step1Skills = result.perStep.get(1) || [];
    const step2Skills = result.perStep.get(2) || [];
    assertTrue(step1Skills.some(s => s.includes('jest.md')), 'Step 1 matched jest skill');
    assertTrue(step2Skills.some(s => s.includes('vercel.md')), 'Step 2 matched vercel skill');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 4: Foundation skills always present (even with empty catalog)
  // --------------------------------------------------------------------------
  {
    console.log('Test 4: Foundation skills present even with empty catalog');
    setupFixtures();
    // No catalog file at all

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'build', detail: 'Build project' }]),
      catalogPath: path.join(skillsDir, 'nonexistent.json'),
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    assertTrue(result.foundation.length > 0, 'Foundation skills resolved despite missing catalog');
    assertTrue(result.foundation.every(f => fs.existsSync(f)), 'All foundation paths exist on disk');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 5: Token budget enforced (skills > 4000 tokens rejected)
  // --------------------------------------------------------------------------
  {
    console.log('Test 5: Token budget enforcement');
    setupFixtures();
    // Create a large skill file (> 4000 tokens ≈ 16000 bytes)
    writeSkill('big/huge.md', 'x'.repeat(20_000));
    writeCatalog([
      { skill: 'big/huge.md', keywords: ['build', 'huge'] },
    ]);

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'build', detail: 'Build huge project' }]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 3,
    });

    const step1Skills = result.perStep.get(1) || [];
    assertEqual(step1Skills.length, 0, 'Oversized skill rejected by token budget');
    // Check audit shows rejection
    const selectAudit = result.audit.find(a => a.action === 'select' && a.stepId === 1);
    assertTrue(selectAudit !== undefined, 'Select audit entry exists');
    assertTrue((selectAudit?.rejected?.length || 0) > 0, 'Rejected list is non-empty');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 6: Tier limits enforced (tier 1 = max 1 skill)
  // --------------------------------------------------------------------------
  {
    console.log('Test 6: Tier-based count limits');
    setupFixtures();
    writeSkill('a.md', '# A\nSmall skill.');
    writeSkill('b.md', '# B\nSmall skill.');
    writeSkill('c.md', '# C\nSmall skill.');
    writeCatalog([
      { skill: 'a.md', keywords: ['build'] },
      { skill: 'b.md', keywords: ['build'] },
      { skill: 'c.md', keywords: ['build'] },
    ]);

    // Web step → tier 1 → max 1
    const result = provision({
      plan: makePlan([{ id: 1, target: 'web', action: 'build', detail: 'Build it' }]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 1,
    });

    const step1Skills = result.perStep.get(1) || [];
    assertTrue(step1Skills.length <= 1, `Web (tier 1) step limited to ≤1 skill, got ${step1Skills.length}`);
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 7: Non-existent skill files filtered out
  // --------------------------------------------------------------------------
  {
    console.log('Test 7: Non-existent skill files filtered');
    setupFixtures();
    // Don't create the skill file, only the catalog entry
    writeCatalog([
      { skill: 'ghost/missing.md', keywords: ['build'] },
    ]);

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'build', detail: 'Build it' }]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    const step1Skills = result.perStep.get(1) || [];
    assertEqual(step1Skills.length, 0, 'Missing skill file filtered out');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 8: Plugin resolution by keyword match
  // --------------------------------------------------------------------------
  {
    console.log('Test 8: Plugin resolution by keyword match');
    setupFixtures();
    writeCatalog([]);

    // Register a plugin with triggers
    resetPluginRegistry();
    const registry = getPluginRegistry();
    registry.register({
      name: 'codex-plugin',
      version: '1.0.0',
      description: 'Codex integration',
      type: 'cli',
      command: 'codex',
      dependencies: [],
      capabilities: ['code-generation'],
      triggers: ['codex', 'generate', 'build'],
    });

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'generate', detail: 'Generate code with codex' }]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    assertTrue(result.plugins.length > 0, 'Plugin matched by keyword');
    assertEqual(result.plugins[0].name, 'codex-plugin', 'Correct plugin resolved');
    resetPluginRegistry();
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 9: Audit trail has entry per step + foundation + plugins + mcps
  // --------------------------------------------------------------------------
  {
    console.log('Test 9: Audit trail completeness');
    setupFixtures();
    writeCatalog([]);
    resetPluginRegistry();

    const result = provision({
      plan: makePlan([
        { id: 1, target: 'cli', action: 'build', detail: 'Build' },
        { id: 2, target: 'web', action: 'test', detail: 'Test' },
      ]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    const foundationEntries = result.audit.filter(a => a.action === 'foundation');
    const selectEntries = result.audit.filter(a => a.action === 'select');
    const pluginEntries = result.audit.filter(a => a.action === 'plugins');
    const mcpEntries = result.audit.filter(a => a.action === 'mcps');

    assertEqual(foundationEntries.length, 1, 'One foundation audit entry');
    assertEqual(selectEntries.length, 2, 'One select entry per step');
    assertEqual(pluginEntries.length, 1, 'One plugins audit entry');
    assertEqual(mcpEntries.length, 1, 'One mcps audit entry');
    assertTrue(result.audit.every(a => a.timestamp > 0), 'All entries have timestamps');
    assertTrue(result.audit.every(a => typeof a.reasoning === 'string'), 'All entries have reasoning');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 10: Missing trigger-map.json → graceful empty result
  // --------------------------------------------------------------------------
  {
    console.log('Test 10: Missing trigger-map.json returns graceful empty result');
    setupFixtures();
    // Don't create catalog file

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'build', detail: 'Build' }]),
      catalogPath: path.join(skillsDir, 'does-not-exist.json'),
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    assertTrue(result.foundation.length > 0, 'Foundation skills still resolved');
    assertEqual((result.perStep.get(1) || []).length, 0, 'No per-step skills without catalog');
    assertEqual(result.mcps.length, 0, 'MCPs empty');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 11: Nested catalog format (Format 2) supported
  // --------------------------------------------------------------------------
  {
    console.log('Test 11: Nested catalog format supported');
    setupFixtures();
    writeSkill('deploy/aws.md', '# AWS Deploy\nDeploy content.');
    fs.writeFileSync(catalogPath, JSON.stringify({
      skills: {
        'aws-deploy': { path: 'deploy/aws.md', triggers: ['deploy', 'aws', 's3'] },
      },
    }));

    const result = provision({
      plan: makePlan([{ id: 1, target: 'cli', action: 'deploy', detail: 'Deploy to aws s3' }]),
      catalogPath,
      skillsBasePath: skillsDir,
      planTier: 2,
    });

    const step1Skills = result.perStep.get(1) || [];
    assertTrue(step1Skills.length > 0, 'Nested format catalog matched skills');
    assertTrue(step1Skills[0].includes('aws.md'), 'Correct skill from nested format');
    cleanupFixtures();
  }

  console.log('');

  // --------------------------------------------------------------------------
  // Test 12: Foundation skills missing on disk → filtered gracefully
  // --------------------------------------------------------------------------
  {
    console.log('Test 12: Missing foundation skills filtered gracefully');
    // Create a dir without foundation skills
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storekeeper-empty-'));
    const emptySkillsDir = path.join(emptyDir, 'skills');
    fs.mkdirSync(emptySkillsDir, { recursive: true });
    const emptyCatalog = path.join(emptySkillsDir, 'trigger-map.json');
    fs.writeFileSync(emptyCatalog, '[]');

    const result = provision({
      plan: makePlan([]),
      catalogPath: emptyCatalog,
      skillsBasePath: emptySkillsDir,
      planTier: 2,
    });

    assertEqual(result.foundation.length, 0, 'Foundation empty when files missing');
    const foundationAudit = result.audit.find(a => a.action === 'foundation');
    assertTrue(foundationAudit !== undefined, 'Foundation audit still logged');
    assertTrue(foundationAudit!.reasoning.includes('0/'), 'Audit notes 0 resolved');

    fs.rmSync(emptyDir, { recursive: true, force: true });
  }

  console.log('');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================

  console.log('='.repeat(60));
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
