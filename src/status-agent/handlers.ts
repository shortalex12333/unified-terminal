/**
 * Status Agent IPC Handlers - Renderer to Main
 *
 * Handlers for receiving user responses and control commands from the renderer.
 * These are registered during app initialization.
 */

import { ipcMain, IpcMainEvent } from 'electron';

// =============================================================================
// HANDLER REGISTRATION
// =============================================================================

/**
 * Register all Status Agent IPC handlers.
 *
 * @param onQueryResponse - Called when user responds to a query (button click or text input)
 * @param onCorrection - Called when user submits a free-text correction
 * @param onStopStep - Called when user stops a specific step
 * @param onStopAll - Called when user clicks global stop button
 * @param onHideTree - Called when user hides the status tree
 * @param onExpandTree - Called when user expands the status tree
 * @param onDismissTree - Called when user dismisses the status tree
 */
export function registerStatusAgentHandlers(
  onQueryResponse: (queryId: string, value: string) => void,
  onCorrection: (text: string) => void,
  onStopStep: (stepId: number) => void,
  onStopAll: () => void,
  onHideTree: () => void,
  onExpandTree: () => void,
  onDismissTree: () => void
): void {
  // =========================================================================
  // QUERY RESPONSES
  // =========================================================================

  /**
   * Handle user response to a query.
   * Triggered when user clicks a button or enters text in response to a UserQuery.
   */
  ipcMain.on(
    'user:query-response',
    (_event: IpcMainEvent, { queryId, value }: { queryId: string; value: string }) => {
      onQueryResponse(queryId, value);
    }
  );

  // =========================================================================
  // CORRECTIONS
  // =========================================================================

  /**
   * Handle free-text correction from user.
   * Allows user to provide additional context or corrections during execution.
   */
  ipcMain.on('user:correction', (_event: IpcMainEvent, text: string) => {
    onCorrection(text);
  });

  // =========================================================================
  // STOP CONTROLS
  // =========================================================================

  /**
   * Handle stop request for a specific step.
   * Stops execution of the specified step while allowing others to continue.
   */
  ipcMain.on('user:stop-step', (_event: IpcMainEvent, stepId: number) => {
    onStopStep(stepId);
  });

  /**
   * Handle global stop request.
   * Stops all current execution immediately.
   */
  ipcMain.on('user:stop-all', () => {
    onStopAll();
  });

  // =========================================================================
  // LAYOUT CONTROLS
  // =========================================================================

  /**
   * Handle tree hide request.
   * Minimizes the status tree to a compact view.
   */
  ipcMain.on('user:hide-tree', () => {
    onHideTree();
  });

  /**
   * Handle tree expand request.
   * Expands the status tree to full view.
   */
  ipcMain.on('user:expand-tree', () => {
    onExpandTree();
  });

  /**
   * Handle tree dismiss request.
   * Completely removes the status tree from view.
   */
  ipcMain.on('user:dismiss-tree', () => {
    onDismissTree();
  });
}

// =============================================================================
// HANDLER REMOVAL
// =============================================================================

/**
 * Remove all Status Agent IPC handlers.
 * Called during app shutdown or when reinitializing handlers.
 */
export function removeStatusAgentHandlers(): void {
  ipcMain.removeAllListeners('user:query-response');
  ipcMain.removeAllListeners('user:correction');
  ipcMain.removeAllListeners('user:stop-step');
  ipcMain.removeAllListeners('user:stop-all');
  ipcMain.removeAllListeners('user:hide-tree');
  ipcMain.removeAllListeners('user:expand-tree');
  ipcMain.removeAllListeners('user:dismiss-tree');
}

// =============================================================================
// INVOKE HANDLERS (Promise-based)
// =============================================================================

/**
 * Register invoke handlers for synchronous request-response patterns.
 * Use ipcMain.handle for operations that need to return a result.
 */
export function registerStatusAgentInvokeHandlers(
  getStatusTree: () => Promise<unknown>,
  getPendingQueries: () => Promise<unknown>,
  getFuelState: () => Promise<unknown>
): void {
  /**
   * Get the current status tree state.
   * Returns the full tree structure for initial render.
   */
  ipcMain.handle('status:get-tree', async () => {
    return getStatusTree();
  });

  /**
   * Get pending user queries.
   * Returns any queries waiting for user response.
   */
  ipcMain.handle('status:get-pending-queries', async () => {
    return getPendingQueries();
  });

  /**
   * Get current fuel state.
   * Returns the current session budget/quota status.
   */
  ipcMain.handle('status:get-fuel', async () => {
    return getFuelState();
  });
}

/**
 * Remove invoke handlers.
 */
export function removeStatusAgentInvokeHandlers(): void {
  ipcMain.removeHandler('status:get-tree');
  ipcMain.removeHandler('status:get-pending-queries');
  ipcMain.removeHandler('status:get-fuel');
}
