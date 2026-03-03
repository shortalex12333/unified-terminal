// Source: Plan.md - Sub-agent C: Engine Core
// Circuit Breaker: Determines user action when a check fails.
// Implements HARDCODED-ENFORCEMENT-VALUES.md section 4: CIRCUIT_BREAKER logic.
//
// Confidence level determines available options:
// - definitive: User must Retry or Stop (NO SKIP option)
// - heuristic: User can Retry, Skip, or Stop
//
// This is the USER ESCAPE HATCH — the point where automation yields to human judgment.

import type { EnforcerCheck, EnforcerResult, UserAction } from "./types";

/**
 * MOCK: Placeholder for constants from constants/04-circuit-breaker.ts
 * When Sub-agent A finishes, this import will be uncommented:
 * import { CIRCUIT_BREAKER } from '../constants/04-circuit-breaker';
 */
interface CircuitBreakerConstants {
  MAX_STEP_RETRIES: number;
  DEFINITIVE_FAIL_RETRIES: number;
  HEURISTIC_FAIL_OPTIONS: UserAction[];
  DEFINITIVE_FAIL_OPTIONS: UserAction[];
}

// Placeholder implementation (will be replaced by actual constants)
const CIRCUIT_BREAKER: CircuitBreakerConstants = {
  MAX_STEP_RETRIES: 3,
  DEFINITIVE_FAIL_RETRIES: 0,
  HEURISTIC_FAIL_OPTIONS: ["Retry", "Skip", "Stop build"],
  DEFINITIVE_FAIL_OPTIONS: ["Retry", "Stop build"],
};

/**
 * CircuitBreakerHistory: Tracks retry attempts for a single check.
 * Used to determine when to stop retrying and ask user.
 */
interface CircuitBreakerHistory {
  checkName: string;
  attempts: number;
  lastFailure: Date;
  userOverrides: UserAction[];
}

// Track history of check failures per project session
const failureHistory = new Map<string, CircuitBreakerHistory>();

/**
 * handleCheckFail: CRITICAL DECISION POINT
 * When a check fails, determine what the user should do.
 *
 * This function is the circuit breaker that prevents infinite loops
 * while still allowing retries for transient failures.
 *
 * @param check - The check that failed
 * @param result - The result object (passed = false)
 * @returns UserAction that user should take
 */
export function handleCheckFail(
  check: EnforcerCheck,
  result: EnforcerResult
): UserAction {
  // Track failure history
  const historyKey = check.name;
  const history = failureHistory.get(historyKey) || {
    checkName: check.name,
    attempts: 0,
    lastFailure: new Date(),
    userOverrides: [],
  };

  history.attempts++;
  history.lastFailure = new Date();

  // Definitive checks have NO skip option
  if (check.confidence === "definitive") {
    // Definitive: [Retry, Stop build]
    const options = CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS;

    // If already attempted max retries, recommend Stop
    if (history.attempts > CIRCUIT_BREAKER.MAX_STEP_RETRIES) {
      return "Stop build";
    }

    // Otherwise, recommend Retry
    return "Retry";
  }

  // Heuristic checks allow skip
  if (check.confidence === "heuristic") {
    // Heuristic: [Retry, Skip, Stop build]
    const options = CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS;

    // If already attempted max retries, give user choice to skip or stop
    if (history.attempts > CIRCUIT_BREAKER.MAX_STEP_RETRIES) {
      // Return Skip as default for heuristic
      // (user can see the option and choose differently)
      return "Skip";
    }

    // Otherwise, recommend Retry
    return "Retry";
  }

  // Fallback (should never reach here)
  return "Stop build";
}

/**
 * askUserForAction: Present options to user and get their decision.
 * This is a PLACEHOLDER — in real implementation, this would prompt the user.
 * In tests, this would be mocked. In production, this would show a dialog.
 *
 * @param checkName - Name of failed check
 * @param options - Available actions user can take
 * @param errorMessage - User-friendly error message
 * @returns Promise<UserAction> user chose
 */
