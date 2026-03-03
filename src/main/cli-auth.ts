/**
 * CLI Tool Authentication Handler
 *
 * Handles authentication flows for CLI tools like Codex and Claude Code.
 * Uses node-pty for TTY emulation to interact with CLI prompts,
 * and intercepts browser opens for OAuth flows.
 */

import { ipcMain, BrowserWindow, BrowserView, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Supported CLI tools
 */
export type CLITool = 'codex' | 'claude-code' | 'gemini';

/**
 * Types of authentication prompts that CLIs may present
 */
export type AuthPromptType = 'oauth' | 'token' | 'tos' | 'question';

/**
 * Authentication prompt detected from CLI output
 */
export interface AuthPrompt {
  tool: CLITool;
  type: AuthPromptType;
  message: string;
  options?: string[];
  timestamp: number;
}

/**
 * Result of an authentication attempt
 */
export interface AuthResult {
  success: boolean;
  tool: CLITool;
  error?: string;
  timestamp: number;
}

/**
 * Authentication status for a tool
 */
export interface AuthStatus {
  tool: CLITool;
  isAuthenticated: boolean;
  lastChecked: number;
  tokenPath?: string;
  error?: string;
}

/**
 * CLI process state tracking
 */
interface CLIProcess {
  tool: CLITool;
  pty: IPty | null;
  isAuthenticating: boolean;
  pendingPrompt: AuthPrompt | null;
  outputBuffer: string;
}

/**
 * node-pty interface (dynamically loaded)
 */
interface IPty {
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (exitCode: { exitCode: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  pid: number;
}

interface NodePty {
  spawn: (
    file: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
    }
  ) => IPty;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Authentication detection patterns for each CLI tool
 */
const AUTH_PATTERNS: Record<CLITool, Record<string, RegExp>> = {
  codex: {
    githubAuth: /authenticate|sign in|github|login|authorization|oauth/i,
    tos: /terms|accept|agree|continue|y\/n|yes\/no/i,
    token: /token|api.key|secret|paste|enter.*key/i,
    question: /\?\s*$|\[y\/n\]|\[yes\/no\]|press enter|confirm/i,
  },
  'claude-code': {
    anthropicAuth: /anthropic|authenticate|sign in|login|authorization|oauth/i,
    tos: /terms|accept|agree|continue|y\/n|yes\/no/i,
    token: /token|api.key|secret|paste|enter.*key/i,
    question: /\?\s*$|\[y\/n\]|\[yes\/no\]|press enter|confirm/i,
  },
  gemini: {
    googleAuth: /google|sign in|accounts\.google|oauth|authorization/i,
    tos: /terms|accept|agree|continue|y\/n|yes\/no/i,
    token: /token|api.key|secret|paste|enter.*key/i,
    question: /\?\s*$|\[y\/n\]|\[yes\/no\]|press enter|confirm/i,
  },
};

/**
 * OAuth callback URLs to intercept
 */
const OAUTH_CALLBACK_PATTERNS = [
  /^http:\/\/localhost:\d+\/callback/,
  /^http:\/\/127\.0\.0\.1:\d+\/callback/,
  /^http:\/\/localhost:\d+\/oauth/,
  /^http:\/\/127\.0\.0\.1:\d+\/oauth/,
];

/**
 * Token storage paths for each tool (relative to home directory)
 */
const TOKEN_PATHS: Record<CLITool, string[]> = {
  codex: [
    '.codex/auth.json',
    '.codex/config.json',
    '.codex/.credentials',
  ],
  'claude-code': [
    '.claude/auth.json',
    '.claude/credentials.json',
    '.claude/config.json',
    '.claude.json',
  ],
  gemini: [
    '.gemini/oauth_creds.json',
    '.gemini/google_accounts.json',
  ],
};

/**
 * CLI executable names
 */
const CLI_EXECUTABLES: Record<CLITool, string[]> = {
  codex: ['codex', 'npx'],
  'claude-code': ['claude', 'npx'],
  gemini: ['gemini'],
};

/**
 * CLI executable arguments when using npx
 */
const CLI_NPX_PACKAGES: Partial<Record<CLITool, string>> = {
  codex: 'codex',
  'claude-code': '@anthropic-ai/claude-code',
  // gemini: not used via npx - running `gemini` directly triggers OAuth on first use
};

// ============================================================================
// STATE
// ============================================================================

/**
 * Active CLI processes being monitored for auth
 */
const cliProcesses: Map<CLITool, CLIProcess> = new Map();

/**
 * OAuth browser window for intercepting callbacks
 */
let oauthWindow: BrowserWindow | null = null;

/**
 * Reference to main window for sending IPC events
 */
let mainWindowRef: BrowserWindow | null = null;

/**
 * Dynamically loaded node-pty module
 */
let nodePty: NodePty | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize node-pty (must be done at runtime, not import time)
 */
async function loadNodePty(): Promise<NodePty | null> {
  if (nodePty) return nodePty;

  try {
    // node-pty is a native module that must be loaded dynamically
    nodePty = require('node-pty');
    console.log('[CLI Auth] node-pty loaded successfully');
    return nodePty;
  } catch (error) {
    console.error('[CLI Auth] Failed to load node-pty:', error);
    console.error('[CLI Auth] Make sure node-pty is installed: npm install node-pty');
    return null;
  }
}

/**
 * Set the main window reference for IPC events
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindowRef = window;
}

// ============================================================================
// AUTH STATUS CHECKING
// ============================================================================

/**
 * Check if a tool is authenticated by looking for token files
 */
export async function isAuthenticated(tool: CLITool): Promise<AuthStatus> {
  const homeDir = os.homedir();
  const paths = TOKEN_PATHS[tool];

  const status: AuthStatus = {
    tool,
    isAuthenticated: false,
    lastChecked: Date.now(),
  };

  for (const relativePath of paths) {
    const fullPath = path.join(homeDir, relativePath);

    try {
      const stats = await fs.promises.stat(fullPath);
      if (stats.isFile() && stats.size > 0) {
        // File exists and is not empty
        const content = await fs.promises.readFile(fullPath, 'utf-8');

        // Basic validation: check if it looks like valid auth data
        if (content.trim().length > 0) {
          // For JSON files, try to parse and look for token/key fields
          if (fullPath.endsWith('.json')) {
            try {
              const data = JSON.parse(content);
              if (data.token || data.api_key || data.access_token || data.credentials) {
                status.isAuthenticated = true;
                status.tokenPath = fullPath;
                return status;
              }
            } catch {
              // Not valid JSON, but file exists
            }
          } else {
            // Non-JSON file with content
            status.isAuthenticated = true;
            status.tokenPath = fullPath;
            return status;
          }
        }
      }
    } catch {
      // File doesn't exist, continue checking
    }
  }

  return status;
}

/**
 * Check authentication status for all tools
 */
export async function checkAllAuthStatus(): Promise<AuthStatus[]> {
  const tools: CLITool[] = ['codex', 'claude-code', 'gemini'];
  return Promise.all(tools.map(tool => isAuthenticated(tool)));
}

// ============================================================================
// COMMAND EXISTENCE CHECK
// ============================================================================

/**
 * Check if a command exists in the system PATH
 * Uses 'which' on Unix-like systems, 'where' on Windows
 */
async function commandExists(command: string): Promise<boolean> {
  const testCmd = process.platform === 'win32' ? 'where' : 'which';

  try {
    await execFileAsync(testCmd, [command]);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// PROMPT DETECTION
// ============================================================================

/**
 * Detect the type of auth prompt from CLI output
 */
function detectPromptType(tool: CLITool, output: string): AuthPromptType | null {
  const patterns = AUTH_PATTERNS[tool];

  // Check for OAuth/browser auth first (most specific)
  if (patterns.githubAuth?.test(output) || patterns.anthropicAuth?.test(output) || patterns.googleAuth?.test(output)) {
    // Check if it's asking to open a browser
    if (/open|browser|url|http|visit/i.test(output)) {
      return 'oauth';
    }
  }

  // Check for token entry prompts
  if (patterns.token?.test(output)) {
    return 'token';
  }

  // Check for Terms of Service / acceptance prompts
  if (patterns.tos?.test(output)) {
    return 'tos';
  }

  // Check for general questions
  if (patterns.question?.test(output)) {
    return 'question';
  }

  return null;
}

/**
 * Extract options from a prompt (e.g., "yes/no", "y/n")
 */
function extractOptions(output: string): string[] | undefined {
  // Common option patterns
  const optionPatterns = [
    /\[([yYnN])\/([yYnN])\]/,
    /\(([yY]es|[nN]o)\)/,
    /([yY]es)\/([nN]o)/,
    /([1-9])\.\s*([^\n]+)/g, // Numbered options
  ];

  for (const pattern of optionPatterns) {
    const match = output.match(pattern);
    if (match) {
      return match.slice(1).filter(Boolean);
    }
  }

  return undefined;
}

/**
 * Create an AuthPrompt from CLI output
 */
function createAuthPrompt(tool: CLITool, output: string): AuthPrompt | null {
  const type = detectPromptType(tool, output);
  if (!type) return null;

  // Extract the relevant message (last few lines usually contain the prompt)
  const lines = output.trim().split('\n');
  const message = lines.slice(-5).join('\n').trim();

  return {
    tool,
    type,
    message,
    options: extractOptions(output),
    timestamp: Date.now(),
  };
}

// ============================================================================
// PTY PROCESS MANAGEMENT
// ============================================================================

/**
 * Spawn a CLI tool with PTY for auth handling
 */
export async function startAuthFlow(
  tool: CLITool,
  args: string[] = []
): Promise<{ success: boolean; error?: string }> {
  const pty = await loadNodePty();
  if (!pty) {
    return {
      success: false,
      error: 'node-pty not available. Run: npm install node-pty',
    };
  }

  // Check if already authenticating
  const existing = cliProcesses.get(tool);
  if (existing?.isAuthenticating) {
    return {
      success: false,
      error: `Authentication already in progress for ${tool}`,
    };
  }

  // Find the CLI executable
  const executables = CLI_EXECUTABLES[tool];
  let executable: string | null = null;
  let useNpx = false;

  for (const exe of executables) {
    const exists = await commandExists(exe);
    if (exists) {
      executable = exe;
      useNpx = exe === 'npx';
      break;
    }
  }

  if (!executable) {
    return {
      success: false,
      error: `CLI tool not found. Please install ${tool} first.`,
    };
  }

  // Set up environment for browser interception
  const env = {
    ...process.env,
    // Intercept browser opens by setting a custom browser
    BROWSER: process.execPath,
    // Some CLIs use these
    DISPLAY: process.env.DISPLAY || ':0',
  };

  // Build command arguments
  let cmdArgs: string[];
  if (useNpx) {
    // Using npx to run the package
    const packageName = CLI_NPX_PACKAGES[tool];
    cmdArgs = [packageName!, 'auth', ...args];
  } else if (tool === 'gemini') {
    // Gemini doesn't have explicit auth command - running `gemini` triggers OAuth on first use
    cmdArgs = [...args];
  } else {
    // Direct CLI invocation
    cmdArgs = ['auth', ...args];
  }

  // Spawn the PTY
  const ptyProcess = pty.spawn(executable, cmdArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: os.homedir(),
    env,
  });

  // Create process state
  const cliProcess: CLIProcess = {
    tool,
    pty: ptyProcess,
    isAuthenticating: true,
    pendingPrompt: null,
    outputBuffer: '',
  };

  cliProcesses.set(tool, cliProcess);

  // Handle PTY output
  ptyProcess.onData((data: string) => {
    handlePtyOutput(tool, data);
  });

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode }) => {
    handlePtyExit(tool, exitCode);
  });

  console.log(`[CLI Auth] Started auth flow for ${tool} (PID: ${ptyProcess.pid})`);

  return { success: true };
}

/**
 * Handle output from the PTY process
 */
function handlePtyOutput(tool: CLITool, data: string): void {
  const cliProcess = cliProcesses.get(tool);
  if (!cliProcess) return;

  // Append to buffer
  cliProcess.outputBuffer += data;

  // Log for debugging (strip ANSI codes)
  console.log(`[CLI Auth] [${tool}] Output:`, data.replace(/\x1B\[[0-9;]*[A-Za-z]/g, ''));

  // Check for URL (OAuth flow)
  const urlMatch = data.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    const url = urlMatch[0].trim();
    console.log(`[CLI Auth] [${tool}] Detected URL:`, url);

    // Check if this is an OAuth URL that should be intercepted
    if (shouldInterceptUrl(url)) {
      openOAuthWindow(url, tool);
      return;
    }
  }

  // Check for auth prompts
  const prompt = createAuthPrompt(tool, cliProcess.outputBuffer);
  if (prompt && !cliProcess.pendingPrompt) {
    cliProcess.pendingPrompt = prompt;

    // Send to renderer
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('cli:auth-prompt', prompt);
    }

    console.log(`[CLI Auth] [${tool}] Auth prompt detected:`, prompt.type);
  }
}

