/**
 * System Event Bus
 *
 * Centralized event emitter for all backend components.
 * The Status Agent subscribes to this bus to translate events
 * into user-facing status lines.
 *
 * Event key format: "source:type" (e.g., "conductor:classify", "worker:spawn")
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { KENOKI_HIDDEN } from './project-scaffold';

// Re-export StatusEvent type for convenience
export type { StatusEvent } from '../status-agent/types';
import type { StatusEvent, EventSource } from '../status-agent/types';

// =============================================================================
// PROJECT TRACKING
// =============================================================================

/**
 * Current project ID for status file writing.
 * Set by file-bridge when a project starts.
 */
let currentProjectId: string | null = null;

/**
 * Set the current project ID for status file writing.
 */
export function setCurrentProject(projectId: string | null): void {
  currentProjectId = projectId;
}

/**
 * Write status update to agent status file.
 * Merges with existing status if file exists.
 */
function writeStatusFile(sessionId: string, status: Record<string, unknown>): void {
  if (!currentProjectId) return;

  const statusDir = path.join(KENOKI_HIDDEN, currentProjectId, 'status');
  const statusFile = path.join(statusDir, `agent_${sessionId}.json`);

  try {
    // Ensure directory exists
    fs.mkdirSync(statusDir, { recursive: true });

    // Merge with existing status if it exists
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(statusFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      } catch {
        // Ignore parse errors, start fresh
      }
    }

    const merged = { ...existing, ...status, updated_at: new Date().toISOString() };
    fs.writeFileSync(statusFile, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error('[events] Failed to write status file:', err);
  }
}

// =============================================================================
// EVENT BUS SINGLETON
// =============================================================================

/**
 * Central event bus for all system events.
 * Status Agent subscribes to this for user-facing translation.
 */
class SystemEventBus extends EventEmitter {
  private static instance: SystemEventBus;

  private constructor() {
    super();
    // Allow many listeners (each status line may subscribe)
    this.setMaxListeners(100);
  }

  static getInstance(): SystemEventBus {
    if (!SystemEventBus.instance) {
      SystemEventBus.instance = new SystemEventBus();
    }
    return SystemEventBus.instance;
  }

  /**
   * Emit a typed status event.
   * This is the primary way backend components communicate with Status Agent.
   */
  emitStatus(event: StatusEvent): void {
    const key = `${event.source}:${event.type}`;
    this.emit(key, event);
    this.emit('*', event); // Wildcard for catch-all listeners
  }

  /**
   * Subscribe to a specific event type.
   * @param source - Event source (e.g., 'conductor', 'worker')
   * @param type - Event type (e.g., 'classify', 'spawn')
   * @param handler - Callback function
   */
  onStatus(
    source: EventSource | string,
    type: string,
    handler: (event: StatusEvent) => void
  ): () => void {
    const key = `${source}:${type}`;
    this.on(key, handler);
    return () => this.off(key, handler);
  }

  /**
   * Subscribe to all events from a source.
   * @param source - Event source
   * @param handler - Callback function
   */
  onSource(
    source: EventSource | string,
    handler: (event: StatusEvent) => void
  ): () => void {
    const wrappedHandler = (event: StatusEvent) => {
      if (event.source === source) {
        handler(event);
      }
    };
    this.on('*', wrappedHandler);
    return () => this.off('*', wrappedHandler);
  }

