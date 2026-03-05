/**
 * Claude Code CLI Adapter
 *
 * Translates AgentConfig into Claude Code CLI commands.
 * Claude Code supports session resume, structured JSON output, and tool permissions.
 *
 * CLI: claude [options] [prompt]
 *   --print              Non-interactive mode, result to stdout
 *   --output-format json Structured JSON output
 *   --model <model>      Model selection
 *   --allowedTools <t>   Comma-separated PascalCase tool names
 *   --max-turns <n>      Limit agentic turns
 *   --project-dir <p>    Working directory
 *   resume <session_id>  Resume a previous session
 *
 * Small prompts are passed as a positional argument via --print.
 * Large prompts (>2000 chars) are written to a temp file with YAML frontmatter.
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
  Runtime,
  Tool,
} from '../types';
import { generateFrontmatter, writeTempAgentFile, cleanupTempFile, mapToolName } from './frontmatter';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Claude Code CLI binary name */
const CLAUDE_CLI = 'claude';

/** Maximum prompt tokens accepted */
const MAX_PROMPT_TOKENS = 100_000;

/** Threshold (chars) above which prompt is written to temp file */
const LARGE_PROMPT_THRESHOLD = 2_000;

/** Grace period before SIGKILL after SIGTERM (ms) */
const FORCE_KILL_DELAY_MS = 5_000;

/**
 * Runtime identifier for this adapter.
 * Cast required until 'claude' is added to the Runtime union in types.ts.
 */
const RUNTIME_ID = 'claude' as Runtime;

