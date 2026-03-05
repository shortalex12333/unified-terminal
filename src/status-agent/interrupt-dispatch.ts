/**
 * Interrupt Dispatch - Route Corrections to Specific Agents
 *
 * Job 3 (Part 2): Routes user corrections to the right agent(s) via PA envelope.
 *
 * Key insight: When a user types a correction, we don't broadcast to ALL agents.
 * We surgically route the correction to the specific agent(s) that should handle it.
 * Other agents continue unaware.
 *
 * Dispatch strategies differ by runtime:
 * - codex/claude-code: Inject mid-session via resume mechanism
 * - chatgpt_web: Kill and respawn with correction baked into prompt
 *
 * This module builds the interrupt prompt that agents receive and
 * determines the correct dispatch strategy for each runtime.
 */

import { InterruptClassification, RunningAgent } from './interrupt-classifier';
import { PAEnvelope, routeUserCorrection } from './query';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Validated interrupt with resolved targets.
 */
export interface ValidatedInterrupt extends InterruptClassification {
  /** Primary target agent that should receive the correction */
  primaryTarget: string | null;
  /** Secondary targets that might also be affected */
  secondaryTargets: string[];
  /** Agents that are unaffected and should continue normally */
  unaffected: string[];
  /** Whether the user explicitly overrode automatic targeting */
  overridden: boolean;
}

/**
 * Runtime type for dispatch strategy selection.
 */
export type RuntimeType = 'codex' | 'claude_code' | 'chatgpt_web' | 'gemini' | 'unknown';

/**
 * Dispatch action to take for an agent.
 */
export interface DispatchAction {
  /** Target agent handle */
  agentHandle: string;
  /** Runtime type of the agent */
  runtime: RuntimeType;
  /** Action to take */
  action: 'inject' | 'respawn' | 'ignore';
  /** PA envelope to deliver */
  envelope: PAEnvelope | null;
  /** For respawn: new prompt with correction baked in */
  respawnPrompt?: string;
}

// =============================================================================
// INTERRUPT PROMPT BUILDER
// =============================================================================

/**
 * Build the interrupt prompt that agents receive.
 *
 * This prompt is injected into the agent's context to inform it
 * of the user's correction. The format is designed to:
 * 1. Clearly signal this is a priority update
 * 2. Quote the user's exact words
 * 3. Establish that user instructions override plan
 *
 * @param userCorrection - The user's correction text
 * @returns Formatted interrupt prompt
 */
export function buildInterruptPrompt(userCorrection: string): string {
  return [
    '---USER-UPDATE---',
    '',
    'The user has provided a correction. This takes PRIORITY over your current approach.',
    '',
    `User said: "${userCorrection}"`,
    '',
    'Apply this change to your current work.',
    "If this contradicts your mandate, follow the USER'S instruction — they override the plan.",
    "If this doesn't affect your current work, acknowledge and continue.",
    '',
    '---END-USER-UPDATE---',
  ].join('\n');
}

/**
 * Build an expanded interrupt prompt with context.
 *
 * Used when more context is needed for the agent to understand the correction.
 *
 * @param userCorrection - The user's correction text
 * @param context - Additional context about what the agent is working on
 * @returns Formatted interrupt prompt with context
 */
export function buildContextualInterruptPrompt(
  userCorrection: string,
  context: {
    currentTask?: string;
    stepId?: number;
    previousOutput?: string;
  }
): string {
  const lines = [
    '---USER-UPDATE---',
    '',
    'The user has provided a correction. This takes PRIORITY over your current approach.',
    '',
  ];

  if (context.currentTask) {
    lines.push(`Current task: ${context.currentTask}`);
  }
  if (context.stepId !== undefined) {
    lines.push(`Step ID: ${context.stepId}`);
  }
  if (context.previousOutput) {
    lines.push('');
    lines.push('Your previous output:');
    lines.push('```');
    lines.push(context.previousOutput.slice(0, 500)); // Truncate long output
    lines.push('```');
  }

  lines.push('');
  lines.push(`User said: "${userCorrection}"`);
  lines.push('');
  lines.push('Apply this change to your current work.');
  lines.push("If this contradicts your mandate, follow the USER'S instruction — they override the plan.");
  lines.push("If this doesn't affect your current work, acknowledge and continue.");
  lines.push('');
  lines.push('---END-USER-UPDATE---');

  return lines.join('\n');
}

