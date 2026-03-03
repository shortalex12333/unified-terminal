/**
 * CLI Runner Tests
 *
 * Gate 7: CLI Process Management
 *
 * Run with: npx ts-node tests/cli-runner.test.ts
 */

import { CLIRunner, ProcessInfo, ProcessOutput, ProcessStatusEvent } from '../src/main/cli-runner';
import { translateOutput, translateCleanOutput, stripAnsi, getProgressStatus } from '../src/main/output-translator';

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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// OUTPUT TRANSLATOR TESTS
// ============================================================================

console.log('\n=== Output Translator Tests ===\n');

// Test error patterns
{
  console.log('Testing error pattern detection...');
  const errorResult = translateOutput('Error: Module not found');
  assert(errorResult.translated === true, 'Should translate error message');
  assert(errorResult.category === 'error', 'Should categorize as error');
  assert(errorResult.message !== null, 'Should have a message');
}

// Test success patterns
{
  console.log('Testing success pattern detection...');
  const successResult = translateOutput('Build succeeded');
  assert(successResult.translated === true, 'Should translate success message');
  assert(successResult.category === 'success', 'Should categorize as success');
}

// Test progress patterns
{
  console.log('Testing progress pattern detection...');
  const progressResult = translateOutput('Installing dependencies');
  assert(progressResult.translated === true, 'Should translate progress message');
  assert(progressResult.category === 'progress', 'Should categorize as progress');
}

// Test file creation patterns
{
  console.log('Testing file creation pattern detection...');
  const createResult = translateOutput('Creating src/components/Button.tsx');
  assert(createResult.translated === true, 'Should translate file creation');
  assert(createResult.message?.includes('Creating') ?? false, 'Should say Creating');
  assert(createResult.message?.includes('button') ?? false, 'Should include friendly filename');
}

// Test server ready patterns
{
  console.log('Testing server ready pattern detection...');
  const serverResult = translateOutput('Server listening on port 3000');
  assert(serverResult.translated === true, 'Should translate server message');
  assert(serverResult.message?.includes('3000') ?? false, 'Should include port number');
  assert(serverResult.category === 'success', 'Should categorize as success');
}

// Test percentage progress
{
  console.log('Testing percentage progress detection...');
  // Note: "complete" would match success pattern first, so use a simpler example
  const percentResult = translateOutput('Downloading... 45%');
  assert(percentResult.translated === true, 'Should translate percentage');
  assert(percentResult.message?.includes('45') ?? false, 'Should include percentage');
}

// Test npm package count
{
  console.log('Testing npm package count detection...');
  const npmResult = translateOutput('added 156 packages in 12s');
  assert(npmResult.translated === true, 'Should translate npm message');
  assert(npmResult.message?.includes('156') ?? false, 'Should include package count');
}

// Test ANSI stripping
{
  console.log('Testing ANSI code stripping...');
  const withAnsi = '\x1b[32mSuccess\x1b[0m';
  const stripped = stripAnsi(withAnsi);
  assert(stripped === 'Success', 'Should strip ANSI codes');
}

// Test no match
{
  console.log('Testing non-matching output...');
  const noMatch = translateOutput('Random log message');
  assert(noMatch.translated === false, 'Should not translate random messages');
  assert(noMatch.message === null, 'Should return null message');
}

// Test empty input
{
  console.log('Testing empty input...');
  const emptyResult = translateOutput('');
  assert(emptyResult.translated === false, 'Should not translate empty string');
}

// Test getProgressStatus
{
  console.log('Testing getProgressStatus helper...');
  const status = getProgressStatus('Building project...');
  assert(status !== null, 'Should return status for valid input');
}

// ============================================================================
// CLI RUNNER TESTS
// ============================================================================

console.log('\n=== CLI Runner Tests ===\n');

