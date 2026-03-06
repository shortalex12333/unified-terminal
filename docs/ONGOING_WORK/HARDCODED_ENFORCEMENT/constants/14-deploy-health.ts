// Source: HARDCODED-ENFORCEMENT-VALUES.md section 15

export const DEPLOY_HEALTH = {
  RETRIES: 3,
  RETRY_DELAY_MS: 10_000, // 10 seconds between retries
  EXPECTED_STATUS: 200,
  ERROR_BODY_STRINGS: ["Cannot GET", "Error", "Internal Server Error", "404", "not found"],
  // Response body must NOT contain any error strings AND status must be 200
};
