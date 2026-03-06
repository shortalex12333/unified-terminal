// Source: ENFORCEMENT-GAPS.md gap 3

export const CONDUCTOR_MESSAGES = {
  // DAG step status values (finite set, no free-text)
  VALID_STEP_STATUSES: ["PENDING", "RUNNING", "DONE", "FAILED", "BLOCKED", "SKIPPED"],

  // Re-plan trigger: what failure count forces conductor to re-plan instead of retry
  REPLAN_THRESHOLD: 2, // After 2 failures of same step, re-plan not just retry

  // Max DAG re-plans per project (prevent infinite re-planning loops)
  MAX_REPLANS: 3,

  // Max DAG steps total (prevent runaway planning)
  MAX_DAG_STEPS: 50,

  // Max parallel steps (even if DAG allows more)
  MAX_PARALLEL_STEPS: 3, // matches MAX_PARALLEL_CLI from memory constraints
};
