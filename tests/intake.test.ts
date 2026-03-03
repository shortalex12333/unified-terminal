/**
 * Intake Layer Tests
 *
 * Verifies the meta-prompt intake system works correctly.
 * Run with: npx ts-node tests/intake.test.ts
 */

import {
  classifyTask,
  detectSignals,
  parseBriefFromJSON,
  createFallbackBrief,
  IntakeFlowController,
  buildIntakePrompt,
  detectSkipIntent,
  detectIntakeComplete,
  shouldTriggerIntake,
  formatBriefForDisplay,
} from '../src/intake';

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

function assertContains(arr: string[], item: string, message?: string): void {
  if (!arr.includes(item)) {
    throw new Error(message || `Expected array to contain "${item}"`);
  }
}

// ============================================================================
// TASK CLASSIFIER TESTS
// ============================================================================

console.log('\n--- Task Classifier Tests ---\n');

test('classifies landing page request as build_product', () => {
  const result = classifyTask('I want to build a landing page for my startup');
  assertEqual(result.taskType, 'build_product');
  assertTrue(result.signals.needsCode);
});

test('classifies website request as build_product', () => {
  const result = classifyTask('Create a website for my business');
  assertEqual(result.taskType, 'build_product');
});

test('classifies scraping request as automate', () => {
  const result = classifyTask('Scrape product prices from Amazon');
  assertEqual(result.taskType, 'automate');
  assertTrue(result.signals.needsAutomation);
  assertEqual(result.suggestedPath, 'browser');
});

test('classifies blog post request as build_content', () => {
  const result = classifyTask('Write a blog post about AI trends');
  assertEqual(result.taskType, 'build_content');
  assertTrue(result.signals.needsContent);
});

test('classifies research request correctly', () => {
  const result = classifyTask('Research competitors in the CRM market');
  assertEqual(result.taskType, 'research');
  assertTrue(result.signals.needsResearch);
});

test('suggests appropriate plugins for code tasks', () => {
  const result = classifyTask('Build a React dashboard app');
  assertContains(result.suggestedPlugins, 'claude');
  assertContains(result.suggestedPlugins, 'gsd');
});

test('suggests playwright for automation tasks', () => {
  const result = classifyTask('Automate filling out forms on websites');
  assertContains(result.suggestedPlugins, 'playwright');
});

test('detects signals correctly', () => {
  const signals = detectSignals('Build a website with images and deploy to Vercel');
  assertTrue(signals.needsCode);
  assertTrue(signals.needsDeployment);
});

// ============================================================================
// BRIEF BUILDER TESTS
// ============================================================================

console.log('\n--- Brief Builder Tests ---\n');

test('parses valid JSON into brief', () => {
  const json = `{
    "task_type": "build_product",
    "category": "landing page",
    "requirements": {
      "target_audience": "startup founders"
    },
    "execution_path": "local",
    "plugins_needed": ["claude", "vercel"]
  }`;

  const brief = parseBriefFromJSON(json, 'build me a landing page');
  assertTrue(brief !== null);
  assertEqual(brief!.taskType, 'build_product');
  assertEqual(brief!.category, 'landing page');
  assertEqual(brief!.executionPath, 'local');
  assertContains(brief!.pluginsNeeded, 'claude');
});

test('extracts JSON from markdown code block', () => {
  const text = `Here's the brief:
\`\`\`json
{"task_type": "research", "category": "market analysis", "requirements": {}, "execution_path": "hybrid", "plugins_needed": []}
\`\`\`
`;

  const brief = parseBriefFromJSON(text, 'research competitors');
  assertTrue(brief !== null);
  assertEqual(brief!.taskType, 'research');
});

test('handles snake_case requirement keys', () => {
  const json = `{
    "task_type": "build_content",
    "category": "blog",
    "requirements": {
      "target_audience": "developers",
      "success_metric": "page views"
    },
    "execution_path": "local",
    "plugins_needed": ["claude"]
  }`;

  const brief = parseBriefFromJSON(json, 'write a blog post');
  assertTrue(brief !== null);
  assertEqual(brief!.requirements.targetAudience, 'developers');
  assertEqual(brief!.requirements.successMetric, 'page views');
});

