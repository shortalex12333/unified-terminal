/**
 * Step Scheduler - DAG Executor for Execution Plans
 *
 * Executes multi-step plans from the Conductor with:
 * - DAG-based dependency resolution (waitFor)
 * - Circuit breaker pattern (3 retries, then ask user)
 * - Real-time progress events via IPC
 * - Dynamic re-planning on failures
 */

import { EventEmitter } from 'events';
import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { schedulerEvents, checkpointEvents } from './events';
import { getCheckpointManager, CheckpointResult } from './checkpoint-manager';

// Enforcement Engine (Phase 5: 10-step flow)
import { gateCheck, buildSpine, compareSpines } from '../enforcement';
import type { SpineState, DagStep, BodyguardVerdict } from '../enforcement';
import { CIRCUIT_BREAKER, ENFORCER_RETRY_POLICIES } from '../enforcement/constants';

// Skill System (Phase 3/5: selection + verification)
import { selectSkills, validateSelection, parseVerifyBlock, getChecksForSkill, executeVerifyCommand, isCommandAllowed } from '../skills';
import type { SkillSelection } from '../skills';

// Glue Layer (Phase 4/5: prompt assembly + result normalization)
import { assemblePrompt } from '../glue/assemble-prompt';
import { normalize } from '../glue/normalizer';
import type { GateCheckInput } from '../glue/normalizer';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Target system for step execution.
 */
export type StepTarget = 'web' | 'cli' | 'service';

/**
 * Step execution status.
 */
export type StepStatus =
  | 'pending'      // Not yet started
  | 'running'      // Currently executing
  | 'done'         // Completed successfully
  | 'failed'       // Failed (may retry)
  | 'skipped'      // Skipped by user or dependency failure
  | 'needs_user';  // Circuit breaker triggered, waiting for user

/**
 * A step in an execution plan (from Conductor).
 */
export interface PlanStep {
  /** Unique step identifier */
  id: number;
  /** Target execution system */
  target: StepTarget;
  /** Action to perform (e.g., 'scrape', 'generate', 'deploy') */
  action: string;
  /** Human-readable description */
  detail: string;
  /** Step IDs that must complete before this step */
  waitFor: number[];
  /** Whether this step can run in parallel with others */
  parallel: boolean;
}

/**
 * Runtime step with execution state.
 */
export interface RuntimeStep extends PlanStep {
  /** Current execution status */
  status: StepStatus;
  /** Number of retry attempts made */
  retryCount: number;
  /** Result data if successful */
  result?: any;
  /** Error message if failed */
  error?: string;
  /** When execution started */
  startedAt?: Date;
  /** When execution ended */
  endedAt?: Date;
  /** Confidence level of the last failure (definitive checks cannot be skipped) */
  _lastFailureConfidence?: 'definitive' | 'heuristic';
}

/**
 * Execution plan from Conductor.
 */
export interface ExecutionPlan {
  /** Plan identifier */
  planId: string;
  /** Human-readable name */
  name: string;
  /** Steps to execute */
  steps: PlanStep[];
  /** Context data for step execution */
  context?: Record<string, any>;
}

/**
 * Result of executing a plan.
 */
export interface PlanExecutionResult {
  /** Plan identifier */
  planId: string;
  /** Whether all steps completed successfully */
  success: boolean;
  /** All steps with final states */
  steps: RuntimeStep[];
  /** Total execution time in ms */
  durationMs: number;
  /** Summary of step outcomes */
  summary: {
    total: number;
    done: number;
    failed: number;
    skipped: number;
  };
}

/**
 * User decision for circuit breaker.
 */
export type UserDecision = 'retry' | 'skip' | 'stop';

/**
 * Options presented to user when circuit breaker triggers.
 */
export interface CircuitBreakerOptions {
  /** Step that failed */
  step: RuntimeStep;
  /** Available actions */
  actions: UserDecision[];
  /** Suggested action */
  suggested: UserDecision;
  /** Error context */
  errorContext: string;
}

/**
 * Progress event emitted during execution.
 */
export interface StepProgressEvent {
  /** Plan identifier */
  planId: string;
  /** Step being updated */
  step: RuntimeStep;
  /** Progress percentage (0-100) for running steps */
  progress?: number;
  /** Current activity description */
  activity?: string;
}

/**
 * Executor interface for step execution.
 * Implementations handle different target types.
 */
export interface Executor {
  /** Execute a step and return result */
  execute(step: RuntimeStep, context?: Record<string, any>): Promise<any>;
  /** Check if this executor can handle the step */
  canHandle(step: RuntimeStep): boolean;
  /** Cancel ongoing execution (if supported) */
  cancel?(): void;
}

/**
 * Conductor interface for re-planning.
 */
