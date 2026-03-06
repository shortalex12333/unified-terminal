/**
 * PA Event Integration Module
 *
 * Handles events from Status Agent and Scheduler, and emits PA events.
 * Acts as the bridge between the event bus and PAManager operations.
 *
 * Event flow:
 * - Status Agent emits 'pa:query-response-routed' -> handleQueryResponseRouted
 * - Conductor emits 'conductor:resolve-correction' -> handleResolveCorrection
 * - Scheduler emits 'scheduler:step-start/done/failed' -> handle agent lifecycle
 *
 * PA responds by:
 * - Logging routed responses for audit
 * - Emitting 'pa:correction-needs-resolution' for LLM routing
 * - Tracking agent lifecycle for cache refresh
 * - Emitting 'pa:handover-required' for orchestrator
 * - Emitting 'pa:user-alert' for UI notifications
 */

import { systemEvents, emitEvent, paEvents } from '../main/events';
import type { StatusEvent } from '../status-agent/types';
import type { PAManager, PAAgentView } from './index';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Event detail for query response routed.
 */
interface QueryResponseRoutedDetail {
  target: string;
  payload: unknown;
  queryId?: string;
}

/**
 * Event detail for resolve correction.
 */
interface ResolveCorrectionDetail {
  text: string;
  suggestedTarget?: string;
  confidence: 'high' | 'medium' | 'low';
  context?: Record<string, unknown>;
}

/**
 * Event detail for scheduler step events.
 */
interface SchedulerStepDetail {
  stepId: number | string;
  action?: string;
  error?: string;
  retryCount?: number;
  agentId?: string;
  role?: string;
}

/**
 * Confidence level for correction routing.
 */
type ConfidenceLevel = 'high' | 'medium' | 'low';

// =============================================================================
// PA EVENT HANDLERS CLASS
// =============================================================================

/**
 * PAEventHandlers — Bridges event bus to PA operations.
 *
 * Subscribes to relevant system events and translates them into
 * PA operations (corrections, handovers, alerts).
 */
export class PAEventHandlers {
  /** Reference to the PAManager instance */
  private pa: PAManager;

  /** Unsubscribe functions for cleanup */
  private unsubscribers: (() => void)[] = [];

  /** Track recent failures per agent for pattern detection */
  private failureHistory: Map<string, { count: number; lastError: string; timestamp: number }> = new Map();

  /** Failure pattern threshold */
  private static readonly FAILURE_PATTERN_THRESHOLD = 3;

  /** Failure pattern window (ms) */
  private static readonly FAILURE_PATTERN_WINDOW_MS = 60000; // 1 minute

  constructor(pa: PAManager) {
    this.pa = pa;
  }

  // ===========================================================================
  // SUBSCRIPTION
  // ===========================================================================

