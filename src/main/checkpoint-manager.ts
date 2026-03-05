/**
 * Checkpoint Manager - Forced User Decision Points
 *
 * Wires the FORCED_CHECKPOINTS from status-agent/query.ts into the execution flow.
 * Prevents Codex from one-shotting everything by forcing user approval at key points.
 *
 * Checkpoints:
 * - PLAN_REVIEW: After plan is generated, before first step executes
 * - FIRST_OUTPUT: After first step produces visible output
 * - PRE_DEPLOY: Before any deploy action
 * - PROGRESS_CHECK: Periodically during long builds (non-blocking)
 */

import { EventEmitter } from 'events';
import { ipcMain, BrowserWindow } from 'electron';
import {
  FORCED_CHECKPOINTS,
  getCheckpointByName,
  createQuery,
  isCheckpointTrigger,
  getCheckpointQuery,
  isQueryTimedOut,
  getTimeoutDefault,
} from '../status-agent/query';
import { systemEvents, emitEvent } from './events';
import { sendQuery, sendQueryTimeout } from '../status-agent/ipc';
import type { UserQuery, StatusEvent } from '../status-agent/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of a checkpoint evaluation.
 */
export type CheckpointResult =
  | { proceed: true; value: 'approve' | 'continue' }
  | { proceed: false; value: 'cancel' | 'stop' | 'modify' | 'pause' | 'review' | 'restart'; reason?: string };

/**
 * Checkpoint state tracking.
 */
interface CheckpointState {
  /** Whether a plan review has been approved this session */
  planApproved: boolean;
  /** Whether first output has been shown */
  firstOutputShown: boolean;
  /** Number of steps completed since last progress check */
  stepsSinceProgressCheck: number;
  /** Active pending queries */
  pendingQueries: Map<string, { query: UserQuery; resolve: (result: CheckpointResult) => void; createdAt: number }>;
}

// =============================================================================
// CHECKPOINT MANAGER CLASS
// =============================================================================

/**
 * CheckpointManager - Coordinates forced user decision points.
 *
 * Events:
 * - 'checkpoint-triggered': (checkpointName: string, query: UserQuery)
 * - 'checkpoint-resolved': (checkpointName: string, result: CheckpointResult)
 * - 'checkpoint-timeout': (checkpointName: string)
 */
export class CheckpointManager extends EventEmitter {
  private state: CheckpointState;
  private mainWindow: BrowserWindow | null = null;
  private timeoutCheckers: Map<string, NodeJS.Timeout> = new Map();
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super();
    this.state = {
      planApproved: false,
      firstOutputShown: false,
      stepsSinceProgressCheck: 0,
      pendingQueries: new Map(),
    };
    this.setupIPCHandlers();
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Set the main window for IPC communication.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Subscribe to system events for automatic checkpoint triggering.
   */
  subscribeToEvents(): void {
    // Subscribe to all events and check if they trigger checkpoints
    const unsub = systemEvents.onAll((event: StatusEvent) => {
      if (isCheckpointTrigger(event)) {
        const query = getCheckpointQuery(event);
        if (query) {
          // Handle checkpoint asynchronously
          this.handleEventCheckpoint(event, query);
        }
      }
    });
    this.unsubscribers.push(unsub);
    console.log('[CheckpointManager] Subscribed to system events');
  }

  /**
   * Handle a checkpoint triggered by an event.
   */
  private async handleEventCheckpoint(event: StatusEvent, query: UserQuery): Promise<void> {
    const checkpointName = query.agentHandle.replace('checkpoint:', '').toUpperCase();
    console.log(`[CheckpointManager] Event triggered checkpoint: ${checkpointName}`);

    // For blocking checkpoints, we need to somehow pause execution
    // This is handled by the caller waiting on waitForCheckpoint()
    // The event-based trigger is mainly for non-blocking progress checks

    if (query.priority === 'normal') {
      // Non-blocking - send query and continue
      this.emitQuery(query);
    }
    // Blocking checkpoints are handled via explicit waitFor* calls
  }

  // ==========================================================================
  // CHECKPOINT METHODS
  // ==========================================================================

