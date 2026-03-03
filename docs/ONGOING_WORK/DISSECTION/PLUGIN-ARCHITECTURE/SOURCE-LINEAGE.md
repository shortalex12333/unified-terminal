# Source Lineage: What We Took and Why

## Summary Table

| Source Repo | Files Audited | Extracted | Deleted | Key Contribution |
|-------------|---------------|-----------|---------|------------------|
| GSD | 122 | 12 | 110 | Phase system, worker prompts, state machine |
| everything-claude-code | 998 | 5 | 993 | TDD, code review, security review |
| ui-ux-pro-max | ~20 | 6 | 14 | Design system CSVs, BM25 search |
| PAUL | ~30 | 1 | 29 | UNIFY reconciliation only |
| Claude-Flow/Ruflo | ~15 | 1 | 14 | Parallel dispatch pattern only |
| Claude-Mem | ~10 | 1 | 9 | Observation compression prompt only |

**Total: ~1,195 files audited → 26 skills extracted → 1,169 files deleted**

---

## Repo 1: GSD (Get Shit Done)

**URL:** github.com/gsd-build/get-shit-done
**Audited:** 122 files
**Extracted:** 12 (6 workers + 4 phases + 2 supplementary)

### What We Took

| Original File | Our File | What It Does | Why We Kept It |
|---------------|----------|--------------|----------------|
| `gsd-executor.md` | `workers/gsd-executor.md` | Plan execution with atomic commits | Gold standard for "do the work" agent |
| `gsd-planner.md` | `workers/gsd-planner.md` | Task decomposition with wave ordering | Forces dependency graph, file declarations |
| `gsd-debugger.md` | `workers/gsd-debugger.md` | Scientific debugging method | reproduce→isolate→hypothesize→test→fix→verify chain |
| `gsd-verifier.md` | `workers/gsd-verifier.md` | Goal-backward verification | Checks outcomes not task completion |
| `gsd-codebase-mapper.md` | `workers/gsd-codebase-mapper.md` | Repo structure analysis | Maps tech, arch, quality, concerns |
| `gsd-phase-researcher.md` | `workers/gsd-researcher.md` | Evidence gathering | Source hierarchy, citation enforcement |
| `gsd-discuss-phase.md` | `phases/discuss.md` | Requirements extraction | "Thinking partner" questioning method |
| `gsd-plan-phase.md` | `phases/plan.md` | Plan creation orchestrator | Research → plan → verify loop |
| `gsd-execute-phase.md` | `phases/execute.md` | Wave-based parallel execution | Spawns executors per wave |
| `gsd-verify-phase.md` | `phases/verify.md` | Phase verification | Must-haves, artifacts, wiring checks |
| `gsd-verification-patterns.md` | `verification/verification-integrity.md` | Stub detection patterns | Catches false positives in tests |
| `gsd-state-template.md` | (merged into Spine) | State tracking | Fields merged into Spine format |

### What We Changed

1. **Stripped Claude Code tool names** — "Task tool" → "spawn agent", "Bash" → "execute command"
2. **Added binary success criteria** — Every vague "ensure quality" became a checkable condition
3. **Unified state format** — STATE.md pattern merged into Spine agent's truth file
4. **Added trigger metadata** — `<!-- triggers: -->` for Skill Injector

### What We Deleted (110 files)

- Configuration files, CLI scripts, package.json
- Test files, examples, documentation
- Rate limit handlers (we have our own)
- Session management (we use Conductor)
- 90+ files that were infrastructure, not prompts

### Key Insight Preserved

> **Goal-backward verification:** Don't ask "did you complete the tasks?" Ask "does the codebase deliver what was promised?"

---

## Repo 2: everything-claude-code

**URL:** github.com/affaan-m/everything-claude-code
**Audited:** 998 files
**Extracted:** 5

### What We Took

| Original File | Our File | What It Does | Why We Kept It |
|---------------|----------|--------------|----------------|
| `tdd-guide.md` | `workers/tdd-guide.md` | Test-driven development workflow | Red-Green-Refactor with 80% coverage |
| `code-reviewer.md` | `workers/code-reviewer.md` | Code review checklist | Severity-based filtering (CRITICAL blocks) |
| `security-reviewer.md` | `workers/security-reviewer.md` | Security vulnerability scan | OWASP Top 10 coverage |
| `build-error-resolver.md` | `workers/build-error-resolver.md` | Build failure diagnosis | Minimal-diff philosophy |
| `doc-updater.md` | `workers/doc-updater.md` | Documentation maintenance | Codemap generation, token efficiency |

### What We Changed

1. **Extracted edge case checklist from TDD** — 8 categories: null, undefined, empty, invalid, boundary, error, race, large
2. **Added confidence-based filtering** — Only surface issues with >80% confidence
3. **Made security checks OWASP-aligned** — Mapped to standard vulnerability taxonomy
4. **Added binary pass conditions** — "npm test exit code 0" instead of "tests should pass"

### What We Deleted (993 files)

- 112 agent configuration files (we have our own format)
- Hook scripts (CARL pattern absorbed into our architecture)
- Examples, tutorials, community contributions
- Framework-specific variations (React, Vue, etc.)

### Key Insight Preserved

> **Confidence-based filtering:** Don't dump every possible issue on the user. Filter by confidence. Only CRITICAL and HIGH issues block. Low-confidence findings are logged but don't interrupt.

---

## Repo 3: ui-ux-pro-max-skill

**URL:** github.com/nextlevelbuilder/ui-ux-pro-max-skill
**Audited:** ~20 files
**Extracted:** 6

### What We Took