// =============================================================================
// TARGET VALIDATION
// =============================================================================

/**
 * Validate and resolve interrupt targets.
 *
 * Takes the initial classification and resolves it to specific agent handles.
 *
 * @param classification - Initial classification from keyword matching
 * @param runningAgents - All currently running agents
 * @param userOverride - Optional explicit target from user (e.g., "@image-gen")
 * @returns Validated interrupt with resolved targets
 */
export function validateInterrupt(
  classification: InterruptClassification,
  runningAgents: RunningAgent[],
  userOverride?: string
): ValidatedInterrupt {
  let primaryTarget: string | null = null;
  const secondaryTargets: string[] = [];
  const unaffected: string[] = [];
  let overridden = false;

  // Check for explicit user override (e.g., "@image-gen make it blue")
  if (userOverride) {
    const targetAgent = runningAgents.find(a => a.handle === userOverride);
    if (targetAgent) {
      primaryTarget = userOverride;
      overridden = true;

      // All other running agents are unaffected
      for (const agent of runningAgents) {
        if (agent.handle !== userOverride) {
          unaffected.push(agent.handle);
        }
      }

      return {
        ...classification,
        primaryTarget,
        secondaryTargets,
        unaffected,
        overridden,
      };
    }
  }

  // Use classification's best guess if available
  if (classification.bestGuessTarget) {
    // Handle category-level targets
    if (classification.bestGuessTarget.startsWith('category:')) {
      const category = classification.bestGuessTarget.replace('category:', '');
      const agentsInCategory = runningAgents.filter(a => a.category === category);

      if (agentsInCategory.length === 1) {
        primaryTarget = agentsInCategory[0].handle;
      } else if (agentsInCategory.length > 1) {
        // Multiple agents in category - pick first running, rest are secondary
        const running = agentsInCategory.filter(a => a.status === 'running');
        if (running.length > 0) {
          primaryTarget = running[0].handle;
          secondaryTargets.push(...running.slice(1).map(a => a.handle));
        }
      }
    } else {
      primaryTarget = classification.bestGuessTarget;
    }
  }

  // Mark unaffected agents
  for (const agent of runningAgents) {
    if (agent.handle !== primaryTarget && !secondaryTargets.includes(agent.handle)) {
      unaffected.push(agent.handle);
    }
  }

  return {
    ...classification,
    primaryTarget,
    secondaryTargets,
    unaffected,
    overridden,
  };
}

// =============================================================================
// RUNTIME DETECTION
// =============================================================================

/**
 * Detect the runtime type from an agent handle.
 *
 * @param agentHandle - The agent handle to analyze
 * @returns Detected runtime type
 */
export function detectRuntime(agentHandle: string): RuntimeType {
  const lower = agentHandle.toLowerCase();

  if (lower.includes('codex') || lower.includes('openai')) {
    return 'codex';
  }
  if (lower.includes('claude') || lower.includes('anthropic')) {
    return 'claude_code';
  }
  if (lower.includes('chatgpt') || lower.includes('web') || lower.includes('browser')) {
    return 'chatgpt_web';
  }
  if (lower.includes('gemini') || lower.includes('google')) {
    return 'gemini';
  }

  return 'unknown';
}

/**
 * Get the dispatch strategy for a runtime type.
 *
 * @param runtime - The runtime type
 * @returns 'inject' for CLI tools, 'respawn' for web-based tools
 */
export function getDispatchStrategy(runtime: RuntimeType): 'inject' | 'respawn' {
  switch (runtime) {
    case 'codex':
    case 'claude_code':
      // CLI tools support mid-session injection via resume
      return 'inject';

    case 'chatgpt_web':
    case 'gemini':
      // Web-based tools need to be killed and respawned
      return 'respawn';

    default:
      // Default to respawn for unknown runtimes (safer)
      return 'respawn';
  }
}

// =============================================================================
// DISPATCH LOGIC
// =============================================================================

