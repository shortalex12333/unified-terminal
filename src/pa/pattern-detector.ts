/**
 * PA Pattern Detector Module
 *
 * Analyzes sub-spine checkpoints to detect patterns requiring PA intervention.
 * Patterns include: repeated errors, stuck agents, blocked tasks, token critical status.
 *
 * The detector maintains per-agent history to identify recurring issues and
 * suggests appropriate remediation actions (skill injection, corrections, handovers).
 */

import {
  SubSpineCheckpoint,
  DetectedPattern,
  PatternType,
  SuggestedAction,
  CheckpointStatus,
} from './types';

// =============================================================================
// Constants
// =============================================================================

/** Keywords indicating errors in checkpoint content */
const ERROR_KEYWORDS = ['error', 'failed', 'exception', 'cannot', 'unable'] as const;

/** Number of checkpoint history entries to maintain per agent */
const ERROR_HISTORY_SIZE = 5;

/** Number of repeated errors before triggering REPEATED_ERROR pattern */
const REPEATED_ERROR_THRESHOLD = 3;

/** Skill mapping for error patterns */
const SKILL_MAP: Record<string, string> = {
  // CSS/Style related
  css: 'workers/tailwind-guide.md',
  style: 'workers/tailwind-guide.md',
  tailwind: 'workers/tailwind-guide.md',

  // TypeScript related
  typescript: 'workers/typescript-strict.md',
  type: 'workers/typescript-strict.md',

  // Testing related
  test: 'workers/tdd-guide.md',
  jest: 'workers/tdd-guide.md',

  // Database related
  database: 'workers/supabase-guide.md',
  supabase: 'workers/supabase-guide.md',

  // API related
  api: 'workers/api-design.md',

  // Security related
  security: 'verification/security-reviewer.md',
};

// =============================================================================
// PatternDetector Class
// =============================================================================

/**
 * PatternDetector analyzes sub-spine checkpoints to detect patterns requiring action.
 *
 * Maintains:
 * - errorHistory: Last N error patterns per agent for repeated error detection
 * - prevCheckpoints: Previous checkpoint per agent for stuck detection
 */
export class PatternDetector {
  /**
   * Track last N error patterns per agent.
   * Key: agentId, Value: array of error pattern strings
   */
  private errorHistory: Map<string, string[]> = new Map();

  /**
   * Track previous checkpoints per agent for stuck detection.
   * Key: agentId, Value: previous SubSpineCheckpoint
   */
  private prevCheckpoints: Map<string, SubSpineCheckpoint> = new Map();

  // ===========================================================================
  // Main Entry Point
  // ===========================================================================

  /**
   * Analyze all checkpoints and return detected patterns.
   *
   * @param checkpoints - Array of sub-spine checkpoints to analyze
   * @returns Array of detected patterns requiring action
   */
  detectPatterns(checkpoints: SubSpineCheckpoint[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const checkpoint of checkpoints) {
      // Get previous checkpoint for this agent (if any)
      const prevCheckpoint = this.prevCheckpoints.get(checkpoint.agentId);

      // Detect repeated errors
      const repeatedError = this.detectRepeatedError(checkpoint);
      if (repeatedError) {
        patterns.push(repeatedError);
      }

      // Detect stuck agent (same in-progress items)
      const stuck = this.detectStuck(checkpoint, prevCheckpoint);
      if (stuck) {
        patterns.push(stuck);
      }

      // Detect blocked items
      const blocked = this.detectBlocked(checkpoint);
      if (blocked) {
        patterns.push(blocked);
      }

      // Detect token critical (RED status)
      const tokenCritical = this.detectTokenCritical(checkpoint);
      if (tokenCritical) {
        patterns.push(tokenCritical);
      }

      // Update previous checkpoint for next detection cycle
      this.prevCheckpoints.set(checkpoint.agentId, checkpoint);
    }

    return patterns;
  }

  // ===========================================================================
  // Pattern Detection Methods
  // ===========================================================================

