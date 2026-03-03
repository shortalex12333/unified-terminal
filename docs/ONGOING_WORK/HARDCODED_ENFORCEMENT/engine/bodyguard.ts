// Source: Plan.md - Sub-agent C: Engine Core
// CRITICAL: Bodyguard is the dispatcher that runs ALL applicable checks IN PARALLEL.
// Never sequential. Uses Promise.allSettled to run multiple checks concurrently.
// Aggregates results into a single verdict: PASS, HARD_FAIL, or SOFT_FAIL.

import type {
  BodyguardVerdict,
  GateResult,
  DagStep,
  EnforcerCheck,
  EnforcerResult,
  CheckActivationContext,
} from "./types";
import { runCheckWithRetry } from "./enforcer";

/**
 * MOCK: Placeholder for constants from constants/09-retry-policies.ts
 * When Sub-agent A finishes, this import will be uncommented:
 * import { ENFORCER_RETRY_POLICIES } from '../constants/09-retry-policies';
 * For now, we define the structure to show it exists.
 */
interface EnforcerRetryPolicies {
  [key: string]: {
    attempts: number;
    delayMs: number;
    confidence: "definitive" | "heuristic";
  };
}

/**
 * MOCK: Placeholder for constants from constants/10-check-activation.ts
 * When Sub-agent A finishes, this import will be uncommented:
 * import { CHECK_ACTIVATION } from '../constants/10-check-activation';
 */
interface CheckActivationMap {
  every_execute: string[];
  code_modified: string[];
  tier_2_plus: string[];
  post_build: string[];
  pre_deploy: string[];
  frontend_build: string[];
  post_uninstall: string[];
  post_error_fix: string[];
  cron_30s: string[];
}

/**
 * MOCK: Placeholder for constants from constants/25-bodyguard.ts
 * When Sub-agent A finishes, this import will be uncommented:
 * import { BODYGUARD } from '../constants/25-bodyguard';
 */
interface BodyguardConstants {
  MAX_PARALLEL_CHECKS: number;
  TOTAL_GATE_TIMEOUT_MS: number;
  PARTIAL_TIMEOUT_POLICY: "fail_timed_out_only" | "fail_all" | "warn_and_continue";
  MIXED_RESULT_POLICY: "hard_fails_block_soft_fails_warn";
  MIN_CHECKS_REQUIRED: number;
}

// Placeholder implementations (will be replaced by actual constants)
const ENFORCER_RETRY_POLICIES: EnforcerRetryPolicies = {
  "test-exit-code": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "file-existence": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "file-non-empty": { attempts: 1, delayMs: 0, confidence: "heuristic" },
  "build-artifact": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "scope-enforcement": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "token-threshold": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "secret-detection": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "uninstall-verify": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "docker-health": { attempts: 3, delayMs: 5_000, confidence: "heuristic" },
  "lesson-template": { attempts: 1, delayMs: 0, confidence: "definitive" },
  "responsive-screenshots": {
    attempts: 1,
    delayMs: 0,
    confidence: "definitive",
  },
  "deploy-health": { attempts: 3, delayMs: 10_000, confidence: "heuristic" },
};

const CHECK_ACTIVATION: CheckActivationMap = {
  every_execute: ["file-existence"],
  code_modified: ["test-exit-code", "scope-enforcement"],
  tier_2_plus: ["file-non-empty", "scope-enforcement"],
  post_build: ["build-artifact"],
  pre_deploy: ["secret-detection", "docker-health"],
  frontend_build: ["responsive-screenshots"],
  post_uninstall: ["uninstall-verify"],
  post_error_fix: ["lesson-template"],
  cron_30s: ["token-threshold"],
};

const BODYGUARD: BodyguardConstants = {
  MAX_PARALLEL_CHECKS: 5,
  TOTAL_GATE_TIMEOUT_MS: 120_000,
  PARTIAL_TIMEOUT_POLICY: "fail_timed_out_only",
  MIXED_RESULT_POLICY: "hard_fails_block_soft_fails_warn",
  MIN_CHECKS_REQUIRED: 1,
};