  /**
   * Wait for PLAN_REVIEW checkpoint.
   * Called by conductor after generating a plan, before step scheduler starts.
   *
   * @param planId - ID of the plan
   * @param planSummary - Human-readable summary of the plan
   * @returns Result of user's decision
   */
  async waitForPlanReview(planId: string, planSummary: string): Promise<CheckpointResult> {
    if (this.state.planApproved) {
      // Already approved in this session
      return { proceed: true, value: 'approve' };
    }

    const checkpoint = getCheckpointByName('PLAN_REVIEW');
    if (!checkpoint) {
      console.warn('[CheckpointManager] PLAN_REVIEW checkpoint not found');
      return { proceed: true, value: 'approve' };
    }

    const query = createQuery(
      'conductor',
      null,
      'checkpoint:plan_review',
      {
        type: checkpoint.query.type,
        question: `${checkpoint.query.question}\n\nPlan: ${planSummary}`,
        options: checkpoint.query.options,
        priority: checkpoint.query.priority,
        timeout: checkpoint.query.timeout ?? undefined,
      }
    );

    const result = await this.waitForResponse(query, 'PLAN_REVIEW');

    if (result.proceed) {
      this.state.planApproved = true;
    }

    return result;
  }

  /**
   * Wait for FIRST_OUTPUT checkpoint.
   * Called by step scheduler after first step produces visible output.
   *
   * @param stepId - ID of the step that produced output
   * @param outputSummary - Brief description of what was produced
   * @returns Result of user's decision
   */
  async waitForFirstOutput(stepId: number, outputSummary: string): Promise<CheckpointResult> {
    if (this.state.firstOutputShown) {
      // Already shown first output
      return { proceed: true, value: 'approve' };
    }

    const checkpoint = getCheckpointByName('FIRST_OUTPUT');
    if (!checkpoint) {
      console.warn('[CheckpointManager] FIRST_OUTPUT checkpoint not found');
      return { proceed: true, value: 'approve' };
    }

    const query = createQuery(
      'scheduler',
      stepId,
      'checkpoint:first_output',
      {
        type: checkpoint.query.type,
        question: `${checkpoint.query.question}\n\n${outputSummary}`,
        options: checkpoint.query.options,
        priority: checkpoint.query.priority,
        timeout: checkpoint.query.timeout ?? undefined,
      }
    );

    const result = await this.waitForResponse(query, 'FIRST_OUTPUT');

    if (result.proceed) {
      this.state.firstOutputShown = true;
    }

    return result;
  }

  /**
   * Wait for PRE_DEPLOY checkpoint.
   * Called by step scheduler before executing any deploy action.
   * CRITICAL: Never auto-deploy. User MUST explicitly approve.
   *
   * @param stepId - ID of the deploy step
   * @param deployTarget - Where we're deploying to (e.g., 'Vercel', 'GitHub Pages')
   * @returns Result of user's decision
   */
  async waitForPreDeploy(stepId: number, deployTarget: string): Promise<CheckpointResult> {
    const checkpoint = getCheckpointByName('PRE_DEPLOY');
    if (!checkpoint) {
      console.warn('[CheckpointManager] PRE_DEPLOY checkpoint not found');
      // SAFETY: Default to NOT proceeding if checkpoint is missing
      return { proceed: false, value: 'cancel', reason: 'Deploy checkpoint not configured' };
    }

    const query = createQuery(
      'scheduler',
      stepId,
      'checkpoint:pre_deploy',
      {
        type: checkpoint.query.type,
        question: `${checkpoint.query.question}\n\nTarget: ${deployTarget}`,
        options: checkpoint.query.options,
        priority: checkpoint.query.priority,
        timeout: checkpoint.query.timeout ?? undefined,
      }
    );

    return this.waitForResponse(query, 'PRE_DEPLOY');
  }

