# GSD Repository Audit Report

**Repository:** github.com/gsd-build/get-shit-done
**Audited:** 2026-03-03
**Total Markdown Files:** 122

---

## Executive Summary

GSD is a comprehensive meta-prompting and context engineering system for AI coding assistants (Claude Code, Codex, Gemini CLI). It implements a full project lifecycle: questioning -> research -> requirements -> roadmap -> plan -> execute -> verify -> debug.

**Key Architectural Patterns:**
- **Orchestrator + Subagent model** - Workflows spawn specialized agents
- **Goal-backward verification** - Verify outcomes, not just task completion
- **State persistence** - STATE.md tracks project position across sessions
- **Context engineering** - Templates minimize token usage while maximizing clarity

---

## File Classification

### EXTRACT (High-Value Target Files)

These files match our extraction targets and contain valuable agent prompts or system patterns.

#### Agent Prompts (12 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `agents/gsd-executor.md` | **EXTRACT** | Plan executor - atomic commits, checkpoints, state management |
| `agents/gsd-planner.md` | **EXTRACT** | Phase planner - task breakdown, dependency analysis |
| `agents/gsd-debugger.md` | **EXTRACT** | Scientific debugging - hypothesis testing, root cause analysis |
| `agents/gsd-verifier.md` | **EXTRACT** | Goal-backward verification - proves outcomes not tasks |
| `agents/gsd-codebase-mapper.md` | **EXTRACT** | Codebase analysis - tech, arch, quality, concerns |
| `agents/gsd-phase-researcher.md` | **EXTRACT** | Phase research - technical investigation before planning |
| `agents/gsd-project-researcher.md` | **EXTRACT** | Domain research - ecosystem analysis for new projects |
| `agents/gsd-plan-checker.md` | **EXTRACT** | Plan verification - validates plans before execution |
| `agents/gsd-integration-checker.md` | **EXTRACT** | Cross-phase integration - E2E flow verification |
| `agents/gsd-roadmapper.md` | **EXTRACT** | Roadmap creation - requirement mapping to phases |
| `agents/gsd-research-synthesizer.md` | **EXTRACT** | Research synthesis - combines parallel research outputs |
| `agents/gsd-nyquist-auditor.md` | **EXTRACT** | Test generation - fills validation gaps |

#### Phase Workflows (6 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/workflows/discuss-phase.md` | **EXTRACT** | Extract implementation decisions from user |
| `get-shit-done/workflows/plan-phase.md` | **EXTRACT** | Create executable plans with research |
| `get-shit-done/workflows/execute-phase.md` | **EXTRACT** | Wave-based parallel plan execution |
| `get-shit-done/workflows/verify-phase.md` | **EXTRACT** | Goal-backward verification |
| `get-shit-done/workflows/research-phase.md` | **EXTRACT** | Standalone research command |
| `get-shit-done/workflows/diagnose-issues.md` | **EXTRACT** | Parallel debug agent orchestration |

#### State/Template Files (8 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/templates/state.md` | **EXTRACT** | STATE.md template - project living memory |
| `get-shit-done/templates/phase-prompt.md` | **EXTRACT** | PLAN.md template - executable phase plans |
| `get-shit-done/templates/context.md` | **EXTRACT** | CONTEXT.md template - user decisions |
| `get-shit-done/templates/debug-subagent-prompt.md` | **EXTRACT** | Debug agent spawning template |
| `get-shit-done/templates/planner-subagent-prompt.md` | **EXTRACT** | Planner agent spawning template |
| `get-shit-done/templates/verification-report.md` | **EXTRACT** | Verification output template |
| `get-shit-done/templates/research.md` | **EXTRACT** | Research output template |
| `get-shit-done/templates/DEBUG.md` | **EXTRACT** | Debug session tracking template |

---

### REVIEW (Useful Supporting Files)

These files contain valuable patterns but were not on the primary target list.