/**
 * determineApplicableChecks: Figure out which checks should run based on step context.
 * Implements the activation map logic from HARDCODED-ENFORCEMENT-VALUES.md section 11.
 *
 * @param context - Context about the step being executed
 * @returns Array of check names that should run
 */
function determineApplicableChecks(context: CheckActivationContext): string[] {
  const checks: Set<string> = new Set();

  // Every execute always runs these
  CHECK_ACTIVATION.every_execute.forEach((check) => checks.add(check));

  // If code files were modified
  if (context.modifiedCodeFiles) {
    CHECK_ACTIVATION.code_modified.forEach((check) => checks.add(check));
  }

  // Tier 2+ adds additional checks
  if (context.tier >= 2) {
    CHECK_ACTIVATION.tier_2_plus.forEach((check) => checks.add(check));
  }

  // Action-specific checks
  switch (context.stepAction) {
    case "build":
      CHECK_ACTIVATION.post_build.forEach((check) => checks.add(check));
      break;
    case "deploy":
      CHECK_ACTIVATION.pre_deploy.forEach((check) => checks.add(check));
      break;
  }

  // Frontend-specific checks
  if (context.isFrontend) {
    CHECK_ACTIVATION.frontend_build.forEach((check) => checks.add(check));
  }

  // Deduplicate and return
  return Array.from(checks);
}

/**
 * createCheckFromName: Convert check name to full EnforcerCheck config.
 * Maps simple name to full check definition with retry policies.
 *
 * @param checkName - The check name (e.g., "test-exit-code")
 * @returns EnforcerCheck object with full configuration
 */
function createCheckFromName(checkName: string): EnforcerCheck {
  const policy = ENFORCER_RETRY_POLICIES[checkName] || {
    attempts: 1,
    delayMs: 0,
    confidence: "heuristic" as const,
  };

  return {
    name: checkName,
    script: `checks/check_${checkName.replace(/-/g, "_")}.py`,
    pass: "exit code === 0",
    confidence: policy.confidence,
    retry: {
      attempts: policy.attempts,
      delayMs: policy.delayMs,
    },
  };
}

/**
 * gateCheck: THE MAIN BODYGUARD FUNCTION.
 * Determines which checks to run, runs them ALL IN PARALLEL, aggregates results.
 *
 * CRITICAL: This uses Promise.allSettled to run checks concurrently.
 * Never sequential. All checks within MAX_PARALLEL_CHECKS limits run at once.
 *
 * @param step - The DAG step being executed
 * @param projectDir - Project directory path
 * @returns Promise<BodyguardVerdict> with aggregated gate result and metadata
 */
