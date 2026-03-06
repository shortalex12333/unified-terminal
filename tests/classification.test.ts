/**
 * Classification Layer Tests
 *
 * Tests the project type classifier and capability registry.
 * Run with: npx ts-node tests/classification.test.ts
 */

import {
  CAPABILITY_REGISTRY,
  getCapabilities,
  getProjectTypes,
  requiresMCPs,
} from '../src/main/classification/capability-registry';
import {
  ClassificationResult,
  ProjectType,
  CONFIDENCE_THRESHOLD,
} from '../src/main/classification/types';
import {
  needsConfirmation,
  describeClassification,
} from '../src/main/classification/project-classifier';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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

function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected} but got ${actual}`);
  }
}

function assertIncludes<T>(arr: T[], item: T, msg?: string): void {
  if (!arr.includes(item)) {
    throw new Error(msg || `Array does not include ${item}`);
  }
}

function assertArrayEquals<T>(actual: T[], expected: T[], msg?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(msg || `Arrays not equal: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Classification Layer Tests');
  console.log('='.repeat(60));

  // ==========================================
  // Classification Types Tests
  // ==========================================
  console.log('\n=== Classification Types ===\n');

  await test('Confidence threshold is 0.7', () => {
    assertEqual(CONFIDENCE_THRESHOLD, 0.7);
  });

  // ==========================================
  // Capability Registry Tests
  // ==========================================
  console.log('\n=== Capability Registry ===\n');

  await test('Has entries for all 6 project types', () => {
    const types: ProjectType[] = ['site', 'app', 'ecom', 'existing', 'chat', 'quick'];
    for (const type of types) {
      assertTrue(CAPABILITY_REGISTRY[type] !== undefined, `Missing type: ${type}`);
    }
  });

  await test('site has correct capabilities', () => {
    const caps = getCapabilities('site');
    assertIncludes(caps.skills, 'scaffold');
    assertIncludes(caps.skills, 'frontend-design');
    assertIncludes(caps.skills, 'deploy');
    assertArrayEquals(caps.mcps, []);
    assertEqual(caps.template, 'site');
    assertEqual(caps.route, 'full-orchestration');
  });

  await test('app requires supabase MCP', () => {
    const caps = getCapabilities('app');
    assertIncludes(caps.mcps, 'supabase');
    assertTrue(requiresMCPs('app'));
  });

  await test('ecom requires stripe MCP', () => {
    const caps = getCapabilities('ecom');
    assertIncludes(caps.mcps, 'stripe');
    assertTrue(requiresMCPs('ecom'));
  });

  await test('chat routes directly to ChatGPT', () => {
    const caps = getCapabilities('chat');
    assertEqual(caps.route, 'chatgpt-direct');
    assertArrayEquals(caps.skills, []);
  });

  await test('quick uses single Codex call', () => {
    const caps = getCapabilities('quick');
    assertEqual(caps.route, 'codex-single');
  });

  await test('existing starts with analysis', () => {
    const caps = getCapabilities('existing');
    assertEqual(caps.firstPhase, 'analysis');
    assertIncludes(caps.skills, 'codebase-mapper');
  });

  await test('getProjectTypes returns all 6 types', () => {
    const types = getProjectTypes();
    assertEqual(types.length, 6);
    assertIncludes(types, 'site');
    assertIncludes(types, 'ecom');
    assertIncludes(types, 'app');
    assertIncludes(types, 'existing');
    assertIncludes(types, 'chat');
    assertIncludes(types, 'quick');
  });

  await test('site does not require MCPs', () => {
    assertTrue(!requiresMCPs('site'));
  });

  await test('existing does not require MCPs', () => {
    assertTrue(!requiresMCPs('existing'));
  });

  await test('chat does not require MCPs', () => {
    assertTrue(!requiresMCPs('chat'));
  });

  await test('quick does not require MCPs', () => {
    assertTrue(!requiresMCPs('quick'));
  });

  // ==========================================
  // Classification Helpers Tests
  // ==========================================
  console.log('\n=== Classification Helpers ===\n');

  await test('needsConfirmation returns true for low confidence', () => {
    const result: ClassificationResult = {
      primary: 'site',
      addons: [],
      confidence: 0.5,
      extractedGoal: 'test',
      suggestedName: 'test',
    };
    assertTrue(needsConfirmation(result));
  });

  await test('needsConfirmation returns false for high confidence', () => {
    const result: ClassificationResult = {
      primary: 'ecom',
      addons: [],
      confidence: 0.9,
      extractedGoal: 'test',
      suggestedName: 'test',
    };
    assertTrue(!needsConfirmation(result));
  });

  await test('needsConfirmation returns false at exactly threshold', () => {
    const result: ClassificationResult = {
      primary: 'app',
      addons: [],
      confidence: 0.7,
      extractedGoal: 'test',
      suggestedName: 'test',
    };
    assertTrue(!needsConfirmation(result));
  });

  await test('needsConfirmation returns true just below threshold', () => {
    const result: ClassificationResult = {
      primary: 'app',
      addons: [],
      confidence: 0.69,
      extractedGoal: 'test',
      suggestedName: 'test',
    };
    assertTrue(needsConfirmation(result));
  });

  await test('describeClassification handles primary only', () => {
    const result: ClassificationResult = {
      primary: 'site',
      addons: [],
      confidence: 0.95,
      extractedGoal: 'landing page',
      suggestedName: 'landing-page',
    };
    const desc = describeClassification(result);
    assertTrue(desc.includes('static website'), 'Should mention static website');
    assertTrue(desc.includes('95%'), 'Should mention confidence');
  });

  await test('describeClassification handles addons', () => {
    const result: ClassificationResult = {
      primary: 'ecom',
      addons: ['app'],
      confidence: 0.85,
      extractedGoal: 'online store with custom backend',
      suggestedName: 'store-app',
    };
    const desc = describeClassification(result);
    assertTrue(desc.includes('online store'), 'Should mention online store');
    assertTrue(desc.includes('web application'), 'Should mention web application addon');
  });

  await test('describeClassification handles multiple addons', () => {
    const result: ClassificationResult = {
      primary: 'site',
      addons: ['ecom', 'app'],
      confidence: 0.75,
      extractedGoal: 'portfolio with store and backend',
      suggestedName: 'portfolio-store',
    };
    const desc = describeClassification(result);
    assertTrue(desc.includes('static website'), 'Should mention static website');
    assertTrue(desc.includes('online store'), 'Should mention ecom addon');
    assertTrue(desc.includes('web application'), 'Should mention app addon');
  });

  await test('describeClassification handles chat type', () => {
    const result: ClassificationResult = {
      primary: 'chat',
      addons: [],
      confidence: 0.99,
      extractedGoal: 'general question',
      suggestedName: '',
    };
    const desc = describeClassification(result);
    assertTrue(desc.includes('general question'), 'Should mention general question');
  });

  await test('describeClassification handles quick type', () => {
    const result: ClassificationResult = {
      primary: 'quick',
      addons: [],
      confidence: 0.88,
      extractedGoal: 'fix typo',
      suggestedName: 'typo-fix',
    };
    const desc = describeClassification(result);
    assertTrue(desc.includes('quick task'), 'Should mention quick task');
  });

  await test('describeClassification handles existing type', () => {
    const result: ClassificationResult = {
      primary: 'existing',
      addons: [],
      confidence: 0.92,
      extractedGoal: 'refactor auth module',
      suggestedName: 'auth-refactor',
    };
    const desc = describeClassification(result);
    assertTrue(desc.includes('existing code'), 'Should mention existing code');
  });

  // ==========================================
  // Registry Constraints Tests
  // ==========================================
  console.log('\n=== Registry Constraints ===\n');

  await test('estimatedSteps are valid ranges', () => {
    for (const type of getProjectTypes()) {
      const caps = getCapabilities(type);
      const [min, max] = caps.estimatedSteps;
      assertTrue(min <= max, `${type}: min (${min}) should be <= max (${max})`);
      assertTrue(min >= 0, `${type}: min should be >= 0`);
    }
  });

  await test('all templates except chat/quick are non-empty', () => {
    const needsTemplate: ProjectType[] = ['site', 'app', 'ecom', 'existing'];
    for (const type of needsTemplate) {
      assertTrue(getCapabilities(type).template !== '', `${type} should have template`);
    }
  });

  await test('chat and quick have empty templates', () => {
    assertEqual(getCapabilities('chat').template, '');
    assertEqual(getCapabilities('quick').template, '');
  });

  await test('firstPhase is valid for orchestration routes', () => {
    for (const type of getProjectTypes()) {
      const caps = getCapabilities(type);
      if (caps.route === 'full-orchestration') {
        assertTrue(
          caps.firstPhase === 'analysis' || caps.firstPhase === 'scaffold',
          `${type}: firstPhase should be analysis or scaffold`
        );
      }
    }
  });

  await test('skills are non-empty for orchestration routes', () => {
    for (const type of getProjectTypes()) {
      const caps = getCapabilities(type);
      if (caps.route === 'full-orchestration') {
        assertTrue(caps.skills.length > 0, `${type} should have skills for orchestration`);
      }
    }
  });

  await test('non-orchestration routes have no skills', () => {
    for (const type of getProjectTypes()) {
      const caps = getCapabilities(type);
      if (caps.route !== 'full-orchestration') {
        assertArrayEquals(caps.skills, [], `${type} should have no skills`);
      }
    }
  });

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n' + '='.repeat(60));
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