export interface Conductor {
  /** Request a new plan based on current state */
  replan(
    originalPlan: ExecutionPlan,
    failedStep: RuntimeStep,
    completedSteps: RuntimeStep[]
  ): Promise<ExecutionPlan | null>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum retry attempts before circuit breaker triggers (sourced from enforcement constants) */
const MAX_RETRIES = CIRCUIT_BREAKER.MAX_STEP_RETRIES;

/** Delay between retries (exponential backoff base) */
const RETRY_BASE_DELAY_MS = 1000;

/** Timeout for user response on circuit breaker */
const USER_RESPONSE_TIMEOUT_MS = 300000; // 5 minutes

// ============================================================================
// STEP SCHEDULER CLASS
// ============================================================================

/**
 * StepScheduler - DAG executor for multi-step plans.
 *
 * Events:
 * - 'progress': (StepProgressEvent) - Step progress updates
 * - 'step-start': (RuntimeStep) - Step execution starting
 * - 'step-done': (RuntimeStep) - Step completed successfully
 * - 'step-failed': (RuntimeStep) - Step failed
 * - 'step-skipped': (RuntimeStep) - Step was skipped
 * - 'step-needs-user': (CircuitBreakerOptions) - Circuit breaker triggered
 * - 'plan-complete': (PlanExecutionResult) - Entire plan finished
 */
export class StepScheduler extends EventEmitter {
  /** Runtime steps with execution state */
  private steps: Map<number, RuntimeStep> = new Map();

  /** Current plan being executed */
  private currentPlan: ExecutionPlan | null = null;

  /** Registered executors by target type */
  private executors: Map<StepTarget, Executor> = new Map();

  /** Conductor for re-planning (optional) */
  private conductor: Conductor | null = null;

  /** Main window reference for IPC */
  private mainWindow: BrowserWindow | null = null;

  /** Whether execution is stopped */
  private stopped: boolean = false;

  /** Pending user decision promise resolver */
  private userDecisionResolver: ((decision: UserDecision) => void) | null = null;

  /** Track if first output checkpoint has been shown */
  private firstOutputShown: boolean = false;

  /** Count of completed steps for progress checkpoint */
  private completedStepCount: number = 0;