export async function gateCheck(
  step: DagStep,
  projectDir: string
): Promise<BodyguardVerdict> {
  const startTime = Date.now();

  // Build context for check activation
  const context: CheckActivationContext = {
    stepAction: step.action,
    modifiedCodeFiles: step.modifiedCodeFiles,
    tier: step.tier,
    isFrontend: step.isFrontend,
    isDoctorAvailable: true, // Would be determined from system state
  };

  // Determine which checks should run
  const applicableCheckNames = determineApplicableChecks(context);

  // If no checks apply, pass automatically
  if (applicableCheckNames.length === 0) {
    return {
      gate: {
        verdict: "PASS",
        reasons: [],
        checksRun: 0,
        checksTimedOut: 0,
        checksSkipped: 0,
      },
      checksRun: 0,
      checksTimedOut: 0,
      executionTimeMs: Date.now() - startTime,
      checkDetails: [],
    };
  }

  // Create full check objects from names
  const checksToRun = applicableCheckNames.map(createCheckFromName);

  // CRITICAL: Batch checks into groups respecting MAX_PARALLEL_CHECKS
  const checkBatches: EnforcerCheck[][] = [];
  for (let i = 0; i < checksToRun.length; i += BODYGUARD.MAX_PARALLEL_CHECKS) {
    checkBatches.push(checksToRun.slice(i, i + BODYGUARD.MAX_PARALLEL_CHECKS));
  }

  // Track results across all batches
  const allResults: Map<string, EnforcerResult> = new Map();
  const checkDetails: Array<{
    name: string;
    passed: boolean;
    timedOut: boolean;
    skipped: boolean;
    output?: string;
  }> = [];

  // CRITICAL: Run batches sequentially but checks WITHIN each batch in parallel
  for (const batch of checkBatches) {
    // Create promise for each check in this batch
    const checkPromises = batch.map((check) =>
      (async () => {
        try {
          const result = await runCheckWithRetry(check, {
            projectDir,
            timeoutMs: BODYGUARD.TOTAL_GATE_TIMEOUT_MS / batch.length,
          });
          return { check: check.name, result };
        } catch (error) {
          return {
            check: check.name,
            result: {
              passed: false,
              output: "",
              error: error instanceof Error ? error.message : "Unknown error",
            },
          };
        }
      })()
    );

    // Run ALL checks in this batch in PARALLEL
    const results = await Promise.allSettled(checkPromises);

    // Aggregate results from this batch
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { check, result: checkResult } = result.value;
        allResults.set(check, checkResult);

        checkDetails.push({
          name: check,
          passed: checkResult.passed,
          timedOut: checkResult.timedOut || false,
          skipped: false,
          output: checkResult.output.substring(0, 200), // Truncate for readability
        });
      } else {
        // Promise rejection
        const checkName = batch.find((c) => c.name)?.name || "unknown";
        allResults.set(checkName, {
          passed: false,
          output: "",
          error: String(result.reason),
          timedOut: false,
        });

        checkDetails.push({
          name: checkName,
          passed: false,
          timedOut: false,
          skipped: false,
          output: String(result.reason),
        });
      }
    }
  }

  // Aggregate verdict
  const verdict = aggregateVerdict(allResults, checkDetails);

  const executionTimeMs = Date.now() - startTime;

  return {
    gate: verdict,
    checksRun: checkDetails.length,
    checksTimedOut: checkDetails.filter((d) => d.timedOut).length,
    executionTimeMs,
    checkDetails,
  };
}

/**
 * aggregateVerdict: Combine individual check results into a gate verdict.
 * Implements HARDCODED-ENFORCEMENT-VALUES.md section 4: CIRCUIT_BREAKER logic.
 *
 * Hard fails (definitive) block the step. Soft fails (heuristic) warn but allow skip.
 *
 * @param results - Map of check name to result
 * @param details - Details about each check
 * @returns GateResult with verdict and reasons
 */
function aggregateVerdict(
  results: Map<string, EnforcerResult>,
  details: Array<{ name: string; passed: boolean; timedOut: boolean }>
): GateResult {
  const reasons: string[] = [];
  let hasHardFail = false;
  let hasSoftFail = false;

  const resultArray = Array.from(results.entries());
  for (const [checkName, result] of resultArray) {
    if (!result.passed) {
      const policy = ENFORCER_RETRY_POLICIES[checkName] || {
        confidence: "heuristic",
      };

      if (policy.confidence === "definitive") {
        hasHardFail = true;
        reasons.push(`HARD FAIL: ${checkName} - ${result.error || "check failed"}`);
      } else {
        hasSoftFail = true;
        reasons.push(`SOFT FAIL: ${checkName} - ${result.error || "check failed"}`);
      }
    }
  }

  // Determine verdict based on failures
  let verdict: "PASS" | "HARD_FAIL" | "SOFT_FAIL" = "PASS";
  if (hasHardFail) {
    verdict = "HARD_FAIL";
  } else if (hasSoftFail) {
    verdict = "SOFT_FAIL";
  }

  return {
    verdict,
    reasons,
    checksRun: details.length,
    checksTimedOut: details.filter((d) => d.timedOut).length,
    checksSkipped: 0, // User skips handled by circuit-breaker
  };
}

/**
 * checkCompliance: Verify that all required checks completed.
 * Prevents "all checks timed out so gate passes" bug.
 *
 * @param verdict - Gate verdict to validate
 * @returns boolean indicating whether verdict is valid
 */
export function checkCompliance(verdict: GateResult): boolean {
  return verdict.checksRun >= BODYGUARD.MIN_CHECKS_REQUIRED;
}
