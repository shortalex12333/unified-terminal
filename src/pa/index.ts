/**
 * PA (Personal Assistant) Module — Main Entry Point
 *
 * The PA is the orchestration brain that:
 * 1. Reads all sub-spines periodically (pattern detection)
 * 2. Receives user corrections from Status Agent
 * 3. Writes decision files (corrections, skill flags, handovers)
 * 4. Coordinates agent handovers (RED → replacement)
 *
 * KEY PRINCIPLE: PA reads registries, NEVER invents agent identities.
 *
 * Module Structure:
 * - types.ts         - All PA type definitions
 * - spine-reader.ts  - Sub-spine parsing and reading
 * - pattern-detector.ts - Pattern detection logic
 * - decision-writer.ts  - Decision file writing
 * - event-handlers.ts   - Status Agent / Scheduler integration
 */

import { EventEmitter } from 'events';
import { emitEvent, paEvents } from '../main/events';

// Re-export all types
export * from './types';

// Re-export modules
export { parseSubSpineMarkdown, readSubSpineFile, readAllSubSpines, calculateStatus } from './spine-reader';
export { PatternDetector, createPatternDetector } from './pattern-detector';
export { DecisionWriter, createDecisionWriter } from './decision-writer';
export { PAEventHandlers, createPAEventHandlers } from './event-handlers';

// Import for internal use
import type {
  PAConfig,
  PAAgentView,
  SubSpineCheckpoint,
  DetectedPattern,
  PADecision,
  PAState,
} from './types';
import { readAllSubSpines } from './spine-reader';
import { PatternDetector, createPatternDetector } from './pattern-detector';
import { DecisionWriter, createDecisionWriter } from './decision-writer';
import { PAEventHandlers, createPAEventHandlers } from './event-handlers';

// =============================================================================
// PA MANAGER CLASS
// =============================================================================

/**
 * PA Manager — Central orchestration brain.
 *
 * Responsibilities:
 * 1. READ registries to know who's alive
 * 2. POLL sub-spines for status/patterns
 * 3. RECEIVE corrections from Status Agent
 * 4. WRITE decision files (corrections, skill_flags, handovers)
 * 5. EMIT events for other components
 */
export class PAManager extends EventEmitter {
  private config: PAConfig | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  // Sub-modules
  private patternDetector: PatternDetector | null = null;
  private decisionWriter: DecisionWriter | null = null;
  private eventHandlers: PAEventHandlers | null = null;

  // Caches (refreshed on poll)
  private agentCache: Map<string, PAAgentView> = new Map();
  private subSpineCache: Map<string, SubSpineCheckpoint> = new Map();

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize PA with configuration.
   */
  initialize(config: PAConfig): void {
    if (this.initialized) {
      console.warn('[PA] Already initialized');
      return;
    }

    this.config = config;

    // Initialize sub-modules
    this.patternDetector = createPatternDetector();
    this.decisionWriter = createDecisionWriter(config.projectDir);
    this.eventHandlers = createPAEventHandlers(this);

    this.initialized = true;

    // Start polling if enabled
    if (config.pollIntervalMs > 0) {
      this.startPolling();
    }

    console.log('[PA] Initialized', {
      projectDir: config.projectDir,
      domains: config.domains,
      pollIntervalMs: config.pollIntervalMs,
    });
  }

  // ===========================================================================
  // POLLING — Read sub-spines periodically
  // ===========================================================================

  /**
   * Start periodic polling of sub-spines.
   */
  startPolling(): void {
    if (this.pollTimer) {
      return;
    }

    if (!this.config) {
      throw new Error('[PA] Not initialized');
    }

    this.pollTimer = setInterval(() => {
      this.pollSubSpines();
    }, this.config.pollIntervalMs);

    console.log(`[PA] Started polling every ${this.config.pollIntervalMs}ms`);
  }

  /**
   * Stop polling.
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('[PA] Stopped polling');
    }
  }

  /**
   * Poll all sub-spines and detect patterns.
   */
  async pollSubSpines(): Promise<void> {
    if (!this.config || !this.patternDetector || !this.decisionWriter) return;

    try {
      // 1. Refresh agent cache from registry
      await this.refreshAgentCache();

      // 2. Read all sub-spines for alive agents
      const agents = this.getAliveAgents();
      const checkpoints = await readAllSubSpines(agents, this.config);

      // Update cache
      for (const checkpoint of checkpoints) {
        this.subSpineCache.set(checkpoint.agentId, checkpoint);
      }

      // 3. Detect patterns
      const patterns = this.patternDetector.detectPatterns(checkpoints);

      // 4. Act on patterns
      for (const pattern of patterns) {
        await this.actOnPattern(pattern);
      }

      this.emit('poll-complete', { agentCount: checkpoints.length, patternCount: patterns.length });

    } catch (error) {
      console.error('[PA] Poll error:', error);
      this.emit('poll-error', { error });
    }
  }

  // ===========================================================================
  // AGENT CACHE (Registry Integration)
  // ===========================================================================

  /**
   * Refresh agent cache from registry.
   * PA NEVER invents agents — it reads the registry.
   */
  async refreshAgentCache(): Promise<void> {
    // @placeholder — Will integrate with registry.ts
    // const registry = await loadRegistry(this.config.projectDir);
    // for (const agent of Object.values(registry.agents)) {
    //   this.agentCache.set(agent.sessionId, mapToAgentView(agent));
    // }

    console.log('[PA] Agent cache refreshed (placeholder)');
  }