async function testCLIRunner(): Promise<void> {
  const runner = new CLIRunner();

  // Test process spawning
  {
    console.log('Testing process spawning...');
    const processId = runner.spawn('echo', ['hello world']);
    assert(typeof processId === 'string', 'Should return process ID');
    assert(processId.startsWith('proc_'), 'Process ID should start with proc_');

    const info = runner.getProcess(processId);
    assert(info !== null, 'Should find process info');
    assert(info?.tool === 'echo', 'Should have correct tool name');
    assert(info?.args.includes('hello world') ?? false, 'Should have correct args');

    // Wait for process to complete
    await sleep(500);

    const finalInfo = runner.getProcess(processId);
    assert(finalInfo?.status === 'completed', 'Process should complete');
    assert(finalInfo?.exitCode === 0, 'Should have exit code 0');
  }

  // Test output capture
  {
    console.log('Testing output capture...');
    let capturedOutput = '';

    runner.on('output', (output: ProcessOutput) => {
      capturedOutput += output.data;
    });

    const processId = runner.spawn('echo', ['test output']);
    await sleep(500);

    assert(capturedOutput.includes('test output'), 'Should capture output');
    runner.removeAllListeners('output');
  }

  // Test status events
  {
    console.log('Testing status events...');
    const statuses: ProcessStatusEvent[] = [];

    runner.on('status', (status: ProcessStatusEvent) => {
      statuses.push(status);
    });

    const processId = runner.spawn('echo', ['status test']);
    await sleep(500);

    assert(statuses.length >= 1, 'Should receive status events');
    assert(statuses.some(s => s.status === 'running'), 'Should have running status');
    runner.removeAllListeners('status');
  }

  // Test process listing
  {
    console.log('Testing process listing...');
    const allProcesses = runner.getAllProcesses();
    assert(Array.isArray(allProcesses), 'Should return array');
    assert(allProcesses.length > 0, 'Should have processes');
  }

  // Test process cleanup
  {
    console.log('Testing process cleanup...');
    // All our test processes should be done by now
    const cleaned = runner.cleanup(0); // Clean everything immediately
    assert(typeof cleaned === 'number', 'Cleanup should return count');
  }

  // Test long-running process and kill
  {
    console.log('Testing process kill...');
    // Use a process that runs for a while
    const processId = runner.spawn('sleep', ['10']);

    await sleep(100);
    const runningInfo = runner.getProcess(processId);
    assert(runningInfo?.status === 'running', 'Process should be running');

    runner.kill(processId);
    // kill() is async internally but returns synchronously
    // Give it time to complete
    await sleep(200);
    const killedInfo = runner.getProcess(processId);
    assert(killedInfo?.status === 'killed', 'Process should be killed');
  }

  // Test timeout
  {
    console.log('Testing process timeout...');
    const processId = runner.spawn('sleep', ['10'], { timeout: 200 });

    await sleep(500);
    const timedOutInfo = runner.getProcess(processId);
    assert(
      timedOutInfo?.status === 'timeout' || timedOutInfo?.status === 'killed',
      'Process should timeout or be killed'
    );
  }

  // Test isRunning
  {
    console.log('Testing isRunning...');
    const processId = runner.spawn('sleep', ['0.1']);
    assert(runner.isRunning(processId) === true, 'Should report running');

    await sleep(300);
    assert(runner.isRunning(processId) === false, 'Should report not running after completion');
  }

  // Test getRunningProcesses
  {
    console.log('Testing getRunningProcesses...');
    const id1 = runner.spawn('sleep', ['5']);
    const id2 = runner.spawn('sleep', ['5']);

    await sleep(50);
    const running = runner.getRunningProcesses();
    assert(running.length >= 2, 'Should have at least 2 running');

    // Cleanup
    runner.killAll();
    await sleep(200);
  }

  // Test killAll
  {
    console.log('Testing killAll...');
    runner.spawn('sleep', ['10']);
    runner.spawn('sleep', ['10']);
    runner.spawn('sleep', ['10']);

    await sleep(100);
    runner.killAll();
    await sleep(300);

    const runningAfterKillAll = runner.getRunningProcesses();
    assert(runningAfterKillAll.length === 0, 'Should have no running processes');
  }

  // Clean up
  runner.removeAllListeners();
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runAllTests(): Promise<void> {
  await testCLIRunner();

  console.log('\n=== Test Summary ===\n');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total:  ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
