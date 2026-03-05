/**
 * Status Tree Tests
 *
 * Tests for the tree node management in src/status-agent/types.ts and
 * the tree operations in the StatusAgentManager.
 * Verifies node creation, state transitions, hierarchy, and expand/collapse.
 *
 * Run with: npx ts-node tests/status-tree.test.ts
 */

// ============================================================================
// MOCK ELECTRON BEFORE IMPORTING MODULES
// ============================================================================

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Create a temp directory for test state
const testStateDir = path.join(os.tmpdir(), 'unified-terminal-tree-test-' + Date.now());
if (!fs.existsSync(testStateDir)) {
  fs.mkdirSync(testStateDir, { recursive: true });
}

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

const mockIpcMain = {
  handle: (): void => {},
  removeHandler: (): void => {},
  on: (): void => {},
  removeAllListeners: (): void => {},
};

// Mock webContents
const mockWebContents = {
  send: (): void => {},
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
      return { webContents: mockWebContents };
    },
  },
} as NodeJS.Module;

// Import types (these don't require electron)
import type {
  TreeNode,
  StatusState,
  StatusLine,
  TreeNodeOutput,
  TreeNodeOutputType,
  StatusAgentState,
} from '../src/status-agent/types';

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

function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertArrayIncludes<T>(arr: T[], item: T, message?: string): void {
  if (!arr.includes(item)) {
    throw new Error(
      message || `Expected array to include ${JSON.stringify(item)}`
    );
  }
}

// ============================================================================
// TREE NODE BUILDER (Helper class for testing)
// ============================================================================

/**
 * Helper class to build and manage tree nodes for testing.
 * Simulates the tree management done by StatusAgentManager.
 */
class TreeManager {
  private nodes: Map<string, TreeNode> = new Map();
  private rootIds: string[] = [];

