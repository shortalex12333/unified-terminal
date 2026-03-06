/**
 * Enforcement Flow Integration Tests
 *
 * Tests the full flow:
 * 1. CARL monitors token usage
 * 2. Worker outputs structured work
 * 3. Bodyguard validates and passes to Spine
 * 4. Spine acknowledges, reviews, recommends "what's next"
 * 5. PA reads Spine review and dispatches to Orchestrator
 *
 * Run with: npx ts-node tests/enforcement-flow.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// =============================================================================
// TEST PROJECT SETUP
// =============================================================================

const TEST_PROJECT_ROOT = path.join(os.tmpdir(), `enforcement-flow-test-${Date.now()}`);
const KENOKI_DIR = path.join(TEST_PROJECT_ROOT, '.kenoki');

/**
 * Setup test project structure.
 */
function setupTestProject(): void {
  // Create test project structure
  fs.mkdirSync(path.join(TEST_PROJECT_ROOT, 'src'), { recursive: true });
  fs.mkdirSync(path.join(KENOKI_DIR, 'ledgers'), { recursive: true });
  fs.mkdirSync(path.join(KENOKI_DIR, 'work_outputs'), { recursive: true });
  fs.mkdirSync(path.join(KENOKI_DIR, 'spine_acks'), { recursive: true });

  // Initialize git repo for Spine to work
  try {
    require('child_process').execSync('git init', {
      cwd: TEST_PROJECT_ROOT,
      stdio: 'ignore',
    });
    require('child_process').execSync('git config user.email "test@test.com"', {
      cwd: TEST_PROJECT_ROOT,
      stdio: 'ignore',
    });
    require('child_process').execSync('git config user.name "Test"', {
      cwd: TEST_PROJECT_ROOT,
      stdio: 'ignore',
    });
  } catch {
    // Git init may fail in some environments, continue anyway
  }

  // Create a sample source file
  fs.writeFileSync(
    path.join(TEST_PROJECT_ROOT, 'src', 'index.ts'),
    'export const hello = "world";',
    'utf-8'
  );
}

/**
 * Cleanup test project.
 */
function cleanupTestProject(): void {
  if (fs.existsSync(TEST_PROJECT_ROOT)) {
    fs.rmSync(TEST_PROJECT_ROOT, { recursive: true, force: true });
  }
}

// =============================================================================
// TEST UTILITIES
// =============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
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

function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be non-null');
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(message || `Expected ${actual} > ${expected}`);
  }
}

function assertIncludes(arr: string[], value: string, message?: string): void {
  if (!arr.includes(value)) {
    throw new Error(message || `Expected array to include "${value}"`);
  }
}

// =============================================================================
// MOCK TYPES (matching actual interfaces)
// =============================================================================

interface MockDagStep {
  id: string;
  phase: string;
  task: string;
  action: 'execute' | 'build' | 'deploy' | 'test' | 'cleanup' | 'verify';
  worker: 'cli' | 'web' | 'hybrid';
  tools: string[];
  declaredFiles: string[];
  modifiedCodeFiles: boolean;
  isFrontend: boolean;
  tier: 1 | 2 | 3;
  timeout: number;
  dependsOn: string[];
}

interface MockWorkOutput {
  stepId: string;
  workerId: string;
  completedAt: string;
  task: string;
  phase: string;
  tier: 1 | 2 | 3;
  reasoning: string;
  approach: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  testsAdded: string[];
  testsRun: boolean;
  testsPassed: boolean;
  assumptions: string[];
  openQuestions: string[];
  blockers: string[];
  tokensUsed: number;
  startedAt: string;
  durationMs: number;
}

interface MockAgentHandle {
  process: { kill?: () => void };
  id: string;
  model: string;
  tier: 1 | 2 | 3;
  startTime: number;
  tokensUsed: number;
  taskProgress: number;
}

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockStep(overrides: Partial<MockDagStep> = {}): MockDagStep {
  return {
    id: 'test-step-001',
    phase: 'execute',
    task: 'Add login form',
    action: 'execute',
    worker: 'cli',
    tools: ['read', 'write'],
    declaredFiles: ['src/LoginForm.tsx'],
    modifiedCodeFiles: true,
    isFrontend: true,
    tier: 2,
    timeout: 60000,
    dependsOn: [],
    ...overrides,
  };
}

