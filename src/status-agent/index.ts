/**
 * Status Agent Module Exports
 *
 * Central export for all Status Agent functionality.
 * The Status Agent is the user-facing translation layer that converts
 * backend events into human-readable status lines.
 */

// Types
export type {
  StatusState,
  StatusLine,
  EventSource,
  StatusEvent,
  QueryType,
  QueryPriority,
  QueryOption,
  UserQuery,
  FuelState,
  TreeNodeOutputType,
  TreeNodeOutput,
  TreeNode,
  TranslationResult,
  TranslationFn,
  TranslationMap,
  StatusAgentState,
  StatusUpdateCallback,
  TreeUpdateCallback,
  QueryCallback,
  FuelUpdateCallback,
  StatusSubscription,
} from './types';

// IPC Senders (Main Process -> Renderer)
export {
  setMainWindow,
  getMainWindow,
  clearMainWindow,
  sendStatusLine,
  sendStatusLineUpdate,
  sendTreeNode,
  sendQuery,
  sendQueryTimeout,
  sendFuelUpdate,
  sendBuildStarted,
  sendBuildComplete,
  sendInterruptAck,
  sendShellState,
  sendStatusLineBatch,
  sendStatusLineUpdateBatch,
  sendError,
  sendErrorRecovered,
} from './ipc';

// IPC Handlers (Renderer -> Main Process)
export {
  registerStatusAgentHandlers,
  removeStatusAgentHandlers,
  registerStatusAgentInvokeHandlers,
  removeStatusAgentInvokeHandlers,
} from './handlers';

// Translator - Event-to-StatusLine translation (NO LLM, pure lookup)
export {
  translate,
  translateBatch,
  TRANSLATIONS,
  humanizeFileName,
  humanizeTask,
  simplifyReason,
} from './translator';

// Voice - Brand voice rules enforcement
export {
  BANNED_WORDS,
  PREFERRED_TERMS,
  MAX_WORDS_PER_STATUS,
  TENSE,
  isBanned,
  getPreferred,
  sanitize,
  truncate,
  toProgressive,
  processVoice,
  validateVoice,
} from './voice';

// =============================================================================
// QUERY ROUTER (Job 2) - User decision points
// =============================================================================

export {
  // Constants
  QUERY_TIMEOUT_MS,
  BLOCKING_TIMEOUT_MS,
  DEPLOY_TIMEOUT_MS,
  FORCED_CHECKPOINTS,

  // Types
  type PAEnvelope,

  // Query creation
  createQuery,

  // Checkpoint detection
  isCheckpointTrigger,
  getCheckpointQuery,
  getCheckpointByName,

  // Response routing
  routeQueryResponse,
  routeUserCorrection,

  // Validation
  isValidQueryResponse,
  isQueryTimedOut,
  getTimeoutDefault,
} from './query';

// =============================================================================
// INTERRUPT CLASSIFIER (Job 3 - Part 1) - Keyword-based classification
// =============================================================================

export {
  // Keywords
  INTERRUPT_KEYWORDS,

  // Types
  type InterruptClassification,
  type RunningAgent,

  // Classification
  classifyInterrupt,
  isUrgentStop,
  isContinuation,
  getAgentsInCategory,
} from './interrupt-classifier';

// =============================================================================
// INTERRUPT DISPATCH (Job 3 - Part 2) - Route corrections to agents
// =============================================================================

export {
  // Types
  type ValidatedInterrupt,
  type RuntimeType,
  type DispatchAction,

  // Prompt building
  buildInterruptPrompt,
  buildContextualInterruptPrompt,

  // Validation
  validateInterrupt,

  // Runtime detection
  detectRuntime,
  getDispatchStrategy,

  // Dispatch
  dispatchInterrupt,
  extractEnvelopes,
  extractRespawnPrompts,

  // Emergency
  broadcastCorrection,
  emergencyStop,
} from './interrupt-dispatch';

// =============================================================================
// STATUS AGENT MANAGER - Main orchestrator
// =============================================================================

import { BrowserWindow } from 'electron';
import { systemEvents, emitEvent } from '../main/events';
import { translate, translateBatch } from './translator';
import {
  setMainWindow,
  sendStatusLine,
  sendTreeNode,
  sendQuery,
  sendFuelUpdate,
  sendBuildStarted,
  sendBuildComplete,
  sendStatusLineBatch,
  sendShellState,
  sendInterruptAck,
} from './ipc';
import { registerStatusAgentHandlers, registerStatusAgentInvokeHandlers } from './handlers';
import { routeQueryResponse } from './query';
import { classifyInterrupt, isUrgentStop, type RunningAgent } from './interrupt-classifier';
import { validateInterrupt, dispatchInterrupt } from './interrupt-dispatch';
import type {
  StatusEvent,
  StatusLine,
  TreeNode,
  FuelState,
  StatusAgentState,
} from './types';

