// Source: HARDCODED-ENFORCEMENT-VALUES.md section 3 + ENFORCEMENT-GAPS.md gap 10
// Agent Spawner: child_process.spawn with PID tracking, timeout, token counting

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { TIMEOUTS } from "../constants/03-timeouts";
import { STEP_EXECUTION } from "../constants/34-step-execution";
import { MODEL_ROUTING } from "../constants/12-model-routing";
import { TOKEN_THRESHOLDS } from "../constants/01-context-warden";
import type { AgentHandle } from "./types";

/**
 * Configuration for spawning an agent worker
 */
export interface AgentConfig {
  action: string;
  taskDescription: string;
  skill?: string;
  projectDir: string;
  tier?: number;
  model?: string;
  timeout?: number;
  tools?: string[];
  runtime?: "codex" | "claude" | "gemini" | "chatgpt-web";
}

/**
 * Spawn an agent worker process
 *
 * Flow:
 * 1. Determine model/runtime from config
 * 2. Assemble command (Codex, Claude Code, Gemini, etc.)
 * 3. Spawn: child_process.spawn(cmd, args, { timeout: WORKER_TIER_*_MS })
 * 4. Track: PID, start time, token usage
 * 5. Monitor: stdout/stderr streams
 * 6. Timeout: After TIMEOUT_MS, kill process (SIGTERM → SIGKILL)
 */
export async function spawnAgent(config: AgentConfig): Promise<AgentHandle & { childProcess: ChildProcess; output: string; stderr: string }> {
  // Determine runtime
  const runtime =
    config.runtime ||
    selectRuntime(config.action, config.tier || 1);
  const model =
    config.model || selectModel(runtime, config.tier || 1);
  const timeout = config.timeout || selectTimeout(config.tier || 1);

  // Assemble command and args based on runtime
  let cmd: string;
  let args: string[];
  let env: NodeJS.ProcessEnv = { ...process.env };

  switch (runtime) {
    case "codex":
      cmd = "codex";
      args = ["--full-auto"];
      break;

    case "claude":
      cmd = "claude";
      args = ["--api-key", process.env.ANTHROPIC_API_KEY || ""];
      break;

    case "gemini":
      cmd = "gemini";
      args = ["--api-key", process.env.GOOGLE_API_KEY || ""];
      break;

    case "chatgpt-web":
      cmd = "python3";
      args = ["-m", "browser_use", "--task"];
      break;

    default:
      throw new Error(`Unknown runtime: ${runtime}`);
  }

  // Build skill injection: if skill is provided and is short, prepend to stdin
  let skillPrompt = "";
  if (config.skill) {
    skillPrompt = config.skill;
  }

  // Build task description
  const taskPrompt = `
Action: ${config.action}
Task: ${config.taskDescription}
Project: ${config.projectDir}

${skillPrompt ? `\n--- SKILL CONTEXT ---\n${skillPrompt}` : ""}
`;

  // Create stderr/stdout capture
  let stdout = "";
  let stderr = "";
  const outputPath = path.join(
    config.projectDir,
    `.prism/logs/${Date.now()}.log`
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const outputStream = fs.createWriteStream(outputPath);

  // Spawn the process
  const startTime = Date.now();
  const process_: ChildProcess = spawn(cmd, args, {
    env: env,
    timeout: timeout,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (!process_.pid) {
    throw new Error("Failed to spawn agent: no PID");
  }

  // Monitor timeout
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    console.warn(`[SPAWNER] Agent PID ${process_.pid} timeout (${timeout}ms)`);
    process_.kill("SIGTERM");

    // Grace period: 5 seconds
    setTimeout(() => {
      if (!process_.killed) {
        process_.kill("SIGKILL");
      }
    }, TIMEOUTS.KILL_GRACE_MS);
  }, timeout);

  // Capture stdout
  if (process_.stdout) {
    process_.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      outputStream.write(chunk);

      // Truncate if too large
      if (stdout.length > STEP_EXECUTION.MAX_OUTPUT_CAPTURE_BYTES) {
        stdout = stdout.substring(-STEP_EXECUTION.MAX_OUTPUT_CAPTURE_BYTES);
      }
    });
  }

  // Capture stderr
  if (process_.stderr) {
    process_.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      outputStream.write(`[STDERR] ${chunk}`);
    });
  }

  // Write skill + task to stdin if provided
  if (process_.stdin) {
    process_.stdin.write(taskPrompt);
    process_.stdin.end();
  }

  // Wait for process to exit
  return new Promise((resolve, reject) => {
    process_.on("exit", (code) => {
      clearTimeout(timeoutHandle);
      outputStream.end();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Extract token usage from output or headers
      const tokensUsed = extractTokenCount(stdout, model);

      const handle: AgentHandle & { childProcess: ChildProcess; output: string; stderr: string } = {
        process: process_ as unknown as NodeJS.Process,
        id: `agent-${process_.pid}`,
        model: model,
        tier: (config.tier || 1) as 1 | 2 | 3,
        startTime: startTime,
        tokensUsed: tokensUsed,
        taskProgress: 1.0, // Completed
        exitCode: code,
        // Extensions for actual execution
        childProcess: process_,
        output: stdout,
        stderr: stderr,
      };

      console.log(
        `[SPAWNER] Agent PID ${process_.pid} exited with code ${code} (${duration}ms, tokens: ${tokensUsed})`
      );

      resolve(handle);
    });

    process_.on("error", (err) => {
      clearTimeout(timeoutHandle);
      outputStream.end();
      reject(new Error(`Failed to spawn agent: ${err.message}`));
    });
  });
}

