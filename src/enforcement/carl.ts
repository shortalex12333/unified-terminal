/**
 * CARL - Context-Aware Resource Limiter
 *
 * The "hard hat" every worker wears. Monitors token usage and kills
 * agents when they exceed their budget (with grace period if near completion).
 *
 * This is NOT a gate check (Bodyguard's job). This is resource management.
 *
 * Key responsibilities:
 * - Track token usage per agent
 * - Kill agents exceeding budget (unless near completion)
 * - Grant grace period if agent is >=85% complete
 * - Poll all active agents on CRON_INTERVALS.CONTEXT_CHECK_MS
 * - Write all decisions to carl.jsonl ledger
 */

import { EventEmitter } from 'events';
import type { AgentHandle, WardenKillDecision } from './types';
import { TOKEN_THRESHOLDS, GRACE_THRESHOLD, CRON_INTERVALS } from './constants';
import { getLedgerWriter } from '../ledger';

// =============================================================================
// STATE INTERFACE
// =============================================================================

interface CARLState {
  /** Active agents being monitored */
  agents: Map<string, AgentHandle>;
  /** Timer for polling agents */
  pollTimer: NodeJS.Timeout | null;
  /** Last poll timestamp */
  lastCheck: number;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Events emitted by CARL
 */
export interface CARLEvents {
  agentRegistered: (agentId: string) => void;
  agentUnregistered: (agentId: string) => void;
  agentKilled: (agentId: string, reason: string) => void;
  graceGranted: (agentId: string, progress: number) => void;
  tokenUpdate: (agentId: string, tokens: number, percent: number) => void;
}

// =============================================================================
// CARL CLASS
// =============================================================================

/**
 * Context-Aware Resource Limiter
 *
 * Monitors all active agents and enforces token budgets.
 */
export class CARL extends EventEmitter {
  private state: CARLState;
  private projectRoot: string;

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    this.state = {
      agents: new Map(),
      pollTimer: null,
      lastCheck: 0,
    };
  }

  // ===========================================================================
  // AGENT LIFECYCLE
  // ===========================================================================

  /**
   * Register an agent for monitoring.
   * Called when a worker is spawned.
   */
  registerAgent(handle: AgentHandle): void {
    this.state.agents.set(handle.id, handle);
    this.emit('agentRegistered', handle.id);

    // Log registration
    const writer = getLedgerWriter(this.projectRoot);
    writer.writeCARLEntry({
      type: 'AGENT_REGISTERED',
      agentId: handle.id,
      model: handle.model,
      tier: handle.tier,
    });
  }

  /**
   * Unregister an agent from monitoring.
   * Called when a worker exits normally.
   */
  unregisterAgent(agentId: string): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      this.state.agents.delete(agentId);
      this.emit('agentUnregistered', agentId);