/**
 * Status Agent Manager
 *
 * Main orchestrator that:
 * 1. Subscribes to systemEvents from backend components
 * 2. Translates events to StatusLines
 * 3. Sends updates to renderer via IPC
 * 4. Manages the tree structure for hierarchical display
 */
class StatusAgentManager {
  private state: StatusAgentState;
  private unsubscribers: (() => void)[] = [];
  private initialized = false;

  constructor() {
    this.state = {
      lines: new Map(),
      tree: new Map(),
      rootIds: [],
      queries: new Map(),
      fuel: {
        percent: 100,
        label: 'Ready',
        detail: 'Session budget available',
        warning: false,
        warningText: null,
      },
      eventLog: [],
      maxEventLogSize: 100,
      runningAgents: new Map(),
    };
  }

  /**
   * Initialize the Status Agent.
   * Sets up IPC handlers and event subscriptions.
   */
  initialize(mainWindow: BrowserWindow): void {
    if (this.initialized) {
      console.log('[StatusAgent] Already initialized');
      return;
    }

    console.log('[StatusAgent] Initializing...');

    // Set main window for IPC
    setMainWindow(mainWindow);

    // Register IPC handlers with callbacks
    registerStatusAgentHandlers(
      // onQueryResponse
      (queryId: string, value: string) => {
        console.log(`[StatusAgent] Query response: ${queryId} = ${value}`);
        // Route the response using the query router
        this.handleQueryResponse(queryId, value);
      },
      // onCorrection
      (text: string) => {
        console.log(`[StatusAgent] Correction: ${text}`);
        this.handleCorrection(text);
      },
      // onStopStep
      (stepId: number) => {
        console.log(`[StatusAgent] Stop step: ${stepId}`);
        this.handleStopStep(stepId);
      },
      // onStopAll
      () => {
        console.log('[StatusAgent] Stop all');
        this.handleStopAll();
      },
      // onHideTree
      () => {
        console.log('[StatusAgent] Hide tree');
        this.handleHideTree();
      },
      // onExpandTree
      () => {
        console.log('[StatusAgent] Expand tree');
        this.handleExpandTree();
      },
      // onDismissTree
      () => {
        console.log('[StatusAgent] Dismiss tree');
        this.handleDismissTree();
      }
    );

    registerStatusAgentInvokeHandlers(
      // getStatusTree
      async () => {
        return {
          tree: Object.fromEntries(this.state.tree),
          rootIds: this.state.rootIds,
        };
      },
      // getPendingQueries
      async () => {
        return Object.fromEntries(this.state.queries);
      },
      // getFuelState
      async () => {
        return this.state.fuel;
      }
    );

    // Subscribe to all system events
    this.subscribeToEvents();

    this.initialized = true;
    console.log('[StatusAgent] Initialized successfully');
  }

  /**
   * Subscribe to system events from backend components.
   */
  private subscribeToEvents(): void {
    // Subscribe to all events using wildcard
    const unsubAll = systemEvents.onAll((event: StatusEvent) => {
      this.handleEvent(event);
    });
    this.unsubscribers.push(unsubAll);

    console.log('[StatusAgent] Subscribed to system events');
  }

  /**
   * Handle an incoming status event.
   */
  private handleEvent(event: StatusEvent): void {
    // Log the event
    this.state.eventLog.push(event);
    if (this.state.eventLog.length > this.state.maxEventLogSize) {
      this.state.eventLog.shift();
    }

    // Track running agents from scheduler events
    this.updateRunningAgentsFromEvent(event);

    // Translate to status line
    const statusLine = translate(event);

    // Generate a unique ID for this status line
    const lineId = `${event.source}:${event.type}:${event.timestamp}`;

    // Store the status line (merge with defaults and translated values)
    const fullLine: StatusLine = {
      ...statusLine,
      id: lineId,
      stepId: this.extractStepId(event),
      parentId: this.determineParentId(event),
    };

    this.state.lines.set(lineId, fullLine);

    // Update tree structure
    this.updateTree(fullLine, event);

    // Send to renderer via IPC
    sendStatusLine(fullLine);

    console.log(`[StatusAgent] Processed event: ${event.source}:${event.type} -> "${fullLine.text}"`);
  }