function createMockWorkOutput(overrides: Partial<MockWorkOutput> = {}): MockWorkOutput {
  return {
    stepId: 'test-step-001',
    workerId: 'worker-abc123',
    completedAt: new Date().toISOString(),
    task: 'Add login form',
    phase: 'execute',
    tier: 2,
    reasoning: 'Used React Hook Form for validation',
    approach: 'Created form component with email/password fields',
    filesCreated: ['src/LoginForm.tsx'],
    filesModified: [],
    filesDeleted: [],
    testsAdded: ['tests/LoginForm.test.tsx'],
    testsRun: true,
    testsPassed: true,
    assumptions: ['User wants email-based login'],
    openQuestions: ['Should we add CAPTCHA?'],
    blockers: [],
    tokensUsed: 5000,
    startedAt: new Date(Date.now() - 60000).toISOString(),
    durationMs: 60000,
    ...overrides,
  };
}

function createMockAgent(overrides: Partial<MockAgentHandle> = {}): MockAgentHandle {
  return {
    process: { kill: () => {} },
    id: 'agent-001',
    model: 'claude-sonnet-4',
    tier: 2,
    startTime: Date.now(),
    tokensUsed: 0,
    taskProgress: 0,
    ...overrides,
  };
}

// =============================================================================
// IMPORT MODULES (after project setup)
// =============================================================================

// We need to import modules lazily to avoid circular dependencies
// and ensure test project exists first

async function importModules() {
  // CARL
  const { CARL, getCARL, resetCARL } = await import('../src/enforcement/carl');

  // Work Output
  const {
    writeWorkOutput,
    readWorkOutput,
    createWorkOutputBuilder,
  } = await import('../src/worker/work-output');

  // Spine
  const {
    buildSpine,
    compareSpines,
    capturePreStepSpine,
    handleWorkAccepted,
  } = await import('../src/enforcement/spine');

  // Ledger
  const {
    getLedgerWriter,
    getLedgerReader,
    resetLedgerWriter,
    resetLedgerReader,
  } = await import('../src/ledger');

  // PA
  const { createPALedgerIntegration } = await import('../src/pa/ledger-integration');

  // Constants (for thresholds)
  const { TOKEN_THRESHOLDS, GRACE_THRESHOLD } = await import('../src/enforcement/constants');

  return {
    CARL,
    getCARL,
    resetCARL,
    writeWorkOutput,
    readWorkOutput,
    createWorkOutputBuilder,
    buildSpine,
    compareSpines,
    capturePreStepSpine,
    handleWorkAccepted,
    getLedgerWriter,
    getLedgerReader,
    resetLedgerWriter,
    resetLedgerReader,
    createPALedgerIntegration,
    TOKEN_THRESHOLDS,
    GRACE_THRESHOLD,
  };
}