| Original File | Our File | What It Does | Why We Kept It |
|---------------|----------|--------------|----------------|
| `SKILL.md` | `frontend-design/SKILL.md` | Design system skill | Design intelligence for workers |
| `search.py` | `frontend-design/search.py` | BM25 search (~400 lines) | Finds matching design parameters |
| `styles.csv` | `frontend-design/data/styles.csv` | Design patterns | 50+ patterns with parameters |
| `colors.csv` | `frontend-design/data/colors.csv` | Color palettes | Mood/industry mappings |
| `typography.csv` | `frontend-design/data/typography.csv` | Font pairings | Use case recommendations |
| `charts.csv` | `frontend-design/data/charts.csv` | Data viz patterns | Chart type selection |

### What We Changed

1. **Hardcoded Apple-like default** — `defaultQuery = "SaaS premium minimal clean apple whitespace"`
2. **Made INTAKE responsible for aesthetic** — Skill Injector receives resolved preference
3. **Simplified BM25 parameters** — k1=1.5, b=0.75 (standard)
4. **Added anti-AI checklist** — No emojis as icons, no Bootstrap 2019 aesthetics

### What We Deleted (~14 files)

- Framework-specific CSVs (React, Vue, SwiftUI, Flutter) — placeholders only for now
- Installation scripts
- Demo files

### Key Insight Preserved

> **Design is data, not vibes.** The CSV databases are queryable facts. BM25 returns parameters. The worker doesn't decide aesthetics — it receives them pre-computed.

---

## Repo 4: PAUL (Plan-Apply-Unify Loop)

**URL:** Internal/research
**Audited:** ~30 files
**Extracted:** 1

### What We Took

| Original File | Our File | What It Does | Why We Kept It |
|---------------|----------|--------------|----------------|
| `unify-phase.md` | `phases/unify.md` | Reconciliation after execution | PLANNED|ACTUAL|DELTA comparison |

### What We Changed

1. **Integrated into GSD phase system** — UNIFY runs after VERIFY
2. **Made delta detection mandatory** — Can't close phase without reconciliation
3. **Added deferred capture** — Scope creep goes to <deferred> section

### What We Deleted (~29 files)

- 26 slash commands (Conductor handles routing)
- PLAN and APPLY phases (GSD is better)
- CLI infrastructure
- Memory management (Spine handles this)

### Key Insight Preserved

> **Explicit reconciliation:** Don't let drift accumulate silently. Every phase ends with: "Here's what we planned. Here's what actually happened. Here's the delta."

---

## Repo 5: Claude-Flow / Ruflo

**URL:** github.com/ruvnet/claude-flow
**Audited:** ~15 files
**Extracted:** 1 (pattern, not file)

### What We Took

| Pattern | Our Implementation | What It Does |
|---------|-------------------|--------------|
| Parallel dispatch | `phases/execute.md` wave system | Spawn parallel agents, collect results, merge |

### What We Changed

1. **Integrated into wave-based execution** — Wave 1 agents run in parallel, wave 2 waits
2. **File conflict prevention** — No two plans in same wave can touch same file
3. **Removed HNSW memory** — Overkill. Memory MCP is universal.

### What We Deleted (~14 files)

- CLI (~800 lines)
- HNSW vector memory (~400 lines)
- Swarm topologies (~300 lines)
- Token budgeting (~300 lines) — Context Warden handles this
- Agent spawning code — We have our own

### Key Insight Preserved

> **Wave-based parallelism with exclusive file ownership.** If two agents need the same file, they can't be parallel. The planner assigns waves to prevent conflicts.

---

## Repo 6: Claude-Mem

**URL:** github.com/anthropics/claude-mem (or similar)
**Audited:** ~10 files
**Extracted:** 1 (prompt template only)

### What We Took

| Original | Our Implementation | What It Does |
|----------|-------------------|--------------|
| Observation compression prompt | `messenger/pa-comparison.md` | Compress step output to 2-3 sentences |

### The Compression Template

```
Summarize this step output in 2-3 sentences. Include:
- What changed (files created/modified)
- What was produced (artifacts, data, results)
- What the next step needs to know (dependencies, formats, gotchas)
```

### What We Changed

1. **Moved from PostToolUse hook to PA agent** — PA runs at step transitions
2. **Removed SQLite store** — Spine IS our store
3. **Removed re-injection logic** — Spine refresh handles context restoration

### What We Deleted (~9 files)

- SQLite persistence layer
- Capture hook system
- Session management
- Re-injection scripts

### Key Insight Preserved

> **Lossy compression that retains what matters.** The full output might be 2000 tokens. The summary is 50 tokens. But those 50 tokens contain everything the next step needs.

---

## Custom Skills (Not From Any Repo)

| Skill | Purpose | Based On |
|-------|---------|----------|
| `workers/web-researcher.md` | Web search with citations | GSD researcher pattern + WebSearch/WebFetch tools |
| `workers/worker-deploy.md` | Deployment sequence | Our domain docs + Vercel patterns |
| `workers/worker-image-gen.md` | DALL-E routing | ChatGPT web executor pattern |
| `verification/docker-local-first.md` | Container verification | Our domain docs |
| `templates/lesson-template.md` | Structured learning | DOMAIN-F-PERSISTENCE.md |
| `templates/archive-template.md` | Project handoff | DOMAIN-F-PERSISTENCE.md |
| `templates/llms-txt-template.md` | AI-friendly site descriptor | DOMAIN-D-FRONTEND.md |
| `messenger/pa-comparison.md` | Semantic step glue | conversation.md + Claude-Mem pattern |

---

## The Deletion Principle

> **We kept prompts. We deleted everything else.**

The value of these repos is in HOW they phrase things, not their infrastructure. Their CLI code is worthless to us — we have Unified Terminal. Their memory systems are worthless — we have Spine. Their configuration formats are worthless — we have our own.

What matters: the specific phrasing that forces structured thinking. That's portable. Everything else is noise.
