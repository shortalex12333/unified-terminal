/**
 * Global type declarations for the renderer process
 * Provides TypeScript types for the Electron IPC bridge (window.electronAPI)
 */

// ============================================================================
// AUTH TYPES
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
// CLI OUTPUT TYPES
// ============================================================================

interface CLIOutputData {
  provider: string;
  chunk: string;
  done: boolean;
  exitCode?: number;
  error?: string;
}

// ============================================================================
// WINDOW API INTERFACE
// ============================================================================

interface ElectronAPI {
  // Platform info
  platform: NodeJS.Platform;

  // Auth methods for AuthStatus panel
  auth: {
    checkAll: () => Promise<AuthStatus[]>;
    authenticate: (tool: string) => Promise<{ success: boolean; error?: string }>;
    signOut: (tool: string) => Promise<{ success: boolean; error?: string }>;
    onProgress: (cb: (data: AuthProgress) => void) => () => void;
  };

  // Background CLI methods for spawning CLI tools invisibly
  cli: {
    send: (provider: string, message: string) => Promise<void>;
    onOutput: (cb: (data: CLIOutputData) => void) => () => void;
  };

  // ChatGPT BrowserView methods for showing/hiding embedded web view
  chatgptView: {
    show: () => Promise<{ success: boolean; error?: string }>;
    hide: () => Promise<{ success: boolean }>;
    isVisible: () => Promise<boolean>;
  };

  // Additional methods from preload.ts can be added here as needed
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