/** Claude Code runtime capabilities -- immutable singleton */
const CAPABILITIES: Readonly<Capabilities> = Object.freeze({
  sessionResume: true,
  jsonOutput: true,
  toolPermissions: true,
  maxPromptTokens: MAX_PROMPT_TOKENS,
  supportedTools: [
    'read', 'write', 'bash', 'web_search', 'edit', 'grep', 'glob',
  ] as Tool[],
  models: Object.freeze({
    fast: 'claude-haiku-4-5',
    standard: 'claude-sonnet-4-6',
    reasoning: 'claude-opus-4-6',
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
// CLAUDE CODE ADAPTER
// =============================================================================

export class ClaudeAdapter implements Adapter {
  readonly runtime = RUNTIME_ID;

  capabilities(): Capabilities {
    return CAPABILITIES;
  }

  /**
   * Check if Claude Code CLI is installed and responds to --version.
   * Does NOT verify authentication (that happens at spawn time).
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const which = spawnSync('which', [CLAUDE_CLI]);
      if (which.status !== 0) {
        resolve(false);
        return;
      }

      const versionCheck = spawn(CLAUDE_CLI, ['--version']);
      versionCheck.on('close', (code) => resolve(code === 0));
      versionCheck.on('error', () => resolve(false));
    });
  }

  /**
   * Spawn a Claude Code agent process.
   *
   * Flow:
   * 1. Validate prompt size against MAX_PROMPT_TOKENS
   * 2. Build CLI arguments from AgentConfig
   * 3. For large prompts (>2000 chars), write to temp file with YAML frontmatter
   * 4. Spawn the process
   * 5. Return AgentHandle for streaming output and awaiting completion
   */
  async spawn(config: AgentConfig): Promise<AgentHandle> {
    const fullPrompt = this.buildPrompt(config);

    // Reject prompts that exceed the context budget.
    // Rough estimate: 1 token ~ 4 characters.
    const estimatedTokens = Math.ceil(fullPrompt.length / 4);
    if (estimatedTokens > MAX_PROMPT_TOKENS) {
      return this.failedHandle(
        config.id,
        `Prompt too large: ~${estimatedTokens} tokens exceeds limit of ${MAX_PROMPT_TOKENS}`,
      );
    }

    let args: string[];
    let tempFile: string | null = null;

    if (fullPrompt.length > LARGE_PROMPT_THRESHOLD) {
      // Large prompt: write to temp file with frontmatter, pass file as arg
      const fileContent = generateFrontmatter(config);
      tempFile = await writeTempAgentFile(fileContent);
      args = this.buildArgs(config, null);
      args.push(tempFile);
    } else {
      // Small prompt: pass inline as positional arg
      args = this.buildArgs(config, fullPrompt);
    }

    let proc: ChildProcess;
    try {
      proc = spawn(CLAUDE_CLI, args, {
        cwd: config.workingDir,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      if (tempFile) await cleanupTempFile(tempFile);
      const message = err instanceof Error ? err.message : String(err);
      return this.failedHandle(config.id, `Spawn failed: ${message}`);
    }

    // Handle async spawn errors (e.g., claude binary not found after event-loop tick)
    proc.on('error', (err: Error) => {
      proc.emit('close', 1, null);
      proc.stderr?.emit('data', Buffer.from(`[spawn error] ${err.message}\n`));
    });

    return this.createHandle(config.id, proc, config.timeout, tempFile);
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

    const forceKillTimer = setTimeout(() => {
      if (handle.process && !handle.process.killed) {
        handle.process.kill('SIGKILL');
      }
    }, FORCE_KILL_DELAY_MS);

    handle.process.once('close', () => {
      clearTimeout(forceKillTimer);
    });
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Build Claude Code CLI argument array from AgentConfig.
   * When prompt is null, the caller will append a temp file path instead.
   */
  private buildArgs(config: AgentConfig, prompt: string | null): string[] {
    const args: string[] = [];

    // Non-interactive mode
    args.push('--print');

    // JSON output for structured parsing
    args.push('--output-format', 'json');

    // Model selection
    if (config.model) {
      args.push('--model', config.model);
    }

    // Tool permissions (PascalCase for Claude Code)
    if (config.tools.length > 0) {
      const mapped = config.tools.map(mapToolName);
      args.push('--allowedTools', mapped.join(','));
    }

    // Working directory
    if (config.workingDir) {
      args.push('--project-dir', config.workingDir);
    }

    // Max turns (derived from timeout: 1 turn per 30s budget, min 1)
    const maxTurns = Math.max(1, Math.floor(config.timeout / 30_000));
    args.push('--max-turns', String(maxTurns));

    // Prompt as positional argument (small prompts only)
    if (prompt !== null) {
      args.push(prompt);
    }

    return args;
  }

  /**
   * Build the prompt string.
   * For dual-input agents, formats with ## PRIMARY / ## SECONDARY headers.
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
    tempFile: string | null,
  ): AgentHandle {
    const outputHistory: string[] = [];
    const outputCallbacks: Array<(chunk: string) => void> = [];
    let result: AgentResult | null = null;
    const startTime = Date.now();

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      outputHistory.push(chunk);
      for (const cb of outputCallbacks) {
        cb(chunk);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      outputHistory.push(`[stderr] ${data.toString()}`);
    });

    // Timeout: SIGTERM then SIGKILL escalation
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
        runtime: RUNTIME_ID,
        error: `Timeout after ${timeout}ms`,
      };
    }, timeout);

    const onComplete = (): Promise<AgentResult> => {
      return new Promise((resolve) => {
        if (result) {
          if (tempFile) cleanupTempFile(tempFile);
          resolve(result);
          return;
        }

        proc.on('close', (code: number | null) => {
          clearTimeout(timeoutId);
          if (tempFile) cleanupTempFile(tempFile);

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
            runtime: RUNTIME_ID,
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
      runtime: RUNTIME_ID,
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
   * Parse JSON output from Claude Code.
   *
   * Claude Code with --output-format json emits structured JSON containing
   * tool_use/tool_call events with PascalCase names and usage statistics.
   * Non-JSON lines are silently skipped.
   */
  private parseOutput(output: string): ParsedOutput {
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const toolCalls: string[] = [];
    let tokensUsed = { input: 0, output: 0 };
    const TOOL_CALL_SUMMARY_LENGTH = 100;

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        continue;
      }

      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;

        if (event.type === 'tool_use' || event.type === 'tool_call') {
          const tool = (event.name || event.tool) as string | undefined;
          const input = (event.input || event.arguments || {}) as Record<string, unknown>;
          if (tool) {
            const inputSummary = JSON.stringify(input).substring(0, TOOL_CALL_SUMMARY_LENGTH);
            toolCalls.push(`${tool}: ${inputSummary}`);

            if (tool === 'Write' && typeof input.file_path === 'string') {
              filesCreated.push(input.file_path);
            }
            if (tool === 'Edit' && typeof input.file_path === 'string') {
              filesModified.push(input.file_path);
            }
          }
        }

        if (event.usage || event.type === 'result') {
          const usage = (event.usage || {}) as Record<string, number>;
          if (usage.input_tokens || usage.output_tokens) {
            tokensUsed = {
              input: usage.input_tokens ?? tokensUsed.input,
              output: usage.output_tokens ?? tokensUsed.output,
            };
          }
        }
      } catch {
        // Non-JSON line -- skip silently
      }
    }

    return { filesCreated, filesModified, tokensUsed, toolCalls };
  }
}

export default ClaudeAdapter;