#### Reference Documents (14 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/references/verification-patterns.md` | **REVIEW** | How to detect stubs vs real implementations |
| `get-shit-done/references/checkpoints.md` | **REVIEW** | Checkpoint types and handling |
| `get-shit-done/references/tdd.md` | **REVIEW** | TDD workflow integration |
| `get-shit-done/references/questioning.md` | **REVIEW** | Project questioning philosophy |
| `get-shit-done/references/git-integration.md` | **REVIEW** | Git workflow patterns |
| `get-shit-done/references/git-planning-commit.md` | **REVIEW** | Planning commit conventions |
| `get-shit-done/references/model-profiles.md` | **REVIEW** | Model configuration |
| `get-shit-done/references/model-profile-resolution.md` | **REVIEW** | Model selection logic |
| `get-shit-done/references/phase-argument-parsing.md` | **REVIEW** | Phase argument handling |
| `get-shit-done/references/planning-config.md` | **REVIEW** | Planning configuration |
| `get-shit-done/references/continuation-format.md` | **REVIEW** | Session continuation format |
| `get-shit-done/references/decimal-phase-calculation.md` | **REVIEW** | Decimal phase numbering |
| `get-shit-done/references/ui-brand.md` | **REVIEW** | UI/UX guidelines |

#### Templates (16 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/templates/project.md` | **REVIEW** | PROJECT.md template |
| `get-shit-done/templates/roadmap.md` | **REVIEW** | ROADMAP.md template |
| `get-shit-done/templates/milestone.md` | **REVIEW** | Milestone entry template |
| `get-shit-done/templates/summary.md` | **REVIEW** | SUMMARY.md template |
| `get-shit-done/templates/requirements.md` | **REVIEW** | REQUIREMENTS.md template |
| `get-shit-done/templates/discovery.md` | **REVIEW** | Discovery phase template |
| `get-shit-done/templates/continue-here.md` | **REVIEW** | Session continuation template |
| `get-shit-done/templates/milestone-archive.md` | **REVIEW** | Archive template |
| `get-shit-done/templates/retrospective.md` | **REVIEW** | Retrospective template |
| `get-shit-done/templates/user-setup.md` | **REVIEW** | User setup template |
| `get-shit-done/templates/UAT.md` | **REVIEW** | User acceptance testing |
| `get-shit-done/templates/VALIDATION.md` | **REVIEW** | Validation template |
| `get-shit-done/templates/summary-complex.md` | **REVIEW** | Complex summary variant |
| `get-shit-done/templates/summary-minimal.md` | **REVIEW** | Minimal summary variant |
| `get-shit-done/templates/summary-standard.md` | **REVIEW** | Standard summary variant |

#### Additional Workflows (18 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/workflows/new-project.md` | **REVIEW** | Full project initialization |
| `get-shit-done/workflows/execute-plan.md` | **REVIEW** | Individual plan execution |
| `get-shit-done/workflows/discovery-phase.md` | **REVIEW** | Discovery execution |
| `get-shit-done/workflows/new-milestone.md` | **REVIEW** | Milestone creation |
| `get-shit-done/workflows/verify-work.md` | **REVIEW** | Work verification |
| `get-shit-done/workflows/map-codebase.md` | **REVIEW** | Codebase mapping |
| `get-shit-done/workflows/progress.md` | **REVIEW** | Progress reporting |
| `get-shit-done/workflows/health.md` | **REVIEW** | Health checks |
| `get-shit-done/workflows/cleanup.md` | **REVIEW** | Cleanup operations |
| `get-shit-done/workflows/transition.md` | **REVIEW** | Phase transitions |
| `get-shit-done/workflows/pause-work.md` | **REVIEW** | Work pause handling |
| `get-shit-done/workflows/resume-project.md` | **REVIEW** | Project resumption |
| `get-shit-done/workflows/add-phase.md` | **REVIEW** | Phase addition |
| `get-shit-done/workflows/insert-phase.md` | **REVIEW** | Phase insertion |
| `get-shit-done/workflows/remove-phase.md` | **REVIEW** | Phase removal |
| `get-shit-done/workflows/validate-phase.md` | **REVIEW** | Phase validation |
| `get-shit-done/workflows/quick.md` | **REVIEW** | Quick task handling |
| `get-shit-done/workflows/settings.md` | **REVIEW** | Settings management |

#### Codebase Templates (7 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/templates/codebase/architecture.md` | **REVIEW** | Architecture document template |
| `get-shit-done/templates/codebase/concerns.md` | **REVIEW** | Technical debt tracking |
| `get-shit-done/templates/codebase/conventions.md` | **REVIEW** | Code conventions template |
| `get-shit-done/templates/codebase/integrations.md` | **REVIEW** | Integration documentation |
| `get-shit-done/templates/codebase/stack.md` | **REVIEW** | Tech stack template |
| `get-shit-done/templates/codebase/structure.md` | **REVIEW** | File structure template |
| `get-shit-done/templates/codebase/testing.md` | **REVIEW** | Testing patterns template |

