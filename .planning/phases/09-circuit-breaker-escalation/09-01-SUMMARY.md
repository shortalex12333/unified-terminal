---
phase: 09-circuit-breaker-escalation
plan: 01
subsystem: ipc
tags: [electron-ipc, circuit-breaker, enforcement, confidence-aware]

# Dependency graph
requires:
  - phase: 05-step-scheduler-wiring
    provides: "10-step enforcement flow in step-scheduler, CIRCUIT_BREAKER constants in enforcement/constants.ts"
  - phase: 08-integration-test
    provides: "23 integration tests verifying conductor-scheduler-executor pipeline"
provides:
  - "Confidence-aware circuit breaker action filtering (definitive vs heuristic)"
  - "Complete IPC pipeline: scheduler -> setupConductorIPC -> preload -> renderer"
  - "scheduler.setMainWindow() called during app initialization"
  - "Broken conductor:user-decision handler removed"
affects: [09-02-PLAN, renderer-components, circuit-breaker-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Confidence-aware circuit breaker: definitive failures offer retry/stop only, heuristic offer retry/skip/stop"
    - "Timeout defaults to stop for definitive failures, skip for heuristic"

key-files:
  created: []
  modified:
    - src/main/step-scheduler.ts
    - src/main/index.ts

key-decisions:
  - "Definitive failures timeout to 'stop' (not 'skip') to prevent auto-skipping critical checks"
  - "Removed conductor:user-decision handler entirely (Option A) rather than deprecating it"
  - "Both setupConductorIPC forwarding AND scheduler.setMainWindow() enabled for dual IPC path"

patterns-established:
  - "Confidence-aware action filtering: use _lastFailureConfidence on RuntimeStep to determine available actions"
  - "IPC event forwarding pattern: scheduler EventEmitter -> setupConductorIPC() -> mainWindow.webContents.send()"

requirements-completed: [CB-01, CB-02, CB-03]

# Metrics
duration: 7min
completed: 2026-03-04
---

# Phase 9 Plan 01: Circuit Breaker Escalation Summary

**Confidence-aware circuit breaker with definitive/heuristic action filtering and complete IPC pipeline from scheduler to renderer**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T19:49:41Z
- **Completed:** 2026-03-04T19:56:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Circuit breaker now filters actions based on failure confidence: definitive failures (gate HARD_FAILs) offer only retry/stop, heuristic failures (executor errors) offer retry/skip/stop
- Timeout default changed from always-skip to confidence-aware: definitive defaults to 'stop', heuristic defaults to 'skip'
- IPC pipeline completed: step-needs-user event forwarded in setupConductorIPC(), scheduler.setMainWindow() called during app init
- Broken conductor:user-decision handler removed (was sending decision back to renderer instead of resolving scheduler Promise)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CIRCUIT_BREAKER constants and make circuit breaker confidence-aware** - `26d0afa` (feat)
2. **Task 2: Fix IPC wiring -- event forwarding, setMainWindow, remove broken handler** - `c6b0c0a` (fix)

## Files Created/Modified
- `src/main/step-scheduler.ts` - Confidence-aware circuit breaker trigger and askUser method; post-step HARD_FAIL sets _lastFailureConfidence = 'definitive'
- `src/main/index.ts` - Added step-needs-user forwarding, scheduler.setMainWindow() call, removed broken conductor:user-decision handler, imported CircuitBreakerOptions

## Decisions Made
- Used Option A (remove entirely) for the broken conductor:user-decision handler rather than Option B (deprecation wrapper). The preload bridge's sendStepDecision already uses the correct ipcRenderer.invoke path directly to the scheduler's handler.
- Enabled both IPC paths: setupConductorIPC() event forwarding AND scheduler.setMainWindow() for the scheduler's internal emitIPC(). Both paths work because webContents.send() on the same channel triggers all listeners.
- Definitive failure timeout defaults to 'stop' rather than 'skip' to prevent auto-skipping critical enforcement checks (test-exit-code, file-existence, scope-enforcement).

## Deviations from Plan

None -- plan executed exactly as written. The CIRCUIT_BREAKER constants and _lastFailureConfidence field already existed from Phase 5 work; the circuit breaker trigger and askUser methods needed the confidence-aware logic applied.

## Issues Encountered
- Pre-existing test failures (15 of 72 step-scheduler unit tests) caused by the Phase 5 enforcement flow: mock executors in tests lack real project directories and git repos needed by the 10-step flow. These failures are NOT caused by this plan's changes and are documented as a known gap. Integration tests (23/23) pass because they set up proper mock git repos.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IPC pipeline is complete: scheduler -> setupConductorIPC -> preload bridge -> renderer
- Plan 02 (CircuitBreakerModal component) can now proceed: the renderer will receive step:needs-user events with confidence-aware actions
- The preload bridge already exposes onStepNeedsUser() and sendStepDecision() APIs for the renderer component to use

## Self-Check: PASSED

- FOUND: src/main/step-scheduler.ts
- FOUND: src/main/index.ts
- FOUND: .planning/phases/09-circuit-breaker-escalation/09-01-SUMMARY.md
- FOUND: commit 26d0afa (Task 1)
- FOUND: commit c6b0c0a (Task 2)

---
*Phase: 09-circuit-breaker-escalation*
*Completed: 2026-03-04*
