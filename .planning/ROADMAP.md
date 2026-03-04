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
**Status:** Planned
**Goal:** Prove Conductor classifies → Scheduler creates DAG → Executor spawns CLI → Enforcement runs at each step.

**Key Deliverables:**
- `tests/integration/conductor-scheduler-executor.test.ts`
- Mock Codex responses for classification
- Verify 10-step enforcement flow fires in order
- Verify pre/post spine comparison detects changes

**Acceptance Criteria:**
1. Mock message classified correctly by Conductor
2. DAG steps execute in dependency order
3. Pre-gate bodyguard runs before execution
4. Post-gate bodyguard runs after execution
5. Circuit breaker triggers on repeated failures

### Phase 9: Circuit Breaker Escalation
**Status:** Planned
**Goal:** Wire retry → warn user → stop DAG flow from HARDCODED-ENFORCEMENT-VALUES.md.

**Key Deliverables:**
- Update step-scheduler circuit breaker with user escalation
- IPC handler for user decision (continue/abort)
- Renderer UI for circuit breaker notification

**Acceptance Criteria:**
1. After N consecutive failures, scheduler pauses and asks user
2. User can choose: retry, skip step, abort DAG
3. Decision propagates correctly through scheduler

### Phase 10: E2E Testing & Production Readiness
**Status:** Planned
**Goal:** Final validation before production deployment.

**Source of Truth:** `docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md`

**Key Deliverables:**
- 10 Playwright + Electron E2E tests
- Production readiness verification script
- Compatibility matrix validation
- 16-point checklist document

**Acceptance Criteria:**
1. All 10 E2E tests pass
2. Production readiness script exits 0
3. Compatibility checks pass 5/5
4. 335+ total tests passing
