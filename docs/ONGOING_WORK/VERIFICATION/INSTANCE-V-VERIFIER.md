# INSTANCE V: CROSS-VERIFICATION AGENT

## Identity

You are the verifier. You trust nothing. Not Instance 2's adapters. Not Instance 3's dissected prompts. Not the ENFORCER.json. Not the trigger-map.json. You verify ALL of it against the actual source repos.

Instance 2 says "Codex adapter handles read-only for gsd-planner." You clone GSD, read gsd-planner, confirm it actually needs read-only, then run the adapter with the REAL prompt and check.

Instance 3 says "we extracted 6 prompts from GSD." You clone GSD, count every meaningful file, confirm nothing was missed, diff the rewrite against the original, and flag what changed.

You are the hard rail for the humans building the hard rails.

---

## What You Must Read First

1. `INSTANCE-2-ADAPTERS-v2.md` -- What Instance 2 claims each plugin needs from adapters.
2. `INSTANCE-3-DISSECTION.md` -- What Instance 3 claims to extract from each repo.
3. `HARD-RAILS.md` -- The enforcement checks. You verify they actually catch what they claim.
4. `AGENT-TOPOLOGY-MVP.md` -- Agent roles and their declared permissions/runtimes.
5. Instance 2's actual code: `adapters/*.ts`, `tests/*.test.ts`, `specs/*.json`
6. Instance 3's actual output: `skills/**/*.md`, `specs/ENFORCER.json`, `specs/trigger-map.json`

---

## TRACK 1: SOURCE REPO VERIFICATION

### Step 1: Clone and Inventory

Clone every source repo. Produce a COMPLETE file inventory. This is the ground truth everything else is checked against.

```bash
# Clone all source repos
mkdir -p /tmp/verification/repos
cd /tmp/verification/repos

git clone https://github.com/gsd-build/get-shit-done.git gsd
git clone https://github.com/affaan-m/everything-claude-code.git ecc
git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git uxpro

# For these, search GitHub first -- exact URLs may differ
# PAUL (Plan-Apply-Unify Loop)
# Claude-Flow / Ruflo
# Claude-Mem
```

### Step 2: Full File Audit

For EVERY .md file in every repo, produce:

```markdown
## [repo-name]/[path/to/file.md]
- Size: [bytes]
- First 15 lines: [content]
- Classification: EXTRACTED | MISSED | CORRECTLY_SKIPPED
- If EXTRACTED: Which Instance 3 file maps to this? Diff summary.
- If MISSED: Should we have extracted this? Why/why not?
- If CORRECTLY_SKIPPED: Why is this noise?
```

**This is the critical deliverable.** Instance 3 claimed to audit all repos but you are verifying the audit. Common failures:
- File renamed between GSD versions (Instance 3 may have looked for old name)
- New files added after our initial research (repos update)
- Files with misleading names ("utils.md" that is actually a critical error taxonomy)

### Step 3: Extraction Accuracy Check

For each prompt Instance 3 claims to have extracted, diff against the original:

```bash
# For each skill file Instance 3 produced:
diff <(head -50 /path/to/instance3/skills/workers/gsd-executor.md)      <(head -50 /tmp/verification/repos/gsd/[original-path].md)
```

Verify:
1. **Core logic preserved.** The phrasing that makes the prompt work must survive the rewrite. If GSD's debugger says "reproduce the exact error BEFORE hypothesizing" and our rewrite says "investigate the error," we lost the enforcement.
2. **Runtime-specific references removed.** No "Task tool", no "Bash tool", no "claude --agent". Generic tool names only.
3. **Our format applied.** All 7 sections present (You Are, Context, Process, Output Format, Hard Boundaries, Success Looks Like, triggers).
4. **Success criteria are binary.** Every "Success Looks Like" checkbox is checkable by code. Not "code is clean" but "ESLint exit code 0."
5. **Triggers make sense.** The `<!-- triggers: -->` keywords actually match what this prompt does. No false matches with other skills.

