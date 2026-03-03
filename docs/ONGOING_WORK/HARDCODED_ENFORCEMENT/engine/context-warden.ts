// Source: HARDCODED-ENFORCEMENT-VALUES.md section 1
// Monitor all active agents' token usage + kill on threshold

import { TOKEN_THRESHOLDS, GRACE_THRESHOLD } from "../constants/01-context-warden";
import { CRON_INTERVALS } from "../constants/02-cron-intervals";
import { TIMEOUTS, killAgent } from "../constants/03-timeouts";
import { AgentHandle, WardenState, WardenKillDecision } from "./types";

// ============================================================================
// WARDEN STATE (singleton)
// ============================================================================

let wardenState: WardenState = {
  active: false,
  agents: new Map(),
  lastCheck: Date.now(),
};

// ============================================================================
// START WARDEN — begin cron monitoring
// ============================================================================

export function startWarden(agents: AgentHandle[]): void {
  if (wardenState.active) {
    console.warn("Warden already active, skipping start");
    return;
  }

  wardenState.active = true;
  wardenState.agents = new Map(agents.map((a) => [a.id, a]));
  wardenState.lastCheck = Date.now();

  // ========================================================================
  // CRON: Check token usage every 30 seconds
  // ========================================================================

  wardenState.timerId = setInterval(() => {
    wardenState.lastCheck = Date.now();

    // Iterate all tracked agents
    for (const [agentId, agent] of wardenState.agents.entries()) {
      const decision = shouldKillAgent(agent);

      if (decision.shouldKill) {
        console.log(`[WARDEN] Killing agent ${agentId}: ${decision.reason}`);

        // Kill it (SIGTERM -> SIGKILL after grace period)
        killAgent(agent).catch((err) => console.error(`Error killing agent ${agentId}:`, err));

        // In real implementation: respawn at current step
        // For now: just log the action
      }
    }
  }, CRON_INTERVALS.CONTEXT_CHECK_MS);
}

// ============================================================================
// STOP WARDEN — stop cron monitoring
// ============================================================================

export function stopWarden(): void {
  if (wardenState.timerId) {
    clearInterval(wardenState.timerId as NodeJS.Timeout);
    wardenState.timerId = undefined;
  }

  wardenState.active = false;
  wardenState.agents.clear();
}

// ============================================================================
// DECISION LOGIC — should we kill this agent?
// ============================================================================

function shouldKillAgent(agent: AgentHandle): WardenKillDecision {
  // Look up model-specific threshold
  const threshold = TOKEN_THRESHOLDS[agent.model] || TOKEN_THRESHOLDS["default"];

  if (!threshold) {
    return { shouldKill: false, reason: "No threshold for model" };
  }

  // Calculate utilization ratio
  const utilization = agent.tokensUsed / threshold.window;

  // Check if over threshold
  if (utilization > threshold.killAt) {
    // GRACE RULE: if task progress > 85%, let it finish
    if (agent.taskProgress > GRACE_THRESHOLD) {
      return {
        shouldKill: false,
        reason: `Over threshold (${(utilization * 100).toFixed(0)}%) but task ${(agent.taskProgress * 100).toFixed(0)}% done, allowing completion`,
        grace: true,
      };
    }

    // KILL: summarize from spine, respawn at current step
    return {
      shouldKill: true,
      reason: `Token utilization ${(utilization * 100).toFixed(0)}% exceeds threshold ${(threshold.killAt * 100).toFixed(0)}%`,
      grace: false,
    };
  }

  // Under threshold — keep running
  return { shouldKill: false };
}

// ============================================================================
// EXPORT: Register agent with warden
// ============================================================================

export function registerAgentWithWarden(agent: AgentHandle): void {
  wardenState.agents.set(agent.id, agent);
}

// ============================================================================
// EXPORT: Unregister agent
// ============================================================================

export function unregisterAgentFromWarden(agentId: string): void {
  wardenState.agents.delete(agentId);
}

// ============================================================================
// EXPORT: Get warden state
// ============================================================================

export function getWardenState(): WardenState {
  return wardenState;
}
