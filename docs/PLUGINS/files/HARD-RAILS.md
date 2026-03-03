# Hard Rails: Code-Based Enforcement (No AI)

## Philosophy

A hard rail is a check in code (Python, Node.js, bash) producing binary pass/fail with NO LLM involvement. Cannot be bypassed by hallucination. Runs in milliseconds.

**Why code, not AI:**
- LLMs hallucinate success. Agent verifying own work reports success 95% of the time regardless.
- LLMs skip verification under context pressure. At 60% utilization, verification is first thing dropped.
- LLMs cannot reliably parse exit codes or HTTP responses from their own output.
- Code runs in 10ms. LLM verification takes 3-15s and produces LESS reliable results.

**The rule:** If a check CAN be code, it MUST be code. Soft rails only for things requiring judgment.

---

## Implementation: Bodyguard Dispatcher

The Bodyguard is NOT an agent. It is a Node.js function:
1. Reads ENFORCER.json for current step
2. Spawns micro-checks in parallel (Promise.allSettled)
3. Collects binary results
4. Aggregates: all pass = gate open, any definitive fail = gate closed

```typescript
interface EnforcerCheck {
  name: string;
  check: string;           // bash command
  pass: string;            // JS expression evaluating output
  false_positive: string;
  secondary_check?: string;
  confidence: "definitive" | "heuristic";
  retry: { attempts: number; delay_ms: number };
  rail: "HARD";
}

async function runChecks(checks: EnforcerCheck[]): Promise<GateResult> {
  const results = await Promise.allSettled(
    checks.map(c => runSingleCheck(c))
  );
  const failures = results
    .filter(r => r.status === "fulfilled" && !r.value.passed)
    .map(r => r.value);
  const definitiveFailures = failures.filter(f => f.confidence === "definitive");
  return {
    passed: failures.length === 0,
    canOverride: definitiveFailures.length === 0,
    failures
  };
}
```

---

## The Complete Hard Rail Catalog

### 1. Test Suite Exit Code
**What:** `npm test` (Vitest) returns 0 or non-0.
**Why:** Most fundamental quality check.
**Where used:** After every EXECUTE step modifying code.
**Tier:** 1+

```python
# check_tests.py
import subprocess, sys, json

result = subprocess.run(["npm", "test"], capture_output=True, text=True)
if result.returncode != 0:
    print(f"FAIL: Tests returned exit code {result.returncode}")
    sys.exit(1)

# Secondary: verify tests actually ran (not empty suite)
try:
    r2 = subprocess.run(
        ["npx", "vitest", "--reporter=json"],
        capture_output=True, text=True, timeout=60
    )
    data = json.loads(r2.stdout)
    if data.get("numTotalTests", 0) == 0:
        print("FAIL: 0 tests ran (empty suite)")
        sys.exit(1)
    print(f"PASS: {data['numTotalTests']} tests, all passed")
except Exception:
    print("PASS: Tests passed (could not parse count)")
sys.exit(0)
```
**Confidence:** definitive

### 2. File Existence
**What:** Expected output files from step must exist on disk.
**Why:** Agent says "created homepage.tsx" but file does not exist. Common hallucination.
**Where used:** After every EXECUTE step.
**Tier:** 1+

```python
# check_files_exist.py
import os, sys, json

declared = json.loads(sys.argv[1])  # ["src/pages/index.tsx", "src/styles/home.css"]
missing = [f for f in declared if not os.path.exists(f)]
if missing:
    print(f"FAIL: Missing: {missing}")
    sys.exit(1)
print(f"PASS: All {len(declared)} files exist")
sys.exit(0)
```
**Confidence:** definitive

### 3. File Non-Empty
**What:** File exists but might be empty or stub-only.
**Why:** Agent creates file, writes import, gets interrupted. Exists but useless.
**Where used:** After file existence check.
**Tier:** 2+

```python
# check_files_nonempty.py
import os, sys, json

declared = json.loads(sys.argv[1])
for f in declared:
    size = os.path.getsize(f)
    if size < 50:  # < 50 bytes is suspicious
        print(f"FAIL: {f} is {size} bytes (suspiciously small)")
        sys.exit(1)
print("PASS: All files have content")
sys.exit(0)
```
**Confidence:** heuristic (50-byte threshold is arbitrary; some configs are small)

