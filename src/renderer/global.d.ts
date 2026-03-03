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
// WINDOW API INTERFACE
// ============================================================================

interface ElectronAPI {
  // Platform info
  platform: NodeJS.Platform;

  // Auth methods for AuthStatus panel
  auth: {
    checkAll: () => Promise<AuthStatus[]>;
    authenticate: (tool: string) => Promise<{ success: boolean; error?: string }>;
    onProgress: (cb: (data: AuthProgress) => void) => () => void;
  };

  // Additional methods from preload.ts can be added here as needed
  // For now, only auth is typed for the AuthStatus panel
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
