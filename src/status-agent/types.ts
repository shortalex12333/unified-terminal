/**
 * Status Agent Types
 *
 * Type definitions for the user-facing translation layer that converts
 * backend events into human-readable status lines.
 */

// =============================================================================
// STATUS LINE - What gets rendered in the tree
// =============================================================================

/**
 * The visual state of a status line
 */
export type StatusState =
  | 'pending'      // Not yet started
  | 'active'       // Currently in progress
  | 'done'         // Successfully completed
  | 'error'        // Failed with error
  | 'paused'       // Temporarily stopped
  | 'waiting_user'; // Needs user input

/**
 * A single line in the status tree display.
 * Max 8 words, human-friendly, present progressive tense.
 */
export interface StatusLine {
  /** Unique identifier for this status line */
  id: string;

  /** Human-readable text (max 8 words) */
  text: string;

  /** Whether this line can be expanded for more detail */
  expandable: boolean;

  /** Additional detail shown when expanded */
  expandedText: string | null;

  /** Current state of this status */
  state: StatusState;

  /** Associated step ID from the plan, if any */
  stepId: number | null;

  /** Parent status line ID for hierarchy */
  parentId: string | null;

  /** Progress percentage (0-100) if applicable */
  progress: number | null;

  /** Emoji icon for visual state indication */
  icon: string;
}

// =============================================================================
// STATUS EVENT - What backend components emit
// =============================================================================

/**
 * Source components that emit status events
 */
export type EventSource =
  | 'conductor'
  | 'worker'
  | 'bodyguard'
  | 'pa'
  | 'rate-limit'
  | 'context-warden'
  | 'archivist'
  | 'image-gen'
  | 'deploy'
  | 'research'
  | 'file-system'
  | 'git'
  | 'terminal';

/**
 * Raw event emitted by backend components.
 * Translated to StatusLine for user display.
 */
export interface StatusEvent {
  /** Which component emitted this event */
  source: EventSource | string;

  /** Event type key (e.g., 'classify', 'spawn', 'complete') */
  type: string;

  /** JSON stringified detail payload */
  detail: string;

  /** Unix timestamp in milliseconds */
  timestamp: number;
}

// =============================================================================
// USER QUERY - Decision points requiring user input
// =============================================================================

/**
 * Types of user queries
 */
export type QueryType =
  | 'choice'   // Select from options
  | 'text'     // Free text input
  | 'confirm'  // Yes/No confirmation
  | 'upload';  // File upload

/**
 * Priority level for user queries
 */
export type QueryPriority =
  | 'normal'   // Can be deferred
  | 'blocking'; // Stops progress until answered

/**
 * An option presented to the user in a choice query
 */
export interface QueryOption {
  /** Display label */
  label: string;

  /** Value returned when selected */
  value: string;

  /** Additional detail/description */
  detail: string | null;

  /** Optional icon for the option */
  icon: string | null;
}

/**
 * A decision point presented to the user.
 * The PA agent routes these to the appropriate display.
 */
export interface UserQuery {
  /** Unique identifier for this query */
  id: string;

  /** Which component is asking */
  source: string;

  /** Associated step ID if part of a plan */
  stepId: number | null;

  /** Friendly handle for the asking agent */
  agentHandle: string;

  /** Type of input expected */
  type: QueryType;

  /** The question in human-readable form */
  question: string;

  /** Available options for choice type */
  options: QueryOption[];

  /** Placeholder text for text input */
  placeholder: string | null;

  /** Default selection if timeout */
  defaultChoice: string | null;

  /** Timeout in milliseconds before defaultChoice is used */
  timeout: number;

  /** Whether this blocks progress */
  priority: QueryPriority;
}

// =============================================================================
// FUEL STATE - Session budget tracking
// =============================================================================

/**
 * Current state of the session "fuel" (budget/quota).
 * Displayed as a gauge to the user.
 */
export interface FuelState {
  /** Percentage remaining (0-100) */
  percent: number;