      // Log unregistration
      const writer = getLedgerWriter(this.projectRoot);
      writer.writeCARLEntry({
        type: 'AGENT_UNREGISTERED',
        agentId,
        tokensUsed: agent.tokensUsed,
        taskProgress: agent.taskProgress,
      });
    }
  }

  // ===========================================================================
  // TOKEN TRACKING
  // ===========================================================================

  /**
   * Update token count for an agent.
   * Called by worker after each API call.
   */
  updateTokenUsage(agentId: string, tokensUsed: number): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      agent.tokensUsed = tokensUsed;

      const threshold = TOKEN_THRESHOLDS[agent.model] || TOKEN_THRESHOLDS.default;
      const percent = tokensUsed / threshold.effective;

      this.emit('tokenUpdate', agentId, tokensUsed, percent);
    }
  }

  /**
   * Update task progress for an agent.
   * Progress is a value from 0.0 to 1.0.
   */
  updateTaskProgress(agentId: string, progress: number): void {
    const agent = this.state.agents.get(agentId);
    if (agent) {
      agent.taskProgress = Math.min(1.0, Math.max(0.0, progress));
    }
  }

  // ===========================================================================
  // KILL DECISION LOGIC
  // ===========================================================================

  /**
   * Check if an agent should be killed.
   * Returns a decision with reason.
   */
  checkKillDecision(agent: AgentHandle): WardenKillDecision {
    const threshold = TOKEN_THRESHOLDS[agent.model] || TOKEN_THRESHOLDS.default;
    const usageRatio = agent.tokensUsed / threshold.effective;

    // Not over budget
    if (usageRatio < threshold.killAt) {
      return { shouldKill: false };
    }

    // Over budget but near completion - grant grace
    if (agent.taskProgress >= GRACE_THRESHOLD) {
      this.emit('graceGranted', agent.id, agent.taskProgress);
      return {
        shouldKill: false,
        grace: true,
        reason: `Agent at ${(agent.taskProgress * 100).toFixed(0)}% progress, granting grace`,
      };
    }

    // Kill
    return {
      shouldKill: true,
      reason: `Token usage ${(usageRatio * 100).toFixed(0)}% exceeds kill threshold ${(threshold.killAt * 100).toFixed(0)}%`,
    };
  }

  // ===========================================================================
  // POLLING
  // ===========================================================================

  /**
   * Poll all agents and enforce budgets.
   * Called on CRON_INTERVALS.CONTEXT_CHECK_MS interval.
   */
  private pollAgents(): void {
    this.state.lastCheck = Date.now();
    const writer = getLedgerWriter(this.projectRoot);

    for (const [agentId, agent] of Array.from(this.state.agents.entries())) {
      const decision = this.checkKillDecision(agent);

      if (decision.shouldKill) {
        // Write to ledger
        writer.writeCARLEntry({
          type: 'KILL_DECISION',
          agentId,
          reason: decision.reason,
          tokensUsed: agent.tokensUsed,
          taskProgress: agent.taskProgress,
        });

        this.emit('agentKilled', agentId, decision.reason!);

        // Actually kill the process
        if (agent.process && typeof agent.process.kill === 'function') {
          try {
            (agent.process as NodeJS.Process & { kill: (signal?: string) => void }).kill('SIGTERM');
          } catch {
            // Process may already be dead
          }
        }

        this.state.agents.delete(agentId);
      } else if (decision.grace) {
        // Log grace grant
        writer.writeCARLEntry({
          type: 'GRACE_GRANTED',
          agentId,
          reason: decision.reason,
          tokensUsed: agent.tokensUsed,
          taskProgress: agent.taskProgress,
        });
      }
    }
  }

  /**
   * Start polling all agents.
   * Default interval is CRON_INTERVALS.CONTEXT_CHECK_MS (30 seconds).
   */
  startPolling(intervalMs: number = CRON_INTERVALS.CONTEXT_CHECK_MS): void {
    if (this.state.pollTimer) return;

    this.state.pollTimer = setInterval(() => {
      this.pollAgents();
    }, intervalMs);

    console.log(`[CARL] Started polling every ${intervalMs}ms`);
  }

  /**
   * Stop polling.
   */
  stopPolling(): void {
    if (this.state.pollTimer) {
      clearInterval(this.state.pollTimer);
      this.state.pollTimer = null;
      console.log('[CARL] Stopped polling');
    }
  }

  // ===========================================================================
  // STATE ACCESS
  // ===========================================================================

  /**
   * Get current CARL state.
   * Returns a copy to prevent external mutation.
   */
  getState(): Readonly<CARLState> {
    return {
      ...this.state,
      agents: new Map(this.state.agents),
    };
  }

  /**
   * Get a specific agent by ID.
   */
  getAgent(agentId: string): AgentHandle | undefined {
    return this.state.agents.get(agentId);
  }

  /**
   * Get count of active agents.
   */
  getAgentCount(): number {
    return this.state.agents.size;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Clean up all resources.
   * Called on shutdown.
   */
  cleanup(): void {
    this.stopPolling();
    this.state.agents.clear();
    this.removeAllListeners();
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let carlInstance: CARL | null = null;

/**
 * Get or create the CARL instance for a project.
 */
export function getCARL(projectRoot: string): CARL {
  if (!carlInstance) {
    carlInstance = new CARL(projectRoot);
  }
  return carlInstance;
}

/**
 * Reset the CARL instance (for testing).
 */
export function resetCARL(): void {
  if (carlInstance) {
    carlInstance.cleanup();
    carlInstance = null;
  }
}
