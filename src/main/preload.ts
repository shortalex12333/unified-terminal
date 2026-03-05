import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CLIOutputChunk {
  processId: string;
  chunk: string;
}

interface CLIProcessExit {
  processId: string;
  exitCode: number;
}

interface InjectionResult {
  success: boolean;
  strategy?: string;
  error?: string;
}

interface SendResult {
  success: boolean;
  method?: string;
  error?: string;
}

interface ChunkEvent {
  content: string;
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
  timestamp: number;
  messageIndex: number;
}

interface CompleteEvent {
  content: string;
  hasError: boolean;
  errorMessage?: string;
  timestamp: number;
}

interface CaptureStatusResult {
  isCapturing: boolean;
  lastContent?: string;
  messageCount?: number;
  startTime?: number;
  error?: string;
}

interface ResponseResult {
  success: boolean;
  content?: string;
  messageCount?: number;
  isGenerating?: boolean;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  error?: string;
}

// System Scanner types (Gate 5)
interface ToolInfo {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
}

interface SystemProfile {
  platform: string;
  arch: string;
  tools: {
    homebrew: ToolInfo;
    git: ToolInfo;
    node: ToolInfo;
    python: ToolInfo;
    codex: ToolInfo;
    claudeCode: ToolInfo;
    gsd: ToolInfo;
  };
  allInstalled: boolean;
  missingTools: string[];
}

interface InstallProgress {
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  percentComplete: number;
  status: 'pending' | 'installing' | 'complete' | 'failed' | 'skipped';
  message?: string;
  error?: string;
}

interface InstallResult {
  success: boolean;
  installedTools: string[];
  failedTools: { name: string; error: string }[];
  skippedTools: string[];
  totalTime: number;
}

// CLI Authentication types (Gate 6)
// NOTE: Gemini removed (shelved feature)
type CLITool = 'codex' | 'claude-code';
type AuthPromptType = 'oauth' | 'token' | 'tos' | 'question';

interface AuthPrompt {
  tool: CLITool;
  type: AuthPromptType;
  message: string;
  options?: string[];
  timestamp: number;
}

interface AuthResult {
  success: boolean;
  tool: CLITool;
  error?: string;
  timestamp: number;
}

interface AuthStatus {
  tool: CLITool;
  isAuthenticated: boolean;
  lastChecked: number;
  tokenPath?: string;
  error?: string;
}

// CLI Process Management types (Gate 7)
type ProcessStatus = 'running' | 'completed' | 'failed' | 'killed' | 'timeout';

interface ProcessInfo {
  id: string;
  tool: string;
  command: string;
  args: string[];
  cwd: string;
  status: ProcessStatus;
  startedAt: Date;
  endedAt?: Date;
  exitCode?: number;
  exitSignal?: string;
  pid?: number;
  background: boolean;
  timeout: number;
  errorMessage?: string;
}

interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  background?: boolean;
  shell?: boolean | string;
  captureOutput?: boolean;
}

interface ProcessOutput {
  processId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: Date;
}

interface ProcessStatusEvent {
  processId: string;
  status: ProcessStatus;
  exitCode?: number;
  exitSignal?: string;
  errorMessage?: string;
  timestamp: Date;
}

interface TranslatedOutput {
  processId: string;
  message: string;
  category?: 'progress' | 'success' | 'error' | 'info';
  timestamp: Date;
}

interface TranslationResult {
  message: string | null;
  category?: 'progress' | 'success' | 'error' | 'info';
  translated: boolean;
}

interface ProcessError {
  processId: string;
  message: string;
  timestamp: Date;
}

// ============================================================================
// STATUS AGENT TYPES
// ============================================================================

type StatusState = 'pending' | 'active' | 'done' | 'error' | 'paused' | 'waiting_user';

interface StatusLine {
  id: string;
  text: string;
  expandable: boolean;
  expandedText: string | null;
  state: StatusState;
  stepId: number | null;
  parentId: string | null;
  progress: number | null;
  icon: string;
}

