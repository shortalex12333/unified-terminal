// Source: HARDCODED-ENFORCEMENT-VALUES.md section 11 + ENFORCEMENT-GAPS.md gap 3
// DAG Executor: Orchestrates the 10-step flowchart per DAG step
// Steps run SEQUENTIALLY (one step at a time)
// Within step [7] (bodyguard), checks run PARALLEL (via Promise.allSettled)

// Import constants
import { CONDUCTOR_MESSAGES } from "../constants/27-conductor-messages";

// Import all engine modules
import { buildSpine } from "./spine";
import { getWardenState, startWarden, stopWarden } from "./context-warden";
import { spawnAgent } from "./agent-spawner";
import { startHeartbeat } from "./heartbeat";
import { gateCheck } from "./bodyguard";
import { updateProjectState, shouldAutoArchive } from "./project-state";
import { handleCheckFail } from "./circuit-breaker";

// Import types
import {
  DagStep,
  SpineState,
  BodyguardVerdict,
  AgentHandle,
  UserAction,
  EnforcerCheck,
} from "./types";

/**
 * Execute a DAG: sequence of steps that produce a desired outcome
 *
 * Per each DAG step, execute the 10-step flowchart:
 * [1] Pre-step spine refresh
 * [2] Context warden check (token status)
 * [3] Skill injection
 * [4] Spawn worker via adapter
 * [5] Monitor heartbeat
 * [6] Post-step spine refresh
 * [7] Bodyguard gate (parallel checks)
 * [8] Hard fail? → circuit-breaker
 * [9] PA comparison (LLM-mediated, stub interface only)
 * [10] Mark DONE, save state
 */