Produce a report per file:

```markdown
## Verification: gsd-executor.md

### Source: gsd/agents/executor.md (487 lines)
### Rewrite: skills/workers/gsd-executor.md (62 lines)

### Core Logic Preserved: YES/NO
- [list specific phrases/structures that were kept or lost]

### Runtime References Removed: YES/NO
- [list any remaining runtime-specific language]

### Format Compliance: YES/NO
- [x] You Are section
- [x] Context You Receive
- [x] Your Process (numbered, verifiable)
- [x] Output Format
- [x] Hard Boundaries
- [x] Success Looks Like (binary)
- [x] Triggers metadata

### Success Criteria Audit:
- "All declared output files exist" -- BINARY, checkable by fs.existsSync ✅
- "No files modified outside scope" -- BINARY, checkable by git diff ✅
- "Code is well-structured" -- SUBJECTIVE, NOT checkable by code ❌ FIX THIS

### Trigger Audit:
- Triggers: "execute, build, create, implement, code, write"
- Conflicts with: tdd-guide.md (also triggered by "write code")
- Recommendation: Add "scaffold" to executor, remove "write code" (too generic)

### VERDICT: PASS / FAIL / PASS WITH ISSUES
```

---

## TRACK 2: ADAPTER-TO-PLUGIN VERIFICATION

Instance 2 claims each plugin has specific adapter requirements. You verify by reading the ACTUAL plugin source and testing the ACTUAL adapter.

### Step 1: Permission Verification

For each plugin, read the original source and confirm the tool permissions Instance 2 declared are correct:

```markdown
## gsd-planner.md

### Instance 2 claims: tools = ["read"] (read-only)
### Verification method: Read original GSD planner prompt

Original prompt says: "Read the codebase structure. Analyze dependencies. DO NOT modify any files."
--> CONFIRMED: Read-only is correct.

BUT ALSO: Original prompt says "Run `find . -name '*.ts'` to discover files"
--> This requires BASH, not just READ.
--> Instance 2 WRONG: tools should be ["read", "bash"], not ["read"]
--> Sandbox should be "workspace-write" for bash access, not "read-only"
--> FLAG: Adapter test for planner uses wrong sandbox mode
```

### Step 2: Payload Size Verification

Instance 2 claims frontend-builder needs 3000+ tokens. Verify:

```bash
# Measure actual payload
SKILL_TOKENS=$(wc -w < skills/frontend-design/SKILL.md)
CSV_SAMPLE=$(head -50 skills/frontend-design/data/styles.csv | wc -w)
EXECUTOR_TOKENS=$(wc -w < skills/workers/gsd-executor.md)

echo "Skill: ~${SKILL_TOKENS} words (~$((SKILL_TOKENS * 4/3)) tokens)"
echo "CSV sample: ~${CSV_SAMPLE} words (~$((CSV_SAMPLE * 4/3)) tokens)"
echo "Executor: ~${EXECUTOR_TOKENS} words (~$((EXECUTOR_TOKENS * 4/3)) tokens)"
echo "Total: ~$(( (SKILL_TOKENS + CSV_SAMPLE + EXECUTOR_TOKENS) * 4/3 )) tokens"
```

If total < 2000 tokens, Instance 2's stdin-pipe requirement is overengineered.
If total > 4000 tokens, Instance 2 underestimated and needs chunking strategy.

### Step 3: Live Adapter Test With Real Prompts

This is the ultimate test. Take Instance 3's actual rewritten prompts, feed them through Instance 2's actual adapters, verify the results.

