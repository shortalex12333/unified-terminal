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

/** Maximum retry attempts before circuit breaker triggers */
const MAX_RETRIES = 3;

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

    // Initialize runtime state
    this.currentPlan = plan;
    this.stopped = false;
    this.steps.clear();

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
   * Execute a single step.
   */
  private async executeStep(
    step: RuntimeStep,
    context?: Record<string, any>
  ): Promise<void> {
    console.log(`[StepScheduler] Executing step ${step.id}: ${step.action}`);

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

    // Mark as running
    step.status = 'running';
    step.startedAt = new Date();
    this.emit('step-start', step);
    this.emitProgress(step, 0, 'Starting...');

    try {
      // Execute the step
      const result = await executor.execute(step, context);

      // Success
      step.status = 'done';
      step.result = result;
      step.endedAt = new Date();
      step.retryCount = 0; // Reset on success

      console.log(`[StepScheduler] Step ${step.id} completed successfully`);
      this.emit('step-done', step);
      this.emitProgress(step, 100, 'Complete');

    } catch (error) {
      // Failed
      step.retryCount++;
      step.error = error instanceof Error ? error.message : String(error);

      console.error(`[StepScheduler] Step ${step.id} failed (attempt ${step.retryCount}):`, step.error);

      if (step.retryCount >= MAX_RETRIES) {
        // Circuit breaker triggered
        step.status = 'needs_user';
        console.log(`[StepScheduler] Circuit breaker triggered for step ${step.id}`);
        this.emit('step-needs-user', {
          step,
          actions: ['retry', 'skip', 'stop'],
          suggested: 'skip',
          errorContext: step.error,
        } as CircuitBreakerOptions);
        this.emitProgress(step, 0, 'Needs user decision');
      } else {
        // Will retry
        step.status = 'failed';
        step.endedAt = new Date();
        this.emit('step-failed', step);
        this.emitProgress(step, 0, `Failed (attempt ${step.retryCount}/${MAX_RETRIES})`);

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
    const options: CircuitBreakerOptions = {
      step,
      actions: ['retry', 'skip', 'stop'],
      suggested: 'skip',
      errorContext: step.error || 'Unknown error',
    };

    console.log(`[StepScheduler] Asking user for decision on step ${step.id}`);

    // Emit IPC event
    this.emitIPC('step:needs-user', options);

    // Wait for user response
    return new Promise<UserDecision>((resolve) => {
      this.userDecisionResolver = resolve;

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.userDecisionResolver) {
          console.log('[StepScheduler] User response timeout, defaulting to skip');
          this.userDecisionResolver('skip');
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
