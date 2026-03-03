# ENFORCER.json Guide: Binary Check Reference

## Philosophy

> **Skills = Binary. Plugins = Analog.**

Every "Success Looks Like" criterion in our skills has been converted to a machine-checkable condition in ENFORCER.json. The AI doesn't need to "remember" to run tests. The Bodyguard enforces it.

---

## Schema

```json
{
  "skill-name": [
    {
      "check": "Human-readable description",
      "script": "Shell command or code to run",
      "pass": "JavaScript expression that evaluates to boolean",
      "confidence": "definitive | heuristic",
      "rail": "HARD | SOFT"
    }
  ]
}
```

### Field Definitions

| Field | Purpose | Example |
|-------|---------|---------|
| `check` | What we're verifying | "Tests pass with exit code 0" |
| `script` | Command to run | `npm test 2>&1; echo "EXIT:$?"` |
| `pass` | Boolean condition | `output.includes('EXIT:0')` |
| `confidence` | How reliable is the check? | `definitive` (code) or `heuristic` (inference) |
| `rail` | What happens on failure? | `HARD` (block) or `SOFT` (warn) |

---

## Rail Types

### HARD Rails (Code-Enforced)

**Cannot be overridden.** If the check fails, the work is blocked. Period.

Examples:
- Build must compile (`npm run build` exit code 0)
- No secrets in code (gitleaks returns clean)
- Docker container must start
- Test count > 0 (tests actually ran)

### SOFT Rails (LLM-Mediated)

**Can be overridden with explanation.** User sees [Retry] [Skip] [Stop] buttons.

Examples:
- Code quality heuristics
- Design compliance (subjective)
- Documentation completeness
- Test coverage percentage (80% is guideline, not absolute)

---

## Check Categories

### 1. File Existence Checks

Pattern: Does the expected output exist?

```json
{
  "check": "SUMMARY.md exists and is > 100 bytes",
  "script": "find .planning/phases -name '*-SUMMARY.md' -size +100c | head -1",
  "pass": "output.length > 0",
  "confidence": "definitive",
  "rail": "HARD"
}
```

### 2. Exit Code Checks

Pattern: Did the command succeed?

```json
{
  "check": "npm test exits with code 0",
  "script": "npm test 2>&1; echo \"EXIT:$?\"",
  "pass": "output.includes('EXIT:0')",
  "confidence": "definitive",
  "rail": "HARD"
}
```

### 3. Content Checks

Pattern: Does the file contain required content?

```json
{
  "check": "Every claim has source URL",
  "script": "grep -cE 'https?://' .planning/phases/**/*-RESEARCH.md",
  "pass": "parseInt(output) >= 3",
  "confidence": "definitive",
  "rail": "HARD"
}
```

### 4. Absence Checks

Pattern: Does forbidden content NOT exist?

```json
{
  "check": "No secrets in source code",
  "script": "grep -rE '(sk-[a-zA-Z0-9]{20,}|password\\s*=)' src/ | wc -l",
  "pass": "parseInt(output) === 0",
  "confidence": "definitive",
  "rail": "HARD"
}
```

### 5. Count Checks

Pattern: Is there enough of something?

```json
{
  "check": "Coverage >= 80% for branches",
  "script": "npm run test:coverage 2>&1 | grep -E 'Branches\\s+:\\s+[0-9]+' | awk '{print $3}'",
  "pass": "parseFloat(output) >= 80",
  "confidence": "definitive",
  "rail": "HARD"
}
```

### 6. Timing Checks

Pattern: Did something happen recently?

```json
{
  "check": "STATE.md updated within last 5 minutes",
  "script": "find .planning/STATE.md -mmin -5",
  "pass": "output.includes('STATE.md')",
  "confidence": "definitive",
  "rail": "SOFT"
}
```

### 7. HTTP Checks

Pattern: Is the service responding?

```json
{
  "check": "Deployment URL returns HTTP 200",
  "script": "curl -s -o /dev/null -w '%{http_code}' $DEPLOY_URL",
  "pass": "output === '200'",
  "confidence": "definitive",
  "rail": "HARD"
}
```

---

## Checks by Skill

### gsd-executor (6 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| SUMMARY.md exists > 100 bytes | HARD | definitive |
| Contains "Self-Check: PASSED" | HARD | definitive |
| Git commits match pattern | HARD | definitive |
| STATE.md updated recently | SOFT | definitive |
| No files outside scope | SOFT | heuristic |
| Exit with structured format | SOFT | heuristic |

### gsd-planner (6 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| Every requirement ID mapped | HARD | definitive |
| 2-3 tasks per plan | SOFT | definitive |
| Wave numbers computed | SOFT | heuristic |
| must_haves are observable | SOFT | heuristic |
| `<verify>` has runnable command | HARD | heuristic |
| No file in parallel plans | HARD | definitive |

### gsd-debugger (10 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| DEBUG.md created immediately | HARD | definitive |
| Symptoms documented first | HARD | definitive |
| Hypothesis is specific | SOFT | heuristic |
| Evidence appended | SOFT | heuristic |
| Eliminated hypotheses logged | SOFT | heuristic |
| Root cause identified | HARD | heuristic |
| Fix is minimal | SOFT | heuristic |
| Fix verified against repro | HARD | definitive |
| Can resume after /clear | SOFT | heuristic |
| Human confirms fix | SOFT | heuristic |

