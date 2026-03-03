# Agent Topology: MVP Framework

## Core Principle

Every "agent" is a prompt + a runtime spawn + a mandate. Agents are cheap to create, expensive to coordinate. The topology is fluid: any agent can become an orchestrator of sub-agents by simply spawning them. Task SIZE determines depth, not configuration.

```
Simple task:  User --> Conductor --> 1 Worker --> Done
Medium task:  User --> Conductor --> 3 Workers (sequential) --> Done
Complex task: User --> Conductor --> Phase agents --> Workers per phase --> Done
Deep task:    User --> Conductor --> Phase --> Worker --> Sub-workers --> Done
```

There is no hard limit on nesting depth. The constraint is practical: each level adds 3-5 seconds spawn overhead. Past 3 levels, overhead dominates. The system self-limits.

---

## The Agent Registry (MVP)

### Tier: Infrastructure (Always Running, Not LLM-Based)

| Agent | What It Is | Implementation | Lifecycle |
|-------|-----------|----------------|-----------|
| Spine | Filesystem truth scan | Node.js: glob + git + fs | Runs on demand, milliseconds |
| Bodyguard | Parallel micro-check dispatcher | Node.js: Promise.allSettled() | Runs per gate, milliseconds |
| Context Warden | Token counter + threshold kill | Node.js: counter + cron | setInterval, every 30s |
| Cron Layer | Timer management | Node.js: setInterval/setTimeout | App lifetime |

These are NOT agents. They are code functions. No LLM, no prompt, no spawn overhead.

### Tier: Orchestration (LLM-Based, Long-Lived Sessions)

| Agent | Prompt Source | Runtime | Session | Sub-Agent Potential |
|-------|-------------|---------|---------|-------------------|
| Conductor | Custom (~600 token system prompt) | Codex CLI (persistent session) | App lifetime, resumes across launches | YES: spawns all workers, can spawn sub-conductors for parallel phases |
| PA / Messenger | pa-comparison.md (~400 tokens) | Any available runtime | Per-handoff (dies after comparison) | NO for MVP. Future: could spawn investigation agents on block. |
| Intake | ChatGPT BrowserView conversation | ChatGPT (web) | Per-project (intake quiz) | NO. Intake is a conversation, not an orchestrator. |

### Tier: Workers (LLM-Based, Short-Lived, Task-Scoped)

| Worker Role | Prompt File | Typical Runtime | Typical Duration | Sub-Agent Potential |
|-------------|------------|----------------|-----------------|-------------------|
| Executor | gsd-executor.md | Codex CLI | 2-15 min | YES: can spawn file-level sub-workers |
| Planner | gsd-planner.md | Codex CLI | 1-3 min | NO for MVP. Plans, does not execute. |
| Researcher | gsd-researcher.md | ChatGPT web | 3-10 min | YES: can spawn per-source research sub-agents |
| Debugger | gsd-debugger.md | Codex CLI | 2-10 min | YES: can spawn hypothesis-testing sub-agents |
| Verifier | gsd-verifier.md | Codex CLI | 1-3 min | NO. Binary check, not deep investigation. |
| Codebase Mapper | gsd-codebase-mapper.md | Codex CLI | 2-5 min | NO. Read-only analysis. |
| TDD Guide | tdd-guide.md | Codex CLI | 5-15 min | YES: test-first sub-agent + impl sub-agent |
| Code Reviewer | code-reviewer.md | Any CLI | 1-3 min | NO. Review is atomic. |
| Security Reviewer | security-reviewer.md | Any CLI | 1-3 min | NO. Complements Semgrep. |
| Doc Updater | doc-updater.md | Codex CLI | 2-5 min | NO. Docs are atomic updates. |
| Build Error Resolver | build-error-resolver.md | Codex CLI | 2-10 min | YES: can spawn targeted fix agents |
| Image Generator | worker-image-gen.md | ChatGPT web (DALL-E) | 0.5-2 min | NO. Single API call. |
| Deploy Agent | worker-deploy.md | Codex CLI + Service | 3-10 min | NO for MVP. Sequential steps. |
| Web Researcher | worker-web-research.md | ChatGPT web | 3-10 min | YES: per-query sub-agents |
| Frontend Builder | skill-frontend-design + executor | Codex CLI | 5-20 min | YES: page-level sub-agents |
| Archivist | archivist.md | Any CLI | 2-5 min | NO. Runs once, reads everything. |

---

## Routing: How Requests Become Agents