/**
 * Select runtime based on action type and tier
 */
function selectRuntime(
  action: string,
  tier: number
): "codex" | "claude" | "gemini" | "chatgpt-web" {
  // Web-only actions
  if (["dall_e", "web_search", "intake_quiz", "canvas"].includes(action)) {
    return "chatgpt-web";
  }

  // CLI-only actions
  if (
    ["codex_scaffold", "codex_build", "codex_test", "codex_git"].includes(
      action
    )
  ) {
    return "codex";
  }

  // Default for tier
  switch (tier) {
    case 1:
      return "codex";
    case 2:
    case 3:
      return "claude";
    default:
      return "codex";
  }
}

/**
 * Select model based on runtime and tier
 */
function selectModel(
  runtime: string,
  tier: number
): string {
  const routing = MODEL_ROUTING[runtime as keyof typeof MODEL_ROUTING];
  if (!routing) {
    return "gpt-5-codex";
  }

  switch (tier) {
    case 1:
      return routing.fast || "gpt-5-codex";
    case 2:
      return routing.standard || "gpt-5-codex";
    case 3:
      return routing.reasoning || "gpt-5";
    default:
      return routing.standard || "gpt-5-codex";
  }
}

/**
 * Select timeout based on tier
 */
function selectTimeout(tier: number): number {
  switch (tier) {
    case 1:
      return TIMEOUTS.WORKER_TIER_1_MS;
    case 2:
      return TIMEOUTS.WORKER_TIER_2_MS;
    case 3:
      return TIMEOUTS.WORKER_TIER_3_MS;
    default:
      return TIMEOUTS.WORKER_TIER_2_MS;
  }
}

/**
 * Extract token count from agent output
 *
 * Looks for patterns like:
 * - "usage": {"completion_tokens": 123, "prompt_tokens": 456}
 * - "tokens_used: 579"
 * - x-openai-usage headers (if available)
 *
 * Falls back to 0 if no token info found.
 */
function extractTokenCount(output: string, model: string): number {
  // JSON usage pattern
  const jsonMatch = output.match(/"usage"\s*:\s*\{[^}]*"total_tokens"\s*:\s*(\d+)/);
  if (jsonMatch) {
    return parseInt(jsonMatch[1], 10);
  }

  // Alternative JSON pattern (prompt + completion)
  const altMatch = output.match(/"completion_tokens"\s*:\s*(\d+)[^}]*"prompt_tokens"\s*:\s*(\d+)/);
  if (altMatch) {
    const completion = parseInt(altMatch[1], 10);
    const prompt = parseInt(altMatch[2], 10);
    return completion + prompt;
  }

  // Plaintext pattern
  const plainMatch = output.match(/tokens_used:\s*(\d+)/i);
  if (plainMatch) {
    return parseInt(plainMatch[1], 10);
  }

  // Default: return 0
  return 0;
}

/**
 * Kill an agent with grace period
 *
 * 1. Send SIGTERM (polite)
 * 2. Wait 5 seconds
 * 3. Send SIGKILL (forceful)
 */
export async function killAgent(handle: AgentHandle & { childProcess?: ChildProcess }): Promise<void> {
  const proc = handle.childProcess || (handle.process as any);
  if (!proc || proc.killed) {
    return;
  }

  proc.kill("SIGTERM");

  return new Promise((resolve) => {
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill("SIGKILL");
      }
      resolve();
    }, TIMEOUTS.KILL_GRACE_MS);
  });
}
