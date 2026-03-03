# ROLE GAP ANALYSIS: Architecture vs What's Built

## The Full Architecture Requires 10 Actors + 22 Worker Types

This document maps every actor and worker the nervous system demands, checks whether Instance 3 produced a skill/prompt for it, and flags what's missing.

---

## PART 1: THE 10 ACTORS

### Actor 1: SPINE AGENT
**What it does:** Filesystem scan. Git status. Test results. Installed tools. Rebuilds truth file every step. No AI.
**Type:** Pure code (~250 lines TypeScript). NOT a skill file.
**Instance 3 produced:** Nothing needed. Spine is code.
**Instance 4 (Hard Rails) produces:** `spine.ts` that writes SPINE.md.
**STATUS: ✅ CORRECT — No skill needed. Code only.**
**BUT MISSING:** SPINE.md output template. What fields does the Spine produce? Instance 4 needs a spec to code against.

```markdown
# SPINE.md Template (what Spine writes after every scan)
## Project
- path: /Users/.../project-name
- name: my-project
- created: 2026-03-03T14:00:00Z

## Files
- total: 47
- by_type: { ts: 12, tsx: 8, css: 5, json: 4, md: 3, other: 15 }
- last_modified: src/components/Hero.tsx (2 min ago)

## Git
- branch: main
- clean: false
- uncommitted: ["src/components/Hero.tsx", "src/styles/global.css"]
- last_commit: "Add hero section" (15 min ago)

## Tests
- runner: vitest
- last_run: 2026-03-03T14:12:00Z
- passed: 12
- failed: 0
- skipped: 0
- coverage: 67%

## Build
- command: npm run build
- last_build: 2026-03-03T14:10:00Z
- success: true
- output_dir: dist/
- output_size: 1.2MB

## Tech Stack
- framework: next.js@14.1.0
- language: typescript
- package_manager: npm
- database: none
- deploy: not_configured

## Dependencies
- production: 12
- dev: 8
- outdated: 2 (react@18.2.0 → 19.0.0, next@14.1.0 → 15.0.0)

## Active Agents
- conductor: session_abc123 (codex, running, 45% tokens)
- executor: session_def456 (codex, running, 30% tokens)
```
**ACTION NEEDED: Add `spine-output-template.md` to `skills/templates/`. Instance 4 codes against this.**

---

### Actor 2: CONDUCTOR
**What it does:** Classifies Tier 0-3. Produces DAG. Re-plans on failure. Persistent session.
**Type:** LLM agent (persistent Codex session) + phase prompts loaded at transitions.
**Instance 3 produced:**
- ✅ `skills/phases/discuss.md` — clarifying questions
- ✅ `skills/phases/plan.md` — task decomposition
- ✅ `skills/phases/execute.md` — worker dispatch
- ✅ `skills/phases/verify.md` — post-execution check
- ✅ `skills/phases/debug.md` — structured debugging
- ✅ `skills/phases/unify.md` — PLANNED vs ACTUAL reconciliation
**MISSING: ❌ The Conductor's OWN system prompt.**

The phase prompts are loaded INTO the Conductor at transitions. But what is the Conductor's base identity? How does it classify Tier 0-3? How does it produce a DAG? When does it re-plan vs proceed? None of the 26 skills define this.

