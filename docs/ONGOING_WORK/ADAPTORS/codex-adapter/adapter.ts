/**
 * Codex Adapter
 *
 * Spawns Codex CLI in exec (non-interactive) mode for autonomous agent execution.
 * Handles process lifecycle, output streaming, and result parsing.
 *
 * Usage:
 *   import { spawnCodexAgent } from './adapter';
 *
 *   const handle = await spawnCodexAgent({
 *     id: 'task-001',
 *     name: 'code-reviewer',
 *     prompt: 'Review the code in src/index.ts',
 *     tools: ['read'],
 *     workingDir: '/path/to/project',
 *   });
 *
 *   handle.onOutput((chunk) => console.log(chunk));
 *   const result = await handle.onComplete();
 */

import { spawn, ChildProcess } from 'child_process';
import type { AgentConfig, AgentHandle, AgentResult, SandboxMode, Tool } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const CODEX_CLI = 'codex';
const DEFAULT_TIMEOUT = 120000; // 2 minutes

// Tools that grant write access
const WRITE_TOOLS: Tool[] = ['write', 'edit'];

// =============================================================================
// SANDBOX LOGIC
// =============================================================================

/**
 * Determine sandbox mode based on tool permissions.
 * If any write tool is present, use workspace-write.
 */
export function getSandboxMode(tools: Tool[]): SandboxMode {
  const hasWrite = tools.some((t) => WRITE_TOOLS.includes(t));
  return hasWrite ? 'workspace-write' : 'read-only';
}

// =============================================================================
// COMMAND BUILDER
// =============================================================================

/**
 * Build Codex CLI arguments.
 *
 * Command structure:
 *   codex exec --full-auto --json --sandbox <mode> -C <dir> [-m <model>]
 *
 * Prompt is passed via stdin.
 */
function buildArgs(config: AgentConfig): string[] {
  const args: string[] = ['exec'];

  // Non-interactive auto-approval
  args.push('--full-auto');

  // JSON output for structured parsing
  args.push('--json');

  // Sandbox mode based on tool permissions
  args.push('--sandbox', getSandboxMode(config.tools));

  // Working directory
  args.push('-C', config.workingDir);

  // Optional model (only if specified)
  if (config.model && config.model.trim() !== '') {
    args.push('-m', config.model);
  }

  return args;
}

// =============================================================================
// OUTPUT PARSER
// =============================================================================

/**
 * Parse JSONL output from Codex exec --json.
 * Extracts file operations and other metadata.
 */
function parseOutput(output: string): { filesCreated: string[]; filesModified: string[] } {
  const filesCreated: string[] = [];
  const filesModified: string[] = [];

  for (const line of output.split('\n')) {
    if (!line.trim().startsWith('{')) continue;

    try {
      const event = JSON.parse(line);

      // Extract file operations from tool calls
      if (event.type === 'tool_call' || event.tool_call) {
        const tool = event.name || event.tool || event.tool_call?.name;
        const args = event.arguments || event.args || event.tool_call?.arguments || {};

        if ((tool === 'write' || tool === 'write_file') && args.path) {
          filesCreated.push(args.path);
        }
        if ((tool === 'edit' || tool === 'edit_file') && args.path) {
          filesModified.push(args.path);
        }
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return {
    filesCreated: [...new Set(filesCreated)],
    filesModified: [...new Set(filesModified)],
  };
}

// =============================================================================
// AGENT SPAWNER
// =============================================================================

/**
 * Spawn a Codex agent.
 *
 * @param config - Agent configuration
 * @returns Handle to the running agent
 */
export function spawnCodexAgent(config: AgentConfig): AgentHandle {
  const args = buildArgs(config);
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const startTime = Date.now();

  // Spawn process
  const proc = spawn(CODEX_CLI, args, {
    cwd: config.workingDir,
    env: { ...process.env, ...config.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Send prompt via stdin
  proc.stdin?.write(config.prompt);
  proc.stdin?.end();

  // State
  const outputChunks: string[] = [];
  const outputCallbacks: ((chunk: string) => void)[] = [];
  let result: AgentResult | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  // Collect stdout
  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    outputChunks.push(chunk);
    outputCallbacks.forEach((cb) => cb(chunk));
  });

  // Collect stderr (prefix for clarity)
  proc.stderr?.on('data', (data: Buffer) => {
    const chunk = `[stderr] ${data.toString()}`;
    outputChunks.push(chunk);
    outputCallbacks.forEach((cb) => cb(chunk));
  });

  // Timeout handler
  timeoutId = setTimeout(() => {
    if (!result) {
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 5000);

      result = {
        id: config.id,
        status: 'timeout',
        exitCode: null,
        output: outputChunks.join(''),
        duration: Date.now() - startTime,
        error: `Timeout after ${timeout}ms`,
        filesCreated: [],
        filesModified: [],
      };
    }
  }, timeout);

  // Completion promise
  const onComplete = (): Promise<AgentResult> => {
    return new Promise((resolve) => {
      if (result) {
        resolve(result);
        return;
      }

      proc.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (result) {
          resolve(result);
          return;
        }

        const output = outputChunks.join('');
        const parsed = parseOutput(output);

        result = {
          id: config.id,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          output,
          duration: Date.now() - startTime,
          error: code !== 0 ? `Exit code ${code}` : undefined,
          filesCreated: parsed.filesCreated,
          filesModified: parsed.filesModified,
        };

        resolve(result);
      });
    });
  };

  // Kill function
  const kill = (): void => {
    if (timeoutId) clearTimeout(timeoutId);
    proc.kill('SIGTERM');
    setTimeout(() => proc.kill('SIGKILL'), 5000);

    if (!result) {
      result = {
        id: config.id,
        status: 'killed',
        exitCode: null,
        output: outputChunks.join(''),
        duration: Date.now() - startTime,
        error: 'Killed by caller',
        filesCreated: [],
        filesModified: [],
      };
    }
  };

  return {
    id: config.id,
    process: proc,
    onOutput: (cb) => outputCallbacks.push(cb),
    onComplete,
    kill,
  };
}

// =============================================================================
// AVAILABILITY CHECK
// =============================================================================

/**
 * Check if Codex CLI is available and authenticated.
 */
export async function isCodexAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('codex', ['--version'], { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { AgentConfig, AgentHandle, AgentResult, SandboxMode, Tool } from './types';
