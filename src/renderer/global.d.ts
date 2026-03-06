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
// PROJECTS TYPES (Post-Build Continuation)
// ============================================================================

declare type ProjectStatus = 'active' | 'archived';

declare interface StoredProject {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastModifiedAt: string;
  template?: string;
  description: string;
  thumbnail?: string;
  status: ProjectStatus;
}

declare interface CreateProjectData {
  name: string;
  path: string;
  template?: string;
  description: string;
}

declare interface UpdateProjectData {
  name?: string;
  description?: string;
  template?: string;
  thumbnail?: string;
  status?: ProjectStatus;
}

declare interface ProjectOperationResult {
  success: boolean;
  error?: string;
  project?: StoredProject;
}

declare type QuickActionType = 'update-content' | 'change-design' | 'add-feature' | 'view-files' | 'deploy' | 'custom';

declare interface QuickAction {
  type: QuickActionType;
  label: string;
  icon: string;
  promptTemplate: string;
  description: string;
}

declare interface ProjectContext {
  project: StoredProject;
  quickAction?: QuickAction;
  customPrompt?: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

declare interface AnalyticsTierUsage {
  tier0: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

declare interface AnalyticsSummary {
  totalBuilds: number;
  completedBuilds: number;
  cancelledBuilds: number;
  averageBuildTime: number;
  tierUsage: AnalyticsTierUsage;
  topTemplates: string[];
  commonCancelPoints: string[];
  successRate: number;
  totalBuildTime: number;
  firstEventAt: number | null;
  lastEventAt: number | null;
}

// ============================================================================
// FAILURE TYPES (Graceful Failure UX)
// ============================================================================

declare type FailureReason =
  | 'api_unavailable'
  | 'rate_limited'
  | 'subscription_expired'
  | 'network_error'
  | 'timeout'
  | 'auth_expired'
  | 'quota_exceeded'
  | 'service_error'
  | 'permission_denied'
  | 'disk_full'
  | 'unknown';

declare interface PartialOutput {
  path: string;
  type: 'file' | 'directory' | 'artifact';
  size?: number;
  complete: boolean;
  createdAt: Date;
}

declare interface SavedStep {
  id: number;
  target: 'web' | 'cli' | 'service';
  action: string;
  detail: string;
  status: 'completed' | 'failed' | 'pending' | 'skipped';
  result?: unknown;
  error?: string;
}

declare interface SavedProgress {
  id: string;
  planId: string;
  projectPath: string;
  projectName: string;
  completedSteps: number[];
  skippedSteps: number[];
  failedStep: number;
  steps: SavedStep[];
  failureReason: FailureReason;
  errorMessage: string;
  savedAt: Date;
  canResume: boolean;
  partialOutputs: PartialOutput[];
  totalSteps: number;
  originalMessage?: string;
  context?: Record<string, unknown>;
  estimatedTimeRemaining?: number;
  appVersion: string;
}

declare interface SavedProgressSummary {
  id: string;
  planId: string;
  projectName: string;
  projectPath: string;
  failureReason: FailureReason;
  savedAt: Date;
  canResume: boolean;
  completedSteps: number;
  totalSteps: number;
  partialOutputCount: number;
}

declare interface ResumeOptions {
  fromFailedStep?: boolean;
  skipFailedStep?: boolean;
  regeneratePlan?: boolean;
  tryDifferentApproach?: boolean;
}

declare interface ResumeResult {
  success: boolean;
  newPlanId?: string;
  error?: string;
  resumedFromStep?: number;
}

declare interface DownloadOptions {
  completeOnly?: boolean;
  includeSources?: boolean;
  format?: 'zip' | 'tar.gz';
  filename?: string;
}

declare interface DownloadResult {
  success: boolean;
  filePath?: string;
  size?: number;
  fileCount?: number;
  error?: string;
}

declare interface FailureModalData {
  title: string;
  description: string;
  reason: FailureReason;
  progress: {
    completed: number;
    failed: number;
    pending: number;
    total: number;
  };
  partialOutputs: PartialOutput[];
  canResume: boolean;
  canAutoResume: boolean;
  retryDelay?: number;
  progressId: string;
}

// ============================================================================
// MCP (Model Context Protocol) TYPES
// ============================================================================

declare type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

declare type MCPServerCategory =
  | 'payments'
  | 'deployment'
  | 'database'
  | 'productivity'
  | 'version-control'
  | 'communication'
  | 'storage'
  | 'other';

declare interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  oauthUrl?: string;
  tokenUrl?: string;
  requiredScopes: string[];
  status: MCPConnectionStatus;
  errorMessage?: string;
  requiresOAuth: boolean;
  category: MCPServerCategory;
  docsUrl?: string;
}

declare interface MCPConnection {
  serverId: string;
  connectedAt: Date;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  apiKey?: string;
  userInfo?: {
    id?: string;
    email?: string;
    name?: string;
    avatar?: string;
  };
  lastVerified?: Date;
}

declare interface MCPRequirement {
  serverId: string;
  reason: string;
  required: boolean;
  features?: string[];
}

declare interface MCPDetectionResult {
  requirements: MCPRequirement[];
  missingRequired: MCPRequirement[];
  missingOptional: MCPRequirement[];
  canProceed: boolean;
}

declare interface MCPConnectResult {
  success: boolean;
  serverId: string;
  error?: string;
  connection?: MCPConnection;
}

declare interface MCPDisconnectResult {
  success: boolean;
  serverId: string;
  error?: string;
}

declare interface MCPStatusChangeEvent {
  serverId: string;
  previousStatus: MCPConnectionStatus;
  newStatus: MCPConnectionStatus;
  errorMessage?: string;
}

declare interface MCPConnectionRequiredEvent {
  stepId: number;
  stepAction: string;
  stepDetail: string;
  detection: MCPDetectionResult;
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