  constructor() {
    super();
    this.setupIPC();
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Register an executor for a target type.
   */
  registerExecutor(target: StepTarget, executor: Executor): void {
    this.executors.set(target, executor);
    console.log(`[StepScheduler] Registered executor for target: ${target}`);
  }

  /**
   * Set the conductor for re-planning support.
   */
  setConductor(conductor: Conductor): void {
    this.conductor = conductor;
    console.log('[StepScheduler] Conductor registered for re-planning');
  }

  /**
   * Set the main window for IPC communication.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  // ==========================================================================
  // MAIN EXECUTION
  // ==========================================================================

  /**
   * Execute an entire plan.
   */
  async execute(plan: ExecutionPlan): Promise<PlanExecutionResult> {
    console.log(`[StepScheduler] Starting execution of plan: ${plan.planId}`);
    const startTime = Date.now();

    // Emit plan start event
    schedulerEvents.planStart(plan.planId, plan.steps.length);

    // Initialize runtime state
    this.currentPlan = plan;
    this.stopped = false;
    this.steps.clear();

    // Reset checkpoint state for this plan
    this.firstOutputShown = false;
    this.completedStepCount = 0;

    // Reset checkpoint manager state
    const checkpointManager = getCheckpointManager();
    checkpointManager.reset();

    // Convert plan steps to runtime steps
    for (const step of plan.steps) {
      this.steps.set(step.id, {
        ...step,
        status: 'pending',
        retryCount: 0,
      });
    }

    // Execute the DAG
    try {
      await this.executeDAG(plan.context);
    } catch (error) {
      console.error('[StepScheduler] Plan execution error:', error);
    }

    // Build result
    const allSteps = Array.from(this.steps.values());
    const result: PlanExecutionResult = {
      planId: plan.planId,
      success: allSteps.every(s => s.status === 'done' || s.status === 'skipped'),
      steps: allSteps,
      durationMs: Date.now() - startTime,
      summary: {
        total: allSteps.length,
        done: allSteps.filter(s => s.status === 'done').length,
        failed: allSteps.filter(s => s.status === 'failed').length,
        skipped: allSteps.filter(s => s.status === 'skipped').length,
      },
    };

    console.log(`[StepScheduler] Plan ${plan.planId} complete:`, result.summary);
    this.emit('plan-complete', result);
    this.emitIPC('step:plan-complete', result);

    // Emit plan complete event to Status Agent
    schedulerEvents.planComplete(plan.planId, result.success, result.summary);

    this.currentPlan = null;
    return result;
  }

  /**
   * Stop current execution.
   */
  stop(): void {
    console.log('[StepScheduler] Stopping execution');
    this.stopped = true;

    // Cancel any running executors
    Array.from(this.executors.values()).forEach(executor => {
      executor.cancel?.();
    });

    // Resolve any pending user decision with 'stop'
    if (this.userDecisionResolver) {
      this.userDecisionResolver('stop');
      this.userDecisionResolver = null;
    }
  }

  // ==========================================================================
  // DAG EXECUTION
  // ==========================================================================

  /**
   * Execute steps respecting DAG dependencies.
   * MVP: Sequential execution (one step at a time).
   */
  private async executeDAG(context?: Record<string, any>): Promise<void> {
    while (!this.stopped) {
      // Find steps ready to execute (all dependencies done/skipped)
      const readySteps = this.getReadySteps();

      if (readySteps.length === 0) {
        // Check if we're done or stuck
        const pendingSteps = Array.from(this.steps.values()).filter(
          s => s.status === 'pending' || s.status === 'running'
        );

        if (pendingSteps.length === 0) {
          // All steps processed
          break;
        }

        // Still waiting for something - shouldn't happen in sequential mode
        console.warn('[StepScheduler] No ready steps but pending steps exist');
        break;
      }

      // MVP: Execute one step at a time (sequential)
      // TODO: For parallel execution, execute all readySteps concurrently
      const step = readySteps[0];
      await this.executeStep(step, context);

      // If step needs user decision, wait for it
      if (step.status === 'needs_user') {
        const decision = await this.askUser(step);
        await this.handleUserDecision(step, decision, context);
      }

      // Report progress and potentially get re-plan
      if (step.status === 'failed' || step.status === 'done') {
        await this.reportAndReplan(step, context);
      }
    }
  }

  /**
   * Get steps that are ready to execute.
   * A step is ready when all its waitFor dependencies are done or skipped.
   */
  private getReadySteps(): RuntimeStep[] {
    const ready: RuntimeStep[] = [];

    for (const step of Array.from(this.steps.values())) {
      if (step.status !== 'pending') {
        continue;
      }

      // Check if all dependencies are satisfied
      const dependenciesMet = step.waitFor.every(depId => {
        const dep = this.steps.get(depId);
        return dep && (dep.status === 'done' || dep.status === 'skipped');
      });

      // Check if any dependency failed (should skip this step)
      const dependencyFailed = step.waitFor.some(depId => {
        const dep = this.steps.get(depId);
        return dep && dep.status === 'failed';
      });

      if (dependencyFailed) {
        // Skip this step due to failed dependency
        step.status = 'skipped';
        step.error = 'Skipped due to dependency failure';
        this.emit('step-skipped', step);
        this.emitProgress(step, 0, 'Skipped - dependency failed');

        // Emit step skipped event to Status Agent
        schedulerEvents.stepSkipped(step.id, 'Dependency failed');
        continue;
      }

      if (dependenciesMet) {
        ready.push(step);
      }
    }

    return ready;
  }

  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================

  /**
   * Execute a single step through the 10-step enforcement flow.
   *
   * Flow:
   *   1. Pre-spine snapshot
   *   2. Skill selection (keyword fallback, future: agent)
   *   3. Assemble prompt (targeted skill sections + spine context)
   *   4. Pre-step bodyguard gate
   *   5. Execute via adapter/executor
   *   6. Normalize result (AgentResult → GateCheckInput)
   *   7. Post-spine snapshot
   *   8. Post-step bodyguard gate
   *   9. Skill verification (## verify blocks + CRITICAL_SKILL_CHECKS)
   *  10. PA comparison (pre vs post spine diff)
   */
  private async executeStep(
    step: RuntimeStep,
    context?: Record<string, any>
  ): Promise<void> {
    console.log(`[StepScheduler] Executing step ${step.id}: ${step.action}`);
    const projectDir = context?.projectDir || process.cwd();

    // Get appropriate executor
    const executor = this.executors.get(step.target);
    if (!executor) {
      step.status = 'failed';
      step.error = `No executor registered for target: ${step.target}`;
      step.endedAt = new Date();
      this.emit('step-failed', step);
      this.emitProgress(step, 0, step.error);
      return;
    }

    if (!executor.canHandle(step)) {
      step.status = 'failed';
      step.error = `Executor cannot handle action: ${step.action}`;
      step.endedAt = new Date();
      this.emit('step-failed', step);
      this.emitProgress(step, 0, step.error);
      return;
    }

    // ========================================================================
    // CHECKPOINT: PRE_DEPLOY - Before any deploy action
    // CRITICAL: Never auto-deploy. User MUST explicitly approve.
    // ========================================================================
    const checkpointManager = getCheckpointManager();
    if (checkpointManager.isDeployAction(step.action)) {
      // Determine deploy target from step detail or action
      const deployTarget = this.extractDeployTarget(step);

      checkpointEvents.preDeployWaiting(step.id, deployTarget);
      const deployResult = await checkpointManager.waitForPreDeploy(step.id, deployTarget);

      if (!deployResult.proceed) {
        console.log(`[StepScheduler] Deploy checkpoint ${deployResult.value}: ${deployResult.reason || 'User declined'}`);

        if (deployResult.value === 'review') {
          // User wants to review first - skip this step but continue execution
          step.status = 'skipped';
          step.error = 'Skipped for review before deploy';
          step.endedAt = new Date();
          this.emit('step-skipped', step);
          this.emitProgress(step, 0, 'Skipped - review requested');
          schedulerEvents.stepSkipped(step.id, 'Review before deploy');
          return;
        }

        // User cancelled the deploy
        step.status = 'skipped';
        step.error = 'Deploy cancelled by user';
        step.endedAt = new Date();
        this.emit('step-skipped', step);
        this.emitProgress(step, 0, 'Deploy cancelled');
        schedulerEvents.stepSkipped(step.id, 'Deploy cancelled by user');
        return;
      }

      console.log('[StepScheduler] Deploy checkpoint approved, proceeding');
    }

    // Mark as running
    step.status = 'running';
    step.startedAt = new Date();
    this.emit('step-start', step);
    this.emitProgress(step, 0, 'Starting...');

    // Emit step start event to Status Agent
    schedulerEvents.stepStart(step.id, step.action, step.detail);

    try {
      // ====================================================================
      // STEP 1: PRE-SPINE SNAPSHOT
      // ====================================================================
      this.emitProgress(step, 5, 'Capturing pre-state...');
      let preSpine: SpineState | null = null;
      try {
        preSpine = await buildSpine(projectDir, this.buildDagProgress(step.id));
      } catch (err) {
        console.warn(`[StepScheduler] Pre-spine snapshot failed (non-fatal):`, err);
      }

      // ====================================================================
      // STEP 2: SKILL SELECTION
      // ====================================================================
      this.emitProgress(step, 10, 'Selecting skills...');
      let skillSelection: SkillSelection = { skills: [], reasoning: 'No skills selected' };
      const skillsBasePath = path.resolve(__dirname, '../../resources/skills');
      const catalogPath = path.join(skillsBasePath, 'trigger-map.json');

      try {
        const stepTier = step.target === 'service' ? 0 : step.target === 'cli' ? 2 : 1;
        const rawSelection = await selectSkills({
          stepAction: step.action,
          stepDetail: step.detail,
          spineSummary: preSpine?.changesSummary || '',
          tier: stepTier,
        }, catalogPath);

        // Validate selection against hard rails
        const validated = validateSelection(rawSelection, skillsBasePath, stepTier);
        skillSelection = {
          skills: validated.skills.map(s => path.join(skillsBasePath, s)),
          reasoning: rawSelection.reasoning,
        };
      } catch (err) {
        console.warn(`[StepScheduler] Skill selection failed (non-fatal):`, err);
      }

      // ====================================================================
      // STEP 3: ASSEMBLE PROMPT
      // ====================================================================
      this.emitProgress(step, 15, 'Assembling prompt...');
      let assembledPrompt: string | null = null;
      if (skillSelection.skills.length > 0) {
        try {
          const parts = assemblePrompt({
            skills: skillSelection.skills,
            userInput: step.detail,
            spineContext: {
              projectDir,
              recentChanges: preSpine?.gitStatus?.uncommitted || [],
              tokenBudget: { used: 0, limit: 400_000 },
            },
            mode: 'targeted',
            highRisk: step.action === 'deploy',
            multiStep: step.parallel,
          });
          assembledPrompt = parts.skillSections + '\n' + parts.spineContext + '\n' + parts.userInput;
        } catch (err) {
          console.warn(`[StepScheduler] Prompt assembly failed (non-fatal):`, err);
        }
      }

      // ====================================================================
      // STEP 4: PRE-STEP BODYGUARD GATE
      // ====================================================================
      this.emitProgress(step, 20, 'Pre-step gate check...');
      const dagStep: DagStep = {
        id: String(step.id),
        phase: 'execution',
        task: step.detail,
        action: mapActionToEnforcement(step.action),
        worker: step.target === 'service' ? 'hybrid' : step.target,
        tools: [],
        declaredFiles: [],
        modifiedCodeFiles: false,
        isFrontend: false,
        tier: step.target === 'service' ? 1 : step.target === 'cli' ? 2 : 1,
        timeout: 120_000,
        dependsOn: step.waitFor.map(String),
      };

      let preGateVerdict: BodyguardVerdict | null = null;
      try {
        preGateVerdict = await gateCheck(dagStep, projectDir);
        if (preGateVerdict.gate.verdict === 'HARD_FAIL') {
          step._lastFailureConfidence = 'definitive';
          step.status = 'failed';
          step.error = `Pre-step gate HARD_FAIL: ${preGateVerdict.gate.reasons.join('; ')}`;
          step.endedAt = new Date();
          this.emit('step-failed', step);
          this.emitProgress(step, 0, 'Blocked by pre-step gate');
          return;
        }
        if (preGateVerdict.gate.verdict === 'SOFT_FAIL') {
          console.warn(`[StepScheduler] Pre-step soft fails:`, preGateVerdict.gate.reasons);
        }
      } catch (err) {
        console.warn(`[StepScheduler] Pre-step gate check failed (non-fatal):`, err);
      }

      // ====================================================================
      // STEP 5: EXECUTE VIA ADAPTER
      // ====================================================================
      this.emitProgress(step, 30, 'Executing...');
      const executionContext = assembledPrompt
        ? { ...context, assembledPrompt }
        : context;

      const result = await executor.execute(step, executionContext);

      // ====================================================================
      // STEP 6: NORMALIZE RESULT
      // ====================================================================
      this.emitProgress(step, 70, 'Normalizing result...');
      let gateInput: GateCheckInput | null = null;
      try {
        gateInput = normalize(
          { id: step.id, target: step.target, action: step.action, detail: step.detail, waitFor: step.waitFor, parallel: step.parallel },
          {
            id: String(step.id),
            status: 'completed',
            output: typeof result === 'string' ? result : JSON.stringify(result || ''),
            filesCreated: result?.filesCreated || [],
            filesModified: result?.filesModified || [],
            tokensUsed: result?.tokensUsed || { input: 0, output: 0 },
            duration: Date.now() - (step.startedAt?.getTime() || Date.now()),
            exitCode: result?.exitCode ?? 0,
            runtime: 'codex',
          },
          projectDir,
        );
      } catch (err) {
        console.warn(`[StepScheduler] Result normalization failed (non-fatal):`, err);
      }

      // ====================================================================
      // STEP 7: POST-SPINE SNAPSHOT
      // ====================================================================
      this.emitProgress(step, 75, 'Capturing post-state...');
      let postSpine: SpineState | null = null;
      try {
        postSpine = await buildSpine(projectDir, this.buildDagProgress(step.id));
      } catch (err) {
        console.warn(`[StepScheduler] Post-spine snapshot failed (non-fatal):`, err);
      }

      // ====================================================================
      // STEP 8: POST-STEP BODYGUARD GATE
      // ====================================================================
      this.emitProgress(step, 80, 'Post-step gate check...');
      if (gateInput) {
        // Update dagStep with actual execution data
        dagStep.modifiedCodeFiles = gateInput.step.modifiedCodeFiles;
        dagStep.isFrontend = gateInput.step.isFrontend;
        dagStep.declaredFiles = gateInput.step.declaredFiles;
      }

      let postGateVerdict: BodyguardVerdict | null = null;
      try {
        postGateVerdict = await gateCheck(dagStep, projectDir);
        if (postGateVerdict.gate.verdict === 'HARD_FAIL') {
          step._lastFailureConfidence = 'definitive';
          step.status = 'failed';
          step.error = `Post-step gate HARD_FAIL: ${postGateVerdict.gate.reasons.join('; ')}`;
          step.endedAt = new Date();
          this.emit('step-failed', step);
          this.emitProgress(step, 0, 'Blocked by post-step gate');
          return;
        }
        if (postGateVerdict.gate.verdict === 'SOFT_FAIL') {
          console.warn(`[StepScheduler] Post-step soft fails:`, postGateVerdict.gate.reasons);
        }
      } catch (err) {
        console.warn(`[StepScheduler] Post-step gate check failed (non-fatal):`, err);
      }

      // ====================================================================
      // STEP 9: SKILL VERIFICATION (## verify blocks + CRITICAL_SKILL_CHECKS)
      // ====================================================================
      this.emitProgress(step, 85, 'Verifying skills...');
      if (skillSelection.skills.length > 0) {
        try {
          const fs = await import('fs');
          for (const skillPath of skillSelection.skills) {
            if (!fs.existsSync(skillPath)) continue;

            const content = fs.readFileSync(skillPath, 'utf-8');
            const skillName = path.basename(skillPath);
            const checks = getChecksForSkill(skillName, content);

            for (const check of checks) {
              const allowed = isCommandAllowed(check.check);
              if (allowed.allowed) {
                const cmdResult = await executeVerifyCommand(check.check, projectDir);
                if (cmdResult.exitCode !== 0 && check.rail === 'HARD') {
                  console.warn(`[StepScheduler] Skill HARD check failed: ${check.name} in ${skillName} (exit ${cmdResult.exitCode})`);
                }
              }
            }
          }
        } catch (err) {
          console.warn(`[StepScheduler] Skill verification failed (non-fatal):`, err);
        }
      }

      // ====================================================================
      // STEP 10: PA COMPARISON (pre vs post spine diff)
      // ====================================================================
      this.emitProgress(step, 90, 'Comparing state...');
      if (preSpine && postSpine) {
        try {
          const diff = compareSpines(preSpine, postSpine);
          console.log(`[StepScheduler] PA diff for step ${step.id}: +${diff.filesAdded.length} -${diff.filesRemoved.length} ~${diff.filesModified.length}`);

          // Attach diff to step result for traceability
          if (result && typeof result === 'object') {
            result._spineDiff = diff;
          }
        } catch (err) {
          console.warn(`[StepScheduler] PA comparison failed (non-fatal):`, err);
        }
      }

      // ====================================================================
      // SUCCESS
      // ====================================================================
      step.status = 'done';
      step.result = result;
      step.endedAt = new Date();
      step.retryCount = 0;

      console.log(`[StepScheduler] Step ${step.id} completed successfully (10-step flow)`);
      this.emit('step-done', step);
      this.emitProgress(step, 100, 'Complete');

      // Emit step done event to Status Agent
      schedulerEvents.stepDone(step.id, step.action);

      // Update completed step count for progress checkpoint
      this.completedStepCount++;

      // ====================================================================
      // CHECKPOINT: FIRST_OUTPUT - After first step produces visible output
      // ====================================================================
      if (!this.firstOutputShown && this.currentPlan) {
        const checkpointManager = getCheckpointManager();
        const outputSummary = this.summarizeStepOutput(step, result);

        if (outputSummary) {
          checkpointEvents.firstOutputWaiting(step.id);
          const firstOutputResult = await checkpointManager.waitForFirstOutput(step.id, outputSummary);

          if (!firstOutputResult.proceed) {
            console.log(`[StepScheduler] First output checkpoint ${firstOutputResult.value}`);

            if (firstOutputResult.value === 'restart') {
              // User wants to start over - stop execution
              this.stopped = true;
              return;
            } else if (firstOutputResult.value === 'modify') {
              // User wants to adjust - allow conductor to replan
              // For now, just log and continue
              console.log('[StepScheduler] User requested modification at first output');
            }
          }

          this.firstOutputShown = true;
        }
      }

      // ====================================================================
      // CHECKPOINT: PROGRESS_CHECK - Every 5 completed steps
      // ====================================================================
      if (this.currentPlan) {
        const checkpointManager = getCheckpointManager();
        checkpointManager.onStepComplete(
          step.id,
          this.completedStepCount,
          this.currentPlan.steps.length
        );
      }

    } catch (error) {
      // Failed
      step.retryCount++;
      step.error = error instanceof Error ? error.message : String(error);

      console.error(`[StepScheduler] Step ${step.id} failed (attempt ${step.retryCount}):`, step.error);

      if (step.retryCount >= MAX_RETRIES) {
        // Circuit breaker triggered — confidence-aware action filtering
        const isDefinitive = step._lastFailureConfidence === 'definitive';
        const actions = isDefinitive
          ? [...CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS]
          : [...CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS];
        const suggested: UserDecision = isDefinitive ? 'retry' : 'skip';

        step.status = 'needs_user';
        console.log(`[StepScheduler] Circuit breaker triggered for step ${step.id} (confidence: ${isDefinitive ? 'definitive' : 'heuristic'})`);
        this.emit('step-needs-user', {
          step,
          actions,
          suggested,
          errorContext: step.error,
        } as CircuitBreakerOptions);
        this.emitProgress(step, 0, 'Needs user decision');

        // Emit needs user event to Status Agent
        schedulerEvents.needsUser(step.id, ['retry', 'skip', 'stop']);
      } else {
        // Will retry
        step.status = 'failed';
        step.endedAt = new Date();
        this.emit('step-failed', step);
        this.emitProgress(step, 0, `Failed (attempt ${step.retryCount}/${MAX_RETRIES})`);

        // Emit step failed event to Status Agent
        schedulerEvents.stepFailed(step.id, step.action, step.error || 'Unknown error', step.retryCount);

        // Exponential backoff delay
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, step.retryCount - 1);
        console.log(`[StepScheduler] Retrying step ${step.id} in ${delay}ms`);
        await this.sleep(delay);

        // Reset to pending for retry
        step.status = 'pending';
      }
    }
  }

