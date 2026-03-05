# Build Engineer Handoff: Enforcement Engine → Electron App Integration

> **Status**: READY FOR INTEGRATION
> **Source**: Worktree at `.claude/worktrees/instance3-instance4-implementation/`
> **Target**: Main branch (`main`) of the Electron app
> **Date**: 2026-03-04
> **Score**: 95/100 (verified by independent review agents)
> **Tests**: 480+ passing across 15 test files

---

## READ THESE FILES IN ORDER

| # | File | Purpose | Priority |
|---|------|---------|----------|
| 1 | **This file** | Orientation + merge strategy | START HERE |
| 2 | `MERGE-STRATEGY.md` | Exact git commands to merge worktree to main | DO FIRST |
| 3 | `INTEGRATION-PHASES.md` | 6 phases of wiring work, dependency-ordered | YOUR WORK |
| 4 | `FILE-INVENTORY.md` | Every file created/modified with line counts | REFERENCE |
| 5 | `IPC-CONTRACT.md` | All IPC channels (existing + new) | REFERENCE |
| 6 | `TEST-VERIFICATION-MATRIX.md` | Test names ↔ acceptance criteria | DONE CRITERIA |

**Also read (gospel-level specs):**
- `docs/ONGOING_WORK/STATUS_AGENT/STATUS-AGENT-SPEC.md` — 1,070 lines, authoritative spec for Status Agent
- `docs/ONGOING_WORK/STATUS_AGENT/UX_TREE/APP-SHELL-OVERLAY-SPEC.md` — App shell overlay design
- `docs/ONGOING_WORK/STATUS_AGENT/UX_TREE/AgentRootTree.jsx` — Reference React tree component
- `docs/ONGOING_WORK/STATUS_AGENT/summary.md` — Corrected topology diagram

---

## What Was Built (Instance 3/4)

A **hardcoded enforcement engine** that wraps every CLI agent execution with safety rails. It sits between the Conductor (which classifies user messages) and the Executors (which spawn CLI tools).

```
USER MESSAGE
     │
     ├── TIER 0: Fast-path (50ms local bypass)
     │
     ├── TIER 1: Conductor (persistent Codex session → DAG)
     │
     └── TIER 3: Step-Scheduler (10-STEP ENFORCEMENT FLOW)  ← THIS IS WHAT WE BUILT
              │
              ├─ 1. Pre-spine snapshot
              ├─ 2. Skill selection (agent-based + keyword fallback)
              ├─ 3. Prompt assembly (80K token builder)
              ├─ 4. Pre-step bodyguard gate check
              ├─ 5. Execute via adapter (Codex/Claude CLI spawn)
              ├─ 6. Normalize result
              ├─ 7. Post-spine snapshot
              ├─ 8. Post-step bodyguard gate check
              ├─ 9. Skill verification checks
              └─ 10. PA comparison (spine diff)
```

### Modules Built

| Module | Files | Lines | Purpose |
|--------|-------|-------|---------|
| `src/enforcement/` | 6 | ~1,200 | Types, constants (24 groups), enforcer, bodyguard, spine |
| `src/adapters/` | 6 | ~1,100 | Universal adapter interfaces, Codex + Claude translators, factory, permissions (29 skills) |
| `src/skills/` | 6 | ~800 | Skill selection, validation, verify parser, critical checks, sandbox |
| `src/glue/` | 3 | ~400 | Prompt assembly (80K budget), result normalization |
| `resources/skills/` | 1 | 433 | trigger-map.json (28 skills, keyword index) |
| Modified: `step-scheduler.ts` | — | +500 | 10-step enforcement flow wired into executeStep() |
| Modified: `index.ts` | — | +30 | 3 executors registered, IPC handlers for circuit breaker |
| Tests | 15 | ~5,000 | 480+ tests across unit, integration, E2E, compatibility |

### What You DON'T Need to Build

These are DONE and work:
- Enforcement engine (all gate checks, spine snapshots, PA comparison)
- Codex adapter (session resume, JSON output, sandbox modes)
- Claude adapter (YAML frontmatter, tool translation, JSON parsing)
- Skill selector (agent-based primary, keyword fallback)
- Circuit breaker (confidence-aware filtering, retry/skip/stop)
- CircuitBreakerModal component (inline styles, IPC wired)
- All 480+ tests

### What You NEED to Build

The **Status Agent** — the user-facing translation layer that converts technical enforcement events into human-readable status lines. See `INTEGRATION-PHASES.md` for the 6 phases.

---

## Architecture Rules (Hard Rails)