  // ChatGPT DOM injection methods (Gate 2)
  injectText?: (text: string) => Promise<{ success: boolean; strategy?: string; error?: string }>;
  triggerSend?: () => Promise<{ success: boolean; method?: string; error?: string }>;
  injectAndSend?: (text: string) => Promise<{
    injection: { success: boolean; strategy?: string; error?: string };
    send: { success: boolean; method?: string; error?: string };
  }>;
  isPageReady?: () => Promise<boolean>;
  waitForPageReady?: (timeout?: number) => Promise<boolean>;
  getInputContent?: () => Promise<string>;
  clearInput?: () => Promise<boolean>;

  // CLI Provider methods (Codex, Claude - isolated auth systems)
  // ChatGPT uses BrowserView web login and does NOT go through this
  // NOTE: Gemini removed (shelved feature)
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
    // Listen for CLI output chunks
    onOutputChunk: (cb: (data: CLIOutputChunk) => void) => () => void;
    // Listen for CLI process exit
    onProcessExit: (cb: (data: CLIProcessExit) => void) => () => void;
  };

  // Provider BrowserView methods - ALL providers use BrowserView with their official websites
  // chatgpt -> chatgpt.com, claude -> claude.ai (Gemini shelved)
  providerView: {
    // Show BrowserView for a provider (chatgpt, claude)
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

  // Preview methods (Live Preview Panel)
  preview?: {
    // ─────────────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────────────

    /** Show preview panel with URL */
    show: (url: string) => Promise<{ success: boolean; error?: string }>;

    /** Hide preview panel */
    hide: () => Promise<{ success: boolean }>;

    /** Refresh preview panel */
    refresh: () => Promise<{ success: boolean; error?: string }>;

    /** Auto-detect running dev server */
    detectServer: () => Promise<{
      found: boolean;
      port?: number;
      url?: string;
      checkedPorts: number[];
    }>;

    /** Set preview port (shorthand for localhost URL) */
    setPort: (port: number) => Promise<{ success: boolean; error?: string }>;

    /** Get preview configuration */
    getConfig: () => Promise<{
      url: string;
      port: number;
      visible: boolean;
      autoRefresh: boolean;
      refreshDebounce: number;
    }>;

    /** Set auto-refresh enabled/disabled */
    setAutoRefresh: (enabled: boolean) => Promise<void>;

    /** Navigate to a new URL in preview */
    navigate: (url: string) => Promise<{ success: boolean; error?: string }>;

    /** Check if preview is visible */
    isVisible: () => Promise<boolean>;

    /** Get current preview URL */
    getUrl: () => Promise<string>;

    // ─────────────────────────────────────────────────────────────────────
    // Event Listeners (returns cleanup function)
    // ─────────────────────────────────────────────────────────────────────

    /** Listen for preview shown event */
    onShown: (callback: (data: { url: string; port: number }) => void) => () => void;

    /** Listen for preview hidden event */
    onHidden: (callback: () => void) => () => void;

    /** Listen for preview refreshed event */
    onRefreshed: (callback: (data: { url: string }) => void) => () => void;

    /** Listen for preview loaded event */
    onLoaded: (callback: (data: { url: string }) => void) => () => void;

    /** Listen for preview load error event */
    onLoadError: (callback: (data: { errorCode: number; errorDescription: string; url: string }) => void) => () => void;

    /** Listen for preview navigated event */
    onNavigated: (callback: (data: { url: string }) => void) => () => void;
  };

  // Projects methods (Post-Build Continuation)
  projects?: {
    // ─────────────────────────────────────────────────────────────────────
    // CRUD Operations
    // ─────────────────────────────────────────────────────────────────────

    /** List all projects, optionally filtered by status */
    list: (status?: 'active' | 'archived') => Promise<StoredProject[]>;

    /** Get a project by ID */
    get: (id: string) => Promise<StoredProject | null>;

    /** Create a new project */
    create: (data: CreateProjectData) => Promise<ProjectOperationResult>;

    /** Update a project */
    update: (id: string, updates: UpdateProjectData) => Promise<ProjectOperationResult>;

    /** Archive a project (soft delete) */
    archive: (id: string) => Promise<ProjectOperationResult>;

    // ─────────────────────────────────────────────────────────────────────
    // Search & Query
    // ─────────────────────────────────────────────────────────────────────

    /** Search projects by name or description */
    search: (query: string) => Promise<StoredProject[]>;

    /** Get recently modified projects */
    recent: (limit?: number) => Promise<StoredProject[]>;

    // ─────────────────────────────────────────────────────────────────────
    // Project Continuation
    // ─────────────────────────────────────────────────────────────────────

    /** Open a project for continuation work */
    open: (id: string) => Promise<{
      project: StoredProject | null;
      quickActions: QuickAction[];
    }>;

    /** Get default quick actions */
    getQuickActions: () => Promise<QuickAction[]>;

    // ─────────────────────────────────────────────────────────────────────
    // File System
    // ─────────────────────────────────────────────────────────────────────

    /** Open project folder in Finder/Explorer */
    openFolder: (id: string) => Promise<boolean>;

    /** Cleanup orphaned projects */
    cleanup: () => Promise<number>;
  };

  // Analytics methods (Local Telemetry)
  analytics?: {
    /** Get aggregated analytics summary */
    getSummary: () => Promise<AnalyticsSummary>;

    /** Export all analytics data as JSON string */
    export: () => Promise<string>;

    /** Clear all analytics data */
    clear: () => Promise<void>;

    /** Check if analytics is enabled */
    isEnabled: () => Promise<boolean>;

    /** Enable or disable analytics */
    setEnabled: (enabled: boolean) => Promise<void>;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Failure methods (Graceful Failure UX)
  // ─────────────────────────────────────────────────────────────────────────

  /** Failure API for handling build failures gracefully */
  failure?: {
    /** Save current build progress when a failure occurs */
    saveProgress: (params: {
      planId: string;
      projectPath: string;
      projectName: string;
      failedStepId: number;
      error: string;
      statusCode?: number;
      originalMessage?: string;
      context?: Record<string, unknown>;
    }) => Promise<SavedProgress>;

    /** List all saved progress entries */
    listSaved: () => Promise<SavedProgressSummary[]>;

    /** Load a specific saved progress */
    load: (id: string) => Promise<SavedProgress | null>;

    /** Delete a saved progress */
    delete: (id: string) => Promise<boolean>;

    /** Check if saved progress can be resumed */
    canResume: (id: string) => Promise<boolean>;

    /** Resume from saved progress */
    resume: (id: string, options?: ResumeOptions) => Promise<ResumeResult>;

    /** Download partial outputs as a zip file */
    downloadPartial: (id: string, options?: DownloadOptions) => Promise<DownloadResult>;

    /** Open the downloads directory in Finder */
    openDownloads: () => Promise<{ success: boolean }>;

    /** Get failure modal data for UI display */
    getModalData: (id: string) => Promise<FailureModalData | null>;

    /** Cleanup old saved progress files */
    cleanup: (maxAgeMs?: number) => Promise<number>;

    /** Listen for progress saved events */
    onProgressSaved: (callback: (progress: SavedProgress) => void) => () => void;

    /** Listen for progress deleted events */
    onProgressDeleted: (callback: (id: string) => void) => () => void;

    /** Listen for build failure events (triggers FailureModal) */
    onBuildFailed: (callback: (data: {
      progressId: string;
      failureReason: FailureReason;
      canResume: boolean;
      completedSteps: number;
      totalSteps: number;
    }) => void) => () => void;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MCP (Model Context Protocol) Account Connection
  // ─────────────────────────────────────────────────────────────────────────

  /** MCP API for managing external service connections */
  mcp?: {
    // ─────────────────────────────────────────────────────────────────────
    // Server Discovery
    // ─────────────────────────────────────────────────────────────────────

    /** List all available MCP servers */
    listServers: () => Promise<MCPServer[]>;

    /** Get a specific MCP server by ID */
    getServer: (serverId: string) => Promise<MCPServer | null>;

    // ─────────────────────────────────────────────────────────────────────
    // Connection Management
    // ─────────────────────────────────────────────────────────────────────

    /** Connect to an MCP server (initiates OAuth or API key flow) */
    connect: (serverId: string, options?: {
      force?: boolean;
      timeout?: number;
    }) => Promise<MCPConnectResult>;

    /** Set API key for a non-OAuth MCP server */
    setApiKey: (serverId: string, apiKey: string) => Promise<MCPConnectResult>;

    /** Disconnect from an MCP server */
    disconnect: (serverId: string, options?: {
      revokeToken?: boolean;
    }) => Promise<MCPDisconnectResult>;

    /** Check if an MCP server is connected */
    isConnected: (serverId: string) => Promise<boolean>;

    /** Get connection for an MCP server */
    getConnection: (serverId: string) => Promise<MCPConnection | null>;

    /** Get all active MCP connections */
    getConnections: () => Promise<MCPConnection[]>;

    // ─────────────────────────────────────────────────────────────────────
    // Detection
    // ─────────────────────────────────────────────────────────────────────

    /** Check required MCP servers for a step */
    checkRequired: (stepAction: string, stepDetail: string) => Promise<MCPDetectionResult>;

    /** Verify an MCP connection is still valid */
    verifyConnection: (serverId: string) => Promise<boolean>;

    /** Refresh access token for an MCP server */
    refreshToken: (serverId: string) => Promise<boolean>;

    // ─────────────────────────────────────────────────────────────────────
    // Event Listeners
    // ─────────────────────────────────────────────────────────────────────

    /** Listen for MCP status changes */
    onStatusChange: (callback: (event: MCPStatusChangeEvent) => void) => () => void;

    /** Listen for MCP connection added */
    onConnectionAdded: (callback: (connection: MCPConnection) => void) => () => void;

    /** Listen for MCP connection removed */
    onConnectionRemoved: (callback: (serverId: string) => void) => () => void;

    /** Listen for MCP connection errors */
    onConnectionError: (callback: (data: { serverId: string; error: string }) => void) => () => void;

    /** Listen for MCP connection required during build */
    onConnectionRequired: (callback: (event: MCPConnectionRequiredEvent) => void) => () => void;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Progress Monitor IPC channels (V2 — File-Based Architecture)
  // ─────────────────────────────────────────────────────────────────────────

  /** Progress Monitor API for V2 file-based transposition architecture */
  project?: {
    /** Listen for status updates (agent working, almost done, finished) */
    onUpdate: (callback: (data: { type: string; message: string }) => void) => () => void;

    /** Listen for progress tree updates (phase status changes) */
    onProgress: (callback: (data: { phases: Array<{ name: string; status: 'done' | 'active' | 'pending' }>; percentage: number }) => void) => () => void;

    /** Listen for file created/modified events */
    onFile: (callback: (data: { name: string; path: string; canPreview: boolean; canOpen: boolean }) => void) => () => void;

    /** Listen for user action required (MCP connection, circuit breaker) */
    onAction: (callback: (data: {
      type: 'mcp' | 'circuit';
      title: string;
      message: string;
      actions: Array<{ label: string; action: string }>;
    }) => void) => () => void;

    /** Listen for project completion */
    onComplete: (callback: (data: {
      humanFolder: string;
      deployedUrl?: string;
      summary: { pages: number; components: number };
    }) => void) => () => void;

    /** Start a new project with a prompt */
    start: (prompt: string) => Promise<{ projectId: string; projectName: string }>;

    /** Respond to an action overlay (MCP connect, circuit breaker choice) */
    respondToAction: (action: string) => Promise<void>;

    /** Open a folder in Finder/Explorer */
    openFolder: (path: string) => Promise<void>;

    /** Open a file with default application */
    openFile: (path: string) => Promise<void>;

    /** Open a URL in default browser */
    openUrl: (url: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
