/**
 * Codex CLI Adapter
 *
 * Translates AgentConfig into Codex CLI commands.
 * Codex supports session resume and structured JSON output.
 *
 * CLI: codex [options] [prompt]
 *   --full-auto    Auto-approve all actions (no interactive prompts)
 *   --json         Structured JSONL output
 *   --sandbox      read-only | workspace-write
 *   -C <dir>       Working directory
 *   -m <model>     Model selection
 *
 * Prompt is piped via stdin to handle large payloads.
 * Dual-input agents (verifier) receive ## PRIMARY / ## SECONDARY sections.
 *
 * Target: ES2022 CommonJS strict
 */

import { spawn, spawnSync, type ChildProcess } from 'child_process';
import type {
  Adapter,
  AgentConfig,
  AgentHandle,
  AgentResult,
  Capabilities,
  Tool,
} from '../types';
import { getCodexSandbox } from '../permissions';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Codex CLI binary name */
const CODEX_CLI = 'codex';

/** Codex context window size in tokens */
const CONTEXT_WINDOW_TOKENS = 400_000;

/** Maximum prompt tokens accepted */
const MAX_PROMPT_TOKENS = 100_000;

/** Grace period before SIGKILL after SIGTERM (ms) */
const FORCE_KILL_DELAY_MS = 5_000;

/** Codex runtime capabilities — immutable singleton */
const CAPABILITIES: Readonly<Capabilities> = Object.freeze({
  sessionResume: true,
  jsonOutput: true,
  toolPermissions: true,
  maxPromptTokens: MAX_PROMPT_TOKENS,
  supportedTools: [
    'read', 'write', 'bash', 'web_search', 'edit', 'grep', 'glob',
  ] as Tool[],
  models: Object.freeze({
    fast: 'gpt-5-codex',
    standard: 'gpt-5-codex',
    reasoning: 'gpt-5',
  }),
});

// =============================================================================
// PARSED OUTPUT SHAPE
// =============================================================================

interface ParsedOutput {
  filesCreated: string[];
  filesModified: string[];
  tokensUsed: { input: number; output: number };
  toolCalls: string[];
}

// =============================================================================
// CODEX ADAPTER
// =============================================================================

export class CodexAdapter implements Adapter {
  readonly runtime = 'codex' as const;

  capabilities(): Capabilities {
    return CAPABILITIES;
  }

  /**
   * Check if Codex CLI is installed and responds to --version.
   * Does NOT verify authentication (that happens at spawn time).
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const which = spawnSync('which', [CODEX_CLI]);
      if (which.status !== 0) {
        resolve(false);
        return;
      }

      const versionCheck = spawn(CODEX_CLI, ['--version']);
      versionCheck.on('close', (code) => resolve(code === 0));
      versionCheck.on('error', () => resolve(false));
    });
  }

  /**
   * Spawn a Codex agent process.
   *
   * Flow:
   * 1. Validate prompt size against MAX_PROMPT_TOKENS
   * 2. Build CLI arguments from AgentConfig
   * 3. Spawn the process with stdio pipes
   * 4. Write prompt to stdin (supports dual-input format)
   * 5. Return AgentHandle for streaming output and awaiting completion
   */
  async spawn(config: AgentConfig): Promise<AgentHandle> {
    const fullPrompt = this.buildPrompt(config);

    // Reject prompts that exceed the Codex context budget.
    // Rough estimate: 1 token ~ 4 characters.
    const estimatedTokens = Math.ceil(fullPrompt.length / 4);
    if (estimatedTokens > MAX_PROMPT_TOKENS) {
      return this.failedHandle(
        config.id,
        `Prompt too large: ~${estimatedTokens} tokens exceeds limit of ${MAX_PROMPT_TOKENS}`,
      );
    }

    const args = this.buildArgs(config);

    let proc: ChildProcess;
    try {
      proc = spawn(CODEX_CLI, args, {
        cwd: config.workingDir,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this.failedHandle(config.id, `Spawn failed: ${message}`);
    }

    // Handle async spawn errors (e.g., codex binary not found after event-loop tick)
    proc.on('error', (err: Error) => {
      proc.emit('close', 1, null);
      // Error details are captured by stderr listener in createHandle
      proc.stderr?.emit('data', Buffer.from(`[spawn error] ${err.message}\n`));
    });

    // Pipe prompt via stdin to handle large payloads without arg-length limits
    proc.stdin?.write(fullPrompt);
    proc.stdin?.end();

    return this.createHandle(config.id, proc, config.timeout);
  }

  /**
   * Kill a running agent.
   * Sends SIGTERM first, then SIGKILL after FORCE_KILL_DELAY_MS.
   */
  async kill(handle: AgentHandle): Promise<void> {
    if (!handle.process) {
      return;
    }

    handle.process.kill('SIGTERM');

    // Force kill after grace period if still running
    const forceKillTimer = setTimeout(() => {
      if (handle.process && !handle.process.killed) {
        handle.process.kill('SIGKILL');
      }
    }, FORCE_KILL_DELAY_MS);

    // Clean up timer if process exits before force-kill
    handle.process.once('close', () => {
      clearTimeout(forceKillTimer);
    });
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Build Codex CLI argument array from AgentConfig.
   */
  private buildArgs(config: AgentConfig): string[] {
    const args: string[] = [];

    // Auto-approve mode (no interactive prompts)
    args.push('--full-auto');

    // JSON output for structured parsing
    args.push('--json');

    // Sandbox mode based on tool permissions
    const sandboxMode = getCodexSandbox(config.tools);
    args.push('--sandbox', sandboxMode);

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

  /**
   * Build the prompt string to pipe via stdin.
   * For dual-input agents (e.g., verifier), formats with ## PRIMARY / ## SECONDARY headers.
   */
  private buildPrompt(config: AgentConfig): string {
    if (config.secondaryInput) {
      return `## PRIMARY\n${config.prompt}\n\n## SECONDARY\n${config.secondaryInput}`;
    }
    return config.prompt;
  }

  /**
   * Create an AgentHandle wrapping the spawned process.
   * Sets up output collection, timeout handling, and completion promise.
   */
  private createHandle(
    id: string,
    proc: ChildProcess,
    timeout: number,
  ): AgentHandle {
    const outputHistory: string[] = [];
    const outputCallbacks: Array<(chunk: string) => void> = [];
    let result: AgentResult | null = null;
    const startTime = Date.now();

    // Collect stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      outputHistory.push(chunk);
      for (const cb of outputCallbacks) {
        cb(chunk);
      }
    });

    // Collect stderr (prefixed for distinction)
    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      outputHistory.push(`[stderr] ${chunk}`);
    });

    // Handle timeout — SIGTERM then SIGKILL
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, FORCE_KILL_DELAY_MS);

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

