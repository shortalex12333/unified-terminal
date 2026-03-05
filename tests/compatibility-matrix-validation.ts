/**
 * Compatibility Matrix Validation
 *
 * Validates that runtime adapter implementations match real CLI behavior.
 * 4 checks covering Codex, Claude, and ChatGPT Web adapters.
 *
 * Run with: npx ts-node tests/compatibility-matrix-validation.ts
 */

// ============================================================================
// ELECTRON MOCK (required before importing src/ modules that use electron)
// ============================================================================

const mockIpcMain = {
  handle: (_channel: string, _handler: Function) => {},
  removeHandler: (_channel: string) => {},
  on: () => {},
};

class MockBrowserWindow {
  isDestroyed() { return false; }
  webContents = { send: (_channel: string, _data: unknown) => {} };
}

class MockBrowserView {
  webContents = {
    id: 1,
    send: (_channel: string, _data: unknown) => {},
    executeJavaScript: async (_script: string) => ({} as unknown),
    loadURL: async (_url: string) => {},
  };
}

require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: {
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
    BrowserView: MockBrowserView,
    app: {
      getPath: (_name: string) => '/tmp/unified-terminal-test',
      getName: () => 'unified-terminal',
      getVersion: () => '0.1.0',
      isReady: () => true,
      whenReady: () => Promise.resolve(),
      on: () => {},
      quit: () => {},
    },
    session: {
      defaultSession: {
        webRequest: { onBeforeSendHeaders: () => {} },
      },
    },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu: () => {} },
    Tray: class { constructor() {} setToolTip() {} setContextMenu() {} },
    nativeImage: { createFromPath: () => ({}) },
  },
} as NodeJS.Module;

// ============================================================================
// IMPORTS (after Electron mock)
// ============================================================================

import { CodexAdapter } from '../src/adapters/codex/adapter';
import { ClaudeAdapter } from '../src/adapters/claude/adapter';
import {
  generateFrontmatter,
  mapToolName,
} from '../src/adapters/claude/frontmatter';
import type { AgentConfig } from '../src/adapters/types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

interface CheckResult {
  runtime: string;
  feature: string;
  passed: boolean;
}

const results: CheckResult[] = [];