```
USER MESSAGE
     |
     v
FAST-PATH (Tier 0, 50ms, code only)
  "What is X?" --> ChatGPT direct. No agents.
  "hi/thanks"  --> ChatGPT direct. No agents.
     |
     | (non-trivial)
     v
CONDUCTOR (Tier 1, ~3 seconds)
  Classifies: web | cli | hybrid
  Classifies: trivial | simple | medium | complex
  Produces: JSON DAG with steps
     |
     +-- trivial --> single web/cli call, 0-1 agents
     +-- simple  --> 1 worker + bodyguard
     +-- medium  --> 3-7 steps, skill injection, bodyguard per step
     +-- complex --> Tier 2 planning
     |
     v (complex only)
PLANNER (Tier 2, ~5-10 seconds)
  Expands high-level DAG into concrete file operations
  Assigns runtime per step (web vs cli vs service)
     |
     v
STEP SCHEDULER (Tier 3, code)
  Executes DAG sequentially (MVP) or parallel (future)
  Per step:
    Spine refresh -> Skill Inject -> Spawn Worker -> Execute ->
    Spine refresh -> Bodyguard -> PA -> Gate
```

---

## Sub-Agent Spawning (The Fluid Part)

Any worker can become an orchestrator. The mechanism is simple:
the worker's prompt includes permission to spawn sub-agents.

```markdown
<!-- In gsd-executor.md -->
## Sub-Agent Permission

If this task involves MORE THAN 3 files or MORE THAN 2 distinct concerns:
1. Break into sub-tasks (1 file or 1 concern each)
2. For each sub-task, spawn a fresh agent with:
   - Narrowed mandate (only the sub-task)
   - Declared files (only files for this sub-task)
   - Same skill pre-loaded
3. Collect results
4. Verify each sub-result
5. Merge

DO NOT sub-agent for tasks involving 1-2 files. The overhead is not worth it.
```

**The constraint is task size, not configuration:**
- 1-2 files: Worker does it directly. No sub-agents.
- 3-5 files: Worker MAY sub-agent. Depends on complexity.
- 6+ files: Worker SHOULD sub-agent. Context pressure makes single-agent work unreliable.

**Depth limit (practical, not enforced):**
- Level 1: Conductor spawns Workers
- Level 2: Worker spawns Sub-Workers (common for complex tasks)
- Level 3: Sub-Worker spawns Sub-Sub-Workers (rare, only mega-tasks)
- Level 4+: Theoretically possible, practically never needed. Overhead > benefit.

---

## Token Budget Allocation

```
Total project budget = sum of all model context windows used

Phase budget allocation (GSD mode):
  Discuss: 10% (intake, requirements)
  Plan:    15% (DAG generation, task decomposition)
  Execute: 60% (actual work, distributed across workers)
  Verify:  10% (testing, review)
  Archive:  5% (summary, llms.txt)

Per-worker budget:
  worker_budget = phase_budget / num_workers_in_phase

Context Warden enforces per-worker:
  if worker.tokens > model_threshold * worker_budget_ratio:
    kill and respawn
```

---

## Agent Lifecycle States

```
IDLE -------> Agent prompt loaded, not yet spawned
SPAWNING ---> Runtime starting, context loading (2-5s)
RUNNING ----> Executing mandate
BLOCKED ----> Waiting for dependency (another step must complete)
KILLED -----> Context Warden terminated (over threshold)
RESPAWNED --> Fresh context, resuming from last checkpoint
COMPLETED --> Mandate fulfilled, output verified
FAILED -----> Mandate could not be completed after retries
```

---

## MVP Topology (Day 1)

Start with the minimum viable set. Add agents only when a use case demands them.

**Must have (Day 1):**
- Conductor (persistent Codex session)
- Executor worker (the generic "do the thing" agent)
- Bodyguard dispatcher (code, not agent)
- Spine (code, not agent)

**Add in Week 1:**
- Researcher worker (for hybrid web+cli tasks)
- Image Generator worker (for DALL-E routing)
- Skill Injector (code match)
- PA (for cross-runtime handoffs)

**Add in Week 2:**
- Context Warden (cron)
- TDD Guide, Code Reviewer, Security Reviewer
- Deploy Agent
- Archivist

**Add when needed:**
- Debugger (when error handling is built)
- Codebase Mapper (when existing-project support ships)
- Frontend Builder with design system (when UI quality matters)
- Sub-agent spawning (when complex tasks are common)

**The topology grows organically. Each new agent is a markdown file + a line in the Skill Injector's directory scan. No framework changes, no config updates, no deployments.**
