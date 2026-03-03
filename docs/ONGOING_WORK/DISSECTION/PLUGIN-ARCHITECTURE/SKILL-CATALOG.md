# Skill Catalog: All 26 Skills

## Quick Reference

| Category | Count | Skills |
|----------|-------|--------|
| Phases | 5 | discuss, plan, execute, verify, unify |
| Workers | 14 | gsd-executor, gsd-planner, gsd-debugger, gsd-verifier, gsd-researcher, gsd-codebase-mapper, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, doc-updater, web-researcher, worker-deploy, worker-image-gen |
| Verification | 2 | verification-integrity, docker-local-first |
| Frontend | 1 | frontend-design (+ search.py + CSVs) |
| Templates | 3 | lesson-template, archive-template, llms-txt-template |
| Messenger | 1 | pa-comparison |

---

## Phase Skills (5)

### discuss.md
**Path:** `skills/phases/discuss.md`
**Purpose:** Extract implementation decisions through conversation
**Triggers:** `discuss, context, clarify, requirements, gray areas, decisions, user preferences`
**Runtime:** Interactive (requires user)

| Input | Output |
|-------|--------|
| Phase goal, existing context | CONTEXT.md with `<decisions>` section |

**Process:**
1. Read phase goal and any prior decisions
2. Identify gray areas requiring user input
3. Ask clarifying questions (thinking partner, not interviewer)
4. Capture decisions as `locked`, `discretion`, or `deferred`
5. Produce CONTEXT.md

**Key Enforcer Checks:**
- CONTEXT.md exists with `<decisions>` section
- Scope creep redirected to `<deferred>`

---

### plan.md
**Path:** `skills/phases/plan.md`
**Purpose:** Create executable plans from research + context
**Triggers:** `plan, create plans, break down, task breakdown, implementation plan`
**Runtime:** Agent-orchestrated (spawns researcher, planner)

| Input | Output |
|-------|--------|
| CONTEXT.md, ROADMAP.md | PLAN.md files with wave assignments |

**Process:**
1. Spawn researcher if domain unfamiliar
2. Create 2-3 plans per phase with XML task structure
3. Compute wave numbers from dependency graph
4. Define must_haves for verification
5. Run plan-checker for quality verification

**Key Enforcer Checks:**
- Every ROADMAP requirement mapped to a plan
- Each plan has wave, depends_on, files_modified, autonomous frontmatter
- No file appears in parallel plans (exclusive ownership)

---

### execute.md
**Path:** `skills/phases/execute.md`
**Purpose:** Execute plans via wave-based parallel dispatch
**Triggers:** `execute, run, implement, build, do the work, spawn agents`
**Runtime:** Agent-orchestrated (spawns executors)

| Input | Output |
|-------|--------|
| PLAN.md files | SUMMARY.md per plan, commits |

**Process:**
1. Sort plans by wave number
2. Spawn executors for wave 1 in parallel
3. Wait for wave 1 completion
4. Verify via spot-checks
5. Advance to wave 2
6. Repeat until all waves complete
7. Spawn verifier for phase verification

**Key Enforcer Checks:**
- All plans have SUMMARY.md
- All Self-Checks passed
- VERIFICATION.md status is passed or human_needed

---

### verify.md
**Path:** `skills/phases/verify.md`
**Purpose:** Goal-backward verification of phase outcomes
**Triggers:** `verify, check, validate, goal achievement, must-haves, verification`
**Runtime:** Agent (spawned by execute-phase)

| Input | Output |
|-------|--------|
| PLAN.md must_haves, codebase | VERIFICATION.md with status |

**Process:**
1. Establish must-haves (truths, artifacts, key links)
2. Verify each truth with evidence
3. Check artifacts at 3 levels (exists, substantive, wired)
4. Scan for anti-patterns
5. Produce structured report with score
6. Return status: passed | gaps_found | human_needed

**Key Enforcer Checks:**
- Every truth has VERIFIED/FAILED/UNCERTAIN status
- Every artifact checked at 3 levels
- Status is one of: passed, gaps_found, human_needed

