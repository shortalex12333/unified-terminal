/**
 * Gemini CLI Adapter
 *
 * Translates AgentConfig → Gemini CLI commands.
 * CRITICAL: Gemini does NOT support session resume.
 * Can only be used as Worker, not Conductor.
 *
 * CLI: gemini [options] [prompt]
 * - -p "<prompt>": Direct prompt (or stdin)
 * - -o stream-json: JSON output
 * - --approval-mode <mode>: plan | yolo | auto_edit | default
 * - --sandbox: Read-only mode
 * - -m <model>: Model selection
 */

import { spawn, spawnSync, type ChildProcess } from 'child_process';
import type { Adapter, AgentConfig, AgentHandle, AgentResult, Capabilities, Tool } from '../types';
import { getGeminiApproval, isReadOnly } from '../permissions';

// =============================================================================
// CONSTANTS
// =============================================================================

const GEMINI_CLI = 'gemini';
const AUTH_REQUIRED_EXIT_CODE = 41;

const CAPABILITIES: Capabilities = {
  sessionResume: false, // CRITICAL: Cannot resume sessions
  jsonOutput: true,
  toolPermissions: true,
  maxPromptTokens: 2000000,
  supportedTools: ['read', 'write', 'bash', 'web_search', 'edit', 'grep', 'glob'] as Tool[],
  models: {
    fast: 'gemini-2.0-flash',
    standard: 'gemini-2.0-pro',
    reasoning: 'gemini-2.0-pro-exp',
  },
};

// =============================================================================
// GEMINI ADAPTER
// =============================================================================

export class GeminiAdapter implements Adapter {
  readonly runtime = 'gemini' as const;

  capabilities(): Capabilities {
    return CAPABILITIES;
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      // First check if CLI exists
      const whichResult = spawnSync('which', [GEMINI_CLI]);
      if (whichResult.status !== 0) {
        resolve(false);
        return;
      }

      // Check if authenticated using --list-sessions
      // Exit code 41 = auth required, 0 = authenticated
      const authCheck = spawn(GEMINI_CLI, ['--list-sessions']);
      authCheck.on('close', (code) => {
        resolve(code === 0);
      });
      authCheck.on('error', () => resolve(false));
    });
  }

  async spawn(config: AgentConfig): Promise<AgentHandle> {
    const args = this.buildArgs(config);
    const proc = spawn(GEMINI_CLI, args, {
      cwd: config.workingDir,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Pipe prompt via stdin (NOT using -p flag)
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
      setTimeout(() => handle.process?.kill('SIGKILL'), 5000);
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private buildArgs(config: AgentConfig): string[] {
    const args: string[] = [];

    // JSON output for structured parsing
    args.push('-o', 'stream-json');

    // Model selection
    if (config.model) {
      args.push('-m', config.model);
    }

    // Approval mode based on tool permissions
    args.push('--approval-mode', getGeminiApproval(config.tools));

    // Add --sandbox for read-only agents
    if (isReadOnly(config.tools)) {
      args.push('--sandbox');
    }

    // Working directory
    if (config.workingDir) {
      args.push('--include-directories', config.workingDir);
    }

    // NOTE: Prompt is piped via stdin, not using -p flag

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
        runtime: 'gemini',
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

          // Handle auth required
          if (code === AUTH_REQUIRED_EXIT_CODE) {
            result = {
              id,
              status: 'failed',
              output: outputHistory.join(''),
              filesCreated: [],
              filesModified: [],
              tokensUsed: { input: 0, output: 0 },
              duration: Date.now() - startTime,
              exitCode: code,
              runtime: 'gemini',
              error: 'Gemini requires authentication. Run `gemini` interactively first.',
            };
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
            runtime: 'gemini',
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

        // Extract tool calls
        if (event.type === 'tool_use' || event.tool_name) {
          const tool = event.tool_name || event.name;
          const args = event.tool_input || event.arguments || {};
          toolCalls.push(`${tool}: ${JSON.stringify(args).substring(0, 100)}`);

          if ((tool === 'write_file' || tool === 'write') && (args.path || args.file_path)) {
            filesCreated.push(args.path || args.file_path);
          }
          if ((tool === 'edit_file' || tool === 'edit') && (args.path || args.file_path)) {
            filesModified.push(args.path || args.file_path);
          }
        }

        // Extract token usage
        if (event.usage_metadata || event.usage) {
          const usage = event.usage_metadata || event.usage;
          tokensUsed = {
            input: usage.prompt_token_count || usage.input_tokens || 0,
            output: usage.candidates_token_count || usage.output_tokens || 0,
          };
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return { filesCreated, filesModified, tokensUsed, toolCalls };
  }
}

export default GeminiAdapter;