### 4. Build Artifact Exists
**What:** dist/ directory exists with actual build output (.html, .js, .css).
**Why:** Build "succeeds" but produces nothing (misconfigured output dir).
**Where used:** After build step, before deploy.
**Tier:** 2+

```python
# check_build_artifact.py
import os, sys, glob

if not os.path.isdir("dist"):
    print("FAIL: dist/ does not exist")
    sys.exit(1)
files = [f for f in glob.glob("dist/**/*", recursive=True) if os.path.isfile(f)]
if not files:
    print("FAIL: dist/ is empty")
    sys.exit(1)
has_web = any(f.endswith((".html", ".js", ".css")) for f in files)
if not has_web:
    print(f"WARN: dist/ has {len(files)} files but no .html/.js/.css")
    sys.exit(1)
print(f"PASS: {len(files)} files in dist/")
sys.exit(0)
```
**Confidence:** definitive

### 5. Scope Enforcement
**What:** Worker only modified files declared in its DAG step.
**Why:** Worker told to edit homepage should NOT touch auth module.
**Where used:** After every EXECUTE step.
**Tier:** 2+

```python
# check_scope.py
import subprocess, sys, json

declared = set(json.loads(sys.argv[1]))
auto_gen = {"package-lock.json", "yarn.lock"}
auto_prefixes = [".next/", "node_modules/", "__pycache__/"]

result = subprocess.run(["git", "diff", "--name-only", "HEAD"],
                       capture_output=True, text=True)
modified = set(result.stdout.strip().split("\n")) if result.stdout.strip() else set()

# Filter auto-generated
modified = {f for f in modified
            if f not in auto_gen
            and not any(f.startswith(p) for p in auto_prefixes)}

out_of_scope = modified - declared
if out_of_scope:
    print(f"FAIL: Out of scope: {out_of_scope}")
    sys.exit(1)
print("PASS: All modifications within scope")
sys.exit(0)
```
**Confidence:** definitive

### 6. Token Threshold (Context Warden)
**What:** Agent token usage exceeds per-model kill threshold.
**Why:** Accuracy degrades past ~60% context utilization.
**Where used:** Cron timer, every 30 seconds, all active agents.
**Tier:** 2+ (Tier 0-1 complete before threshold matters)

```python
# check_tokens.py
import sys

THRESHOLDS = {
    "claude-sonnet-4": 0.55, "claude-opus-4": 0.65,
    "gpt-4o": 0.60, "gpt-4o-mini": 0.50,
    "gemini-pro": 0.60, "gemini-flash": 0.50,
}

model = sys.argv[1]
tokens_used = int(sys.argv[2])
context_window = int(sys.argv[3])
task_progress = float(sys.argv[4])

threshold = THRESHOLDS.get(model, 0.55)
utilization = tokens_used / context_window

if utilization > threshold:
    if task_progress > 0.85:
        print(f"WARN: {utilization:.0%} but {task_progress:.0%} done. Allow.")
        sys.exit(0)
    print(f"KILL: {utilization:.0%}, only {task_progress:.0%} done.")
    sys.exit(1)
print(f"OK: {utilization:.0%} of {threshold:.0%}")
sys.exit(0)
```
**Confidence:** definitive (token counts are exact)

### 7. Secret Detection
**What:** Gitleaks scans for API keys, tokens, passwords.
**Why:** One exposed secret = compromised account.
**Where used:** Before ANY deploy step.
**Tier:** 1+

```bash
#!/bin/bash
# check_secrets.sh
gitleaks detect --source . --no-git --exit-code 1 2>&1
if [ $? -ne 0 ]; then
    echo "FAIL: Secrets detected"
    exit 1
fi
echo "PASS: No secrets found"
exit 0
```
**Confidence:** definitive

### 8. Uninstall Verification
**What:** Claimed uninstalled packages are actually gone from disk.
**Why:** Agent says "uninstalled 5" but actually did 3.
**Where used:** After any cleanup/uninstall step.
**Tier:** Any

