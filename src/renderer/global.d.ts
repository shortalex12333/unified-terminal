/**
 * Global type declarations for the renderer process
 * Provides TypeScript types for the Electron IPC bridge (window.electronAPI)
 */

// ============================================================================
// STATUS AGENT TYPES (declare globally before use)
// ============================================================================

declare type StatusAgentState = 'pending' | 'active' | 'done' | 'error' | 'paused' | 'waiting_user';

declare interface StatusAgentLine {
  id: string;
  text: string;
  expandable: boolean;
  expandedText: string | null;
  state: StatusAgentState;
  stepId: number | null;
  parentId: string | null;
  progress: number | null;
  icon: string;
}

declare interface StatusAgentLineUpdate {
  id: string;
  text?: string;
  state?: StatusAgentState;
  progress?: number | null;
  expandable?: boolean;
  expandedText?: string | null;
  icon?: string;
}

declare interface StatusAgentTreeNode {
  id: string;
  parentId: string | null;
  label: string;
  state: StatusAgentState;
  progress: number | null;
  expandable: boolean;
  expanded: boolean;
  children: string[];
  stepId: number | null;
  agentId: string | null;
  output: { type: string; label: string; value: string } | null;
}

declare interface StatusAgentQueryOption {
  label: string;
  value: string;
  detail: string | null;
  icon: string | null;
}

declare interface StatusAgentQuery {
  id: string;
  source: string;
  stepId: number | null;
  agentHandle: string;
  type: 'choice' | 'text' | 'confirm' | 'upload';
  question: string;
  options: StatusAgentQueryOption[];
  placeholder: string | null;
  defaultChoice: string | null;
  timeout: number;
  priority: 'normal' | 'blocking';
}

declare interface StatusAgentFuel {
  percent: number;
  label: string;
  detail: string;
  warning: boolean;
  warningText: string | null;
}

// ============================================================================
// CLI PROVIDER TYPES
// ============================================================================

declare interface ProviderStatus {
  tool: string;
  isInstalled: boolean;
  isAuthenticated: boolean;
  version?: string;
  error?: string;
}

declare interface CLIOutputData {
  provider: string;
  chunk: string;
  done: boolean;
  exitCode?: number;
  error?: string;
}

declare interface CLIAuthOutput {
  provider: string;
  output: string;
}

declare interface CLIInstallProgress {
  provider: string;
  status: 'installing' | 'complete' | 'error';
  message: string;
}

declare interface CLIOutputChunk {
  processId: string;
  chunk: string;
}

declare interface CLIProcessExit {
  processId: string;
  exitCode: number;
}

// ============================================================================
// LEGACY AUTH TYPES (for backward compatibility)
// ============================================================================

declare interface AuthStatus {
  tool: string;
  isAuthenticated: boolean;
  lastChecked: number;
  tokenPath?: string;
  error?: string;
}

declare interface AuthProgress {
  tool: string;
  status: 'checking' | 'auth-required' | 'authenticating' | 'authenticated' | 'failed';
  message: string;
  error?: string;
}

// ============================================================================
// WINDOW API INTERFACE
// ============================================================================

declare interface ElectronAPI {
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

  // Circuit breaker (step-scheduler user escalation)
  onStepNeedsUser: (callback: (options: {
    step: { id: number; action: string; detail: string; error?: string; retryCount: number };
    actions: ('retry' | 'skip' | 'stop')[];
    suggested: 'retry' | 'skip' | 'stop';
    errorContext: string;
  }) => void) => () => void;

  sendStepDecision: (stepId: number, decision: 'retry' | 'skip' | 'stop') => Promise<boolean>;

  // Status Agent methods (progress tree, queries, fuel gauge)
  statusAgent?: {
    // ─────────────────────────────────────────────────────────────────────
    // Event Listeners (returns cleanup function)
    // ─────────────────────────────────────────────────────────────────────

    /** New status line added to tree */
    onStatusLine: (callback: (line: StatusAgentLine) => void) => () => void;

    /** Partial update to existing status line */
    onStatusLineUpdate: (callback: (data: StatusAgentLineUpdate) => void) => () => void;

    /** Batch of new status lines */
    onStatusLineBatch: (callback: (lines: StatusAgentLine[]) => void) => () => void;

    /** Batch of partial updates */
    onStatusLineUpdateBatch: (callback: (updates: StatusAgentLineUpdate[]) => void) => () => void;

    /** Tree node update */
    onTreeNode: (callback: (node: StatusAgentTreeNode) => void) => () => void;

    /** User query requiring input */
    onQuery: (callback: (query: StatusAgentQuery) => void) => () => void;

    /** Query timed out, default value used */
    onQueryTimeout: (callback: (data: { queryId: string; defaultValue: string }) => void) => () => void;

    /** Fuel gauge update */
    onFuelUpdate: (callback: (fuel: StatusAgentFuel) => void) => () => void;

    /** Build started notification */
    onBuildStarted: (callback: (data: { projectName: string; tier: number; estimatedTime: string }) => void) => () => void;

    /** Build complete notification */
    onBuildComplete: (callback: (data: { outputs: Array<{ type: string; label: string; value: string }> }) => void) => () => void;

    /** Interrupt acknowledgement */
    onInterruptAck: (callback: (detail: { affected: string[]; unaffected: string[]; message: string }) => void) => () => void;

    /** Shell state change */
    onShellState: (callback: (state: 'idle' | 'building' | 'minimised' | 'complete') => void) => () => void;

    /** Error notification */
    onError: (callback: (error: { id: string; message: string; stepId?: number; recoverable: boolean }) => void) => () => void;

    /** Error recovered notification */
    onErrorRecovered: (callback: (data: { errorId: string; resolution: string }) => void) => () => void;

    // ─────────────────────────────────────────────────────────────────────
    // User Actions (send to main process)
    // ─────────────────────────────────────────────────────────────────────

    /** Send response to a user query */
    sendQueryResponse: (queryId: string, value: string) => void;

    /** Send user correction/feedback */
    sendCorrection: (text: string) => void;

    /** Request to stop a specific step */
    sendStopStep: (stepId: number) => void;

    /** Request to stop all running steps */
    sendStopAll: () => void;

    /** Request to pause the build */
    sendPause: () => void;

    /** Request to resume the build */
    sendResume: () => void;

    // ─────────────────────────────────────────────────────────────────────
    // Tree Visibility Controls
    // ─────────────────────────────────────────────────────────────────────

    /** Hide the progress tree (minimize) */
    hideTree: () => void;

    /** Expand/show the progress tree */
    expandTree: () => void;

    /** Dismiss the tree (mark complete, return to idle) */
    dismissTree: () => void;

    // ─────────────────────────────────────────────────────────────────────
    // Invoke Methods (request-response)
    // ─────────────────────────────────────────────────────────────────────

    /** Get current status tree state (for initial render) */
    getTree: () => Promise<unknown>;

    /** Get pending user queries */
    getPendingQueries: () => Promise<unknown>;

    /** Get current fuel state */
    getFuel: () => Promise<unknown>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
