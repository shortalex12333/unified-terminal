/**
 * CLI Tool Authentication Handler
 *
 * Handles authentication status checking and token management for CLI tools.
 * The actual OAuth flows are handled by cli-provider-manager.ts.
 *
 * This file provides:
 * - Token file existence checking
 * - Auth status queries
 * - Sign out (token removal)
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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

// ============================================================================
// CONSTANTS
// ============================================================================

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
    '.config/gemini/credentials.json',
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
 * OAuth callback URL patterns
 */
const OAUTH_CALLBACK_PATTERNS = [
  /^http:\/\/localhost:\d+\/callback/,
  /^http:\/\/127\.0\.0\.1:\d+\/callback/,
  /^http:\/\/localhost:\d+\/oauth/,
  /^http:\/\/127\.0\.0\.1:\d+\/oauth/,
];

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

// ============================================================================
// STATE
// ============================================================================

let mainWindowRef: BrowserWindow | null = null;

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
              if (data.token || data.api_key || data.access_token || data.credentials || data.refresh_token) {
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

/**
 * Sign out from a tool by removing its token files
 */
export async function signOut(tool: CLITool): Promise<{ success: boolean; error?: string }> {
  const homeDir = os.homedir();
  const paths = TOKEN_PATHS[tool];

  let removedAny = false;
  const errors: string[] = [];

  for (const relativePath of paths) {
    const fullPath = path.join(homeDir, relativePath);

    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        console.log(`[CLI Auth] Removed token file: ${fullPath}`);
        removedAny = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to remove ${relativePath}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    return { success: removedAny, error: errors.join('; ') };
  }

  return { success: true };
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Set up IPC handlers for CLI authentication
 * Note: Actual auth flows are handled by cli-provider-manager.ts
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
