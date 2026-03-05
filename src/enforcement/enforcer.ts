// Enforcement Engine — Check Execution
// Runs a single check script (Python or inline shell) and returns pass/fail.
// Does not orchestrate multiple checks — bodyguard does that.
// This module is the primitive that bodyguard calls in parallel.

import { spawn, execFile } from "child_process";
import { resolve } from "path";
import { enforcerEvents } from "../main/events";
import type { EnforcerCheck, EnforcerResult, EnforcerOptions } from "./types";
import { CHECK_TIMEOUT_MS } from "./constants";

// Commands that indicate an inline shell command rather than a script path.
// If check.script starts with one of these, execute it directly via shell.
const INLINE_COMMAND_PREFIXES = [
  "find ",
  "grep ",
  "wc ",
  "ls ",
  "cat ",
  "test ",
  "echo ",
  "stat ",
  "diff ",
  "head ",
  "tail ",
  "sort ",
  "awk ",
  "sed ",
  "cut ",
  "tr ",
  "xargs ",
  "[",
  "!",
  "if ",
  "for ",
  "while ",
  "npm ",
  "npx ",
  "node ",
  "git ",
  "docker ",
  "curl ",
];

/**
 * Detect whether a check script is an inline shell command or a file path.
 * Inline commands are executed via shell; file paths are spawned as python3 scripts.
 */
function isInlineCommand(script: string): boolean {
  // If it contains .py, treat as a Python script path
  if (script.endsWith(".py")) {
    return false;
  }

  // If it starts with a known command prefix, treat as inline
  const trimmed = script.trimStart();
  for (const prefix of INLINE_COMMAND_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return true;
    }
  }

  // If it contains pipes or redirects, it is an inline command
  if (trimmed.includes("|") || trimmed.includes(">") || trimmed.includes("&&")) {
    return true;
  }

  return false;
}

/**
 * runCheck: Execute a single enforcement check.
 *
 * If check.script is a .py file, spawns `python3 <script> <projectDir>`.
 * If check.script is an inline shell command, executes it via /bin/sh -c with cwd=projectDir.
 *
 * NOTE: Inline commands come from hardcoded check definitions in constants.ts,
 * never from user input. We use execFile with /bin/sh -c to avoid direct exec()
 * while preserving shell features (pipes, redirects) needed for verify-block checks.
 *
 * Exit code 0 means pass, non-zero means fail.
 * Timeout handling kills the process after options.timeoutMs.
 */
export async function runCheck(
  check: EnforcerCheck,
  options: EnforcerOptions
): Promise<EnforcerResult> {
  const { projectDir, timeoutMs } = options;

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

  const effectiveTimeout = timeoutMs || CHECK_TIMEOUT_MS;

  if (isInlineCommand(check.script)) {
    return runInlineCommand(check.script, projectDir, effectiveTimeout);
  }

  return runPythonScript(check.script, projectDir, effectiveTimeout);
}

/**
 * Run an inline shell command via execFile("/bin/sh", ["-c", command]) and capture output.
 * Uses execFile instead of exec to avoid shell injection — the command string comes
 * from hardcoded check definitions, not user input.
 */
function runInlineCommand(
  command: string,
  projectDir: string,
  timeoutMs: number
): Promise<EnforcerResult> {
  return new Promise((resolvePromise) => {
    let timedOut = false;

    // Use execFile with /bin/sh -c to get shell features (pipes, redirects)
    // without using exec() directly. The command comes from hardcoded constants.
    const child = execFile("/bin/sh", ["-c", command], {
      cwd: projectDir,
      timeout: timeoutMs,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024, // 1MB
    }, (error, stdout, stderr) => {
      clearTimeout(timeoutHandle);

      if (timedOut) {
        resolvePromise({
          passed: false,
          output: (stdout || "") + (stderr || ""),
          timedOut: true,
          error: `Check timed out after ${timeoutMs}ms`,
        });
        return;
      }

      const exitCode = error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0;
      // execFile sets error for non-zero exit codes. Check error.code for the actual exit code.
      const actualExitCode = error && "status" in error ? (error as { status: number }).status : (error ? 1 : 0);

      resolvePromise({
        passed: actualExitCode === 0,
        output: (stdout || "") + (stderr || ""),
        evidence: {
          exitCode: actualExitCode,
          type: "inline_command",
          stdoutLength: (stdout || "").length,
          stderrLength: (stderr || "").length,
        },
      });
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
  });
}

/**
 * Run a Python script with projectDir as the first argument.
 */
function runPythonScript(
  scriptPath: string,
  projectDir: string,
  timeoutMs: number
): Promise<EnforcerResult> {
  return new Promise((resolvePromise) => {
    const resolvedPath = resolve(scriptPath);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("python3", [resolvedPath, projectDir], {
        cwd: process.cwd(),
        timeout: timeoutMs,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (spawnError) {
      resolvePromise({
        passed: false,
        output: "",
        error: `Failed to spawn check script: ${
          spawnError instanceof Error ? spawnError.message : String(spawnError)
        }`,
      });
      return;
    }

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    if (child.stdout) {
      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on("exit", (exitCode: number | null, signal: string | null) => {
      clearTimeout(timeoutHandle);

      if (timedOut) {
        resolvePromise({
          passed: false,
          output: stdout + stderr,
          timedOut: true,
          error: `Check timed out after ${timeoutMs}ms`,
        });
        return;
      }

      resolvePromise({
        passed: exitCode === 0,
        output: stdout + stderr,
        evidence: {
          exitCode,
          signal,
          type: "python_script",
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        },
      });
    });

    child.on("error", (err: Error) => {
      clearTimeout(timeoutHandle);
      resolvePromise({
        passed: false,
        output: stdout + stderr,
        error: `Check process error: ${err.message}`,
      });
    });
  });
}

/**
 * runCheckWithRetry: Run a check with built-in retry logic.
 * Loops check.retry.attempts times, waiting check.retry.delayMs between attempts.
 * Returns immediately on first pass. Returns last failure if all attempts fail.
 */
export async function runCheckWithRetry(
  check: EnforcerCheck,
  options: EnforcerOptions
): Promise<EnforcerResult> {
  let lastResult: EnforcerResult | null = null;
  const effectiveTimeout = options.timeoutMs || CHECK_TIMEOUT_MS;
  const startTime = Date.now();

  for (let attempt = 0; attempt < check.retry.attempts; attempt++) {
    lastResult = await runCheck(check, {
      ...options,
      timeoutMs: effectiveTimeout,
    });

    // If it passed, return immediately
    if (lastResult.passed) {
      const durationMs = Date.now() - startTime;
      // Emit check run event with exit code 0 for success
      enforcerEvents.checkRun(check.name, 0, durationMs);
      return lastResult;
    }

    // If it failed and this is not the last attempt, wait before retrying
    if (attempt < check.retry.attempts - 1 && check.retry.delayMs > 0) {
      await new Promise((r) => setTimeout(r, check.retry.delayMs));
    }
  }

  const durationMs = Date.now() - startTime;
  // Emit check run event with exit code 1 for failure
  enforcerEvents.checkRun(check.name, 1, durationMs);

  return lastResult || {
    passed: false,
    output: "No attempts made",
    error: "Check configuration invalid",
  };
}

/**
 * validateCheckOutput: Parse check output for structured data.
 * Some checks return JSON; this extracts it. Otherwise wraps raw output.
 */
export function validateCheckOutput(
  output: string,
  checkName: string
): Record<string, unknown> {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return {
      raw: output,
      checkName,
      isJson: false,
    };
  }
}