/**
 * Dispatch an interrupt to the appropriate agent(s).
 *
 * Returns PA envelopes for each affected agent with the appropriate
 * dispatch strategy based on their runtime.
 *
 * @param validated - Validated interrupt with resolved targets
 * @param correction - The original correction text
 * @param agentRuntimes - Map of agent handles to their runtime types
 * @returns Array of dispatch actions for each affected agent
 */
export function dispatchInterrupt(
  validated: ValidatedInterrupt,
  correction: string,
  agentRuntimes: Map<string, RuntimeType> = new Map()
): DispatchAction[] {
  const actions: DispatchAction[] = [];
  const interruptPrompt = buildInterruptPrompt(correction);

  // Process primary target
  if (validated.primaryTarget) {
    const runtime = agentRuntimes.get(validated.primaryTarget) ||
                   detectRuntime(validated.primaryTarget);
    const strategy = getDispatchStrategy(runtime);

    const action: DispatchAction = {
      agentHandle: validated.primaryTarget,
      runtime,
      action: strategy,
      envelope: routeUserCorrection(
        validated.primaryTarget,
        null, // stepId resolved later
        correction
      ),
    };

    if (strategy === 'respawn') {
      action.respawnPrompt = interruptPrompt;
    }

    actions.push(action);
  }

  // Process secondary targets
  for (const target of validated.secondaryTargets) {
    const runtime = agentRuntimes.get(target) || detectRuntime(target);
    const strategy = getDispatchStrategy(runtime);

    const action: DispatchAction = {
      agentHandle: target,
      runtime,
      action: strategy,
      envelope: routeUserCorrection(target, null, correction),
    };

    if (strategy === 'respawn') {
      action.respawnPrompt = interruptPrompt;
    }

    actions.push(action);
  }

  // Mark unaffected agents as ignore
  for (const handle of validated.unaffected) {
    actions.push({
      agentHandle: handle,
      runtime: agentRuntimes.get(handle) || 'unknown',
      action: 'ignore',
      envelope: null,
    });
  }

  return actions;
}

/**
 * Create PA envelopes from dispatch actions (filtering out ignored agents).
 *
 * @param actions - Dispatch actions from dispatchInterrupt
 * @returns PA envelopes for agents that need to receive the correction
 */
export function extractEnvelopes(actions: DispatchAction[]): PAEnvelope[] {
  return actions
    .filter(action => action.action !== 'ignore' && action.envelope !== null)
    .map(action => action.envelope!);
}

/**
 * Get respawn prompts for agents that need to be respawned.
 *
 * @param actions - Dispatch actions from dispatchInterrupt
 * @returns Map of agent handles to their new prompts
 */
export function extractRespawnPrompts(actions: DispatchAction[]): Map<string, string> {
  const prompts = new Map<string, string>();

  for (const action of actions) {
    if (action.action === 'respawn' && action.respawnPrompt) {
      prompts.set(action.agentHandle, action.respawnPrompt);
    }
  }

  return prompts;
}

// =============================================================================
// BROADCAST (EMERGENCY USE ONLY)
// =============================================================================

/**
 * Broadcast a correction to ALL running agents.
 *
 * Use sparingly - this is for emergency stops or global corrections.
 * Normally, corrections should be surgically routed to specific agents.
 *
 * @param correction - The correction to broadcast
 * @param runningAgents - All running agents
 * @returns PA envelopes for all agents
 */
export function broadcastCorrection(
  correction: string,
  runningAgents: RunningAgent[]
): PAEnvelope[] {
  return runningAgents.map(agent =>
    routeUserCorrection(agent.handle, agent.stepId, correction)
  );
}

/**
 * Emergency stop - broadcast halt to all agents.
 *
 * @param runningAgents - All running agents
 * @returns PA envelopes with halt instruction
 */
export function emergencyStop(runningAgents: RunningAgent[]): PAEnvelope[] {
  const haltMessage = 'EMERGENCY STOP: User requested immediate halt. Stop all work NOW.';

  return runningAgents.map(agent => ({
    target: agent.handle,
    stepId: agent.stepId,
    type: 'user_correction' as const,
    priority: 'urgent' as const,
    payload: {
      correction: haltMessage,
      isEmergencyStop: true,
      receivedAt: Date.now(),
    },
    timestamp: Date.now(),
  }));
}
