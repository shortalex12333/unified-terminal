/**
 * Task Router Tests (Gate 8)
 *
 * Verifies the task routing logic correctly classifies tasks into
 * browser, local, or hybrid execution paths.
 *
 * Run with: npx ts-node tests/task-router.test.ts
 */

import {
  TaskRouter,
  getTaskRouter,
  routeTask,
  RoutingDecision,
  LOCAL_SIGNALS,
  BROWSER_SIGNALS,
  HYBRID_SIGNALS,
} from '../src/main/task-router';

import { ProjectBrief, ExecutionPath, PluginName } from '../src/intake/types';

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

function assertIncludes(arr: string[], item: string, message?: string): void {
  if (!arr.includes(item)) {
    throw new Error(
      message || `Expected array to include "${item}", got [${arr.join(', ')}]`
    );
  }
}

// ============================================================================
// TEST DATA
// ============================================================================

const BROWSER_TASKS = [
  'Research the best CRM tools for small businesses',
  'Write a blog post about AI trends in 2024',
  'Help me draft an email to my team about the project update',
  'What should I include in my product pitch?',
  'Summarize the key points of this article',
  'Compare Notion vs Obsidian for note-taking',
  'Create an image of a mountain landscape at sunset',
  'Design a logo for my coffee shop',
  'Give me ideas for my startup name',
  'Explain how blockchain works',
];

const LOCAL_TASKS = [
  'Build me a landing page for my SaaS product',
  'Create a React app with user authentication',
  'Develop an e-commerce store with Shopify integration',
  'Build a REST API with Node.js and Express',
  'Create a Python script to process CSV files',
  'Set up a database with PostgreSQL and Prisma',
  'Build a dashboard with Next.js and Tailwind',
  'Create a mobile app with React Native',
  'Deploy my website to Vercel',
  'Generate a PDF report from this data',
];

const HYBRID_TASKS = [
  'Research competitors and build a landing page based on findings',
  'Create a website with compelling copy for my product',
  'Scrape data from websites and store it in a database',
  'Design a mockup and then implement it in React',
  'First research market trends, then build a dashboard to visualize them',
  'Build an app with AI-generated content',
  'Create a landing page with Dall-E generated images',
];

const AUTOMATION_TASKS = [
  'Scrape product prices from Amazon',
  'Fill out this form automatically every day',
  'Book a meeting slot when one becomes available',
  'Monitor price changes on this product page',
  'Extract data from multiple websites',
  'Automate my job application process',
];

// ============================================================================
// TESTS
// ============================================================================

