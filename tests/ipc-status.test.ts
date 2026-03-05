/**
 * IPC Status Tests
 *
 * Tests for the IPC layer in src/status-agent/ipc.ts and handlers.ts.
 * Verifies channel registration, message forwarding, and cleanup.
 *
 * Run with: npx ts-node tests/ipc-status.test.ts
 */

// ============================================================================
// MOCK ELECTRON BEFORE IMPORTING MODULES
// ============================================================================

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Create a temp directory for test state
const testStateDir = path.join(os.tmpdir(), 'unified-terminal-ipc-test-' + Date.now());
if (!fs.existsSync(testStateDir)) {
  fs.mkdirSync(testStateDir, { recursive: true });
}

// Track registered handlers and listeners
const registeredHandlers: Map<string, () => Promise<unknown>> = new Map();
const registeredListeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
const sentMessages: Array<{ channel: string; args: unknown[] }> = [];

// Mock webContents
const mockWebContents = {
  send: (channel: string, ...args: unknown[]): void => {
    sentMessages.push({ channel, args });
  },
};

// Mock BrowserWindow
const mockBrowserWindow = {
  webContents: mockWebContents,
};

// Mock ipcMain
const mockIpcMain = {
  handle: (channel: string, handler: () => Promise<unknown>): void => {
    registeredHandlers.set(channel, handler);
  },
  removeHandler: (channel: string): void => {
    registeredHandlers.delete(channel);
  },
  on: (channel: string, listener: (...args: unknown[]) => void): void => {
    if (!registeredListeners.has(channel)) {
      registeredListeners.set(channel, []);
    }
    registeredListeners.get(channel)!.push(listener);
  },
  removeAllListeners: (channel: string): void => {
    registeredListeners.delete(channel);
  },
};

// Mock electron app module
const mockApp = {
  getPath: (name: string): string => {
    if (name === 'userData') {
      return testStateDir;
    }
    return testStateDir;
  },
  getName: (): string => 'unified-terminal-test',
  getVersion: (): string => '0.0.1-test',
  isReady: (): boolean => true,
  on: (): void => {},
  once: (): void => {},
};

// Use require.cache manipulation to inject mocks
require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: {
    app: mockApp,
    ipcMain: mockIpcMain,
    BrowserWindow: function MockBrowserWindow() {
      return mockBrowserWindow;
    },
  },
} as NodeJS.Module;

// Now import the modules
import {
  setMainWindow,
  getMainWindow,
  clearMainWindow,
  sendStatusLine,
  sendStatusLineUpdate,
  sendTreeNode,
  sendQuery,
  sendQueryTimeout,
  sendFuelUpdate,
  sendBuildStarted,
  sendBuildComplete,
  sendInterruptAck,
  sendShellState,
  sendStatusLineBatch,
  sendStatusLineUpdateBatch,
  sendError,
  sendErrorRecovered,
} from '../src/status-agent/ipc';

import {
  registerStatusAgentHandlers,
  removeStatusAgentHandlers,
  registerStatusAgentInvokeHandlers,
  removeStatusAgentInvokeHandlers,
} from '../src/status-agent/handlers';

import type { StatusLine, TreeNode, UserQuery, FuelState } from '../src/status-agent/types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

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

function assertNull(value: unknown, message?: string): void {
  if (value !== null) {
    throw new Error(message || `Expected null, got ${JSON.stringify(value)}`);
  }
}

function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be non-null');
  }
}

