// Source: ENFORCEMENT-GAPS.md gap 2
// Builds complete project state snapshot (SPINE.md object)
// Only LLM call: 1-sentence summary of changes (marked clearly below)

import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";
import { SpineState } from "./types";
import { SPINE_PROTOCOL } from "../constants/26-spine-protocol";

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function buildSpine(projectDir: string): Promise<SpineState> {
  const startTime = Date.now();
  const errors: Array<{ command: string; error: string; timestamp: number }> = [];

  // Metadata
  const timestamp = Date.now();

  // ========================================================================
  // 1. FILE INVENTORY — find {projectDir} -type f
  // ========================================================================
  let files = { total: 0, byType: {} as Record<string, number>, list: [] as string[] };
  try {
    const output = execSync(`find "${projectDir}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"`, {
      encoding: "utf-8",
      timeout: 30_000,
    });

    const fileList = output.split("\n").filter((line) => line.length > 0);
    files.list = fileList;
    files.total = fileList.length;

    // Count by type
    for (const file of fileList) {
      const ext = path.extname(file) || "no-extension";
      files.byType[ext] = (files.byType[ext] || 0) + 1;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push({ command: "find {projectDir} -type f", error: errorMsg, timestamp: Date.now() });
  }

  // ========================================================================
  // 2. GIT STATUS — git status --porcelain
  // ========================================================================
  let gitStatus = { branch: "", uncommitted: [] as string[], untracked: [] as string[] };
  try {
    // Get branch
    const branchOutput = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 10_000,
    });
    gitStatus.branch = branchOutput.trim();

    // Get status
    const statusOutput = execSync("git status --porcelain", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 10_000,
    });

    const lines = statusOutput.split("\n").filter((line) => line.length > 0);
    for (const line of lines) {
      const status = line.substring(0, 2);
      const filename = line.substring(3);

      if (status === "??") {
        gitStatus.untracked.push(filename);
      } else {
        gitStatus.uncommitted.push(filename);
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push({ command: "git status --porcelain", error: errorMsg, timestamp: Date.now() });
  }

  // ========================================================================
  // 3. NPM TEST — npm test (capture output + exit code)
  // ========================================================================
  let lastTestRun = { timestamp: Date.now(), exitCode: -1, output: "" };
  try {
    const testOutput = execSync("npm test 2>&1", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 120_000, // 2 minutes for tests
      stdio: ["pipe", "pipe", "pipe"],
    });

    lastTestRun.exitCode = 0;
    lastTestRun.output = testOutput.substring(0, 1000); // First 1000 chars
    lastTestRun.timestamp = Date.now();
  } catch (err) {
    // Test failure is expected sometimes; capture output anyway
    const errorMsg = err instanceof Error ? err.message : String(err);
    lastTestRun.output = errorMsg.substring(0, 1000);
    lastTestRun.exitCode = err instanceof Error && "status" in err ? (err as any).status : 1;
    lastTestRun.timestamp = Date.now();
  }

  // ========================================================================
  // 4. NPM BUILD — npm run build (capture output + exit code)
  // ========================================================================
  let buildState = { timestamp: Date.now(), exitCode: -1, output: "" };
  try {
    const buildOutput = execSync("npm run build 2>&1", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 120_000, // 2 minutes for build
      stdio: ["pipe", "pipe", "pipe"],
    });

    buildState.exitCode = 0;
    buildState.output = buildOutput.substring(0, 1000);
    buildState.timestamp = Date.now();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    buildState.output = errorMsg.substring(0, 1000);
    buildState.exitCode = err instanceof Error && "status" in err ? (err as any).status : 1;
    buildState.timestamp = Date.now();
  }

  // ========================================================================
  // 5. DOCKER PS — docker ps
  // ========================================================================
  let dockerRunning = { containers: 0, output: "" };
  try {
    const dockerOutput = execSync("docker ps 2>&1", {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const lines = dockerOutput.split("\n").filter((line) => line.length > 0);
    dockerRunning.containers = Math.max(0, lines.length - 1); // Subtract header
    dockerRunning.output = dockerOutput.substring(0, 500);
  } catch (err) {
    // Docker may not be installed; not an error
    const errorMsg = err instanceof Error ? err.message : String(err);
    dockerRunning.output = `Docker unavailable: ${errorMsg.substring(0, 200)}`;
  }

  // ========================================================================
  // 6. HEALTH CHECK — curl http://localhost:3000
  // ========================================================================
  let healthCheck = {
    timestamp: Date.now(),
    statusCode: undefined,
    responseTime: 0,
    success: false,
  };

  try {
    const startHealthCheck = Date.now();
    const curlOutput = execSync("curl -s -w '%{http_code}' http://localhost:3000 2>&1", {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const responseTime = Date.now() - startHealthCheck;
    const statusCode = parseInt(curlOutput.slice(-3), 10);

    healthCheck.statusCode = statusCode;
    healthCheck.responseTime = responseTime;
    healthCheck.success = statusCode >= 200 && statusCode < 300;
  } catch (err) {
    // Health check may fail if service isn't running
    healthCheck.success = false;
    healthCheck.responseTime = -1;
  }

  // ========================================================================
  // DAG PROGRESS — stub (would come from scheduler context)
  // ========================================================================
  const dagProgress = {
    totalSteps: 0,
    completedSteps: 0,
    failedSteps: [] as string[],
    currentStep: undefined,
  };

  // ========================================================================
  // PROJECT STATE — stub (would come from state machine)
  // ========================================================================
  const projectState = "OPEN" as const;
  const lastActivity = Date.now();

  // ========================================================================
  // CHANGE SUMMARY — LLM CALL (only one, marked clearly)
  // ========================================================================
  let changesSummary: string | undefined;
  if (gitStatus.uncommitted.length > 0 || gitStatus.untracked.length > 0) {
    // LLM CALL: Summarize changes
    // In real implementation, call Claude API here to generate one-sentence summary
    // of what changed (based on gitStatus.uncommitted + gitStatus.untracked)
    // This is the ONLY LLM call in the entire spine build
    changesSummary = `Made changes to ${gitStatus.uncommitted.length} files and created ${gitStatus.untracked.length} new files`;
  }

  // ========================================================================
  // ASSEMBLE FINAL STATE
  // ========================================================================
  const spine: SpineState = {
    timestamp,
    projectDir,
    files,
    gitStatus,
    lastTestRun,
    dagProgress,
    buildState,
    dockerRunning,
    healthCheck,
    projectState,
    lastActivity,
    changesSummary,
    errors,
  };

  return spine;
}

// ============================================================================
// HELPER: Validate spine has required sections
// ============================================================================

export function validateSpineState(spine: SpineState): boolean {
  const required = SPINE_PROTOCOL.REQUIRED_SECTIONS;

  for (const section of required) {
    switch (section) {
      case "files":
        if (!spine.files || spine.files.list === undefined) return false;
        break;
      case "gitStatus":
        if (!spine.gitStatus) return false;
        break;
      case "lastTestRun":
        if (!spine.lastTestRun) return false;
        break;
      case "dagProgress":
        if (!spine.dagProgress) return false;
        break;
      case "projectState":
        if (!spine.projectState) return false;
        break;
      default:
        return false;
    }
  }

  return true;
}
