// Source: ENFORCEMENT-GAPS.md gap 9

export const HTTP_ENFORCEMENT = {
  // Global timeout for any HTTP request made by enforcement code
  HTTP_TIMEOUT_MS: 10_000, // 10 seconds

  // Retry policy for HTTP checks (separate from enforcer retries)
  HTTP_RETRIES: 2,
  HTTP_RETRY_DELAY_MS: 3_000,

  // What constitutes a "real" 200 (not an error page returning 200)
  REAL_200_CHECKS: {
    MIN_BODY_BYTES: 500, // error pages are usually < 500 bytes
    MUST_NOT_CONTAIN: ["Cannot GET", "404", "Internal Server Error", "not found", "ECONNREFUSED"],
    SHOULD_CONTAIN_ONE_OF: ["<div", "<main", "<html", "<!DOCTYPE"], // real HTML
  },

  // DNS resolution timeout (for deploy health — new domains are slow)
  DNS_TIMEOUT_MS: 15_000,
};
