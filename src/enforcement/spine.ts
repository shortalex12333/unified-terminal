// Enforcement Engine — Spine (State Snapshots + Active Reviews)
// Builds a lightweight project state snapshot using git and filesystem data.
// NO npm test, npm build, docker, or health checks — those are too heavy for
// a pre/post gate check. The actual test/build running happens via executors.
// NO LLM calls — summary is generated locally from git data.
//
// Enhanced functionality:
// - Acknowledges accepted work (writes to spine_acks/)
// - Writes structured reviews with "what's next" recommendations
// - Emits events for PA to act on

import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { spineEvents } from "../main/events";
import { getLedgerWriter } from "../ledger";
import type { WorkOutput } from "../worker/work-output";
import type { SpineState, SpineDiff, BodyguardVerdict } from "./types";
import type { RemainingWorkItem, SpineReviewPayload } from "../ledger/types";

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
  afterFiles.forEach((file) => {
    if (!beforeFiles.has(file)) {
      filesAdded.push(file);
    }
  });

  // Files removed: in before but not in after
  const filesRemoved: string[] = [];
  beforeFiles.forEach((file) => {
    if (!afterFiles.has(file)) {
      filesRemoved.push(file);
    }
  });

  // Files modified: detect via git status changes
  // A file is "modified" if it appears in after's uncommitted but not in before's uncommitted
  const beforeUncommitted = new Set(before.gitStatus.uncommitted);
  const afterUncommitted = new Set(after.gitStatus.uncommitted);

  const filesModified: string[] = [];
  afterUncommitted.forEach((file) => {
    if (!beforeUncommitted.has(file)) {
      filesModified.push(file);
    }
  });

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

// ============================================================================
// SPINE ACKNOWLEDGMENTS
// ============================================================================

function getSpineAckDir(projectRoot: string): string {
  return path.join(projectRoot, ".kenoki", "spine_acks");
}