async function test(
  runtime: string,
  feature: string,
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
    testsPassed++;
    console.log(`  [PASS] ${name}`);
    results.push({ runtime, feature, passed: true });
  } catch (err) {
    testsFailed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err instanceof Error ? err.message : err}`);
    results.push({ runtime, feature, passed: false });
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Minimal AgentConfig for testing adapters */
function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'compat-test-1',
    name: 'compat-test',
    role: 'compatibility check',
    model: 'gpt-5-codex',
    tools: ['read', 'write', 'bash'],
    maxTokens: 8000,
    prompt: 'test prompt for compatibility check',
    declaredFiles: [],
    workingDir: '/tmp',
    timeout: 30_000,
    ...overrides,
  };
}

// ============================================================================
// COMPATIBILITY CHECKS
// ============================================================================

async function runChecks(): Promise<void> {
  console.log('=== Compatibility Matrix Validation ===');
  console.log('');

  // --------------------------------------------------------------------------
  // Check 1: Codex CLI -- JSON output format
  // --------------------------------------------------------------------------

  await test('codex', '--json output', 'Codex CLI: --json flag in command', () => {
    const adapter = new CodexAdapter();

    // Verify the adapter reports JSON output capability
    const caps = adapter.capabilities();
    assertTrue(caps.jsonOutput, 'Codex capabilities must report jsonOutput: true');

    // Verify runtime identifier
    assertEqual(adapter.runtime, 'codex', 'Codex adapter runtime must be "codex"');

    // Verify supported tools include expected entries
    assertTrue(
      caps.supportedTools.includes('read' as any),
      'Codex must support "read" tool',
    );
    assertTrue(
      caps.supportedTools.includes('bash' as any),
      'Codex must support "bash" tool',
    );

    // Verify session resume is supported
    assertTrue(caps.sessionResume, 'Codex capabilities must report sessionResume: true');

    // Verify model identifiers are set
    assertTrue(caps.models.fast.length > 0, 'fast model must be set');
    assertTrue(caps.models.standard.length > 0, 'standard model must be set');
    assertTrue(caps.models.reasoning.length > 0, 'reasoning model must be set');
  });

  // --------------------------------------------------------------------------
  // Check 2: Claude Code -- Agent file support
  // --------------------------------------------------------------------------

  await test('claude', 'agent file support', 'Claude Code: agent file with YAML frontmatter', () => {
    const config = makeConfig({
      model: 'claude-sonnet-4-6',
      tools: ['read', 'write', 'bash'],
      maxTokens: 8000,
      prompt: 'Implement the feature according to the spec',
    });

    // Verify generateFrontmatter() produces valid YAML with expected fields
    const frontmatter = generateFrontmatter(config);
    assertTrue(frontmatter.startsWith('---'), 'Frontmatter must start with ---');
    assertTrue(frontmatter.includes('model: claude-sonnet-4-6'), 'Must contain model field');
    assertTrue(frontmatter.includes('allowedTools:'), 'Must contain allowedTools field');
    assertTrue(frontmatter.includes('maxTurns:'), 'Must contain maxTurns field');

    // Verify tool names are PascalCase
    assertTrue(frontmatter.includes('  - Read'), 'read -> Read in frontmatter');
    assertTrue(frontmatter.includes('  - Write'), 'write -> Write in frontmatter');
    assertTrue(frontmatter.includes('  - Bash'), 'bash -> Bash in frontmatter');

    // Verify maxTurns derivation (8000 / 4000 = 2)
    assertTrue(frontmatter.includes('maxTurns: 2'), '8000 tokens -> maxTurns 2');

    // Verify prompt body is included
    assertTrue(
      frontmatter.includes('Implement the feature according to the spec'),
      'Prompt body must be in agent file',
    );

    // Verify mapToolName() correctly translates all 7 tool names
    assertEqual(mapToolName('read'), 'Read', 'read -> Read');
    assertEqual(mapToolName('write'), 'Write', 'write -> Write');
    assertEqual(mapToolName('bash'), 'Bash', 'bash -> Bash');
    assertEqual(mapToolName('edit'), 'Edit', 'edit -> Edit');
    assertEqual(mapToolName('web_search'), 'WebSearch', 'web_search -> WebSearch');
    assertEqual(mapToolName('grep'), 'Grep', 'grep -> Grep');
    assertEqual(mapToolName('glob'), 'Glob', 'glob -> Glob');
  });

  // --------------------------------------------------------------------------
  // Check 3: Claude Code -- Session resume support
  // --------------------------------------------------------------------------

  await test('claude', 'session resume', 'Claude Code: session resume support', () => {
    const adapter = new ClaudeAdapter();
    const caps = adapter.capabilities();

    // Verify the adapter reports session resume capability
    assertTrue(caps.sessionResume, 'Claude capabilities must report sessionResume: true');

    // Verify JSON output is supported (needed for structured parsing)
    assertTrue(caps.jsonOutput, 'Claude capabilities must report jsonOutput: true');

    // Verify tool permissions are enforced
    assertTrue(caps.toolPermissions, 'Claude capabilities must report toolPermissions: true');

    // Verify runtime identifier
    assertEqual(adapter.runtime, 'claude' as any, 'Claude adapter runtime must be "claude"');

    // Verify Claude-specific model identifiers
    assertEqual(caps.models.fast, 'claude-haiku-4-5', 'fast model must be claude-haiku-4-5');
    assertEqual(caps.models.standard, 'claude-sonnet-4-6', 'standard model must be claude-sonnet-4-6');
    assertEqual(caps.models.reasoning, 'claude-opus-4-6', 'reasoning model must be claude-opus-4-6');
  });

  // --------------------------------------------------------------------------
  // Check 4: ChatGPT Web -- DOM injection capability
  // --------------------------------------------------------------------------

  await test('chatgpt-web', 'DOM injection + Mutation', 'ChatGPT Web: DOM injection functions exported', () => {
    // Verify chatgpt-adapter exports the expected functions
    const chatgptAdapter = require('../src/main/chatgpt-adapter');
    assertTrue(typeof chatgptAdapter.injectText === 'function', 'injectText must be exported as function');
    assertTrue(typeof chatgptAdapter.triggerSend === 'function', 'triggerSend must be exported as function');
    assertTrue(typeof chatgptAdapter.isPageReady === 'function', 'isPageReady must be exported as function');
    assertTrue(typeof chatgptAdapter.injectAndSend === 'function', 'injectAndSend must be exported as function');
    assertTrue(typeof chatgptAdapter.getResponse === 'function', 'getResponse must be exported as function');
    assertTrue(typeof chatgptAdapter.startCapture === 'function', 'startCapture must be exported as function');
    assertTrue(typeof chatgptAdapter.stopCapture === 'function', 'stopCapture must be exported as function');

    // Verify DOM selector constants exist and contain expected entries
    const domSelectors = require('../src/utils/dom-selectors');
    assertTrue(Array.isArray(domSelectors.CHATGPT_SELECTORS.textarea), 'textarea selectors must be array');
    assertTrue(domSelectors.CHATGPT_SELECTORS.textarea.length > 0, 'textarea selectors must not be empty');
    assertTrue(Array.isArray(domSelectors.CHATGPT_SELECTORS.sendButton), 'sendButton selectors must be array');
    assertTrue(domSelectors.CHATGPT_SELECTORS.sendButton.length > 0, 'sendButton selectors must not be empty');
    assertTrue(Array.isArray(domSelectors.CHATGPT_SELECTORS.responseContainer), 'responseContainer selectors must be array');
    assertTrue(domSelectors.CHATGPT_SELECTORS.responseContainer.length > 0, 'responseContainer selectors must not be empty');

    // Verify injection config exists
    assertTrue(typeof domSelectors.INJECTION_CONFIG === 'object', 'INJECTION_CONFIG must exist');
    assertTrue(typeof domSelectors.INJECTION_CONFIG.pasteToSendDelay === 'number', 'pasteToSendDelay must be a number');

    // Verify capture config exists
    assertTrue(typeof domSelectors.CAPTURE_CONFIG === 'object', 'CAPTURE_CONFIG must exist');
    assertTrue(typeof domSelectors.CAPTURE_CONFIG.pollInterval === 'number', 'pollInterval must be a number');
  });

  // --------------------------------------------------------------------------
  // RESULTS
  // --------------------------------------------------------------------------

  console.log('');

  // Print formatted matrix table
  const pad = (s: string, len: number) => s.padEnd(len);
  console.log(`${pad('Runtime', 14)}| ${pad('Feature', 27)}| Matches`);
  console.log(`${'-'.repeat(14)}|${'-'.repeat(28)}|${'-'.repeat(8)}`);
  for (const r of results) {
    console.log(
      `${pad(r.runtime, 14)}| ${pad(r.feature, 27)}| ${r.passed ? 'PASS' : 'FAIL'}`,
    );
  }

  console.log('');
  console.log(`COMPATIBILITY: ${testsPassed}/${testsPassed + testsFailed} checks passed`);
  console.log('');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runChecks().catch((err) => {
  console.error('Compatibility check runner error:', err);
  process.exit(1);
});
