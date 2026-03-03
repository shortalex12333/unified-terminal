/**
 * Codex CLI Adapter
 *
 * Translates AgentConfig → Codex CLI commands.
 * Codex supports session resume (can be Conductor).
 *
 * CLI: codex [options] [prompt]
 * - --full-auto: Auto-approve all actions
 * - --json: Structured JSON output
 * - --sandbox <mode>: read-only | workspace-write
 * - -C <dir>: Working directory
 */

import { spawn, spawnSync, type ChildProcess } from 'child_process';
import type { Adapter, AgentConfig, AgentHandle, AgentResult, Capabilities, Tool } from '../types';
import { getCodexSandbox } from '../permissions';

// =============================================================================
// CONSTANTS
// =============================================================================

const CODEX_CLI = 'codex';

const CAPABILITIES: Capabilities = {
  sessionResume: true,
  jsonOutput: true,
  toolPermissions: true,
  maxPromptTokens: 200000,
  supportedTools: ['read', 'write', 'bash', 'web_search', 'edit', 'grep', 'glob'] as Tool[],
  models: {
    fast: 'gpt-4o-mini',
    standard: 'gpt-4o',
    reasoning: 'o3-mini',
  },
};

// =============================================================================
// CODEX ADAPTER
// =============================================================================

export class CodexAdapter implements Adapter {
  readonly runtime = 'codex' as const;

  capabilities(): Capabilities {
    return CAPABILITIES;
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawnSync('which', [CODEX_CLI]);
      if (proc.status !== 0) {
        resolve(false);
        return;
      }

      // Check if authenticated by running a simple command
      const authCheck = spawn(CODEX_CLI, ['--version']);
      authCheck.on('close', (code) => resolve(code === 0));
      authCheck.on('error', () => resolve(false));
    });
  }

  async spawn(config: AgentConfig): Promise<AgentHandle> {
    const args = this.buildArgs(config);
    const proc = spawn(CODEX_CLI, args, {
      cwd: config.workingDir,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Pipe prompt via stdin for large payloads
    const fullPrompt = config.secondaryInput
      ? `## PRIMARY\n${config.prompt}\n\n## SECONDARY\n${config.secondaryInput}`
      : config.prompt;

    proc.stdin?.write(fullPrompt);
    proc.stdin?.end();

    return this.createHandle(config.id, proc, config.timeout);
  }

  async kill(handle: AgentHandle): Promise<void> {
    if (handle.process) {
      handle.process.kill('SIGTERM');
      // Force kill after 5s if still running
      setTimeout(() => handle.process?.kill('SIGKILL'), 5000);
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private buildArgs(config: AgentConfig): string[] {
    const args: string[] = [];

    // Auto-approve mode (no interactive prompts)
    args.push('--full-auto');

    // JSON output for structured parsing
    args.push('--json');

    // Sandbox mode based on tool permissions
    args.push('--sandbox', getCodexSandbox(config.tools));

    // Working directory
    if (config.workingDir) {
      args.push('-C', config.workingDir);
    }

    // Model selection
    if (config.model) {
      args.push('-m', config.model);
    }

    return args;
  }

  private createHandle(id: string, proc: ChildProcess, timeout: number): AgentHandle {
    const outputHistory: string[] = [];
    const outputCallbacks: ((chunk: string) => void)[] = [];
    let result: AgentResult | null = null;
    const startTime = Date.now();

    // Collect stdout
    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      outputHistory.push(chunk);
      outputCallbacks.forEach((cb) => cb(chunk));
    });

    // Collect stderr
    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      outputHistory.push(`[stderr] ${chunk}`);
    });

    // Handle timeout
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      result = {
        id,
        status: 'timeout',
        output: outputHistory.join(''),
        filesCreated: [],
        filesModified: [],
        tokensUsed: { input: 0, output: 0 },
        duration: Date.now() - startTime,
        exitCode: null,
        runtime: 'codex',
        error: `Timeout after ${timeout}ms`,
      };
    }, timeout);

    // Create completion promise
    const onComplete = (): Promise<AgentResult> => {
      return new Promise((resolve) => {
        if (result) {
          resolve(result);
          return;
        }

        proc.on('close', (code) => {
          clearTimeout(timeoutId);

          if (result) {
            resolve(result);
            return;
          }

          const output = outputHistory.join('');
          const parsed = this.parseOutput(output);

          result = {
            id,
            status: code === 0 ? 'completed' : 'failed',
            output,
            filesCreated: parsed.filesCreated,
            filesModified: parsed.filesModified,
            tokensUsed: parsed.tokensUsed,
            duration: Date.now() - startTime,
            exitCode: code,
            runtime: 'codex',
            toolCalls: parsed.toolCalls,
            error: code !== 0 ? `Exit code ${code}` : undefined,
          };

          resolve(result);
        });
      });
    };

    return {
      id,
      process: proc,
      outputHistory,
      onOutput: (cb) => outputCallbacks.push(cb),
      onComplete,
    };
  }

  private parseOutput(output: string): {
    filesCreated: string[];
    filesModified: string[];
    tokensUsed: { input: number; output: number };
    toolCalls: string[];
  } {
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const toolCalls: string[] = [];
    let tokensUsed = { input: 0, output: 0 };

    // Parse JSON output line by line
    for (const line of output.split('\n')) {
      if (!line.trim().startsWith('{')) continue;

      try {
        const event = JSON.parse(line);

        // Extract file changes
        if (event.type === 'tool_call') {
          const tool = event.name || event.tool;
          const args = event.arguments || event.args || {};
          toolCalls.push(`${tool}: ${JSON.stringify(args).substring(0, 100)}`);

          if (tool === 'write' && args.path) {
            filesCreated.push(args.path);
          }
          if (tool === 'edit' && args.path) {
            filesModified.push(args.path);
          }
        }

        // Extract token usage
        if (event.type === 'turn.completed' && event.usage) {
          tokensUsed = {
            input: event.usage.input_tokens || 0,
            output: event.usage.output_tokens || 0,
          };
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return { filesCreated, filesModified, tokensUsed, toolCalls };
  }
}

export default CodexAdapter;