  /**
   * Check PROGRESS_CHECK checkpoint (non-blocking).
   * Called by step scheduler every N steps.
   *
   * @param stepId - Current step ID
   * @param stepsCompleted - Total steps completed
   * @param totalSteps - Total steps in plan
   */
  triggerProgressCheck(stepId: number, stepsCompleted: number, totalSteps: number): void {
    // Reset counter
    this.state.stepsSinceProgressCheck = 0;

    const checkpoint = getCheckpointByName('PROGRESS_CHECK');
    if (!checkpoint) {
      return;
    }

    const query = createQuery(
      'scheduler',
      stepId,
      'checkpoint:progress_check',
      {
        type: checkpoint.query.type,
        question: `${checkpoint.query.question}\n\nProgress: ${stepsCompleted}/${totalSteps} steps`,
        options: checkpoint.query.options,
        priority: checkpoint.query.priority,
        timeout: checkpoint.query.timeout ?? undefined,
        defaultChoice: 'approve', // Auto-continue if no response
      }
    );

    // Non-blocking: emit query and set up timeout handler
    this.emitQuery(query);

    // Set up timeout for auto-continue
    if (checkpoint.query.timeout) {
      const timeoutId = setTimeout(() => {
        this.handleTimeout(query.id, 'PROGRESS_CHECK');
      }, checkpoint.query.timeout);
      this.timeoutCheckers.set(query.id, timeoutId);
    }
  }

  /**
   * Increment step counter and trigger progress check if needed.
   * Called after each step completes.
   *
   * @param stepId - Completed step ID
   * @param stepsCompleted - Total steps completed
   * @param totalSteps - Total steps in plan
   */
  onStepComplete(stepId: number, stepsCompleted: number, totalSteps: number): void {
    this.state.stepsSinceProgressCheck++;

    // Check every 5 steps
    if (this.state.stepsSinceProgressCheck >= 5) {
      this.triggerProgressCheck(stepId, stepsCompleted, totalSteps);
    }
  }

  /**
   * Check if an action is a deploy action.
   */
  isDeployAction(action: string): boolean {
    const deployKeywords = ['deploy', 'publish', 'release', 'push to production', 'go live'];
    const actionLower = action.toLowerCase();
    return deployKeywords.some(keyword => actionLower.includes(keyword));
  }

  // ==========================================================================
  // INTERNAL METHODS
  // ==========================================================================

  /**
   * Wait for user response to a checkpoint query.
   */
  private async waitForResponse(query: UserQuery, checkpointName: string): Promise<CheckpointResult> {
    return new Promise((resolve) => {
      const createdAt = Date.now();

      // Store pending query
      this.state.pendingQueries.set(query.id, { query, resolve, createdAt });

      // Emit the query to renderer
      this.emitQuery(query);
      this.emit('checkpoint-triggered', checkpointName, query);

      console.log(`[CheckpointManager] Waiting for ${checkpointName} response (query: ${query.id})`);

      // Set up timeout handler for blocking queries
      if (query.timeout && query.timeout > 0) {
        const timeoutId = setTimeout(() => {
          this.handleTimeout(query.id, checkpointName);
        }, query.timeout);
        this.timeoutCheckers.set(query.id, timeoutId);
      }
    });
  }

  /**
   * Emit a query to the renderer.
   */
  private emitQuery(query: UserQuery): void {
    sendQuery(query);

    // Also emit event for tracking
    emitEvent('checkpoint', 'query-sent', {
      queryId: query.id,
      agentHandle: query.agentHandle,
      priority: query.priority,
    });
  }

  /**
   * Handle query response from renderer.
   */
  handleResponse(queryId: string, value: string): void {
    const pending = this.state.pendingQueries.get(queryId);
    if (!pending) {
      console.warn(`[CheckpointManager] No pending query found for: ${queryId}`);
      return;
    }

    // Clear timeout
    const timeoutId = this.timeoutCheckers.get(queryId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutCheckers.delete(queryId);
    }

    // Parse the response value
    const result = this.parseResponse(value);

    // Clean up
    this.state.pendingQueries.delete(queryId);

    // Extract checkpoint name from agent handle
    const checkpointName = pending.query.agentHandle.replace('checkpoint:', '').toUpperCase();

    console.log(`[CheckpointManager] ${checkpointName} resolved: ${value} -> proceed=${result.proceed}`);
    this.emit('checkpoint-resolved', checkpointName, result);

    // Resolve the promise
    pending.resolve(result);
  }