---

### unify.md
**Path:** `skills/phases/unify.md`
**Purpose:** Reconcile planned vs actual after execution
**Triggers:** `after APPLY phase complete, loop closure, plan reconciliation`
**Runtime:** Any

| Input | Output |
|-------|--------|
| PLAN.md, actual work done | SUMMARY.md with PLANNED|ACTUAL|DELTA table |

**Process:**
1. Read original plan
2. Document what actually happened
3. Create reconciliation table
4. Document deferred items
5. Update STATE.md with loop closure

**Key Enforcer Checks:**
- SUMMARY.md created
- Reconciliation table shows PLANNED|ACTUAL|DELTA
- STATE.md updated with UNIFY checkmark

---

## Worker Skills (14)

### gsd-executor.md
**Path:** `skills/workers/gsd-executor.md`
**Purpose:** Execute a single plan with atomic commits
**Triggers:** `execute, implement, build, code, create, make, develop`
**Runtime:** Codex

| Input | Output |
|-------|--------|
| PLAN.md, Spine state | SUMMARY.md, commits, modified files |

**Process:**
1. Read plan mandate
2. For each task: implement, commit, self-check
3. Refresh Spine after each task
4. Produce SUMMARY.md with commit hashes
5. Exit with structured completion format

**Key Enforcer Checks:**
- SUMMARY.md exists and > 100 bytes
- SUMMARY.md contains "Self-Check: PASSED"
- Git log shows commits matching `{type}({phase}-{plan}):`

---

### gsd-planner.md
**Path:** `skills/workers/gsd-planner.md`
**Purpose:** Decompose phase goal into executable plans
**Triggers:** `plan, decompose, breakdown, tasks, requirements, design, dependencies`
**Runtime:** Codex

| Input | Output |
|-------|--------|
| Phase goal, CONTEXT.md | PLAN.md with XML task structure |

**Process:**
1. Read phase requirements
2. Decompose into 2-3 tasks per plan
3. Compute wave numbers from depends_on
4. Define must_haves for verification
5. Ensure exclusive file ownership

**Key Enforcer Checks:**
- Every requirement ID mapped
- Wave numbers computed
- `<verify>` contains runnable command

---

### gsd-debugger.md
**Path:** `skills/workers/gsd-debugger.md`
**Purpose:** Scientific method for bug investigation
**Triggers:** `debug, bug, error, fix, investigate, diagnose, troubleshoot, failing, broken, crash`
**Runtime:** Codex

| Input | Output |
|-------|--------|
| Error symptoms | DEBUG.md with root cause + fix |

**Process:**
1. Create DEBUG.md IMMEDIATELY
2. Document symptoms
3. Form hypothesis (specific, falsifiable)
4. Test hypothesis
5. If disproved, eliminate and form new hypothesis
6. When root cause found, apply minimal fix
7. Verify fix against original reproduction

**Key Enforcer Checks:**
- DEBUG.md created immediately
- Symptoms documented before investigating
- Root cause identified with evidence
- Fix verified against reproduction steps

---

### gsd-verifier.md
**Path:** `skills/workers/gsd-verifier.md`
**Purpose:** Verify phase goal achievement (not task completion)
**Triggers:** `verify, check, validate, test, confirm, prove, verification, goal check`
**Runtime:** Codex

| Input | Output |
|-------|--------|
| PLAN.md must_haves | VERIFICATION.md |

**Process:**
1. Extract must-haves from plan
2. Verify truths with evidence
3. Check artifacts (exists, substantive, wired)
4. Check key links (wiring between components)
5. Scan for anti-patterns
6. Calculate score

**Key Enforcer Checks:**
- VERIFICATION.md produced
- Each must-have has PASS/FAIL with evidence
- All artifacts checked at 3 levels

---

### gsd-researcher.md
**Path:** `skills/workers/gsd-researcher.md`
**Purpose:** Evidence gathering with citations
**Triggers:** `research, investigate, find, search, learn, discover, study, explore, docs, documentation`
**Runtime:** Any

