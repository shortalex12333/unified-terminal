# Unified Terminal — Project State

## Current Phase: 8 (Integration Test)
## Status: COMPLETE
## Mode: EXECUTION

Phase progress tracked in `.planning/phases/` directories and `ROADMAP.md`.

---

## What Exists (Phase 7 — Complete)

- `src/adapters/claude/adapter.ts` — Claude CLI adapter (433 lines)
- `src/adapters/claude/frontmatter.ts` — YAML frontmatter generation (105 lines)
- `src/adapters/factory.ts` — Updated with Claude adapter registration
- `src/adapters/types.ts` — Runtime type includes 'claude'
- `src/adapters/permissions.ts` — 29-skill COMPATIBILITY map (28 DISSECTION + architecture-reviewer)
- `tests/claude-adapter.test.ts` — 8 unit tests, all passing (commit b0ed68a)
- `tsc --noEmit` — zero errors

## Codebase Stats (Post Phase 8)

- **New files created:** 22 (19 from phases 1-6 + 2 from phase 7 + 1 from phase 8)
- **Total lines added:** ~5,000
- **TypeScript errors:** 0 (last checked: 2026-03-04)
- **Existing tests:** 444+ unit tests + 23 integration tests
- **Integration tests:** 23/23 passing (conductor-scheduler-executor.test.ts)
- **Score:** 95/100 (per code review)

## Files Created (All Phases)

### src/adapters/ (6 files)
- `types.ts` — Universal adapter interfaces
- `codex/adapter.ts` — Codex CLI translator
- `claude/adapter.ts` — Claude Code CLI translator (Phase 7)
- `claude/frontmatter.ts` — YAML frontmatter generation (Phase 7)
- `permissions.ts` — Tool permissions + plugin compat (29 skills)
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

### tests/integration/ (1 file — Phase 8)
- `conductor-scheduler-executor.test.ts` — Full pipeline integration test (1005 lines, 23 tests)

## Modified Files

- `src/main/step-scheduler.ts` — 10-step enforcement flow + buildDagProgress()
- `src/main/index.ts` — 3 executors registered

## Known Gaps

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| GAP-001 | COMPATIBILITY map: 17/28 skills | Phase 7 | RESOLVED (29 entries) |
| GAP-002 | Claude adapter tests not written | Phase 7 | RESOLVED (b0ed68a) |
| GAP-003 | Conductor→Scheduler→Executor not integration tested | Phase 8 | RESOLVED (de2d362) |
| GAP-004 | Circuit breaker user escalation not wired | Phase 9 | Pending |
| GAP-005 | No E2E tests for enforcement pipeline | Phase 10 | Pending |
| GAP-006 | Send interceptor not integration tested | Phase 8 | RESOLVED (de2d362) |

## Key Decisions

- Gemini CLI: SHELVED (2026-03-04)
- Claude Code needs translator (not "native") when spawned as child process
- Agent-based skill selection is PRIMARY; keyword matching is FALLBACK
- 28 skills from DISSECTION (not 17) must be in COMPATIBILITY map
- GSD phase directories created for proper workflow tracking
- Enforcer mock needed in integration tests: file-existence check has definitive confidence, missing Python scripts cause HARD_FAIL that blocks execution

## Quick Tasks Completed

| Date | Task | Commit |
|------|------|--------|
| 2026-03-04 | Fix P1 timeout budget (bodyguard.ts) | — |
| 2026-03-04 | Fix P2 DAG progress wiring (step-scheduler.ts) | — |
| 2026-03-04 | GSD restructure: create .planning/phases/ with PLAN+SUMMARY for phases 1-6 | — |
| 2026-03-04 | Phase 7 Plan 01: Claude adapter tests (8/8 passing) | b0ed68a |
| 2026-03-04 | Phase 8 Plan 01: Integration test (23/23 passing) | de2d362 |
