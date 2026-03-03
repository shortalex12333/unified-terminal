/**
 * CLI Runner - Process Management for CLI Tools
 *
 * Gate 7: CLI Process Management
 *
 * Handles spawning, tracking, and managing CLI processes like:
 * - Claude Code
 * - GSD
 * - Codex
 * - npm/yarn/pnpm
 * - Git commands
 *
 * Features:
 * - Proper PATH setup (npm global, nvm, homebrew)
 * - Process tree management via tree-kill
 * - Real-time stdout/stderr streaming via EventEmitter
 * - Process survival during app minimize
 * - Configurable timeouts
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess, SpawnOptions as NodeSpawnOptions } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// tree-kill for killing process trees
// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeKill = require('tree-kill') as (
  pid: number,
  signal?: string,
  callback?: (error?: Error) => void
) => void;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ProcessStatus = 'running' | 'completed' | 'failed' | 'killed' | 'timeout';

export interface ProcessInfo {
  /** Unique process identifier */
  id: string;
  /** Tool name (e.g., 'claude', 'gsd', 'npm') */
  tool: string;
  /** Full command that was executed */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory */
  cwd: string;
  /** Current process status */
  status: ProcessStatus;
  /** When the process started */
  startedAt: Date;
  /** When the process ended (if finished) */
  endedAt?: Date;
  /** Exit code (if process has exited) */
  exitCode?: number;
  /** Exit signal (if killed by signal) */
  exitSignal?: string;
  /** Process ID from OS */
  pid?: number;
  /** Whether the process is running in background mode */
  background: boolean;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout: number;
  /** Error message if failed */
  errorMessage?: string;
}

export interface SpawnOptions {
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables to add/override */
  env?: Record<string, string>;
  /** Timeout in milliseconds (0 = no timeout, default: 0) */
  timeout?: number;
  /** Run in background mode (survives app minimize) */
  background?: boolean;
  /** Shell to use (true for default shell, string for specific shell) */
  shell?: boolean | string;
  /** Whether to capture output (default: true) */
  captureOutput?: boolean;
}

export interface ProcessOutput {
  /** Process ID */
  processId: string;
  /** Output stream type */
  stream: 'stdout' | 'stderr';
  /** Raw output data */
  data: string;
  /** Timestamp */
  timestamp: Date;
}

export interface ProcessStatusEvent {
  /** Process ID */
  processId: string;
  /** New status */
  status: ProcessStatus;
  /** Exit code if applicable */
  exitCode?: number;
  /** Exit signal if applicable */
  exitSignal?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** When the status changed */
  timestamp: Date;
}

// ============================================================================
// PATH CONFIGURATION
// ============================================================================

/**
 * Build an enhanced PATH that includes common tool locations.
 * This ensures CLI tools like npm, node, claude, etc. are found.
 */
