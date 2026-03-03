// Source: ENFORCEMENT-GAPS.md gap 10
// Monitor worker liveness — 3 missed beats = stale

import { AgentHandle, HeartbeatState, HeartbeatSignal } from "./types";

// Constants for heartbeat (from ENFORCEMENT-GAPS.md gap 10)
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute
const STALE_AFTER_MISSED_BEATS = 3; // 3 minutes of silence = stuck

// ============================================================================
// HEARTBEAT STATE REGISTRY
// ============================================================================

const heartbeatStates = new Map<string, HeartbeatState>();

// ============================================================================
// START HEARTBEAT — monitor agent liveness
// ============================================================================

export function startHeartbeat(agent: AgentHandle): NodeJS.Timer {
  // Initialize heartbeat state
  if (!heartbeatStates.has(agent.id)) {
    heartbeatStates.set(agent.id, {
      agentId: agent.id,
      lastSignal: Date.now(),
      missedBeats: 0,
      signals: [],
      isStale: false,
    });
  }

  const timerId = setInterval(() => {
    checkHeartbeat(agent);
  }, HEARTBEAT_INTERVAL_MS);

  return timerId;
}

// ============================================================================
// CHECK HEARTBEAT — detect missed signals
// ============================================================================

function checkHeartbeat(agent: AgentHandle): void {
  const state = heartbeatStates.get(agent.id);
  if (!state) return;

  const now = Date.now();
  const timeSinceLastSignal = now - state.lastSignal;

  // If no signal received since last check, count as missed beat
  if (timeSinceLastSignal > HEARTBEAT_INTERVAL_MS) {
    state.missedBeats++;

    // Log missed beat
    console.log(`[HEARTBEAT] Agent ${agent.id}: missed beat (${state.missedBeats}/${STALE_AFTER_MISSED_BEATS})`);
  } else {
    // Reset counter if we got a signal
    state.missedBeats = 0;
  }

  // Check if stale (3+ missed beats)
  if (state.missedBeats >= STALE_AFTER_MISSED_BEATS) {
    state.isStale = true;
    console.warn(`[HEARTBEAT] Agent ${agent.id} is STALE after ${state.missedBeats} missed beats`);

    // In real implementation: trigger kill + respawn logic
    // For now: just set flag
  }
}

// ============================================================================
// RECORD SIGNAL — agent produced output
// ============================================================================

export function recordHeartbeatSignal(
  agentId: string,
  signalType: "stdout" | "file_created" | "file_modified" | "api_call",
  detail: string,
): void {
  const state = heartbeatStates.get(agentId);
  if (!state) return;

  // Record the signal
  state.lastSignal = Date.now();
  state.missedBeats = 0; // Reset counter
  state.isStale = false;

  state.signals.push({
    timestamp: Date.now(),
    type: signalType,
    detail,
  });

  // Keep only last 100 signals
  if (state.signals.length > 100) {
    state.signals = state.signals.slice(-100);
  }
}

// ============================================================================
// IS STALE — check if agent is stuck
// ============================================================================

export function isStale(agent: AgentHandle): boolean {
  const state = heartbeatStates.get(agent.id);
  if (!state) return false;

  return state.isStale;
}

// ============================================================================
// STOP HEARTBEAT — clean up
// ============================================================================

export function stopHeartbeat(agentId: string, timerId: NodeJS.Timer): void {
  clearInterval(timerId as NodeJS.Timeout);
  heartbeatStates.delete(agentId);
}

// ============================================================================
// GET HEARTBEAT STATE — for diagnostics
// ============================================================================

export function getHeartbeatState(agentId: string): HeartbeatState | undefined {
  return heartbeatStates.get(agentId);
}
