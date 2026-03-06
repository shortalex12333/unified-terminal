# Unified Terminal — Roadmap

## Milestone: v1.0 — Production-Ready Enforcement Pipeline (COMPLETE)

### Phase 1: Enforcement Spec
**Status:** Complete
**Goal:** Define hardcoded enforcement engine specification with constants, templates, and architecture document.
**Summary:** 33 constants, 11 JSON templates, DEFINITIVE-ARCHITECTURE.md (680 lines)

### Phase 2: Runtime Engine
**Status:** Complete
**Goal:** Build enforcement runtime modules: bodyguard, spine, enforcer, context-warden, circuit-breaker.
**Summary:** 12 engine modules in src/enforcement/

### Phase 3: Adapter Layer (Codex)
**Status:** Complete
**Goal:** Build universal adapter interfaces and Codex CLI translator with permissions and factory.
**Summary:** types.ts, codex/adapter.ts, permissions.ts, factory.ts — 6/6 tests passing

### Phase 4: Skills + Glue + Enforcement
**Status:** Complete
**Goal:** Build skill selection, validation, prompt assembly, and output normalization modules.
**Summary:** selector, validator, verify-sandbox, assemble-prompt, normalizer — 9 files

### Phase 5: Step Scheduler 10-Step Wiring
**Status:** Complete
**Goal:** Wire the full 10-step enforcement flow into step-scheduler's executeStep() and register executors.
**Summary:** Full enforcement flow in executeStep(), 3 executors registered — 83/83 tests

### Phase 6: P0/P1 Fix Pass
**Status:** Complete
**Goal:** Fix all critical issues from code review: agent-based skill selector, timeout budget, DAG progress.
**Summary:** All P0 fixed, agent-based skill selector, timeout/DAG wiring — 95/100 score

### Phase 7: Claude Code Translator
**Status:** Complete
**Goal:** Build `src/adapters/claude/adapter.ts` — spawn `claude` as child process with YAML frontmatter, tool name translation, output parsing. Expand permissions.ts COMPATIBILITY from 17 to 28 skills per DISSECTION spec.
**Summary:** Claude adapter (433 lines) + frontmatter (105 lines) + factory registration + 29-skill COMPATIBILITY map + 8/8 tests passing

### Phase 8: Integration Test
**Status:** Complete
**Goal:** Prove Conductor classifies -> Scheduler creates DAG -> Executor spawns CLI -> Enforcement runs at each step.
**Summary:** Full pipeline integration test (23 tests), GAP-003/006 resolved

### Phase 9: Circuit Breaker Escalation
**Status:** Complete
**Goal:** Wire retry -> warn user -> stop DAG flow from HARDCODED-ENFORCEMENT-VALUES.md.
**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md — Backend: CIRCUIT_BREAKER constants, confidence-aware circuit breaker, IPC wiring fixes
- [x] 09-02-PLAN.md — Frontend: CircuitBreakerModal component, global.d.ts types, App.tsx wiring

**Summary:** Confidence-aware circuit breaker + CircuitBreakerModal + IPC pipeline wired end-to-end

### Phase 10: E2E Testing & Production Readiness
**Status:** Complete
**Goal:** Final validation before production deployment. Close GAP-005, prove enforcement pipeline works end-to-end, verify production readiness.
**Plans:** 3 plans

Plans:
- [x] 10-01-PLAN.md — E2E test infrastructure + 10 dispatch tests (DOM injection, rate limit, adapter dispatch, error recovery)
- [x] 10-02-PLAN.md — Compatibility matrix validation (4 checks) + production readiness script (13 checks)
- [x] 10-03-PLAN.md — Production readiness checklist document (16 criteria) + GAP-005 closure + human verification

**Summary:** 10 E2E tests, 4 compatibility checks, 13-check production readiness script, 16-point checklist -- all passing. GAP-005 RESOLVED. 480+ total tests. Milestone v1.0 COMPLETE.

---

## Milestone: v2.0 — Progress Monitor Architecture

> **PARADIGM SHIFT:** V2 replaces "chat mirror" with "progress monitor". User sees progress + output files, never LLM interface. See `.planning/architecture/v2-progress-monitor/INDEX.md` for full spec.

### Phase 11: Classification Layer
**Status:** Complete
**Goal:** Build project type classifier and capability registry. Foundation for intelligent routing.
**Summary:** 4 files (~580 lines), local-classifier.ts, 29 unit tests passing. Commit: de1b44e

### Phase 12: File-Based Progress Monitor
**Status:** Planning Complete
**Goal:** Replace chat mirror with file-based transposition. User sees progress tree + output files, never LLM interface.
**Plans:** 6 plans in 3 waves
**Requirements:** [PM-01, PM-02, PM-03, PM-04, PM-05, PM-06, PM-07, PM-08, PM-09, PM-10, PM-11, PM-12]

Plans:
- [ ] 12-01-PLAN.md — Backend: project-scaffold.ts + transposer.ts (Wave 1)
- [ ] 12-02-PLAN.md — Backend: file-bridge.ts + global.d.ts IPC types (Wave 1)
- [ ] 12-03-PLAN.md — Frontend: HomeScreen, ProgressScreen, CompleteScreen (Wave 2)
- [ ] 12-04-PLAN.md — Frontend: ActionOverlay + events.ts file writing (Wave 2)
- [ ] 12-05-PLAN.md — Wiring: App.tsx routing + preload.ts + index.ts FileBridge (Wave 3)
- [ ] 12-06-PLAN.md — Cleanup: Delete ChatInterface, ProfilePicker, ProviderScreen (Wave 3)

**Wave Structure:**

| Wave | Plans | Files | Description |
|------|-------|-------|-------------|
| 1 | 12-01, 12-02 | 4 new files | Foundation: scaffolding, translation, file watching |
| 2 | 12-03, 12-04 | 4 new files | Screens and overlays |
| 3 | 12-05, 12-06 | 3 modified, 3 deleted | Integration and cleanup |

**The Paradigm:**
- Agents write to `~/.kenoki_projects/{id}/` (hidden)
- File watcher copies to `~/Documents/Kenoki/{name}/` (visible)
- Frontend subscribes to file changes, displays progress
- User never sees ChatGPT, CLI terminals, or token counts

**Success Criteria:**
- [ ] User types prompt → build starts
- [ ] User sees progress tree, not LLM output
- [ ] Files appear in `~/Documents/Kenoki/`
- [ ] Action overlays work (MCP, decisions)
- [ ] Complete screen shows working links
- [ ] User NEVER sees ChatGPT interface
- [ ] User NEVER sees terminal windows
- [ ] Build compiles clean
- [ ] Existing enforcement pipeline unchanged

**Spec Reference:** `.planning/architecture/v2-progress-monitor/`
- `INDEX.md` — Quick links, summary, success criteria
- `OVERVIEW.md` — Paradigm shift, 4 screens, two file worlds
- `MIGRATION.md` — What stays/dies, migration steps
- `VARIABLES.md` — All {{placeholders}}, JSON schemas, data flows

---

## Phase Timing Estimates

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 11: Classification | 2-3 hours | Complete |
| Phase 12: Progress Monitor | 4-6 hours | Planning Complete |

**Total Remaining:** 4-6 hours

---

## Milestone v1.0: COMPLETE

All 10 phases complete. 480+ tests passing. 6/6 known gaps resolved. 16/16 production readiness criteria PASS. Universal CLI Adapter is production-ready.
