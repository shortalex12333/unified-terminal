// Enforcement Engine — Bodyguard (THE GATE)
// Dispatcher that runs ALL applicable checks IN PARALLEL.
// Never sequential. Uses Promise.allSettled to run checks concurrently.
// Aggregates results into a single verdict: PASS, HARD_FAIL, or SOFT_FAIL.

import { bodyguardEvents, spineEvents } from "../main/events";
import { readWorkOutput, type WorkOutput } from '../worker/work-output';
import type {
  BodyguardVerdict,
  GateResult,
  DagStep,
  EnforcerCheck,
  EnforcerResult,
  CheckActivationContext,
} from "./types";
import { runCheckWithRetry } from "./enforcer";
import {
  MAX_PARALLEL_CHECKS,
  TOTAL_GATE_TIMEOUT_MS,
  MIN_CHECKS_REQUIRED,
  ENFORCER_RETRY_POLICIES,
  CHECK_ACTIVATION,
  CHECK_SCRIPT_PATHS,
} from "./constants";

// ============================================================================
// CHECK ACTIVATION — Determine which checks apply to a given step
// ============================================================================

/**
 * Determine which checks should run based on step context.
 * Implements the activation map logic: checks are added based on
 * action type, tier, whether code was modified, and frontend status.
 */
function determineApplicableChecks(context: CheckActivationContext): string[] {
  const checks: Set<string> = new Set();

  // Every execute always runs these
  for (const check of CHECK_ACTIVATION.every_execute) {
    checks.add(check);
  }

  // If code files were modified
  if (context.modifiedCodeFiles) {
    for (const check of CHECK_ACTIVATION.code_modified) {
      checks.add(check);
    }
  }

  // Tier 2+ adds additional checks
  if (context.tier >= 2) {
    for (const check of CHECK_ACTIVATION.tier_2_plus) {
      checks.add(check);
    }
  }

  // Action-specific checks
  switch (context.stepAction) {
    case "build":
      for (const check of CHECK_ACTIVATION.post_build) {
        checks.add(check);
      }
      break;
    case "deploy":
      for (const check of CHECK_ACTIVATION.pre_deploy) {
        checks.add(check);
      }
      break;
    default:
      break;
  }

  // Frontend-specific checks
  if (context.isFrontend) {
    for (const check of CHECK_ACTIVATION.frontend_build) {
      checks.add(check);
    }
  }

  return Array.from(checks);
}

// ============================================================================
// CHECK FACTORY — Convert check name to full EnforcerCheck config
// ============================================================================

/**
 * Convert a check name to a full EnforcerCheck configuration.
 * Maps the simple name to script path and retry policy from constants.
 */
function createCheckFromName(checkName: string): EnforcerCheck {
  const policy = ENFORCER_RETRY_POLICIES[checkName] || {
    attempts: 1,
    delayMs: 0,
    confidence: "heuristic" as const,
  };

  // Use the explicit path mapping; fall back to interpolation only for unknown checks
  const script =
    CHECK_SCRIPT_PATHS[checkName] ??
    `checks/check_${checkName.replace(/-/g, "_")}.py`;

  return {
    name: checkName,
    script,
    pass: "exit code === 0",
    confidence: policy.confidence,
    retry: {
      attempts: policy.attempts,
      delayMs: policy.delayMs,
    },
  };
}

// ============================================================================
// WORK OUTPUT READING
// ============================================================================

/**
 * Read the worker's "show your work" output for validation context.
 */
function getWorkOutputForStep(projectRoot: string, stepId: string): WorkOutput | null {
  try {
    return readWorkOutput(projectRoot, stepId);
  } catch (error) {
    console.warn(`[Bodyguard] Could not read work output for ${stepId}:`, error);
    return null;
  }
}

// ============================================================================
// SPINE HANDOFF
// ============================================================================

/**
 * Pass accepted work to Spine for review and recording.
 * Spine will:
 * 1. Acknowledge receipt
 * 2. Write structured review
 * 3. Analyze "what's next"
 * 4. Emit event for PA
 */
function passToSpine(
  stepId: string,
  workOutput: WorkOutput,
  verdict: BodyguardVerdict
): void {
  console.log(`[Bodyguard] Passing step ${stepId} to Spine`);

  spineEvents.workAccepted({
    stepId,
    workOutput,
    verdict,
    acceptedAt: new Date().toISOString(),
  });
}

// ============================================================================
// GATE CHECK — THE MAIN BODYGUARD FUNCTION
// ============================================================================

/**
 * gateCheck: Determine which checks to run, run them ALL IN PARALLEL, aggregate results.
 *
 * Uses Promise.allSettled to run checks concurrently within MAX_PARALLEL_CHECKS batches.
 * Batches run sequentially, but checks within each batch run in parallel.
 *
 * Returns a BodyguardVerdict with:
 * - gate: PASS / HARD_FAIL / SOFT_FAIL verdict with reasons
 * - checksRun: total number of checks executed
 * - checksTimedOut: number of checks that timed out
 * - executionTimeMs: total wall-clock time
 * - checkDetails: per-check breakdown
 */