```typescript
// verification/live-adapter-test.ts

import { CodexAdapter } from '../adapters/codex-adapter';
import { AgentConfig } from '../adapters/types';
import * as fs from 'fs';

async function verifyPluginThroughAdapter() {
  const adapter = new CodexAdapter();

  // Test 1: gsd-planner (read-only enforcement)
  const plannerPrompt = fs.readFileSync('skills/workers/gsd-planner.md', 'utf-8');
  const plannerConfig: AgentConfig = {
    id: crypto.randomUUID(),
    name: 'gsd-planner',
    role: 'Decompose task into steps',
    model: 'gpt-5-codex',
    tools: ['read', 'bash'],  // What the plugin ACTUALLY needs
    maxTokens: 4096,
    prompt: plannerPrompt + '\n\nTask: Add a contact form to an existing Next.js site.',
    declaredFiles: [],  // Planner declares no files (read-only)
    workingDir: '/tmp/verification/test-project',
    timeout: 60000,
    target: 'codex',
    sessionMode: 'fresh',
  };

  const handle = await adapter.spawn(plannerConfig);
  const result = await handle.onComplete();

  // Verify: output is valid JSON DAG
  try {
    const dag = JSON.parse(result.output);
    assert(Array.isArray(dag.steps), 'DAG must have steps array');
    assert(dag.steps.length >= 2, 'Must decompose into 2+ steps');
    for (const step of dag.steps) {
      assert(step.declaredFiles, 'Each step must declare files');
      assert(step.acceptanceCriteria, 'Each step must have criteria');
    }
    console.log('PLANNER: PASS - Valid DAG with', dag.steps.length, 'steps');
  } catch (e) {
    console.log('PLANNER: FAIL - Output not valid DAG:', e.message);
    console.log('Raw output (first 500 chars):', result.output.slice(0, 500));
  }

  // Verify: planner did NOT create/modify any files
  const gitStatus = execSync('git status --porcelain', {
    cwd: '/tmp/verification/test-project'
  }).toString();
  if (gitStatus.trim()) {
    console.log('PLANNER: FAIL - Modified files (should be read-only):', gitStatus);
  } else {
    console.log('PLANNER: PASS - No files modified (read-only enforced)');
  }

  // Test 2: gsd-executor (write enforcement + file declaration)
  const executorPrompt = fs.readFileSync('skills/workers/gsd-executor.md', 'utf-8');
  const executorConfig: AgentConfig = {
    id: crypto.randomUUID(),
    name: 'gsd-executor',
    role: 'Create the contact form component',
    model: 'gpt-5-codex',
    tools: ['read', 'write', 'bash'],
    maxTokens: 4096,
    prompt: executorPrompt + '\n\nTask: Create src/components/ContactForm.tsx with name, email, message fields.',
    declaredFiles: ['src/components/ContactForm.tsx'],
    workingDir: '/tmp/verification/test-project',
    timeout: 120000,
    target: 'codex',
    sessionMode: 'fresh',
  };

  const execHandle = await adapter.spawn(executorConfig);
  const execResult = await execHandle.onComplete();

  // Verify: declared file exists
  const fileExists = fs.existsSync('/tmp/verification/test-project/src/components/ContactForm.tsx');
  console.log('EXECUTOR:', fileExists ? 'PASS - File created' : 'FAIL - File not created');

  // Verify: file is non-trivial
  if (fileExists) {
    const size = fs.statSync('/tmp/verification/test-project/src/components/ContactForm.tsx').size;
    console.log('EXECUTOR:', size > 100 ? `PASS - ${size} bytes` : `FAIL - Only ${size} bytes (stub)`);
  }

  // Test 3: code-reviewer (strict read-only)
  const reviewerPrompt = fs.readFileSync('skills/workers/code-reviewer.md', 'utf-8');
  const reviewerConfig: AgentConfig = {
    id: crypto.randomUUID(),
    name: 'code-reviewer',
    role: 'Review the contact form',
    model: 'gpt-5-codex',
    tools: ['read'],  // STRICTLY read-only
    maxTokens: 4096,
    prompt: reviewerPrompt + '\n\nReview: src/components/ContactForm.tsx',
    declaredFiles: [],
    workingDir: '/tmp/verification/test-project',
    timeout: 60000,
    target: 'codex',
    sessionMode: 'fresh',
  };

  // Git snapshot before review
  execSync('git add -A && git commit -m "pre-review snapshot" --allow-empty', {
    cwd: '/tmp/verification/test-project'
  });

  const reviewHandle = await adapter.spawn(reviewerConfig);
  const reviewResult = await reviewHandle.onComplete();

  // Verify: reviewer produced structured output
  const hasFindings = reviewResult.output.includes('BLOCK') ||
                      reviewResult.output.includes('WARN') ||
                      reviewResult.output.includes('INFO');
  console.log('REVIEWER:', hasFindings ? 'PASS - Structured findings' : 'FAIL - No structured output');

  // Verify: reviewer modified NOTHING
  const postReviewStatus = execSync('git status --porcelain', {
    cwd: '/tmp/verification/test-project'
  }).toString();
  console.log('REVIEWER:', postReviewStatus.trim() === '' ?
    'PASS - Zero files modified (read-only enforced)' :
    'FAIL - Files modified during review: ' + postReviewStatus);
}
```

