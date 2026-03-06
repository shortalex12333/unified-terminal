// Source: HARDCODED-ENFORCEMENT-VALUES.md section 18

export const LATENCY_BUDGET = {
  FAST_PATH_MS: 50, // Tier 0: 50ms max for regex + bypass
  TIER_1_CLASSIFY_MS: 3_000, // Tier 1: 3 seconds for Conductor to classify
  TIER_2_PLANNING_MS: 10_000, // Tier 2 complex only: 5-10 seconds for detailed planning
  INTAKE_QUIZ_RANGE_MS: [30_000, 120_000], // 30s to 2 minutes for intake conversation
  TOTAL_ROUTING_OVERHEAD_MS: 6_000, // Total routing overhead for all tiers: ~6 seconds
};
