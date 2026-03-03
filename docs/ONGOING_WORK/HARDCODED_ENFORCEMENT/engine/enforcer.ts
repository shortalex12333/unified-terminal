// Source: Plan.md - Sub-agent C: Engine Core
// Enforcer: Runs a single check script and returns pass/fail result.
// Does not orchestrate multiple checks — bodyguard does that.
// This module is the primitive that bodyguard calls in parallel.

import { spawn } from "child_process";
import { resolve } from "path";
import type { EnforcerCheck, EnforcerResult, EnforcerOptions } from "./types";

/**
 * runCheck: Execute a single enforcement check script.
 * Spawns the check script as a child process, captures output, and returns result.
 *
 * @param check - The check configuration (name, script path, retry config)
 * @param options - Execution options (projectDir, timeout, retry settings)
 * @returns Promise<EnforcerResult> with pass/fail status and output
 */
export async function runCheck(
  check: EnforcerCheck,
  options: EnforcerOptions
): Promise<EnforcerResult> {
  const { projectDir, timeoutMs, retryOnTimeout } = options;

  // Validate inputs
  if (!check.name || !check.script) {
    return {
      passed: false,
      output: "Invalid check configuration",
      error: "Check name or script missing",
    };
  }

  if (!projectDir) {
    return {
      passed: false,
      output: "No project directory provided",
      error: "projectDir is required",
    };
  }

  // Resolve script path relative to current working directory
  const scriptPath = resolve(check.script);

  // Collect stdout and stderr separately for detailed logging
  let stdout = "";
  let stderr = "";

  return new Promise((resolve) => {
    // Set up timeout to kill the process if it takes too long
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");

      // If retry is enabled and we haven't exhausted attempts, retry
      if (retryOnTimeout && check.retry.delayMs > 0) {
        setTimeout(() => {
          // Re-run the check
          runCheck(check, options).then(resolve);
        }, check.retry.delayMs);
      } else {
        // Return timeout result
        resolve({
          passed: false,
          output: stdout + stderr,
          timedOut: true,
          error: `Check timed out after ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    // Spawn the check script
    // Script should be executable and accept projectDir as first argument
    let child: any;
    try {
      child = spawn("python3", [scriptPath, projectDir], {
        cwd: process.cwd(),
        timeout: timeoutMs,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (spawnError) {
      clearTimeout(timeoutHandle);
      return resolve({
        passed: false,
        output: "",
        error: `Failed to spawn check script: ${spawnError instanceof Error ? spawnError.message : String(spawnError)}`,
      });
    }

    // Capture stdout
    if (child.stdout) {
      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
    }

    // Capture stderr
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    }

    // Handle process exit
    child.on("exit", (exitCode: number | null, signal: string | null) => {
      clearTimeout(timeoutHandle);

      if (timedOut) {
        return; // Already handled by timeout handler
      }

      // Exit code 0 means pass, non-zero means fail
      const passed = exitCode === 0;

      resolve({
        passed,
        output: stdout + stderr,
        evidence: {
          exitCode,
          signal,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        },
      });
    });

    // Handle process error
    child.on("error", (err: Error) => {
      clearTimeout(timeoutHandle);
      resolve({
        passed: false,
        output: stdout + stderr,
        error: `Check process error: ${err.message}`,
      });
    });
  });
}

/**
 * runCheckWithRetry: Run a check with built-in retry logic.
 * Uses the check's configured retry attempts and delays.
 *
 * @param check - The check configuration (includes retry config)
 * @param options - Execution options
 * @returns Promise<EnforcerResult> with pass/fail status
 */
export async function runCheckWithRetry(
  check: EnforcerCheck,
  options: EnforcerOptions
): Promise<EnforcerResult> {
  let lastResult: EnforcerResult | null = null;

  for (let attempt = 0; attempt < check.retry.attempts; attempt++) {
    // Run the check
    lastResult = await runCheck(check, {
      ...options,
      timeoutMs: options.timeoutMs || 60_000,
    });

    // If it passed, return immediately
    if (lastResult.passed) {
      return lastResult;
    }

    // If it failed and this isn't the last attempt, wait before retrying
    if (attempt < check.retry.attempts - 1 && check.retry.delayMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, check.retry.delayMs)
      );
    }
  }

  // Return the last result (which failed)
  return lastResult || {
    passed: false,
    output: "No attempts made",
    error: "Check configuration invalid",
  };
}

/**
 * validateCheckOutput: Parse check output for additional insights.
 * Used by bodyguard to extract structured data from check output.
 * This is optional — most checks are binary (pass/fail).
 *
 * @param output - Raw stdout/stderr from check script
 * @param checkName - Name of check (for context-specific parsing)
 * @returns Parsed evidence object
 */
export function validateCheckOutput(
  output: string,
  checkName: string
): Record<string, unknown> {
  // Try to parse as JSON first (some checks may return JSON)
  try {
    return JSON.parse(output);
  } catch {
    // Not JSON, return raw output wrapped
    return {
      raw: output,
      checkName,
      isJson: false,
    };
  }
}