---

## TRACK 3: ENFORCER.JSON VERIFICATION

Instance 3 produced ENFORCER.json with binary checks per skill. Verify each check actually works.

### Step 1: Schema Validation

```bash
# Every entry must have: name, checks[], and each check must have:
# script, confidence, rail
python3 -c "
import json, sys
data = json.load(open('specs/ENFORCER.json'))
errors = []
for skill, checks in data.items():
    if not isinstance(checks, list):
        errors.append(f'{skill}: checks must be array')
        continue
    for check in checks:
        for field in ['check', 'confidence', 'rail']:
            if field not in check:
                errors.append(f'{skill}: missing {field}')
        if check.get('confidence') not in ['definitive', 'heuristic']:
            errors.append(f'{skill}: invalid confidence: {check.get("confidence")}')
        if check.get('rail') not in ['HARD', 'SOFT']:
            errors.append(f'{skill}: invalid rail: {check.get("rail")}')
if errors:
    print(f'FAIL: {len(errors)} errors')
    for e in errors[:10]:
        print(f'  - {e}')
    sys.exit(1)
print(f'PASS: {len(data)} skills, all valid')
"
```

### Step 2: Check Executability

For each HARD rail check in ENFORCER.json, verify the script actually exists and runs:

```bash
# For each check that references a script:
for script in $(jq -r '.[].[] | select(.rail=="HARD") | .script' specs/ENFORCER.json); do
    if [ ! -f "checks/$script" ]; then
        echo "FAIL: Script missing: $script"
    else
        # Dry run with dummy args to verify it at least parses
        python3 -c "compile(open('checks/$script').read(), '$script', 'exec')" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "PASS: $script compiles"
        else
            echo "FAIL: $script has syntax errors"
        fi
    fi
done
```

### Step 3: False Positive Simulation

For the most critical checks, deliberately create conditions that should trigger false positives and verify the secondary check catches them:

```bash
# Test: empty test suite (0 tests pass = false positive)
mkdir -p /tmp/false-positive-test
cd /tmp/false-positive-test
npm init -y
npm install vitest
echo "// empty test file" > test.test.js
npx vitest run  # Should "pass" with 0 tests

# Run our check script -- it should FAIL (secondary catches empty suite)
python3 checks/check_tests.py
# Expected: FAIL: 0 tests ran (empty suite)
```

```bash
# Test: dist/ exists but only has sourcemaps (false positive for build check)
mkdir -p /tmp/false-positive-build/dist
echo "//# sourceMappingURL=app.js.map" > /tmp/false-positive-build/dist/app.js.map

cd /tmp/false-positive-build
python3 checks/check_build_artifact.py
# Expected: FAIL or WARN (no .html or .js files, only .map)
```

---

## TRACK 4: TRIGGER MAP VERIFICATION

Instance 3 produced trigger-map.json mapping skills to keywords. Verify no conflicts, no gaps.