/**
 * Handle PTY process exit
 */
function handlePtyExit(tool: CLITool, exitCode: number): void {
  const cliProcess = cliProcesses.get(tool);
  if (!cliProcess) return;

  console.log(`[CLI Auth] [${tool}] Process exited with code ${exitCode}`);

  cliProcess.isAuthenticating = false;
  cliProcess.pty = null;

  // Check if authentication succeeded
  isAuthenticated(tool).then(status => {
    const result: AuthResult = {
      success: status.isAuthenticated,
      tool,
      timestamp: Date.now(),
      error: exitCode !== 0 && !status.isAuthenticated
        ? `Process exited with code ${exitCode}`
        : undefined,
    };

    // Send result to renderer
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('cli:auth-result', result);
    }
  });

  // Clean up
  cliProcesses.delete(tool);
}

/**
 * Send a response to the CLI prompt
 */
export function respondToPrompt(tool: CLITool, response: string): boolean {
  const cliProcess = cliProcesses.get(tool);
  if (!cliProcess?.pty) {
    console.error(`[CLI Auth] No active process for ${tool}`);
    return false;
  }

  // Write response to PTY (add newline to submit)
  cliProcess.pty.write(response + '\n');
  cliProcess.pendingPrompt = null;
  cliProcess.outputBuffer = '';

  console.log(`[CLI Auth] [${tool}] Sent response:`, response);

  return true;
}

