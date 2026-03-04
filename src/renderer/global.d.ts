/**
 * Global type declarations for the renderer process
 * Provides TypeScript types for the Electron IPC bridge (window.electronAPI)
 */

// ============================================================================
// CLI PROVIDER TYPES
// ============================================================================

interface ProviderStatus {
  tool: string;
  isInstalled: boolean;
  isAuthenticated: boolean;
  version?: string;
  error?: string;
}

interface CLIOutputData {
  provider: string;
  chunk: string;
  done: boolean;
  exitCode?: number;
  error?: string;
}

interface CLIAuthOutput {
  provider: string;
  output: string;
}

interface CLIInstallProgress {
  provider: string;
  status: 'installing' | 'complete' | 'error';
  message: string;
}

interface CLIOutputChunk {
  processId: string;
  chunk: string;
}

interface CLIProcessExit {
  processId: string;
  exitCode: number;
}

// ============================================================================
// LEGACY AUTH TYPES (for backward compatibility)
// ============================================================================

interface AuthStatus {
  tool: string;
  isAuthenticated: boolean;
  lastChecked: number;
  tokenPath?: string;
  error?: string;
}

interface AuthProgress {
  tool: string;
  status: 'checking' | 'auth-required' | 'authenticating' | 'authenticated' | 'failed';
  message: string;
  error?: string;
}

// ============================================================================
// WINDOW API INTERFACE
// ============================================================================

interface ElectronAPI {
  // Platform info
  platform: NodeJS.Platform;

  // CLI Provider methods (Gemini, Claude - isolated auth systems)
  // ChatGPT uses BrowserView web login and does NOT go through this
  cli: {
    // Check status of all CLI providers
    checkAllStatus: () => Promise<ProviderStatus[]>;
    // Check status of a specific provider
    checkStatus: (provider: string) => Promise<ProviderStatus>;
    // Install a CLI provider via npm
    install: (provider: string) => Promise<{ success: boolean; error?: string }>;
    // Trigger OAuth authentication for a provider
    authenticate: (provider: string) => Promise<{ success: boolean; error?: string }>;
    // Sign out from a provider (remove token files)
    signOut: (provider: string) => Promise<{ success: boolean; error?: string }>;
    // Cancel an active auth process
    cancelAuth: (provider: string) => Promise<boolean>;
    // Send a message to a CLI provider
    send: (provider: string, processId: string, message: string) => Promise<{ success: boolean; error?: string }>;
    // Listen for CLI output
    onOutput: (cb: (data: CLIOutputData) => void) => () => void;
    // Listen for auth output (OAuth prompts)
    onAuthOutput: (cb: (data: CLIAuthOutput) => void) => () => void;
    // Listen for install progress
    onInstallProgress: (cb: (data: CLIInstallProgress) => void) => () => void;
    // Spawn Gemini CLI process
    spawnGemini: () => Promise<{ success: boolean; processId?: string; error?: string }>;
    // Kill Gemini CLI process
    killGemini: (processId: string) => Promise<{ success: boolean; error?: string }>;
    // Listen for CLI output chunks
    onOutputChunk: (cb: (data: CLIOutputChunk) => void) => () => void;
    // Listen for CLI process exit
    onProcessExit: (cb: (data: CLIProcessExit) => void) => () => void;
  };

  // Provider BrowserView methods - ALL providers use BrowserView with their official websites
  // chatgpt -> chatgpt.com, gemini -> gemini.google.com, claude -> claude.ai
  providerView: {
    // Show BrowserView for a provider (chatgpt, gemini, claude)
    show: (provider: string) => Promise<{ success: boolean; error?: string }>;
    // Hide the BrowserView
    hide: () => Promise<{ success: boolean }>;
    // Get currently active provider (or null)
    getActive: () => Promise<string | null>;
  };

  // Legacy: ChatGPT BrowserView methods (use providerView instead)
  chatgptView: {
    show: () => Promise<{ success: boolean; error?: string }>;
    hide: () => Promise<{ success: boolean }>;
    isVisible: () => Promise<boolean>;
  };

  // Legacy auth methods (for backward compatibility with AuthScreen)
  auth?: {
    checkAll: () => Promise<AuthStatus[]>;
    authenticate: (tool: string) => Promise<{ success: boolean; error?: string }>;
    signOut: (tool: string) => Promise<{ success: boolean; error?: string }>;
    onProgress: (cb: (data: AuthProgress) => void) => () => void;
  };

  // Provider events (logout detection, etc.)
  provider: {
    // Listen for logout detected from any provider
    // When provider's web UI navigates to login page, this fires
    onLogoutDetected: (cb: (provider: string) => void) => () => void;
  };

  // Shell methods (open external URLs in system browser)
  shell?: {
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