```python
# verify_triggers.py
import json

triggers = json.load(open('specs/trigger-map.json'))

# Check 1: No duplicate primary triggers
all_triggers = {}
conflicts = []
for skill, data in triggers.items():
    for trigger in data.get('triggers', []):
        if trigger in all_triggers:
            conflicts.append(f'"{trigger}" claimed by both {all_triggers[trigger]} and {skill}')
        all_triggers[trigger] = skill

if conflicts:
    print(f'FAIL: {len(conflicts)} trigger conflicts:')
    for c in conflicts[:10]:
        print(f'  - {c}')
else:
    print(f'PASS: {len(all_triggers)} unique triggers across {len(triggers)} skills')

# Check 2: Common task descriptions should match expected skills
test_cases = [
    ("build a landing page with hero section", "gsd-executor"),
    ("review this code for security issues", "security-reviewer"),
    ("write tests before implementation", "tdd-guide"),
    ("research competitor pricing", "gsd-researcher"),
    ("fix the build error", "build-error-resolver"),
    ("deploy to vercel", "worker-deploy"),
    ("create an image for the hero banner", "worker-image-gen"),
]

for description, expected_skill in test_cases:
    # Simple keyword matching (same as Skill Injector will do)
    best_match = None
    best_score = 0
    for skill, data in triggers.items():
        score = sum(1 for t in data.get('triggers', []) if t.lower() in description.lower())
        if score > best_score:
            best_score = score
            best_match = skill

    if best_match == expected_skill:
        print(f'PASS: "{description[:40]}..." -> {best_match}')
    else:
        print(f'FAIL: "{description[:40]}..." -> {best_match} (expected {expected_skill})')
```

---

## TRACK 5: CROSS-INSTANCE CONSISTENCY

The final verification: do Instance 2 and Instance 3 agree?

```markdown
## Check: plugin-adapter-map.json vs trigger-map.json

For every skill in trigger-map.json:
  - Does plugin-adapter-map.json have a matching entry?
  - Do the declared tools match?
  - Does the target runtime make sense?

For every plugin in plugin-adapter-map.json:
  - Does a corresponding skill .md file exist?
  - Does the skill's "Success Looks Like" match ENFORCER.json entries?
```

```markdown
## Check: AgentConfig.tools vs actual prompt content

For each skill file:
  - Read the "Hard Boundaries" section
  - If it says "NEVER write files" -> tools must NOT include "write"
  - If it says "NEVER run commands" -> tools must NOT include "bash"
  - Cross-reference against plugin-adapter-map.json declared tools
```

```markdown
## Check: Sandbox mode correctness (Codex-specific)

Instance 2 discovered Codex uses sandbox model, not --allowed-tools.
Verify the sandbox mapping is correct for every plugin:

| Plugin | Declared Tools | Expected Sandbox | Adapter Uses |
|--------|---------------|-----------------|-------------|
| gsd-planner | ["read"] | read-only | ? |
| gsd-executor | ["read","write","bash"] | workspace-write --full-auto | ? |
| code-reviewer | ["read"] | read-only | ? |
| worker-deploy | ["read","write","bash"] | workspace-write --full-auto | ? |

Any mismatch = adapter bug.
```

---

## HOW TO SET UP THIS CLAUDE CODE INSTANCE

### CLAUDE.md for the Verifier

```markdown
# CLAUDE.md -- Verification Agent

## Role
You are the cross-verification agent. You verify Instance 2 (adapters) and Instance 3 (dissection) against actual source repos and against each other.

## Rules
1. Clone every source repo yourself. Do not trust any cached copies.
2. Read every file yourself. Do not trust summaries or claims.
3. Run every test yourself. Do not trust reported results.
4. Produce evidence for every claim (file paths, diff output, exit codes).
5. Flag discrepancies with: WHICH instance, WHAT the claim was, WHAT reality is, HOW to fix.

## Working Directory
/tmp/verification/

## Process
1. Clone repos -> TRACK 1 (source audit)
2. Read Instance 3 output -> TRACK 1 (extraction accuracy)
3. Read Instance 2 code -> TRACK 2 (adapter-to-plugin verification)
4. Read ENFORCER.json -> TRACK 3 (check executability)
5. Read trigger-map.json -> TRACK 4 (conflict detection)
6. Cross-reference -> TRACK 5 (consistency)

## Output
/tmp/verification/VERIFICATION-REPORT.md -- Full report with per-file verdicts
/tmp/verification/FIXES-NEEDED.md -- Specific fixes for Instance 2 and 3
/tmp/verification/DISCOVERED.md -- Anything found in repos that nobody expected
```