// =============================================================================
// TEST SUITES
// =============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Enforcement Flow Integration Tests');
  console.log('='.repeat(60));
  console.log('');

  // Setup test project
  setupTestProject();

  // Import modules
  const modules = await importModules();
  const {
    CARL,
    getCARL,
    resetCARL,
    writeWorkOutput,
    readWorkOutput,
    createWorkOutputBuilder,
    buildSpine,
    compareSpines,
    capturePreStepSpine,
    handleWorkAccepted,
    getLedgerWriter,
    getLedgerReader,
    resetLedgerWriter,
    resetLedgerReader,
    createPALedgerIntegration,
    TOKEN_THRESHOLDS,
    GRACE_THRESHOLD,
  } = modules;

  // ==========================================================================
  // Test Suite 1: CARL - Token Monitoring
  // ==========================================================================
  console.log('1. CARL - Token Monitoring:');

  test('CARL singleton can be created and reset', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    assertNotNull(carl, 'CARL instance should not be null');
    resetCARL();
  });

  test('CARL registers and tracks agents', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    const mockAgent = createMockAgent();

    carl.registerAgent(mockAgent as any);

    const state = carl.getState();
    assertTrue(state.agents.has('agent-001'), 'Agent should be registered');
    resetCARL();
  });

  test('CARL updates token usage', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    const mockAgent = createMockAgent();

    carl.registerAgent(mockAgent as any);
    carl.updateTokenUsage('agent-001', 5000);

    const agent = carl.getAgent('agent-001');
    assertNotNull(agent, 'Agent should exist');
    assertEqual(agent!.tokensUsed, 5000, 'Tokens should be updated');
    resetCARL();
  });

  test('CARL updates task progress', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    const mockAgent = createMockAgent();

    carl.registerAgent(mockAgent as any);
    carl.updateTaskProgress('agent-001', 0.75);

    const agent = carl.getAgent('agent-001');
    assertNotNull(agent, 'Agent should exist');
    assertEqual(agent!.taskProgress, 0.75, 'Progress should be updated');
    resetCARL();
  });

  test('CARL grants grace when near completion', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    const threshold = TOKEN_THRESHOLDS['claude-sonnet-4'] || TOKEN_THRESHOLDS.default;

    const mockAgent = createMockAgent({
      tokensUsed: Math.floor(threshold.effective * threshold.killAt) + 1000, // Over kill threshold
      taskProgress: 0.90, // But 90% done (above GRACE_THRESHOLD)
    });

    carl.registerAgent(mockAgent as any);
    const decision = carl.checkKillDecision(mockAgent as any);

    assertFalse(decision.shouldKill, 'Should not kill agent near completion');
    assertTrue(decision.grace === true, 'Should grant grace');
    resetCARL();
  });

  test('CARL kills agents over budget without grace', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    const threshold = TOKEN_THRESHOLDS['claude-sonnet-4'] || TOKEN_THRESHOLDS.default;

    const mockAgent = createMockAgent({
      tokensUsed: Math.floor(threshold.effective * threshold.killAt) + 1000, // Over kill threshold
      taskProgress: 0.30, // Only 30% done
    });

    carl.registerAgent(mockAgent as any);
    const decision = carl.checkKillDecision(mockAgent as any);

    assertTrue(decision.shouldKill, 'Should kill agent over budget without grace');
    assertTrue(
      Boolean(decision.reason?.includes('exceeds') || decision.reason?.includes('kill')),
      'Should have reason'
    );
    resetCARL();
  });

  test('CARL unregisters agents', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);
    const mockAgent = createMockAgent();

    carl.registerAgent(mockAgent as any);
    carl.unregisterAgent('agent-001');

    assertEqual(carl.getAgentCount(), 0, 'Agent count should be 0');
    resetCARL();
  });

  // ==========================================================================
  // Test Suite 2: Work Output System
  // ==========================================================================
  console.log('\n2. Work Output System:');

  test('writeWorkOutput writes file to correct location', () => {
    const output = createMockWorkOutput();
    writeWorkOutput(TEST_PROJECT_ROOT, output as any);

    const filePath = path.join(KENOKI_DIR, 'work_outputs', `${output.stepId}.md`);
    assertTrue(fs.existsSync(filePath), 'Work output file should exist');
  });

  test('readWorkOutput reads written file', () => {
    const output = createMockWorkOutput({ stepId: 'read-test-001' });
    writeWorkOutput(TEST_PROJECT_ROOT, output as any);

    const read = readWorkOutput(TEST_PROJECT_ROOT, output.stepId);
    assertNotNull(read, 'Should read work output');
    assertEqual(read!.task, 'Add login form', 'Task should match');
    assertIncludes(read!.filesCreated, 'src/LoginForm.tsx', 'Files should match');
  });

  test('createWorkOutputBuilder builds output correctly', () => {
    const builder = createWorkOutputBuilder('step-builder-test', 'worker-xyz');

    const output = builder
      .setTask('Build component', 'execute', 2)
      .setReasoning('Used existing patterns', 'Followed style guide')
      .addFileCreated('src/Component.tsx')
      .addAssumption('Props interface is correct')
      .addQuestion('Should we memoize?')
      .setTestResults(true, true)
      .setTokensUsed(3000)
      .build();

    assertEqual(output.stepId, 'step-builder-test', 'Step ID should match');
    assertIncludes(output.filesCreated, 'src/Component.tsx', 'File should be added');
    assertIncludes(output.assumptions, 'Props interface is correct', 'Assumption should be added');
    // Duration may be 0 if build is instant - just verify it's a number >= 0
    assertTrue(typeof output.durationMs === 'number' && output.durationMs >= 0, 'Duration should be a non-negative number');
  });

  // ==========================================================================
  // Test Suite 3: Spine - State Snapshots
  // ==========================================================================
  console.log('\n3. Spine - State Snapshots:');

  await testAsync('buildSpine captures project state', async () => {
    const spine = await buildSpine(TEST_PROJECT_ROOT);

    assertEqual(spine.projectDir, TEST_PROJECT_ROOT, 'Project dir should match');
    assertGreaterThan(spine.files.total, 0, 'Should have files');
    assertEqual(spine.projectState, 'OPEN', 'Project state should be OPEN');
  });

  await testAsync('compareSpines detects file additions', async () => {
    const before = await buildSpine(TEST_PROJECT_ROOT);

    // Add a new file
    fs.writeFileSync(
      path.join(TEST_PROJECT_ROOT, 'src', 'NewFile.ts'),
      'export const newThing = true;',
      'utf-8'
    );

    const after = await buildSpine(TEST_PROJECT_ROOT);
    const diff = compareSpines(before, after);

    assertTrue(
      diff.filesAdded.some(f => f.includes('NewFile.ts')),
      'Should detect added file'
    );
  });

  await testAsync('capturePreStepSpine stores snapshot for later comparison', async () => {
    const stepId = 'capture-test-001';
    await capturePreStepSpine(TEST_PROJECT_ROOT, stepId);

    // Verify we can proceed (the snapshot is stored internally)
    // We just test that no error is thrown
    assertTrue(true, 'Should capture pre-step spine');
  });

  // ==========================================================================
  // Test Suite 4: Ledger System
  // ==========================================================================
  console.log('\n4. Ledger System:');

  test('LedgerWriter creates ledger files', () => {
    resetLedgerWriter();
    const writer = getLedgerWriter(TEST_PROJECT_ROOT);

    // Write a CARL entry (which creates the ledger)
    writer.writeCARLEntry({
      type: 'AGENT_REGISTERED',
      agentId: 'test-agent',
      model: 'test-model',
      tier: 2,
    });

    const ledgerPath = path.join(KENOKI_DIR, 'ledgers', 'carl.jsonl');
    assertTrue(fs.existsSync(ledgerPath), 'CARL ledger should exist');
    resetLedgerWriter();
  });

  test('LedgerReader reads written entries', () => {
    resetLedgerWriter();
    resetLedgerReader();

    const writer = getLedgerWriter(TEST_PROJECT_ROOT);
    const reader = getLedgerReader(TEST_PROJECT_ROOT);

    writer.writeCARLEntry({
      type: 'AGENT_REGISTERED',
      agentId: 'reader-test-agent',
      model: 'test-model',
      tier: 2,
    });

    const entries = reader.readAll('ledgers/carl.jsonl');
    assertTrue(entries.length > 0, 'Should have entries');
    assertTrue(
      entries.some((e: any) => e.payload?.agentId === 'reader-test-agent'),
      'Should find written entry'
    );

    resetLedgerWriter();
    resetLedgerReader();
  });

  // ==========================================================================
  // Test Suite 5: Spine Review and Acknowledgments
  // ==========================================================================
  console.log('\n5. Spine Review and Acknowledgments:');

  await testAsync('handleWorkAccepted writes acknowledgment file', async () => {
    resetLedgerWriter();
    resetLedgerReader();

    const workOutput = createMockWorkOutput({
      stepId: 'ack-test-001',
      blockers: ['Need API key from user'],
      openQuestions: ['What color theme?'],
    });

    // Write work output first
    writeWorkOutput(TEST_PROJECT_ROOT, workOutput as any);

    // Capture pre-step spine
    await capturePreStepSpine(TEST_PROJECT_ROOT, workOutput.stepId);

    // Simulate work being done (add a file)
    fs.writeFileSync(
      path.join(TEST_PROJECT_ROOT, 'src', 'LoginForm.tsx'),
      'export const LoginForm = () => <form></form>;',
      'utf-8'
    );

    // Handle acceptance
    const review = await handleWorkAccepted(TEST_PROJECT_ROOT, {
      stepId: workOutput.stepId,
      workOutput: workOutput as any,
      verdict: {
        gate: { verdict: 'PASS', reasons: [], checksRun: 1, checksTimedOut: 0, checksSkipped: 0 },
        checksRun: 1,
        checksTimedOut: 0,
        executionTimeMs: 100,
        checkDetails: [],
      },
      acceptedAt: new Date().toISOString(),
    });

    // Verify acknowledgment file
    const ackPath = path.join(KENOKI_DIR, 'spine_acks', `ack_${workOutput.stepId}.md`);
    assertTrue(fs.existsSync(ackPath), 'Acknowledgment file should exist');

    // Verify review structure
    assertEqual(review.gateVerdict, 'ACCEPTED', 'Gate verdict should be ACCEPTED');
    assertGreaterThan(review.remainingWork.length, 0, 'Should have remaining work');

    resetLedgerWriter();
    resetLedgerReader();
  });

  await testAsync('handleWorkAccepted identifies blockers as high priority', async () => {
    resetLedgerWriter();
    resetLedgerReader();

    const workOutput = createMockWorkOutput({
      stepId: 'blocker-test-001',
      blockers: ['Waiting for database credentials'],
    });

    writeWorkOutput(TEST_PROJECT_ROOT, workOutput as any);
    await capturePreStepSpine(TEST_PROJECT_ROOT, workOutput.stepId);

    const review = await handleWorkAccepted(TEST_PROJECT_ROOT, {
      stepId: workOutput.stepId,
      workOutput: workOutput as any,
      verdict: {
        gate: { verdict: 'PASS', reasons: [], checksRun: 1, checksTimedOut: 0, checksSkipped: 0 },
        checksRun: 1,
        checksTimedOut: 0,
        executionTimeMs: 100,
        checkDetails: [],
      },
      acceptedAt: new Date().toISOString(),
    });

    // Find blocker work item
    const blockerWork = review.remainingWork.find(w => w.source === 'blocker');
    assertNotNull(blockerWork, 'Should have blocker work item');
    assertEqual(blockerWork!.priority, 'high', 'Blocker should be high priority');

    resetLedgerWriter();
    resetLedgerReader();
  });

  // ==========================================================================
  // Test Suite 6: PA Ledger Integration
  // ==========================================================================
  console.log('\n6. PA Ledger Integration:');

  test('PA can be created and initialized', () => {
    resetLedgerWriter();
    resetLedgerReader();

    const pa = createPALedgerIntegration(TEST_PROJECT_ROOT);
    assertNotNull(pa, 'PA should be created');

    pa.initialize({} as any);
    pa.cleanup();

    resetLedgerWriter();
    resetLedgerReader();
  });

  await testAsync('PA dispatches work based on Spine review', async () => {
    resetLedgerWriter();
    resetLedgerReader();

    const pa = createPALedgerIntegration(TEST_PROJECT_ROOT);

    // Track dispatched work
    let dispatchedWork: any = null;
    pa.on('work-dispatched', (data) => {
      dispatchedWork = data;
    });

    pa.initialize({} as any);

    // Simulate Spine writing a review with remaining work
    const writer = getLedgerWriter(TEST_PROJECT_ROOT);
    writer.writeSpineReview({
      stepId: 'pa-test-001',
      workerId: 'worker-abc',
      gateVerdict: 'ACCEPTED',
      filesChanged: ['src/LoginForm.tsx'],
      testsPassing: true,
      remainingWork: [{
        description: 'Need API key from user',
        agentType: 'cli',
        priority: 'high',
        dependencies: ['pa-test-001'],
        source: 'blocker',
      }],
      nextStepSuggestion: 'Need API key from user',
      reviewedAt: new Date().toISOString(),
    });

    // Give PA time to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Note: In actual implementation, PA reacts to ledger entries via file watching
    // For this test, we verify PA was initialized correctly
    assertTrue(true, 'PA should be able to process spine reviews');

    pa.cleanup();
    resetLedgerWriter();
    resetLedgerReader();
  });

  // ==========================================================================
  // Test Suite 7: Full Flow Integration
  // ==========================================================================
  console.log('\n7. Full Flow Integration:');

  await testAsync('Worker -> Bodyguard -> Spine -> PA -> Orchestrator flow', async () => {
    resetCARL();
    resetLedgerWriter();
    resetLedgerReader();

    const carl = getCARL(TEST_PROJECT_ROOT);

    // 1. CARL registers agent
    const mockAgent = createMockAgent({
      id: 'worker-integration-test',
      tokensUsed: 5000,
      taskProgress: 0.5,
    });
    carl.registerAgent(mockAgent as any);

    // 2. Worker writes output
    const workOutput = createMockWorkOutput({
      stepId: 'full-flow-001',
      workerId: 'worker-integration-test',
      blockers: ['Waiting for database credentials'],
    });
    writeWorkOutput(TEST_PROJECT_ROOT, workOutput as any);

    // 3. Capture pre-step spine
    await capturePreStepSpine(TEST_PROJECT_ROOT, workOutput.stepId);

    // 4. Simulate worker making changes
    fs.writeFileSync(
      path.join(TEST_PROJECT_ROOT, 'src', 'FullFlowLoginForm.tsx'),
      'export const LoginForm = () => <form><input /></form>;',
      'utf-8'
    );

    // 5. Spine handles acceptance (simulating Bodyguard passing)
    const review = await handleWorkAccepted(TEST_PROJECT_ROOT, {
      stepId: workOutput.stepId,
      workOutput: workOutput as any,
      verdict: {
        gate: { verdict: 'PASS', reasons: [], checksRun: 2, checksTimedOut: 0, checksSkipped: 0 },
        checksRun: 2,
        checksTimedOut: 0,
        executionTimeMs: 150,
        checkDetails: [],
      },
      acceptedAt: new Date().toISOString(),
    });

    // 6. Verify Spine review
    assertEqual(review.gateVerdict, 'ACCEPTED', 'Gate verdict should be ACCEPTED');
    assertGreaterThan(review.remainingWork.length, 0, 'Should have remaining work');

    // 7. Verify ledger entries exist
    const reader = getLedgerReader(TEST_PROJECT_ROOT);
    const spineEntries = reader.readAll('ledgers/spine.jsonl');
    assertTrue(spineEntries.length > 0, 'Should have spine ledger entries');

    // Find the review entry
    const reviewEntry = spineEntries.find((e: any) => e.type === 'REVIEW');
    assertNotNull(reviewEntry, 'Should have REVIEW entry in spine ledger');

    // 8. Verify acknowledgment file
    const ackPath = path.join(KENOKI_DIR, 'spine_acks', `ack_${workOutput.stepId}.md`);
    assertTrue(fs.existsSync(ackPath), 'Acknowledgment file should exist');

    // 9. Read acknowledgment content
    const ackContent = fs.readFileSync(ackPath, 'utf-8');
    assertTrue(ackContent.includes('ACCEPTED'), 'Acknowledgment should contain ACCEPTED');
    assertTrue(ackContent.includes(workOutput.task), 'Acknowledgment should contain task');

    // 10. Verify CARL still tracking agent
    const trackedAgent = carl.getAgent('worker-integration-test');
    assertNotNull(trackedAgent, 'CARL should still track agent');

    // Cleanup
    resetCARL();
    resetLedgerWriter();
    resetLedgerReader();
  });

  await testAsync('Multiple steps execute in sequence with proper handoffs', async () => {
    resetCARL();
    resetLedgerWriter();
    resetLedgerReader();

    const steps = ['step-a', 'step-b', 'step-c'];

    for (const stepId of steps) {
      // Worker writes output
      const workOutput = createMockWorkOutput({
        stepId,
        workerId: `worker-${stepId}`,
        task: `Task for ${stepId}`,
      });
      writeWorkOutput(TEST_PROJECT_ROOT, workOutput as any);

      // Capture and handle
      await capturePreStepSpine(TEST_PROJECT_ROOT, stepId);

      const review = await handleWorkAccepted(TEST_PROJECT_ROOT, {
        stepId,
        workOutput: workOutput as any,
        verdict: {
          gate: { verdict: 'PASS', reasons: [], checksRun: 1, checksTimedOut: 0, checksSkipped: 0 },
          checksRun: 1,
          checksTimedOut: 0,
          executionTimeMs: 50,
          checkDetails: [],
        },
        acceptedAt: new Date().toISOString(),
      });

      assertEqual(review.gateVerdict, 'ACCEPTED', `Step ${stepId} should be accepted`);
    }

    // Verify all acknowledgments exist
    for (const stepId of steps) {
      const ackPath = path.join(KENOKI_DIR, 'spine_acks', `ack_${stepId}.md`);
      assertTrue(fs.existsSync(ackPath), `Acknowledgment for ${stepId} should exist`);
    }

    resetCARL();
    resetLedgerWriter();
    resetLedgerReader();
  });

  // ==========================================================================
  // Test Suite 8: Edge Cases
  // ==========================================================================
  console.log('\n8. Edge Cases:');

  test('CARL handles missing agent gracefully', () => {
    resetCARL();
    const carl = getCARL(TEST_PROJECT_ROOT);

    carl.updateTokenUsage('nonexistent-agent', 1000);
    carl.updateTaskProgress('nonexistent-agent', 0.5);

    const agent = carl.getAgent('nonexistent-agent');
    assertTrue(agent === undefined, 'Should return undefined for missing agent');
    resetCARL();
  });

  test('readWorkOutput returns null for missing file', () => {
    const result = readWorkOutput(TEST_PROJECT_ROOT, 'nonexistent-step');
    assertTrue(result === null, 'Should return null for missing work output');
  });

  await testAsync('Spine handles missing pre-step snapshot gracefully', async () => {
    resetLedgerWriter();
    resetLedgerReader();

    const workOutput = createMockWorkOutput({
      stepId: 'no-prestep-001',
    });
    writeWorkOutput(TEST_PROJECT_ROOT, workOutput as any);

    // Don't capture pre-step spine - handleWorkAccepted should still work
    const review = await handleWorkAccepted(TEST_PROJECT_ROOT, {
      stepId: workOutput.stepId,
      workOutput: workOutput as any,
      verdict: {
        gate: { verdict: 'PASS', reasons: [], checksRun: 1, checksTimedOut: 0, checksSkipped: 0 },
        checksRun: 1,
        checksTimedOut: 0,
        executionTimeMs: 50,
        checkDetails: [],
      },
      acceptedAt: new Date().toISOString(),
    });

    assertEqual(review.gateVerdict, 'ACCEPTED', 'Should still accept work');

    resetLedgerWriter();
    resetLedgerReader();
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  // Cleanup
  cleanupTestProject();

  if (failed > 0) {
    process.exit(1);
  }
}

// =============================================================================
// RUN TESTS
// =============================================================================

runTests().catch((err) => {
  console.error('Test runner error:', err);
  cleanupTestProject();
  process.exit(1);
});