```markdown
# MISSING: conductor-system.md
<!-- triggers: always_active -->
<!-- runtime: codex (persistent session) -->

## You Are
The project orchestrator. You receive a user request and the current Spine state.
You NEVER execute code yourself. You classify, plan, dispatch, and re-plan.

## Your Process
1. Read Spine state (project exists? tech stack? test status?)
2. Classify complexity:
   - Tier 0 (trivial): Single fact question, greeting, image request → FAST PATH (no DAG)
   - Tier 1 (simple): Single file change, typo fix, config update → 1 worker + bodyguard
   - Tier 2 (medium): Multi-file feature, new component, integration → 3-7 step DAG
   - Tier 3 (complex): Full project build, multi-page app, SaaS → 8-15 step DAG with phases
3. Route:
   - New project → GSD mode (discuss > plan > execute > verify)
   - Existing project → PAUL mode (plan > apply > unify, iterative)
4. Produce DAG (JSON):
   ```json
   {
     "tier": 2,
     "mode": "gsd",
     "steps": [
       {
         "id": 1,
         "task": "Create ContactForm component",
         "worker": "gsd-executor",
         "tools": ["read", "write", "bash"],
         "declaredFiles": ["src/components/ContactForm.tsx", "src/components/ContactForm.test.tsx"],
         "dependsOn": [],
         "acceptanceCriteria": ["File exists", "Tests pass", "Component renders"]
       }
     ]
   }
   ```
5. On failure: Re-read Spine. If worker failed, dispatch debugger to same step. If scope drifted, re-plan from current step forward. If 3rd failure on same step, escalate to user.

## Hard Boundaries
- NEVER write code yourself. NEVER. You are the router, not the worker.
- NEVER skip Bodyguard checks between steps.
- NEVER dispatch more than 3 workers in parallel (memory constraint on user machines).
- ALWAYS refresh Spine before AND after every step.

## Output Format
JSON DAG (as above) for each phase transition.
```
**ACTION: Instance 3 must produce `skills/orchestration/conductor-system.md`.**

---

### Actor 3: PA / MESSENGER
**What it does:** Semantic glue between steps. Compresses output. Catches mismatches. Cross-runtime handoff.
**Type:** LLM agent (short-lived, per-handoff).
**Instance 3 produced:** ✅ `skills/messenger/pa-comparison.md` (added during alignment check).
**STATUS: ✅ BUILT.**

---

### Actor 4: SKILL INJECTOR
**What it does:** Reads Spine + next step, matches keywords, loads ONE skill file into worker prompt.
**Type:** Pure code (~50 lines TypeScript). NOT an LLM agent.
**Instance 3 produced:**
- ✅ `specs/trigger-map.json` (142 triggers → 26 skills)
- ✅ `<!-- triggers: -->` metadata in every skill file
**MISSING: ❌ The Skill Injector has no spec for HOW it matches.**

trigger-map.json says skill X has triggers ["a", "b", "c"]. But:
- Is matching exact keyword? Substring? Regex? BM25?
- What if 2 skills match? Highest count wins? First match?
- What if NO skill matches? Load nothing? Load a generic fallback?
- What about the frontend design BM25 search — does that run INSIDE the injector or separately?

```markdown
# MISSING: skill-injector-spec.md (not a skill file — a spec for Instance 4 to code)

## Matching Algorithm
1. Read step mandate from DAG (e.g., "Create ContactForm component with validation")
2. Tokenize: split on spaces, lowercase, remove stopwords
3. For each skill in trigger-map.json:
   - Count matching triggers
   - Score = matches / total_triggers (precision)
4. Best match wins. Tie = first in trigger-map order.
5. Threshold: score must be > 0.2. Below that = no skill loaded.

## Special Case: Frontend
If step mandate matches frontend triggers AND project has no design system:
  - Run BM25 search against CSV data
  - Default query: "SaaS premium minimal clean apple whitespace"
  - Append top 5 BM25 results to skill prompt

## Output
AgentConfig.prompt = baseWorkerPrompt + "\n\n## Skill Pre-Load\n" + matchedSkillContent
```
**ACTION: Add to `specs/` for Instance 4 to implement.**

---

### Actor 5: WORKER AGENTS
**What they do:** Execute mandates. Short-lived. Task-scoped.
**See PART 2 below for full worker gap analysis.**

---

### Actor 6: BODYGUARD
**What it does:** Dispatches micro-checks in parallel. Binary pass/fail. No LLM.
**Type:** Pure code (~200 lines TypeScript). Uses ENFORCER.json.
**Instance 3 produced:**
- ✅ `specs/ENFORCER.json` (~180 binary checks)
- ✅ `skills/verification/verification-integrity.md` (false positive/negative detection)
- ✅ `skills/verification/docker-local-first.md` (local verification)
**STATUS: ✅ BUILT (checks + soft verification prompts). Instance 4 builds the dispatcher code.**