test('creates fallback brief from message', () => {
  const brief = createFallbackBrief('Build me a React e-commerce store');
  assertEqual(brief.taskType, 'build_product');
  assertTrue(brief.skipped);
  assertTrue(brief.pluginsNeeded.length > 0);
});

test('formats brief for display', () => {
  const brief = createFallbackBrief('Build a website');
  const display = formatBriefForDisplay(brief);
  assertTrue(display.includes('Task Type:'));
  assertTrue(display.includes('Execution Path:'));
});

// ============================================================================
// META-PROMPT TESTS
// ============================================================================

console.log('\n--- Meta-Prompt Tests ---\n');

test('builds intake prompt with user message', () => {
  const prompt = buildIntakePrompt('I need a website');
  assertTrue(prompt.includes('I need a website'));
  assertTrue(prompt.includes('INTAKE_COMPLETE'));
  assertTrue(prompt.includes('WHO'));
  assertTrue(prompt.includes('WHAT'));
  assertTrue(prompt.includes('WHY'));
});

test('detects skip intent', () => {
  assertTrue(detectSkipIntent('just build it'));
  assertTrue(detectSkipIntent('Skip questions'));
  assertTrue(detectSkipIntent('just do it'));
  assertTrue(detectSkipIntent('go ahead'));
  assertTrue(!detectSkipIntent('I want a website'));
});

test('detects intake complete signal', () => {
  assertTrue(detectIntakeComplete('Okay, INTAKE_COMPLETE. Here is what I learned...'));
  assertTrue(detectIntakeComplete('intake_complete'));
  assertTrue(!detectIntakeComplete('Please tell me more about your audience'));
});

// ============================================================================
// INTAKE FLOW TESTS
// ============================================================================

console.log('\n--- Intake Flow Tests ---\n');

test('creates intake session', () => {
  const controller = new IntakeFlowController('Build me a landing page');
  assertEqual(controller.getPhase(), 'initial');
  assertTrue(!controller.isComplete());
});

test('starts intake flow with injection', () => {
  const controller = new IntakeFlowController('Build me a landing page');
  const result = controller.start();

  assertEqual(controller.getPhase(), 'questioning');
  assertTrue(result.inject !== null);
  assertTrue(result.inject!.includes('landing page'));
});

test('handles skip in initial request', () => {
  const controller = new IntakeFlowController('Build me a landing page, just do it');
  const result = controller.start();

  assertEqual(controller.getPhase(), 'building_brief');
});

test('force skip works', () => {
  const controller = new IntakeFlowController('Build me a landing page');
  controller.start();
  const result = controller.forceSkip();

  assertEqual(controller.getPhase(), 'building_brief');
});

test('processes assistant message', () => {
  const controller = new IntakeFlowController('Build me a landing page');
  controller.start();

  const result = controller.processAssistantMessage(
    'Who is the target audience for this landing page?'
  );

  assertEqual(controller.getPhase(), 'answering');
  assertTrue(!result.complete);
});

test('detects intake complete in assistant message', () => {
  const controller = new IntakeFlowController('Build me a landing page');
  controller.start();

  const result = controller.processAssistantMessage(
    'Great! INTAKE_COMPLETE. Here is what I learned: you want a landing page for startup founders.'
  );

  assertEqual(controller.getPhase(), 'building_brief');
  assertTrue(result.inject !== null); // Should inject brief builder prompt
});

test('shouldTriggerIntake returns false for simple commands', () => {
  assertTrue(!shouldTriggerIntake('help'));
  assertTrue(!shouldTriggerIntake('quit'));
  assertTrue(!shouldTriggerIntake('status'));
  assertTrue(shouldTriggerIntake('build me a website'));
});

test('shouldTriggerIntake returns false for short messages', () => {
  assertTrue(!shouldTriggerIntake('hi'));
  assertTrue(!shouldTriggerIntake('test'));
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n--- Test Summary ---\n');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log(`  Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