function buildEnhancedPath(): string {
  const home = os.homedir();
  const platform = os.platform();
  const existingPath = process.env.PATH || '';

  const additionalPaths: string[] = [];

  if (platform === 'darwin') {
    // macOS specific paths
    additionalPaths.push(
      // Homebrew (Intel)
      '/usr/local/bin',
      '/usr/local/sbin',
      // Homebrew (Apple Silicon)
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      // npm global (default)
      path.join(home, '.npm-global', 'bin'),
      path.join(home, '.npm', 'bin'),
      '/usr/local/lib/node_modules/.bin',
      // nvm
      path.join(home, '.nvm', 'versions', 'node', '*', 'bin'),
      // n (node version manager)
      path.join(home, 'n', 'bin'),
      // volta
      path.join(home, '.volta', 'bin'),
      // fnm
      path.join(home, '.fnm', 'aliases', 'default', 'bin'),
      // pnpm
      path.join(home, '.local', 'share', 'pnpm'),
      path.join(home, 'Library', 'pnpm'),
      // yarn global
      path.join(home, '.yarn', 'bin'),
      path.join(home, '.config', 'yarn', 'global', 'node_modules', '.bin'),
      // Cargo/Rust (for some CLI tools)
      path.join(home, '.cargo', 'bin'),
      // Go binaries
      path.join(home, 'go', 'bin'),
      // Python user bin
      path.join(home, 'Library', 'Python', '3.11', 'bin'),
      path.join(home, 'Library', 'Python', '3.10', 'bin'),
      path.join(home, 'Library', 'Python', '3.9', 'bin'),
      // Local bin
      path.join(home, '.local', 'bin'),
      path.join(home, 'bin'),
    );
  } else if (platform === 'win32') {
    // Windows specific paths
    additionalPaths.push(
      // npm global
      path.join(home, 'AppData', 'Roaming', 'npm'),
      // nvm-windows
      path.join(home, 'AppData', 'Roaming', 'nvm'),
      // Scoop
      path.join(home, 'scoop', 'shims'),
      // Chocolatey
      'C:\\ProgramData\\chocolatey\\bin',
    );
  } else {
    // Linux specific paths
    additionalPaths.push(
      '/usr/local/bin',
      path.join(home, '.npm-global', 'bin'),
      path.join(home, '.nvm', 'versions', 'node', '*', 'bin'),
      path.join(home, '.volta', 'bin'),
      path.join(home, '.local', 'bin'),
      path.join(home, 'bin'),
      path.join(home, '.cargo', 'bin'),
      path.join(home, 'go', 'bin'),
    );
  }

  // Filter to paths that actually exist (glob patterns expanded)
  const validPaths = additionalPaths
    .flatMap((p) => {
      if (p.includes('*')) {
        // Expand glob patterns (simple implementation for nvm-style paths)
        const baseDir = p.substring(0, p.indexOf('*'));
        try {
          if (fs.existsSync(baseDir)) {
            const dirs = fs.readdirSync(baseDir);
            return dirs.map((d) => p.replace('*', d));
          }
        } catch {
          // Directory doesn't exist or can't be read
        }
        return [];
      }
      return [p];
    })
    .filter((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

  // Combine with existing PATH (new paths first for priority)
  const allPaths = [...validPaths, ...existingPath.split(path.delimiter)];

  // Remove duplicates while preserving order
  const uniquePaths = [...new Set(allPaths)];

  return uniquePaths.join(path.delimiter);
}

// ============================================================================
// CLI RUNNER CLASS
// ============================================================================

/**
 * CLI Runner - Manages CLI process spawning and lifecycle.
 *
 * Events:
 * - 'output': (ProcessOutput) - stdout/stderr data from a process
 * - 'status': (ProcessStatusEvent) - process status change
 * - 'error': (Error & { processId: string }) - error during process management
 */
export class CLIRunner extends EventEmitter {
  /** Map of active processes by ID */
  private processes: Map<string, {
    info: ProcessInfo;
    process: ChildProcess;
    timeoutId?: NodeJS.Timeout;
  }> = new Map();

  /** Counter for generating unique process IDs */
  private processCounter = 0;

  /** Enhanced PATH for process execution */
  private enhancedPath: string;

  constructor() {
    super();
    this.enhancedPath = buildEnhancedPath();
  }

  // ==========================================================================
  // PROCESS SPAWNING
  // ==========================================================================

  /**
   * Spawn a new CLI process.
   *
   * @param tool - The tool/command to run (e.g., 'claude', 'npm', 'git')
   * @param args - Arguments to pass to the tool
   * @param options - Spawn options
   * @returns Process ID for tracking
   */
  spawn(tool: string, args: string[] = [], options: SpawnOptions = {}): string {
    const processId = this.generateProcessId();

    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout ?? 0;
    const background = options.background ?? false;
    const captureOutput = options.captureOutput ?? true;

    // Build environment with enhanced PATH
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: this.enhancedPath,
      // Ensure proper terminal handling
      TERM: process.env.TERM || 'xterm-256color',
      // Force color output for tools that support it
      FORCE_COLOR: '1',
      // Disable update checks that might block
      NO_UPDATE_NOTIFIER: '1',
      npm_config_update_notifier: 'false',
      // Add any custom env vars
      ...options.env,
    };

    // Build spawn options
    const spawnOpts: NodeSpawnOptions = {
      cwd,
      env,
      stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      // Use shell for better command resolution
      shell: options.shell ?? true,
      // Detach for background processes
      detached: background,
      // Windows-specific: hide console window
      windowsHide: true,
    };

    // Create process info
    const info: ProcessInfo = {
      id: processId,
      tool,
      command: `${tool} ${args.join(' ')}`.trim(),
      args,
      cwd,
      status: 'running',
      startedAt: new Date(),
      background,
      timeout,
    };

    console.log(`[CLIRunner] Spawning process ${processId}: ${info.command}`);

    try {
      // Spawn the process
      const childProcess = spawn(tool, args, spawnOpts);

      // Store process info
      info.pid = childProcess.pid;

      const processEntry = {
        info,
        process: childProcess,
        timeoutId: undefined as NodeJS.Timeout | undefined,
      };

      this.processes.set(processId, processEntry);

      // Set up timeout if configured
      if (timeout > 0) {
        processEntry.timeoutId = setTimeout(() => {
          this.handleTimeout(processId);
        }, timeout);
      }

      // Set up output handlers
      if (captureOutput) {
        childProcess.stdout?.on('data', (data: Buffer) => {
          this.handleOutput(processId, 'stdout', data.toString());
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          this.handleOutput(processId, 'stderr', data.toString());
        });
      }

      // Set up exit handler
      childProcess.on('exit', (code, signal) => {
        this.handleExit(processId, code, signal);
      });

      // Set up error handler
      childProcess.on('error', (error) => {
        this.handleError(processId, error);
      });

      // For background processes, unref so they don't keep the app running
      if (background) {
        childProcess.unref();
      }

      // Emit initial status
      this.emitStatus(processId, 'running');

      return processId;
    } catch (error) {
      // Failed to spawn
      info.status = 'failed';
      info.endedAt = new Date();
      info.errorMessage = error instanceof Error ? error.message : String(error);

      this.processes.set(processId, {
        info,
        process: null as unknown as ChildProcess,
      });

      this.emitStatus(processId, 'failed', undefined, undefined, info.errorMessage);

      return processId;
    }
  }

  // ==========================================================================
  // PROCESS CONTROL
  // ==========================================================================

  /**
   * Kill a specific process by ID.
   *
   * @param processId - The process ID to kill
   * @param signal - Signal to send (default: SIGTERM)
   * @returns True if process was killed, false if not found
   */
  kill(processId: string, signal: string = 'SIGTERM'): boolean {
    const entry = this.processes.get(processId);
    if (!entry) {
      console.log(`[CLIRunner] Process ${processId} not found`);
      return false;
    }

    const { info, process: childProcess, timeoutId } = entry;

    if (info.status !== 'running') {
      console.log(`[CLIRunner] Process ${processId} already ${info.status}`);
      return false;
    }

    // Clear timeout if set
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Kill the process tree
    if (info.pid) {
      console.log(`[CLIRunner] Killing process tree for ${processId} (PID: ${info.pid})`);

      return new Promise<boolean>((resolve) => {
        treeKill(info.pid!, signal, (error?: Error) => {
          if (error) {
            console.error(`[CLIRunner] Failed to kill process ${processId}:`, error);
            // Try regular kill as fallback
            try {
              childProcess.kill(signal as NodeJS.Signals);
            } catch {
              // Ignore errors on fallback
            }
          }

          // Update status
          info.status = 'killed';
          info.endedAt = new Date();
          info.exitSignal = signal;

          this.emitStatus(processId, 'killed', undefined, signal);
          resolve(true);
        });
      }) as unknown as boolean; // Synchronous API but async kill
    }

    // No PID, try direct kill
    try {
      childProcess.kill(signal as NodeJS.Signals);
      info.status = 'killed';
      info.endedAt = new Date();
      info.exitSignal = signal;
      this.emitStatus(processId, 'killed', undefined, signal);
      return true;
    } catch (error) {
      console.error(`[CLIRunner] Failed to kill process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Kill all running processes.
   */
  killAll(): void {
    console.log(`[CLIRunner] Killing all ${this.processes.size} processes`);

    for (const [processId, entry] of this.processes) {
      if (entry.info.status === 'running') {
        this.kill(processId);
      }
    }
  }

  // ==========================================================================
  // PROCESS QUERIES
  // ==========================================================================

  /**
   * Get info about a specific process.
   *
   * @param processId - The process ID to look up
   * @returns ProcessInfo or null if not found
   */
  getProcess(processId: string): ProcessInfo | null {
    const entry = this.processes.get(processId);
    return entry ? { ...entry.info } : null;
  }

  /**
   * Get all processes (both running and completed).
   *
   * @returns Array of ProcessInfo objects
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).map((entry) => ({ ...entry.info }));
  }

  /**
   * Get only running processes.
   *
   * @returns Array of running ProcessInfo objects
   */
  getRunningProcesses(): ProcessInfo[] {
    return this.getAllProcesses().filter((p) => p.status === 'running');
  }

  /**
   * Check if a process is currently running.
   *
   * @param processId - The process ID to check
   * @returns True if process exists and is running
   */
  isRunning(processId: string): boolean {
    const info = this.getProcess(processId);
    return info?.status === 'running';
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up completed processes older than the specified age.
   *
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   * @returns Number of processes cleaned up
   */
  cleanup(maxAge: number = 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [processId, entry] of this.processes) {
      if (entry.info.status !== 'running' && entry.info.endedAt) {
        const age = now - entry.info.endedAt.getTime();
        if (age > maxAge) {
          this.processes.delete(processId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[CLIRunner] Cleaned up ${cleaned} old processes`);
    }

    return cleaned;
  }

  /**
   * Clear all process history (does not kill running processes).
   */
  clearHistory(): void {
    for (const [processId, entry] of this.processes) {
      if (entry.info.status !== 'running') {
        this.processes.delete(processId);
      }
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Generate a unique process ID.
   */
  private generateProcessId(): string {
    this.processCounter++;
    return `proc_${Date.now()}_${this.processCounter}`;
  }

  /**
   * Handle process output.
   */
  private handleOutput(processId: string, stream: 'stdout' | 'stderr', data: string): void {
    const output: ProcessOutput = {
      processId,
      stream,
      data,
      timestamp: new Date(),
    };

    this.emit('output', output);
  }

  /**
   * Handle process exit.
   */
  private handleExit(processId: string, code: number | null, signal: NodeJS.Signals | null): void {
    const entry = this.processes.get(processId);
    if (!entry) return;

    const { info, timeoutId } = entry;

    // Clear timeout if set
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Don't update if already marked as killed/timeout
    if (info.status !== 'running') {
      return;
    }

    info.endedAt = new Date();

    if (signal) {
      info.status = 'killed';
      info.exitSignal = signal;
      this.emitStatus(processId, 'killed', undefined, signal);
    } else if (code === 0) {
      info.status = 'completed';
      info.exitCode = 0;
      this.emitStatus(processId, 'completed', 0);
    } else {
      info.status = 'failed';
      info.exitCode = code ?? undefined;
      this.emitStatus(processId, 'failed', code ?? undefined);
    }

    console.log(`[CLIRunner] Process ${processId} exited with code ${code}, signal ${signal}`);
  }

  /**
   * Handle process error.
   */
  private handleError(processId: string, error: Error): void {
    const entry = this.processes.get(processId);
    if (!entry) return;

    const { info, timeoutId } = entry;

    // Clear timeout if set
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    info.status = 'failed';
    info.endedAt = new Date();
    info.errorMessage = error.message;

    console.error(`[CLIRunner] Process ${processId} error:`, error);

    this.emitStatus(processId, 'failed', undefined, undefined, error.message);

    // Also emit as error event
    const errorWithId = Object.assign(new Error(error.message), { processId });
    this.emit('error', errorWithId);
  }

  /**
   * Handle process timeout.
   */
  private handleTimeout(processId: string): void {
    const entry = this.processes.get(processId);
    if (!entry) return;

    const { info } = entry;

    if (info.status !== 'running') {
      return;
    }

    console.log(`[CLIRunner] Process ${processId} timed out after ${info.timeout}ms`);

    info.status = 'timeout';
    info.errorMessage = `Process timed out after ${info.timeout}ms`;

    // Kill the process
    this.kill(processId, 'SIGKILL');

    // Update status to timeout (kill will set it to killed, so we override)
    info.status = 'timeout';
    info.endedAt = new Date();

    this.emitStatus(processId, 'timeout', undefined, undefined, info.errorMessage);
  }

  /**
   * Emit a status event.
   */
  private emitStatus(
    processId: string,
    status: ProcessStatus,
    exitCode?: number,
    exitSignal?: string,
    errorMessage?: string
  ): void {
    const event: ProcessStatusEvent = {
      processId,
      status,
      exitCode,
      exitSignal,
      errorMessage,
      timestamp: new Date(),
    };

    this.emit('status', event);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Singleton CLI runner instance */
let cliRunnerInstance: CLIRunner | null = null;

/**
 * Get the singleton CLI runner instance.
 */
export function getCLIRunner(): CLIRunner {
  if (!cliRunnerInstance) {
    cliRunnerInstance = new CLIRunner();
  }
  return cliRunnerInstance;
}

/**
 * Cleanup function to be called on app quit.
 */
export function cleanupCLIRunner(): void {
  if (cliRunnerInstance) {
    cliRunnerInstance.killAll();
    cliRunnerInstance.removeAllListeners();
    cliRunnerInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  buildEnhancedPath,
};