  /** Short label (e.g., "75% remaining") */
  label: string;

  /** Detailed explanation */
  detail: string;

  /** Whether to show warning state */
  warning: boolean;

  /** Warning message if applicable */
  warningText: string | null;
}

// =============================================================================
// TREE NODE - For hierarchical rendering
// =============================================================================

/**
 * Types of output that can be attached to a tree node
 */
export type TreeNodeOutputType =
  | 'url'      // Link to open
  | 'file'     // Local file path
  | 'preview'  // Inline preview
  | 'download'; // Downloadable content

/**
 * Output artifact attached to a tree node
 */
export interface TreeNodeOutput {
  /** Type of output */
  type: TreeNodeOutputType;

  /** Display label for the output */
  label: string;

  /** The actual value (URL, path, content) */
  value: string;
}

/**
 * A node in the hierarchical status tree.
 * Supports nesting for complex operations.
 */
export interface TreeNode {
  /** Unique identifier */
  id: string;

  /** Parent node ID for hierarchy */
  parentId: string | null;

  /** Display label */
  label: string;

  /** Current state */
  state: StatusState;

  /** Progress percentage if applicable */
  progress: number | null;

  /** Whether this node can be expanded */
  expandable: boolean;

  /** Current expansion state */
  expanded: boolean;

  /** Child node IDs */
  children: string[];

  /** Associated step ID */
  stepId: number | null;

  /** Associated agent ID */
  agentId: string | null;

  /** Output artifact if any */
  output: TreeNodeOutput | null;
}

// =============================================================================
// TRANSLATION TYPES - For translator.ts
// =============================================================================

/**
 * Partial status line returned by translation functions.
 * The translator fills in remaining fields.
 */
export type TranslationResult = Partial<StatusLine> & {
  text: string;
  icon: string;
};

/**
 * A translation function that takes event detail and returns status fields
 */
export type TranslationFn = (detail: string) => TranslationResult;

/**
 * Map of "source:type" keys to translation functions
 */
export type TranslationMap = Record<string, TranslationFn>;

// =============================================================================
// STATUS AGENT STATE - Internal state management
// =============================================================================

/**
 * Complete state of the Status Agent
 */
export interface StatusAgentState {
  /** All status lines indexed by ID */
  lines: Map<string, StatusLine>;

  /** Tree structure for hierarchical display */
  tree: Map<string, TreeNode>;

  /** Root node IDs (top-level items) */
  rootIds: string[];

  /** Pending user queries */
  queries: Map<string, UserQuery>;

  /** Current fuel state */
  fuel: FuelState;

  /** Event history for debugging */
  eventLog: StatusEvent[];

  /** Maximum events to keep in log */
  maxEventLogSize: number;

  /** Currently running agents (for interrupt routing) */
  runningAgents: Map<number, RunningAgent>;
}

/**
 * Information about a currently running agent.
 * (Duplicated from interrupt-classifier for type export)
 */
export interface RunningAgent {
  /** Unique handle for this agent instance */
  handle: string;
  /** Associated step ID from execution plan */
  stepId: number;
  /** Category of work (matches INTERRUPT_KEYWORDS keys) */
  category: string;
  /** Current status */
  status: 'running' | 'paused';
}

// =============================================================================
// EVENT SUBSCRIPTION - For reactive updates
// =============================================================================

/**
 * Callback for status line updates
 */
export type StatusUpdateCallback = (line: StatusLine) => void;

/**
 * Callback for tree structure updates
 */
export type TreeUpdateCallback = (tree: Map<string, TreeNode>, rootIds: string[]) => void;

/**
 * Callback for user queries
 */
export type QueryCallback = (query: UserQuery) => void;

/**
 * Callback for fuel state updates
 */
export type FuelUpdateCallback = (fuel: FuelState) => void;

/**
 * Subscription handles for cleanup
 */
export interface StatusSubscription {
  unsubscribe: () => void;
}