  /**
   * Get agent by session ID.
   */
  getAgent(sessionId: string): PAAgentView | undefined {
    return this.agentCache.get(sessionId);
  }

  /**
   * Get current agent for a role.
   */
  getAgentByRole(role: string): PAAgentView | undefined {
    for (const agent of this.agentCache.values()) {
      if (agent.role === role && agent.status === 'ALIVE') {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Get all alive agents.
   */
  getAliveAgents(): PAAgentView[] {
    return Array.from(this.agentCache.values()).filter(a => a.status === 'ALIVE');
  }

  // ===========================================================================
  // PATTERN ACTIONS
  // ===========================================================================

  /**
   * Act on a detected pattern.
   */
  async actOnPattern(pattern: DetectedPattern): Promise<void> {
    if (!this.decisionWriter) return;

    console.log(`[PA] Acting on pattern:`, pattern.type, pattern.agentId);

    switch (pattern.suggestedAction) {
      case 'INJECT_SKILL':
        if (pattern.skillToInject) {
          await this.decisionWriter.writeSkillFlag(pattern.agentId, pattern.skillToInject);
        }
        break;

      case 'SEND_CORRECTION':
        if (pattern.correctionText) {
          await this.decisionWriter.writeCorrection(pattern.agentId, pattern.correctionText);
        }
        break;

      case 'REASSIGN_TASK':
        const checkpoint = this.subSpineCache.get(pattern.agentId);
        if (checkpoint) {
          await this.decisionWriter.writeHandover(pattern.agentId, checkpoint);
          this.emitHandoverRequired(pattern.agentId);
        }
        break;

      case 'ESCALATE_TO_USER':
        this.emitUserAlert(pattern.description);
        break;
    }
  }

  // ===========================================================================
  // CORRECTION ROUTING (From Status Agent)
  // ===========================================================================

  /**
   * Route a user correction to the appropriate agent.
   * Called by event handlers after keyword classification.
   */
  async routeCorrection(
    correctionText: string,
    targetAgentId: string | null,
    confidence: 'high' | 'medium' | 'low'
  ): Promise<void> {
    if (!this.decisionWriter) return;

    // If no target or low confidence, we need help
    if (!targetAgentId || confidence === 'low') {
      emitEvent('pa', 'correction-needs-resolution', {
        text: correctionText,
        suggestedTarget: targetAgentId,
        confidence,
      });
      return;
    }

    // Verify agent exists and is alive
    let agent = this.getAgent(targetAgentId);
    if (!agent || agent.status !== 'ALIVE') {
      console.warn(`[PA] Target agent not alive: ${targetAgentId}`);

      // Try to find replacement by role
      if (agent) {
        const replacement = this.getAgentByRole(agent.role);
        if (replacement) {
          targetAgentId = replacement.sessionId;
        } else {
          emitEvent('pa', 'correction-failed', {
            reason: 'No alive agent for role',
            role: agent.role,
          });
          return;
        }
      }
    }

    // Write correction file
    await this.decisionWriter.writeCorrection(targetAgentId, correctionText);
    paEvents.interruptRouted(targetAgentId, correctionText);
  }

  /**
   * Write a correction directly (for pattern-triggered corrections).
   */
  async writeCorrection(agentId: string, text: string): Promise<void> {
    if (!this.decisionWriter) return;
    await this.decisionWriter.writeCorrection(agentId, text);
  }

  // ===========================================================================
  // EVENT EMISSIONS
  // ===========================================================================

  /**
   * Emit handover required event for orchestrator.
   */
  private emitHandoverRequired(agentId: string): void {
    const agent = this.getAgent(agentId);
    emitEvent('pa', 'handover-required', {
      agentId,
      handoverFile: `{{ HANDOVERS_DIR }}/${agentId}_handover.md`,
      role: agent?.role,
      domain: agent?.domain,
    });
  }

  /**
   * Emit user alert event.
   */
  private emitUserAlert(message: string): void {
    emitEvent('pa', 'user-alert', { message, timestamp: Date.now() });
  }

  // ===========================================================================
  // ACCESSORS
  // ===========================================================================

  /**
   * Get recent decisions from decision writer.
   */
  getRecentDecisions(count: number = 10): PADecision[] {
    return this.decisionWriter?.getRecentDecisions(count) || [];
  }

  /**
   * Get checkpoint for an agent.
   */
  getCheckpoint(agentId: string): SubSpineCheckpoint | undefined {
    return this.subSpineCache.get(agentId);
  }

  /**
   * Check if PA is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Cleanup PA resources.
   */
  cleanup(): void {
    this.stopPolling();

    if (this.eventHandlers) {
      this.eventHandlers.unsubscribeAll();
    }

    this.agentCache.clear();
    this.subSpineCache.clear();
    this.patternDetector = null;
    this.decisionWriter = null;
    this.eventHandlers = null;
    this.initialized = false;

    console.log('[PA] Cleaned up');
  }
}

// =============================================================================
// SINGLETON EXPORTS
// =============================================================================

let paInstance: PAManager | null = null;

/**
 * Get the PA manager instance.
 */
export function getPA(): PAManager {
  if (!paInstance) {
    paInstance = new PAManager();
  }
  return paInstance;
}

/**
 * Initialize the PA with configuration.
 */
export function initializePA(config: PAConfig): void {
  getPA().initialize(config);
}

/**
 * Cleanup the PA and reset singleton.
 */
export function cleanupPA(): void {
  if (paInstance) {
    paInstance.cleanup();
    paInstance = null;
  }
}

/**
 * Reset PA singleton (for testing).
 */
export function resetPA(): void {
  cleanupPA();
}
