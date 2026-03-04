// Source: Instance 4 - Agent spawning

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentConfig {
  type: 'codex' | 'claude' | 'gemini';
  sessionId: string;
  taskJson: string;
  timeout: number;
  skills?: string[];
}

export interface AgentResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
}

/**
 * Spawn an agent process and capture output
 *
 * @param config Agent configuration
 * @returns Execution result
 */
export async function spawnAgent(config: AgentConfig): Promise<AgentResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Determine CLI command based on agent type
    const cliCommand = getCLICommand(config.type);
    const args = buildCLIArguments(config);

    console.log(`[Agent] Spawning ${config.type}: ${cliCommand} ${args.join(' ')}`);

    const process = childProcess.spawn(cliCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: config.timeout * 1000
    });

    // Capture output
    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle timeout
    const timer = setTimeout(() => {
      timedOut = true;
      process.kill('SIGTERM');
    }, config.timeout * 1000 + 1000);

    // Handle completion
    process.on('close', (exitCode) => {
      clearTimeout(timer);

      const duration = Date.now() - startTime;

      resolve({
        exitCode: exitCode || 0,
        stdout,
        stderr,
        duration,
        timedOut
      });
    });

    // Handle errors
    process.on('error', (error) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;

      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + `\nError: ${error.message}`,
        duration,
        timedOut: false
      });
    });

    // Send task to stdin if applicable
    if (config.taskJson) {
      process.stdin?.write(config.taskJson);
      process.stdin?.end();
    }
  });
}

/**
 * Get CLI command for agent type
 */
function getCLICommand(type: 'codex' | 'claude' | 'gemini'): string {
  // These are example commands; actual paths depend on installation
  switch (type) {
    case 'codex':
      return 'codex';
    case 'claude':
      return 'claude';
    case 'gemini':
      return 'gcloud';
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

/**
 * Build CLI arguments based on config
 */
function buildCLIArguments(config: AgentConfig): string[] {
  const args: string[] = [];

  switch (config.type) {
    case 'codex':
      args.push('execute', '--session-id', config.sessionId, '--full-auto');
      break;

    case 'claude':
      args.push('run', '--session-id', config.sessionId);
      break;

    case 'gemini':
      args.push('ai', 'analyze', '--session-id', config.sessionId);
      break;
  }

  // Add skills if provided
  if (config.skills && config.skills.length > 0) {
    args.push('--skills', config.skills.join(','));
  }

  return args;
}

export default spawnAgent;
