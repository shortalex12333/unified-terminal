/**
 * Status Agent Types for Renderer Process
 *
 * Extends window.electronAPI with Status Agent IPC methods.
 * Types imported from ../../status-agent/types.ts
 */

// Re-export core types from status-agent for renderer use
export type {
  StatusLine,
  StatusState,
  UserQuery,
  QueryOption,
  QueryType,
  QueryPriority,
  FuelState,
  TreeNode,
  TreeNodeOutput,
  TreeNodeOutputType,
} from '../../status-agent/types';

// =============================================================================
// SHELL STATE
// =============================================================================

export type ShellState = 'idle' | 'building' | 'minimised' | 'complete';

// =============================================================================
// BUILD LIFECYCLE
// =============================================================================

export interface BuildStartedData {
  projectName: string;
  tier: number;
  estimatedTime: string;
}

export interface BuildCompleteData {
  outputs: Array<{ type: string; label: string; value: string }>;
}

// =============================================================================
// INTERRUPT ACKNOWLEDGEMENT
// =============================================================================

export interface InterruptAckData {
  affected: string[];
  unaffected: string[];
  message: string;
}

// =============================================================================
// QUERY TIMEOUT
// =============================================================================

export interface QueryTimeoutData {
  queryId: string;
  defaultValue: string;
}

// =============================================================================
// STATUS LINE UPDATE (PARTIAL)
// =============================================================================

export interface StatusLineUpdate {
  id: string;
  text?: string;
  state?: import('../../status-agent/types').StatusState;
  progress?: number | null;
  expandable?: boolean;
  expandedText?: string | null;
  icon?: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface StatusError {
  id: string;
  message: string;
  stepId?: number;
  recoverable: boolean;
}

export interface ErrorRecoveredData {
  errorId: string;
  resolution: string;
}

// =============================================================================
// EXTEND ELECTRON API
// =============================================================================

declare global {
  interface ElectronAPI {
    statusAgent: {
      // ─────────────────────────────────────────────────────────────────────
      // Event Listeners (returns cleanup function)
      // ─────────────────────────────────────────────────────────────────────

      /** New status line added to tree */
      onStatusLine: (
        callback: (line: import('../../status-agent/types').StatusLine) => void
      ) => () => void;

      /** Partial update to existing status line */
      onStatusLineUpdate: (
        callback: (data: StatusLineUpdate) => void
      ) => () => void;

      /** Batch of new status lines */
      onStatusLineBatch: (
        callback: (lines: import('../../status-agent/types').StatusLine[]) => void
      ) => () => void;

      /** Batch of partial updates */
      onStatusLineUpdateBatch: (
        callback: (updates: StatusLineUpdate[]) => void
      ) => () => void;

      /** Tree node update */
      onTreeNode: (
        callback: (node: import('../../status-agent/types').TreeNode) => void
      ) => () => void;

      /** User query requiring input */
      onQuery: (
        callback: (query: import('../../status-agent/types').UserQuery) => void
      ) => () => void;

      /** Query timed out, default value used */
      onQueryTimeout: (callback: (data: QueryTimeoutData) => void) => () => void;

      /** Fuel gauge update */
      onFuelUpdate: (
        callback: (fuel: import('../../status-agent/types').FuelState) => void
      ) => () => void;

      /** Build started notification */
      onBuildStarted: (callback: (data: BuildStartedData) => void) => () => void;

      /** Build complete notification */
      onBuildComplete: (callback: (data: BuildCompleteData) => void) => () => void;

      /** Interrupt acknowledgement */
      onInterruptAck: (callback: (detail: InterruptAckData) => void) => () => void;

      /** Shell state change */
      onShellState: (callback: (state: ShellState) => void) => () => void;

      /** Error notification */
      onError: (callback: (error: StatusError) => void) => () => void;

      /** Error recovered notification */
      onErrorRecovered: (callback: (data: ErrorRecoveredData) => void) => () => void;

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
    };
  }
}

export {};
