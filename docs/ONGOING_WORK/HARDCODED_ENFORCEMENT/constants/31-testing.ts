// Source: ENFORCEMENT-GAPS.md gap 7

export const TESTING = {
  // Detection: which test runners to look for (in order)
  TEST_RUNNER_DETECTION_ORDER: ["vitest", "jest", "mocha", "playwright"],

  // What to do when package.json has NO test script
  NO_TEST_SCRIPT_POLICY: "skip_test_check_log_warning",
  // NOT "fail" — new scaffolds legitimately have no tests yet

  // When to REQUIRE tests (complexity threshold)
  TESTS_REQUIRED_FROM_TIER: 2, // Tier 2+ must have tests. Tier 1 = optional.

  // Regression scan: compare to previous run
  REGRESSION_COMPARISON: "pass_count_must_not_decrease",
  // If previous run: 12 passed, 0 failed
  // Current run: 11 passed, 1 failed → REGRESSION DETECTED

  // What counts as "tests modified code files" (triggers test check)
  CODE_FILE_EXTENSIONS: [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"],
};
