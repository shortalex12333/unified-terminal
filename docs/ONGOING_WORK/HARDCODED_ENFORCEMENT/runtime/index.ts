// Source: Instance 4 (Code Generation Runtime)

import {
  startWarden,
  stopWarden,
  getWardenState
} from '../engine/context-warden';
import {
  clearAll
} from '../engine/cron-manager';
import {
  executeDAG as executeDAGFromScheduler
} from '../engine/step-scheduler';
import {
  updateProjectState,
  getProjectState
} from '../engine/project-state';
import * as Constants from '../constants/index';

export interface RuntimeConfig {
  projectDir: string;
  dagFile: string;
  maxConcurrentSteps: number;
  enableLogging: boolean;
  redisUrl?: string;
  postgresUrl?: string;
}

export interface RuntimeInstance {
  config: RuntimeConfig;
  constants: typeof Constants;

  // Methods
  initialize(): Promise<void>;
  executeDAG(dagJson: string): Promise<RuntimeResult>;
  shutdown(): Promise<void>;
}

export interface RuntimeResult {
  success: boolean;
  steps: Array<Record<string, unknown>>;
  totalDuration: number;
  verdict: "PASS" | "FAIL" | "USER_STOPPED";
  evidence: Record<string, unknown>;
}

/**
 * Initialize runtime with configuration
 *
 * @param config Runtime configuration
 * @returns Initialized runtime instance
 */
export async function initializeRuntime(
  config: RuntimeConfig
): Promise<RuntimeInstance> {
  // Validate config
  if (!config.projectDir) throw new Error("projectDir required");
  if (!config.dagFile) throw new Error("dagFile required");

  // Initialize project state
  updateProjectState(config.projectDir);

  // Initialize runtime instance
  const runtime: RuntimeInstance = {
    config,
    constants: Constants,

    async initialize() {
      console.log(`[Runtime] Initializing with projectDir: ${config.projectDir}`);

      // Update project state
      updateProjectState(config.projectDir);

      // Start context warden (monitors tokens every 30s)
      startWarden([]);

      console.log(`[Runtime] Initialization complete`);
    },

    async executeDAG(dagJson: string): Promise<RuntimeResult> {
      console.log(`[Runtime] Executing DAG...`);
      const startTime = Date.now();

      try {
        // Parse and execute DAG using Instance 3's executeDAG function
        const steps = JSON.parse(dagJson);
        const result = await executeDAGFromScheduler(steps, config.projectDir);

        const runtimeResult: RuntimeResult = {
          success: result.success,
          steps: (result.steps || []) as Array<Record<string, unknown>>,
          totalDuration: Date.now() - startTime,
          verdict: result.success ? "PASS" : "FAIL",
          evidence: { totalTokens: result.totalTokens }
        };
        return runtimeResult;
      } catch (error) {
        console.error(`[Runtime] DAG execution failed:`, error);
        throw error;
      }
    },

    async shutdown() {
      console.log(`[Runtime] Shutting down...`);
      stopWarden();
      clearAll();
      console.log(`[Runtime] Shutdown complete`);
    }
  };

  return runtime;
}

export default initializeRuntime;
