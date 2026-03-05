# Engineer Prompt: Status Agent Integration

> **Copy this entire file as the initial prompt for the build engineer Claude Code session.**
> **Working directory**: `/Users/celeste7/Documents/unified-terminal` (main branch, AFTER merge)

---

## Your Assignment

You are the build engineer for the Unified Terminal Electron app. Another team built a **Hardcoded Enforcement Engine** (480+ tests, 95/100 score, production-verified) that wraps every CLI agent execution with safety rails. Your job is to wire it into the Electron app so users can see what's happening.

**Your deliverable**: The **Status Agent** — a translation layer that converts invisible technical enforcement events into human-readable status lines displayed in a vertical timeline tree.

## Before You Start

1. Read `docs/ONGOING_WORK/HANDOFF_INTEGRATION/BUILD-ENGINEER-HANDOFF.md` — orientation
2. Read `docs/ONGOING_WORK/HANDOFF_INTEGRATION/MERGE-STRATEGY.md` — merge worktree first
3. Read `docs/ONGOING_WORK/HANDOFF_INTEGRATION/INTEGRATION-PHASES.md` — your 6 phases
4. Read `docs/ONGOING_WORK/HANDOFF_INTEGRATION/IPC-CONTRACT.md` — all IPC channels
5. Read `docs/ONGOING_WORK/HANDOFF_INTEGRATION/TEST-VERIFICATION-MATRIX.md` — done criteria
6. Read `docs/ONGOING_WORK/HANDOFF_INTEGRATION/FILE-INVENTORY.md` — what exists
7. Read `docs/ONGOING_WORK/STATUS_AGENT/STATUS-AGENT-SPEC.md` — gospel spec (1,070 lines)
8. Read `docs/ONGOING_WORK/STATUS_AGENT/summary.md` — corrected topology diagram
9. Read `docs/ONGOING_WORK/STATUS_AGENT/UX_TREE/APP-SHELL-OVERLAY-SPEC.md` — overlay design
10. Read `docs/ONGOING_WORK/STATUS_AGENT/UX_TREE/AgentRootTree.jsx` — reference tree component

## Execution Order

Execute phases 1→6 in order. Each phase has:
- Exact files to create (with code patterns)
- Exact files to modify (additive only)
- Exact test file with assertions
- Binary done criteria

**Do NOT skip phases. Do NOT batch. One phase at a time, fully tested.**

## Hard Rules

1. **NO API keys** — All auth is OAuth (BrowserView + CLI login). Zero API key references anywhere.
2. **NO LLM for translation** — Status lines are a lookup table. Zero LLM calls for translating events to human text.
3. **Max 8 words per status line** — "Building your homepage" not "Currently executing the homepage construction worker agent"
4. **Banned words** — Never show to user: agent, CLI, API, JSON, token, model, Codex, GSD, exit code, session ID, context window, prompt, node_modules, npm, git commit
5. **Custom test framework** — Use `testsPassed`/`testsFailed` counters, `assert()`, `assertEqual()`, `testAsync()`. Run via `npx ts-node tests/*.ts`. No Jest/Vitest.
6. **Inline styles** — Use inline styles for new React components (not Tailwind). Per project convention for enforcement UI.
7. **Locked files** — Do NOT modify any file in `src/enforcement/`, `src/adapters/`, `src/skills/`, `src/glue/`, or `resources/skills/`. These are production-verified.
8. **Additive only** — When modifying existing files (step-scheduler, conductor, executors, preload, index.ts), ADD code. Do not restructure or remove existing code.

## Key Files to Understand

| File | Read It For |
|------|------------|
| `src/main/step-scheduler.ts` | The 10-step enforcement flow (lines 429-754). You'll add event emissions here. |
| `src/main/conductor.ts` | How classification works. You'll emit events after classify() returns. |
| `src/main/executors/cli-executor.ts` | How CLI spawning works. You'll emit worker:spawn/complete events. |
| `src/main/preload.ts` | Current IPC bridge. You'll add status:* channels. |
| `src/renderer/global.d.ts` | Current Window.electronAPI types. You'll add StatusLine/UserQuery. |
| `src/renderer/components/App.tsx` | Current root component. You'll add BuildPanel. |
| `src/enforcement/constants.ts` | All hardcoded values. Reference only — do not modify. |

## Phase 1 Starter

Start with the Event Bus. It's 20 lines of code:

```
Create: src/main/status-agent/event-bus.ts
Test:   tests/event-bus.test.ts (8 tests)
Done:   npx ts-node tests/event-bus.test.ts → 8/8 pass
```

Then add one-line `statusBus.emit(...)` calls to 6 existing files (conductor, step-scheduler, cli-executor, web-executor, service-executor, rate-limit-recovery).

## Verification After Each Phase

```bash
# Type check
npx tsc --noEmit

# New tests pass
npx ts-node tests/<new-test-file>.test.ts

# Existing tests still pass (regression check)
npx ts-node tests/circuit-breaker-modal.test.ts
npx ts-node tests/claude-adapter.test.ts
npx ts-node tests/codex-adapter.test.ts
```

## Final Done Criteria

Binary. No ambiguity.

1. `npx tsc --noEmit` → 0 errors
2. 61 new tests pass (across 6 test files)
3. 480+ existing tests still pass
4. Send a build message → real status lines appear in the tree
5. Every status line ≤ 8 words with zero banned words
6. Checkpoints render before execution (plan review, pre-deploy)
7. Stop button kills processes (step-level and global)
8. Fuel gauge shows accurate progress

---

## Tree Structure Reference

```
docs/ONGOING_WORK/HANDOFF_INTEGRATION/
├── BUILD-ENGINEER-HANDOFF.md        ← Orientation (start here)
├── MERGE-STRATEGY.md                ← Git commands to merge worktree
├── INTEGRATION-PHASES.md            ← Your 6 phases with code patterns
├── FILE-INVENTORY.md                ← What exists (28 files, 6K lines)
├── IPC-CONTRACT.md                  ← All IPC channels (existing + new)
├── TEST-VERIFICATION-MATRIX.md      ← 61 new tests mapped to criteria
└── ENGINEER-PROMPT.md               ← This file (copy as initial prompt)

docs/ONGOING_WORK/STATUS_AGENT/
├── STATUS-AGENT-SPEC.md             ← Gospel spec (1,070 lines)
├── summary.md                       ← Corrected topology diagram
├── QUICKSTART_README.MD             ← Quick reference
└── UX_TREE/
    ├── APP-SHELL-OVERLAY-SPEC.md    ← Overlay design spec
    ├── AgentRootTree.jsx            ← Reference React tree component
    └── QUICKSTART_README.MD         ← UX quick reference
```