  /**
   * Subscribe to all events (wildcard).
   * @param handler - Callback function
   */
  onAll(handler: (event: StatusEvent) => void): () => void {
    this.on('*', handler);
    return () => this.off('*', handler);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * The global system event bus instance.
 */
export const systemEvents = SystemEventBus.getInstance();

/**
 * Convenience function to emit a status event.
 * Backend components should use this to notify Status Agent of state changes.
 *
 * @example
 * emit({
 *   source: 'conductor',
 *   type: 'classify',
 *   detail: JSON.stringify({ message: 'Building a React app' }),
 *   timestamp: Date.now()
 * });
 */
export function emit(event: StatusEvent): void {
  systemEvents.emitStatus(event);
}

/**
 * Helper to create and emit an event in one call.
 */
export function emitEvent(
  source: EventSource | string,
  type: string,
  detail: Record<string, unknown> | string = {}
): void {
  emit({
    source,
    type,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    timestamp: Date.now(),
  });
}

// =============================================================================
// TYPE-SAFE EMITTERS PER SOURCE
// =============================================================================

/**
 * Type-safe emitters for specific sources.
 * These provide autocomplete for common event types.
 */

export const conductorEvents = {
  /** Emitted when classification starts */
  classifyStart: (message: string) =>
    emitEvent('conductor', 'classify-start', { message }),

  /** Emitted when classification completes with a plan */
  classifyComplete: (planId: string, stepCount: number) =>
    emitEvent('conductor', 'classify-complete', { planId, stepCount }),

  /** Emitted when a plan is ready for execution */
  planReady: (planId: string, summary: string) =>
    emitEvent('conductor', 'plan-ready', { planId, summary }),

  /** Emitted when re-planning is requested */
  replan: (reason: string, failedStepId: number) =>
    emitEvent('conductor', 'replan', { reason, failedStepId }),

  /** Emitted when session is created or resumed */
  sessionStart: (sessionId: string, isResume: boolean) =>
    emitEvent('conductor', 'session-start', { sessionId, isResume }),

  /** Emitted on error */
  error: (error: string) =>
    emitEvent('conductor', 'error', { error }),
};

export const schedulerEvents = {
  /** Emitted when plan execution starts */
  planStart: (planId: string, stepCount: number) => {
    emitEvent('scheduler', 'plan-start', { planId, stepCount });
    writeStatusFile(planId, {
      status: 'GREEN',
      phase: 'planning',
      total_steps: stepCount,
    });
  },

  /** Emitted when a step begins */
  stepStart: (stepId: number, action: string, detail: string) => {
    emitEvent('scheduler', 'step-start', { stepId, action, detail });
    writeStatusFile(String(stepId), {
      status: 'GREEN',
      current_task: action,
      detail,
    });
  },

  /** Emitted during step progress */
  stepProgress: (stepId: number, progress: number, activity: string) => {
    emitEvent('scheduler', 'step-progress', { stepId, progress, activity });
    // Status changes to AMBER when progress > 70%
    const status = progress > 70 ? 'AMBER' : 'GREEN';
    writeStatusFile(String(stepId), {
      status,
      progress,
      current_task: activity,
    });
  },

  /** Emitted when a step completes successfully */
  stepDone: (stepId: number, action: string) => {
    emitEvent('scheduler', 'step-done', { stepId, action });
    writeStatusFile(String(stepId), {
      status: 'RED', // RED = done (traffic light metaphor)
      current_task: `Completed: ${action}`,
    });
  },

  /** Emitted when a step fails */
  stepFailed: (stepId: number, action: string, error: string, retryCount: number) => {
    emitEvent('scheduler', 'step-failed', { stepId, action, error, retryCount });
    writeStatusFile(String(stepId), {
      status: 'ERROR',
      current_task: action,
      error,
      retryCount,
    });
  },

  /** Emitted when a step is skipped */
  stepSkipped: (stepId: number, reason: string) => {
    emitEvent('scheduler', 'step-skipped', { stepId, reason });
    writeStatusFile(String(stepId), {
      status: 'SKIPPED',
      reason,
    });
  },

  /** Emitted when circuit breaker triggers (needs user decision) */
  needsUser: (stepId: number, options: string[]) => {
    emitEvent('scheduler', 'needs-user', { stepId, options });
    writeStatusFile(String(stepId), {
      status: 'WAITING_USER',
      options,
    });
  },

  /** Emitted when plan completes */
  planComplete: (planId: string, success: boolean, summary: { done: number; failed: number; skipped: number }) => {
    emitEvent('scheduler', 'plan-complete', { planId, success, ...summary });
    writeStatusFile(planId, {
      status: success ? 'COMPLETE' : 'FAILED',
      done: summary.done,
      failed: summary.failed,
      skipped: summary.skipped,
    });
  },
};

export const workerEvents = {
  /** Emitted when CLI process spawns */
  spawn: (stepId: string, action: string, projectDir: string) => {
    emitEvent('worker', 'spawn', { stepId, action, projectDir });
    writeStatusFile(stepId, {
      status: 'SPAWNED',
      action,
      project_dir: projectDir,
    });
  },

  /** Emitted when a file is created */
  fileCreated: (path: string) => {
    emitEvent('worker', 'file-created', { path });
    // File tracking can be handled by file-bridge chokidar watcher
  },

  /** Emitted when a file is modified */
  fileModified: (path: string) => {
    emitEvent('worker', 'file-modified', { path });
    // File tracking can be handled by file-bridge chokidar watcher
  },

  /** Emitted when CLI process completes */
  complete: (stepId: string, success: boolean, filesCreated: number, filesModified: number) => {
    emitEvent('worker', 'complete', { stepId, success, filesCreated, filesModified });
    writeStatusFile(stepId, {
      status: success ? 'COMPLETE' : 'FAILED',
      files_created: filesCreated,
      files_modified: filesModified,
    });
  },

  /** Emitted on CLI execution error */
  error: (stepId: string, error: string) => {
    emitEvent('worker', 'error', { stepId, error });
    writeStatusFile(stepId, {
      status: 'ERROR',
      error,
    });
  },

  /** Emitted when CLI process times out */
  timeout: (stepId: string, timeoutMs: number) => {
    emitEvent('worker', 'timeout', { stepId, timeoutMs });
    writeStatusFile(stepId, {
      status: 'TIMEOUT',
      timeout_ms: timeoutMs,
    });
  },
};

export const bodyguardEvents = {
  /** Emitted when checking a step */
  checking: (stepId: string | number, checkType: string) =>
    emitEvent('bodyguard', 'checking', { stepId, checkType }),

  /** Emitted when gate check starts */
  gateStart: (stepId: string | number, checkCount: number) =>
    emitEvent('bodyguard', 'gate-start', { stepId, checkCount }),

  /** Emitted when individual check completes */
  checkComplete: (checkName: string, passed: boolean) =>
    emitEvent('bodyguard', 'check-complete', { checkName, passed }),

  /** Emitted when a step passes validation */
  pass: (stepId: string | number) =>
    emitEvent('bodyguard', 'pass', { stepId }),

  /** Emitted when a step fails */
  fail: (stepId: string | number, reason: string) =>
    emitEvent('bodyguard', 'fail', { stepId, reason }),

  /** Emitted when a step fails heuristic check (can continue) */
  failHeuristic: (stepId: string | number, reason: string) =>
    emitEvent('bodyguard', 'fail-heuristic', { stepId, reason }),

  /** Emitted when a step fails definitive check (must stop) */
  failDefinitive: (stepId: string | number, reason: string) =>
    emitEvent('bodyguard', 'fail-definitive', { stepId, reason }),
};

export const rateLimitEvents = {
  /** Emitted when rate limit is hit */
  hit: (provider: string, retryAfterMs: number) =>
    emitEvent('rate-limit', 'hit', { provider, retryAfterMs }),

  /** Emitted when deferring work due to rate limit */
  deferred: (taskId: string, resumeAt: string) =>
    emitEvent('rate-limit', 'deferred', { taskId, resumeAt }),

  /** Emitted when resuming after rate limit window */
  resumed: (taskId: string) =>
    emitEvent('rate-limit', 'resumed', { taskId }),
};

export const imageGenEvents = {
  /** Emitted when starting image generation */
  start: (prompt: string) =>
    emitEvent('image-gen', 'start', { prompt }),

  /** Emitted during generation */
  progress: (percent: number) =>
    emitEvent('image-gen', 'progress', { percent }),

  /** Emitted when image is ready */
  complete: (url: string) =>
    emitEvent('image-gen', 'complete', { url }),

  /** Emitted on error */
  error: (error: string) =>
    emitEvent('image-gen', 'error', { error }),
};

export const deployEvents = {
  /** Emitted when deploy starts */
  start: (target: string) =>
    emitEvent('deploy', 'start', { target }),

  /** Emitted during deploy */
  progress: (stage: string, percent: number) =>
    emitEvent('deploy', 'progress', { stage, percent }),

  /** Emitted when deploy completes */
  complete: (url: string) =>
    emitEvent('deploy', 'complete', { url }),

  /** Emitted on deploy error */
  error: (error: string) =>
    emitEvent('deploy', 'error', { error }),
};

export const gitEvents = {
  /** Emitted when git operation starts */
  start: (operation: string) =>
    emitEvent('git', 'start', { operation }),

  /** Emitted when git operation completes */
  complete: (operation: string) =>
    emitEvent('git', 'complete', { operation }),

  /** Emitted for commit */
  commit: (message: string, hash: string) =>
    emitEvent('git', 'commit', { message, hash }),

  /** Emitted for push */
  push: (branch: string, remote: string) =>
    emitEvent('git', 'push', { branch, remote }),
};

export const paEvents = {
  /** Emitted when query is sent to user */
  querySent: (queryId: string, question: string) =>
    emitEvent('pa', 'query-sent', { queryId, question }),

  /** Emitted when user responds to query */
  queryResponse: (queryId: string, response: string) =>
    emitEvent('pa', 'query-response', { queryId, response }),

  /** Emitted when query times out */
  queryTimeout: (queryId: string) =>
    emitEvent('pa', 'query-timeout', { queryId }),

  /** Emitted when routing interrupt */
  interruptRouted: (targetAgent: string, correction: string) =>
    emitEvent('pa', 'interrupt-routed', { targetAgent, correction }),
};

export const spineEvents = {
  /** Emitted when spine refresh completes */
  refreshed: (totalFiles: number) =>
    emitEvent('spine', 'refreshed', { totalFiles }),

  /** Emitted when spine comparison completes */
  compared: (filesAdded: number, filesModified: number) =>
    emitEvent('spine', 'compared', { filesAdded, filesModified }),

  /** Emitted when Bodyguard passes work to Spine for review and recording */
  workAccepted: (data: {
    stepId: string;
    workOutput: import('../worker/work-output').WorkOutput;
    verdict: import('../enforcement/types').BodyguardVerdict;
    acceptedAt: string;
  }) =>
    emitEvent('spine', 'work-accepted', data),

  /** Emitted when Spine completes review with "what's next" recommendations */
  reviewed: (review: import('../ledger/types').SpineReviewPayload) =>
    emitEvent('spine', 'reviewed', review as unknown as Record<string, unknown>),
};

export const enforcerEvents = {
  /** Emitted when a check is run */
  checkRun: (checkName: string, exitCode: number, durationMs: number) =>
    emitEvent('enforcer', 'check-run', { checkName, exitCode, durationMs }),
};

export const checkpointEvents = {
  /** Emitted when a checkpoint query is sent to user */
  querySent: (queryId: string, checkpointName: string, priority: string) =>
    emitEvent('checkpoint', 'query-sent', { queryId, checkpointName, priority }),

  /** Emitted when user responds to checkpoint */
  response: (checkpointName: string, value: string, proceed: boolean) =>
    emitEvent('checkpoint', 'response', { checkpointName, value, proceed }),

  /** Emitted when checkpoint times out */
  timeout: (checkpointName: string, queryId: string) =>
    emitEvent('checkpoint', 'timeout', { checkpointName, queryId }),

  /** Emitted when waiting for plan review */
  planReviewWaiting: (planId: string) =>
    emitEvent('checkpoint', 'plan-review-waiting', { planId }),

  /** Emitted when waiting for first output review */
  firstOutputWaiting: (stepId: number) =>
    emitEvent('checkpoint', 'first-output-waiting', { stepId }),

  /** Emitted when waiting for deploy approval */
  preDeployWaiting: (stepId: number, target: string) =>
    emitEvent('checkpoint', 'pre-deploy-waiting', { stepId, target }),

  /** Emitted for progress check (non-blocking) */
  progressCheck: (stepsCompleted: number, totalSteps: number) =>
    emitEvent('checkpoint', 'progress-check', { stepsCompleted, totalSteps }),
};
