# Instance 3 Critical Fixes — Hardcoded Enforcement Engine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 critical runtime bugs and 5 missing JSON templates, then document architecture at F1 quality standard.

**Architecture:** Instance 3 provides the enforcement specification (constants, checks, engine logic, templates). These fixes ensure:
1. All check scripts have working exit code logic
2. Engine core files import real constants (zero hardcoded values)
3. All 11 hard rails have JSON configuration templates (100% coverage)
4. Comprehensive architecture documentation enabling Instance 4 implementation

**Tech Stack:** TypeScript, Python, Bash, JSON, RPC, child_process

**Status:** 72/100 → Target: 95/100 (production-ready)

---

## PHASE 1: CRITICAL CODE FIXES (4 Tasks)

### Task 1: Fix check_docker_health.py Return Logic

**Files:**
- Modify: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_docker_health.py:1-143`
- Test: Run manual validation against mock project

**Problem:** Lines 57-63 pass invalid `cwd` parameter to `docker run`; lines 137-143 return inside finally block causing control flow error.

**Step 1: Read current file to understand structure**

```bash
cd /Users/celeste7/Documents/unified-terminal
cat docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_docker_health.py | head -80
```

Expected: Confirm the `cwd=project_dir` issue and finally block placement.

**Step 2: Write test file for docker health check**

Create: `tests/check_docker_health_test.py`

```python
import subprocess
import tempfile
import os
import sys

def test_docker_health_returns_exit_code():
    """Test that check_docker_health.py returns proper exit code."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create minimal docker-compose.yml
        compose_path = os.path.join(tmpdir, "docker-compose.yml")
        with open(compose_path, "w") as f:
            f.write("""
version: "3.8"
services:
  app:
    image: node:18-alpine
    ports:
      - "3000:3000"
    command: "echo 'ready' && sleep 100"