function assertIncludes(str: string, substring: string, message?: string): void {
  if (!str.includes(substring)) {
    throw new Error(
      message || `Expected string to include "${substring}", got: "${str.substring(0, 100)}..."`
    );
  }
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockStatusLine(): StatusLine {
  return {
    id: 'test-line-1',
    text: 'Processing files...',
    expandable: true,
    expandedText: 'Processing 10 files in /src directory',
    state: 'active',
    stepId: 1,
    parentId: null,
    progress: 50,
    icon: '...',
  };
}

function createMockTreeNode(): TreeNode {
  return {
    id: 'node-1',
    parentId: null,
    label: 'Building project',
    state: 'active',
    progress: 25,
    expandable: true,
    expanded: false,
    children: ['node-1-a', 'node-1-b'],
    stepId: 1,
    agentId: 'codex',
    output: null,
  };
}

function createMockUserQuery(): UserQuery {
  return {
    id: 'query-1',
    source: 'conductor',
    stepId: 2,
    agentHandle: 'codex-agent-1',
    type: 'choice',
    question: 'Which framework should I use?',
    options: [
      { label: 'React', value: 'react', detail: 'Popular frontend framework', icon: null },
      { label: 'Vue', value: 'vue', detail: 'Progressive framework', icon: null },
    ],
    placeholder: null,
    defaultChoice: 'react',
    timeout: 30000,
    priority: 'normal',
  };
}

function createMockFuelState(): FuelState {
  return {
    percent: 75,
    label: '75% remaining',
    detail: 'Session budget: $0.75 of $1.00 used',
    warning: false,
    warningText: null,
  };
}

// Helper to reset test state
function resetTestState(): void {
  sentMessages.length = 0;
  registeredHandlers.clear();
  registeredListeners.clear();
  clearMainWindow();
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('IPC Status Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // Test Category 1: Window Reference Management
  // ==========================================================================
  console.log('1. Window Reference Management:');

  test('getMainWindow() returns null initially', () => {
    resetTestState();
    const win = getMainWindow();
    assertNull(win, 'Should return null when no window is set');
  });

  test('setMainWindow() stores the window reference', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const win = getMainWindow();
    assertNotNull(win, 'Should return the set window');
    assertEqual(win, mockBrowserWindow as unknown as import('electron').BrowserWindow);
  });

  test('clearMainWindow() removes the reference', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    clearMainWindow();
    const win = getMainWindow();
    assertNull(win, 'Should return null after clearing');
  });

  test('setMainWindow() can be called multiple times', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const win = getMainWindow();
    assertNotNull(win, 'Should still have a reference after multiple sets');
  });

  // ==========================================================================
  // Test Category 2: Status Line Channel - status:line
  // ==========================================================================
  console.log('\n2. Status Line Channel (status:line):');

  test('sendStatusLine() sends to status:line channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const line = createMockStatusLine();
    sendStatusLine(line);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:line');
  });

  test('sendStatusLine() forwards complete StatusLine object', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const line = createMockStatusLine();
    sendStatusLine(line);
    const sent = sentMessages[0].args[0] as StatusLine;
    assertEqual(sent.id, 'test-line-1');
    assertEqual(sent.text, 'Processing files...');
    assertEqual(sent.state, 'active');
    assertEqual(sent.progress, 50);
  });

  test('sendStatusLine() does nothing when mainWindow is null', () => {
    resetTestState();
    // Don't set main window
    const line = createMockStatusLine();
    sendStatusLine(line);
    assertEqual(sentMessages.length, 0, 'Should not send when window is null');
  });

  // ==========================================================================
  // Test Category 3: Status Line Update Channel - status:line-update
  // ==========================================================================
  console.log('\n3. Status Line Update Channel (status:line-update):');

  test('sendStatusLineUpdate() sends to status:line-update channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendStatusLineUpdate('test-line-1', { progress: 75 });
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:line-update');
  });

  test('sendStatusLineUpdate() includes id in payload', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendStatusLineUpdate('test-line-1', { state: 'done', progress: 100 });
    const sent = sentMessages[0].args[0] as { id: string; state?: string; progress?: number };
    assertEqual(sent.id, 'test-line-1');
    assertEqual(sent.state, 'done');
    assertEqual(sent.progress, 100);
  });

  // ==========================================================================
  // Test Category 4: Query Channel - status:query
  // ==========================================================================
  console.log('\n4. Query Channel (status:query):');

  test('sendQuery() sends to status:query channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const query = createMockUserQuery();
    sendQuery(query);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:query');
  });

  test('sendQuery() forwards complete UserQuery object', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const query = createMockUserQuery();
    sendQuery(query);
    const sent = sentMessages[0].args[0] as UserQuery;
    assertEqual(sent.id, 'query-1');
    assertEqual(sent.type, 'choice');
    assertEqual(sent.options.length, 2);
    assertEqual(sent.options[0].value, 'react');
  });

  test('sendQueryTimeout() sends to status:query-timeout channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendQueryTimeout('query-1', 'react');
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:query-timeout');
    const sent = sentMessages[0].args[0] as { queryId: string; defaultValue: string };
    assertEqual(sent.queryId, 'query-1');
    assertEqual(sent.defaultValue, 'react');
  });

  // ==========================================================================
  // Test Category 5: Tree Node Channel - status:tree-node
  // ==========================================================================
  console.log('\n5. Tree Node Channel (status:tree-node):');

  test('sendTreeNode() sends to status:tree-node channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const node = createMockTreeNode();
    sendTreeNode(node);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:tree-node');
  });

  test('sendTreeNode() forwards complete TreeNode object', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const node = createMockTreeNode();
    sendTreeNode(node);
    const sent = sentMessages[0].args[0] as TreeNode;
    assertEqual(sent.id, 'node-1');
    assertEqual(sent.label, 'Building project');
    assertEqual(sent.children.length, 2);
    assertTrue(sent.children.includes('node-1-a'));
  });

  // ==========================================================================
  // Test Category 6: Fuel Update Channel - status:fuel-update
  // ==========================================================================
  console.log('\n6. Fuel Update Channel (status:fuel-update):');

  test('sendFuelUpdate() sends to status:fuel-update channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const fuel = createMockFuelState();
    sendFuelUpdate(fuel);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:fuel-update');
  });

  test('sendFuelUpdate() forwards complete FuelState object', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const fuel = createMockFuelState();
    sendFuelUpdate(fuel);
    const sent = sentMessages[0].args[0] as FuelState;
    assertEqual(sent.percent, 75);
    assertEqual(sent.warning, false);
    assertIncludes(sent.label, '75%');
  });

  // ==========================================================================
  // Test Category 7: Build Lifecycle Channels
  // ==========================================================================
  console.log('\n7. Build Lifecycle Channels:');

  test('sendBuildStarted() sends to build:started channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendBuildStarted('my-project', 2, '5 minutes');
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'build:started');
    const sent = sentMessages[0].args[0] as { projectName: string; tier: number; estimatedTime: string };
    assertEqual(sent.projectName, 'my-project');
    assertEqual(sent.tier, 2);
    assertEqual(sent.estimatedTime, '5 minutes');
  });

  test('sendBuildComplete() sends to build:complete channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const outputs = [
      { type: 'url', label: 'Preview', value: 'https://preview.example.com' },
    ];
    sendBuildComplete(outputs);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'build:complete');
    const sent = sentMessages[0].args[0] as { outputs: typeof outputs };
    assertEqual(sent.outputs.length, 1);
    assertEqual(sent.outputs[0].type, 'url');
  });

  // ==========================================================================
  // Test Category 8: Interrupt and Control Channels
  // ==========================================================================
  console.log('\n8. Interrupt and Control Channels:');

  test('sendInterruptAck() sends to status:interrupt-ack channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendInterruptAck({
      affected: ['step-1', 'step-2'],
      unaffected: ['step-3'],
      message: 'Updating design...',
    });
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:interrupt-ack');
  });

  test('sendShellState() sends to shell:state-change channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendShellState('building');
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'shell:state-change');
    assertEqual(sentMessages[0].args[0], 'building');
  });

  test('sendShellState() handles all state values', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);

    sendShellState('idle');
    sendShellState('building');
    sendShellState('minimised');
    sendShellState('complete');

    assertEqual(sentMessages.length, 4);
    assertEqual(sentMessages[0].args[0], 'idle');
    assertEqual(sentMessages[1].args[0], 'building');
    assertEqual(sentMessages[2].args[0], 'minimised');
    assertEqual(sentMessages[3].args[0], 'complete');
  });

  // ==========================================================================
  // Test Category 9: Batch Operations
  // ==========================================================================
  console.log('\n9. Batch Operations:');

  test('sendStatusLineBatch() sends to status:line-batch channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const lines = [createMockStatusLine(), { ...createMockStatusLine(), id: 'test-line-2' }];
    sendStatusLineBatch(lines);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:line-batch');
    const sent = sentMessages[0].args[0] as StatusLine[];
    assertEqual(sent.length, 2);
  });

  test('sendStatusLineUpdateBatch() sends to status:line-update-batch channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    const updates = [
      { id: 'line-1', progress: 25 },
      { id: 'line-2', progress: 50 },
      { id: 'line-3', state: 'done' as const, progress: 100 },
    ];
    sendStatusLineUpdateBatch(updates);
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:line-update-batch');
    const sent = sentMessages[0].args[0] as typeof updates;
    assertEqual(sent.length, 3);
  });

  // ==========================================================================
  // Test Category 10: Error Channels
  // ==========================================================================
  console.log('\n10. Error Channels:');

  test('sendError() sends to status:error channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendError({
      id: 'error-1',
      message: 'Build failed: missing dependency',
      stepId: 3,
      recoverable: true,
    });
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:error');
    const sent = sentMessages[0].args[0] as { id: string; message: string; recoverable: boolean };
    assertEqual(sent.id, 'error-1');
    assertTrue(sent.recoverable);
  });

  test('sendErrorRecovered() sends to status:error-recovered channel', () => {
    resetTestState();
    setMainWindow(mockBrowserWindow as unknown as import('electron').BrowserWindow);
    sendErrorRecovered('error-1', 'Installed missing dependency');
    assertEqual(sentMessages.length, 1);
    assertEqual(sentMessages[0].channel, 'status:error-recovered');
    const sent = sentMessages[0].args[0] as { errorId: string; resolution: string };
    assertEqual(sent.errorId, 'error-1');
    assertEqual(sent.resolution, 'Installed missing dependency');
  });

  // ==========================================================================
  // Test Category 11: Handler Registration (handlers.ts)
  // ==========================================================================
  console.log('\n11. Handler Registration:');

  test('registerStatusAgentHandlers() registers all expected channels', () => {
    resetTestState();
    registerStatusAgentHandlers(
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {}
    );

    assertTrue(registeredListeners.has('user:query-response'));
    assertTrue(registeredListeners.has('user:correction'));
    assertTrue(registeredListeners.has('user:stop-step'));
    assertTrue(registeredListeners.has('user:stop-all'));
    assertTrue(registeredListeners.has('user:hide-tree'));
    assertTrue(registeredListeners.has('user:expand-tree'));
    assertTrue(registeredListeners.has('user:dismiss-tree'));
  });

  test('removeStatusAgentHandlers() removes all listeners', () => {
    resetTestState();
    registerStatusAgentHandlers(
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {}
    );

    removeStatusAgentHandlers();

    assertFalse(registeredListeners.has('user:query-response'));
    assertFalse(registeredListeners.has('user:correction'));
    assertFalse(registeredListeners.has('user:stop-step'));
    assertFalse(registeredListeners.has('user:stop-all'));
    assertFalse(registeredListeners.has('user:hide-tree'));
    assertFalse(registeredListeners.has('user:expand-tree'));
    assertFalse(registeredListeners.has('user:dismiss-tree'));
  });

  // ==========================================================================
  // Test Category 12: Invoke Handler Registration
  // ==========================================================================
  console.log('\n12. Invoke Handler Registration:');

  test('registerStatusAgentInvokeHandlers() registers handle channels', () => {
    resetTestState();
    registerStatusAgentInvokeHandlers(
      async () => ({}),
      async () => ({}),
      async () => ({})
    );

    assertTrue(registeredHandlers.has('status:get-tree'));
    assertTrue(registeredHandlers.has('status:get-pending-queries'));
    assertTrue(registeredHandlers.has('status:get-fuel'));
  });

  test('removeStatusAgentInvokeHandlers() removes handle channels', () => {
    resetTestState();
    registerStatusAgentInvokeHandlers(
      async () => ({}),
      async () => ({}),
      async () => ({})
    );

    removeStatusAgentInvokeHandlers();

    assertFalse(registeredHandlers.has('status:get-tree'));
    assertFalse(registeredHandlers.has('status:get-pending-queries'));
    assertFalse(registeredHandlers.has('status:get-fuel'));
  });

  await testAsync('Invoke handlers return correct data', async () => {
    resetTestState();
    const mockTree = { nodes: [], rootIds: [] };
    const mockQueries = { 'query-1': createMockUserQuery() };
    const mockFuel = createMockFuelState();

    registerStatusAgentInvokeHandlers(
      async () => mockTree,
      async () => mockQueries,
      async () => mockFuel
    );

    const treeHandler = registeredHandlers.get('status:get-tree');
    const queriesHandler = registeredHandlers.get('status:get-pending-queries');
    const fuelHandler = registeredHandlers.get('status:get-fuel');

    assertNotNull(treeHandler);
    assertNotNull(queriesHandler);
    assertNotNull(fuelHandler);

    const tree = await treeHandler();
    const queries = await queriesHandler();
    const fuel = await fuelHandler();

    assertEqual(tree, mockTree);
    assertEqual(queries, mockQueries);
    assertEqual(fuel, mockFuel);
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  // Cleanup
  try {
    fs.rmSync(testStateDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
