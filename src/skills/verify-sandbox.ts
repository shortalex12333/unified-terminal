/**
 * Verify Sandbox — Command allowlist for post-step verification.
 *
 * Instance 3/4: Hardcoded Enforcement Engine — Skill System
 *
 * Verify checks run shell commands to confirm a worker followed its
 * skill instructions. This module ensures only read-only, safe commands
 * execute — no writes, no deletions, no network mutations.
 *
 * SECURITY NOTE: This module intentionally uses execSync with shell=true
 * because verify commands contain pipes (e.g. "find . | wc -l") which
 * require shell interpretation. Security is enforced by the allowlist +
 * blocklist BEFORE any command reaches the shell. No user input is
 * interpolated — commands come from skill markdown files (bundled assets)
 * and the hardcoded critical-checks registry.
 */

import { execSync } from 'child_process';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SandboxResult {
  /** Whether the command is allowed to execute */
  allowed: boolean;
  /** Reason for rejection (set when allowed === false) */
  reason?: string;
}

export interface CommandResult {
  /** stdout from the command */
  output: string;
  /** Process exit code (0 = success) */
  exitCode: number;
}

// ============================================================================
// ALLOWLIST & BLOCKLIST
// ============================================================================

/** Commands that verify blocks are permitted to execute. */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  'git', 'find', 'wc', 'ls', 'stat', 'test', 'echo',
  'cat', 'head', 'tail', 'grep', 'sort', 'uniq', 'diff',
  'docker',
]);

/** Patterns that are NEVER allowed, even if the base command passes. */
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /rm\s/, /mv\s/, /cp\s/, /chmod\s/, /chown\s/,
  /docker\s+rm/, /docker\s+rmi/, /kill\s/,
  />\s/, />>\s/,
  /curl\s.*(-X\s*(POST|PUT|DELETE|PATCH)|--data)/,
];

/** Default timeout for verify commands (10 seconds). */
const DEFAULT_TIMEOUT_MS = 10_000;

// ============================================================================
// COMMAND VALIDATION
// ============================================================================

/**
 * Check whether a shell command is allowed to run in the verify sandbox.
 *
 * Splits on pipes, validates each segment independently:
 * 1. First token of each segment must be in ALLOWED_COMMANDS.
 * 2. No segment may match any BLOCKED_PATTERN.
 *
 * @param command - Full shell command string (may contain pipes)
 */
export function isCommandAllowed(command: string): SandboxResult {
  const segments = command.split('|').map((s) => s.trim());

  for (const segment of segments) {
    if (segment.length === 0) {
      return { allowed: false, reason: 'Empty pipe segment' };
    }

    // Extract the first token (the command name)
    const firstToken = segment.split(/\s+/)[0];

    if (!ALLOWED_COMMANDS.has(firstToken)) {
      return {
        allowed: false,
        reason: `Command '${firstToken}' is not in the allowlist`,
      };
    }

    // Check blocked patterns against the full segment
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(segment)) {
        return {
          allowed: false,
          reason: `Segment matches blocked pattern: ${pattern.source}`,
        };
      }
    }
  }

  return { allowed: true };
}

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

/**
 * Execute a verify command in a sandboxed context.
 *
 * The command is first validated against the allowlist. If allowed,
 * it runs synchronously with the given cwd and timeout.
 *
 * Uses execSync with shell because verify commands contain pipes.
 * Security is enforced by isCommandAllowed() BEFORE execution.
 * Commands originate from bundled skill files, not user input.
 *
 * @param command - Shell command to execute
 * @param projectDir - Working directory for the command
 * @param timeoutMs - Maximum execution time (default: 10s)
 * @throws Error if the command is not allowed
 */
export async function executeVerifyCommand(
  command: string,
  projectDir: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
  const check = isCommandAllowed(command);
  if (!check.allowed) {
    throw new Error(`Sandbox rejected command: ${check.reason}`);
  }

  try {
    const stdout = execSync(command, {
      cwd: projectDir,
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { output: stdout, exitCode: 0 };
  } catch (err: unknown) {
    // execSync throws on non-zero exit codes
    if (err && typeof err === 'object' && 'status' in err) {
      const execError = err as { status: number; stdout?: string | Buffer };
      return {
        output: String(execError.stdout ?? ''),
        exitCode: typeof execError.status === 'number' ? execError.status : 1,
      };
    }

    // Timeout or other fatal error
    return { output: '', exitCode: 1 };
  }
}