#### Research Project Templates (5 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `get-shit-done/templates/research-project/SUMMARY.md` | **REVIEW** | Research summary |
| `get-shit-done/templates/research-project/STACK.md` | **REVIEW** | Stack research |
| `get-shit-done/templates/research-project/FEATURES.md` | **REVIEW** | Feature research |
| `get-shit-done/templates/research-project/ARCHITECTURE.md` | **REVIEW** | Architecture research |
| `get-shit-done/templates/research-project/PITFALLS.md` | **REVIEW** | Pitfall research |

#### Documentation (2 files)

| File | Classification | Purpose |
|------|---------------|---------|
| `docs/USER-GUIDE.md` | **REVIEW** | Full user guide with diagrams |
| `docs/context-monitor.md` | **REVIEW** | Context monitoring |

---

### SKIP (Noise/Standard Files)

| File | Reason |
|------|--------|
| `README.md` | Marketing/installation - no extraction value |
| `CHANGELOG.md` | Version history |
| `SECURITY.md` | Security policy |
| `.github/pull_request_template.md` | PR template |
| `commands/gsd/*.md` | Command stubs that reference workflows (27 files) |

---

## Key File Excerpts

### gsd-executor.md (First 30 lines)
```markdown
---
name: gsd-executor
description: Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management. Spawned by execute-phase orchestrator or execute-plan command.
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
skills:
  - gsd-executor-workflow
---

<role>
You are a GSD plan executor. You execute PLAN.md files atomically, creating per-task commits, handling deviations automatically, pausing at checkpoints, and producing SUMMARY.md files.

Spawned by `/gsd:execute-phase` orchestrator.

Your job: Execute the plan completely, commit each task, create SUMMARY.md, update STATE.md.

**CRITICAL: Mandatory Initial Read**
If the prompt contains a `<files_to_read>` block, you MUST use the `Read` tool to load every file listed there before performing any other actions. This is your primary context.
</role>
```

### gsd-planner.md (First 30 lines)
```markdown
---
name: gsd-planner
description: Creates executable phase plans with task breakdown, dependency analysis, and goal-backward verification. Spawned by /gsd:plan-phase orchestrator.
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*
color: green
skills:
  - gsd-planner-workflow
---

<role>
You are a GSD planner. You create executable phase plans with task breakdown, dependency analysis, and goal-backward verification.

Spawned by:
- `/gsd:plan-phase` orchestrator (standard phase planning)
- `/gsd:plan-phase --gaps` orchestrator (gap closure from verification failures)
- `/gsd:plan-phase` in revision mode (updating plans based on checker feedback)

Your job: Produce PLAN.md files that Claude executors can implement without interpretation. Plans are prompts, not documents that become prompts.

**Core responsibilities:**
- **FIRST: Parse and honor user decisions from CONTEXT.md** (locked decisions are NON-NEGOTIABLE)
- Decompose phases into parallel-optimized plans with 2-3 tasks each
- Build dependency graphs and assign execution waves
- Derive must-haves using goal-backward methodology
```

### gsd-debugger.md (First 30 lines)
```markdown
---
name: gsd-debugger
description: Investigates bugs using scientific method, manages debug sessions, handles checkpoints. Spawned by /gsd:debug orchestrator.
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch
color: orange
skills:
  - gsd-debugger-workflow
---

<role>
You are a GSD debugger. You investigate bugs using systematic scientific method, manage persistent debug sessions, and handle checkpoints when user input is needed.

You are spawned by:
- `/gsd:debug` command (interactive debugging)
- `diagnose-issues` workflow (parallel UAT diagnosis)

Your job: Find the root cause through hypothesis testing, maintain debug file state, optionally fix and verify (depending on mode).

**Core responsibilities:**
- Investigate autonomously (user reports symptoms, you find cause)
- Maintain persistent debug file state (survives context resets)
- Return structured results (ROOT CAUSE FOUND, DEBUG COMPLETE, CHECKPOINT REACHED)
```

### gsd-verifier.md (First 30 lines)
```markdown
---
name: gsd-verifier
description: Verifies phase goal achievement through goal-backward analysis. Checks codebase delivers what phase promised, not just that tasks completed. Creates VERIFICATION.md report.
tools: Read, Write, Bash, Grep, Glob
color: green
skills:
  - gsd-verifier-workflow
---

<role>
You are a GSD phase verifier. You verify that a phase achieved its GOAL, not just completed its TASKS.

Your job: Goal-backward verification. Start from what the phase SHOULD deliver, verify it actually exists and works in the codebase.

**Critical mindset:** Do NOT trust SUMMARY.md claims. SUMMARYs document what Claude SAID it did. You verify what ACTUALLY exists in the code. These often differ.
</role>
```

