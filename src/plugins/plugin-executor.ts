/**
 * Plugin Executor - Manages plugin execution lifecycle
 *
 * Gate 10: GSD + Plugin Orchestration
 *
 * Handles spawning plugins via CLIRunner, tracking execution state,
 * and emitting events for progress updates.
 */

import { EventEmitter } from 'events';
import {
  PluginConfig,
  PluginInstance,
  PluginStatus,
  PluginStatusEvent,
  PluginOutputEvent,
  PluginExecuteOptions,
} from './plugin-schema';
import { getPluginRegistry } from './plugin-registry';
import { getCLIRunner, ProcessOutput, ProcessStatusEvent, ProcessStatus } from '../main/cli-runner';

// ============================================================================
// PLUGIN EXECUTOR CLASS
// ============================================================================

/**
 * Plugin Executor - Manages plugin execution.
 *
 * Events:
 * - 'status': (PluginStatusEvent) - Plugin status change
 * - 'output': (PluginOutputEvent) - Plugin output
 * - 'error': (Error & { executionId: string }) - Execution error
 */
export class PluginExecutor extends EventEmitter {
  /** Map of active plugin instances by execution ID */
  private instances: Map<string, PluginInstance> = new Map();

  /** Map of process ID to execution ID for event routing */
  private processToExecution: Map<string, string> = new Map();

  /** Counter for generating execution IDs */
  private executionCounter = 0;

  /** Reference to CLI runner */
  private cliRunner = getCLIRunner();

  constructor() {
    super();
    this.setupCLIRunnerListeners();
  }

  // ==========================================================================
  // CLI RUNNER EVENT HANDLING
  // ==========================================================================

  /**
   * Set up listeners for CLI runner events.
   */
  private setupCLIRunnerListeners(): void {
    // Forward output events
    this.cliRunner.on('output', (output: ProcessOutput) => {
      const executionId = this.processToExecution.get(output.processId);
      if (!executionId) return;

      const instance = this.instances.get(executionId);
      if (!instance) return;

      const event: PluginOutputEvent = {
        executionId,
        pluginName: instance.config.name,
        stream: output.stream,
        data: output.data,
        timestamp: output.timestamp,
      };

      this.emit('output', event);
    });

    // Forward status events
    this.cliRunner.on('status', (status: ProcessStatusEvent) => {
      const executionId = this.processToExecution.get(status.processId);
      if (!executionId) return;

      this.handleProcessStatusChange(executionId, status);
    });

    // Forward error events
    this.cliRunner.on('error', (error: Error & { processId: string }) => {
      const executionId = this.processToExecution.get(error.processId);
      if (!executionId) return;

      const errorWithId = Object.assign(new Error(error.message), { executionId });
      this.emit('error', errorWithId);
    });
  }

  /**
   * Handle process status changes and map to plugin status.
   */
  private handleProcessStatusChange(executionId: string, status: ProcessStatusEvent): void {
    const instance = this.instances.get(executionId);
    if (!instance) return;

    const pluginStatus = this.mapProcessStatusToPluginStatus(status.status);

    instance.status = pluginStatus;
    if (pluginStatus === 'completed' || pluginStatus === 'failed' || pluginStatus === 'cancelled') {
      instance.endedAt = new Date();
    }
    if (status.errorMessage) {
      instance.errorMessage = status.errorMessage;
    }

    this.emitStatus(instance, pluginStatus);
  }

  /**
   * Map CLI process status to plugin status.
   */
  private mapProcessStatusToPluginStatus(processStatus: ProcessStatus): PluginStatus {
    switch (processStatus) {
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'killed':
      case 'timeout':
        return 'cancelled';
      default:
        return 'failed';
    }
  }

  // ==========================================================================
  // EXECUTION
  // ==========================================================================

  /**
   * Execute a plugin by name.
   *
   * @param pluginName - Name of the plugin to execute
   * @param projectPath - Path to the project directory
   * @param args - Arguments to pass to the plugin
   * @param options - Execution options
   * @returns Execution ID for tracking
   * @throws Error if plugin not found or invalid
   */
  execute(
    pluginName: string,
    projectPath: string,
    args: string[] = [],
    options: PluginExecuteOptions = {}
  ): string {
    const registry = getPluginRegistry();
    const config = registry.get(pluginName);

    if (!config) {
      throw new Error(`Plugin "${pluginName}" not found in registry`);
    }

    // Check dependencies
    const depCheck = registry.checkDependencies(pluginName);
    if (!depCheck.satisfied) {
      throw new Error(`Missing dependencies for "${pluginName}": ${depCheck.missing.join(', ')}`);
    }

    // Validate plugin type
    if (config.type === 'browser') {
      throw new Error(`Browser plugins are not yet supported: ${pluginName}`);
    }

    if (!config.command) {
      throw new Error(`Plugin "${pluginName}" has no command specified`);
    }

    const executionId = this.generateExecutionId();

    // Create instance
    const instance: PluginInstance = {
      config,
      executionId,
      status: 'initializing',
      projectPath,
      args,
      startedAt: new Date(),
    };

    this.instances.set(executionId, instance);

    // Emit initializing status
    this.emitStatus(instance, 'initializing');

    // Build full args array
    const fullArgs = [...(config.defaultArgs || []), ...args];

    // Spawn the process
    try {
      const processId = this.cliRunner.spawn(config.command, fullArgs, {
        cwd: options.cwd || projectPath,
        env: options.env,
        timeout: options.timeout ?? config.timeout ?? 0,
        background: options.background ?? false,
      });

      // Store mappings
      instance.processId = processId;
      instance.status = 'running';
      this.processToExecution.set(processId, executionId);

      // Emit running status
      this.emitStatus(instance, 'running');

      console.log(`[PluginExecutor] Started ${pluginName} (${executionId}) -> process ${processId}`);

      return executionId;
    } catch (error) {
      instance.status = 'failed';
      instance.endedAt = new Date();
      instance.errorMessage = error instanceof Error ? error.message : String(error);

      this.emitStatus(instance, 'failed');

      throw error;
    }
  }

