// Source: HARDCODED-ENFORCEMENT-VALUES.md section 3

export const TIMEOUTS = {
  // Agent spawn: how long to wait for process to start
  AGENT_SPAWN_MS: 10_000, // 10 seconds

  // Worker execution: per-tier defaults (overridden by AgentConfig.timeout)
  WORKER_TIER_1_MS: 60_000, // 1 minute
  WORKER_TIER_2_MS: 300_000, // 5 minutes
  WORKER_TIER_3_MS: 900_000, // 15 minutes
  WORKER_MAX_MS: 1_800_000, // 30 minutes absolute max, any tier

  // Conductor session: no timeout (persistent, app lifetime)
  CONDUCTOR_TIMEOUT_MS: null, // never times out, runs for project duration

  // CLI auth flow: how long to wait for user to complete OAuth in browser
  AUTH_FLOW_TIMEOUT_MS: 300_000, // 5 minutes. Source: CLAUDE-CODE-GATE5-6.md

  // Auth polling: how often to check if OAuth completed
  AUTH_POLL_INTERVAL_MS: 2_000, // 2 seconds. Source: CLAUDE-CODE-GATE5-6.md

  // Docker health check: total wait time for container to become healthy
  DOCKER_HEALTH_TIMEOUT_MS: 30_000, // 30 seconds (3 retries × 5s + startup buffer)

  // Post-deploy health check: total wait time for deployed URL to respond
  DEPLOY_HEALTH_TIMEOUT_MS: 40_000, // ~40 seconds (3 retries × 10s intervals)

  // Bodyguard single check: max time for any one enforcement check
  ENFORCER_CHECK_TIMEOUT_MS: 60_000, // 60 seconds (vitest can be slow)

  // Kill grace period: time between SIGTERM and SIGKILL
  KILL_GRACE_MS: 5_000, // 5 seconds
};

// Kill sequence (every agent, no exceptions)
export async function killAgent(handle: { process: any; exitCode?: number | null }): Promise<void> {
  handle.process.kill("SIGTERM"); // polite
  await new Promise((r) => setTimeout(r, TIMEOUTS.KILL_GRACE_MS));
  if (handle.process.exitCode === null) {
    handle.process.kill("SIGKILL"); // forceful
  }
}