---

### Actor 7: CONTEXT WARDEN
**What it does:** Token counter. Kill at threshold. Respawn at current step.
**Type:** Pure code (~20 lines TypeScript) + cron trigger.
**Instance 3 produced:**
- ✅ Model-specific thresholds in ENFORCER.json (added during alignment)
**STATUS: ✅ SPEC COMPLETE. Instance 4 builds the code.**

---

### Actor 8: CRON LAYER
**What it does:** Timers that spawn checks: context every 60s, regression every 5 steps, stale cleanup.
**Type:** Pure code (setInterval). NOT an LLM agent.
**Instance 3 produced:** Nothing needed. Cron is code.
**STATUS: ✅ CORRECT. Instance 5 (Topology) builds this.**

---

### Actor 9: ARCHIVIST
**What it does:** Runs at project CLOSE. Reads Spine + execution log. Produces PROJECT-ARCHIVE.md + llms.txt.
**Type:** LLM agent (short-lived, runs once).
**Instance 3 produced:**
- ✅ `skills/templates/archive-template.md` — the output template
- ✅ `skills/templates/llms-txt-template.md` — the llms.txt template
- ✅ `skills/templates/lesson-template.md` — structured lesson format
**MISSING: ❌ The Archivist's WORKER PROMPT.**

Templates define the OUTPUT format. But there's no `archivist.md` that tells the Archivist agent HOW to produce that output. What to read, what to summarize, what to skip, how to generate the lesson, when to trigger llms.txt.

```markdown
# MISSING: skills/workers/archivist.md
<!-- triggers: archive, close, complete, finish, done, ship -->
<!-- runtime: any -->

## You Are
The project historian. You run ONCE when a project closes.
You read everything, summarize everything, produce the handoff document that lets
a future agent (or human) understand what was built, why, and what's left.

## Context You Receive
- SPINE.md (current project state)
- Execution log (all steps, all results, all failures)
- lessons.md (accumulated lessons from this project)
- Git log (all commits during this session)

## Your Process
1. Read Spine for final project state
2. Read execution log for the full history
3. Read lessons for what went wrong and what was fixed
4. Produce PROJECT-ARCHIVE.md using archive-template.md format
5. Produce llms.txt using llms-txt-template.md format (if web project)
6. Compile all lessons into final lessons section
7. Record: total time, total tokens, total steps, success rate

## Output Format
- PROJECT-ARCHIVE.md (using template)
- llms.txt (if web project, using template)
- Final lessons.md update

## Hard Boundaries
- NEVER hallucinate features that weren't built. Read the actual files.
- NEVER skip the tech stack section. Future agents need this.
- NEVER produce an archive without the "Known Issues" section.

## Success Looks Like
- [ ] PROJECT-ARCHIVE.md exists and is > 500 bytes
- [ ] All template sections filled (no placeholders remaining)
- [ ] Tech stack matches what's actually in package.json
- [ ] Every lesson has all 4 fields (what broke, root cause, fix, prevention)
- [ ] llms.txt exists if project has HTML output
```
**ACTION: Instance 3 must produce `skills/workers/archivist.md`.**

---

### Actor 10: INTAKE
**What it does:** Captures user requirements. Runs quiz via ChatGPT. Produces structured brief. Routes to execution.
**Type:** LLM agent (ChatGPT web) + code (task classifier).
**Instance 3 produced:** ❌ NOTHING.

Intake is referenced in CONTEXT.md, BOTTLENECKS.md, DOMAIN-A-ORCHESTRATION.md. Instance 1 has the meta-prompt code (`src/intake/meta-prompts.ts`, `task-classifier.ts`, `brief-builder.ts`). But there is NO skill file defining the Intake agent's behavior.

