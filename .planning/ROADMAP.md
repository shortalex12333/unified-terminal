# Unified Terminal — Roadmap

## Milestone: v1.0 — Production-Ready Enforcement Pipeline

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

## Milestone v1.0: COMPLETE

All 10 phases complete. 480+ tests passing. 6/6 known gaps resolved. 16/16 production readiness criteria PASS. Universal CLI Adapter is production-ready.
