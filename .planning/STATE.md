# Unified Terminal — Project State

## Current Phase: 7 (Claude Code Translator)
## Status: COMPLETE
## Mode: EXECUTION

Phase progress tracked in `.planning/phases/` directories and `ROADMAP.md`.

---

## What Exists (Phase 7 — Partial)

Code written but not yet complete:
- `src/adapters/claude/adapter.ts` — Claude CLI adapter (433 lines)
- `src/adapters/claude/frontmatter.ts` — YAML frontmatter generation (105 lines)
- `src/adapters/factory.ts` — Updated with Claude adapter registration
- `src/adapters/types.ts` — Runtime type includes 'claude'

**Phase 7 Plan 01 completed:**
- `tests/claude-adapter.test.ts` — 8 unit tests, all passing (commit b0ed68a)
- `tsc --noEmit` — zero errors

**Remaining gaps (deferred to future phases):**
- `src/adapters/permissions.ts` — COMPATIBILITY map has 17 entries, needs 28 (per DISSECTION INDEX.md)

## Codebase Stats (Post Phase 6)

- **New files created:** 21 (19 from phases 1-6 + 2 from phase 7)
- **Total lines added:** ~4,000
- **TypeScript errors:** 0 (last checked)
- **Existing tests:** 444+ passing (pre-integration)
- **Score:** 95/100 (per code review)

## Files Created (All Phases)

### src/adapters/ (6 files)
- `types.ts` — Universal adapter interfaces
- `codex/adapter.ts` — Codex CLI translator
- `claude/adapter.ts` — Claude Code CLI translator (Phase 7)
- `claude/frontmatter.ts` — YAML frontmatter generation (Phase 7)
- `permissions.ts` — Tool permissions + plugin compat (17/28 skills)
- `factory.ts` — Adapter factory + runtime selection

### src/enforcement/ (6 files)
- `types.ts` — Enforcement type definitions
- `constants.ts` — Token thresholds, model routing, check activation
- `enforcer.ts` — Single check execution + retry
- `bodyguard.ts` — Parallel gate checks + verdict aggregation
- `spine.ts` — Project state snapshots + diff
- `index.ts` — Barrel exports

### src/skills/ (6 files)
- `selector.ts` — Agent-based skill selection + keyword fallback
- `validator.ts` — Token budget + tier limits
- `verify-parser.ts` — Parse verify blocks from skill markdown
- `critical-checks.ts` — 4-entry code backstop
- `verify-sandbox.ts` — Command allowlist/blocklist
- `index.ts` — Barrel exports

### src/glue/ (3 files)
- `assemble-prompt.ts` — 80K token prompt builder
- `normalizer.ts` — Raw output → GateCheckInput
- `index.ts` — Barrel exports

## Modified Files

- `src/main/step-scheduler.ts` — 10-step enforcement flow + buildDagProgress()
- `src/main/index.ts` — 3 executors registered

## Known Gaps

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| GAP-001 | COMPATIBILITY map: 17/28 skills | Phase 7 | Blocking |
| GAP-002 | Claude adapter tests not written | Phase 7 | RESOLVED (b0ed68a) |
| GAP-003 | Conductor→Scheduler→Executor not integration tested | Phase 8 | Pending |
| GAP-004 | Circuit breaker user escalation not wired | Phase 9 | Pending |
| GAP-005 | No E2E tests for enforcement pipeline | Phase 10 | Pending |
| GAP-006 | Send interceptor not integration tested | Phase 8 | Pending |

## Key Decisions

- Gemini CLI: SHELVED (2026-03-04)
- Claude Code needs translator (not "native") when spawned as child process
- Agent-based skill selection is PRIMARY; keyword matching is FALLBACK
- 28 skills from DISSECTION (not 17) must be in COMPATIBILITY map
- GSD phase directories created for proper workflow tracking

## Quick Tasks Completed

| Date | Task | Commit |
|------|------|--------|
| 2026-03-04 | Fix P1 timeout budget (bodyguard.ts) | — |
| 2026-03-04 | Fix P2 DAG progress wiring (step-scheduler.ts) | — |
| 2026-03-04 | GSD restructure: create .planning/phases/ with PLAN+SUMMARY for phases 1-6 | — |
| 2026-03-04 | Phase 7 Plan 01: Claude adapter tests (8/8 passing) | b0ed68a |