```markdown
# MISSING: skills/orchestration/intake.md
<!-- triggers: always_active_on_first_message -->
<!-- runtime: chatgpt-web -->

## You Are
The project intake specialist. You are the FIRST agent the user interacts with.
You ask 3-5 non-technical questions to understand what they want, then produce
a structured brief that the Conductor consumes.

## Your Process
1. Receive user's raw request (e.g., "build me a candle store")
2. Ask 3-5 clarifying questions in SIMPLE language:
   - Who is this for? (target audience)
   - What already exists? (starting from scratch vs existing project)
   - What's the end goal? (live website, prototype, document, research)
   - Any constraints? (timeline, budget, accounts they already have)
   - Design preference? (modern/minimal, colorful/playful, corporate/serious, no preference)
3. If user says "just build it" or skips → proceed with defaults. NEVER block.
4. Produce structured brief:

## Output Format
```json
{
  "taskType": "build_product | build_content | research | automate | general",
  "projectName": "candle-store",
  "audience": "small business owner selling handmade candles",
  "scope": "full website with product catalog, about page, contact form",
  "startingPoint": "from_scratch | existing_project",
  "designPreference": "minimal | playful | corporate | no_preference",
  "constraints": { "timeline": "none", "accounts": ["github"] },
  "executionHints": {
    "needsDatabase": false,
    "needsAuth": false,
    "needsPayments": false,
    "needsImages": true,
    "pageCount": 4
  }
}
```

## Hard Boundaries
- NEVER ask technical questions (frameworks, databases, hosting, APIs)
- NEVER ask more than 5 questions
- NEVER block the user from proceeding
- ALWAYS provide defaults if user skips
- ALWAYS use language a non-technical person understands

## Success Looks Like
- [ ] Brief is valid JSON
- [ ] taskType is one of the 5 allowed values
- [ ] projectName is a valid directory name (lowercase, hyphens)
- [ ] At least 1 of audience/scope/designPreference is non-default
```
**ACTION: Instance 3 must produce `skills/orchestration/intake.md`.**

---

## PART 2: WORKER AGENTS — FULL GAP ANALYSIS

### BUILT (14 workers confirmed in Instance 3's output)

| # | Worker | Skill File | Source | Purpose |
|---|--------|-----------|--------|---------|
| 1 | Executor | `gsd-executor.md` | GSD | Generic build worker. Write files, run commands. |
| 2 | Planner | `gsd-planner.md` | GSD | Task decomposition. DAG production. |
| 3 | Researcher | `gsd-researcher.md` | GSD | Evidence gathering. Citations. Structured output. |
| 4 | Debugger | `gsd-debugger.md` | GSD | Reproduce > isolate > hypothesize > fix > verify. |
| 5 | Verifier | `gsd-verifier.md` | GSD | Post-execution quality check (soft rail). |
| 6 | Codebase Mapper | `gsd-codebase-mapper.md` | GSD | Repo analysis for existing projects. |
| 7 | TDD Guide | `tdd-guide.md` | ECC | Write test > fail > implement > pass > refactor. |
| 8 | Code Reviewer | `code-reviewer.md` | ECC | Naming, error handling, edge cases, performance. |
| 9 | Security Reviewer | `security-reviewer.md` | ECC | Logic-level security (complements Semgrep). |
| 10 | Build Error Resolver | `build-error-resolver.md` | ECC | Structured build failure diagnosis. |
| 11 | Doc Updater | `doc-updater.md` | ECC | Update docs after code changes. |
| 12 | Deploy Agent | `worker-deploy.md` | Custom | Build > test > deploy > verify. |
| 13 | Image Generator | `worker-image-gen.md` | Custom | Routes to ChatGPT/DALL-E. |
| 14 | Web Researcher | `worker-web-research.md` | Custom | Broader web research, multi-turn. |

### MISSING WORKERS

**15. ❌ Scaffold Worker (`worker-scaffold.md`)**
Referenced in INSTANCE-2-ADAPTERS-v2.md. The agent that creates initial project structure:
- `npm init`, `git init`, folder structure
- Base configs (tsconfig, vite.config, .eslintrc)
- README.md, .gitignore
- Package.json with correct dependencies for detected framework