  /**
   * Execute a plugin with a specific command (for GSD-style plugins).
   *
   * @param pluginName - Name of the plugin
   * @param command - Sub-command to run (e.g., 'gsd:progress')
   * @param projectPath - Project path
   * @param args - Additional arguments
   * @param options - Execution options
   * @returns Execution ID
   */
  executeCommand(
    pluginName: string,
    command: string,
    projectPath: string,
    args: string[] = [],
    options: PluginExecuteOptions = {}
  ): string {
    // For GSD-style commands like "gsd:progress", extract the action
    const commandParts = command.split(':');
    const action = commandParts.length > 1 ? commandParts[1] : command;

    // Build args with the action
    const fullArgs = [action, ...args];

    return this.execute(pluginName, projectPath, fullArgs, options);
  }

  // ==========================================================================
  // STATUS AND CONTROL
  // ==========================================================================

  /**
   * Get the status of an execution.
   * @param executionId - Execution ID
   * @returns Plugin instance or null
   */
  getStatus(executionId: string): PluginInstance | null {
    const instance = this.instances.get(executionId);
    return instance ? { ...instance } : null;
  }

  /**
   * Get all active executions.
   * @returns Array of running plugin instances
   */
  getActiveExecutions(): PluginInstance[] {
    return Array.from(this.instances.values())
      .filter((i) => i.status === 'running' || i.status === 'initializing')
      .map((i) => ({ ...i }));
  }

  /**
   * Get all executions.
   * @returns Array of all plugin instances
   */
  getAllExecutions(): PluginInstance[] {
    return Array.from(this.instances.values()).map((i) => ({ ...i }));
  }

  /**
   * Cancel an execution.
   * @param executionId - Execution ID to cancel
   * @returns True if cancelled, false if not found
   */
  cancel(executionId: string): boolean {
    const instance = this.instances.get(executionId);
    if (!instance) {
      return false;
    }

    if (instance.status !== 'running' && instance.status !== 'initializing') {
      return false;
    }

    if (instance.processId) {
      this.cliRunner.kill(instance.processId);
    }

    instance.status = 'cancelled';
    instance.endedAt = new Date();

    this.emitStatus(instance, 'cancelled');

    return true;
  }

  /**
   * Cancel all running executions.
   */
  cancelAll(): void {
    for (const [executionId, instance] of this.instances) {
      if (instance.status === 'running' || instance.status === 'initializing') {
        this.cancel(executionId);
      }
    }
  }

  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================

  /**
   * Update progress for an execution.
   * Called externally when progress is parsed from output.
   *
   * @param executionId - Execution ID
   * @param progress - Progress percentage (0-100)
   * @param currentStep - Current step description
   */
  updateProgress(executionId: string, progress: number, currentStep?: string): void {
    const instance = this.instances.get(executionId);
    if (!instance) return;

    instance.progress = Math.min(100, Math.max(0, progress));
    if (currentStep) {
      instance.currentStep = currentStep;
    }

    // Emit progress update
    const event: PluginStatusEvent = {
      executionId,
      pluginName: instance.config.name,
      status: instance.status,
      progress: instance.progress,
      currentStep: instance.currentStep,
      timestamp: new Date(),
    };

    this.emit('status', event);
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up completed executions older than the specified age.
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   * @returns Number of executions cleaned up
   */
  cleanup(maxAge: number = 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [executionId, instance] of this.instances) {
      if (instance.status !== 'running' && instance.status !== 'initializing' && instance.endedAt) {
        const age = now - instance.endedAt.getTime();
        if (age > maxAge) {
          // Clean up process mapping
          if (instance.processId) {
            this.processToExecution.delete(instance.processId);
          }
          this.instances.delete(executionId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[PluginExecutor] Cleaned up ${cleaned} old executions`);
    }

    return cleaned;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Generate a unique execution ID.
   */
  private generateExecutionId(): string {
    this.executionCounter++;
    return `exec_${Date.now()}_${this.executionCounter}`;
  }

  /**
   * Emit a status event.
   */
  private emitStatus(instance: PluginInstance, status: PluginStatus): void {
    const event: PluginStatusEvent = {
      executionId: instance.executionId,
      pluginName: instance.config.name,
      status,
      progress: instance.progress,
      currentStep: instance.currentStep,
      errorMessage: instance.errorMessage,
      timestamp: new Date(),
    };

    this.emit('status', event);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Singleton plugin executor instance */
let executorInstance: PluginExecutor | null = null;

/**
 * Get the singleton plugin executor instance.
 */
export function getPluginExecutor(): PluginExecutor {
  if (!executorInstance) {
    executorInstance = new PluginExecutor();
  }
  return executorInstance;
}

/**
 * Cleanup plugin executor (for shutdown).
 */
export function cleanupPluginExecutor(): void {
  if (executorInstance) {
    executorInstance.cancelAll();
    executorInstance.removeAllListeners();
    executorInstance = null;
  }
}