  /**
   * Handle query timeout.
   */
  private handleTimeout(queryId: string, checkpointName: string): void {
    const pending = this.state.pendingQueries.get(queryId);
    if (!pending) {
      return;
    }

    console.log(`[CheckpointManager] ${checkpointName} timed out`);

    // Get default response if any
    const defaultValue = getTimeoutDefault(pending.query);

    if (defaultValue) {
      // Use default value
      this.handleResponse(queryId, defaultValue);
    } else {
      // Blocking query with no default - treat as cancel
      this.state.pendingQueries.delete(queryId);
      this.timeoutCheckers.delete(queryId);

      const result: CheckpointResult = {
        proceed: false,
        value: 'cancel',
        reason: 'Timed out waiting for response',
      };

      this.emit('checkpoint-timeout', checkpointName);
      this.emit('checkpoint-resolved', checkpointName, result);

      pending.resolve(result);
    }

    // Notify renderer
    sendQueryTimeout(queryId, defaultValue || 'cancel');
  }

  /**
   * Parse a response value into a CheckpointResult.
   */
  private parseResponse(value: string): CheckpointResult {
    switch (value) {
      case 'approve':
      case 'continue':
        return { proceed: true, value: 'approve' };

      case 'modify':
        return { proceed: false, value: 'modify' };
      case 'review':
        return { proceed: false, value: 'review' };
      case 'pause':
        return { proceed: false, value: 'pause' };
      case 'restart':
        return { proceed: false, value: 'restart' };
      case 'stop':
        return { proceed: false, value: 'stop' };

      case 'cancel':
      default:
        return { proceed: false, value: 'cancel' };
    }
  }

  // ==========================================================================
  // IPC SETUP
  // ==========================================================================

  /**
   * Set up IPC handlers for checkpoint responses.
   */
  private setupIPCHandlers(): void {
    // Handle checkpoint response from renderer
    ipcMain.on(
      'checkpoint:response',
      (_event, { queryId, value }: { queryId: string; value: string }) => {
        this.handleResponse(queryId, value);
      }
    );

    // Also listen on the standard query response channel
    ipcMain.on(
      'user:query-response',
      (_event, { queryId, value }: { queryId: string; value: string }) => {
        // Only handle if this is a checkpoint query
        if (this.state.pendingQueries.has(queryId)) {
          this.handleResponse(queryId, value);
        }
      }
    );
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Reset checkpoint state for a new execution.
   */
  reset(): void {
    this.state.planApproved = false;
    this.state.firstOutputShown = false;
    this.state.stepsSinceProgressCheck = 0;

    // Clear pending queries
    for (const [queryId, pending] of this.state.pendingQueries) {
      pending.resolve({ proceed: false, value: 'cancel', reason: 'Execution reset' });
    }
    this.state.pendingQueries.clear();

    // Clear timeouts
    for (const timeoutId of this.timeoutCheckers.values()) {
      clearTimeout(timeoutId);
    }
    this.timeoutCheckers.clear();

    console.log('[CheckpointManager] State reset');
  }

  /**
   * Get current checkpoint state (for debugging).
   */
  getState(): CheckpointState {
    return { ...this.state };
  }

  /**
   * Cleanup - remove listeners and handlers.
   */
  cleanup(): void {
    // Unsubscribe from events
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // Clear timeouts
    for (const timeoutId of this.timeoutCheckers.values()) {
      clearTimeout(timeoutId);
    }
    this.timeoutCheckers.clear();

    // Clear pending queries
    this.state.pendingQueries.clear();

    this.removeAllListeners();
    console.log('[CheckpointManager] Cleaned up');
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let checkpointManagerInstance: CheckpointManager | null = null;

/**
 * Get the singleton CheckpointManager instance.
 */
export function getCheckpointManager(): CheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new CheckpointManager();
  }
  return checkpointManagerInstance;
}

/**
 * Initialize the checkpoint manager with the main window.
 */
export function initializeCheckpointManager(mainWindow: BrowserWindow): void {
  const manager = getCheckpointManager();
  manager.setMainWindow(mainWindow);
  manager.subscribeToEvents();
}

/**
 * Cleanup the checkpoint manager.
 */
export function cleanupCheckpointManager(): void {
  if (checkpointManagerInstance) {
    checkpointManagerInstance.cleanup();
    checkpointManagerInstance = null;
  }
}
