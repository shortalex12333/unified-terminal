/**
 * PA Decision Writer Module
 *
 * Writes decision files that hard rails will watch and act upon.
 * The PA uses this module to communicate with agents and other system components
 * through the file system rather than direct calls.
 *
 * File types written:
 * - Corrections: Guidance injected into agent context by hard rails
 * - Skill flags: Signals for Storekeeper to inject skills
 * - Handovers: Context transfer documents for agent replacement
 *
 * All file writes are currently placeholders (console.log + commented fs.writeFile)
 * to be wired when topology is finalized.
 */

import type { PADecision, SubSpineCheckpoint, PADecisionType, SuggestedAction } from './types';

// =============================================================================
// PATH TEMPLATES
// =============================================================================

/**
 * Placeholder paths for decision file locations.
 * Will be resolved at runtime based on project configuration.
 */
const PATHS = {
  /** Corrections output directory */
  CORRECTIONS_DIR: '{{ CORRECTIONS_DIR }}',
  /** Skill flags output directory */
  SKILL_FLAGS_DIR: '{{ SKILL_FLAGS_DIR }}',
  /** Handovers output directory */
  HANDOVERS_DIR: '{{ HANDOVERS_DIR }}',
  /** PA decisions log file */
  DECISIONS_LOG: '{{ DECISIONS_LOG }}',
} as const;

// =============================================================================
// DECISION WRITER CLASS
// =============================================================================

/**
 * DecisionWriter handles all file-based decision outputs from the PA.
 *
 * Responsibilities:
 * - Write correction files for agent guidance
 * - Write skill flag files for Storekeeper
 * - Write handover documents for agent replacement
 * - Maintain an audit log of all decisions
 */
export class DecisionWriter {
  /** Project directory root */
  private projectDir: string;

  /** In-memory decision log (last 100 decisions) */
  private decisionLog: PADecision[] = [];

  /** Maximum decisions to keep in memory */
  private readonly MAX_DECISIONS = 100;

  /**
   * Create a new DecisionWriter instance.
   *
   * @param projectDir - Root directory of the project
   */
  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  // ===========================================================================
  // CORRECTION WRITING
  // ===========================================================================

  /**
   * Write a correction file for an agent.
   *
   * Hard rails watch the corrections directory and inject corrections
   * into the target agent's next prompt.
   *
   * File format:
   * ```markdown
   * ## Correction from PA
   *
   * **Target:** {{ agentId }}
   * **Timestamp:** {{ ISO timestamp }}
   *
   * ---
   *
   * {{ correctionText }}
   * ```
   *
   * @param agentId - Target agent session ID
   * @param correctionText - The correction guidance to inject
   */
  writeCorrection(agentId: string, correctionText: string): void {
    const timestamp = Date.now();
    const filePath = `${PATHS.CORRECTIONS_DIR}/${agentId}_${timestamp}.md`;

    const content = [
      '## Correction from PA',
      '',
      `**Target:** ${agentId}`,
      `**Timestamp:** ${new Date(timestamp).toISOString()}`,
      '',
      '---',
      '',
      correctionText,
    ].join('\n');

    // @placeholder - Will use fs.writeFile when topology is wired
    // import fs from 'fs/promises';
    // await fs.mkdir(path.dirname(filePath), { recursive: true });
    // await fs.writeFile(filePath, content, 'utf-8');

    console.log(`[DecisionWriter] Would write correction: ${filePath}`);
    console.log(`[DecisionWriter] Content:\n${content}`);

    // Log the decision
    this.logDecision({
      timestamp: new Date(timestamp),
      type: 'INTERVENTION' as PADecisionType,
      targetAgent: agentId,
      input: {
        description: `Correction routed to agent`,
      },
      action: 'SEND_CORRECTION' as SuggestedAction,
      fileWritten: filePath,
    });
  }

  // ===========================================================================
  // SKILL FLAG WRITING
  // ===========================================================================