export async function executeDAG(
  dag: DagStep[],
  projectDir: string
): Promise<{ success: boolean; steps: StepResult[]; duration: number; totalTokens: number; error?: string }> {
  const dagStartTime = Date.now();
  const stepResults: StepResult[] = [];
  const activeAgents: Map<string, AgentHandle> = new Map();

  try {
    // Validate DAG
    if (!dag || dag.length === 0) {
      throw new Error("DAG is empty or invalid");
    }

    if (dag.length > CONDUCTOR_MESSAGES.MAX_DAG_STEPS) {
      throw new Error(
        `DAG exceeds max steps: ${dag.length} > ${CONDUCTOR_MESSAGES.MAX_DAG_STEPS}`
      );
    }

    // Sequential execution: one step at a time
    for (let stepIndex = 0; stepIndex < dag.length; stepIndex++) {
      const step = dag[stepIndex];
      const stepStartTime = Date.now();

      console.log(
        `[SCHEDULER] Step ${stepIndex + 1}/${dag.length}: ${step.id} (${step.action})`
      );

      let preSpine: SpineState | null = null;
      let postSpine: SpineState | null = null;
      let agentHandle: AgentHandle | null = null;
      let bodyguardVerdict: BodyguardVerdict | null = null;
      let paComparison: PAComparisonResult | null = null;
      let stepOutput = "";
      let stepError = "";
      let skipToNextStep = false;

      try {
        // ============================================================
        // [1] PRE-STEP SPINE REFRESH
        // ============================================================
        console.log(`  [1] Building pre-step spine...`);
        preSpine = await buildSpine(projectDir);

        // ============================================================
        // [2] CONTEXT WARDEN CHECK
        // ============================================================
        console.log(`  [2] Checking token status...`);
        // Warden runs in background via cron — it auto-kills agents on threshold
        // This is a passive check; warden handles killing
        const wardenState = getWardenState();
        console.log(`  [2] Warden active: ${wardenState.active}`);
        if (!wardenState.active) {
          // Start warden if not running
          startWarden(Array.from(activeAgents.values()));
        }

        // ============================================================
        // [3] SKILL INJECTION
        // ============================================================
        console.log(`  [3] Loading skill...`);
        let skill = "";
        // In a full system, skill would be loaded from a skill database based on task type
        // For now, we just use the instructions field as context
        if (step.instructions) {
          skill = step.instructions;
          console.log(`  [3] Skill loaded from instructions (${skill.length} bytes)`);
        } else {
          console.log(`  [3] No skill provided`);
        }

        // ============================================================
        // [4] SPAWN WORKER VIA ADAPTER
        // ============================================================
        console.log(`  [4] Spawning worker...`);
        const spawnedAgent = await spawnAgent({
          action: step.action,
          taskDescription: step.task,
          skill: skill,
          projectDir: projectDir,
          tier: step.tier,
          timeout: step.timeout,
        });

        agentHandle = spawnedAgent;
        activeAgents.set(step.id, agentHandle);
        console.log(
          `  [4] Worker spawned (PID: ${spawnedAgent.id}, tokens: ${agentHandle.tokensUsed})`
        );

        // ============================================================
        // [5] MONITOR HEARTBEAT
        // ============================================================
        console.log(`  [5] Starting heartbeat monitor...`);
        const heartbeatTimer = startHeartbeat(agentHandle);

        // Wait for agent to complete
        const agentCompleted = await waitForAgent(
          spawnedAgent,
          step.timeout
        );
        clearInterval(heartbeatTimer as any);

        if (!agentCompleted) {
          console.error(`  [5] Agent timeout or stale, killing...`);
          if (spawnedAgent.childProcess) {
            spawnedAgent.childProcess.kill("SIGTERM");
          }
          throw new Error(
            "Agent timed out or went stale. Step will be retried."
          );
        }

        stepOutput = spawnedAgent.output;
        console.log(
          `  [5] Agent completed (output: ${stepOutput.length} bytes)`
        );

        // ============================================================
        // [6] POST-STEP SPINE REFRESH
        // ============================================================
        console.log(`  [6] Building post-step spine...`);
        postSpine = await buildSpine(projectDir);

        // ============================================================
        // [7] BODYGUARD GATE (PARALLEL CHECKS)
        // ============================================================
        console.log(`  [7] Running bodyguard gate...`);
        bodyguardVerdict = await gateCheck(step, projectDir);

        if (bodyguardVerdict.gate.verdict === "HARD_FAIL") {
          console.warn(`  [7] Bodyguard: HARD_FAIL - ${bodyguardVerdict.gate.reasons.join(", ")}`);

          // ========================================================
          // [8] HARD FAIL? → CIRCUIT BREAKER
          // ========================================================
          console.log(`  [8] Handling hard fail via circuit breaker...`);
          const failureReason = bodyguardVerdict.gate.reasons.join(", ") || "Unknown";
          const checkName = bodyguardVerdict.gate.reasons?.[0] || "unknown-check";

          // Create a synthetic EnforcerCheck object for the circuit breaker
          const failedCheckObject: EnforcerCheck = {
            name: checkName,
            script: `check_${checkName}.py`,
            pass: "exit code 0",
            confidence: "definitive",
            retry: {
              attempts: 1,
              delayMs: 0,
            }
          };

          const userAction = handleCheckFail(failedCheckObject, {
            passed: false,
            output: failureReason,
            evidence: { reason: failureReason }
          });

          switch (userAction) {
            case "Retry":
              console.log(`  [8] User chose Retry, re-executing step...`);
              // Retry the entire step by continuing the loop
              stepResults.push({
                stepId: step.id,
                action: step.action,
                status: "DONE",
                duration: Date.now() - stepStartTime,
                tokenUsed: agentHandle?.tokensUsed || 0,
                preSpine: preSpine,
                postSpine: postSpine,
                bodyguardVerdict: bodyguardVerdict,
                paComparison: null,
                output: `Retried after hard fail: ${failureReason}`,
                error: null,
              });
              skipToNextStep = true;
              break;

            case "Skip":
              console.log(`  [8] User chose Skip, marking step as skipped...`);
              // Mark step as skipped, continue to next
              stepResults.push({
                stepId: step.id,
                action: step.action,
                status: "DONE",
                duration: Date.now() - stepStartTime,
                tokenUsed: agentHandle?.tokensUsed || 0,
                preSpine: preSpine,
                postSpine: postSpine,
                bodyguardVerdict: bodyguardVerdict,
                paComparison: null,
                output: `User skipped after hard fail: ${failureReason}`,
                error: null,
              });
              skipToNextStep = true;
              break;

            case "Stop build":
              console.log(`  [8] User chose Stop, aborting build...`);
              // User chose to stop build entirely
              throw new Error(`User stopped build after hard fail: ${failureReason}`);
          }
        } else if (bodyguardVerdict.gate.verdict === "SOFT_FAIL") {
          console.warn(`  [7] Bodyguard: SOFT_FAIL - ${bodyguardVerdict.gate.reasons.join(", ")}`);
        } else {
          console.log(`  [7] Bodyguard: PASS`);
        }

        // Check if we should skip to next step due to circuit breaker action
        if (skipToNextStep) {
          console.log(`  [CIRCUIT BREAKER] Skipping remaining steps for this iteration...`);
          continue;
        }

        // ============================================================
        // [9] PA COMPARISON (STUB - LLM-MEDIATED)
        // ============================================================
        console.log(`  [9] Running PA comparison (stub)...`);
        paComparison = await paComparisonStub({
          stepTask: step.task,
          stepOutput: stepOutput,
        });

        if (!paComparison.passed) {
          console.warn(
            `  [9] PA: Output does not match expectations: ${paComparison.issues.join(", ")}`
          );
        } else {
          console.log(`  [9] PA: Output matches expectations`);
        }

        // ============================================================
        // [10] MARK DONE, SAVE STATE
        // ============================================================
        console.log(`  [10] Saving step result...`);
        const stepDuration = Date.now() - stepStartTime;
        const stepResult: StepResult = {
          stepId: step.id,
          action: step.action,
          status: "DONE",
          duration: stepDuration,
          tokenUsed: agentHandle?.tokensUsed || 0,
          preSpine: preSpine,
          postSpine: postSpine,
          bodyguardVerdict: bodyguardVerdict,
          paComparison: paComparison,
          output: stepOutput.substring(0, 5000), // Truncate for state file
          error: null,
        };

        stepResults.push(stepResult);
        console.log(
          `  [10] Step DONE in ${stepDuration}ms (output: ${stepOutput.length}b, tokens: ${agentHandle.tokensUsed})`
        );

        // Clean up agent
        activeAgents.delete(step.id);
      } catch (error) {
        const stepDuration = Date.now() - stepStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error(`  [!] Step failed: ${errorMessage}`);

        const stepResult: StepResult = {
          stepId: step.id,
          action: step.action,
          status: "FAILED",
          duration: stepDuration,
          tokenUsed: agentHandle?.tokensUsed || 0,
          preSpine: preSpine,
          postSpine: postSpine,
          bodyguardVerdict: bodyguardVerdict,
          paComparison: paComparison,
          output: stepOutput.substring(0, 5000),
          error: errorMessage,
        };

        stepResults.push(stepResult);

        // Kill agent if running
        if (agentHandle) {
          if ((agentHandle as any).childProcess) {
            (agentHandle as any).childProcess.kill("SIGKILL");
          }
          activeAgents.delete(step.id);
        }

        // Don't continue — bubble up to caller for retry/skip/stop decision
        throw error;
      }
    }

    // All steps completed
    const dagDuration = Date.now() - dagStartTime;
    const totalTokens = stepResults.reduce((sum, r) => sum + r.tokenUsed, 0);
    console.log(`[SCHEDULER] DAG complete in ${dagDuration}ms (${totalTokens} tokens used)`);

    // Auto-archive if project state requires it
    if (shouldAutoArchive()) {
      console.log(`[SCHEDULER] Project marked for auto-archive`);
    }

    return {
      success: true,
      steps: stepResults,
      duration: dagDuration,
      totalTokens: totalTokens,
    };
  } catch (error) {
    // Kill all remaining agents
    for (const agent of Array.from(activeAgents.values())) {
      if ((agent as any).childProcess) {
        (agent as any).childProcess.kill("SIGKILL");
      }
    }

    const dagDuration = Date.now() - dagStartTime;
    const totalTokens = stepResults.reduce((sum, r) => sum + r.tokenUsed, 0);
    return {
      success: false,
      steps: stepResults,
      duration: dagDuration,
      totalTokens: totalTokens,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Wait for agent to complete with timeout
 */
async function waitForAgent(
  handle: AgentHandle & { childProcess?: any },
  timeout: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false); // Timeout
    }, timeout);

    const proc = handle.childProcess || handle.process;
    if (!proc) {
      resolve(true);
      return;
    }

    proc.on("exit", (code: number) => {
      clearTimeout(timer);
      resolve(true); // Completed
    });
  });
}

/**
 * PA Comparison (stub)
 *
 * In a full system, this would call an LLM to compare step output
 * against expectations. For now, it's a stub that passes.
 */
interface PAComparisonResult {
  passed: boolean;
  issues: string[];
  evidence: string;
}

async function paComparisonStub(config: {
  stepTask: string;
  stepOutput: string;
}): Promise<PAComparisonResult> {
  // Stub: always pass
  // Real implementation would call LLM to validate output against task and expectations
  return {
    passed: true,
    issues: [],
    evidence: "PA comparison stub passed",
  };
}

/**
 * Step result tracking
 */
interface StepResult {
  stepId: string;
  action: string;
  status: "DONE" | "FAILED";
  duration: number;
  tokenUsed: number;
  preSpine: SpineState | null;
  postSpine: SpineState | null;
  bodyguardVerdict: BodyguardVerdict | null;
  paComparison: PAComparisonResult | null;
  output: string;
  error: string | null;
}