### NO API Keys. Ever.
- ChatGPT: BrowserView OAuth (web login)
- Claude: BrowserView OAuth (web login)
- Codex CLI: `codex --login` (OAuth flow)
- Claude Code: `claude` (OAuth flow)
- There is ZERO use of API keys anywhere. The `requiredEnv` arrays are empty.

### NO LLM for Translation
- Status lines are a LOOKUP TABLE, not LLM output
- Max 8 words per status line
- Banned words: "agent", "CLI", "API", "JSON", "token", "model", "Codex", "GSD", "exit code", "session ID", "context window", "prompt", "node_modules", "npm", "git commit"
- Present tense only: "Building your homepage" not "Built your homepage"

### Gemini is SHELVED
- No Gemini adapter, no Gemini CLI, no Gemini anything
- Runtimes: Codex + Claude Code only
- ChatGPT Web = BrowserView for research + images only

### Frontend is LAST
- All backend integration first
- React components only after IPC channels are wired and tested
- Use inline styles (not Tailwind) for enforcement UI components

### Custom Test Framework
- Tests use `testsPassed`/`testsFailed` counters, `assert()`, `assertEqual()`, `testAsync()` helpers
- Run via `npx ts-node tests/*.ts`
- NO Jest, NO Vitest, NO Mocha
- Electron IPC mocked via `require.cache[require.resolve('electron')]` injection

---

## Quick Reference: Key Files

### Source of Truth Files
| File | What It Is |
|------|------------|
| `src/enforcement/constants.ts` | ALL hardcoded values (24 groups, ~520 lines). No magic numbers elsewhere. |
| `src/adapters/permissions.ts` | 29-skill COMPATIBILITY map. Which tools each skill needs. |
| `src/adapters/types.ts` | Universal AgentConfig → AgentResult interface. Runtime = 'codex' | 'claude'. |
| `resources/skills/trigger-map.json` | 28 skills with keyword triggers. Used by selector.ts. |
| `src/skills/critical-checks.ts` | 4 hardcoded safety checks that ALWAYS run (tests-exist, no-secrets, docker-built, build-exists). |

### Integration Surface Files (You'll Modify)
| File | What To Add |
|------|-------------|
| `src/main/step-scheduler.ts` | Emit StatusEvent at each of the 10 enforcement steps |
| `src/main/preload.ts` | Add `status:*` IPC channels to contextBridge |
| `src/renderer/global.d.ts` | Add StatusLine, UserQuery, TreeNode types |
| `src/main/index.ts` | Register status agent IPC handlers |
| `src/main/conductor.ts` | Emit `conductor:classify`, `conductor:plan-ready` events |
| `src/main/executors/cli-executor.ts` | Emit `worker:spawn`, `worker:file-created`, `worker:complete` events |

### New Files You'll Create
| File | Purpose |
|------|---------|
| `src/main/status-agent/translator.ts` | Event → StatusLine lookup table |
| `src/main/status-agent/query-router.ts` | UserQuery rendering + PA response routing |
| `src/main/status-agent/interrupt-handler.ts` | Surgical user corrections → PA envelopes |
| `src/main/status-agent/types.ts` | StatusEvent, StatusLine, UserQuery, TreeNode interfaces |
| `src/main/status-agent/event-bus.ts` | Typed EventEmitter for status events |
| `src/main/status-agent/index.ts` | Barrel exports |
| `src/renderer/components/StatusTree.tsx` | Vertical timeline tree component |
| `src/renderer/components/BuildPanel.tsx` | Side panel containing tree + fuel gauge |

---

## The Three Rules

1. **Plan First** — No code without approved plan
2. **Verify Always** — Prove it works with evidence (`npx ts-node tests/*.ts`)
3. **Learn Forever** — Structured lessons after every task

---

## Questions? Read These

| Question | Answer Location |
|----------|----------------|
| How does the 10-step enforcement flow work? | `src/main/step-scheduler.ts:429-754` |
| What IPC channels exist? | `IPC-CONTRACT.md` + `src/main/preload.ts` |
| What does the circuit breaker do? | `src/main/step-scheduler.ts:757-830` |
| How do adapters spawn CLI tools? | `src/adapters/codex/adapter.ts` + `src/adapters/claude/adapter.ts` |
| What are the 29 skills? | `src/adapters/permissions.ts` |
| What do status lines look like? | `docs/ONGOING_WORK/STATUS_AGENT/STATUS-AGENT-SPEC.md` Section 2.2 |
| What does the tree UI look like? | `docs/ONGOING_WORK/STATUS_AGENT/STATUS-AGENT-SPEC.md` Section 6.1 |
| What words are banned? | `docs/ONGOING_WORK/STATUS_AGENT/STATUS-AGENT-SPEC.md` Section 7.1 |