Why missing matters: The Executor ASSUMES a project exists. Scaffold CREATES the project. Without scaffold, the first Executor spawn has no working directory.

```
Triggers: scaffold, bootstrap, init, new project, start, create project, setup
Tools: write, bash
Runtime: codex
```

**16. ❌ Backend Worker (`worker-backend.md`)**
User specifically asked about this. There is NO backend-specific worker. The generic Executor handles everything, but backend work has unique patterns:
- API route creation (REST or tRPC)
- Database schema and migrations (SQLite default, Supabase upgrade)
- Auth implementation (Supabase Auth or custom JWT)
- Server-side validation
- Environment variable management (.env handling)
- Middleware patterns (CORS, rate limiting, logging)

The Executor is generic. A backend-specific skill narrows its mandate and prevents common LLM failures (exposing secrets, skipping validation, hardcoding URLs).

```
Triggers: api, backend, server, database, auth, route, endpoint, migration, REST, graphql, trpc, middleware
Tools: read, write, bash
Runtime: codex, claude
```

**17. ❌ Frontend Builder (`worker-frontend.md`)**
User asked about "frontend." The design system skill exists (`skill-frontend-design/`) with CSVs and BM25 search. But there's no frontend-specific WORKER prompt that:
- Receives the design tokens from Skill Injector
- Knows component architecture patterns (atomic design, feature-based)
- Handles responsive implementation (mobile-first)
- Manages state (React hooks, context, zustand)
- Integrates with backend APIs (fetch patterns, error handling)
- Applies accessibility basics (semantic HTML, ARIA, focus management)

The Executor + design system skill gets you 70% there. A dedicated frontend worker gets you to 95%.

```
Triggers: frontend, component, page, layout, responsive, CSS, styling, UI, React, Next.js, Tailwind
Tools: read, write, bash
Runtime: codex, claude
```

**18. ❌ Sub-Agent Spawner Pattern (not a separate worker — embedded in executor/planner)**

AGENT-TOPOLOGY-MVP.md defines sub-agent rules:
- 1-2 files: direct execution
- 3-5 files: MAY sub-agent
- 6+ files: SHOULD sub-agent

But this pattern is NOT in gsd-executor.md's "Your Process" or "Hard Boundaries" sections. The executor doesn't know it CAN spawn sub-agents or WHEN it should.

This is not a new skill file. It's a SECTION that must be added to every worker that can sub-agent:

```markdown
## Sub-Agent Permission (add to executor, planner, researcher, debugger, TDD guide, build-error-resolver, frontend builder)

If this task involves MORE THAN 3 files or MORE THAN 2 distinct concerns:
1. Break into sub-tasks (1 file or 1 concern each)
2. For each sub-task, spawn a fresh agent with:
   - Narrowed mandate (only the sub-task)
   - Declared files (only files for this sub-task)
   - Budget = your_budget / number_of_sub_agents
3. Collect results, verify each, merge

If this task involves 1-2 files: DO NOT sub-agent. Execute directly.
```

**ACTION: Add sub-agent section to 7 worker skills that the topology marks as sub-agent-capable.**

**19. ❌ Conductor Intake-to-DAG Bridge**

The Intake produces a structured brief (JSON). The Conductor produces a DAG (JSON). But HOW does the brief become a DAG? This is the Conductor's job, but the phase prompts assume the DAG already exists. The translation step is missing:

```
User brief: { taskType: "build_product", scope: "candle store with 4 pages", needsImages: true }
       ↓
Conductor translates to:
  Step 1: scaffold (worker-scaffold, write+bash)
  Step 2: research competitors (gsd-researcher, web)
  Step 3: generate images (worker-image-gen, chatgpt-web)
  Step 4: build homepage (gsd-executor + frontend skill, write+bash)
  Step 5: build product page (gsd-executor + frontend skill, write+bash)
  Step 6: build about page (gsd-executor, write+bash)
  Step 7: build contact page (gsd-executor + backend skill, write+bash)
  Step 8: add tests (tdd-guide, write+bash)
  Step 9: deploy (worker-deploy, bash)
```