  /**
   * Subscribe to all relevant system events.
   * Call this after PA is initialized.
   */
  subscribe(): void {
    // Unsubscribe any existing subscriptions first
    this.unsubscribeAll();

    // Subscribe to PA events
    this.unsubscribers.push(
      systemEvents.onStatus('pa', 'query-response-routed', (event) => {
        this.handleQueryResponseRouted(event);
      })
    );

    // Subscribe to conductor events
    this.unsubscribers.push(
      systemEvents.onStatus('conductor', 'resolve-correction', (event) => {
        this.handleResolveCorrection(event);
      })
    );

    // Subscribe to scheduler events
    this.unsubscribers.push(
      systemEvents.onStatus('scheduler', 'step-start', (event) => {
        this.handleAgentSpawn(event);
      })
    );

    this.unsubscribers.push(
      systemEvents.onStatus('scheduler', 'step-done', (event) => {
        this.handleAgentComplete(event);
      })
    );

    this.unsubscribers.push(
      systemEvents.onStatus('scheduler', 'step-failed', (event) => {
        this.handleAgentFailed(event);
      })
    );

    console.log('[PAEventHandlers] Subscribed to 5 event types');
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle a routed query response.
   * Logs the routed response for audit purposes.
   */
  handleQueryResponseRouted(event: StatusEvent): void {
    try {
      const detail = this.parseEventDetail<QueryResponseRoutedDetail>(event.detail);

      console.log('[PAEventHandlers] Query response routed:', {
        target: detail.target,
        queryId: detail.queryId,
      });

      // The response has already been routed by Status Agent
      // PA just logs this for audit trail
      // The PAManager will handle actual logging via its logDecision method

    } catch (error) {
      console.error('[PAEventHandlers] Failed to handle query response routed:', error);
    }
  }

  /**
   * Handle correction that needs LLM resolution.
   * Emits to conductor for intelligent routing.
   */
  handleResolveCorrection(event: StatusEvent): void {
    try {
      const detail = this.parseEventDetail<ResolveCorrectionDetail>(event.detail);

      console.log('[PAEventHandlers] Resolve correction request:', {
        suggestedTarget: detail.suggestedTarget,
        confidence: detail.confidence,
      });

      // Correction needs LLM resolution - emit to conductor
      emitEvent('pa', 'correction-needs-resolution', {
        text: detail.text,
        suggestedTarget: detail.suggestedTarget,
        confidence: detail.confidence,
        context: detail.context,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[PAEventHandlers] Failed to handle resolve correction:', error);
    }
  }

  /**
   * Handle agent spawn event.
   * Notes new agent for cache refresh on next poll.
   */
  handleAgentSpawn(event: StatusEvent): void {
    try {
      const detail = this.parseEventDetail<SchedulerStepDetail>(event.detail);

      console.log('[PAEventHandlers] Agent spawned:', {
        stepId: detail.stepId,
        action: detail.action,
      });

      // Clear any failure history for this step/agent
      const agentKey = this.getAgentKey(detail);
      if (agentKey) {
        this.failureHistory.delete(agentKey);
      }

      // Agent cache will be refreshed on next poll cycle
      // PAManager handles the actual cache refresh

    } catch (error) {
      console.error('[PAEventHandlers] Failed to handle agent spawn:', error);
    }
  }

  /**
   * Handle agent completion event.
   * Notes completion for tracking.
   */
  handleAgentComplete(event: StatusEvent): void {
    try {
      const detail = this.parseEventDetail<SchedulerStepDetail>(event.detail);

      console.log('[PAEventHandlers] Agent completed:', {
        stepId: detail.stepId,
        action: detail.action,
      });

      // Clear failure history on successful completion
      const agentKey = this.getAgentKey(detail);
      if (agentKey) {
        this.failureHistory.delete(agentKey);
      }

    } catch (error) {
      console.error('[PAEventHandlers] Failed to handle agent complete:', error);
    }
  }

  /**
   * Handle agent failure event.
   * Notes failure and checks for repeated failure patterns.
   */
  handleAgentFailed(event: StatusEvent): void {
    try {
      const detail = this.parseEventDetail<SchedulerStepDetail>(event.detail);

      console.log('[PAEventHandlers] Agent failed:', {
        stepId: detail.stepId,
        action: detail.action,
        error: detail.error,
        retryCount: detail.retryCount,
      });

      // Track failure for pattern detection
      const agentKey = this.getAgentKey(detail);
      if (agentKey) {
        this.trackFailure(agentKey, detail.error || 'Unknown error');

        // Check for failure pattern
        const pattern = this.checkFailurePattern(agentKey);
        if (pattern) {
          console.log('[PAEventHandlers] Failure pattern detected:', pattern);

          // Alert user about repeated failures
          this.emitUserAlert(
            `Agent ${agentKey} has failed ${pattern.count} times in the last minute. ` +
            `Last error: ${pattern.lastError}`
          );
        }
      }

    } catch (error) {
      console.error('[PAEventHandlers] Failed to handle agent failed:', error);
    }
  }

  // ===========================================================================
  // CORRECTION ROUTING
  // ===========================================================================

  /**
   * Route a correction to the appropriate agent.
   * Main entry point for correction routing logic.
   *
   * @param text - Correction text to route
   * @param targetAgentId - Suggested target agent (or null if unknown)
   * @param confidence - Confidence level of the target identification
   */
  async routeCorrection(
    text: string,
    targetAgentId: string | null,
    confidence: ConfidenceLevel
  ): Promise<void> {
    // If low confidence or no target, needs resolution
    if (!targetAgentId || confidence === 'low') {
      emitEvent('pa', 'correction-needs-resolution', {
        text,
        suggestedTarget: targetAgentId,
        confidence,
        reason: !targetAgentId ? 'no_target' : 'low_confidence',
      });
      return;
    }

    // Verify agent is alive via registry
    const agent = this.pa.getAgent(targetAgentId);

    if (!agent || agent.status !== 'ALIVE') {
      console.warn(`[PAEventHandlers] Target agent not alive: ${targetAgentId}`);

      // Try to find replacement by role
      if (agent) {
        const replacement = this.pa.getAgentByRole(agent.role);

        if (replacement) {
          console.log(`[PAEventHandlers] Found replacement: ${replacement.sessionId}`);
          targetAgentId = replacement.sessionId;
        } else {
          // No replacement available
          emitEvent('pa', 'correction-failed', {
            text,
            originalTarget: targetAgentId,
            reason: 'no_replacement',
            role: agent.role,
          });
          return;
        }
      } else {
        // Agent not found at all
        emitEvent('pa', 'correction-failed', {
          text,
          originalTarget: targetAgentId,
          reason: 'agent_not_found',
        });
        return;
      }
    }

    // Write correction via PA's decision writer
    await this.pa.writeCorrection(targetAgentId, text);

    console.log(`[PAEventHandlers] Correction routed to ${targetAgentId}`);
  }

  // ===========================================================================
  // EMISSION HELPERS
  // ===========================================================================

  /**
   * Emit handover required event for orchestrator.
   * Called when an agent needs to be replaced (RED status, etc.).
   *
   * @param agentId - ID of agent requiring handover
   * @param handoverFile - Path to handover file
   * @param role - Role the replacement agent should fill
   */
  emitHandoverRequired(agentId: string, handoverFile: string, role?: string): void {
    emitEvent('pa', 'handover-required', {
      agentId,
      handoverFile,
      role,
      timestamp: Date.now(),
    });

    console.log(`[PAEventHandlers] Handover required for ${agentId} (role: ${role})`);
  }

  /**
   * Emit user alert for UI display.
   * Used for important notifications that require user attention.
   *
   * @param message - Alert message to display
   */
  emitUserAlert(message: string): void {
    emitEvent('pa', 'user-alert', {
      message,
      timestamp: Date.now(),
      severity: 'warning',
    });

    console.log(`[PAEventHandlers] User alert: ${message}`);
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Unsubscribe from all events.
   * Call this when PA is being shut down.
   */
  unsubscribeAll(): void {
    for (const unsubscribe of this.unsubscribers) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[PAEventHandlers] Error during unsubscribe:', error);
      }
    }

    this.unsubscribers = [];
    this.failureHistory.clear();

    console.log('[PAEventHandlers] Unsubscribed from all events');
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Parse event detail from string or object.
   */
  private parseEventDetail<T>(detail: string | Record<string, unknown>): T {
    if (typeof detail === 'string') {
      return JSON.parse(detail) as T;
    }
    return detail as T;
  }

  /**
   * Get a consistent key for an agent from step detail.
   */
  private getAgentKey(detail: SchedulerStepDetail): string | null {
    // Prefer agentId, fall back to stepId
    if (detail.agentId) {
      return detail.agentId;
    }
    if (detail.stepId !== undefined) {
      return `step-${detail.stepId}`;
    }
    return null;
  }

  /**
   * Track a failure for pattern detection.
   */
  private trackFailure(agentKey: string, error: string): void {
    const now = Date.now();
    const existing = this.failureHistory.get(agentKey);

    if (existing && (now - existing.timestamp) < PAEventHandlers.FAILURE_PATTERN_WINDOW_MS) {
      // Within window, increment count
      existing.count++;
      existing.lastError = error;
      existing.timestamp = now;
    } else {
      // Outside window or first failure, reset
      this.failureHistory.set(agentKey, {
        count: 1,
        lastError: error,
        timestamp: now,
      });
    }
  }

  /**
   * Check if there's a failure pattern for an agent.
   * Returns pattern info if threshold exceeded, null otherwise.
   */
  private checkFailurePattern(agentKey: string): { count: number; lastError: string } | null {
    const history = this.failureHistory.get(agentKey);

    if (history && history.count >= PAEventHandlers.FAILURE_PATTERN_THRESHOLD) {
      return {
        count: history.count,
        lastError: history.lastError,
      };
    }

    return null;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create and initialize PAEventHandlers for a PAManager instance.
 *
 * @param pa - The PAManager instance to bind to
 * @returns Initialized PAEventHandlers instance
 */
export function createPAEventHandlers(pa: PAManager): PAEventHandlers {
  const handlers = new PAEventHandlers(pa);
  handlers.subscribe();
  return handlers;
}
