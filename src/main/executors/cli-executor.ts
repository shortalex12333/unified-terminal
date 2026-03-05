/**
 * CLI Executor - Spawns Codex CLI for code generation tasks
 *
 * This executor wraps the Codex CLI tool, handling:
 * - Command building with proper shell escaping
 * - Environment setup (nvm, homebrew paths)
 * - JSON output parsing
 * - Structured result extraction
 */

import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { workerEvents } from '../events';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Runtime step definition for executor tasks.
 */
export interface RuntimeStep {
  /** Unique step identifier */
  id: string;

  /** Action type determining execution behavior */
  action: 'codex_scaffold' | 'codex_build' | 'codex_test' | 'codex_git' | 'codex_general';

  /** Detailed instruction for the AI agent */
  detail: string;

  /** Project directory for execution context */
  projectDir: string;

  /** Optional timeout in milliseconds */
  timeout?: number;

  /** Optional model override */
  model?: string;

  /** Optional sandbox mode */
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
}

/**
 * Structured result from CLI execution.
 */
export interface CLIResult {
  /** Whether execution completed successfully */
  success: boolean;

  /** Combined response text from agent messages */
  response: string;

  /** Extracted code blocks from markdown */
  codeBlocks: string[];

  /** List of files created during execution */
  filesCreated: string[];

  /** List of files modified during execution */
  filesModified: string[];

  /** Error message if execution failed */
  error?: string;

  /** Raw stdout for debugging */
  rawOutput?: string;

  /** Execution duration in milliseconds */
  duration?: number;
}

/**
 * Codex JSON output message format.
 */
interface CodexMessage {
  type: 'thread.started' | 'turn.started' | 'item.completed' | 'turn.completed' | 'error';
  thread_id?: string;
  item?: {
    id: string;
    type: 'reasoning' | 'agent_message' | 'tool_call' | 'tool_result';
    text?: string;
    name?: string;
    arguments?: string;
    output?: string;
  };
  usage?: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

/**
 * Executor interface that CLIExecutor implements.
 */
export interface Executor {
  execute(step: RuntimeStep): Promise<CLIResult>;
}

// ============================================================================
// CLI EXECUTOR CLASS
// ============================================================================

/**
 * CLI Executor - Manages Codex CLI execution for code generation tasks.
 *
 * Supports multiple action types:
 * - codex_scaffold: Project scaffolding and initialization
 * - codex_build: Code generation and implementation
 * - codex_test: Running and creating tests
 * - codex_git: Git operations
 * - codex_general: General code-related tasks
 */
export class CLIExecutor implements Executor {
  private process: ChildProcess | null = null;
  private buffer: string = '';

  /**
   * Build enhanced environment with nvm and homebrew paths.
   * Ensures CLI tools are discoverable regardless of how the app was launched.
   */
  private buildEnv(): NodeJS.ProcessEnv {
    const home = os.homedir();
    const nvmDir = path.join(home, '.nvm');
    const brewPrefix = os.arch() === 'arm64' ? '/opt/homebrew' : '/usr/local';

    // Find the nvm node binary directory
    let nvmNodeBin = '';
    try {
      const nodeVersions = path.join(nvmDir, 'versions', 'node');
      if (fs.existsSync(nodeVersions)) {
        const versions = fs.readdirSync(nodeVersions).sort().reverse();
        if (versions.length > 0) {
          nvmNodeBin = path.join(nodeVersions, versions[0], 'bin');
        }
      }
    } catch {
      // nvm not installed, continue without it
    }

    // npm global bin directory
    const npmGlobal = path.join(home, '.npm-global', 'bin');

    // Build PATH with priority order
    const pathParts = [
      nvmNodeBin,
      npmGlobal,
      `${brewPrefix}/bin`,
      `${brewPrefix}/sbin`,
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      process.env.PATH || '',
    ].filter(Boolean);

    return {
      ...process.env,
      HOME: home,
      NVM_DIR: nvmDir,
      PATH: pathParts.join(':'),
      // Disable interactive prompts
      NONINTERACTIVE: '1',
      CI: '1',
    };
  }