  /**
   * Write a skill flag file for an agent.
   *
   * The Storekeeper watches the skill_flags directory and injects
   * the specified skill into the target agent's context.
   *
   * File format:
   * ```
   * ## Skill Flag
   *
   * **Agent:** {{ agentId }}
   * **Skill:** {{ skillPath }}
   * **Timestamp:** {{ ISO timestamp }}
   * **Reason:** Pattern detected requiring this skill
   * ```
   *
   * @param agentId - Target agent session ID
   * @param skillPath - Path to the skill file (e.g., "workers/tailwind-guide.md")
   */
  writeSkillFlag(agentId: string, skillPath: string): void {
    const timestamp = Date.now();

    // Convert skill path to a safe filename slug
    const skillSlug = skillPath
      .replace(/\//g, '_')
      .replace(/\.md$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const filePath = `${PATHS.SKILL_FLAGS_DIR}/${agentId}_${skillSlug}.flag`;

    const content = [
      '## Skill Flag',
      '',
      `**Agent:** ${agentId}`,
      `**Skill:** ${skillPath}`,
      `**Timestamp:** ${new Date(timestamp).toISOString()}`,
      `**Reason:** Pattern detected requiring this skill`,
    ].join('\n');

    // @placeholder - Will use fs.writeFile when topology is wired
    // import fs from 'fs/promises';
    // await fs.mkdir(path.dirname(filePath), { recursive: true });
    // await fs.writeFile(filePath, content, 'utf-8');

    console.log(`[DecisionWriter] Would write skill flag: ${filePath}`);
    console.log(`[DecisionWriter] Content:\n${content}`);

    // Log the decision
    this.logDecision({
      timestamp: new Date(timestamp),
      type: 'SKILL_INJECTION' as PADecisionType,
      targetAgent: agentId,
      input: {
        description: `Skill injection requested: ${skillPath}`,
      },
      action: 'INJECT_SKILL' as SuggestedAction,
      fileWritten: filePath,
    });
  }

  // ===========================================================================
  // HANDOVER WRITING
  // ===========================================================================

  /**
   * Write a handover file for agent replacement.
   *
   * When an agent hits RED status (token critical), the PA initiates
   * a handover by writing this document. The orchestrator spawns a
   * replacement agent and passes this handover as initial context.
   *
   * File format:
   * ```markdown
   * ## Handover from {{ agentId }}
   *
   * ### Context Summary
   * Agent was at {{ contextPercent }}% context.
   *
   * ### Completed
   * - {{ completed items }}
   *
   * ### Remaining Work
   * - {{ in progress items }}
   * - {{ next steps }}
   *
   * ### Files Owned
   * - {{ files touched }}
   * ```
   *
   * @param agentId - Agent being replaced
   * @param checkpoint - Last checkpoint from the agent
   */
  writeHandover(agentId: string, checkpoint: SubSpineCheckpoint): void {
    const timestamp = Date.now();
    const filePath = `${PATHS.HANDOVERS_DIR}/${agentId}_handover.md`;

    // Build the completed section
    const completedSection = checkpoint.completed.length > 0
      ? checkpoint.completed.map(item => `- ${item}`).join('\n')
      : '- (none)';

    // Build the remaining work section (in progress + next steps)
    const remainingItems = [
      ...checkpoint.inProgress,
      ...checkpoint.nextSteps,
    ];
    const remainingSection = remainingItems.length > 0
      ? remainingItems.map(item => `- ${item}`).join('\n')
      : '- (none)';

    // Build the blocked section if applicable
    const blockedSection = checkpoint.blocked.length > 0
      ? [
          '',
          '### Blocked',
          ...checkpoint.blocked.map(item => `- ${item}`),
        ].join('\n')
      : '';

    // Build the files section
    const filesSection = checkpoint.filesTouched.length > 0
      ? checkpoint.filesTouched.map(file => `- ${file}`).join('\n')
      : '- (none)';

    const content = [
      `## Handover from ${agentId}`,
      '',
      '### Context Summary',
      `Agent was at ${checkpoint.contextPercent}% context.`,
      `Checkpoint #${checkpoint.checkpointNumber} at ${checkpoint.timestamp.toISOString()}`,
      '',
      '### Completed',
      completedSection,
      '',
      '### Remaining Work',
      remainingSection,
      blockedSection,
      '',
      '### Files Owned',
      filesSection,
      '',
      '---',
      '',
      `Handover generated: ${new Date(timestamp).toISOString()}`,
    ].join('\n');

    // @placeholder - Will use fs.writeFile when topology is wired
    // import fs from 'fs/promises';
    // await fs.mkdir(path.dirname(filePath), { recursive: true });
    // await fs.writeFile(filePath, content, 'utf-8');

    console.log(`[DecisionWriter] Would write handover: ${filePath}`);
    console.log(`[DecisionWriter] Content:\n${content}`);

    // Log the decision
    this.logDecision({
      timestamp: new Date(timestamp),
      type: 'INTERVENTION' as PADecisionType,
      targetAgent: agentId,
      input: {
        tokenPercent: checkpoint.contextPercent,
        checkpointStatus: checkpoint.status,
        description: `Handover initiated at ${checkpoint.contextPercent}% context`,
      },
      action: 'ESCALATE_TO_USER' as SuggestedAction, // Handover requires orchestrator action
      fileWritten: filePath,
    });
  }

  // ===========================================================================
  // DECISION LOGGING
  // ===========================================================================

  /**
   * Log a decision to the in-memory log.
   *
   * Maintains a rolling buffer of the last 100 decisions for audit
   * and debugging purposes.
   *
   * @param decision - The decision to log
   */
  logDecision(decision: PADecision): void {
    this.decisionLog.push(decision);

    // Keep only the last MAX_DECISIONS entries
    if (this.decisionLog.length > this.MAX_DECISIONS) {
      this.decisionLog.shift();
    }

    console.log('[DecisionWriter] Decision logged:', {
      type: decision.type,
      targetAgent: decision.targetAgent,
      action: decision.action,
      fileWritten: decision.fileWritten,
    });
  }

  /**
   * Get the most recent decisions.
   *
   * @param count - Number of decisions to return (default: 10)
   * @returns Array of recent decisions, newest last
   */
  getRecentDecisions(count: number = 10): PADecision[] {
    return this.decisionLog.slice(-count);
  }

  /**
   * Flush the decision log to the decisions log file.
   *
   * Writes all decisions in memory to the persistent log file.
   * Each decision is written as a single JSON line (JSONL format).
   */
  flushDecisionLog(): void {
    const filePath = PATHS.DECISIONS_LOG;

    // Format decisions as JSONL (one JSON object per line)
    const content = this.decisionLog
      .map(decision => JSON.stringify(decision))
      .join('\n');

    // @placeholder - Will use fs.appendFile when topology is wired
    // import fs from 'fs/promises';
    // await fs.mkdir(path.dirname(filePath), { recursive: true });
    // await fs.appendFile(filePath, content + '\n', 'utf-8');

    console.log(`[DecisionWriter] Would flush ${this.decisionLog.length} decisions to: ${filePath}`);
    console.log(`[DecisionWriter] Content preview:\n${content.substring(0, 500)}...`);
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get the current project directory.
   */
  getProjectDir(): string {
    return this.projectDir;
  }

  /**
   * Get the total number of decisions logged in this session.
   */
  getDecisionCount(): number {
    return this.decisionLog.length;
  }

  /**
   * Clear the in-memory decision log.
   *
   * Note: This does NOT clear the persistent log file.
   */
  clearDecisionLog(): void {
    this.decisionLog = [];
    console.log('[DecisionWriter] Decision log cleared');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new DecisionWriter instance for a project.
 *
 * @param projectDir - Root directory of the project
 * @returns Configured DecisionWriter instance
 */
export function createDecisionWriter(projectDir: string): DecisionWriter {
  return new DecisionWriter(projectDir);
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { PADecision, SubSpineCheckpoint };