  // ==========================================================================
  // CIRCUIT BREAKER
  // ==========================================================================

  /**
   * Ask user for decision on failed step.
   */
  private async askUser(step: RuntimeStep): Promise<UserDecision> {
    const isDefinitive = step._lastFailureConfidence === 'definitive';
    const actions = isDefinitive
      ? [...CIRCUIT_BREAKER.DEFINITIVE_FAIL_OPTIONS]
      : [...CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS];
    const suggested: UserDecision = isDefinitive ? 'retry' : 'skip';
    const defaultOnTimeout: UserDecision = isDefinitive ? 'stop' : 'skip';

    const options: CircuitBreakerOptions = {
      step,
      actions,
      suggested,
      errorContext: step.error || 'Unknown error',
    };

    console.log(`[StepScheduler] Asking user for decision on step ${step.id} (definitive: ${isDefinitive})`);

    // Emit IPC event
    this.emitIPC('step:needs-user', options);

    // Wait for user response
    return new Promise<UserDecision>((resolve) => {
      this.userDecisionResolver = resolve;

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.userDecisionResolver) {
          console.log(`[StepScheduler] User response timeout, defaulting to ${defaultOnTimeout}`);
          this.userDecisionResolver(defaultOnTimeout);
          this.userDecisionResolver = null;
        }
      }, USER_RESPONSE_TIMEOUT_MS);
    });
  }

  /**
   * Handle user decision from circuit breaker.
   */
  private async handleUserDecision(
    step: RuntimeStep,
    decision: UserDecision,
    context?: Record<string, any>
  ): Promise<void> {
    console.log(`[StepScheduler] User decision for step ${step.id}: ${decision}`);

    switch (decision) {
      case 'retry':
        // Reset retry count and re-execute
        step.retryCount = 0;
        step.status = 'pending';
        step.error = undefined;
        await this.executeStep(step, context);
        break;

      case 'skip':
        // Mark as skipped and continue
        step.status = 'skipped';
        step.endedAt = new Date();
        this.emit('step-skipped', step);
        this.emitProgress(step, 0, 'Skipped by user');
        break;

      case 'stop':
        // Stop entire execution
        this.stop();
        break;
    }
  }

  // ==========================================================================
  // RE-PLANNING
  // ==========================================================================

  /**
   * Report step status to conductor and potentially merge re-plan.
   */
  private async reportAndReplan(
    step: RuntimeStep,
    context?: Record<string, any>
  ): Promise<void> {
    if (!this.conductor || !this.currentPlan) {
      return;
    }

    // Only request re-plan on failure
    if (step.status !== 'failed') {
      return;
    }

    console.log(`[StepScheduler] Requesting re-plan for failed step ${step.id}`);

    try {
      const completedSteps = Array.from(this.steps.values()).filter(
        s => s.status === 'done' || s.status === 'skipped'
      );

      const newPlan = await this.conductor.replan(
        this.currentPlan,
        step,
        completedSteps
      );

      if (newPlan && newPlan.steps.length > 0) {
        console.log(`[StepScheduler] Merging re-plan with ${newPlan.steps.length} new steps`);
        this.mergePlan(newPlan);
      }
    } catch (error) {
      console.error('[StepScheduler] Re-planning failed:', error);
    }
  }

  /**
   * Merge a new plan into the current execution.
   */
  private mergePlan(newPlan: ExecutionPlan): void {
    // Find the highest existing step ID
    let maxId = 0;
    for (const step of Array.from(this.steps.values())) {
      maxId = Math.max(maxId, step.id);
    }

    // Add new steps with adjusted IDs
    for (const step of newPlan.steps) {
      const adjustedId = step.id + maxId + 1;
      const adjustedWaitFor = step.waitFor.map(id => id + maxId + 1);

      this.steps.set(adjustedId, {
        ...step,
        id: adjustedId,
        waitFor: adjustedWaitFor,
        status: 'pending',
        retryCount: 0,
      });
    }

    // Update current plan
    if (this.currentPlan) {
      this.currentPlan.steps = Array.from(this.steps.values());
    }

    console.log(`[StepScheduler] Merged plan now has ${this.steps.size} total steps`);
  }

  // ==========================================================================
  // IPC SETUP
  // ==========================================================================

  /**
   * Set up IPC handlers for circuit breaker responses.
   */
  private setupIPC(): void {
    // Handle user decision from renderer
    ipcMain.handle('step:user-decision', async (
      _event,
      stepId: number,
      decision: UserDecision
    ): Promise<boolean> => {
      console.log(`[IPC] step:user-decision received: step ${stepId}, decision ${decision}`);

      if (this.userDecisionResolver) {
        this.userDecisionResolver(decision);
        this.userDecisionResolver = null;
        return true;
      }

      console.warn('[StepScheduler] Received user decision but no resolver pending');
      return false;
    });

    // Handle stop request from renderer
    ipcMain.handle('step:stop', async (): Promise<void> => {
      console.log('[IPC] step:stop received');
      this.stop();
    });

    // Get current execution status
    ipcMain.handle('step:status', async (): Promise<{
      isRunning: boolean;
      planId: string | null;
      steps: RuntimeStep[];
    }> => {
      return {
        isRunning: this.currentPlan !== null && !this.stopped,
        planId: this.currentPlan?.planId ?? null,
        steps: Array.from(this.steps.values()),
      };
    });
  }

  // ==========================================================================
  // PROGRESS EVENTS
  // ==========================================================================

  /**
   * Emit progress event for a step.
   */
  private emitProgress(
    step: RuntimeStep,
    progress?: number,
    activity?: string
  ): void {
    if (!this.currentPlan) {
      return;
    }

    const event: StepProgressEvent = {
      planId: this.currentPlan.planId,
      step,
      progress,
      activity,
    };

    this.emit('progress', event);
    this.emitIPC('step:progress', event);
  }

  /**
   * Emit an IPC event to the renderer.
   */
  private emitIPC(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Summarize step output for the FIRST_OUTPUT checkpoint.
   * Returns null if there's no meaningful output to show.
   */
  private summarizeStepOutput(step: RuntimeStep, result: any): string | null {
    if (!result) return null;

    // Check for files created/modified
    const filesCreated = result?.filesCreated || result?._spineDiff?.filesAdded || [];
    const filesModified = result?.filesModified || result?._spineDiff?.filesModified || [];

    const parts: string[] = [];

    if (filesCreated.length > 0) {
      parts.push(`Created ${filesCreated.length} file(s): ${filesCreated.slice(0, 3).join(', ')}${filesCreated.length > 3 ? '...' : ''}`);
    }

    if (filesModified.length > 0) {
      parts.push(`Modified ${filesModified.length} file(s): ${filesModified.slice(0, 3).join(', ')}${filesModified.length > 3 ? '...' : ''}`);
    }

    // If no files, check for output text
    if (parts.length === 0) {
      const output = typeof result === 'string' ? result : result?.output;
      if (output && output.length > 10) {
        parts.push(`Output: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`);
      }
    }

    if (parts.length === 0) return null;

    return `Step ${step.id} (${step.action}):\n${parts.join('\n')}`;
  }

  /**
   * Extract deploy target from step information.
   * Used for the PRE_DEPLOY checkpoint message.
   */
  private extractDeployTarget(step: RuntimeStep): string {
    const detail = step.detail.toLowerCase();
    const action = step.action.toLowerCase();

    // Common deploy targets
    if (detail.includes('vercel') || action.includes('vercel')) return 'Vercel';
    if (detail.includes('netlify') || action.includes('netlify')) return 'Netlify';
    if (detail.includes('github pages') || detail.includes('gh-pages')) return 'GitHub Pages';
    if (detail.includes('heroku') || action.includes('heroku')) return 'Heroku';
    if (detail.includes('aws') || action.includes('aws')) return 'AWS';
    if (detail.includes('gcp') || detail.includes('google cloud')) return 'Google Cloud';
    if (detail.includes('azure') || action.includes('azure')) return 'Azure';
    if (detail.includes('cloudflare') || action.includes('cloudflare')) return 'Cloudflare';
    if (detail.includes('render') || action.includes('render')) return 'Render';
    if (detail.includes('fly.io') || action.includes('fly')) return 'Fly.io';

    // Default to generic
    return 'production';
  }

  /**
   * Build a dagProgress snapshot from the scheduler's internal step state.
   * Used to pass real DAG progress to buildSpine() instead of hardcoded zeros.
   */
  private buildDagProgress(currentStepId?: number): SpineState["dagProgress"] {
    const allSteps = Array.from(this.steps.values());
    const failedSteps = allSteps
      .filter(s => s.status === 'failed')
      .map(s => String(s.id));

    return {
      totalSteps: allSteps.length,
      completedSteps: allSteps.filter(s => s.status === 'done').length,
      failedSteps,
      currentStep: currentStepId !== undefined ? String(currentStepId) : undefined,
    };
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current execution status.
   */
  getStatus(): {
    isRunning: boolean;
    planId: string | null;
    steps: RuntimeStep[];
  } {
    return {
      isRunning: this.currentPlan !== null && !this.stopped,
      planId: this.currentPlan?.planId ?? null,
      steps: Array.from(this.steps.values()),
    };
  }

  /**
   * Get a specific step by ID.
   */
  getStep(stepId: number): RuntimeStep | undefined {
    return this.steps.get(stepId);
  }
}

// ============================================================================
// ENFORCEMENT HELPERS
// ============================================================================

/**
 * Map scheduler action strings to enforcement DagStep action types.
 * Enforcement expects a constrained set; scheduler actions are freeform.
 */
function mapActionToEnforcement(
  action: string
): 'execute' | 'build' | 'deploy' | 'test' | 'cleanup' | 'verify' {
  const normalized = action.toLowerCase();
  if (normalized.includes('build') || normalized.includes('scaffold')) return 'build';
  if (normalized.includes('deploy')) return 'deploy';
  if (normalized.includes('test')) return 'test';
  if (normalized.includes('clean') || normalized.includes('remove')) return 'cleanup';
  if (normalized.includes('verify') || normalized.includes('check')) return 'verify';
  return 'execute';
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let schedulerInstance: StepScheduler | null = null;

/**
 * Get the singleton StepScheduler instance.
 */
export function getStepScheduler(): StepScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new StepScheduler();
  }
  return schedulerInstance;
}

/**
 * Cleanup the scheduler on app quit.
 */
export function cleanupStepScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance.removeAllListeners();
    schedulerInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  USER_RESPONSE_TIMEOUT_MS,
};