""")

        # Run check script
        result = subprocess.run(
            [sys.executable, "docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_docker_health.py", tmpdir],
            capture_output=True,
            text=True,
            timeout=60
        )

        # Should exit 0 (container healthy) or 1 (not healthy), but NOT crash
        assert result.returncode in [0, 1], f"Unexpected exit code: {result.returncode}\nStdout: {result.stdout}\nStderr: {result.stderr}"
        print(f"✅ Test passed with exit code: {result.returncode}")

if __name__ == "__main__":
    test_docker_health_returns_exit_code()
```

**Step 3: Run test to see current failure**

```bash
cd /Users/celeste7/Documents/unified-terminal
python tests/check_docker_health_test.py
```

Expected: FAIL with "TypeError: cwd is not supported with shell=False" or similar.

**Step 4: Fix the docker health check**

Modify: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_docker_health.py`

Replace lines 35-80 with:

```python
def ensure_running(project_dir: str) -> tuple[bool, str]:
    """Ensure docker container is running. Returns (success, message)."""

    # Change to project directory first
    original_cwd = os.getcwd()
    os.chdir(project_dir)

    try:
        # Check if docker-compose.yml exists
        if not os.path.exists("docker-compose.yml"):
            return False, "docker-compose.yml not found"

        # Start container
        start_result = subprocess.run(
            ["docker-compose", "up", "-d"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if start_result.returncode != 0:
            return False, f"docker-compose up failed: {start_result.stderr}"

        # Wait for health check
        for attempt in range(3):
            time.sleep(2)
            health_result = subprocess.run(
                ["docker-compose", "ps"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if "Up" in health_result.stdout:
                return True, "Container is running"

        return False, "Container failed to start"

    finally:
        os.chdir(original_cwd)


def check_curl(project_dir: str) -> tuple[bool, str]:
    """Check if localhost:3000 responds with 200. Returns (success, message)."""

    for attempt in range(3):
        try:
            response = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:3000"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if response.stdout.strip() == "200":
                return True, "HTTP 200 from localhost:3000"

            time.sleep(2)
        except subprocess.TimeoutExpired:
            if attempt < 2:
                time.sleep(2)
                continue
            return False, "curl timeout"

    return False, "HTTP response was not 200"
```

Replace lines 130-145 (the main function) with:

```python
def main():
    if len(sys.argv) < 2:
        print("Usage: check_docker_health.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    # Step 1: Ensure running
    success, msg = ensure_running(project_dir)
    if not success:
        print(f"FAIL: {msg}", file=sys.stderr)
        sys.exit(1)

    # Step 2: Check curl
    success, msg = check_curl(project_dir)
    if not success:
        print(f"FAIL: {msg}", file=sys.stderr)
        sys.exit(1)

    print("PASS: Docker health check successful")
    sys.exit(0)


if __name__ == "__main__":
    main()
```

**Step 5: Run test again**

```bash
cd /Users/celeste7/Documents/unified-terminal
python tests/check_docker_health_test.py
```

Expected: PASS (exit code 0 or 1, no crash).

**Step 6: Commit**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_docker_health.py tests/check_docker_health_test.py
git commit -m "fix: repair check_docker_health.py return logic and cwd handling"
```

---

### Task 2: Fix bodyguard.ts to Import Real Constants

**Files:**
- Modify: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/bodyguard.ts:1-100`
- Verify: All imports resolve to constants/

**Problem:** Lines 17-98 define placeholder constants instead of importing from `constants/`.

**Step 1: Read current bodyguard.ts**

```bash
head -100 docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/bodyguard.ts
```

Expected: Confirm mock constants (CHECK_ACTIVATION, BODYGUARD, etc.) are defined inline.

**Step 2: Update bodyguard.ts imports**

Modify: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/bodyguard.ts` lines 1-20

Replace with:

```typescript
import { CHECK_ACTIVATION } from '../constants/10-check-activation';
import { BODYGUARD } from '../constants/25-bodyguard';
import { ENFORCER_RETRY_POLICIES } from '../constants/09-retry-policies';
import type {
  EnforcerCheck,
  DagStep,
  BodyguardVerdict,
  GateResult
} from './types';
import { Enforcer } from './enforcer';

// Source: HARDCODED-ENFORCEMENT-VALUES.md sections 9-11, ENFORCEMENT-GAPS.md gap 1
```

**Step 3: Remove placeholder constants (lines 17-98)**

Find and delete all `const CHECK_ACTIVATION = ...` and `const BODYGUARD = ...` definitions.

Keep only the actual bodyguard implementation.

**Step 4: Verify compilation**

```bash
cd /Users/celeste7/Documents/unified-terminal
npx tsc docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/bodyguard.ts --noEmit --skipLibCheck --target es2020
```

Expected: No errors. If errors occur, check that all constants/\*.ts files exist and export correctly.

**Step 5: Verify no hardcoded magic numbers**

```bash
grep -n "= [0-9]" docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/bodyguard.ts | grep -v "constants/" | grep -v "//"
```

Expected: No output (zero matches).

**Step 6: Commit**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/bodyguard.ts
git commit -m "fix: bodyguard.ts import real constants, remove placeholders"
```

---

### Task 3: Integrate Circuit Breaker in step-scheduler.ts Step [8]

**Files:**
- Modify: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts:170-190`
- Verify: Circuit breaker handler is called on hard fail

**Problem:** Step [8] (hard fail handling) just throws instead of calling `circuit-breaker.ts`.

**Step 1: Read current step-scheduler.ts around step [8]**

```bash
sed -n '170,190p' docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts
```

Expected: See `if (bodyguardVerdict.gate.verdict === "HARD_FAIL") { throw ... }`

**Step 2: Update imports in step-scheduler.ts**

Add to top of file (after existing imports):

```typescript
import { handleCheckFail, UserAction } from './circuit-breaker';
```

**Step 3: Replace step [8] logic**

Modify: `engine/step-scheduler.ts` around line 175

Find and replace:

```typescript
// BEFORE:
if (bodyguardVerdict.gate.verdict === "HARD_FAIL") {
  throw new Error(`Hard fail on step ${step.name}: ${failedCheck}`);
}
```

With:

```typescript
// AFTER:
// Step [8]: Handle hard fail via circuit breaker
if (bodyguardVerdict.gate.verdict === "HARD_FAIL") {
  const failedCheck = bodyguardVerdict.gate.failedChecks?.[0];
  const failureReason = bodyguardVerdict.gate.evidence || "Unknown";

  const userAction: UserAction = await handleCheckFail(
    failedCheck || "unknown",
    {
      passed: false,
      output: failureReason,
      evidence: bodyguardVerdict.gate.evidence || ""
    }
  );

  switch (userAction) {
    case "Retry":
      // Retry the entire step
      return executeStep(step, tierIndex - 1);

    case "Skip":
      // Mark step as skipped, continue to next
      return {
        stepName: step.name,
        passed: true,
        skipped: true,
        reason: `User skipped after hard fail: ${failureReason}`
      };

    case "Stop":
      // User chose to stop build entirely
      throw new Error(`User stopped build after hard fail: ${failureReason}`);
  }
}
```

**Step 4: Verify compilation**

```bash
cd /Users/celeste7/Documents/unified-terminal
npx tsc docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts --noEmit --skipLibCheck --target es2020 2>&1 | head -20
```

Expected: No errors.

**Step 5: Verify circuit-breaker is imported and called**

```bash
grep -n "handleCheckFail\|import.*circuit-breaker" docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts
```

Expected: At least 2 matches (import + function call).

**Step 6: Commit**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts
git commit -m "fix: integrate circuit-breaker in step-scheduler step [8]"
```

---

### Task 4: Complete PA Comparison Implementation (Step [9])

**Files:**
- Modify: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts:200-220`
- Verify: PA comparison returns proper result (not stub)

**Problem:** Step [9] (PA comparison) always returns `passed: true` without validation.

**Step 1: Read current step [9] implementation**

```bash
sed -n '200,220p' docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts
```

Expected: See stub like `return { passed: true }`.

**Step 2: Implement PA comparison**

Replace step [9] logic:

```typescript
// Step [9]: PA Comparison (Soft Rail)
// SOFT RAIL: LLM-mediated code review. Interface only; actual comparison done by PA agent.
const paComparison = await conductorLLM.compareAgainstSpec({
  stepName: step.name,
  expectedOutputType: step.expectedOutputType,
  actualOutput: stepResult.output,
  acceptanceCriteria: step.acceptanceCriteria
});

// PA returns: { approved: boolean, feedback: string, confidence: number }
// Soft rails don't block; they warn
if (!paComparison.approved && paComparison.confidence > 0.8) {
  // High-confidence rejection — log but don't fail
  console.warn(
    `⚠️  PA Review: ${step.name} rejected with ${paComparison.confidence * 100}% confidence\n` +
    `Feedback: ${paComparison.feedback}`
  );
} else if (paComparison.approved) {
  // Approval logged
  console.log(`✅ PA Review: ${step.name} approved`);
}
```

**Step 3: Verify step [9] doesn't fail the build**

Confirm the code has no `throw` statements and returns result with `passed: true` regardless of PA verdict.

**Step 4: Verify compilation**

```bash
npx tsc docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts --noEmit --skipLibCheck --target es2020
```

Expected: No errors.

**Step 5: Commit**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/step-scheduler.ts
git commit -m "fix: implement PA comparison as soft rail in step-scheduler step [9]"
```

---

## PHASE 2: MISSING JSON TEMPLATES (5 Tasks)

Each template follows the pattern from existing templates (enforcer-test-before-commit.json, etc.).

### Task 5: Create enforcer-build-artifact.json

Create: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-build-artifact.json`

```json
{
  "name": "build-artifact-check",
  "description": "Verify build artifacts exist (dist/ contains .html, .js, .css)",
  "checkScript": "check_build_artifact.py",
  "stepType": "build",
  "applicableCardTypes": ["FaultCard", "WorkOrderCard"],
  "failureMode": "HARD",
  "allowSkip": false,
  "allowRetry": true,
  "confidence": 1.0,
  "evidence": {
    "required": true,
    "format": "json",
    "fields": ["fileCount", "extensions", "totalSize"]
  },
  "timeout": 30,
  "retryCount": 2,
  "activation": {
    "trigger": "after_npm_build",
    "condition": "buildCommand !== null"
  }
}
```

**Commit:**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-build-artifact.json
git commit -m "feat: add enforcer-build-artifact.json template"
```

---

### Task 6: Create enforcer-secret-detection.json

Create: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-secret-detection.json`

```json
{
  "name": "secret-detection-check",
  "description": "Scan repo for hardcoded secrets (API keys, tokens, credentials) using gitleaks",
  "checkScript": "check_secrets.sh",
  "stepType": "security",
  "applicableCardTypes": ["DeploymentCard"],
  "failureMode": "HARD",
  "allowSkip": false,
  "allowRetry": false,
  "confidence": 1.0,
  "evidence": {
    "required": true,
    "format": "json",
    "fields": ["secretsFound", "locations", "severity"]
  },
  "timeout": 60,
  "retryCount": 0,
  "activation": {
    "trigger": "before_deploy",
    "condition": "deployTarget !== null"
  },
  "severity": "CRITICAL",
  "blockDeployment": true
}
```

**Commit:**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-secret-detection.json
git commit -m "feat: add enforcer-secret-detection.json template"
```

---

### Task 7: Create enforcer-token-threshold.json

Create: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-token-threshold.json`

```json
{
  "name": "token-threshold-check",
  "description": "Verify agent token usage against per-model limits (Claude, Gemini, Codex)",
  "checkScript": "check_tokens.py",
  "stepType": "resource",
  "applicableCardTypes": ["AgentCard"],
  "failureMode": "HARD",
  "allowSkip": false,
  "allowRetry": true,
  "confidence": 0.95,
  "evidence": {
    "required": true,
    "format": "json",
    "fields": ["modelName", "tokensUsed", "threshold", "percentageUsed"]
  },
  "timeout": 10,
  "retryCount": 1,
  "activation": {
    "trigger": "every_spawn",
    "condition": "agentTier !== null"
  },
  "threshold": {
    "claude-sonnet-4": 110000,
    "claude-opus-4": 200000,
    "gemini-2.0-flash": 80000
  }
}
```

**Commit:**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-token-threshold.json
git commit -m "feat: add enforcer-token-threshold.json template"
```

---

### Task 8: Create enforcer-responsive.json

Create: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-responsive.json`

```json
{
  "name": "responsive-design-check",
  "description": "Verify responsive design at 3 viewports (mobile, tablet, desktop) using Playwright",
  "checkScript": "check_responsive.py",
  "stepType": "frontend",
  "applicableCardTypes": ["FeatureCard"],
  "failureMode": "SOFT",
  "allowSkip": true,
  "allowRetry": true,
  "confidence": 0.75,
  "evidence": {
    "required": true,
    "format": "screenshot",
    "fields": ["viewportWidth", "viewportHeight", "screenshotPath", "fileSize"]
  },
  "timeout": 45,
  "retryCount": 2,
  "activation": {
    "trigger": "after_build",
    "condition": "hasReactComponents === true"
  },
  "viewports": [
    { "name": "mobile", "width": 375, "height": 667 },
    { "name": "tablet", "width": 768, "height": 1024 },
    { "name": "desktop", "width": 1920, "height": 1080 }
  ],
  "minScreenshotSize": 1024
}
```

**Commit:**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-responsive.json
git commit -m "feat: add enforcer-responsive.json template"
```

---

### Task 9: Create enforcer-uninstall-verify.json

Create: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-uninstall-verify.json`

```json
{
  "name": "uninstall-verify-check",
  "description": "Verify package uninstallation — confirm node_modules/{pkg} is gone after npm uninstall",
  "checkScript": "check_uninstall.py",
  "stepType": "dependency",
  "applicableCardTypes": ["MaintenanceCard"],
  "failureMode": "HARD",
  "allowSkip": false,
  "allowRetry": true,
  "confidence": 1.0,
  "evidence": {
    "required": true,
    "format": "json",
    "fields": ["packageName", "wasRemoved", "nodeModulesPath"]
  },
  "timeout": 20,
  "retryCount": 1,
  "activation": {
    "trigger": "after_npm_uninstall",
    "condition": "uninstalledPackages.length > 0"
  },
  "packages": []
}
```

**Commit:**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/templates/enforcer-uninstall-verify.json
git commit -m "feat: add enforcer-uninstall-verify.json template"
```

---

## PHASE 3: F1-QUALITY DOCUMENTATION

### Task 10: Create DEFINITIVE-ARCHITECTURE.md

Create: `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/DEFINITIVE-ARCHITECTURE.md`

(See **DETAILED CONTENT BELOW** — this is a substantial 400+ line document matching F1 standards)

**Commit:**

```bash
git add docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/DEFINITIVE-ARCHITECTURE.md
git commit -m "docs: add DEFINITIVE-ARCHITECTURE.md with F1-quality detail"
```

---

## VERIFICATION

After all fixes:

```bash
cd /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT

# Run full verification
bash verify.sh

# Expected output:
# ✅ PASS: Constants directory exists
# ✅ PASS: 33 constants files created
# ✅ PASS: All constants compile
# ... (all checks pass)
# ✅ ALL VERIFICATIONS PASSED
```

---

## DEFINITIVE-ARCHITECTURE.md CONTENT

(This will be the detailed architecture document matching F1 Search Engine quality)

```markdown
# Hardcoded Enforcement Engine — Definitive Architecture

> **Status:** GOSPEL — Authoritative reference for enforcement system
> **Last Updated:** 2026-03-03
> **Maintainer:** Engineering Team

---

## Executive Summary

The Hardcoded Enforcement Engine is a **11-check verification system** that prevents agent failures through binary-checkable guard rails. It operates on a **two-layer architecture** separating specification (Instance 3) from execution (Instance 4), enabling deterministic enforcement across 24/7 autonomous agent operations.

**Two Critical Layers:**

| Layer | Type | Purpose | When It Runs |
|-------|------|---------|--------------|
| **Specification** | Static | Defines all enforcement constants and check templates | Once at startup |
| **Execution** | Runtime | Spawns agents, monitors checks, enforces circuit breaker | Every step in DAG |

---

## 1. The 11-Check Guard Rail System

### 1.1 Hard Rails (Code-Enforced, ~80% failure catch)

These checks have deterministic results — no LLM interpretation.

| # | Check | Script | Detects | Confidence |
|---|-------|--------|---------|-----------|
| 1 | **Test Suite Exit** | `check_tests.py` | Broken tests before commit | 100% |
| 2 | **File Existence** | `check_files_exist.py` | Missing declared files | 100% |
| 3 | **File Non-Empty** | `check_files_nonempty.py` | Empty/stub implementations | 100% |
| 4 | **Build Artifacts** | `check_build_artifact.py` | Build failure | 100% |
| 5 | **Scope Boundary** | `check_scope.py` | Accidental file modifications | 100% |
| 6 | **Token Threshold** | `check_tokens.py` | Agent resource exhaustion | 95% |
| 7 | **Secret Detection** | `check_secrets.sh` | Hardcoded credentials | 99% |
| 8 | **Package Removal** | `check_uninstall.py` | Uninstall failures | 100% |
| 9 | **Docker Health** | `check_docker_health.py` | Container not running | 95% |
| 10 | **Lesson Validity** | `check_lesson.py` | Incomplete knowledge capture | 100% |
| 11 | **Responsive Design** | `check_responsive.py` | UI broken on mobile | 75% |

### 1.2 Soft Rails (LLM-Mediated, ~15% failure catch)

These checks require interpretation:

| Type | Component | Example |
|------|-----------|---------|
| **Code Review** | PA Agent | "Is this implementation correct?" |
| **Design Compliance** | PA Agent | "Does this match the spec?" |
| **Architecture Fit** | PA Agent | "Is the approach sound?" |

---

## 2. The Spec Layer (Instance 3)

### 2.1 Constants Directory

**34 TypeScript files** define ALL enforcement parameters:

```
constants/
├── 01-context-warden.ts       # TOKEN_THRESHOLDS (section 1)
├── 02-cron-intervals.ts       # CRON_INTERVALS (section 2)
├── 03-timeouts.ts             # TIMEOUTS (section 3)
├── ...
├── 22-memory.ts               # MEMORY_CONSTRAINTS (section 24)
├── 25-bodyguard.ts            # GAP 1: max parallel checks
├── 26-spine-protocol.ts       # GAP 2: staleness rules
├── ...
├── 34-step-execution.ts       # GAP 10: heartbeat interval
└── index.ts                   # Re-exports all 34
```

**Key Principle:** No magic numbers in engine code. All constants imported from `constants/`.

Verify:
```bash
grep -r "= [0-9]" engine/ | grep -v "constants/" | wc -l
# Expected: 0
```

### 2.2 Check Scripts Directory

**12 executable files** (11 hard rails + 1 deploy variant):

```
checks/
├── check_tests.py             # #1
├── check_files_exist.py       # #2
├── check_files_nonempty.py    # #3
├── check_build_artifact.py    # #4
├── check_scope.py             # #5
├── check_tokens.py            # #6
├── check_secrets.sh           # #7
├── check_uninstall.py         # #8
├── check_docker_health.py     # #9
├── check_lesson.py            # #10
├── check_responsive.py        # #11
└── check_deploy_health.py     # Variant of #9, different URL
```

**Invocation Pattern:**

```bash
python3 checks/check_tests.py /path/to/project
# Exits 0 (pass) or 1 (fail)
# Writes JSON to stdout: { "passed": bool, "output": str }
```

### 2.3 Engine Directory

**12 TypeScript files** implementing enforcement logic:

```
engine/
├── types.ts                   # 25+ interfaces
├── enforcer.ts                # Spawns check script, captures output
├── bodyguard.ts               # Dispatcher: runs applicable checks in parallel
├── circuit-breaker.ts         # User escape hatch (Retry/Skip/Stop)
├── spine.ts                   # Project state snapshot
├── spine-lock.ts              # Write lock for concurrent safety
├── context-warden.ts          # Token monitor (cron every 30s)
├── heartbeat.ts               # Worker liveness detection
├── project-state.ts           # State machine (OPEN → PAUSED → CLOSED)
├── cron-manager.ts            # setInterval registry
├── step-scheduler.ts          # DAG executor (10-step flowchart)
└── agent-spawner.ts           # child_process.spawn + timeout
```

### 2.4 Templates Directory

**11 JSON configuration files** (one per hard rail + deploy variant):

```
templates/
├── enforcer-test-before-commit.json      # #1: tests
├── enforcer-files-exist.json             # #2: files exist
├── enforcer-build-artifact.json          # #4: dist/
├── enforcer-scope-boundary.json          # #5: git diff
├── enforcer-token-threshold.json         # #6: tokens
├── enforcer-secret-detection.json        # #7: gitleaks
├── enforcer-uninstall-verify.json        # #8: uninstall
├── enforcer-docker-local-first.json      # #9: docker
├── enforcer-lesson.json                  # #10: lesson
├── enforcer-responsive.json              # #11: responsive
└── enforcer-deploy.json                  # Deploy variant of #9
```

---

## 3. The Execution Layer (Instance 4)

### 3.1 The 10-Step Flowchart

Every DAG step executes this deterministic sequence:

```
[1] Pre-step spine refresh
    ↓ (Get project state: files, git, tests, docker, curl)

[2] Context warden check
    ↓ (Check all agents' token usage against limits)

[3] Skill injection
    ↓ (Attach required tool paths to worker invocation)

[4] Spawn worker via adapter
    ↓ (child_process.spawn with PID tracking)

[5] Monitor heartbeat
    ↓ (Poll stdout/file/API for liveness signal, 3 beats max)

[6] Post-step spine refresh
    ↓ (Get updated project state after worker finishes)

[7] Bodyguard gate
    ↓ (Run applicable checks in parallel, aggregate verdict)

[8] Hard fail? → circuit breaker
    ↓ (If hard fail, ask user: Retry / Skip / Stop)

[9] PA comparison
    ↓ (LLM review of output, soft rail only — doesn't fail)

[10] Mark DONE, save state
    ↓ (Write SPINE.json + action_execution record)
```

### 3.2 The Bodyguard Dispatcher

**Core logic:** Read `CHECK_ACTIVATION` map, determine which checks apply to this step, run them in parallel.

**Pseudo-code:**

```typescript
async function gateCheck(step: DagStep, tier: number): Promise<BodyguardVerdict> {
  // 1. Lookup CHECK_ACTIVATION[step.name]
  const applicableChecks = CHECK_ACTIVATION[step.name] || [];

  // 2. Batch checks into groups of BODYGUARD.MAX_PARALLEL_CHECKS
  const batches = chunk(applicableChecks, BODYGUARD.MAX_PARALLEL_CHECKS);

  // 3. For each batch, spawn all checks in parallel via Promise.allSettled()
  const results = await Promise.allSettled(
    applicableChecks.map(check =>
      enforcer.run(check, projectDir)
    )
  );

  // 4. Classify results
  const hardFails = results.filter(r => r.failureMode === "HARD" && !r.passed);
  const softFails = results.filter(r => r.failureMode === "SOFT" && !r.passed);

  // 5. Return verdict
  if (hardFails.length > 0) {
    return { verdict: "HARD_FAIL", failedChecks: hardFails, };
  }

  if (softFails.length > 0) {
    return { verdict: "SOFT_FAIL", warnings: softFails };
  }

  return { verdict: "PASS" };
}
```

### 3.3 The Circuit Breaker

When bodyguard returns `HARD_FAIL`, step scheduler invokes circuit breaker:

```typescript
const userAction = await handleCheckFail(failedCheck, evidence);
// Returns: "Retry" | "Skip" | "Stop"

switch (userAction) {
  case "Retry":
    return executeStep(step, tier); // Run step again

  case "Skip":
    return { passed: true, skipped: true }; // Mark as skipped, continue

  case "Stop":
    throw new Error("User stopped build"); // Abort entire DAG
}
```

---

## 4. Constants Mapping

Every constant is traceable to a source:

| Constant | Type | Source | Usage |
|----------|------|--------|-------|
| `TOKEN_THRESHOLDS` | object | Section 1 | context-warden.ts checks tokens |
| `CRON_INTERVALS` | object | Section 2 | cron-manager.ts timing |
| `BODYGUARD.MAX_PARALLEL_CHECKS` | number | Gap 1 | bodyguard.ts batching |
| `CIRCUIT_BREAKER` | object | Section 4 | circuit-breaker.ts options |
| `CHECK_ACTIVATION` | object | Section 11 | bodyguard.ts dispatch logic |

**Verification:**
```bash
grep -r "TOKEN_THRESHOLDS\|CRON_INTERVALS\|CHECK_ACTIVATION" engine/ | wc -l
# Expected: > 10 (all references go to constants/)
```

---

## 5. Data Flow: Complete Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                   HARDCODED ENFORCEMENT FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [SOURCE] Conductor DAG                                         │
│  {stepName, tierIndex, expectedOutputType}                     │
│                │                                                │
│                ▼                                                │
│  [LOADER] Load constants from constants/ via index.ts          │
│  { TOKEN_THRESHOLDS, CHECK_ACTIVATION, ... }                   │
│                │                                                │
│                ▼                                                │
│  [EXECUTOR] step-scheduler.ts                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [1] Pre-spine: spine.ts → read files, git, tests, curl │  │
│  │ [2] Warden: context-warden.ts → check agent tokens     │  │
│  │ [3] Inject: attach skill paths from DAG                │  │
│  │ [4] Spawn: agent-spawner.ts → child_process.spawn      │  │
│  │ [5] Heartbeat: heartbeat.ts → poll for liveness        │  │
│  │ [6] Post-spine: spine.ts → read updated state          │  │
│  │ [7] Bodyguard: bodyguard.ts → run checks in parallel   │  │
│  │           ↓ Promise.allSettled(CHECK_ACTIVATION[name]) │  │
│  │           ↓ Each check invokes check_*.py script       │  │
│  │           ↓ Aggregate: hard fails block, soft warn     │  │
│  │ [8] CB: circuit-breaker.ts → ask user if hard fail     │  │
│  │ [9] PA: LLM review (soft, doesn't fail)                │  │
│  │ [10] Save: write SPINE.json + action_execution record  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                │                                                │
│                ▼                                                │
│  [OUTPUT] SPINE.json { projectState, checks[], verdict }       │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Hard vs Soft Rails Visualization

```
       HARD RAILS (Code-Enforced)           SOFT RAILS (LLM-Mediated)
       ═════════════════════════             ═══════════════════════

       Exit Code Check ─────────┐            Code Review ─────────┐
       File Existence ──────────├─→ BLOCKS   Design Check ────────├─→ WARNS
       Build Artifacts ────────┤  BUILD     Arch Fitness ────────┤  ONLY
       Docker Health ──────────┘            (doesn't block)       └─→
       ... (11 total)

       Can't hallucinate.                   Can refuse (but not fail).
       Binary: 0 or 1.                      Confidence-based.
```

---

## 7. File Reference by Category

### 7.1 Constants & Configuration

| File | Lines | Purpose |
|------|-------|---------|
| `constants/01-context-warden.ts` | ~30 | TOKEN_THRESHOLDS for all models |
| `constants/09-retry-policies.ts` | ~25 | ENFORCER_RETRY_POLICIES |
| `constants/10-check-activation.ts` | ~50 | CHECK_ACTIVATION[stepName] → applicable checks |
| `constants/25-bodyguard.ts` | ~20 | BODYGUARD.MAX_PARALLEL_CHECKS, timeout |
| `templates/enforcer-*.json` | ~50 each | Check configuration (11 files) |

### 7.2 Enforcement Engine

| File | Lines | Purpose |
|------|-------|---------|
| `engine/enforcer.ts` | ~200 | Spawns check script, captures exit code |
| `engine/bodyguard.ts` | ~350 | Main dispatcher: reads CHECK_ACTIVATION, runs checks in parallel |
| `engine/circuit-breaker.ts` | ~250 | User escape hatch logic |
| `engine/step-scheduler.ts` | ~400 | DAG executor, 10-step flowchart |

### 7.3 Supporting Infrastructure

| File | Lines | Purpose |
|------|-------|---------|
| `engine/spine.ts` | ~250 | Project state snapshot (files, git, tests, docker, curl) |
| `engine/spine-lock.ts` | ~60 | Atomic write lock |
| `engine/context-warden.ts` | ~130 | Cron job: monitor token usage |
| `engine/heartbeat.ts` | ~120 | Worker liveness detection |

### 7.4 Check Scripts

| File | Lines | Purpose | Exit Code |
|------|-------|---------|-----------|
| `checks/check_tests.py` | ~80 | Test suite exit code | 0 = pass, 1 = fail |
| `checks/check_scope.py` | ~120 | Git diff whitelist enforcement | 0 = in scope, 1 = out |
| `checks/check_secrets.sh` | ~40 | gitleaks scan | 0 = no secrets, 1 = found |
| (etc. — 12 total) |  |  |  |

---

## 8. Deployment Mapping

This is Instance 3 → Instance 4 runs on:

| Component | Runs On | Trigger |
|-----------|---------|---------|
| constants/ | Loaded once | Instance 4 bootstrap |
| engine/*.ts | Main process | Every DAG step |
| checks/*.py | Subprocess | During bodyguard gate |
| Circuit breaker | Main process | Hard fail detected |
| Spine refresh | Every step | [1] and [6] |

---

## 9. Critical Constraints

| Constraint | Reason | Enforcement |
|------------|--------|------------|
| **No magic numbers in engine/** | Single source of truth | `grep -r "= [0-9]"` must return 0 |
| **Bodyguard is parallel** | Throughput | Must use `Promise.allSettled()` |
| **Spine has ≤1 LLM call** | Determinism | Mark with `// LLM CALL:` comment |
| **Circuit breaker is required** | User autonomy | Step [8] must call `handleCheckFail()` |
| **Check scripts are executable** | Subprocess invocation | `chmod +x checks/*.py checks/*.sh` |

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **Hard Rail** | Check with binary result (exit code 0/1). Cannot be hallucinated. |
| **Soft Rail** | Check requiring LLM interpretation. Can warn but not block. |
| **Bodyguard** | Dispatcher that runs applicable checks in parallel, aggregates verdict. |
| **Spine** | Complete project state snapshot (files, git, tests, docker, curl). |
| **Circuit Breaker** | User escape hatch. Catches hard fails, offers Retry/Skip/Stop. |
| **CHECK_ACTIVATION** | Map from step name to applicable check list. |
| **DAG** | Directed Acyclic Graph. Task execution plan with dependencies. |
| **Enforcer** | Subprocess runner. Spawns check script, captures output. |
| **Context Warden** | Background cron job. Monitors agent token usage. |
| **Heartbeat** | Worker liveness signal. 3 missed = stuck → kill. |

---

## 11. Success Criteria

Enforcement Engine is production-ready when ALL are true:

- [ ] All 34 constants files compile (TypeScript)
- [ ] All 12 check scripts are executable and exit 0/1 correctly
- [ ] All 12 engine files compile with zero magic numbers
- [ ] All 11 templates are valid JSON with correct schemas
- [ ] Bodyguard uses `Promise.allSettled()` (verified with grep)
- [ ] Spine has exactly 1 LLM call (verified with grep)
- [ ] Circuit breaker integrated in step-scheduler step [8]
- [ ] DEFINITIVE-ARCHITECTURE.md exists (this file)
- [ ] verify.sh passes all checks
- [ ] No hardcoded secrets or credentials anywhere

---

*This document is the authoritative reference for the Hardcoded Enforcement Engine. All engineering decisions should align with principles documented here.*
```

---

## COMMIT LOG SUMMARY

After completing all 10 tasks:

```bash
cd /Users/celeste7/Documents/unified-terminal

git log --oneline | head -10
# Expected:
# abc1234 docs: add DEFINITIVE-ARCHITECTURE.md with F1-quality detail
# def5678 feat: add enforcer-uninstall-verify.json template
# ghi9012 feat: add enforcer-responsive.json template
# jkl3456 feat: add enforcer-token-threshold.json template
# mno7890 feat: add enforcer-secret-detection.json template
# pqr1234 feat: add enforcer-build-artifact.json template
# stu5678 fix: implement PA comparison as soft rail in step-scheduler step [9]
# vwx9012 fix: integrate circuit-breaker in step-scheduler step [8]
# yza3456 fix: bodyguard.ts import real constants, remove placeholders
# bcd7890 fix: repair check_docker_health.py return logic and cwd handling
```

---

## FINAL VERIFICATION

```bash
bash docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/verify.sh

# Expected final output:
# ════════════════════════════════════════════════════════════════
# ✅ ALL VERIFICATIONS PASSED
#
# ENGINE READY FOR DEPLOYMENT
#
# Next steps:
#   1. Commit to git ✅
#   2. Instance 4 can begin implementation
#   3. Start with spine.ts integration tests
# ════════════════════════════════════════════════════════════════
```

**Current Score: 72/100 → Target: 95/100 ✅**

---

## EFFORT ESTIMATE

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Code Fixes | 4 | ~4 hours |
| Phase 2: Templates | 5 | ~2 hours |
| Phase 3: Documentation | 1 | ~3 hours |
| **TOTAL** | **10** | **~9 hours** |

Execution path:
1. **Subagent A** → Tasks 1-2 (check_docker_health + bodyguard imports)
2. **Subagent B** → Tasks 3-4 (circuit-breaker + PA comparison)
3. **Subagent C** → Tasks 5-9 (create 5 JSON templates)
4. **Subagent D** → Task 10 (DEFINITIVE-ARCHITECTURE.md)

All subagents work in parallel → total wall-clock: ~3 hours with parallelization.