function ensureSpineAckDir(projectRoot: string): void {
  const dir = getSpineAckDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write acknowledgment file for accepted work.
 */
function writeAcknowledgment(
  projectRoot: string,
  stepId: string,
  workOutput: WorkOutput,
  verdict: BodyguardVerdict
): void {
  ensureSpineAckDir(projectRoot);

  const ackPath = path.join(getSpineAckDir(projectRoot), `ack_${stepId}.md`);
  const content = `# Spine Acknowledgment

## Step: ${stepId}
**Verdict:** ACCEPTED
**Received:** ${new Date().toISOString()}
**Worker:** ${workOutput.workerId}

## Gate Results
- Checks Run: ${verdict.checksRun}
- Checks Timed Out: ${verdict.checksTimedOut}
- Execution Time: ${verdict.executionTimeMs}ms

## Work Summary
**Task:** ${workOutput.task}

**Reasoning:** ${workOutput.reasoning}

**Approach:** ${workOutput.approach}

## Files Changed
${workOutput.filesCreated.concat(workOutput.filesModified).map((f) => `- ${f}`).join("\n") || "_None_"}

## Test Status
- Tests Run: ${workOutput.testsRun ? "Yes" : "No"}
- Tests Passed: ${workOutput.testsPassed ? "Yes" : "No"}

## Open Items
### Assumptions
${workOutput.assumptions.map((a) => `- ${a}`).join("\n") || "_None_"}

### Questions
${workOutput.openQuestions.map((q) => `- ${q}`).join("\n") || "_None_"}

### Blockers
${workOutput.blockers.map((b) => `- ${b}`).join("\n") || "_None_"}
`;

  fs.writeFileSync(ackPath, content, "utf-8");
  console.log(`[Spine] Wrote acknowledgment: ${ackPath}`);
}

// ============================================================================
// "WHAT'S NEXT" ANALYSIS
// ============================================================================

/**
 * Classify what type of agent should handle this work.
 */
function classifyWorkType(description: string): RemainingWorkItem["agentType"] {
  const lower = description.toLowerCase();

  if (lower.includes("image") || lower.includes("design") || lower.includes("visual")) {
    return "image_gen";
  }
  if (lower.includes("research") || lower.includes("find") || lower.includes("look up")) {
    return "research";
  }
  if (lower.includes("browser") || lower.includes("website") || lower.includes("scrape")) {
    return "web";
  }

  return "cli"; // Default to CLI for code work
}

/**
 * Determine if an assumption is risky enough to flag.
 */
function isRiskyAssumption(assumption: string): boolean {
  const riskyPatterns = [
    /security/i,
    /auth/i,
    /permission/i,
    /database/i,
    /production/i,
    /deploy/i,
    /api key/i,
    /secret/i,
  ];

  return riskyPatterns.some((p) => p.test(assumption));
}

/**
 * Analyze remaining work based on worker output and state diff.
 */
function analyzeRemainingWork(
  workOutput: WorkOutput,
  _diff: SpineDiff
): RemainingWorkItem[] {
  const remaining: RemainingWorkItem[] = [];

  // Blockers become high-priority next tasks
  for (const blocker of workOutput.blockers) {
    remaining.push({
      description: blocker,
      agentType: classifyWorkType(blocker),
      priority: "high",
      dependencies: [workOutput.stepId],
      source: "blocker",
    });
  }

  // Open questions need resolution
  for (const question of workOutput.openQuestions) {
    remaining.push({
      description: question,
      agentType: "research", // Questions often need research or user input
      priority: "medium",
      dependencies: [],
      source: "question",
    });
  }

  // Unverified assumptions may need validation
  for (const assumption of workOutput.assumptions) {
    // Only flag risky assumptions
    if (isRiskyAssumption(assumption)) {
      remaining.push({
        description: `Verify assumption: ${assumption}`,
        agentType: "cli",
        priority: "low",
        dependencies: [workOutput.stepId],
        source: "assumption",
      });
    }
  }

  // If tests didn't pass, that's high priority
  if (workOutput.testsRun && !workOutput.testsPassed) {
    remaining.push({
      description: "Fix failing tests",
      agentType: "cli",
      priority: "high",
      dependencies: [workOutput.stepId],
      source: "incomplete",
    });
  }

  return remaining;
}

// ============================================================================
// SPINE REVIEW
// ============================================================================

/**
 * Write a structured review to the ledger with "what's next" recommendations.
 */
function writeSpineReview(
  projectRoot: string,
  stepId: string,
  workOutput: WorkOutput,
  diff: SpineDiff
): SpineReviewPayload {
  const remainingWork = analyzeRemainingWork(workOutput, diff);

  const review: SpineReviewPayload = {
    stepId,
    workerId: workOutput.workerId,
    gateVerdict: "ACCEPTED",
    filesChanged: diff.filesAdded.concat(diff.filesModified),
    testsPassing: workOutput.testsPassed,
    remainingWork,
    nextStepSuggestion:
      remainingWork.length > 0 ? remainingWork[0].description : null,
    reviewedAt: new Date().toISOString(),
  };

  // Write to ledger
  const writer = getLedgerWriter(projectRoot);
  writer.writeSpineReview(review);

  console.log(
    `[Spine] Wrote review for ${stepId}: ${remainingWork.length} remaining items`
  );

  return review;
}

// ============================================================================
// EVENT HANDLER — Respond to Bodyguard acceptance
// ============================================================================

// Store pre-step spine for diffing (module-level state)
const preStepSpines: Map<string, SpineState> = new Map();

/**
 * Capture pre-step spine for later comparison.
 * Call this BEFORE worker executes.
 */
export async function capturePreStepSpine(
  projectRoot: string,
  stepId: string
): Promise<void> {
  const spine = await buildSpine(projectRoot);
  preStepSpines.set(stepId, spine);
  console.log(`[Spine] Captured pre-step snapshot for ${stepId}`);
}

/**
 * Handle Bodyguard accepting work.
 * This is the main entry point from Bodyguard → Spine.
 */
export async function handleWorkAccepted(
  projectRoot: string,
  data: {
    stepId: string;
    workOutput: WorkOutput;
    verdict: BodyguardVerdict;
    acceptedAt: string;
  }
): Promise<SpineReviewPayload> {
  const { stepId, workOutput, verdict } = data;

  console.log(`[Spine] Received accepted work for step ${stepId}`);

  // 1. Take post-step snapshot
  const afterSpine = await buildSpine(projectRoot);

  // 2. Get pre-step snapshot (or build one if missing)
  let beforeSpine = preStepSpines.get(stepId);
  if (!beforeSpine) {
    console.warn(
      `[Spine] No pre-step snapshot for ${stepId}, using current as baseline`
    );
    beforeSpine = afterSpine;
  }

  // 3. Compute diff
  const diff = compareSpines(beforeSpine, afterSpine);

  // 4. Write acknowledgment
  writeAcknowledgment(projectRoot, stepId, workOutput, verdict);

  // 5. Write review with "what's next"
  const review = writeSpineReview(projectRoot, stepId, workOutput, diff);

  // 6. Clean up pre-step snapshot
  preStepSpines.delete(stepId);

  // 7. Emit for PA
  spineEvents.reviewed(review);

  return review;
}
