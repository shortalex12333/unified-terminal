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

## Milestone: v2.0 — Primary Input Architecture

### Phase 11: Classification Layer
**Status:** Not Started
**Goal:** Build project type classifier and capability registry. Foundation for intelligent routing.

**Deliverables:**
- `src/main/classification/types.ts` — Type definitions (~80 lines)
- `src/main/classification/capability-registry.ts` — Hardcoded mapping (~150 lines)
- `src/main/classification/project-classifier.ts` — Cheap Codex agent (~120 lines)
- `src/main/classification/index.ts` — Barrel exports (~10 lines)
- Unit tests for classifier and registry

**Requirements Covered:** R2, R3

### Phase 12: Brief System
**Status:** Not Started
**Goal:** Build template-driven brief generation with targeted questions and hard validation.

**Deliverables:**
- `src/main/brief/types.ts` — Brief interfaces (~100 lines)
- `src/main/brief/templates/*.ts` — Templates for site, app, ecom, existing (~310 lines)
- `src/main/brief/brief-generator.ts` — Creates brief from intent (~80 lines)
- `src/main/brief/brief-agent.ts` — Asks targeted questions (~150 lines)
- `src/main/brief/brief-validator.ts` — Hard rail validation (~100 lines)
- `src/main/brief/index.ts` — Barrel exports (~15 lines)
- Unit tests for templates, agent, validator

**Requirements Covered:** R4, R5, R6

### Phase 13: Entry Router & Orchestration
**Status:** Not Started
**Goal:** Route user choice to correct flow. Connect classification → brief → conductor.

**Deliverables:**
- `src/main/orchestration/entry-router.ts` — Flow routing logic (~80 lines)
- `src/main/orchestration/index.ts` — Barrel exports (~10 lines)
- MCP checker integration with mcp-manager.ts
- IPC handlers for entry routing

**Requirements Covered:** R7, R8

### Phase 14: UI Components
**Status:** Not Started
**Goal:** Build React components for primary input flow.

**Deliverables:**
- `src/renderer/components/PrimaryInput.tsx` — Main entry screen (~200 lines)
- `src/renderer/components/ProjectTypeCard.tsx` — Visual card (~80 lines)
- `src/renderer/components/BriefQuestionnaire.tsx` — Q&A UI (~250 lines)
- `src/renderer/components/MCPConnectionPrompt.tsx` — MCP modal (~120 lines)
- App.tsx modifications for new routing
- global.d.ts updates for new IPC types

**Requirements Covered:** R10

### Phase 15: Conductor Refactor
**Status:** Not Started
**Goal:** Refactor Conductor to receive complete briefs, not raw messages.

**Deliverables:**
- Remove `classify()` method from conductor.ts
- Add `planFromBrief(brief, capabilities)` method
- Update planning prompt to use full brief JSON
- Integration tests proving brief → DAG flow

**Requirements Covered:** R9

### Phase 16: Integration & Migration
**Status:** Not Started
**Goal:** Wire all components together, feature flag, end-to-end testing.

**Deliverables:**
- Feature flag (`USE_NEW_FLOW`) implementation
- Full IPC wiring in index.ts
- End-to-end tests for all 4 entry paths
- Deprecation markers on send-interceptor.ts, fast-path.ts
- Migration documentation

**Requirements Covered:** R11, R12

---

## Phase Timing Estimates

| Phase | Effort | Cumulative |
|-------|--------|------------|
| Phase 11: Classification | 2-3 hours | 2-3 hours |
| Phase 12: Brief System | 3-4 hours | 5-7 hours |
| Phase 13: Entry Router | 1-2 hours | 6-9 hours |
| Phase 14: UI Components | 3-4 hours | 9-13 hours |
| Phase 15: Conductor Refactor | 1-2 hours | 10-15 hours |
| Phase 16: Integration | 2-3 hours | 12-18 hours |

**Total Estimate:** 12-18 hours

---

## Milestone v1.0: COMPLETE

All 10 phases complete. 480+ tests passing. 6/6 known gaps resolved. 16/16 production readiness criteria PASS. Universal CLI Adapter is production-ready.