/**
 * Cancel an active auth flow
 */
export function cancelAuthFlow(tool: CLITool): boolean {
  const cliProcess = cliProcesses.get(tool);
  if (!cliProcess?.pty) {
    return false;
  }

  // Send Ctrl+C to cancel
  cliProcess.pty.write('\x03');

  // Kill the process after a short delay
  setTimeout(() => {
    if (cliProcess.pty) {
      cliProcess.pty.kill();
    }
  }, 500);

  return true;
}

// ============================================================================
// OAUTH BROWSER HANDLING
// ============================================================================

/**
 * Check if a URL should be intercepted for OAuth
 */
function shouldInterceptUrl(url: string): boolean {
  // Check if it's a known OAuth provider or callback
  const oauthProviders = [
    'github.com/login',
    'accounts.google.com',
    'auth.anthropic.com',
    'console.anthropic.com',
    'openai.com/auth',
    'api.openai.com',
  ];

  try {
    const urlObj = new URL(url);
    return oauthProviders.some(provider =>
      urlObj.hostname.includes(provider) || urlObj.href.includes(provider)
    );
  } catch {
    return false;
  }
}

/**
 * Open OAuth window for browser-based authentication
 */
function openOAuthWindow(url: string, tool: CLITool): void {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.loadURL(url);
    oauthWindow.focus();
    return;
  }

  oauthWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: mainWindowRef || undefined,
    modal: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: `Sign in - ${tool}`,
  });

  // Monitor navigation for OAuth callbacks
  oauthWindow.webContents.on('will-navigate', (event, navUrl) => {
    handleOAuthNavigation(navUrl, tool);
  });

  oauthWindow.webContents.on('did-navigate', (event, navUrl) => {
    handleOAuthNavigation(navUrl, tool);
  });

  // Handle new window requests
  oauthWindow.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    // Load in the same window
    oauthWindow?.loadURL(newUrl);
    return { action: 'deny' };
  });

  oauthWindow.on('closed', () => {
    oauthWindow = null;
    console.log(`[CLI Auth] OAuth window closed for ${tool}`);
  });

  oauthWindow.loadURL(url);
  console.log(`[CLI Auth] Opened OAuth window for ${tool}: ${url}`);
}