export async function gateCheck(
  step: DagStep,
  projectDir: string
): Promise<BodyguardVerdict> {
  const startTime = Date.now();

  // Build context for check activation
  // Emit gate start event after we determine check count (done below)
  const context: CheckActivationContext = {
    stepAction: step.action,
    modifiedCodeFiles: step.modifiedCodeFiles,
    tier: step.tier,
    isFrontend: step.isFrontend,
    // TODO: Wire to context-warden health probe once available
    isDoctorAvailable: false,
  };

  // Determine which checks should run
  const applicableCheckNames = determineApplicableChecks(context);

  // Emit gate start event with the step ID and check count
  bodyguardEvents.gateStart(step.id, applicableCheckNames.length);

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

  // Batch checks into groups respecting MAX_PARALLEL_CHECKS
  const checkBatches: EnforcerCheck[][] = [];
  for (let i = 0; i < checksToRun.length; i += MAX_PARALLEL_CHECKS) {
    checkBatches.push(checksToRun.slice(i, i + MAX_PARALLEL_CHECKS));
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

  // Run batches sequentially, checks WITHIN each batch in parallel.
  // Track elapsed time so later batches receive only the remaining budget.
  let elapsedMs = 0;
  for (const batch of checkBatches) {
    const remainingMs = TOTAL_GATE_TIMEOUT_MS - elapsedMs;
    if (remainingMs <= 0) break;
    const perCheckTimeout = Math.max(1000, Math.floor(remainingMs / batch.length));
    const batchStart = Date.now();

    const checkPromises = batch.map((check) =>
      (async () => {
        try {
          const result = await runCheckWithRetry(check, {
            projectDir,
            timeoutMs: perCheckTimeout,
          });
          return { check: check.name, result };
        } catch (error) {
          return {
            check: check.name,
            result: {
              passed: false,
              output: "",
              error: error instanceof Error ? error.message : "Unknown error",
            } as EnforcerResult,
          };
        }
      })()
    );

    // Run ALL checks in this batch in PARALLEL
    const results = await Promise.allSettled(checkPromises);

    // Aggregate results from this batch
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        const { check, result: checkResult } = result.value;
        allResults.set(check, checkResult);

        // Emit check complete event
        bodyguardEvents.checkComplete(check, checkResult.passed);

        checkDetails.push({
          name: check,
          passed: checkResult.passed,
          timedOut: checkResult.timedOut || false,
          skipped: false,
          output: checkResult.output.substring(0, 200), // Truncate for readability
        });
      } else {
        // Promise rejection — use the batch check name for identification
        const checkName = batch[i]?.name || "unknown";
        allResults.set(checkName, {
          passed: false,
          output: "",
          error: String(result.reason),
          timedOut: false,
        });

        // Emit check complete event for failed check
        bodyguardEvents.checkComplete(checkName, false);

        checkDetails.push({
          name: checkName,
          passed: false,
          timedOut: false,
          skipped: false,
          output: String(result.reason),
        });
      }
    }

    elapsedMs += Date.now() - batchStart;
  }

  // Aggregate verdict
  const verdict = aggregateVerdict(allResults);

  // Emit pass or fail event based on verdict
  if (verdict.verdict === "PASS") {
    bodyguardEvents.pass(step.id);

    // If passed, hand off to Spine
    const workOutput = getWorkOutputForStep(projectDir, step.id);
    if (workOutput) {
      // Signal Spine to take over
      passToSpine(step.id, workOutput, {
        gate: verdict,
        checksRun: checkDetails.length,
        checksTimedOut: checkDetails.filter((d) => d.timedOut).length,
        executionTimeMs: Date.now() - startTime,
        checkDetails,
      });
    }
  } else {
    const failReason = verdict.reasons.join("; ") || "Check(s) failed";
    bodyguardEvents.fail(step.id, failReason);
  }

  return {
    gate: verdict,
    checksRun: checkDetails.length,
    checksTimedOut: checkDetails.filter((d) => d.timedOut).length,
    executionTimeMs: Date.now() - startTime,
    checkDetails,
  };
}

// ============================================================================
// VERDICT AGGREGATION
// ============================================================================

/**
 * Combine individual check results into a gate verdict.
 *
 * Hard fails (definitive confidence) block the step entirely.
 * Soft fails (heuristic confidence) warn but allow user to skip.
 */
function aggregateVerdict(
  results: Map<string, EnforcerResult>
): GateResult {
  const reasons: string[] = [];
  let hasHardFail = false;
  let hasSoftFail = false;
  let timedOutCount = 0;

  results.forEach((result, checkName) => {
    if (result.timedOut) {
      timedOutCount++;
    }

    if (!result.passed) {
      const policy = ENFORCER_RETRY_POLICIES[checkName] || {
        confidence: "heuristic" as const,
      };

      if (policy.confidence === "definitive") {
        hasHardFail = true;
        reasons.push(`HARD FAIL: ${checkName} - ${result.error || "check failed"}`);
      } else {
        hasSoftFail = true;
        reasons.push(`SOFT FAIL: ${checkName} - ${result.error || "check failed"}`);
      }
    }
  });

  let verdict: "PASS" | "HARD_FAIL" | "SOFT_FAIL" = "PASS";
  if (hasHardFail) {
    verdict = "HARD_FAIL";
  } else if (hasSoftFail) {
    verdict = "SOFT_FAIL";
  }

  return {
    verdict,
    reasons,
    checksRun: results.size,
    checksTimedOut: timedOutCount,
    checksSkipped: 0, // User skips handled by circuit-breaker layer
  };
}

// ============================================================================
// COMPLIANCE CHECK
// ============================================================================

/**
 * Verify that enough checks ran to produce a valid verdict.
 * Prevents the "all checks timed out so gate passes" bug.
 */
export function checkCompliance(verdict: GateResult): boolean {
  return verdict.checksRun >= MIN_CHECKS_REQUIRED;
}