type QueryType = 'choice' | 'text' | 'confirm' | 'upload';
type QueryPriority = 'normal' | 'blocking';

interface QueryOption {
  label: string;
  value: string;
  detail: string | null;
  icon: string | null;
}

interface UserQuery {
  id: string;
  source: string;
  stepId: number | null;
  agentHandle: string;
  type: QueryType;
  question: string;
  options: QueryOption[];
  placeholder: string | null;
  defaultChoice: string | null;
  timeout: number;
  priority: QueryPriority;
}

interface FuelState {
  percent: number;
  label: string;
  detail: string;
  warning: boolean;
  warningText: string | null;
}

type TreeNodeOutputType = 'url' | 'file' | 'preview' | 'download';

interface TreeNodeOutput {
  type: TreeNodeOutputType;
  label: string;
  value: string;
}

interface TreeNode {
  id: string;
  parentId: string | null;
  label: string;
  state: StatusState;
  progress: number | null;
  expandable: boolean;
  expanded: boolean;
  children: string[];
  stepId: number | null;
  agentId: string | null;
  output: TreeNodeOutput | null;
}

// ============================================================================
// EXPOSED API
// ============================================================================

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // ============================================================================
  // INJECTION METHODS (Gate 2)
  // ============================================================================

  /**
   * Inject text into ChatGPT's input field
   */
  injectText: (text: string): Promise<InjectionResult> => {
    return ipcRenderer.invoke('chatgpt:inject', text);
  },

  /**
   * Trigger send button click
   */
  triggerSend: (): Promise<SendResult> => {
    return ipcRenderer.invoke('chatgpt:send');
  },

  /**
   * Inject text and send in one operation (with 300ms delay)
   */
  injectAndSend: (text: string): Promise<{ injection: InjectionResult; send: SendResult }> => {
    return ipcRenderer.invoke('chatgpt:inject-and-send', text);
  },

  /**
   * Check if ChatGPT page is ready for interaction
   */
  isPageReady: (): Promise<boolean> => {
    return ipcRenderer.invoke('chatgpt:is-ready');
  },

  /**
   * Wait for ChatGPT page to be ready
   */
  waitForPageReady: (timeout?: number): Promise<boolean> => {
    return ipcRenderer.invoke('chatgpt:wait-ready', timeout);
  },

  /**
   * Get current content of input field
   */
  getInputContent: (): Promise<string> => {
    return ipcRenderer.invoke('chatgpt:get-input');
  },

  /**
   * Clear the input field
   */
  clearInput: (): Promise<boolean> => {
    return ipcRenderer.invoke('chatgpt:clear-input');
  },

  // ============================================================================
  // CAPTURE METHODS (Gate 3)
  // ============================================================================

  /**
   * Start capturing ChatGPT responses
   * Chunks will be sent via 'chatgpt:chunk' events
   * Completion will be sent via 'chatgpt:complete' event
   */
  startCapture: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('chatgpt:capture-start');
  },

  /**
   * Stop capturing ChatGPT responses
   */
  stopCapture: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('chatgpt:capture-stop');
  },

  /**
   * Get current capture status
   */
  getCaptureStatus: (): Promise<CaptureStatusResult> => {
    return ipcRenderer.invoke('chatgpt:capture-status');
  },

  /**
   * Get current response content (one-shot, no streaming)
   */
  getResponse: (): Promise<ResponseResult> => {
    return ipcRenderer.invoke('chatgpt:get-response');
  },

  /**
   * Listen for response chunks during capture
   */
  onChunk: (callback: (chunk: ChunkEvent) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, chunk: ChunkEvent) => callback(chunk);
    ipcRenderer.on('chatgpt:chunk', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('chatgpt:chunk', handler);
    };
  },

  /**
   * Listen for capture completion
   */
  onComplete: (callback: (result: CompleteEvent) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, result: CompleteEvent) => callback(result);
    ipcRenderer.on('chatgpt:complete', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('chatgpt:complete', handler);
    };
  },

  // ============================================================================
  // SYSTEM SCANNER METHODS (Gate 5)
  // ============================================================================

  /**
   * Run full system scan to detect installed tools
   */
  scanSystem: (): Promise<SystemProfile> => {
    return ipcRenderer.invoke('system:scan');
  },

  /**
   * Check if a specific tool is installed
   */
  isToolInstalled: (toolKey: string): Promise<boolean> => {
    return ipcRenderer.invoke('system:is-installed', toolKey);
  },

  /**
   * Get detailed info for a specific tool
   */
  getToolInfo: (toolKey: string): Promise<ToolInfo | null> => {
    return ipcRenderer.invoke('system:tool-info', toolKey);
  },

  // ============================================================================
  // AUTO-INSTALLER METHODS (Gate 5)
  // ============================================================================

  /**
   * Install all missing tools
   * Progress events will be sent via 'system:install-progress'
   * Completion event will be sent via 'system:install-complete'
   */
  installMissingTools: (specificTools?: string[]): Promise<InstallResult> => {
    return ipcRenderer.invoke('system:install', specificTools);
  },

  /**
   * Install a single specific tool
   */
  installTool: (toolKey: string): Promise<InstallResult> => {
    return ipcRenderer.invoke('system:install-tool', toolKey);
  },

  /**
   * Retry failed installations from a previous result
   */
  retryFailedInstalls: (previousResult: InstallResult): Promise<InstallResult> => {
    return ipcRenderer.invoke('system:retry-failed', previousResult);
  },

  /**
   * Get estimated install time for a set of tools (in seconds)
   */
  estimateInstallTime: (toolKeys: string[]): Promise<number> => {
    return ipcRenderer.invoke('system:estimate-time', toolKeys);
  },

  /**
   * Listen for installation progress updates
   */
  onInstallProgress: (callback: (progress: InstallProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, progress: InstallProgress) => callback(progress);
    ipcRenderer.on('system:install-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('system:install-progress', handler);
    };
  },

  /**
   * Listen for installation completion
   */
  onInstallComplete: (callback: (result: InstallResult) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, result: InstallResult) => callback(result);
    ipcRenderer.on('system:install-complete', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('system:install-complete', handler);
    };
  },

  // ============================================================================
  // CLI AUTHENTICATION METHODS (Gate 6)
  // ============================================================================

  /**
   * Start authentication flow for a CLI tool (codex or claude-code)
   * Opens PTY process, detects prompts, may open OAuth browser
   */
  startCliAuth: (tool: CLITool, args?: string[]): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('cli:auth-start', tool, args);
  },

  /**
   * Send a response to a CLI authentication prompt
   */
  respondToCliPrompt: (tool: CLITool, response: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('cli:auth-respond', tool, response);
  },

  /**
   * Check authentication status for a specific tool
   */
  getCliAuthStatus: (tool: CLITool): Promise<AuthStatus> => {
    return ipcRenderer.invoke('cli:auth-status', tool);
  },

  /**
   * Check authentication status for all CLI tools
   */
  getAllCliAuthStatus: (): Promise<AuthStatus[]> => {
    return ipcRenderer.invoke('cli:auth-status-all');
  },

  /**
   * Cancel an active authentication flow
   */
  cancelCliAuth: (tool: CLITool): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('cli:auth-cancel', tool);
  },

  /**
   * Get list of tools currently authenticating
   */
  getActiveCliAuth: (): Promise<CLITool[]> => {
    return ipcRenderer.invoke('cli:auth-active');
  },

  /**
   * Listen for CLI authentication prompts
   * Called when the CLI needs user input (OAuth, token entry, TOS acceptance, etc.)
   */
  onCliAuthPrompt: (callback: (prompt: AuthPrompt) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, prompt: AuthPrompt) => callback(prompt);
    ipcRenderer.on('cli:auth-prompt', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('cli:auth-prompt', handler);
    };
  },

  /**
   * Listen for CLI authentication results
   * Called when authentication completes (success or failure)
   */
  onCliAuthResult: (callback: (result: AuthResult) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, result: AuthResult) => callback(result);
    ipcRenderer.on('cli:auth-result', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('cli:auth-result', handler);
    };
  },

  // ============================================================================
  // CLI PROCESS MANAGEMENT METHODS (Gate 7)
  // ============================================================================

  /**
   * Spawn a new CLI process
   * @param tool - The command/tool to run (e.g., 'claude', 'npm', 'git')
   * @param args - Arguments to pass to the tool
   * @param options - Spawn options (cwd, env, timeout, background, shell)
   * @returns Process ID for tracking
   */
  runCli: (tool: string, args?: string[], options?: SpawnOptions): Promise<string> => {
    return ipcRenderer.invoke('cli:run', tool, args, options);
  },

  /**
   * Kill a specific process
   * @param processId - The process ID to kill
   * @param signal - Signal to send (default: SIGTERM)
   * @returns True if kill was initiated
   */
  killCli: (processId: string, signal?: string): Promise<boolean> => {
    return ipcRenderer.invoke('cli:kill', processId, signal);
  },

  /**
   * Kill all running processes
   */
  killAllCli: (): Promise<void> => {
    return ipcRenderer.invoke('cli:kill-all');
  },

  /**
   * Get info about a specific process
   * @param processId - The process ID to look up
   * @returns ProcessInfo or null if not found
   */
  getCliProcess: (processId: string): Promise<ProcessInfo | null> => {
    return ipcRenderer.invoke('cli:get-process', processId);
  },

  /**
   * List all processes (running and completed)
   * @param runningOnly - If true, only return running processes
   * @returns Array of ProcessInfo
   */
  listCliProcesses: (runningOnly?: boolean): Promise<ProcessInfo[]> => {
    return ipcRenderer.invoke('cli:list', runningOnly);
  },

  /**
   * Check if a process is currently running
   * @param processId - The process ID to check
   * @returns True if process is running
   */
  isCliRunning: (processId: string): Promise<boolean> => {
    return ipcRenderer.invoke('cli:is-running', processId);
  },

  /**
   * Clean up old completed processes
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   * @returns Number of processes cleaned up
   */
  cleanupCli: (maxAge?: number): Promise<number> => {
    return ipcRenderer.invoke('cli:cleanup', maxAge);
  },

  /**
   * Translate raw CLI output to friendly message
   * @param rawOutput - Raw CLI output string
   * @returns TranslationResult with message and category
   */
  translateOutput: (rawOutput: string): Promise<TranslationResult> => {
    return ipcRenderer.invoke('cli:translate', rawOutput);
  },

  /**
   * Get simple progress status from output
   * @param rawOutput - Raw CLI output string
   * @returns Friendly status string or null
   */
  getProgressStatus: (rawOutput: string): Promise<string | null> => {
    return ipcRenderer.invoke('cli:get-status', rawOutput);
  },

  /**
   * Listen for raw CLI process output (stdout/stderr)
   */
  onCliOutput: (callback: (output: ProcessOutput) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, output: ProcessOutput) => callback(output);
    ipcRenderer.on('cli:output', handler);
    return () => {
      ipcRenderer.removeListener('cli:output', handler);
    };
  },

  /**
   * Listen for translated CLI output (friendly messages)
   */
  onCliTranslated: (callback: (output: TranslatedOutput) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, output: TranslatedOutput) => callback(output);
    ipcRenderer.on('cli:translated', handler);
    return () => {
      ipcRenderer.removeListener('cli:translated', handler);
    };
  },

  /**
   * Listen for CLI process status changes
   */
  onCliStatus: (callback: (status: ProcessStatusEvent) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, status: ProcessStatusEvent) => callback(status);
    ipcRenderer.on('cli:status', handler);
    return () => {
      ipcRenderer.removeListener('cli:status', handler);
    };
  },

  /**
   * Listen for CLI process errors
   */
  onCliError: (callback: (error: ProcessError) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, error: ProcessError) => callback(error);
    ipcRenderer.on('cli:error', handler);
    return () => {
      ipcRenderer.removeListener('cli:error', handler);
    };
  },

  // ============================================================================
  // CONDUCTOR / ROUTING METHODS (Intelligent Task Routing)
  // ============================================================================

  /**
   * Route a message through the Conductor system.
   * Called by the send interceptor to determine how to handle user input.
   * @param text - The message text to route
   * @returns Routing decision: web (ChatGPT), cli (local tools), or hybrid (both)
   */
  routeMessage: (text: string): Promise<{
    route: 'web' | 'cli' | 'hybrid';
    plan?: unknown;
    fastPath?: boolean;
  }> => {
    return ipcRenderer.invoke('interceptor:route-message', text);
  },

  /**
   * Listen for step progress events from the conductor
   */
  onStepProgress: (callback: (event: {
    planId: string;
    step: unknown;
    progress?: number;
    activity?: string;
  }) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: {
      planId: string;
      step: unknown;
      progress?: number;
      activity?: string;
    }) => callback(data);
    ipcRenderer.on('step:progress', handler);
    return () => {
      ipcRenderer.removeListener('step:progress', handler);
    };
  },

  /**
   * Listen for circuit breaker events (step needs user decision)
   */
  onStepNeedsUser: (callback: (options: {
    step: unknown;
    actions: string[];
    suggested: string;
    errorContext: string;
  }) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, options: {
      step: unknown;
      actions: string[];
      suggested: string;
      errorContext: string;
    }) => callback(options);
    ipcRenderer.on('step:needs-user', handler);
    return () => {
      ipcRenderer.removeListener('step:needs-user', handler);
    };
  },

  /**
   * Send user decision for circuit breaker
   */
  sendStepDecision: (stepId: number, decision: 'retry' | 'skip' | 'stop'): Promise<boolean> => {
    return ipcRenderer.invoke('step:user-decision', stepId, decision);
  },

  // ============================================================================
  // UNIFIED AUTH METHODS (for AuthStatus panel)
  // ============================================================================

  /**
   * Auth API for the AuthStatus panel component
   */
  auth: {
    /**
     * Check authentication status for all CLI tools
     */
    checkAll: (): Promise<AuthStatus[]> => {
      return ipcRenderer.invoke('cli:auth-status-all');
    },

    /**
     * Start authentication flow for a specific tool
     */
    authenticate: (tool: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('cli:auth-start', tool);
    },

    /**
     * Sign out from a CLI tool (removes token files)
     */
    signOut: (tool: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('auth:sign-out', tool);
    },

    /**
     * Listen for auth progress events (prompts and results)
     * Returns a cleanup function to remove listeners
     */
    onProgress: (callback: (data: AuthPrompt | AuthResult) => void): (() => void) => {
      const promptHandler = (_event: IpcRendererEvent, data: AuthPrompt) => callback(data);
      const resultHandler = (_event: IpcRendererEvent, data: AuthResult) => callback(data);

      ipcRenderer.on('cli:auth-prompt', promptHandler);
      ipcRenderer.on('cli:auth-result', resultHandler);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('cli:auth-prompt', promptHandler);
        ipcRenderer.removeListener('cli:auth-result', resultHandler);
      };
    },
  },

  // ============================================================================
  // CLI PROVIDER METHODS (Installation + Authentication for Claude)
  // ============================================================================

  /**
   * CLI API for managing CLI providers (Codex, Claude)
   * ChatGPT uses BrowserView web login - NOT this system
   */
  cli: {
    /**
     * Check status of all CLI providers (installed + authenticated)
     * Returns array of { tool, isInstalled, isAuthenticated }
     */
    checkAllStatus: (): Promise<{ tool: string; isInstalled: boolean; isAuthenticated: boolean }[]> => {
      return ipcRenderer.invoke('cli:checkAllStatus');
    },

    /**
     * Check status of a specific CLI provider
     */
    checkStatus: (provider: string): Promise<{ tool: string; isInstalled: boolean; isAuthenticated: boolean }> => {
      return ipcRenderer.invoke('cli:checkStatus', provider);
    },

    /**
     * Install a CLI provider (npm install -g <package>)
     * @param provider - 'gemini' or 'claude-code'
     */
    install: (provider: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('cli:install', provider);
    },

    /**
     * Authenticate with a CLI provider (triggers OAuth flow)
     * @param provider - 'gemini' or 'claude-code'
     */
    authenticate: (provider: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('cli:authenticate', provider);
    },

    /**
     * Sign out from a CLI provider (removes token files)
     * @param provider - 'gemini' or 'claude-code'
     */
    signOut: (provider: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('cli:signOut', provider);
    },

    /**
     * Cancel an active authentication process
     */
    cancelAuth: (provider: string): Promise<boolean> => {
      return ipcRenderer.invoke('cli:cancelAuth', provider);
    },

    /**
     * Send a message to a CLI provider (codex, claude-code, gemini)
     * @param provider - The CLI provider to use
     * @param processId - The process ID of the running CLI
     * @param message - The message to send
     */
    send: (provider: string, processId: string, message: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('cli:send-input', provider, processId, message);
    },

    /**
     * Listen for CLI output events
     * Returns a cleanup function to remove the listener
     */
    onOutput: (cb: (data: { provider: string; chunk: string; done: boolean; exitCode?: number; error?: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { provider: string; chunk: string; done: boolean; exitCode?: number; error?: string }) => cb(data);
      ipcRenderer.on('cli:output', handler);
      return () => {
        ipcRenderer.removeAllListeners('cli:output');
      };
    },

    /**
     * Listen for CLI auth output (OAuth prompts, etc.)
     */
    onAuthOutput: (cb: (data: { provider: string; output: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { provider: string; output: string }) => cb(data);
      ipcRenderer.on('cli:auth-output', handler);
      return () => {
        ipcRenderer.removeAllListeners('cli:auth-output');
      };
    },

    /**
     * Listen for CLI install progress
     */
    onInstallProgress: (cb: (data: { provider: string; status: string; message: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { provider: string; status: string; message: string }) => cb(data);
      ipcRenderer.on('cli:install-progress', handler);
      return () => {
        ipcRenderer.removeAllListeners('cli:install-progress');
      };
    },

    // NOTE: spawnGemini/killGemini removed (shelved feature)

    /**
     * Listen for CLI output chunks
     */
    onOutputChunk: (cb: (data: {
      processId: string;
      chunk: string;
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: CLIOutputChunk) => cb(data);
      ipcRenderer.on('cli:output-chunk', handler);
      return () => {
        ipcRenderer.removeListener('cli:output-chunk', handler);
      };
    },

    /**
     * Listen for CLI process exit
     */
    onProcessExit: (cb: (data: {
      processId: string;
      exitCode: number;
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: CLIProcessExit) => cb(data);
      ipcRenderer.on('cli:process-exit', handler);
      return () => {
        ipcRenderer.removeListener('cli:process-exit', handler);
      };
    },
  },

  // ============================================================================
  // PROVIDER BROWSERVIEW METHODS (Unified for all providers)
  // ============================================================================

  /**
   * Provider BrowserView API - ALL providers (ChatGPT, Claude) use BrowserView
   * Each provider loads their official website for authentication and chat
   */
  providerView: {
    /**
     * Show the BrowserView for a provider
     * Creates BrowserView, loads provider's official website
     * @param provider - 'chatgpt' | 'gemini' | 'claude'
     */
    show: (provider: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('provider:show-view', provider);
    },

    /**
     * Hide the provider BrowserView
     * Removes and destroys the BrowserView
     */
    hide: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('provider:hide-view');
    },

    /**
     * Get currently active provider
     * Returns null if no provider is active
     */
    getActive: (): Promise<string | null> => {
      return ipcRenderer.invoke('provider:get-active');
    },
  },

  // ============================================================================
  // LEGACY: CHATGPT BROWSERVIEW METHODS (for backward compatibility)
  // ============================================================================

  /**
   * @deprecated Use providerView.show('chatgpt') instead
   */
  chatgptView: {
    show: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('provider:show-view', 'chatgpt');
    },
    hide: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('provider:hide-view');
    },
    isVisible: (): Promise<boolean> => {
      return ipcRenderer.invoke('chatgpt:is-view-visible');
    },
  },

  // ============================================================================
  // PROVIDER EVENTS (Logout detection, etc.)
  // ============================================================================

  /**
   * Provider event listeners
   */
  provider: {
    /**
     * Listen for logout detection from any provider.
     * When a provider's web interface navigates to login page, this fires.
     * App should return to ProfilePicker when this happens.
     */
    onLogoutDetected: (cb: (provider: string) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, provider: string) => cb(provider);
      ipcRenderer.on('provider:logout-detected', handler);
      return () => {
        ipcRenderer.removeListener('provider:logout-detected', handler);
      };
    },
  },

  // ============================================================================
  // STATUS AGENT METHODS (Build Progress + User Interaction)
  // ============================================================================

  statusAgent: {
    // -------------------------------------------------------------------------
    // EVENT LISTENERS (Main -> Renderer)
    // -------------------------------------------------------------------------

    // Listen for new status lines (tree nodes)
    onStatusLine: (callback: (line: StatusLine) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, line: StatusLine) => callback(line);
      ipcRenderer.on('status:line', handler);
      return () => ipcRenderer.removeListener('status:line', handler);
    },

    // Listen for status line partial updates (progress, state changes)
    onStatusLineUpdate: (callback: (data: { id: string } & Partial<StatusLine>) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { id: string } & Partial<StatusLine>) => callback(data);
      ipcRenderer.on('status:line-update', handler);
      return () => ipcRenderer.removeListener('status:line-update', handler);
    },

    // Listen for batch status line updates (performance optimization)
    onStatusLineBatch: (callback: (lines: StatusLine[]) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, lines: StatusLine[]) => callback(lines);
      ipcRenderer.on('status:line-batch', handler);
      return () => ipcRenderer.removeListener('status:line-batch', handler);
    },

    // Listen for batch partial updates
    onStatusLineUpdateBatch: (callback: (updates: Array<{ id: string } & Partial<StatusLine>>) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, updates: Array<{ id: string } & Partial<StatusLine>>) => callback(updates);
      ipcRenderer.on('status:line-update-batch', handler);
      return () => ipcRenderer.removeListener('status:line-update-batch', handler);
    },

    // Listen for tree node updates
    onTreeNode: (callback: (node: TreeNode) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, node: TreeNode) => callback(node);
      ipcRenderer.on('status:tree-node', handler);
      return () => ipcRenderer.removeListener('status:tree-node', handler);
    },

    // Listen for user queries (decision points)
    onQuery: (callback: (query: UserQuery) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, query: UserQuery) => callback(query);
      ipcRenderer.on('status:query', handler);
      return () => ipcRenderer.removeListener('status:query', handler);
    },

    // Listen for query timeout (default was used)
    onQueryTimeout: (callback: (data: { queryId: string; defaultValue: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { queryId: string; defaultValue: string }) => callback(data);
      ipcRenderer.on('status:query-timeout', handler);
      return () => ipcRenderer.removeListener('status:query-timeout', handler);
    },

    // Listen for fuel gauge updates (session budget)
    onFuelUpdate: (callback: (fuel: FuelState) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, fuel: FuelState) => callback(fuel);
      ipcRenderer.on('status:fuel-update', handler);
      return () => ipcRenderer.removeListener('status:fuel-update', handler);
    },

    // Listen for build started event
    onBuildStarted: (callback: (data: { projectName: string; tier: number; estimatedTime: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { projectName: string; tier: number; estimatedTime: string }) => callback(data);
      ipcRenderer.on('build:started', handler);
      return () => ipcRenderer.removeListener('build:started', handler);
    },

    // Listen for build complete event
    onBuildComplete: (callback: (data: { outputs: Array<{ type: string; label: string; value: string }> }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { outputs: Array<{ type: string; label: string; value: string }> }) => callback(data);
      ipcRenderer.on('build:complete', handler);
      return () => ipcRenderer.removeListener('build:complete', handler);
    },

    // Listen for interrupt acknowledgement
    onInterruptAck: (callback: (detail: { affected: string[]; unaffected: string[]; message: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, detail: { affected: string[]; unaffected: string[]; message: string }) => callback(detail);
      ipcRenderer.on('status:interrupt-ack', handler);
      return () => ipcRenderer.removeListener('status:interrupt-ack', handler);
    },

    // Listen for shell state changes (idle/building/minimised/complete)
    onShellState: (callback: (state: 'idle' | 'building' | 'minimised' | 'complete') => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, state: 'idle' | 'building' | 'minimised' | 'complete') => callback(state);
      ipcRenderer.on('shell:state-change', handler);
      return () => ipcRenderer.removeListener('shell:state-change', handler);
    },

    // Listen for errors
    onError: (callback: (error: { id: string; message: string; stepId?: number; recoverable: boolean }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, error: { id: string; message: string; stepId?: number; recoverable: boolean }) => callback(error);
      ipcRenderer.on('status:error', handler);
      return () => ipcRenderer.removeListener('status:error', handler);
    },

    // Listen for error recovery
    onErrorRecovered: (callback: (data: { errorId: string; resolution: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { errorId: string; resolution: string }) => callback(data);
      ipcRenderer.on('status:error-recovered', handler);
      return () => ipcRenderer.removeListener('status:error-recovered', handler);
    },

    // -------------------------------------------------------------------------
    // USER ACTIONS (Renderer -> Main)
    // -------------------------------------------------------------------------

    // Send query response (button click or text input)
    sendQueryResponse: (queryId: string, value: string): void => {
      ipcRenderer.send('user:query-response', { queryId, value });
    },

    // Send free-text correction
    sendCorrection: (text: string): void => {
      ipcRenderer.send('user:correction', text);
    },

    // Stop specific step
    sendStopStep: (stepId: number): void => {
      ipcRenderer.send('user:stop-step', stepId);
    },

    // Stop all (global stop button)
    sendStopAll: (): void => {
      ipcRenderer.send('user:stop-all');
    },

    // Pause execution
    sendPause: (): void => {
      ipcRenderer.send('user:pause');
    },

    // Resume execution
    sendResume: (): void => {
      ipcRenderer.send('user:resume');
    },

    // -------------------------------------------------------------------------
    // LAYOUT CONTROLS (Renderer -> Main)
    // -------------------------------------------------------------------------

    // Hide the status tree (minimize)
    hideTree: (): void => {
      ipcRenderer.send('user:hide-tree');
    },

    // Expand the status tree (full view)
    expandTree: (): void => {
      ipcRenderer.send('user:expand-tree');
    },

    // Dismiss the status tree (remove from view)
    dismissTree: (): void => {
      ipcRenderer.send('user:dismiss-tree');
    },

    // -------------------------------------------------------------------------
    // INVOKE METHODS (Request-Response Pattern)
    // -------------------------------------------------------------------------

    // Get current status tree state (for initial render)
    getTree: (): Promise<unknown> => {
      return ipcRenderer.invoke('status:get-tree');
    },

    // Get pending user queries
    getPendingQueries: (): Promise<unknown> => {
      return ipcRenderer.invoke('status:get-pending-queries');
    },

    // Get current fuel state
    getFuel: (): Promise<unknown> => {
      return ipcRenderer.invoke('status:get-fuel');
    },
  },

  // ============================================================================
  // SHELL METHODS (System browser, external URLs)
  // ============================================================================

  /**
   * Shell API for opening external URLs
   */
  shell: {
    /**
     * Open a URL in the system's default browser (Safari/Chrome)
     * Used for OAuth flows that need to happen outside the Electron app
     */
    openExternal: (url: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('shell:open-external', url);
    },
  },
});