/**
 * Handle OAuth navigation - detect callbacks
 */
function handleOAuthNavigation(url: string, tool: CLITool): void {
  // Check if this is a localhost callback
  const isCallback = OAUTH_CALLBACK_PATTERNS.some(pattern => pattern.test(url));

  if (isCallback) {
    console.log(`[CLI Auth] [${tool}] OAuth callback detected: ${url}`);

    // Close the OAuth window
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      setTimeout(() => {
        oauthWindow?.close();
        oauthWindow = null;
      }, 1000);
    }

    // The CLI should receive the callback on its local server
    // We might need to help by making the request if the window closes too fast
    try {
      const httpModule = url.startsWith('https') ? require('https') : require('http');
      httpModule.get(url, (res: { statusCode: number }) => {
        console.log(`[CLI Auth] [${tool}] Callback request sent, status: ${res.statusCode}`);
      }).on('error', (err: Error) => {
        console.log(`[CLI Auth] [${tool}] Callback request failed (may be expected):`, err.message);
      });
    } catch {
      // Ignore errors - the callback might have already been handled
    }
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Set up IPC handlers for CLI authentication
 */
export function setupCliAuthIPC(getMainWindow: () => BrowserWindow | null): void {
  // Update main window reference when getting it
  const updateMainWindow = () => {
    const win = getMainWindow();
    if (win) {
      mainWindowRef = win;
    }
    return win;
  };

  /**
   * Start authentication flow for a tool
   */
  ipcMain.handle(
    'cli:auth-start',
    async (_event, tool: CLITool, args?: string[]): Promise<{ success: boolean; error?: string }> => {
      console.log(`[IPC] cli:auth-start called for ${tool}`);
      updateMainWindow();
      return startAuthFlow(tool, args);
    }
  );

  /**
   * Send a response to a CLI prompt
   */
  ipcMain.handle(
    'cli:auth-respond',
    async (_event, tool: CLITool, response: string): Promise<{ success: boolean; error?: string }> => {
      console.log(`[IPC] cli:auth-respond called for ${tool}`);
      const success = respondToPrompt(tool, response);
      return {
        success,
        error: success ? undefined : `No active auth process for ${tool}`,
      };
    }
  );

  /**
   * Check authentication status for a tool
   */
  ipcMain.handle(
    'cli:auth-status',
    async (_event, tool: CLITool): Promise<AuthStatus> => {
      console.log(`[IPC] cli:auth-status called for ${tool}`);
      return isAuthenticated(tool);
    }
  );

  /**
   * Check authentication status for all tools
   */
  ipcMain.handle(
    'cli:auth-status-all',
    async (): Promise<AuthStatus[]> => {
      console.log('[IPC] cli:auth-status-all called');
      return checkAllAuthStatus();
    }
  );

  /**
   * Cancel an active auth flow
   */
  ipcMain.handle(
    'cli:auth-cancel',
    async (_event, tool: CLITool): Promise<{ success: boolean }> => {
      console.log(`[IPC] cli:auth-cancel called for ${tool}`);
      return { success: cancelAuthFlow(tool) };
    }
  );

  /**
   * Get list of tools currently authenticating
   */
  ipcMain.handle(
    'cli:auth-active',
    async (): Promise<CLITool[]> => {
      console.log('[IPC] cli:auth-active called');
      const active: CLITool[] = [];
      cliProcesses.forEach((process, tool) => {
        if (process.isAuthenticating) {
          active.push(tool);
        }
      });
      return active;
    }
  );

  console.log('[CLI Auth] IPC handlers registered');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  AUTH_PATTERNS,
  TOKEN_PATHS,
  CLI_EXECUTABLES,
  OAUTH_CALLBACK_PATTERNS,
};