function runTests(): void {
  console.log('\n=== Task Router Tests (Gate 8) ===\n');

  // Test 1: Router instance
  console.log('1. Router instantiation:');
  test('getTaskRouter returns singleton', () => {
    const router1 = getTaskRouter();
    const router2 = getTaskRouter();
    assertTrue(router1 === router2, 'Should return same instance');
  });

  test('TaskRouter class can be instantiated', () => {
    const router = new TaskRouter();
    assertTrue(router !== null, 'Should create instance');
  });

  // Test 2: Browser task routing
  console.log('\n2. Browser task routing:');
  for (const task of BROWSER_TASKS.slice(0, 5)) {
    test(`"${task.substring(0, 40)}..." routes to browser`, () => {
      const decision = routeTask(task);
      assertEqual(
        decision.path,
        'browser',
        `Expected browser, got ${decision.path}. Reasoning: ${decision.reasoning}`
      );
    });
  }

  // Test 3: Local task routing
  console.log('\n3. Local task routing:');
  for (const task of LOCAL_TASKS.slice(0, 5)) {
    test(`"${task.substring(0, 40)}..." routes to local`, () => {
      const decision = routeTask(task);
      assertEqual(
        decision.path,
        'local',
        `Expected local, got ${decision.path}. Reasoning: ${decision.reasoning}`
      );
    });
  }

  // Test 4: Hybrid task routing
  console.log('\n4. Hybrid task routing:');
  for (const task of HYBRID_TASKS.slice(0, 3)) {
    test(`"${task.substring(0, 40)}..." routes to hybrid`, () => {
      const decision = routeTask(task);
      assertEqual(
        decision.path,
        'hybrid',
        `Expected hybrid, got ${decision.path}. Reasoning: ${decision.reasoning}`
      );
    });
  }

  // Test 5: CLI requirement detection
  console.log('\n5. CLI requirement detection:');
  test('Build tasks require CLI', () => {
    const decision = routeTask('Build me a React website');
    assertTrue(decision.requiresCLI, 'Build task should require CLI');
  });

  test('Research tasks do not require CLI', () => {
    const decision = routeTask('Research market trends for coffee shops');
    assertTrue(!decision.requiresCLI, 'Research task should not require CLI');
  });

  // Test 6: Web search detection
  console.log('\n6. Web search detection:');
  test('Research tasks require web search', () => {
    const decision = routeTask('Research the best project management tools');
    assertTrue(decision.requiresWebSearch, 'Research should require web search');
  });

  test('Local build tasks may not require web search', () => {
    const decision = routeTask('Build a Python script to rename files');
    // Local-only tasks might not require web search
    // but hybrid tasks do
    assertTrue(
      decision.path === 'local' || decision.requiresWebSearch,
      'Should be local without web search or hybrid with web search'
    );
  });

  // Test 7: Image generation detection
  console.log('\n7. Image generation detection:');
  test('Image requests require image gen', () => {
    const decision = routeTask('Create an image of a futuristic city');
    assertTrue(decision.requiresImageGen, 'Image request should require image gen');
  });

  test('Logo design requires image gen', () => {
    const decision = routeTask('Design a logo for my startup');
    assertTrue(decision.requiresImageGen, 'Logo design should require image gen');
  });

  test('Code tasks do not require image gen', () => {
    const decision = routeTask('Build a REST API with Express');
    assertTrue(!decision.requiresImageGen, 'API task should not require image gen');
  });

  // Test 8: Plugin suggestions
  console.log('\n8. Plugin suggestions:');
  test('Code tasks suggest claude-code', () => {
    const decision = routeTask('Build a website with React');
    assertIncludes(decision.suggestedPlugins, 'claude-code', 'Should suggest claude-code');
  });

  test('Image tasks suggest dall-e', () => {
    const decision = routeTask('Create an illustration of a dog');
    assertIncludes(decision.suggestedPlugins, 'dall-e', 'Should suggest dall-e');
  });

  test('Research tasks suggest chatgpt', () => {
    const decision = routeTask('Research AI trends for 2024');
    assertIncludes(decision.suggestedPlugins, 'chatgpt', 'Should suggest chatgpt');
  });

  test('Automation tasks suggest playwright', () => {
    const decision = routeTask('Scrape data from this website');
    assertIncludes(decision.suggestedPlugins, 'playwright', 'Should suggest playwright');
  });

  // Test 9: Confidence scoring
  console.log('\n9. Confidence scoring:');
  test('Clear tasks have high confidence', () => {
    const decision = routeTask('Build a React landing page for my SaaS');
    assertTrue(decision.confidence >= 0.7, `Expected confidence >= 0.7, got ${decision.confidence}`);
  });

  test('Ambiguous tasks have lower confidence', () => {
    // A truly ambiguous request with no clear signals
    const decision = routeTask('thing stuff');
    assertTrue(decision.confidence <= 0.6, `Expected confidence <= 0.6, got ${decision.confidence}`);
  });

  test('Help requests route to browser with reasonable confidence', () => {
    const decision = routeTask('help me with something');
    assertEqual(decision.path, 'browser', 'Help requests should route to browser');
    assertTrue(decision.confidence >= 0.5, 'Should have at least moderate confidence');
  });

  // Test 10: Reasoning generation
  console.log('\n10. Reasoning generation:');
  test('Routing decision includes reasoning', () => {
    const decision = routeTask('Build me a website');
    assertTrue(decision.reasoning.length > 20, 'Reasoning should be substantial');
    assertTrue(decision.reasoning.includes('Routed'), 'Reasoning should explain routing');
  });

  // Test 11: Explain function
  console.log('\n11. Explain function:');
  test('Explain provides detailed breakdown', () => {
    const router = getTaskRouter();
    const decision = routeTask('Create a dashboard with charts');
    const explanation = router.explain(decision);

    assertTrue(explanation.includes('Execution Path'), 'Should include path');
    assertTrue(explanation.includes('Confidence'), 'Should include confidence');
    assertTrue(explanation.includes('Primary Tool'), 'Should include primary tool');
    assertTrue(explanation.includes('Requirements'), 'Should include requirements');
  });

  // Test 12: ProjectBrief routing
  console.log('\n12. ProjectBrief routing:');
  test('Routes complete ProjectBrief correctly', () => {
    const router = getTaskRouter();
    const brief: ProjectBrief = {
      taskType: 'build_product',
      category: 'website',
      requirements: {
        targetAudience: 'developers',
        style: 'modern',
      },
      executionPath: 'local',
      pluginsNeeded: ['gsd', 'claude'] as PluginName[],
      rawRequest: 'Build a developer portfolio website',
      intakeComplete: true,
      skipped: false,
    };

    const decision = router.route(brief);
    assertEqual(decision.path, 'local', 'Should respect brief execution path');
    assertTrue(decision.confidence >= 0.9, 'Complete brief should have high confidence');
  });

  test('Routes incomplete brief using raw request', () => {
    const router = getTaskRouter();
    const brief: ProjectBrief = {
      taskType: 'general',
      category: '',
      requirements: {},
      executionPath: 'hybrid',
      pluginsNeeded: [],
      rawRequest: 'Write me a blog post about startups',
      intakeComplete: false,
      skipped: false,
    };

    const decision = router.route(brief);
    // Should analyze raw request, not trust incomplete brief
    assertEqual(decision.path, 'browser', 'Should route based on raw request for incomplete brief');
  });

  // Test 13: Primary tool selection
  console.log('\n13. Primary tool selection:');
  test('Code tasks get claude-code as primary', () => {
    const decision = routeTask('Build a Next.js application');
    assertEqual(decision.primaryTool, 'claude-code', 'Should select claude-code');
  });

  test('Image tasks get dall-e as primary', () => {
    const decision = routeTask('Generate an image of a sunset');
    assertEqual(decision.primaryTool, 'dall-e', 'Should select dall-e');
  });

  test('Browser research gets chatgpt as primary', () => {
    const decision = routeTask('Help me understand quantum computing');
    assertEqual(decision.primaryTool, 'chatgpt', 'Should select chatgpt');
  });

  test('Automation gets playwright as primary', () => {
    const decision = routeTask('Scrape all product listings');
    assertEqual(decision.primaryTool, 'playwright', 'Should select playwright');
  });

  test('Hybrid orchestration gets gsd as primary', () => {
    const decision = routeTask('Research competitors and build a comparison dashboard');
    assertEqual(decision.primaryTool, 'gsd', 'Hybrid tasks should use gsd for orchestration');
  });

  // Summary
  console.log('\n=================================');
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log('=================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests();