  /**
   * Escape a string for safe shell execution.
   * Uses single quotes with proper escaping for embedded single quotes.
   */
  private escapeForShell(input: string): string {
    // Replace single quotes with escaped version: ' -> '\''
    // This closes the quote, adds an escaped quote, and reopens the quote
    return `'${input.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Build the Codex command arguments based on step configuration.
   */
  private buildCommandArgs(step: RuntimeStep): string[] {
    const args: string[] = [];

    // Full auto mode for automated execution
    args.push('--full-auto');

    // Set working directory
    args.push('-C', step.projectDir);

    // JSON output for structured parsing
    args.push('--json');

    // Skip git repo check
    args.push('--skip-git-repo-check');

    // Optional model override
    if (step.model) {
      args.push('-m', step.model);
    }

    // Optional sandbox mode
    if (step.sandbox) {
      args.push('-s', step.sandbox);
    }

    return args;
  }

  /**
   * Build context prefix based on action type.
   * Adds relevant context to help the AI understand the task.
   */
  private buildContextPrefix(action: RuntimeStep['action']): string {
    switch (action) {
      case 'codex_scaffold':
        return 'You are scaffolding a new project. Create the necessary directory structure, configuration files, and boilerplate code. ';

      case 'codex_build':
        return 'You are implementing code features. Write clean, well-documented code that follows best practices. ';

      case 'codex_test':
        return 'You are working with tests. Create or run tests to verify functionality. Use appropriate testing frameworks. ';

      case 'codex_git':
        return 'You are performing git operations. Use git commands appropriately and follow commit message conventions. ';

      case 'codex_general':
      default:
        return '';
    }
  }

  /**
   * Parse Codex JSON output to extract structured data.
   *
   * Extracts:
   * - Response text from agent_message items
   * - Code blocks from markdown in responses
   * - File operations from tool_call items
   */
  private parseCodexOutput(stdout: string): {
    response: string;
    codeBlocks: string[];
    filesCreated: string[];
    filesModified: string[];
    hasError: boolean;
    errorMessage?: string;
  } {
    const responses: string[] = [];
    const codeBlocks: string[] = [];
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    let hasError = false;
    let errorMessage: string | undefined;

    // Parse JSON lines
    const lines = stdout.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as CodexMessage;

        // Handle error messages
        if (message.type === 'error') {
          hasError = true;
          errorMessage = message.error || 'Unknown error';
          continue;
        }

        // Extract content from completed items
        if (message.type === 'item.completed' && message.item) {
          const item = message.item;

          // Extract agent messages (response text)
          if (item.type === 'agent_message' && item.text) {
            responses.push(item.text);

            // Extract code blocks from markdown
            const codeMatches = item.text.matchAll(/```[\w]*\n([\s\S]*?)```/g);
            for (const match of codeMatches) {
              codeBlocks.push(match[1].trim());
            }
          }

          // Extract file operations from tool calls
          if (item.type === 'tool_call' && item.name && item.arguments) {
            try {
              const args = JSON.parse(item.arguments);

              // Detect file write operations
              if (item.name === 'write_file' || item.name === 'create_file') {
                if (args.path) {
                  filesCreated.push(args.path);
                }
              }

              // Detect file edit operations
              if (item.name === 'edit_file' || item.name === 'patch_file' || item.name === 'apply_diff') {
                if (args.path) {
                  filesModified.push(args.path);
                }
              }

              // Shell commands that create files
              if (item.name === 'shell' || item.name === 'run_command') {
                const cmd = args.command || args.cmd || '';

                // Detect mkdir commands
                if (/mkdir\s+(-p\s+)?/.test(cmd)) {
                  const dirMatch = cmd.match(/mkdir\s+(?:-p\s+)?([^\s;|&]+)/);
                  if (dirMatch) {
                    filesCreated.push(dirMatch[1]);
                  }
                }

                // Detect touch commands
                if (/touch\s+/.test(cmd)) {
                  const touchMatch = cmd.match(/touch\s+([^\s;|&]+)/);
                  if (touchMatch) {
                    filesCreated.push(touchMatch[1]);
                  }
                }

                // Detect npm init / create commands
                if (/npm\s+(init|create)/.test(cmd)) {
                  filesCreated.push('package.json');
                }

                // Detect git init
                if (/git\s+init/.test(cmd)) {
                  filesCreated.push('.git');
                }
              }
            } catch {
              // Arguments weren't JSON, skip parsing
            }
          }

          // Check tool results for created files
          if (item.type === 'tool_result' && item.output) {
            // Look for "Created file:" or similar patterns in output
            const createdMatch = item.output.match(/[Cc]reated\s+(?:file[:\s]+)?([^\s\n]+)/g);
            if (createdMatch) {
              for (const match of createdMatch) {
                const filePath = match.replace(/[Cc]reated\s+(?:file[:\s]+)?/, '').trim();
                if (filePath && !filesCreated.includes(filePath)) {
                  filesCreated.push(filePath);
                }
              }
            }
          }
        }
      } catch {
        // Not valid JSON, might be raw output - skip
      }
    }

    return {
      response: responses.join('\n\n'),
      codeBlocks,
      filesCreated: [...new Set(filesCreated)], // Deduplicate
      filesModified: [...new Set(filesModified)],
      hasError,
      errorMessage,
    };
  }

  /**
   * Execute a runtime step using Codex CLI.
   *
   * @param step - The runtime step to execute
   * @returns Promise resolving to structured CLI result
   */
  async execute(step: RuntimeStep): Promise<CLIResult> {
    const startTime = Date.now();
    this.buffer = '';

    // Build the full prompt with context prefix
    const contextPrefix = this.buildContextPrefix(step.action);
    const fullPrompt = contextPrefix + step.detail;

    // Build command arguments
    const args = this.buildCommandArgs(step);

    // Default timeout: 5 minutes
    const timeout = step.timeout || 300000;

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      let stdout = '';
      let stderr = '';

      console.log(`[CLIExecutor] Executing step: ${step.id}`);
      console.log(`[CLIExecutor] Action: ${step.action}`);
      console.log(`[CLIExecutor] Project: ${step.projectDir}`);

      // Emit spawn event to Status Agent
      workerEvents.spawn(step.id, step.action, step.projectDir);

      // Spawn Codex process
      this.process = spawn('codex', args, {
        env: this.buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: step.projectDir,
      });

      // Send prompt to stdin
      this.process.stdin?.write(fullPrompt);
      this.process.stdin?.end();

      // Collect stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
      });

      // Collect stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Ignore "Reading prompt from stdin..." message
        if (!text.includes('Reading prompt from stdin')) {
          stderr += text;
        }
      });

      // Handle process completion
      this.process.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        console.log(`[CLIExecutor] Process exited with code: ${code}`);

        // Parse the output
        const parsed = this.parseCodexOutput(stdout);

        // Build result
        const result: CLIResult = {
          success: code === 0 && !parsed.hasError,
          response: parsed.response || stderr || 'No response received',
          codeBlocks: parsed.codeBlocks,
          filesCreated: parsed.filesCreated,
          filesModified: parsed.filesModified,
          duration,
          rawOutput: stdout,
        };

        if (!result.success) {
          result.error = parsed.errorMessage || stderr || `Process exited with code ${code}`;
          // Emit error event to Status Agent
          workerEvents.error(step.id, result.error);
        }

        // Emit complete event to Status Agent
        workerEvents.complete(
          step.id,
          result.success,
          result.filesCreated.length,
          result.filesModified.length
        );

        // Emit individual file events
        for (const file of result.filesCreated) {
          workerEvents.fileCreated(file);
        }
        for (const file of result.filesModified) {
          workerEvents.fileModified(file);
        }

        resolve(result);
      });

      // Handle spawn errors
      this.process.on('error', (err) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        console.error(`[CLIExecutor] Spawn error:`, err);

        resolve({
          success: false,
          response: '',
          codeBlocks: [],
          filesCreated: [],
          filesModified: [],
          error: err.message,
          duration,
        });
      });

      // Set timeout
      timeoutId = setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log(`[CLIExecutor] Timeout reached, killing process`);
          this.process.kill('SIGTERM');

          // Force kill after 5 seconds if SIGTERM doesn't work
          setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
            }
          }, 5000);
        }

        // Emit timeout event to Status Agent
        workerEvents.timeout(step.id, timeout);

        resolve({
          success: false,
          response: '',
          codeBlocks: [],
          filesCreated: [],
          filesModified: [],
          error: `Execution timed out after ${timeout}ms`,
          duration: timeout,
        });
      }, timeout);
    });
  }

  /**
   * Cancel current execution if running.
   */
  cancel(): void {
    if (this.process && !this.process.killed) {
      console.log('[CLIExecutor] Cancelling execution');
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  /**
   * Check if Codex CLI is available.
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', ['codex'], {
        env: new CLIExecutor().buildEnv(),
      });

      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Get Codex CLI version.
   */
  static async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('codex', ['--version'], {
        env: new CLIExecutor().buildEnv(),
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => resolve(null));
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let executorInstance: CLIExecutor | null = null;

/**
 * Get the singleton CLI executor instance.
 */
export function getCLIExecutor(): CLIExecutor {
  if (!executorInstance) {
    executorInstance = new CLIExecutor();
  }
  return executorInstance;
}

/**
 * Cleanup CLI executor (for shutdown).
 */
export function cleanupCLIExecutor(): void {
  if (executorInstance) {
    executorInstance.cancel();
    executorInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute a code generation step.
 */
export async function executeCodexStep(step: RuntimeStep): Promise<CLIResult> {
  return getCLIExecutor().execute(step);
}

/**
 * Quick scaffold execution.
 */
export async function scaffold(projectDir: string, instruction: string): Promise<CLIResult> {
  return getCLIExecutor().execute({
    id: `scaffold_${Date.now()}`,
    action: 'codex_scaffold',
    detail: instruction,
    projectDir,
  });
}

/**
 * Quick build execution.
 */
export async function build(projectDir: string, instruction: string): Promise<CLIResult> {
  return getCLIExecutor().execute({
    id: `build_${Date.now()}`,
    action: 'codex_build',
    detail: instruction,
    projectDir,
  });
}

/**
 * Quick test execution.
 */
export async function runTests(projectDir: string, instruction: string): Promise<CLIResult> {
  return getCLIExecutor().execute({
    id: `test_${Date.now()}`,
    action: 'codex_test',
    detail: instruction,
    projectDir,
  });
}

/**
 * Quick git operation.
 */
export async function gitOperation(projectDir: string, instruction: string): Promise<CLIResult> {
  return getCLIExecutor().execute({
    id: `git_${Date.now()}`,
    action: 'codex_git',
    detail: instruction,
    projectDir,
  });
}