### tdd-guide (8 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| npm test exit 0 | HARD | definitive |
| Branch coverage >= 80% | HARD | definitive |
| Function coverage >= 80% | HARD | definitive |
| Line coverage >= 80% | HARD | definitive |
| Statement coverage >= 80% | HARD | definitive |
| 8 edge case categories | SOFT | heuristic |
| Test before implementation | SOFT | heuristic |
| Tests are independent | SOFT | definitive |

### security-reviewer (5 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| Zero CRITICAL issues | HARD | definitive |
| HIGH issues have fixes | HARD | heuristic |
| No secrets in code | HARD | definitive |
| npm audit passes | HARD | definitive |
| OWASP categories checked | SOFT | heuristic |

### worker-deploy (10 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| Build exit 0 | HARD | definitive |
| Tests exit 0 | HARD | definitive |
| No secrets staged | HARD | definitive |
| npm audit passes | HARD | definitive |
| Deploy command succeeds | HARD | definitive |
| URL returns 200 | HARD | definitive |
| Response time < 3s | SOFT | definitive |
| SSL valid | HARD | definitive |
| Smoke tests pass | HARD | definitive |
| Rollback documented | SOFT | heuristic |

### docker-local-first (7 checks)

| Check | Rail | Confidence |
|-------|------|------------|
| Docker daemon running | HARD | definitive |
| Dockerfile valid | HARD | definitive |
| Build exit 0 | HARD | definitive |
| Container runs 3+ seconds | HARD | definitive |
| Health endpoint returns 200 | HARD | definitive |
| Container cleaned up | SOFT | definitive |
| Clear verdict displayed | SOFT | heuristic |

---

## Context Warden Thresholds

Special section in ENFORCER.json for token management:

```json
{
  "context-warden": {
    "thresholds": {
      "claude-sonnet-4": { "window": 200000, "kill_at_percent": 55 },
      "claude-opus-4": { "window": 200000, "kill_at_percent": 65 },
      "gpt-4o": { "window": 128000, "kill_at_percent": 60 },
      "gpt-4o-mini": { "window": 128000, "kill_at_percent": 50 },
      "gemini-pro": { "window": 1000000, "kill_at_percent": 60 },
      "gemini-flash": { "window": 1000000, "kill_at_percent": 50 }
    },
    "grace_period": {
      "condition": "tokenUsage > threshold AND taskProgress > 0.85",
      "action": "let_finish"
    }
  }
}
```

---

## Tiered Enforcement

Not every task needs every check. ENFORCER.json includes tier definitions:

| Tier | Checks Applied |
|------|----------------|
| 0 (Trivial) | None. Fast-path bypass. |
| 1 (Simple) | Bodyguard post-completion only |
| 2 (Medium) | Bodyguard + Scope Enforcer |
| 3 (Complex) | All checks, all gates |

The Conductor assigns tiers. The Bodyguard enforces accordingly.

---

## Adding New Checks

When you add a skill or modify success criteria:

1. **Write the check in natural language** in the skill's "Success Looks Like" section
2. **Convert to ENFORCER.json entry:**
   - `check`: Copy the natural language
   - `script`: Write the shell command
   - `pass`: Write the JavaScript condition
   - `confidence`: Is it code-verifiable? → definitive. Requires inference? → heuristic
   - `rail`: Must never fail? → HARD. Guideline? → SOFT

3. **Test the check manually:**
   ```bash
   # Run the script
   npm test 2>&1; echo "EXIT:$?"

   # Verify the pass condition
   # output.includes('EXIT:0') should be true/false as expected
   ```

4. **Add to appropriate skill section** in ENFORCER.json

---

## Implementation Note

ENFORCER.json defines WHAT to check. Instance 4 (Hard Rails) builds the execution engine that runs these checks. The Bodyguard consumes this file and blocks/warns based on results.

The skill authors (Instance 3) write the criteria. The enforcement engine (Instance 4) runs them. Separation of concerns.

---

## Full Check Count

| Category | HARD | SOFT | Total |
|----------|------|------|-------|
| gsd-planner | 3 | 3 | 6 |
| gsd-executor | 3 | 3 | 6 |
| gsd-debugger | 4 | 6 | 10 |
| gsd-verifier | 3 | 5 | 8 |
| gsd-researcher | 3 | 4 | 7 |
| gsd-codebase-mapper | 2 | 5 | 7 |
| tdd-guide | 5 | 3 | 8 |
| code-reviewer | 2 | 3 | 5 |
| security-reviewer | 4 | 1 | 5 |
| build-error-resolver | 4 | 1 | 5 |
| doc-updater | 2 | 4 | 6 |
| web-researcher | 4 | 4 | 8 |
| worker-deploy | 8 | 2 | 10 |
| worker-image-gen | 2 | 7 | 9 |
| discuss-phase | 1 | 4 | 5 |
| plan-phase | 3 | 3 | 6 |
| execute-phase | 2 | 4 | 6 |
| verify-phase | 4 | 4 | 8 |
| unify-phase | 2 | 5 | 7 |
| verification-integrity | 2 | 5 | 7 |
| docker-local-first | 5 | 2 | 7 |
| frontend-design | 2 | 10 | 12 |
| lesson-template | 4 | 1 | 5 |
| archive-template | 4 | 2 | 6 |
| llms-txt-template | 2 | 3 | 5 |
| pa-comparison | 2 | 3 | 5 |
| context-warden | 3 | 1 | 4 |
| **TOTAL** | **~85** | **~95** | **~180** |
