// Enforcement Engine — Spine (State Snapshots)
// Builds a lightweight project state snapshot using git and filesystem data.
// NO npm test, npm build, docker, or health checks — those are too heavy for
// a pre/post gate check. The actual test/build running happens via executors.
// NO LLM calls — summary is generated locally from git data.

import { execFile } from "child_process";
import * as path from "path";
import { spineEvents } from "../main/events";
import type { SpineState, SpineDiff } from "./types";

// ============================================================================
// HELPERS — Safe command execution
// ============================================================================

/**
 * Run a command and return stdout. Returns empty string on error.
 * Uses execFile to avoid shell injection.
 */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number = 10_000
): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: timeoutMs, encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        resolve("");
      } else {
        resolve(stdout || "");
      }
    });
  });
}

// ============================================================================
// BUILD SPINE — Capture project state snapshot
// ============================================================================

/**
 * buildSpine: Capture a lightweight project state snapshot.
 *
 * Collects:
 * - File inventory (excluding node_modules, .git)
 * - Git status (branch, uncommitted changes, untracked files)
 * - Project state and activity timestamp
 *
 * Does NOT run:
 * - npm test (too slow for a gate check)
 * - npm build (too slow for a gate check)
 * - docker ps (not always available)
 * - health checks (not always relevant)
 * - LLM calls (unnecessary overhead)
 */
export async function buildSpine(
  projectDir: string,
  dagProgress?: SpineState["dagProgress"]
): Promise<SpineState> {
  const timestamp = Date.now();
  const errors: Array<{ command: string; error: string; timestamp: number }> = [];

  // ========================================================================
  // 1. FILE INVENTORY — find {projectDir} -type f (excluding node_modules, .git)
  // ========================================================================
  let files = { total: 0, byType: {} as Record<string, number>, list: [] as string[] };
  try {
    const output = await runCommand(
      "find",
      [projectDir, "-type", "f", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*"],
      projectDir,
      30_000
    );

    const fileList = output.split("\n").filter((line) => line.length > 0);
    files.list = fileList;
    files.total = fileList.length;

    // Count by extension
    for (const file of fileList) {
      const ext = path.extname(file) || "no-extension";
      files.byType[ext] = (files.byType[ext] || 0) + 1;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push({ command: "find -type f", error: errorMsg, timestamp: Date.now() });
  }

  // ========================================================================
  // 2. GIT STATUS — branch + porcelain status
  // ========================================================================
  let gitStatus = { branch: "", uncommitted: [] as string[], untracked: [] as string[] };
  try {
    // Get branch name
    const branchOutput = await runCommand(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      projectDir
    );
    gitStatus.branch = branchOutput.trim();

    // Get porcelain status
    const statusOutput = await runCommand(
      "git",
      ["status", "--porcelain"],
      projectDir
    );

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
    errors.push({ command: "git status", error: errorMsg, timestamp: Date.now() });
  }

  // ========================================================================
  // 3. CHANGE SUMMARY — Generated locally from git data (no LLM)
  // ========================================================================
  let changesSummary: string | undefined;
  if (gitStatus.uncommitted.length > 0 || gitStatus.untracked.length > 0) {
    changesSummary = `${gitStatus.uncommitted.length} modified file(s), ${gitStatus.untracked.length} untracked file(s)`;
  }

  // ========================================================================
  // ASSEMBLE FINAL STATE
  // ========================================================================
  const spine: SpineState = {
    timestamp,
    projectDir,
    files,
    gitStatus,
    projectState: "OPEN",
    lastActivity: Date.now(),
    dagProgress: dagProgress ?? {
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: [],
      currentStep: undefined,
    },
    changesSummary,
    errors,
  };

  // Emit spine refreshed event with file count
  spineEvents.refreshed(files.total);

  return spine;
}

// ============================================================================
// COMPARE SPINES — Diff two snapshots
// ============================================================================

/**
 * compareSpines: Compute the difference between two SpineState snapshots.
 *
 * Returns a SpineDiff indicating:
 * - Files added, modified, or removed between snapshots
 * - Git state changes (uncommitted, untracked)
 * - Whether test or build state changed (based on file patterns)
 */
export function compareSpines(before: SpineState, after: SpineState): SpineDiff {
  const beforeFiles = new Set(before.files.list);
  const afterFiles = new Set(after.files.list);

  // Files added: in after but not in before
  const filesAdded: string[] = [];
  for (const file of afterFiles) {
    if (!beforeFiles.has(file)) {
      filesAdded.push(file);
    }
  }

  // Files removed: in before but not in after
  const filesRemoved: string[] = [];
  for (const file of beforeFiles) {
    if (!afterFiles.has(file)) {
      filesRemoved.push(file);
    }
  }

  // Files modified: detect via git status changes
  // A file is "modified" if it appears in after's uncommitted but not in before's uncommitted
  const beforeUncommitted = new Set(before.gitStatus.uncommitted);
  const afterUncommitted = new Set(after.gitStatus.uncommitted);

  const filesModified: string[] = [];
  for (const file of afterUncommitted) {
    if (!beforeUncommitted.has(file)) {
      filesModified.push(file);
    }
  }

  // Detect test/build state changes by looking at relevant file patterns
  const testFilePatterns = [".test.", ".spec.", "__tests__", "test/", "tests/"];
  const buildFilePatterns = ["dist/", "build/", ".next/", "out/"];

  const testStateChanged = filesAdded
    .concat(filesModified)
    .concat(filesRemoved)
    .some((f) => testFilePatterns.some((p) => f.includes(p)));

  const buildStateChanged = filesAdded
    .concat(filesModified)
    .concat(filesRemoved)
    .some((f) => buildFilePatterns.some((p) => f.includes(p)));

  // Emit spine compared event with added and modified counts
  spineEvents.compared(filesAdded.length, filesModified.length);

  return {
    filesAdded,
    filesModified,
    filesRemoved,
    gitChanges: {
      uncommittedBefore: before.gitStatus.uncommitted,
      uncommittedAfter: after.gitStatus.uncommitted,
      untrackedBefore: before.gitStatus.untracked,
      untrackedAfter: after.gitStatus.untracked,
    },
    testStateChanged,
    buildStateChanged,
  };
}

// ============================================================================
// VALIDATION — Ensure spine has required sections
// ============================================================================

/**
 * Validate that a SpineState has all required sections populated.
 */
export function validateSpineState(spine: SpineState): boolean {
  if (!spine.files || spine.files.list === undefined) return false;
  if (!spine.gitStatus) return false;
  if (!spine.dagProgress) return false;
  if (!spine.projectState) return false;
  return true;
}
