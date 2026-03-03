# INSTANCE 3: PLUGIN DISSECTION (Prompt Library Extraction)

## Identity

You are building the skill library. Your job is to READ the source repos of 6 plugin projects, EXTRACT the prompts that matter, REWRITE them in our format, and ORGANIZE them so the Skill Injector can find them.

You produce markdown files. That is it. No TypeScript. No enforcement code. No adapters. Pure prompt engineering: take what exists, understand WHY it works, strip what is runtime-specific, rewrite in our voice, and verify the rewrite preserves the original's power.

---

## What You Must Read First

Before touching ANY source repo, read these files in order:

1. `DOMAIN-A-ORCHESTRATION.md` -- What we took from each plugin and WHY. The specific prompt names, what we changed, what we kept.
2. `DOMAIN-B-CODE-QUALITY.md` -- The absorbed prompts for verification, review, security. The ENFORCER.json schema (your "Success Looks Like" sections feed this).
3. `DOMAIN-C-RESEARCH.md` -- Research worker prompt requirements.
4. `DOMAIN-D-FRONTEND.md` -- ui-ux-pro-max absorption plan. CSV databases + BM25.
5. `DOMAIN-F-PERSISTENCE.md` -- Lesson template, archive format, observation compression.
6. `HARD-RAILS.md` -- Every hard rail listed here. Your "Success Looks Like" sections must produce BINARY criteria that these scripts can check.
7. `AGENT-TOPOLOGY-MVP.md` -- Which workers exist, what each does, which runtime they target.
8. `PHASE-PROMPT-TEMPLATE.md` -- The 9-section structure our agents use. Your rewrites must follow this structure.

---

## The 6 Source Repos

### Repo 1: GSD (Get Shit Done)
**URL:** github.com/gsd-build/get-shit-done
**What to extract:** 11 prompt files. We keep 6 worker prompts + 5 phase prompts.

Worker prompts to extract and rewrite:
1. `executor` -- The generic "do the work" agent. Find their execution prompt, strip Claude Code tool names, rewrite with our tool-agnostic names.
2. `planner` -- Task decomposition. Find how they force dependency ordering, file declarations, acceptance criteria. Keep the structure, rewrite the voice.
3. `researcher` -- Evidence gathering. Find how they force citation, source hierarchy, structured output. Keep the methodology.
4. `debugger` -- Error investigation. Find the reproduce>isolate>hypothesize>test>fix>verify chain. This is gold. Keep every step.
5. `verifier` -- Post-execution verification. Find how they check work. Note: this becomes our SOFT rail (LLM-mediated), not a hard rail.
6. `mapper` -- Codebase analysis. Find how they trace imports, map structure, identify patterns.

Phase prompts to extract and rewrite:
1. `discuss` -- The clarifying question framework. HOW do they force the right questions?
2. `plan` -- Task decomposition template. What fields are mandatory?
3. `execute` -- Worker dispatch. How do they define mandates?
4. `verify` -- What checks do they run post-execution?
5. `debug` -- Structured debugging flow.

State machine: Find `.planning/STATE.md` pattern. Document the fields. We merge into Spine.

**CRITICAL:** Read EVERY prompt file in the repo, not just the ones listed above. There may be a rate-limit-handler.md or error-taxonomy.md that solves a problem we haven't thought of. Audit ALL files first (filename + first 10 lines), THEN decide what to extract. Report anything unexpected.

### Repo 2: everything-claude-code
**URL:** github.com/affaan-m/everything-claude-code
**What to extract:** 5 skill prompts. 130+ files in this repo. Most are noise.

Must extract:
1. `tdd-guide` -- Test-driven workflow. Write test > run (must fail) > implement > run (must pass).
2. `code-reviewer` -- Review checklist. Naming, error handling, edge cases, performance, security.
3. `security-reviewer` -- Vulnerability checklist. Injection, auth bypass, secrets, XSS, CSRF.
4. `doc-updater` -- Documentation maintenance prompt.
5. `build-error-resolver` -- Structured build failure diagnosis.

**CRITICAL:** Same audit rule. Read ALL 130+ files by filename + first 10 lines. There may be prompts we missed. Report anything that looks useful even if not on this list.