  /**
   * Extract step ID from event detail if present.
   */
  private extractStepId(event: StatusEvent): number | null {
    try {
      const detail = JSON.parse(event.detail);
      if (typeof detail.stepId === 'number') {
        return detail.stepId;
      }
    } catch {
      // Not JSON or no stepId
    }
    return null;
  }

  /**
   * Determine parent ID for hierarchical tree structure.
   */
  private determineParentId(event: StatusEvent): string | null {
    // Steps belong under their plan
    if (event.source === 'scheduler' && event.type.startsWith('step-')) {
      // Find the most recent plan-start event
      for (let i = this.state.eventLog.length - 1; i >= 0; i--) {
        const e = this.state.eventLog[i];
        if (e.source === 'scheduler' && e.type === 'plan-start') {
          return `scheduler:plan-start:${e.timestamp}`;
        }
      }
    }

    // Worker events belong under their step
    if (event.source === 'worker') {
      try {
        const detail = JSON.parse(event.detail);
        if (detail.stepId) {
          // Find the step-start event for this step
          for (let i = this.state.eventLog.length - 1; i >= 0; i--) {
            const e = this.state.eventLog[i];
            if (e.source === 'scheduler' && e.type === 'step-start') {
              const stepDetail = JSON.parse(e.detail);
              if (stepDetail.stepId === detail.stepId) {
                return `scheduler:step-start:${e.timestamp}`;
              }
            }
          }
        }
      } catch {
        // Not JSON
      }
    }

    return null;
  }

  /**
   * Update the tree structure with a new status line.
   */
  private updateTree(line: StatusLine, event: StatusEvent): void {
    const node: TreeNode = {
      id: line.id,
      parentId: line.parentId,
      label: line.text,
      state: line.state,
      progress: line.progress,
      expandable: line.expandable,
      expanded: false,
      children: [],
      stepId: line.stepId,
      agentId: event.source,
      output: null,
    };

    // Add to tree
    this.state.tree.set(node.id, node);

    // Add to parent's children
    if (line.parentId) {
      const parent = this.state.tree.get(line.parentId);
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    } else {
      // Root node
      if (!this.state.rootIds.includes(node.id)) {
        this.state.rootIds.push(node.id);
      }
    }

    // Send tree update to renderer
    sendTreeNode(node);
  }

  /**
   * Update fuel state (session budget).
   */
  updateFuel(fuel: FuelState): void {
    this.state.fuel = fuel;
    sendFuelUpdate(fuel);
  }

  /**
   * Signal build started (transitions app shell to BUILDING state).
   */
  startBuild(planId: string, tier: number = 1): void {
    sendBuildStarted(planId, tier, 'Calculating...');
  }

  /**
   * Signal build complete (transitions app shell to IDLE or COMPLETE state).
   */
  completeBuild(outputs: Array<{ type: string; label: string; value: string }> = []): void {
    sendBuildComplete(outputs);
  }

  // ==========================================================================
  // CALLBACK HANDLERS
  // ==========================================================================

  private handleQueryResponse(queryId: string, value: string): void {
    const query = this.state.queries.get(queryId);
    if (query) {
      // Route the response via PA envelope to the appropriate agent
      const envelope = routeQueryResponse(queryId, value, query);

      // Emit the envelope to the target agent
      emitEvent('pa', 'query-response-routed', {
        target: envelope.target,
        stepId: envelope.stepId,
        payload: envelope.payload,
      });

      // Clean up the query
      this.state.queries.delete(queryId);
    }
  }

  private handleCorrection(text: string): void {
    // Check for urgent stop keywords first
    if (isUrgentStop(text)) {
      this.handleStopAll();
      return;
    }

    // Get running agents from state (placeholder - would come from scheduler)
    const runningAgents = this.getRunningAgents();

    // Classify the interrupt using keyword matching (NO LLM)
    const classification = classifyInterrupt(text, runningAgents);

    if (classification.needsLLM) {
      // Queue for conductor to resolve target when keywords didn't match
      emitEvent('conductor', 'resolve-correction', {
        text,
        classification,
      });
    } else {
      // Direct dispatch to classified target
      const validated = validateInterrupt(classification, runningAgents);
      const actions = dispatchInterrupt(validated, text);

      // Emit interrupt events for each affected agent
      for (const action of actions) {
        if (action.action !== 'ignore' && action.envelope) {
          emitEvent('executor', 'interrupt', {
            agentHandle: action.agentHandle,
            runtime: action.runtime,
            action: action.action,
            envelope: action.envelope,
            respawnPrompt: action.respawnPrompt,
          });
        }
      }

      // Send acknowledgement to renderer
      sendInterruptAck({
        affected: [validated.primaryTarget, ...validated.secondaryTargets].filter(Boolean) as string[],
        unaffected: validated.unaffected,
        message: `Updating ${validated.primaryTarget || 'task'}...`,
      });
    }
  }

