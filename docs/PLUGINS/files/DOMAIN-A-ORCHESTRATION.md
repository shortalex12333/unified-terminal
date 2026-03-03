# Domain A: Orchestration

## What This Domain Covers
Everything controlling the project lifecycle: routing requests, producing execution plans, managing phase transitions, re-planning on failure, coordinating handoffs between runtimes.

## Actors
| Actor | Role | Rail Type |
|-------|------|-----------|
| Conductor | DAG from user request. Classifies Tier 0-3. Re-plans on failure. | HARD (phase gates) + SOFT (re-plan) |
| Skill Injector | Reads Spine + next step, picks skill, pre-loads worker. | HARD (code match) |
| PA / Messenger | Compares step N output to step N+1 expectations. Pass/Adjust/Block. | SOFT (LLM) |
| Cron Layer | Rate-limit recovery (60s), context checks, continue injection. | HARD (code timers) |

---

## What We Took

### From GSD (Get Shit Done)
**5 phase prompt templates + state machine pattern.**

Phase prompts (the phrasing is the value):
1. `discuss-phase.md` - Forces structured clarifying questions. Not "what do you want?" but "What is the primary user action? What happens on error? What does done look like?"
2. `plan-phase.md` - Task decomposition with dependency ordering. Each task declares: input files, output files, acceptance criteria, rollback plan.
3. `execute-phase.md` - Worker dispatch template. Spawn with mandates, collect results.
4. `verify-phase.md` - Post-execution: did output match plan? Scope drift?
5. `debug-phase.md` - Structured: reproduce > isolate > hypothesize > test > fix > verify.

State machine: GSD tracks in `.planning/STATE.md`. We merge INTO the Spine.

**Changes from original:** Removed Claude Code-specific tool names. Replaced their CLI wrapper with Conductor dispatch. Stripped their adapter flags (we have ours). Kept the phrasing.

**Location:** `/skills/phases/discuss.md`, `plan.md`, `execute.md`, `verify.md`, `debug.md`

### From Claude-Flow / Ruflo
**Parallel dispatch pattern (~200 lines TS).**

Spawns N agents with different mandates, collects results, merges by file path (last-write-wins with conflict detection).

**Took:** spawn/collect/merge loop + mandate isolation.
**Threw away:** CLI/config (~800 lines), HNSW memory (~400 lines, use Memory MCP), swarm topologies (~300 lines), per-swarm token budgeting (~300 lines, Context Warden does this).

**Location:** `/src/conductor/dispatch.ts`

### From PAUL (Plan-Apply-Unify Loop)
**UNIFY reconciliation prompt.**

After every phase: PLANNED | ACTUAL | DELTA. Produces delta that confirms alignment or triggers re-plan.

**Took:** The prompt template only.
**Threw away:** 26 slash commands, PLAN/APPLY phases (GSD better), session management (Spine owns this).

**Location:** `/skills/phases/unify.md`

### From CARL (Context Aware Rule Loader)
**Concept only, NOT their code.**

Their approach: Python hook (~200 lines) + manifest. Our approach: 50 lines Node.js. Filename IS manifest. First line of each skill file = trigger metadata:
```
<!-- triggers: REST, Express, HTTP, endpoints, CRUD, API -->
```
Injector reads line 1, matches against task, loads ONE best match.

**Location:** `/src/skill-injector/match.ts`

---

## Deleted
| Tool | Why |
|------|-----|
| PAUL (as install) | UNIFY absorbed. Iterative mode in Conductor. |
| CARL (as install) | We ARE the skill injection layer. |
| Claude-Flow (as install) | Dispatch absorbed. Token counting in Context Warden. |
| CrewAI / LangGraph | Conductor IS the orchestrator. |
| Superpowers | GSD prompts better. Bootstrap hook unnecessary. |

---

## Phase Flow
```
USER REQUEST
  |
  v
INTAKE (Tier 0/1/2 classification)
  +-- NEW PROJECT --> GSD mode (discuss > plan > execute > verify)
  +-- EXISTING -----> PAUL mode (plan > apply > unify, iterative)
  +-- TRIVIAL ------> Passthrough (0 agents)
  |
  v
DISCUSS > PLAN > EXECUTE (per step) > VERIFY > UNIFY > ARCHIVE

Execute per step:
  1. Pre-step Spine refresh
  2. Skill Injector picks skill
  3. Worker spawns with skill + mandate
  4. Worker executes
  5. Post-step Spine refresh
  6. Bodyguard micro-checks [HARD]
  7. PA comparison [SOFT]
  8. Gate: pass | adjust | block
```
