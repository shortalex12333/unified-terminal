// Source: HARDCODED-ENFORCEMENT-VALUES.md section 24

export const MEMORY_CONSTRAINTS = {
  // Playwright and Browser-Use are NEVER concurrent (both ~500MB RAM each)
  MAX_BROWSER_AGENTS: 1,

  // Max parallel CLI workers (user machine RAM constraint)
  MAX_PARALLEL_CLI: 3,

  // Max parallel web workers (rate limit constraint, not RAM)
  MAX_PARALLEL_WEB: 1,
};
