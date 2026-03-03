// Source: ENFORCEMENT-GAPS.md gap 8

export const ERROR_PROPAGATION = {
  // Error severity levels (determines UI treatment)
  SEVERITY_LEVELS: ["info", "warning", "error", "fatal"],

  // Mapping: check failure → severity
  HARD_FAIL_SEVERITY: "error", // blocks step
  SOFT_FAIL_SEVERITY: "warning", // user can skip
  TIMEOUT_SEVERITY: "error", // blocks step
  RATE_LIMIT_SEVERITY: "info", // deferred, not blocked

  // How many errors to show user at once
  MAX_USER_VISIBLE_ERRORS: 3, // don't overwhelm non-technical users

  // Error message format (user-facing, not technical)
  USER_ERROR_TEMPLATE: "{friendly_name} didn't pass. {one_sentence_why}. {action_options}",

  // Technical error: where it goes (not shown to user)
  TECHNICAL_LOG_PATH: ".prism/logs/enforcement.log",

  // Max error log size before rotation
  MAX_LOG_SIZE_BYTES: 5_000_000, // 5MB
};