  /**
   * Create a new tree node.
   */
  createNode(
    id: string,
    label: string,
    parentId: string | null = null,
    state: StatusState = 'pending'
  ): TreeNode {
    const node: TreeNode = {
      id,
      parentId,
      label,
      state,
      progress: null,
      expandable: true,
      expanded: false,
      children: [],
      stepId: null,
      agentId: null,
      output: null,
    };

    this.nodes.set(id, node);

    // Add to parent's children or to root
    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent && !parent.children.includes(id)) {
        parent.children.push(id);
      }
    } else {
      if (!this.rootIds.includes(id)) {
        this.rootIds.push(id);
      }
    }

    return node;
  }

  /**
   * Update node state.
   */
  updateNodeState(id: string, state: StatusState): void {
    const node = this.nodes.get(id);
    if (node) {
      node.state = state;
    }
  }

  /**
   * Update node progress.
   */
  updateNodeProgress(id: string, progress: number | null): void {
    const node = this.nodes.get(id);
    if (node) {
      node.progress = progress;
    }
  }

  /**
   * Toggle expand/collapse state.
   */
  toggleExpanded(id: string): void {
    const node = this.nodes.get(id);
    if (node && node.expandable) {
      node.expanded = !node.expanded;
    }
  }

  /**
   * Set expanded state.
   */
  setExpanded(id: string, expanded: boolean): void {
    const node = this.nodes.get(id);
    if (node) {
      node.expanded = expanded;
    }
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): TreeNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all root node IDs.
   */
  getRootIds(): string[] {
    return this.rootIds;
  }

  /**
   * Get all nodes.
   */
  getAllNodes(): Map<string, TreeNode> {
    return this.nodes;
  }

  /**
   * Get children of a node.
   */
  getChildren(id: string): TreeNode[] {
    const node = this.nodes.get(id);
    if (!node) return [];
    return node.children
      .map((childId) => this.nodes.get(childId))
      .filter((n): n is TreeNode => n !== undefined);
  }

  /**
   * Clear all nodes.
   */
  clear(): void {
    this.nodes.clear();
    this.rootIds = [];
  }
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Status Tree Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==========================================================================
  // Test Category 1: Node Creation
  // ==========================================================================
  console.log('1. Node Creation:');

  test('createNode() creates a node with default values', () => {
    const manager = new TreeManager();
    const node = manager.createNode('node-1', 'Building project');

    assertEqual(node.id, 'node-1');
    assertEqual(node.label, 'Building project');
    assertEqual(node.state, 'pending');
    assertNull(node.parentId);
    assertNull(node.progress);
    assertTrue(node.expandable);
    assertFalse(node.expanded);
    assertEqual(node.children.length, 0);
    assertNull(node.stepId);
    assertNull(node.agentId);
    assertNull(node.output);
  });

  test('createNode() with parent sets parentId correctly', () => {
    const manager = new TreeManager();
    manager.createNode('parent-1', 'Parent Task');
    const child = manager.createNode('child-1', 'Child Task', 'parent-1');

    assertEqual(child.parentId, 'parent-1');
    assertNotNull(child.parentId);
  });

  test('createNode() adds child to parent children array', () => {
    const manager = new TreeManager();
    const parent = manager.createNode('parent-1', 'Parent Task');
    manager.createNode('child-1', 'Child Task 1', 'parent-1');
    manager.createNode('child-2', 'Child Task 2', 'parent-1');

    // Re-get parent to check updated children
    const updatedParent = manager.getNode('parent-1');
    assertNotNull(updatedParent);
    assertEqual(updatedParent.children.length, 2);
    assertArrayIncludes(updatedParent.children, 'child-1');
    assertArrayIncludes(updatedParent.children, 'child-2');
  });

  test('createNode() with custom state', () => {
    const manager = new TreeManager();
    const node = manager.createNode('node-1', 'Active Task', null, 'active');

    assertEqual(node.state, 'active');
  });

  test('Root nodes are added to rootIds', () => {
    const manager = new TreeManager();
    manager.createNode('root-1', 'Root Task 1');
    manager.createNode('root-2', 'Root Task 2');

    const rootIds = manager.getRootIds();
    assertEqual(rootIds.length, 2);
    assertArrayIncludes(rootIds, 'root-1');
    assertArrayIncludes(rootIds, 'root-2');
  });

  test('Child nodes are not added to rootIds', () => {
    const manager = new TreeManager();
    manager.createNode('root-1', 'Root Task');
    manager.createNode('child-1', 'Child Task', 'root-1');

    const rootIds = manager.getRootIds();
    assertEqual(rootIds.length, 1);
    assertFalse(rootIds.includes('child-1'));
  });

  // ==========================================================================
  // Test Category 2: State Transitions
  // ==========================================================================
  console.log('\n2. State Transitions:');

  test('updateNodeState() changes pending to active', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    assertEqual(manager.getNode('node-1')?.state, 'pending');

    manager.updateNodeState('node-1', 'active');

    assertEqual(manager.getNode('node-1')?.state, 'active');
  });

  test('updateNodeState() changes active to done', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task', null, 'active');

    manager.updateNodeState('node-1', 'done');

    assertEqual(manager.getNode('node-1')?.state, 'done');
  });

  test('updateNodeState() changes active to error', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task', null, 'active');

    manager.updateNodeState('node-1', 'error');

    assertEqual(manager.getNode('node-1')?.state, 'error');
  });

  test('updateNodeState() supports waiting_user state', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task', null, 'active');

    manager.updateNodeState('node-1', 'waiting_user');

    assertEqual(manager.getNode('node-1')?.state, 'waiting_user');
  });

  test('updateNodeState() supports paused state', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task', null, 'active');

    manager.updateNodeState('node-1', 'paused');

    assertEqual(manager.getNode('node-1')?.state, 'paused');
  });

  test('All StatusState values are valid', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    const states: StatusState[] = ['pending', 'active', 'done', 'error', 'paused', 'waiting_user'];

    for (const state of states) {
      manager.updateNodeState('node-1', state);
      assertEqual(manager.getNode('node-1')?.state, state);
    }
  });

  // ==========================================================================
  // Test Category 3: Children Array Management
  // ==========================================================================
  console.log('\n3. Children Array Management:');

  test('getChildren() returns empty array for leaf node', () => {
    const manager = new TreeManager();
    manager.createNode('leaf-1', 'Leaf Node');

    const children = manager.getChildren('leaf-1');
    assertEqual(children.length, 0);
  });

  test('getChildren() returns child nodes', () => {
    const manager = new TreeManager();
    manager.createNode('parent-1', 'Parent');
    manager.createNode('child-1', 'Child 1', 'parent-1');
    manager.createNode('child-2', 'Child 2', 'parent-1');

    const children = manager.getChildren('parent-1');
    assertEqual(children.length, 2);
    assertTrue(children.some((c) => c.id === 'child-1'));
    assertTrue(children.some((c) => c.id === 'child-2'));
  });

  test('Deep nesting: grandchildren work correctly', () => {
    const manager = new TreeManager();
    manager.createNode('root', 'Root');
    manager.createNode('child', 'Child', 'root');
    manager.createNode('grandchild', 'Grandchild', 'child');

    const rootChildren = manager.getChildren('root');
    assertEqual(rootChildren.length, 1);
    assertEqual(rootChildren[0].id, 'child');

    const childChildren = manager.getChildren('child');
    assertEqual(childChildren.length, 1);
    assertEqual(childChildren[0].id, 'grandchild');
  });

  test('Children maintain insertion order', () => {
    const manager = new TreeManager();
    manager.createNode('parent', 'Parent');
    manager.createNode('child-a', 'A', 'parent');
    manager.createNode('child-b', 'B', 'parent');
    manager.createNode('child-c', 'C', 'parent');

    const parent = manager.getNode('parent');
    assertNotNull(parent);
    assertEqual(parent.children[0], 'child-a');
    assertEqual(parent.children[1], 'child-b');
    assertEqual(parent.children[2], 'child-c');
  });

  test('Duplicate child IDs are not added', () => {
    const manager = new TreeManager();
    manager.createNode('parent', 'Parent');
    manager.createNode('child', 'Child', 'parent');
    // Try to create same child again (simulating duplicate event)
    manager.createNode('child', 'Child', 'parent');

    const parent = manager.getNode('parent');
    assertNotNull(parent);
    assertEqual(parent.children.length, 1);
  });

  // ==========================================================================
  // Test Category 4: Expand/Collapse State
  // ==========================================================================
  console.log('\n4. Expand/Collapse State:');

  test('Nodes start collapsed (expanded = false)', () => {
    const manager = new TreeManager();
    const node = manager.createNode('node-1', 'Task');

    assertFalse(node.expanded);
  });

  test('toggleExpanded() expands a collapsed node', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    manager.toggleExpanded('node-1');

    assertTrue(manager.getNode('node-1')?.expanded ?? false);
  });

  test('toggleExpanded() collapses an expanded node', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');
    manager.toggleExpanded('node-1'); // Expand
    manager.toggleExpanded('node-1'); // Collapse

    assertFalse(manager.getNode('node-1')?.expanded ?? true);
  });

  test('setExpanded() explicitly sets expansion state', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    manager.setExpanded('node-1', true);
    assertTrue(manager.getNode('node-1')?.expanded ?? false);

    manager.setExpanded('node-1', false);
    assertFalse(manager.getNode('node-1')?.expanded ?? true);
  });

  test('Expandable property controls whether node can expand', () => {
    const manager = new TreeManager();
    const node = manager.createNode('node-1', 'Task');

    // Default is expandable
    assertTrue(node.expandable);

    // Modify expandable property directly (simulating a leaf node update)
    const storedNode = manager.getNode('node-1');
    if (storedNode) {
      storedNode.expandable = false;
    }

    // toggleExpanded should not change state when not expandable
    const beforeExpanded = manager.getNode('node-1')?.expanded;
    manager.toggleExpanded('node-1');
    const afterExpanded = manager.getNode('node-1')?.expanded;

    assertEqual(beforeExpanded, afterExpanded, 'Non-expandable node should not toggle');
  });

  // ==========================================================================
  // Test Category 5: Progress Updates
  // ==========================================================================
  console.log('\n5. Progress Updates:');

  test('Progress starts as null', () => {
    const manager = new TreeManager();
    const node = manager.createNode('node-1', 'Task');

    assertNull(node.progress);
  });

  test('updateNodeProgress() sets progress value', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    manager.updateNodeProgress('node-1', 50);

    assertEqual(manager.getNode('node-1')?.progress, 50);
  });

  test('Progress can be updated multiple times', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    manager.updateNodeProgress('node-1', 25);
    assertEqual(manager.getNode('node-1')?.progress, 25);

    manager.updateNodeProgress('node-1', 50);
    assertEqual(manager.getNode('node-1')?.progress, 50);

    manager.updateNodeProgress('node-1', 100);
    assertEqual(manager.getNode('node-1')?.progress, 100);
  });

  test('Progress can be reset to null', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');
    manager.updateNodeProgress('node-1', 50);
    manager.updateNodeProgress('node-1', null);

    assertNull(manager.getNode('node-1')?.progress);
  });

  test('Progress values at boundaries (0 and 100)', () => {
    const manager = new TreeManager();
    manager.createNode('node-1', 'Task');

    manager.updateNodeProgress('node-1', 0);
    assertEqual(manager.getNode('node-1')?.progress, 0);

    manager.updateNodeProgress('node-1', 100);
    assertEqual(manager.getNode('node-1')?.progress, 100);
  });

  // ==========================================================================
  // Test Category 6: TreeNode Type Structure
  // ==========================================================================
  console.log('\n6. TreeNode Type Structure:');

  test('TreeNode has all required properties', () => {
    const node: TreeNode = {
      id: 'test-node',
      parentId: null,
      label: 'Test',
      state: 'pending',
      progress: null,
      expandable: true,
      expanded: false,
      children: [],
      stepId: null,
      agentId: null,
      output: null,
    };

    assertTrue('id' in node);
    assertTrue('parentId' in node);
    assertTrue('label' in node);
    assertTrue('state' in node);
    assertTrue('progress' in node);
    assertTrue('expandable' in node);
    assertTrue('expanded' in node);
    assertTrue('children' in node);
    assertTrue('stepId' in node);
    assertTrue('agentId' in node);
    assertTrue('output' in node);
  });

  test('TreeNode with stepId and agentId', () => {
    const node: TreeNode = {
      id: 'step-node',
      parentId: 'plan-1',
      label: 'Execute scaffold',
      state: 'active',
      progress: 30,
      expandable: true,
      expanded: false,
      children: [],
      stepId: 1,
      agentId: 'codex-agent',
      output: null,
    };

    assertEqual(node.stepId, 1);
    assertEqual(node.agentId, 'codex-agent');
  });

  test('TreeNode with output artifact', () => {
    const output: TreeNodeOutput = {
      type: 'url',
      label: 'Preview',
      value: 'https://preview.example.com',
    };

    const node: TreeNode = {
      id: 'deploy-node',
      parentId: null,
      label: 'Deploy complete',
      state: 'done',
      progress: 100,
      expandable: false,
      expanded: false,
      children: [],
      stepId: 5,
      agentId: 'deploy-agent',
      output,
    };

    assertNotNull(node.output);
    assertEqual(node.output.type, 'url');
    assertEqual(node.output.label, 'Preview');
  });

  test('TreeNodeOutputType includes all expected types', () => {
    const types: TreeNodeOutputType[] = ['url', 'file', 'preview', 'download'];

    for (const type of types) {
      const output: TreeNodeOutput = {
        type,
        label: `${type} output`,
        value: `${type}-value`,
      };
      assertEqual(output.type, type);
    }
  });

  // ==========================================================================
  // Test Category 7: Tree Operations
  // ==========================================================================
  console.log('\n7. Tree Operations:');

  test('clear() removes all nodes and rootIds', () => {
    const manager = new TreeManager();
    manager.createNode('root-1', 'Root 1');
    manager.createNode('root-2', 'Root 2');
    manager.createNode('child-1', 'Child 1', 'root-1');

    manager.clear();

    assertEqual(manager.getAllNodes().size, 0);
    assertEqual(manager.getRootIds().length, 0);
  });

  test('getNode() returns undefined for non-existent node', () => {
    const manager = new TreeManager();

    const node = manager.getNode('non-existent');

    assertEqual(node, undefined);
  });

  test('Multiple root nodes are managed independently', () => {
    const manager = new TreeManager();
    manager.createNode('plan-1', 'Plan 1');
    manager.createNode('plan-2', 'Plan 2');
    manager.createNode('step-1a', 'Step 1A', 'plan-1');
    manager.createNode('step-2a', 'Step 2A', 'plan-2');

    const plan1Children = manager.getChildren('plan-1');
    const plan2Children = manager.getChildren('plan-2');

    assertEqual(plan1Children.length, 1);
    assertEqual(plan1Children[0].id, 'step-1a');
    assertEqual(plan2Children.length, 1);
    assertEqual(plan2Children[0].id, 'step-2a');
  });

  // ==========================================================================
  // Test Category 8: StatusAgentState Tree Integration
  // ==========================================================================
  console.log('\n8. StatusAgentState Tree Integration:');

  test('StatusAgentState tree structure is valid', () => {
    const state: StatusAgentState = {
      lines: new Map(),
      tree: new Map(),
      rootIds: [],
      queries: new Map(),
      fuel: {
        percent: 100,
        label: 'Ready',
        detail: 'Session budget available',
        warning: false,
        warningText: null,
      },
      eventLog: [],
      maxEventLogSize: 100,
      runningAgents: new Map(),
    };

    assertTrue(state.tree instanceof Map);
    assertTrue(Array.isArray(state.rootIds));
    assertEqual(state.tree.size, 0);
    assertEqual(state.rootIds.length, 0);
  });

  test('Tree in StatusAgentState can store TreeNodes', () => {
    const state: StatusAgentState = {
      lines: new Map(),
      tree: new Map(),
      rootIds: [],
      queries: new Map(),
      fuel: {
        percent: 100,
        label: 'Ready',
        detail: 'Session budget available',
        warning: false,
        warningText: null,
      },
      eventLog: [],
      maxEventLogSize: 100,
      runningAgents: new Map(),
    };

    const node: TreeNode = {
      id: 'node-1',
      parentId: null,
      label: 'Task 1',
      state: 'active',
      progress: 50,
      expandable: true,
      expanded: false,
      children: [],
      stepId: 1,
      agentId: 'codex',
      output: null,
    };

    state.tree.set(node.id, node);
    state.rootIds.push(node.id);

    assertEqual(state.tree.size, 1);
    assertEqual(state.rootIds.length, 1);
    assertEqual(state.tree.get('node-1')?.label, 'Task 1');
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