  /**
   * Update running agents map based on scheduler events.
   */
  private updateRunningAgentsFromEvent(event: StatusEvent): void {
    if (event.source !== 'scheduler') {
      return;
    }

    try {
      const detail = JSON.parse(event.detail);
      const stepId = detail.stepId;

      if (typeof stepId !== 'number') {
        return;
      }

      if (event.type === 'step-start') {
        // Add agent when step starts
        const action = detail.action || 'unknown';
        const category = this.categorizeAction(action);

        this.state.runningAgents.set(stepId, {
          handle: `step-${stepId}`,
          stepId,
          category,
          status: 'running',
        });
      } else if (event.type === 'step-done' || event.type === 'step-failed' || event.type === 'step-skipped') {
        // Remove agent when step completes
        this.state.runningAgents.delete(stepId);
      } else if (event.type === 'needs-user') {
        // Mark agent as paused when waiting for user
        const agent = this.state.runningAgents.get(stepId);
        if (agent) {
          agent.status = 'paused';
        }
      }
    } catch {
      // Event detail is not JSON or doesn't have stepId
    }
  }

  /**
   * Map action to category for interrupt routing.
   */
  private categorizeAction(action: string): string {
    const actionLower = action.toLowerCase();

    if (actionLower.includes('style') || actionLower.includes('design') || actionLower.includes('color')) {
      return 'DESIGN';
    }
    if (actionLower.includes('content') || actionLower.includes('text') || actionLower.includes('write')) {
      return 'CONTENT';
    }
    if (actionLower.includes('deploy') || actionLower.includes('publish') || actionLower.includes('host')) {
      return 'DEPLOYMENT';
    }
    if (actionLower.includes('feature') || actionLower.includes('build') || actionLower.includes('create')) {
      return 'FEATURE';
    }
    if (actionLower.includes('image') || actionLower.includes('photo') || actionLower.includes('asset')) {
      return 'ASSET';
    }

    return 'GENERAL';
  }

  /**
   * Get list of currently running agents.
   * Populated by scheduler step events.
   */
  private getRunningAgents(): RunningAgent[] {
    return Array.from(this.state.runningAgents.values());
  }

  private handleStopStep(stepId: number): void {
    // Emit event to scheduler to stop a specific step
    emitEvent('scheduler', 'stop-step', { stepId });
  }

  private handleStopAll(): void {
    // Emit event to scheduler for emergency stop
    emitEvent('scheduler', 'stop-all', {});
  }

  private handleHideTree(): void {
    // Minimize the tree view
    sendShellState('minimised');
  }

  private handleExpandTree(): void {
    // Expand the tree view
    sendShellState('building');
  }

  private handleDismissTree(): void {
    // Dismiss the tree and return to idle
    sendShellState('idle');
  }

  /**
   * Get current state (for debugging).
   */
  getState(): StatusAgentState {
    return this.state;
  }

  /**
   * Get event log (for debugging).
   */
  getEventLog(): StatusEvent[] {
    return this.state.eventLog;
  }

  /**
   * Cleanup - remove listeners and handlers.
   */
  cleanup(): void {
    console.log('[StatusAgent] Cleaning up...');

    // Unsubscribe from all events
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // Clear state
    this.state.lines.clear();
    this.state.tree.clear();
    this.state.rootIds = [];
    this.state.queries.clear();
    this.state.eventLog = [];

    this.initialized = false;
    console.log('[StatusAgent] Cleaned up');
  }
}

// =============================================================================
// SINGLETON EXPORTS
// =============================================================================

let managerInstance: StatusAgentManager | null = null;

/**
 * Get the singleton StatusAgentManager instance.
 */
export function getStatusAgentManager(): StatusAgentManager {
  if (!managerInstance) {
    managerInstance = new StatusAgentManager();
  }
  return managerInstance;
}

/**
 * Initialize the Status Agent with the main window.
 */
export function initializeStatusAgent(mainWindow: BrowserWindow): void {
  getStatusAgentManager().initialize(mainWindow);
}

/**
 * Cleanup the Status Agent.
 */
export function cleanupStatusAgent(): void {
  if (managerInstance) {
    managerInstance.cleanup();
    managerInstance = null;
  }
}