### state.md Template (Key Section)
```markdown
# Project State

## Current Position

Phase: [X] of [Y] ([Phase name])
Plan: [A] of [B] in current phase
Status: [Ready to plan / Planning / Ready to execute / In progress / Phase complete]
Last activity: [YYYY-MM-DD] — [What happened]

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: [N]
- Average duration: [X] min
- Total execution time: [X.X] hours
```

### discuss-phase.md (Key Pattern)
```markdown
<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.
</downstream_awareness>
```

### verification-patterns.md (Key Pattern)
```markdown
<core_principle>
**Existence ≠ Implementation**

A file existing does not mean the feature works. Verification must check:
1. **Exists** - File is present at expected path
2. **Substantive** - Content is real implementation, not placeholder
3. **Wired** - Connected to the rest of the system
4. **Functional** - Actually works when invoked

Levels 1-3 can be checked programmatically. Level 4 often requires human verification.
</core_principle>
```

---

## Unexpected Valuable Finds

1. **gsd-nyquist-auditor.md** - Automatic test generation for validation gaps. Novel approach to ensuring test coverage.

2. **checkpoints.md** - Detailed checkpoint type system (human-verify, decision, human-action) with auto-mode bypass rules.

3. **verification-patterns.md** - Comprehensive stub detection patterns that can identify placeholder code.

4. **questioning.md** - Philosophy document on extracting requirements from users - "thinking partner, not interviewer."

5. **gsd-tools.cjs** - Referenced CLI tool for state management (not in markdown, would need separate extraction).

---

## Architecture Summary

```
/gsd:new-project
    │
    ├── Questions (questioning.md patterns)
    ├── Research (gsd-project-researcher × 4 parallel)
    ├── Synthesize (gsd-research-synthesizer)
    ├── Roadmap (gsd-roadmapper)
    └── STATE.md + PROJECT.md + ROADMAP.md + REQUIREMENTS.md
                │
                └── FOR EACH PHASE:
                    │
                    ├── /gsd:discuss-phase → CONTEXT.md
                    │
                    ├── /gsd:plan-phase
                    │   ├── gsd-phase-researcher → RESEARCH.md
                    │   ├── gsd-planner → PLAN.md (× N)
                    │   └── gsd-plan-checker → validates
                    │
                    ├── /gsd:execute-phase
                    │   ├── Wave grouping (parallel plans)
                    │   ├── gsd-executor (per plan)
                    │   └── SUMMARY.md per plan
                    │
                    ├── /gsd:verify-work
                    │   ├── gsd-verifier → VERIFICATION.md
                    │   └── UAT.md (human testing)
                    │
                    └── /gsd:debug (if gaps found)
                        ├── gsd-debugger (× N parallel)
                        └── DEBUG.md per issue
```

---

## Extraction Priority

### Tier 1 (Immediate)
1. `agents/gsd-executor.md` - Core execution logic
2. `agents/gsd-planner.md` - Planning patterns
3. `agents/gsd-verifier.md` - Verification patterns
4. `agents/gsd-debugger.md` - Debug methodology
5. `get-shit-done/templates/state.md` - State machine pattern

### Tier 2 (Important)
6. `agents/gsd-codebase-mapper.md` - Codebase analysis
7. `agents/gsd-phase-researcher.md` - Research patterns
8. `get-shit-done/workflows/discuss-phase.md` - User interaction
9. `get-shit-done/workflows/plan-phase.md` - Planning orchestration
10. `get-shit-done/references/verification-patterns.md` - Stub detection

### Tier 3 (Supporting)
11. `agents/gsd-plan-checker.md` - Plan validation
12. `get-shit-done/workflows/execute-phase.md` - Execution orchestration
13. `get-shit-done/references/checkpoints.md` - Checkpoint handling
14. `get-shit-done/templates/phase-prompt.md` - Plan template
15. `get-shit-done/references/questioning.md` - Questioning philosophy

---

## Next Steps

1. Use `gh api` to fetch full content of Tier 1 files
2. Store in `/docs/ONGOING_WORK/DISSECTION/extracted/gsd/`
3. Analyze patterns for unified terminal integration
4. Extract reusable components (state machine, verification, checkpoints)