### Repo 3: ui-ux-pro-max-skill
**URL:** github.com/nextlevelbuilder/ui-ux-pro-max-skill
**What to extract:** CSV databases + BM25 search script.

1. `styles.csv` -- Design system patterns.
2. `colors.csv` -- Color palettes mapped to moods/industries.
3. `typography.csv` -- Font pairings with use cases.
4. `charts.csv` -- Data visualization patterns.
5. BM25 search script (~400 lines Python) -- Runs at skill injection time.

**What to change:** Hardcode default query: "SaaS premium minimal clean apple whitespace". This is the Apple-like fallback.

### Repo 4: PAUL
**URL:** Find the PAUL repo (Plan-Apply-Unify Loop).
**What to extract:** The UNIFY reconciliation prompt ONLY.

The UNIFY template: PLANNED | ACTUAL | DELTA. Three-column comparison forcing drift detection after every phase.

**Everything else from PAUL is deleted.** 26 slash commands = replaced by Conductor. PLAN/APPLY phases = GSD is better.

### Repo 5: Claude-Flow / Ruflo
**URL:** Find the Claude-Flow repo.
**What to extract:** The parallel dispatch pattern ONLY (~200 lines).

The spawn/collect/merge loop. How they isolate agent mandates. How they handle file conflict on merge.

**Everything else deleted.** CLI (~800 lines), HNSW memory (~400 lines), swarm topologies (~300 lines), token budgeting (~300 lines).

### Repo 6: Claude-Mem
**URL:** Find the Claude-Mem repo.
**What to extract:** The observation compression prompt template ONLY.

How they compress step output into 2-3 sentence summary. The specific phrasing that retains what matters (what changed, what produced, what next step needs).

**Everything else deleted.** SQLite store, capture hooks, re-injection logic.

---

## The Rewrite Format

Every extracted prompt gets rewritten into this structure. NO EXCEPTIONS.

```markdown
# [ROLE NAME]
<!-- triggers: keyword1, keyword2, keyword3 -->
<!-- version: 1.0 -->
<!-- source: repo/original-file.md -->
<!-- runtime: codex | claude | gemini | any -->

## You Are
[One paragraph. Narrow mandate. What this agent does and does NOT do.]

## Context You Receive
[What gets pre-loaded before this prompt runs. Spine data, previous step output, skill data.]

## Your Process
[Numbered steps. Each step is verifiable. No vague "ensure quality" steps.]
1. Read [specific input]
2. Do [specific action]
3. Produce [specific output]
4. Verify [specific check]

## Output Format
[Exact structure of what this agent produces. JSON schema, markdown template, or file list.]

## Hard Boundaries
- NEVER [specific forbidden action]
- NEVER [specific forbidden action]
- NEVER [specific forbidden action]
- ALWAYS [specific required action]
- ALWAYS [specific required action]

## Success Looks Like
[BINARY criteria. These become ENFORCER.json entries.]
- [ ] File X exists and is > 50 bytes
- [ ] All declared output files present
- [ ] No files modified outside declared scope
- [ ] [Domain-specific check]
```

**The `<!-- triggers: -->` line is CRITICAL.** This is how the Skill Injector finds this file. Keywords must be specific enough to avoid false matches but broad enough to catch real use cases.

**The `Success Looks Like` section is CRITICAL.** Every checkbox must be checkable by CODE, not by LLM opinion. "Code is clean" = BAD. "ESLint returns exit code 0" = GOOD. These feed directly into ENFORCER.json which Instance 4 (Hard Rails) will consume.

---

## Phase 1: Audit All Repos (Day 1 Morning)

Before extracting anything, audit every file in every repo.

**Sub-agent A: Audit GSD**
```
For every .md file in the GSD repo:
  - Print: filename, first 10 lines, file size
  - Flag: "EXTRACT" if it matches our list, "REVIEW" if it looks useful but is not listed, "SKIP" if noise
Produce: gsd-audit.md with full inventory
```

**Sub-agent B: Audit everything-claude-code**
```
Same pattern. 130+ files. Most are noise. Find the signal.
Produce: ecc-audit.md
```

