/**
 * CLI Provider Manager
 *
 * Handles CLI tool installation and authentication for Gemini and Claude.
 * ChatGPT uses BrowserView (web login) and does NOT go through this system.
 *
 * Flow for CLI providers:
 * 1. Check if CLI is installed (which gemini, which claude)
 * 2. If not installed → npm install -g <package>
 * 3. Check if authenticated (token files exist)
 * 4. If not authenticated → spawn CLI to trigger OAuth
 */

import { ipcMain, BrowserWindow, shell } from 'electron';
import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export type CLIProvider = 'gemini' | 'claude-code';

export interface ProviderStatus {
  tool: CLIProvider;
  isInstalled: boolean;
  isAuthenticated: boolean;
  version?: string;
  error?: string;
}

export interface InstallResult {
  success: boolean;
  error?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * CLI tool configuration
 * - command: The CLI command name
 * - package: npm package name for installation
 * - tokenPaths: Paths to check for auth tokens (relative to home)
 * - authCommand: Command to trigger OAuth (if different from main command)
 */
const CLI_CONFIG: Record<CLIProvider, {
  command: string;
  package: string;
  tokenPaths: string[];
  authTrigger: 'run' | 'login';  // 'run' = running CLI triggers OAuth, 'login' = explicit login command
}> = {
  'gemini': {
    command: 'gemini',
    package: '@anthropic-ai/gemini-cli',  // TODO: Verify correct package name
    tokenPaths: [
      '.gemini/oauth_creds.json',
      '.gemini/google_accounts.json',
      '.config/gemini/credentials.json',
    ],
    authTrigger: 'run',  // Running `gemini` triggers OAuth on first use
  },
  'claude-code': {
    command: 'claude',
    package: '@anthropic-ai/claude-code',
    tokenPaths: [
      '.claude/credentials.json',
      '.claude/auth.json',
      '.claude.json',
    ],
    authTrigger: 'run',  // Running `claude` triggers OAuth on first use
  },
};

// ============================================================================
// STATE
// ============================================================================

let mainWindowRef: BrowserWindow | null = null;
const activeAuthProcesses: Map<CLIProvider, ChildProcess> = new Map();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a command exists in PATH
 */
async function commandExists(command: string): Promise<boolean> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execAsync(`${cmd} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get command version
 */
async function getVersion(command: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`${command} --version`);
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Check if any token file exists for a provider
 */
async function hasTokenFile(provider: CLIProvider): Promise<boolean> {
  const config = CLI_CONFIG[provider];
  const homeDir = os.homedir();

  for (const tokenPath of config.tokenPaths) {
    const fullPath = path.join(homeDir, tokenPath);
    try {
      const stats = await fs.promises.stat(fullPath);
      if (stats.isFile() && stats.size > 10) {
        // File exists and has content
        return true;
      }
    } catch {
      // File doesn't exist, continue
    }
  }
  return false;
}

/**
 * URL detection regex
 */
const URL_REGEX = /https?:\/\/[^\s\])"'<>]+/g;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Set the main window reference for IPC events
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindowRef = window;
}

/**
 * Check status of a single CLI provider
 */
export async function checkProviderStatus(provider: CLIProvider): Promise<ProviderStatus> {
  const config = CLI_CONFIG[provider];

  const status: ProviderStatus = {
    tool: provider,
    isInstalled: false,
    isAuthenticated: false,
  };

  // Check if installed
  status.isInstalled = await commandExists(config.command);

  if (status.isInstalled) {
    // Get version
    status.version = await getVersion(config.command);

    // Check if authenticated
    status.isAuthenticated = await hasTokenFile(provider);
  }

  return status;
}

/**
 * Check status of all CLI providers
 */
export async function checkAllProviderStatus(): Promise<ProviderStatus[]> {
  const providers: CLIProvider[] = ['gemini', 'claude-code'];
  return Promise.all(providers.map(p => checkProviderStatus(p)));
}

/**
 * Install a CLI provider via npm
 */
export async function installProvider(provider: CLIProvider): Promise<InstallResult> {
  const config = CLI_CONFIG[provider];

  console.log(`[CLI Provider] Installing ${provider} via npm...`);

  // Notify renderer of install start
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('cli:install-progress', {
      provider,
      status: 'installing',
      message: `Installing ${config.package}...`,
    });
  }

  try {
    // Use npm install -g
    const { stdout, stderr } = await execAsync(`npm install -g ${config.package}`, {
      timeout: 120000,  // 2 minute timeout
    });

    console.log(`[CLI Provider] Install stdout: ${stdout}`);
    if (stderr) console.log(`[CLI Provider] Install stderr: ${stderr}`);

    // Verify installation
    const installed = await commandExists(config.command);
    if (!installed) {
      return {
        success: false,
        error: `Installation completed but ${config.command} command not found`,
      };
    }

    // Notify success
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('cli:install-progress', {
        provider,
        status: 'complete',
        message: `${provider} installed successfully`,
      });
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[CLI Provider] Install failed: ${errorMsg}`);