### Skills Directory

```
.claude/skills/
  verification-integrity/SKILL.md   -- False positive/negative detection
  source-audit/SKILL.md             -- File inventory methodology
```

### Slash Commands

```
.claude/commands/
  verify-extraction.md    -- Run TRACK 1 on a specific skill file
  verify-adapter.md       -- Run TRACK 2 on a specific adapter
  verify-enforcer.md      -- Run TRACK 3 on ENFORCER.json
  full-verification.md    -- Run all 5 tracks
```

---

## DO / DON'T

### DO
- Clone repos fresh every verification run. Repos update.
- Diff character by character for critical prompts. "Reproduce before hypothesizing" vs "investigate the error" is a meaningful loss.
- Test adapters with REAL prompts from Instance 3, not synthetic ones.
- Check that Codex sandbox modes actually prevent writes when they should.
- Report false positives in ENFORCER.json checks. An enforcement check that passes when it should fail is worse than no check.
- Run trigger matching against 20+ real task descriptions to catch false matches.

### DON'T
- Don't trust Instance 3's audits. Re-audit yourself.
- Don't trust Instance 2's test results. Re-run yourself.
- Don't skip repos that are hard to find (PAUL, Claude-Flow, Claude-Mem). If Instance 3 claims to have extracted from them, you must verify.
- Don't modify Instance 2 or Instance 3's code. Report fixes needed, don't apply them. You are a verifier, not a fixer.
- Don't verify in the same directory where Instance 2/3 work. Use /tmp/verification/ to avoid cross-contamination.

---

## Success Criteria (Binary)

1. All 6 source repos cloned and inventoried.
2. Every Instance 3 skill file has a verification report (PASS/FAIL/ISSUES).
3. Every Instance 2 adapter has been tested with at least 2 real prompts from Instance 3.
4. ENFORCER.json schema validated. All scripts compile. 3+ false positive scenarios tested.
5. trigger-map.json has zero unresolved conflicts.
6. Cross-instance consistency check: plugin-adapter-map.json matches trigger-map.json for all shared entries.
7. VERIFICATION-REPORT.md produced with evidence for every claim.
8. FIXES-NEEDED.md produced with specific, actionable fixes.
9. DISCOVERED.md produced with any unexpected findings from source repos.

---

## Deliverables

```
/tmp/verification/
  repos/                      # Cloned source repos
    gsd/
    ecc/
    uxpro/
    paul/
    claude-flow/
    claude-mem/
  reports/
    VERIFICATION-REPORT.md    # Full report, per-file verdicts
    FIXES-NEEDED.md           # Specific fixes for I2 and I3
    DISCOVERED.md             # Unexpected findings
    source-audit/
      gsd-audit.md            # Every file in GSD classified
      ecc-audit.md            # Every file in ecc classified
      supplementary-audit.md  # Remaining repos
    extraction-diffs/
      gsd-executor-diff.md    # Original vs rewrite comparison
      gsd-planner-diff.md
      ...
    adapter-tests/
      codex-live-results.md   # Real prompt adapter test results
      claude-live-results.md
    enforcer-tests/
      false-positive-results.md
      schema-validation.md
    trigger-tests/
      conflict-report.md
      matching-accuracy.md
    consistency/
      i2-vs-i3-crosscheck.md
```

**Timeline: 2-3 days. Can start as soon as Instance 2 has Codex adapter working and Instance 3 has first batch of skills.**
