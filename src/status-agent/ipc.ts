/**
 * Status Agent IPC - Main Process Senders
 *
 * Functions for sending status updates from the main process to the renderer.
 * These are called by the Status Agent when backend events occur.
 */

import { BrowserWindow } from 'electron';
import { StatusLine, UserQuery, FuelState, TreeNode } from './types';

// =============================================================================
// WINDOW REFERENCE
// =============================================================================

/** Reference to the main window for sending IPC messages */
let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference.
 * Called during app initialization to enable IPC communication.
 */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

/**
 * Get the current main window reference.
 * Returns null if not set.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Clear the main window reference.
 * Called during app shutdown.
 */
export function clearMainWindow(): void {
  mainWindow = null;
}

// =============================================================================
// STATUS LINE SENDERS (Tree Updates)
// =============================================================================

/**
 * Send a new status line to the renderer.
 * Used when a new step starts or a new tree node is created.
 */
export function sendStatusLine(line: StatusLine): void {
  mainWindow?.webContents.send('status:line', line);
}

/**
 * Send a partial update to an existing status line.
 * Used for progress updates, state changes, or text updates.
 */
export function sendStatusLineUpdate(id: string, partial: Partial<StatusLine>): void {
  mainWindow?.webContents.send('status:line-update', { id, ...partial });
}

/**
 * Send a tree node update to the renderer.
 * Used for hierarchical status display.
 */
export function sendTreeNode(node: TreeNode): void {
  mainWindow?.webContents.send('status:tree-node', node);
}

// =============================================================================
// USER QUERY SENDERS (Decision Points)
// =============================================================================

/**
 * Send a user query to the renderer.
 * The PA agent routes these to the appropriate display.
 */
export function sendQuery(query: UserQuery): void {
  mainWindow?.webContents.send('status:query', query);
}

/**
 * Send query timeout notification.
 * Tells the renderer that a query timed out and the default was used.
 */
export function sendQueryTimeout(queryId: string, defaultValue: string): void {
  mainWindow?.webContents.send('status:query-timeout', { queryId, defaultValue });
}

// =============================================================================
// FUEL GAUGE SENDERS (Budget Tracking)
// =============================================================================

/**
 * Send fuel gauge update to the renderer.
 * Shows remaining session budget/quota.
 */
export function sendFuelUpdate(fuel: FuelState): void {
  mainWindow?.webContents.send('status:fuel-update', fuel);
}

// =============================================================================
// BUILD LIFECYCLE SENDERS
// =============================================================================

/**
 * Send build started notification.
 * Includes project name, tier level, and estimated completion time.
 */
export function sendBuildStarted(
  projectName: string,
  tier: number,
  estimatedTime: string
): void {
  mainWindow?.webContents.send('build:started', {
    projectName,
    tier,
    estimatedTime,
  });
}

/**
 * Send build complete notification.
 * Includes output artifacts (URLs, files, previews).
 */
export function sendBuildComplete(
  outputs: Array<{ type: string; label: string; value: string }>
): void {
  mainWindow?.webContents.send('build:complete', { outputs });
}

// =============================================================================
// INTERRUPT & CONTROL SENDERS
// =============================================================================

/**
 * Send interrupt acknowledgement to the renderer.
 * Shows which steps were affected and which continue.
 */
export function sendInterruptAck(detail: {
  affected: string[];
  unaffected: string[];
  message: string;
}): void {
  mainWindow?.webContents.send('status:interrupt-ack', detail);
}

/**
 * Send shell state change to the renderer.
 * Controls the overall UI state.
 */
export function sendShellState(
  state: 'idle' | 'building' | 'minimised' | 'complete'
): void {
  mainWindow?.webContents.send('shell:state-change', state);
}

// =============================================================================
// BATCH OPERATIONS (Performance Optimization)
// =============================================================================

/**
 * Send multiple status line updates in a single IPC call.
 * Use for bulk updates to reduce IPC overhead.
 */
export function sendStatusLineBatch(lines: StatusLine[]): void {
  mainWindow?.webContents.send('status:line-batch', lines);
}

/**
 * Send multiple partial updates in a single IPC call.
 * Use for bulk progress updates.
 */
export function sendStatusLineUpdateBatch(
  updates: Array<{ id: string } & Partial<StatusLine>>
): void {
  mainWindow?.webContents.send('status:line-update-batch', updates);
}

// =============================================================================
// ERROR SENDERS
// =============================================================================

/**
 * Send error notification to the renderer.
 * For displaying errors in the status tree.
 */
export function sendError(error: {
  id: string;
  message: string;
  stepId?: number;
  recoverable: boolean;
}): void {
  mainWindow?.webContents.send('status:error', error);
}

/**
 * Send error recovery notification.
 * When an error has been automatically recovered.
 */
export function sendErrorRecovered(errorId: string, resolution: string): void {
  mainWindow?.webContents.send('status:error-recovered', { errorId, resolution });
}