```python
# check_uninstall.py
import os, sys, json

claimed = json.loads(sys.argv[1])
still_there = [p for p in claimed if os.path.exists(f"node_modules/{p}")]
if still_there:
    print(f"FAIL: Still installed: {still_there}")
    sys.exit(1)
print("PASS: All confirmed removed")
sys.exit(0)
```
**Confidence:** definitive

### 9. Docker Health
**What:** Container builds, starts, responds 200 with real content.
**Why:** Local verification catches 80% of deploy failures.
**Where used:** Before deploy (if Docker available).
**Tier:** 2+

```python
# check_docker_health.py
import subprocess, sys, time

for attempt in range(3):
    try:
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
             "http://localhost:3000"],
            capture_output=True, text=True, timeout=10)
        code = r.stdout.strip()
        if code == "200":
            body = subprocess.run(
                ["curl", "-s", "http://localhost:3000"],
                capture_output=True, text=True, timeout=10)
            if "Cannot GET" in body.stdout or "Error" in body.stdout[:200]:
                print(f"FAIL: 200 but error page (attempt {attempt+1})")
            else:
                print("PASS")
                sys.exit(0)
        else:
            print(f"Attempt {attempt+1}: got {code}")
    except Exception as e:
        print(f"Attempt {attempt+1}: {e}")
    time.sleep(5)
print("FAIL: 3 attempts exhausted")
sys.exit(1)
```
**Confidence:** heuristic (warming, port conflicts)

### 10. Lesson Template Validation
**What:** Worker filled all 4 lesson fields with real content (not placeholders).
**Why:** Workers write "stuff happened" -- useless.
**Where used:** After any step that logged an error.
**Tier:** Any

```python
# check_lesson.py
import re, sys

content = open(sys.argv[1]).read()
fields = ["What broke:", "Root cause:", "Fix applied:", "Prevention rule:"]
placeholders = ["one sentence", "todo", "tbd", "fill in", "placeholder", "xxx"]

for field in fields:
    if field not in content:
        print(f"FAIL: Missing {field}")
        sys.exit(1)
    match = re.search(f"{re.escape(field)}\\s*(.+)", content)
    if match:
        value = match.group(1).strip()
        if len(value) < 10:
            print(f"FAIL: {field} too short")
            sys.exit(1)
        if any(p in value.lower() for p in placeholders):
            print(f"FAIL: {field} has placeholder")
            sys.exit(1)
print("PASS")
sys.exit(0)
```
**Confidence:** definitive

### 11. Responsive Screenshots
**What:** Playwright screenshots at 3 viewports exist and are non-trivial size.
**Why:** Frontend MUST be responsive.
**Where used:** After frontend build, before deploy.
**Tier:** 2+ for frontend tasks

```python
# check_responsive.py
import os, sys, subprocess

viewports = [(375, 812, "mobile"), (768, 1024, "tablet"), (1440, 900, "desktop")]
url = sys.argv[1]
outdir = sys.argv[2]

for w, h, name in viewports:
    out = f"{outdir}/{name}.png"
    subprocess.run(["npx", "playwright", "screenshot",
                    "--viewport-size", f"{w},{h}", url, out],
                   capture_output=True, timeout=30)
    if not os.path.exists(out) or os.path.getsize(out) < 1000:
        print(f"FAIL: {name} screenshot missing or tiny")
        sys.exit(1)
print("PASS: All 3 viewports captured")
sys.exit(0)
```
**Confidence:** definitive

---

## Activation Map

```
STEP COMPLETES --> Bodyguard dispatches in parallel:
  |
  +-- #2 File existence (always)
  +-- #3 File non-empty (Tier 2+)
  +-- #5 Scope enforcement (Tier 2+)
  +-- #1 Test exit code (if code was modified)
  +-- #4 Build artifact (if build step)
  +-- #7 Secret detection (if pre-deploy)
  +-- #9 Docker health (if Docker step)
  +-- #10 Lesson template (if error was logged)
  +-- #11 Responsive (if frontend step)
  |
  v
Results aggregated:
  All pass        --> Gate OPEN --> PA [SOFT] --> next step
  Definitive fail --> Gate CLOSED --> Conductor re-plans
  Heuristic fail  --> User sees [Retry] [Skip] [Stop]

CRON (independent, every 30s):
  #6 Token threshold --> KILL agent if over, respawn
```