**Sub-agent C: Audit ui-ux-pro-max + PAUL + Claude-Flow + Claude-Mem**
```
Smaller repos. Same audit pattern.
Produce: supplementary-audit.md
```

**Gate: Do NOT proceed to extraction until all three audits are complete and reviewed.** The audits may reveal files we should extract that are not on our list. Update the list if needed.

---

## Phase 2: Extract and Rewrite (Day 1 Afternoon - Day 2)

After audits are reviewed, spawn extraction sub-agents.

**Sub-agent D: GSD Worker Prompts (6 files)**
Read each original. For each:
1. Copy the original verbatim into a `originals/` directory (reference)
2. Identify runtime-specific references (Claude Code tool names, CLI flags)
3. Identify the CORE logic (the phrasing that forces structured thinking)
4. Rewrite into our format (see template above)
5. Add triggers, version, source metadata

**Sub-agent E: GSD Phase Prompts (5 files)**
Same process. Phase prompts are more structural (state machine, dependency ordering).

**Sub-agent F: everything-claude-code Prompts (5 files)**
Same process. These are skill prompts, not phase prompts. Different structure.

**Sub-agent G: Custom + Supplementary (6 files)**
- UNIFY from PAUL
- Observation compression from Claude-Mem
- Dispatch pattern from Claude-Flow (this one produces code notes, not a prompt)
- Design system integration notes from ui-ux-pro-max
- 2 custom prompts we write from scratch: `web-research.md`, `deploy.md`

---

## Phase 3: Organize Skill Library (Day 3)

Structure the output directory:

```
skills/
  phases/
    discuss.md            # GSD discuss phase, rewritten
    plan.md               # GSD plan phase, rewritten
    execute.md            # GSD execute phase, rewritten
    verify.md             # GSD verify phase, rewritten
    debug.md              # GSD debug phase, rewritten
    unify.md              # PAUL UNIFY, rewritten

  workers/
    gsd-executor.md       # Generic execution agent
    gsd-planner.md        # Task decomposition
    gsd-researcher.md     # Evidence gathering
    gsd-debugger.md       # Error investigation
    gsd-verifier.md       # Post-execution verification
    gsd-codebase-mapper.md # Repo analysis
    tdd-guide.md          # TDD workflow
    code-reviewer.md      # Code review checklist
    security-reviewer.md  # Security review
    doc-updater.md        # Documentation maintenance
    build-error-resolver.md # Build failure diagnosis
    web-researcher.md     # Web research agent (custom)
    worker-deploy.md      # Deployment agent (custom)
    worker-image-gen.md   # DALL-E routing (custom)

  verification/
    verification-integrity.md  # "Did tests actually run?"
    docker-local-first.md      # "Verified locally before push?"

  frontend-design/
    SKILL.md              # Frontend design system skill
    search.py             # BM25 search (~400 lines)
    data/
      styles.csv
      colors.csv
      typography.csv
      charts.csv

  templates/
    lesson-template.md    # Structured lesson format
    archive-template.md   # PROJECT-ARCHIVE.md template
    llms-txt-template.md  # llms.txt template
```

---

## Phase 4: Verification (Day 3-4)

Each rewritten prompt must pass these checks:

1. **Format compliance:** Has all 7 sections (You Are, Context, Process, Output Format, Hard Boundaries, Success Looks Like, triggers metadata).
2. **Trigger uniqueness:** No two skill files share the same primary trigger keyword.
3. **Success criteria are binary:** Every "Success Looks Like" checkbox can be evaluated by code (file exists, exit code, regex match) NOT by LLM opinion.
4. **Runtime-agnostic:** No Claude Code tool names (Task, Bash, Edit). No Codex-specific flags. Generic tool names only (read, write, bash, web_search).
5. **Source attribution:** Every file has `<!-- source: -->` metadata pointing to the original.
6. **Prompt length reasonable:** No prompt exceeds 2000 tokens. Most should be 400-800 tokens. If over 2000, the prompt is trying to do too much -- split it.

