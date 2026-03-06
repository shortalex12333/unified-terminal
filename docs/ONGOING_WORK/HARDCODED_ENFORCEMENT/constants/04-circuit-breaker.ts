// Source: HARDCODED-ENFORCEMENT-VALUES.md section 4

export const CIRCUIT_BREAKER = {
  // Step-level: how many times a single DAG step can fail before asking user
  MAX_STEP_RETRIES: 3,

  // Definitive hard rail: NO retries, NO skip. Must fix.
  DEFINITIVE_FAIL_RETRIES: 0,

  // Heuristic check: user gets [Retry] [Skip] [Stop]
  HEURISTIC_FAIL_OPTIONS: ["Retry", "Skip this check", "Stop build"],

  // Definitive check: user gets [Retry] [Stop] only. NO SKIP.
  DEFINITIVE_FAIL_OPTIONS: ["Retry", "Stop build"],
};

// User escape hatch logic
export interface CheckResult {
  passed: boolean;
  confidence?: "definitive" | "heuristic";
  name?: string;
}

export interface UserAction {
  action: "retry" | "skip" | "stop";
}

export function onCheckFail(check: { confidence?: "definitive" | "heuristic"; name?: string }, result: CheckResult): UserAction {
  if (check.confidence === "definitive") {
    // No skip button. Must fix or stop.
    return { action: "retry" }; // Placeholder — actual implementation calls askUser
  } else {
    // Heuristic: user can skip
    return { action: "skip" }; // Placeholder — actual implementation calls askUser
  }
  // ALL overrides logged to Spine. Archivist records which checks were skipped.
}