    // Notify failure
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('cli:install-progress', {
        provider,
        status: 'error',
        message: errorMsg,
      });
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Start OAuth authentication for a CLI provider
 * Spawns the CLI tool which triggers OAuth flow
 */
export async function authenticateProvider(provider: CLIProvider): Promise<AuthResult> {
  const config = CLI_CONFIG[provider];

  // Check if already authenticating
  if (activeAuthProcesses.has(provider)) {
    return { success: false, error: 'Authentication already in progress' };
  }

  // Check if CLI is installed
  const isInstalled = await commandExists(config.command);
  if (!isInstalled) {
    return { success: false, error: `${config.command} is not installed` };
  }

  // Check if already authenticated
  const hasAuth = await hasTokenFile(provider);
  if (hasAuth) {
    return { success: true };  // Already authenticated
  }

  console.log(`[CLI Provider] Starting auth for ${provider}...`);

  return new Promise((resolve) => {
    // Spawn the CLI tool to trigger OAuth
    const proc = spawn(config.command, [], {
      cwd: os.homedir(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Force interactive mode
        TERM: 'xterm-256color',
      },
    });

    activeAuthProcesses.set(provider, proc);

    let outputBuffer = '';

    // Handle stdout - look for OAuth URLs
    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      outputBuffer += text;
      console.log(`[CLI Provider] [${provider}] stdout:`, text);

      // Look for OAuth URLs
      const urls = text.match(URL_REGEX);
      if (urls) {
        for (const url of urls) {
          if (url.includes('accounts.google.com') ||
              url.includes('anthropic.com') ||
              url.includes('auth.') ||
              url.includes('oauth')) {
            console.log(`[CLI Provider] Opening OAuth URL: ${url}`);
            shell.openExternal(url);
          }
        }
      }

      // Send output to renderer for display
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('cli:auth-output', {
          provider,
          output: text,
        });
      }
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      outputBuffer += text;
      console.log(`[CLI Provider] [${provider}] stderr:`, text);
    });

    // Handle process exit
    proc.on('exit', async (code) => {
      console.log(`[CLI Provider] [${provider}] Process exited with code ${code}`);
      activeAuthProcesses.delete(provider);

      // Check if authentication succeeded
      const isAuth = await hasTokenFile(provider);

      if (isAuth) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: code === 0 ? 'Authentication may have been cancelled' : `Process exited with code ${code}`,
        });
      }
    });

    // Handle errors
    proc.on('error', (error) => {
      console.error(`[CLI Provider] [${provider}] Error:`, error);
      activeAuthProcesses.delete(provider);
      resolve({ success: false, error: error.message });
    });

    // Set a timeout (5 minutes for OAuth flow)
    setTimeout(() => {
      if (activeAuthProcesses.has(provider)) {
        console.log(`[CLI Provider] [${provider}] Auth timeout, killing process`);
        proc.kill();
        activeAuthProcesses.delete(provider);
        resolve({ success: false, error: 'Authentication timed out' });
      }
    }, 300000);
  });
}

/**
 * Sign out from a CLI provider by removing token files
 */
export async function signOutProvider(provider: CLIProvider): Promise<{ success: boolean; error?: string }> {
  const config = CLI_CONFIG[provider];
  const homeDir = os.homedir();
  const errors: string[] = [];

  for (const tokenPath of config.tokenPaths) {
    const fullPath = path.join(homeDir, tokenPath);
    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        console.log(`[CLI Provider] Removed: ${fullPath}`);
      }
    } catch (err) {
      errors.push(`Failed to remove ${tokenPath}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }
  return { success: true };
}

/**
 * Cancel an active authentication process
 */
export function cancelAuth(provider: CLIProvider): boolean {
  const proc = activeAuthProcesses.get(provider);
  if (proc) {
    proc.kill();
    activeAuthProcesses.delete(provider);
    return true;
  }
  return false;
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Set up IPC handlers for CLI provider management
 */
export function setupCLIProviderIPC(getMainWindow: () => BrowserWindow | null): void {
  // Update window ref
  const updateWindow = () => {
    const win = getMainWindow();
    if (win) mainWindowRef = win;
    return win;
  };

  /**
   * Check status of all CLI providers
   */
  ipcMain.handle('cli:checkAllStatus', async (): Promise<ProviderStatus[]> => {
    console.log('[IPC] cli:checkAllStatus called');
    updateWindow();
    return checkAllProviderStatus();
  });

  /**
   * Check status of a specific provider
   */
  ipcMain.handle('cli:checkStatus', async (
    _event,
    provider: CLIProvider
  ): Promise<ProviderStatus> => {
    console.log(`[IPC] cli:checkStatus called: ${provider}`);
    updateWindow();
    return checkProviderStatus(provider);
  });

  /**
   * Install a CLI provider
   */
  ipcMain.handle('cli:install', async (
    _event,
    provider: CLIProvider
  ): Promise<InstallResult> => {
    console.log(`[IPC] cli:install called: ${provider}`);
    updateWindow();
    return installProvider(provider);
  });

  /**
   * Authenticate with a CLI provider
   */
  ipcMain.handle('cli:authenticate', async (
    _event,
    provider: CLIProvider
  ): Promise<AuthResult> => {
    console.log(`[IPC] cli:authenticate called: ${provider}`);
    updateWindow();
    return authenticateProvider(provider);
  });

  /**
   * Sign out from a CLI provider
   */
  ipcMain.handle('cli:signOut', async (
    _event,
    provider: CLIProvider
  ): Promise<{ success: boolean; error?: string }> => {
    console.log(`[IPC] cli:signOut called: ${provider}`);
    return signOutProvider(provider);
  });

  /**
   * Cancel auth for a provider
   */
  ipcMain.handle('cli:cancelAuth', async (
    _event,
    provider: CLIProvider
  ): Promise<boolean> => {
    console.log(`[IPC] cli:cancelAuth called: ${provider}`);
    return cancelAuth(provider);
  });

  console.log('[CLI Provider] IPC handlers registered');
}