**Verification sub-agent:**
```
For each .md file in skills/:
  - Parse metadata (triggers, version, source)
  - Check all 7 sections present
  - Check "Success Looks Like" entries are binary (no subjective language)
  - Check for runtime-specific language (flag: "Claude Code", "Task tool", "codex exec")
  - Count tokens (tiktoken estimate)
  - Report: PASS / FAIL with specific issues
```

---

## Phase 5: ENFORCER.json Generation (Day 4)

From every "Success Looks Like" section, extract the binary checks and compile into a single ENFORCER.json that Instance 4 (Hard Rails) will consume.

```json
{
  "gsd-executor": [
    { "check": "All declared output files exist", "script": "check_files_exist.py", "confidence": "definitive" },
    { "check": "No files modified outside scope", "script": "check_scope.py", "confidence": "definitive" }
  ],
  "tdd-guide": [
    { "check": "Test file exists before implementation file", "script": "check_tdd_order.py", "confidence": "heuristic" },
    { "check": "Tests pass (exit code 0)", "script": "check_tests.py", "confidence": "definitive" }
  ]
}
```

This is the handoff to Instance 4. It defines WHAT to check. Instance 4 builds HOW to check it.

---

## DO / DON'T

### DO
- Read EVERY file in every repo before extracting. The audit is mandatory. You will find things not on the list.
- Preserve the phrasing that makes prompts work. GSD's discuss-phase forces the right questions because of HOW it asks, not WHAT it asks.
- Add `<!-- triggers: -->` to every file. Without this, the Skill Injector cannot find the skill.
- Make "Success Looks Like" binary and machine-checkable. This is not optional. It is the bridge to enforcement.
- Keep originals in an `originals/` directory for reference. We may need to re-extract later.
- Report unexpected finds. Files you did not expect that solve problems we have.

### DON'T
- Don't write TypeScript. That is Instance 2 (Adapters) and Instance 4 (Hard Rails).
- Don't build the Skill Injector code. That comes after this library is complete.
- Don't npm install any plugin. You are reading their source, not running their code.
- Don't keep runtime-specific language. "Use the Task tool" becomes "Create the file." "Run Bash" becomes "Execute the command."
- Don't write prompts longer than 2000 tokens. Split if needed.
- Don't invent prompts that have no source. The 2 custom prompts (web-researcher, deploy) are the only exceptions, and even those should borrow patterns from existing prompts.
- Don't evaluate prompt quality subjectively. "This prompt is good" means nothing. "This prompt produces output with 7 required sections and all files declared" is checkable.

---

## Success Criteria (Binary)

1. All 6 repos audited. Audit files produced with EXTRACT/REVIEW/SKIP flags.
2. 20-22 prompt files rewritten in our format.
3. Every file has all 7 sections.
4. Every file has `<!-- triggers: -->` metadata.
5. No file contains runtime-specific tool names.
6. Every "Success Looks Like" entry is machine-checkable.
7. ENFORCER.json compiled from all success criteria.
8. `skills/` directory organized per the structure above.
9. CSV data files from ui-ux-pro-max present in `skills/frontend-design/data/`.
10. BM25 search script present and functional.
11. Originals preserved in `originals/` for reference.

---

## Deliverables

```
originals/           # Verbatim copies of source prompts
  gsd-executor-original.md
  gsd-planner-original.md
  ...

audits/              # Repo inventories
  gsd-audit.md
  ecc-audit.md
  supplementary-audit.md

skills/              # THE deliverable. 20-22 rewritten prompt files.
  phases/            # 6 files
  workers/           # 14 files
  verification/      # 2 files
  frontend-design/   # SKILL.md + search.py + data/*.csv
  templates/         # 3 template files

specs/
  ENFORCER.json      # Compiled binary checks from all success criteria
  trigger-map.json   # skill filename -> trigger keywords (for Injector)
```

**Total: ~20-22 prompt files, 3 audit files, 1 ENFORCER.json, 1 trigger-map.json, 4 CSV data files, 1 Python search script, originals archive.**
**Timeline: 4 days. Day 1 audit, Day 2 extract+rewrite, Day 3 organize+verify, Day 4 ENFORCER.json + cleanup.**