export async function askUserForAction(
  checkName: string,
  options: UserAction[],
  errorMessage: string
): Promise<UserAction> {
  // This is a placeholder. In real implementation, this would:
  // 1. Show a dialog or CLI prompt
  // 2. Present the available options
  // 3. Wait for user input
  // 4. Log the override to state
  //
  // For now, return the first (default) option
  console.error(`Check failed: ${checkName}`);
  console.error(`Error: ${errorMessage}`);
  console.error(`Options: ${options.join(", ")}`);

  // Default to first option (usually "Retry")
  return options[0];
}

/**
 * recordOverride: Log user's decision to skip or override a check.
 * This is critical for audit trail and learning.
 *
 * @param checkName - Name of check
 * @param action - What user chose
 * @param reason - Why (error message from check)
 */
export function recordOverride(
  checkName: string,
  action: UserAction,
  reason: string
): void {
  const history = failureHistory.get(checkName);
  if (history) {
    history.userOverrides.push(action);
  }

  // In production, this would:
  // 1. Write to enforcement.log
  // 2. Update SPINE.md with override entry
  // 3. Notify Archivist for post-project analysis
  console.log(
    `[OVERRIDE] Check "${checkName}" — User chose "${action}" because: ${reason}`
  );
}

/**
 * shouldRetry: Determine if a check should be retried.
 * Respects max retry limit from constants.
 *
 * @param checkName - Name of check
 * @returns boolean: true if retry should happen, false if exhausted
 */
export function shouldRetry(checkName: string): boolean {
  const history = failureHistory.get(checkName);
  if (!history) {
    return true; // First attempt, allow retry
  }

  return history.attempts <= CIRCUIT_BREAKER.MAX_STEP_RETRIES;
}

/**
 * getRetryCount: How many retries have been attempted for a check?
 *
 * @param checkName - Name of check
 * @returns number of retry attempts
 */
export function getRetryCount(checkName: string): number {
  const history = failureHistory.get(checkName);
  return history ? history.attempts : 0;
}

/**
 * resetHistory: Clear failure history for a check or all checks.
 * Called when step completes or project state changes.
 *
 * @param checkName - Name of check to reset, or undefined for all
 */
export function resetHistory(checkName?: string): void {
  if (checkName) {
    failureHistory.delete(checkName);
  } else {
    failureHistory.clear();
  }
}

/**
 * getOverrideLog: Return all user overrides for audit trail.
 * Used by Archivist to document what was skipped.
 *
 * @returns Array of all overrides recorded
 */
export function getOverrideLog(): Array<{
  check: string;
  overrides: UserAction[];
  attempts: number;
}> {
  return Array.from(failureHistory.values()).map((history) => ({
    check: history.checkName,
    overrides: history.userOverrides,
    attempts: history.attempts,
  }));
}

/**
 * validateCheckConfidence: Verify that check confidence is valid.
 * Catches configuration errors.
 *
 * @param confidence - The confidence level string
 * @returns boolean: true if valid
 */
export function validateCheckConfidence(
  confidence: string
): confidence is "definitive" | "heuristic" {
  return confidence === "definitive" || confidence === "heuristic";
}

/**
 * getAvailableActions: Return available actions for a check failure.
 * Based on confidence level and retry history.
 *
 * @param check - The failed check
 * @returns Array of UserAction options
 */
export function getAvailableActions(check: EnforcerCheck): UserAction[] {
  if (check.confidence === "definitive") {
    return CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS;
  } else {
    return CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS;
  }
}

/**
 * isExhausted: Has a check exhausted its retry limit?
 *
 * @param checkName - Name of check
 * @returns boolean: true if max retries exceeded
 */
export function isExhausted(checkName: string): boolean {
  const history = failureHistory.get(checkName);
  if (!history) return false;

  return history.attempts > CIRCUIT_BREAKER.MAX_STEP_RETRIES;
}