    // Completion promise — resolves when process exits
    const onComplete = (): Promise<AgentResult> => {
      return new Promise((resolve) => {
        // If already resolved (e.g., by timeout), return immediately
        if (result) {
          resolve(result);
          return;
        }

        proc.on('close', (code: number | null) => {
          clearTimeout(timeoutId);

          // Timeout handler may have already set the result
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
      onOutput: (cb: (chunk: string) => void) => {
        outputCallbacks.push(cb);
      },
      onComplete,
    };
  }

  /**
   * Create an immediately-failed AgentHandle.
   * Used when spawn cannot proceed (prompt too large, binary missing, etc.).
   */
  private failedHandle(id: string, error: string): AgentHandle {
    const failedResult: AgentResult = {
      id,
      status: 'failed',
      output: '',
      filesCreated: [],
      filesModified: [],
      tokensUsed: { input: 0, output: 0 },
      duration: 0,
      exitCode: null,
      runtime: 'codex',
      error,
    };

    return {
      id,
      process: null,
      outputHistory: [],
      onOutput: () => {},
      onComplete: () => Promise.resolve(failedResult),
    };
  }

  /**
   * Parse JSONL output from Codex.
   *
   * Codex emits one JSON object per line:
   * - `tool_call` events: extract file operations and tool usage
   * - `turn.completed` events: extract token usage
   *
   * Non-JSON lines are silently skipped.
   */
  private parseOutput(output: string): ParsedOutput {
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const toolCalls: string[] = [];
    let tokensUsed = { input: 0, output: 0 };

    /** Max characters to include in tool call summary */
    const TOOL_CALL_SUMMARY_LENGTH = 100;

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) {
        continue;
      }

      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;

        if (event.type === 'tool_call') {
          const tool = (event.name || event.tool) as string | undefined;
          const args = (event.arguments || event.args || {}) as Record<string, unknown>;
          if (tool) {
            const argsSummary = JSON.stringify(args).substring(0, TOOL_CALL_SUMMARY_LENGTH);
            toolCalls.push(`${tool}: ${argsSummary}`);

            if (tool === 'write' && typeof args.path === 'string') {
              filesCreated.push(args.path);
            }
            if (tool === 'edit' && typeof args.path === 'string') {
              filesModified.push(args.path);
            }
          }
        }

        if (event.type === 'turn.completed') {
          const usage = event.usage as Record<string, number> | undefined;
          if (usage) {
            tokensUsed = {
              input: usage.input_tokens ?? 0,
              output: usage.output_tokens ?? 0,
            };
          }
        }
      } catch {
        // Non-JSON line — skip silently
      }
    }

    return { filesCreated, filesModified, tokensUsed, toolCalls };
  }
}

export default CodexAdapter;
