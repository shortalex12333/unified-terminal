// Source: ENFORCEMENT-GAPS.md gap 1

export const BODYGUARD = {
  // Max concurrent checks (OS file descriptor limit on user machines)
  MAX_PARALLEL_CHECKS: 5,

  // Total timeout for ALL checks combined (not per-check)
  TOTAL_GATE_TIMEOUT_MS: 120_000, // 2 minutes max for entire gate

  // What happens when one check times out but others pass
  PARTIAL_TIMEOUT_POLICY: "fail_timed_out_only",
  // Options: "fail_all" | "fail_timed_out_only" | "warn_and_continue"

  // What happens when checks disagree (some pass, some fail)
  MIXED_RESULT_POLICY: "hard_fails_block_soft_fails_warn",

  // Minimum checks that must run for gate to be valid
  // (prevents "all checks timed out so gate passes" bug)
  MIN_CHECKS_REQUIRED: 1,
};