This translation logic belongs in `conductor-system.md` (missing, flagged above).

---

## PART 3: SUMMARY OF ALL GAPS

### New Skill Files Needed (5)

| # | File | Actor/Worker | Why Missing | Priority |
|---|------|-------------|-------------|----------|
| 1 | `skills/orchestration/conductor-system.md` | Conductor | No base identity, no DAG production rules, no tier classification | **CRITICAL** — nothing routes without this |
| 2 | `skills/orchestration/intake.md` | Intake | No user-facing quiz prompt, no brief format spec | **CRITICAL** — first touch with user |
| 3 | `skills/workers/archivist.md` | Archivist | Templates exist but no worker prompt for HOW to archive | HIGH — project memory breaks without this |
| 4 | `skills/workers/worker-scaffold.md` | Scaffold Worker | No project bootstrap agent, executor assumes project exists | HIGH — can't start new projects |
| 5 | `skills/workers/worker-backend.md` | Backend Worker | No backend-specific patterns (API, DB, auth, validation) | HIGH — generic executor misses backend concerns |

### Existing Skills That Need Sections Added (8)

| # | File | What to Add | Why |
|---|------|-------------|-----|
| 1 | `gsd-executor.md` | Sub-agent spawning rules | Executor doesn't know it can break into sub-tasks |
| 2 | `gsd-planner.md` | Sub-agent spawning rules | Planner can spawn per-concern planners |
| 3 | `gsd-researcher.md` | Sub-agent spawning rules | Researcher can spawn per-source agents |
| 4 | `gsd-debugger.md` | Sub-agent spawning rules | Debugger can spawn hypothesis-testing agents |
| 5 | `tdd-guide.md` | Sub-agent spawning rules | TDD can split into test + impl sub-agents |
| 6 | `build-error-resolver.md` | Sub-agent spawning rules | Resolver can spawn targeted fix agents |
| 7 | `worker-web-research.md` | Sub-agent spawning rules | Web research can spawn per-query agents |
| 8 | `worker-frontend.md` (new) | Sub-agent spawning rules | Frontend can spawn per-page agents |

### New Spec Files Needed (2)

| # | File | What It Defines | Consumer |
|---|------|----------------|----------|
| 1 | `specs/spine-output-template.md` | SPINE.md field schema | Instance 4 (codes spine.ts) |
| 2 | `specs/skill-injector-spec.md` | Matching algorithm, thresholds, BM25 integration | Instance 4 (codes match.ts) |

### Updated Counts After Fixes

| Category | Before | After | Delta |
|----------|--------|-------|-------|
| Skill files | 26 | 31 | +5 new |
| Skills with sub-agent rules | 0 | 8 | +8 sections |
| Spec files | 2 (ENFORCER + trigger-map) | 4 | +2 new |
| ENFORCER.json checks | ~180 | ~195 | +15 from new workers |
| trigger-map.json entries | 26/143 | 31/~170 | +5 skills, ~27 triggers |

---

## PART 4: WHAT INSTANCE 3 SHOULD DO NOW

### Immediate (Day 1)
1. Write `conductor-system.md` — this is the MOST critical gap. Without it, nothing routes.
2. Write `intake.md` — second most critical. Without it, no user interaction.
3. Write `archivist.md` — the worker prompt, not just templates.

### Same Day (Day 1 continued)
4. Write `worker-scaffold.md` — needed before any new project can start.
5. Write `worker-backend.md` — needed for any project with an API or database.
6. Write `worker-frontend.md` — the design system skill covers data, but needs a worker prompt.

### Day 2
7. Add sub-agent spawning section to 7 existing workers (copy-paste from topology spec, adapt per-worker).
8. Write `spine-output-template.md` spec (define every field Instance 4 codes against).
9. Write `skill-injector-spec.md` spec (matching algorithm, thresholds).
10. Update ENFORCER.json with checks for 5 new workers.
11. Update trigger-map.json with triggers for 5 new skills.

### Verification
12. Instance V re-runs: now 31 skills, 4 specs, all workers have sub-agent rules where applicable.
