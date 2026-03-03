// Source: HARDCODED-ENFORCEMENT-VALUES.md section 2

export const CRON_INTERVALS = {
  // Context Warden: check all active agents' token usage
  CONTEXT_CHECK_MS: 30_000, // 30 seconds. Source: AGENT-TOPOLOGY-MVP.md

  // Rate limit recovery: poll ChatGPT to see if limit lifted
  RATE_LIMIT_POLL_MS: 60_000, // 60 seconds. Source: CONDUCTOR-ARCHITECTURE.md

  // Rate limit retry: try sending test message to detect recovery
  RATE_LIMIT_RETRY_MS: 120_000, // 2 minutes. Source: PRODUCT-STRATEGY.md

  // Stale agent cleanup: kill agents with no output for N ms
  STALE_AGENT_CLEANUP_MS: 1_800_000, // 30 minutes. Source: AGENT-TOPOLOGY-MVP.md

  // Regression check: re-run test suite every N steps
  REGRESSION_CHECK_STEPS: 5, // every 5 completed steps. Source: AGENT-TOPOLOGY-MVP.md

  // Mandatory stop: force Conductor to re-read goal
  MANDATORY_STOP_TURNS: 5, // every 5 turns. Source: OVERCOMING_LIMITATIONS_FIRST_PRINCIPLES.md

  // Spine refresh: filesystem scan frequency during active execution
  SPINE_REFRESH_TRIGGER: "PER_STEP", // twice per step: pre-step + post-step. NOT timed.
};