| Input | Output |
|-------|--------|
| Research question | RESEARCH.md with sources |

**Process:**
1. Define research question
2. Identify source types (primary > official > news > forums)
3. Gather evidence (Context7, WebSearch, docs)
4. Cite every claim
5. Assign confidence levels
6. Produce structured output

**Key Enforcer Checks:**
- RESEARCH.md exists
- Every claim has source URL
- Confidence levels assigned

---

### gsd-codebase-mapper.md
**Path:** `skills/workers/gsd-codebase-mapper.md`
**Purpose:** Analyze codebase structure, patterns, quality
**Triggers:** `analyze, map, explore, understand, architecture, structure, tech stack, code quality`
**Runtime:** Codex

| Input | Output |
|-------|--------|
| Focus area (tech/arch/quality/concerns) | .planning/codebase/*.md |

**Process:**
1. Parse focus area from prompt
2. Explore relevant files
3. Write findings to documents
4. Follow template structure
5. Include file paths in backticks

**Key Enforcer Checks:**
- Documents written to .planning/codebase/
- Every finding includes file path
- No secrets exposed

---

### tdd-guide.md
**Path:** `skills/workers/tdd-guide.md`
**Purpose:** Test-driven development workflow
**Triggers:** `test, tests, tdd, unit test, coverage, write tests, testing`
**Runtime:** Sonnet

| Input | Output |
|-------|--------|
| Feature requirements | Test file, implementation, coverage report |

**Process:**
1. Write test first (RED)
2. Run test - must fail
3. Implement minimum code (GREEN)
4. Run test - must pass
5. Refactor if needed
6. Check coverage (80% minimum)
7. Test all 8 edge case categories

**Key Enforcer Checks:**
- Exit code 0 from npm test
- Coverage >= 80% for branches, functions, lines, statements
- All 8 edge case categories tested

**Edge Case Checklist:**
1. null inputs
2. undefined inputs
3. empty collections
4. invalid types
5. boundary values
6. error conditions
7. race conditions
8. large inputs

---

### code-reviewer.md
**Path:** `skills/workers/code-reviewer.md`
**Purpose:** Code review with severity-based filtering
**Triggers:** `review, code review, pr review, check code, review changes`
**Runtime:** Sonnet

| Input | Output |
|-------|--------|
| Diff or file list | Review report with severity ratings |

**Process:**
1. Read changes
2. Check naming, error handling, edge cases, performance, security
3. Assign severity: CRITICAL, HIGH, MEDIUM, LOW
4. Filter by confidence (>80% only)
5. Provide actionable fixes

**Key Enforcer Checks:**
- Zero CRITICAL issues = can merge
- Zero CRITICAL + zero HIGH = approve
- Any CRITICAL = must block

---

### security-reviewer.md
**Path:** `skills/workers/security-reviewer.md`
**Purpose:** Security vulnerability scan (OWASP aligned)
**Triggers:** `security, audit, vulnerability, secrets, owasp, injection, xss`
**Runtime:** Sonnet

| Input | Output |
|-------|--------|
| Codebase or diff | Security audit report |

**Process:**
1. Check OWASP Top 10 categories
2. Scan for secrets in code
3. Run npm audit
4. Check authentication patterns
5. Verify input validation

**Key Enforcer Checks:**
- Zero CRITICAL issues
- All HIGH issues have fixes
- No secrets in source code
- npm audit --audit-level=high passes

---

### build-error-resolver.md
**Path:** `skills/workers/build-error-resolver.md`
**Purpose:** Diagnose and fix build failures with minimal changes
**Triggers:** `build error, type error, tsc, typescript error, build failed, compilation error`
**Runtime:** Sonnet

| Input | Output |
|-------|--------|
| Build error output | Fixed code, explanation |

**Process:**
1. Parse error messages
2. Identify root cause
3. Apply minimal fix (< 5% of affected files)
4. Verify build passes
5. Verify tests still pass

**Key Enforcer Checks:**
- `npx tsc --noEmit` exits 0
- `npm run build` exits 0
- No new errors introduced
- Tests still passing

---

### doc-updater.md
**Path:** `skills/workers/doc-updater.md`
**Purpose:** Documentation maintenance and codemap generation
**Triggers:** `docs, documentation, codemap, readme, update docs, generate docs`
**Runtime:** Haiku

| Input | Output |
|-------|--------|
| Changed files | Updated docs/CODEMAPS/*.md |

**Process:**
1. Identify changed files
2. Update relevant codemaps
3. Keep each < 500 lines
4. Verify file paths exist
5. Update timestamps

**Key Enforcer Checks:**
- All codemaps < 500 lines
- Timestamps updated to today
- All file paths verified to exist

---

### web-researcher.md
**Path:** `skills/workers/web-researcher.md`
**Purpose:** Web research with source verification
**Triggers:** `research, search web, find online, lookup, web search, gather evidence`
**Runtime:** Any (routes to ChatGPT for browsing)

| Input | Output |
|-------|--------|
| Research question | Research output with sources |

**Process:**
1. Use WebSearch for broad queries
2. Use WebFetch for specific pages
3. Route browsing tasks to ChatGPT
4. Cite every claim with URL
5. Assign confidence levels
6. Include publication dates

**Key Enforcer Checks:**
- Every claim has source URL
- At least 3 sources consulted
- Sources section includes all URLs
- Search queries documented

---

### worker-deploy.md
**Path:** `skills/workers/worker-deploy.md`
**Purpose:** Build → test → deploy → verify sequence
**Triggers:** `deploy, deployment, ship, release, publish, go live, vercel, gh-pages`
**Runtime:** Sonnet

| Input | Output |
|-------|--------|
| Built project | Deployed URL, verification report |

**Process:**
1. npm run build (HARD: must pass)
2. npm test (HARD: must pass)
3. Secret scan (HARD: no secrets)
4. Docker local verify (HARD if Docker available)
5. Deploy to Vercel
6. Post-deploy health check
7. Smoke tests

**Key Enforcer Checks:**
- Build exits 0
- Tests exit 0
- No secrets in staged code
- Deployment URL returns 200
- SSL certificate valid

---

### worker-image-gen.md
**Path:** `skills/workers/worker-image-gen.md`
**Purpose:** Route image generation to DALL-E via ChatGPT
**Triggers:** `generate image, create image, hero image, logo, product photo, dalle`
**Runtime:** Any (routes to ChatGPT)

| Input | Output |
|-------|--------|
| Image requirements | Local image file |

**Process:**
1. Identify image type (hero, logo, product, background)
2. Craft DALL-E prompt
3. Route to ChatGPT web executor
4. Extract image from DOM
5. Save to local path
6. Verify format and dimensions

**Key Enforcer Checks:**
- Image saved to specified path
- Output format matches requirement
- Prompt documented for reproducibility

---

## Verification Skills (2)

### verification-integrity.md
**Path:** `skills/verification/verification-integrity.md`
**Purpose:** Detect false positives in verification claims
**Triggers:** `test verification, build verification, false positive detection, stub detection`
**Runtime:** Any

| Input | Output |
|-------|--------|
| Test/build output | Integrity report |

**Process:**
1. Analyze test output (not just exit code)
2. Check for 0 tests run
3. Check for all tests skipped
4. Search for stub patterns (TODO, FIXME, return null)
5. Verify wiring between components

**Key Enforcer Checks:**
- Test count > 0
- Build output has no hidden errors
- Stub patterns counted and reported

**Stub Patterns:**
- `TODO`, `FIXME`, `PLACEHOLDER`
- `return null`, `return {}`, `return []`
- `// not implemented`
- Empty function bodies

---

### docker-local-first.md
**Path:** `skills/verification/docker-local-first.md`
**Purpose:** Verify container works locally before remote push
**Triggers:** `docker build, container verification, local testing, pre-push validation`
**Runtime:** Docker required

| Input | Output |
|-------|--------|
| Dockerfile, project | Verification report |

**Process:**
1. Verify Docker daemon running
2. Validate Dockerfile
3. Build image
4. Start container
5. Wait for health endpoint
6. Clean up test container

**Key Enforcer Checks:**
- Docker daemon running
- Build exits 0
- Container runs for 3+ seconds
- Health endpoint returns 200 within 30s

---

## Frontend Design Skill (1 + assets)

### frontend-design/SKILL.md
**Path:** `skills/frontend-design/SKILL.md`
**Purpose:** Design system intelligence for UI generation
**Triggers:** `website, landing page, dashboard, UI, design, frontend, component`
**Runtime:** Any

| Input | Output |
|-------|--------|
| User requirements (or default) | Design parameters for worker |

**Process:**
1. Accept user aesthetic preference (or use Apple-like default)
2. Query BM25 against CSV databases
3. Return matching design system parameters
4. Worker receives: typography, colors, spacing, component patterns

**Default Query:** `"SaaS premium minimal clean apple whitespace"`

**Key Enforcer Checks:**
- No emojis as icons
- Consistent icon set (Heroicons/Lucide)
- Focus states visible
- Responsive at 4 viewports (375, 768, 1024, 1440)

**Anti-AI Aesthetics Checklist:**
- [ ] No Bootstrap 2019 look
- [ ] No generic gradients
- [ ] No stock photo heroes
- [ ] No crowded layouts
- [ ] Whitespace is intentional

---

## Template Skills (3)

### lesson-template.md
**Path:** `skills/templates/lesson-template.md`
**Purpose:** Structured lesson capture with prevention rules
**Triggers:** `lesson, learn, failure, mistake, error, guard, pattern`
**Runtime:** Any

| Input | Output |
|-------|--------|
| Error encountered | lessons.md entry with prevention rule |

**Process:**
1. Fill 8 required fields
2. Write machine-readable prevention rule
3. Add tags for categorization
4. Prevention rule becomes ENFORCER.json entry

**Required Fields:**
1. Date
2. Phase
3. Context
4. Failure
5. Root Cause
6. Guard Added
7. Test Added
8. Reusable Pattern + Tags

---

### archive-template.md
**Path:** `skills/templates/archive-template.md`
**Purpose:** Project handoff document for future sessions
**Triggers:** `archive, complete, finish, close, ship, done`
**Runtime:** Any

| Input | Output |
|-------|--------|
| Completed project | PROJECT-ARCHIVE.md |

**Process:**
1. Summarize what was built
2. Document tech stack
3. List lessons learned
4. Include deployment info
5. Write reopening instructions

---

### llms-txt-template.md
**Path:** `skills/templates/llms-txt-template.md`
**Purpose:** AI-friendly site descriptor
**Triggers:** `llms, llms.txt, ai-friendly, machine-readable`
**Runtime:** Any

| Input | Output |
|-------|--------|
| Completed site | llms.txt + llms-full.txt |

**Process:**
1. Extract site info from intake/archive
2. Template basic llms.txt (< 500 bytes)
3. Generate llms-full.txt with page content
4. Verify no sensitive info included

---

## Messenger Skill (1)

### pa-comparison.md
**Path:** `skills/messenger/pa-comparison.md`
**Purpose:** Semantic glue between execution steps
**Triggers:** `step_transition, phase_boundary, executor_switch, handoff`
**Runtime:** Internal (step scheduler)

| Input | Output |
|-------|--------|
| Previous step output, next step requirements | Handoff JSON |

**Process:**
1. Compress previous output to 2-3 sentences
2. Compare output files against expected inputs
3. Check semantic compatibility
4. Decide: PASS or INTERVENE
5. Produce handoff context

**Output Format:**
```json
{
  "action": "pass" | "intervene",
  "summary": "2-3 sentences",
  "handoff_context": "..." | "intervention": {...}
}
```

**Key Enforcer Checks:**
- Summary is 2-3 sentences
- Action is pass or intervene
- Expected input files exist on disk
