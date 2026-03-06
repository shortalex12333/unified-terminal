// Source: Instance 4 - DAG execution orchestrator

import { StateStore, ActionExecution } from '../state/state-store';
import { spawnAgent } from '../adapters/agent-adapter';
import { DagStep, Dag } from '../state/dag-loader';
import { v4 as uuid } from 'uuid';

export interface ExecutionContext {
  dag: Dag;
  projectDir: string;
  maxConcurrentSteps: number;
  logging: boolean;
}

export interface ExecutionResult {
  dagId: string;
  success: boolean;
  steps: StepExecutionResult[];
  totalDuration: number;
  verdict: 'PASS' | 'FAIL' | 'USER_STOPPED';
  startTime: string;
  endTime: string;
}

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  passed: boolean;
  skipped: boolean;
  duration: number;
  agentOutput: string;
  checks: CheckResult[];
  userAction?: 'Retry' | 'Skip' | 'Stop';
}

export interface CheckResult {
  checkName: string;
  passed: boolean;
  output: string;
  duration: number;
  failureMode: 'HARD' | 'SOFT';
}

/**
 * Main DAG executor
 */
export class DAGExecutor {
  private stateStore: StateStore;

  constructor(
    private context: ExecutionContext
  ) {
    this.stateStore = new StateStore(context.projectDir);
  }

  /**
   * Execute entire DAG
   */
  async execute(): Promise<ExecutionResult> {
    const startTime = new Date();
    const results: StepExecutionResult[] = [];
    let verdict: 'PASS' | 'FAIL' | 'USER_STOPPED' = 'PASS';

    try {
      // Execute each step sequentially (can be parallelized based on dependencies)
      for (const step of this.context.dag.steps) {
        this.log(`[DAG] Executing step: ${step.name}`);

        try {
          const result = await this.executeStep(step);
          results.push(result);

          // Check for user stop
          if (result.userAction === 'Stop') {
            verdict = 'USER_STOPPED';
            break;
          }

          // Check for hard failure
          if (!result.passed && result.checks.some(c => c.failureMode === 'HARD')) {
            verdict = 'FAIL';
            // Continue to allow circuit breaker to handle
          }
        } catch (error) {
          this.log(`[DAG] Step failed with error: ${error}`);
          verdict = 'FAIL';

          results.push({
            stepId: step.id,
            stepName: step.name,
            passed: false,
            skipped: false,
            duration: 0,
            agentOutput: String(error),
            checks: []
          });

          break;
        }
      }
    } catch (error) {
      this.log(`[DAG] Execution failed: ${error}`);
      verdict = 'FAIL';
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    return {
      dagId: this.context.dag.id,
      success: verdict === 'PASS',
      steps: results,
      totalDuration: duration,
      verdict,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
  }

  /**
   * Execute single step
   */
  private async executeStep(step: DagStep): Promise<StepExecutionResult> {
    const stepStartTime = Date.now();
    const stepId = uuid();

    try {
      // Spawn agent via adapter
      const agentResult = await spawnAgent({
        type: 'codex',
        sessionId: step.id,
        taskJson: JSON.stringify(step),
        timeout: step.timeout,
        skills: step.skills
      });

      // Run basic checks (stub - would call enforcer.ts in real implementation)
      const checks: CheckResult[] = [
        {
          checkName: 'exit_code',
          passed: agentResult.exitCode === 0,
          output: `Exit code: ${agentResult.exitCode}`,
          duration: agentResult.duration,
          failureMode: 'HARD'
        }
      ];

      const duration = Date.now() - stepStartTime;

      // Determine pass/fail
      const hardFails = checks.filter(c => c.failureMode === 'HARD' && !c.passed);
      const passed = hardFails.length === 0 && agentResult.exitCode === 0;

      // Record execution
      const execution: ActionExecution = {
        id: stepId,
        stepName: step.name,
        agentType: 'codex',
        startTime: new Date(stepStartTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        passed,
        output: agentResult.stdout,
        checks: checks.map(c => ({
          checkName: c.checkName,
          passed: c.passed,
          output: c.output,
          duration: c.duration
        }))
      };

      await this.stateStore.recordActionExecution(execution);

      return {
        stepId,
        stepName: step.name,
        passed,
        skipped: false,
        duration,
        agentOutput: agentResult.stdout,
        checks
      };
    } catch (error) {
      return {
        stepId,
        stepName: step.name,
        passed: false,
        skipped: false,
        duration: Date.now() - stepStartTime,
        agentOutput: String(error),
        checks: []
      };
    }
  }

  private log(message: string): void {
    if (this.context.logging) {
      console.log(message);
    }
  }
}

export default DAGExecutor;