  /**
   * Detect repeated error pattern.
   *
   * Looks for error keywords in checkpoint content. If the same error pattern
   * appears 3+ times in history, returns a REPEATED_ERROR pattern.
   *
   * If a relevant skill can be suggested based on error keywords,
   * suggests INJECT_SKILL action. Otherwise suggests SEND_CORRECTION.
   *
   * @param checkpoint - Current checkpoint to analyze
   * @returns DetectedPattern if repeated error found, null otherwise
   */
  detectRepeatedError(checkpoint: SubSpineCheckpoint): DetectedPattern | null {
    const lowerContent = checkpoint.rawContent.toLowerCase();

    // Find error keywords present in content
    const foundErrors = ERROR_KEYWORDS.filter((kw) => lowerContent.includes(kw));

    if (foundErrors.length === 0) {
      return null;
    }

    // Create error pattern signature
    const errorPattern = foundErrors.sort().join(',');

    // Get or initialize error history for this agent
    let history = this.errorHistory.get(checkpoint.agentId);
    if (!history) {
      history = [];
      this.errorHistory.set(checkpoint.agentId, history);
    }

    // Add current error pattern to history
    history.push(errorPattern);

    // Maintain history size limit (keep last N entries)
    while (history.length > ERROR_HISTORY_SIZE) {
      history.shift();
    }

    // Count occurrences of each error pattern in history
    const errorCounts = new Map<string, number>();
    for (const err of history) {
      errorCounts.set(err, (errorCounts.get(err) || 0) + 1);
    }

    // Check if any error pattern exceeds threshold
    for (const [pattern, count] of errorCounts) {
      if (count >= REPEATED_ERROR_THRESHOLD) {
        // Try to suggest a skill based on error keywords
        const suggestedSkill = this.suggestSkillForError(pattern);

        return {
          type: PatternType.REPEATED_ERROR,
          agentId: checkpoint.agentId,
          description: `Same error pattern repeated ${count} times: ${pattern}`,
          suggestedAction: suggestedSkill
            ? SuggestedAction.INJECT_SKILL
            : SuggestedAction.SEND_CORRECTION,
          skillToInject: suggestedSkill || undefined,
          correctionText: suggestedSkill
            ? undefined
            : `Error pattern "${pattern}" has occurred ${count} times. Consider trying a different approach or breaking the task into smaller steps.`,
          confidence: Math.min(count / ERROR_HISTORY_SIZE, 1.0),
          evidence: [
            `Error keywords found: ${pattern}`,
            `Occurrence count: ${count}/${ERROR_HISTORY_SIZE} checkpoints`,
          ],
          detectedAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect stuck agent pattern.
   *
   * Compares current in-progress items with previous checkpoint.
   * If the same items remain in-progress across checkpoints,
   * suggests SEND_CORRECTION action.
   *
   * @param checkpoint - Current checkpoint
   * @param prevCheckpoint - Previous checkpoint for this agent (if any)
   * @returns DetectedPattern if agent is stuck, null otherwise
   */
  detectStuck(
    checkpoint: SubSpineCheckpoint,
    prevCheckpoint: SubSpineCheckpoint | undefined
  ): DetectedPattern | null {
    // No previous checkpoint to compare
    if (!prevCheckpoint) {
      return null;
    }

    // Must be a later checkpoint number to detect stuck
    if (checkpoint.checkpointNumber <= prevCheckpoint.checkpointNumber) {
      return null;
    }

    // Compare in-progress items
    const prevInProgress = new Set(prevCheckpoint.inProgress);
    const currentInProgress = new Set(checkpoint.inProgress);

    // Find items that are in both (unchanged across checkpoints)
    const unchangedItems = [...currentInProgress].filter((item) =>
      prevInProgress.has(item)
    );

    // If there are unchanged items, agent is stuck
    if (unchangedItems.length > 0) {
      const stuckItem = unchangedItems[0];
      const checkpointGap =
        checkpoint.checkpointNumber - prevCheckpoint.checkpointNumber;

      return {
        type: PatternType.STUCK,
        agentId: checkpoint.agentId,
        description: `Agent stuck on same tasks for ${checkpointGap} checkpoint(s): ${unchangedItems.join(', ')}`,
        suggestedAction: SuggestedAction.SEND_CORRECTION,
        correctionText: `You appear to be stuck on "${stuckItem}". Try these approaches:\n1. Break the task into smaller sub-tasks\n2. Identify what specific blocker is preventing progress\n3. Ask for help or clarification if needed\n4. Consider if the approach needs to change`,
        confidence: Math.min(checkpointGap / 3, 1.0),
        evidence: [
          `Unchanged in-progress items: ${unchangedItems.join(', ')}`,
          `Checkpoint gap: ${checkpointGap}`,
          `Previous checkpoint: ${prevCheckpoint.checkpointNumber}`,
          `Current checkpoint: ${checkpoint.checkpointNumber}`,
        ],
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Detect blocked pattern.
   *
   * If the checkpoint has blocked items, suggests ALERT_USER action
   * since blocked items typically require human intervention.
   *
   * @param checkpoint - Current checkpoint to analyze
   * @returns DetectedPattern if blocked items present, null otherwise
   */
  detectBlocked(checkpoint: SubSpineCheckpoint): DetectedPattern | null {
    if (checkpoint.blocked.length === 0) {
      return null;
    }

    return {
      type: PatternType.BLOCKED,
      agentId: checkpoint.agentId,
      description: `Agent blocked on ${checkpoint.blocked.length} item(s): ${checkpoint.blocked.join(', ')}`,
      suggestedAction: SuggestedAction.ESCALATE_TO_USER,
      correctionText: `The following items are blocked and may require human intervention:\n${checkpoint.blocked.map((item) => `- ${item}`).join('\n')}`,
      confidence: 1.0,
      evidence: checkpoint.blocked.map((item) => `Blocked: ${item}`),
      detectedAt: new Date(),
    };
  }

  /**
   * Detect token critical pattern.
   *
   * If the checkpoint status is RED (token/context usage critical),
   * suggests TRIGGER_HANDOVER action to spawn a replacement agent.
   *
   * @param checkpoint - Current checkpoint to analyze
   * @returns DetectedPattern if token critical, null otherwise
   */
  detectTokenCritical(checkpoint: SubSpineCheckpoint): DetectedPattern | null {
    if (checkpoint.status !== CheckpointStatus.RED) {
      return null;
    }

    return {
      type: PatternType.TOKEN_CRITICAL,
      agentId: checkpoint.agentId,
      description: `Agent at ${checkpoint.contextPercent}% context usage - approaching limit, handover required`,
      suggestedAction: SuggestedAction.REASSIGN_TASK,
      correctionText: `Context window is at ${checkpoint.contextPercent}%. Initiating handover to replacement agent. Please complete current task checkpoint.`,
      confidence: 1.0,
      evidence: [
        `Context usage: ${checkpoint.contextPercent}%`,
        `Status: ${checkpoint.status}`,
        `In-progress items to hand over: ${checkpoint.inProgress.join(', ') || 'none'}`,
        `Next steps to hand over: ${checkpoint.nextSteps.join(', ') || 'none'}`,
      ],
      detectedAt: new Date(),
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Suggest a skill file based on error pattern keywords.
   *
   * Maps error keywords to relevant skill files that can help
   * the agent resolve the issue.
   *
   * @param errorPattern - Comma-separated error keywords
   * @returns Skill file path if a match is found, null otherwise
   */
  suggestSkillForError(errorPattern: string): string | null {
    const lowerPattern = errorPattern.toLowerCase();

    // Check each skill mapping keyword
    for (const [keyword, skillPath] of Object.entries(SKILL_MAP)) {
      if (lowerPattern.includes(keyword)) {
        return skillPath;
      }
    }

    return null;
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Clear all stored history.
   * Useful for testing or when starting a new monitoring session.
   */
  clearHistory(): void {
    this.errorHistory.clear();
    this.prevCheckpoints.clear();
  }

  /**
   * Get error history for a specific agent.
   *
   * @param agentId - Agent session ID
   * @returns Array of error patterns or empty array
   */
  getErrorHistory(agentId: string): string[] {
    return this.errorHistory.get(agentId) || [];
  }

  /**
   * Get previous checkpoint for a specific agent.
   *
   * @param agentId - Agent session ID
   * @returns Previous checkpoint or undefined
   */
  getPrevCheckpoint(agentId: string): SubSpineCheckpoint | undefined {
    return this.prevCheckpoints.get(agentId);
  }
}

// =============================================================================
// Factory Export
// =============================================================================

/**
 * Create a new PatternDetector instance.
 */
export function createPatternDetector(): PatternDetector {
  return new PatternDetector();
}
