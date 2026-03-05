# Phase 9: Circuit Breaker Escalation - Research

**Researched:** 2026-03-04
**Domain:** Electron IPC wiring, circuit breaker pattern, user escalation UI
**Confidence:** HIGH

## Summary

Phase 9 addresses GAP-004: "Circuit breaker user escalation not wired." The backend circuit breaker logic in `step-scheduler.ts` is **already fully implemented and tested** (83 unit tests + 3 integration tests in Phase 8). The remaining work is narrow: verify the IPC wiring path is complete from main process to renderer, fix a critical bug in the `conductor:user-decision` IPC handler (it forwards to the wrong channel), integrate HARDCODED-ENFORCEMENT-VALUES.md section 4 constants (definitive vs heuristic check distinction), and build a minimal renderer notification component for the circuit breaker prompt.

The scope is smaller than it appears because the hardest parts (circuit breaker logic, retry/exponential backoff, DAG interruption, user decision handling, event emission, timeout with default) are all implemented. What remains is "last mile" wiring: ensuring the renderer receives the `step:needs-user` event, displays a decision prompt, and sends the decision back via `step:user-decision` IPC. The CLAUDE.md explicitly states "ALL FRONTEND WORK (NOT IMPORTANT)" but this is a functional UI requirement (user MUST be able to respond to circuit breaker), not cosmetic UI polish.

**Primary recommendation:** Fix the IPC wiring bug in `conductor:user-decision`, add the missing `step-needs-user` event forwarding in `setupConductorIPC()`, add definitive/heuristic distinction to circuit breaker options, build a minimal modal component, and update `global.d.ts` to declare the new IPC channels.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron IPC | (bundled) | Main-to-renderer communication | Already used throughout the app; `ipcMain.handle` + `webContents.send` pattern |
| React | 18.x | Renderer UI components | Already used in renderer (App.tsx, ProfilePicker.tsx, ChatInterface.tsx) |
| Tailwind CSS | 3.x | Component styling | Already used in renderer (styles.css imports Tailwind) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| EventEmitter | (Node built-in) | Scheduler event forwarding | Already used by StepScheduler |

### Alternatives Considered
None. All technology choices are locked by the existing codebase. No new dependencies needed.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Existing IPC Flow (What Works)
```
StepScheduler (main process)
  │
  ├── emitIPC('step:needs-user', options)  ──> mainWindow.webContents.send()
  │                                               │
  │                                               v
  │                                        preload.ts bridge
  │                                        onStepNeedsUser(callback)
  │                                               │
  │                                               v
  │                                        Renderer React component
  │                                        (DOES NOT EXIST YET)
  │
  └── ipcMain.handle('step:user-decision')  <── ipcRenderer.invoke()
      (internally resolves userDecisionResolver)    sendStepDecision(stepId, decision)
                                                    (EXPOSED IN PRELOAD, NOT CALLED)
```

### Pattern 1: Event-Driven Circuit Breaker with IPC Bridge
**What:** The scheduler emits `step:needs-user` via IPC when circuit breaker triggers. The preload bridge exposes `onStepNeedsUser` listener and `sendStepDecision` sender. The renderer listens, shows modal, sends decision back.
**When to use:** This is the existing pattern. All pieces exist except the renderer component.

### Pattern 2: Dual IPC Channel (Bug Found)
**What:** There are TWO IPC paths for user decisions:
1. `step:user-decision` -- registered inside `StepScheduler.setupIPC()` via `ipcMain.handle()`. This is the CORRECT handler that resolves the internal Promise.
2. `conductor:user-decision` -- registered in `index.ts` which FORWARDS to `mainWindow.webContents.send('step:user-decision', ...)`. This sends the decision BACK to the renderer instead of to the main process handler.

**Bug:** The `conductor:user-decision` handler in index.ts is broken. It does `mainWindow.webContents.send('step:user-decision', ...)` which sends the event to the RENDERER, not to the main process IPC handler. The step-scheduler's `ipcMain.handle('step:user-decision')` expects `ipcRenderer.invoke('step:user-decision', stepId, decision)` from the renderer, which would call the handler directly.

**Resolution:** The preload already exposes `sendStepDecision` which calls `ipcRenderer.invoke('step:user-decision', stepId, decision)` -- this is the correct path. The `conductor:user-decision` handler in index.ts is unnecessary/broken and should either be removed or fixed. The renderer should use `window.electronAPI.sendStepDecision()`.

### Pattern 3: Definitive vs Heuristic Check Distinction
**What:** HARDCODED-ENFORCEMENT-VALUES.md section 4 specifies:
- Definitive failures: options = `["Retry", "Stop build"]` -- NO skip allowed
- Heuristic failures: options = `["Retry", "Skip this check", "Stop build"]`

**Current state:** The scheduler always emits `actions: ['retry', 'skip', 'stop']` regardless of failure type. The bodyguard's `GateResult` has `verdict: 'HARD_FAIL' | 'SOFT_FAIL' | 'PASS'` but the circuit breaker in the catch block doesn't check which type of check failed.

**Impact:** This is an enforcement gap. Definitive check failures (test-exit-code, file-existence, scope-enforcement) should NOT be skippable. The circuit breaker needs to know the check confidence level to filter available actions.

### Recommended Project Structure (Changes Only)
```
src/
├── main/
│   ├── step-scheduler.ts       # MODIFY: Add confidence-aware circuit breaker options
│   └── index.ts                # MODIFY: Fix/remove conductor:user-decision, add step-needs-user forwarding
├── renderer/
│   ├── global.d.ts             # MODIFY: Add circuit breaker types to ElectronAPI
│   └── components/
│       └── CircuitBreakerModal.tsx  # NEW: Modal for user decision prompt
├── enforcement/
│   └── constants.ts            # REFERENCE: CIRCUIT_BREAKER constants to add
```

### Anti-Patterns to Avoid
- **Duplicate IPC channels:** The `conductor:user-decision` and `step:user-decision` duplication creates confusion. Use ONE path: `step:user-decision` via `ipcRenderer.invoke()`.
- **Sending IPC to renderer when you mean main process:** `webContents.send()` sends TO renderer. `ipcRenderer.invoke()` sends TO main. The conductor:user-decision handler confuses these directions.
- **Ignoring check confidence in circuit breaker:** Allowing "skip" for definitive failures violates the enforcement contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IPC communication | Custom message passing | Existing Electron IPC pattern with preload bridge | Already 30+ IPC channels in preload.ts following this exact pattern |
| Event forwarding | Custom pubsub | StepScheduler's EventEmitter + setupConductorIPC() pattern | Already working for step-start, step-done, step-failed, plan-complete |
| Modal overlay | Custom dialog system | Simple React component with Tailwind | CSS-only overlay, no library needed |

**Key insight:** Every piece of infrastructure needed (IPC bridge, preload API, event forwarding) already exists. The work is connecting existing pieces and adding one small React component.

## Common Pitfalls

### Pitfall 1: Confusing IPC Directions
**What goes wrong:** `webContents.send()` sends FROM main TO renderer. `ipcRenderer.invoke()` sends FROM renderer TO main. The existing `conductor:user-decision` handler uses `webContents.send()` to forward a decision, which sends it back to the renderer instead of to the main process handler.
**Why it happens:** IPC direction is easy to confuse when multiple layers are involved.
**How to avoid:** The renderer should call `window.electronAPI.sendStepDecision(stepId, decision)` which uses `ipcRenderer.invoke('step:user-decision', stepId, decision)` -- this goes directly to the `ipcMain.handle('step:user-decision')` in the scheduler.
**Warning signs:** Decision sent but scheduler doesn't receive it; scheduler times out and defaults to 'skip'.

### Pitfall 2: Missing Event Forwarding in setupConductorIPC
**What goes wrong:** The `setupConductorIPC()` function in index.ts forwards `step-start`, `step-done`, `step-failed`, and `plan-complete` events from the scheduler to the renderer. But it does NOT forward `step-needs-user`. Without this, the renderer will never receive circuit breaker notifications.
**Why it happens:** The step-scheduler's `emitIPC('step:needs-user', options)` sends directly via `mainWindow.webContents.send()`, but the scheduler might not have a mainWindow set (it depends on `setMainWindow()` being called).
**How to avoid:** Either (a) ensure `scheduler.setMainWindow(mainWindow)` is called in the app init, OR (b) add `step-needs-user` forwarding in `setupConductorIPC()` like the other events.
**Warning signs:** `step:needs-user` event fires internally but never reaches renderer.

### Pitfall 3: Race Between IPC Registration and Usage
**What goes wrong:** The step-scheduler registers `ipcMain.handle('step:user-decision')` in its constructor. If the scheduler singleton is created after the app tries to invoke that channel, or if the channel is already registered by something else, it will throw.
**Why it happens:** Electron does not allow duplicate `ipcMain.handle()` registrations for the same channel.
**How to avoid:** The scheduler singleton pattern ensures only one registration. Don't register `step:user-decision` anywhere else.
**Warning signs:** "Error: Attempted to register a second handler for 'step:user-decision'" in console.

### Pitfall 4: User Response Timeout Defaulting to Skip for Definitive Failures
**What goes wrong:** If the user doesn't respond within 5 minutes (`USER_RESPONSE_TIMEOUT_MS = 300_000`), the scheduler defaults to `'skip'`. For definitive check failures, this violates the enforcement contract.
**Why it happens:** The timeout handler doesn't distinguish between definitive and heuristic failures.
**How to avoid:** For definitive failures, the timeout should default to `'stop'` instead of `'skip'`. Or the timeout should be longer/disabled for definitive failures.
**Warning signs:** Tests pass then fail intermittently because definitive checks get auto-skipped after timeout.

## Code Examples

Verified patterns from the existing codebase:

### Existing Circuit Breaker Trigger (step-scheduler.ts lines 716-726)
```typescript
// Source: src/main/step-scheduler.ts
if (step.retryCount >= MAX_RETRIES) {
  step.status = 'needs_user';
  this.emit('step-needs-user', {
    step,
    actions: ['retry', 'skip', 'stop'],  // BUG: should be confidence-aware
    suggested: 'skip',
    errorContext: step.error,
  } as CircuitBreakerOptions);
  this.emitProgress(step, 0, 'Needs user decision');
}
```

### Existing IPC Bridge for Circuit Breaker (preload.ts lines 636-658)
```typescript
// Source: src/main/preload.ts
// Listen for circuit breaker events (step needs user decision)
onStepNeedsUser: (callback: (options: {
  step: unknown;
  actions: string[];
  suggested: string;
  errorContext: string;
}) => void): (() => void) => {
  const handler = (_event: IpcRendererEvent, options: { ... }) => callback(options);
  ipcRenderer.on('step:needs-user', handler);
  return () => { ipcRenderer.removeListener('step:needs-user', handler); };
},

// Send user decision for circuit breaker
sendStepDecision: (stepId: number, decision: 'retry' | 'skip' | 'stop'): Promise<boolean> => {
  return ipcRenderer.invoke('step:user-decision', stepId, decision);
},
```

### Existing Event Forwarding Pattern (index.ts setupConductorIPC)
```typescript
// Source: src/main/index.ts setupConductorIPC()
scheduler.on('step-start', (step: RuntimeStep) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('conductor:step-progress', step);
  }
});
// ... same pattern for step-done, step-failed, plan-complete
// MISSING: step-needs-user is NOT forwarded here
```

### HARDCODED-ENFORCEMENT-VALUES.md Section 4 Constants (to implement)
```typescript
// Source: docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/HARDCODED-ENFORCEMENT-VALUES.md
const CIRCUIT_BREAKER = {
  MAX_STEP_RETRIES:        3,
  DEFINITIVE_FAIL_RETRIES: 0,
  HEURISTIC_FAIL_OPTIONS:  ["Retry", "Skip this check", "Stop build"],
  DEFINITIVE_FAIL_OPTIONS: ["Retry", "Stop build"],
};
```

### Minimal React Modal Pattern (to create)
```typescript
// Pattern based on existing Tailwind + React components in this project
// Source: Pattern from ProfilePicker.tsx and ChatInterface.tsx styling
interface CircuitBreakerModalProps {
  visible: boolean;
  stepId: number;
  stepDetail: string;
  errorContext: string;
  actions: ('retry' | 'skip' | 'stop')[];
  suggested: 'retry' | 'skip' | 'stop';
  onDecision: (decision: 'retry' | 'skip' | 'stop') => void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silent retry forever | Circuit breaker after MAX_RETRIES=3 | Phase 2 (step-scheduler) | User gets control |
| All failures skippable | Definitive vs heuristic distinction | HARDCODED-ENFORCEMENT-VALUES.md | NOT YET IMPLEMENTED in code |
| No user notification | IPC event to renderer | Phase 2 (preload bridge) | Bridge exists, renderer component missing |

## Detailed Gap Analysis

### What EXISTS and is WORKING (HIGH confidence)
| Component | File | Evidence |
|-----------|------|----------|
| Circuit breaker logic | step-scheduler.ts L716-726 | 83 unit tests, 3 integration tests |
| `step-needs-user` event emission | step-scheduler.ts L720-726 | Emits CircuitBreakerOptions with step, actions, suggested |
| `step:user-decision` IPC handler | step-scheduler.ts L897-912 | Resolves userDecisionResolver Promise |
| User decision handling (retry/skip/stop) | step-scheduler.ts L783-811 | All 3 paths tested in integration tests |
| 5-minute timeout with default | step-scheduler.ts L770-777 | Defaults to 'skip' |
| Preload bridge: `onStepNeedsUser` | preload.ts L636-652 | Listens for 'step:needs-user' IPC |
| Preload bridge: `sendStepDecision` | preload.ts L657-659 | Invokes 'step:user-decision' IPC |
| Exponential backoff retry | step-scheduler.ts L735-741 | Tested in unit tests |
| Enforcement types for circuit breaker | enforcement/types.ts L238-247 | UserAction, FailureResponse types |
| Integration test coverage | tests/integration/conductor-scheduler-executor.test.ts | Group 4: 3 tests (skip, retry, stop) |

### What is BROKEN (HIGH confidence)
| Issue | Location | Description |
|-------|----------|-------------|
| `conductor:user-decision` sends to wrong target | index.ts L2011-2012 | Uses `webContents.send()` (sends to renderer) instead of resolving the scheduler's internal handler |
| Missing `step-needs-user` forwarding | index.ts setupConductorIPC() | Forwards step-start, step-done, step-failed, plan-complete but NOT step-needs-user |
| No `scheduler.setMainWindow()` call | index.ts app.whenReady() | Scheduler's `emitIPC()` needs mainWindow but `setMainWindow()` is never called |

### What is MISSING (HIGH confidence)
| Component | Description | Effort |
|-----------|-------------|--------|
| CircuitBreakerModal.tsx | React component showing error + decision buttons | Small (50-80 lines) |
| global.d.ts updates | Add `onStepNeedsUser` and `sendStepDecision` to ElectronAPI type | Tiny (10 lines) |
| Definitive/heuristic distinction | Filter circuit breaker actions based on check confidence | Medium |
| CIRCUIT_BREAKER constants | Add to enforcement/constants.ts from HARDCODED-ENFORCEMENT-VALUES.md section 4 | Small |
| Timeout default for definitive failures | Change default from 'skip' to 'stop' for definitive checks | Small |

### What is OUT OF SCOPE
| Item | Reason |
|------|--------|
| Complex UI polish | CLAUDE.md: "ALL FRONTEND WORK NOT IMPORTANT" -- modal must be functional, not beautiful |
| Animations/transitions | Same -- functional only |
| Circuit breaker dashboard/history | Not in acceptance criteria |
| E2E tests | Phase 10 scope (GAP-005) |

## Open Questions

1. **Should `scheduler.setMainWindow()` be called, or should event forwarding use `setupConductorIPC()` exclusively?**
   - What we know: The scheduler has its own `emitIPC()` that sends directly to mainWindow. But `setupConductorIPC()` also forwards scheduler events to the renderer. These are duplicate forwarding paths.
   - What's unclear: Whether both paths should exist or just one.
   - Recommendation: Use `setupConductorIPC()` for ALL event forwarding (consistent with existing pattern) AND call `scheduler.setMainWindow(mainWindow)` to enable the scheduler's internal `emitIPC` (for direct IPC like `step:needs-user`). Both paths work because `webContents.send()` on the same channel just triggers listeners.

2. **Should the definitive/heuristic distinction come from the bodyguard result or from the step-scheduler?**
   - What we know: The bodyguard produces `GateResult` with `verdict: 'HARD_FAIL' | 'SOFT_FAIL'`. The step-scheduler's catch block doesn't currently have access to which checks failed or their confidence level.
   - What's unclear: Whether the circuit breaker should fire based on executor failures (generic catch) or bodyguard gate failures (typed).
   - Recommendation: The current circuit breaker fires on ANY executor throw. Gate HARD_FAIL already returns early (step-scheduler.ts L562, L636) before the catch block. So the catch-block circuit breaker handles executor errors (not bodyguard failures). For a complete implementation, bodyguard HARD_FAIL should also trigger the circuit breaker with definitive options. This may be a Phase 10+ concern; for Phase 9 MVP, the existing catch-block circuit breaker with heuristic options is sufficient, but gate HARD_FAILs should at minimum not offer "skip."

3. **Is the `conductor:user-decision` handler in index.ts used by anything?**
   - What we know: The preload exposes `sendStepDecision` which uses `ipcRenderer.invoke('step:user-decision')` directly. There's also a `conductor:user-decision` handler in index.ts that nobody calls.
   - What's unclear: Whether any future renderer code was planned to use `conductor:user-decision`.
   - Recommendation: Remove it or leave it as dead code. The renderer should use `sendStepDecision()` from preload which goes directly to the scheduler's IPC handler.

## Sources

### Primary (HIGH confidence)
- `src/main/step-scheduler.ts` -- Full circuit breaker implementation, all constants, IPC handlers
- `src/main/preload.ts` -- IPC bridge with onStepNeedsUser and sendStepDecision
- `src/main/index.ts` -- setupConductorIPC(), executor registration, conductor:user-decision handler
- `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/HARDCODED-ENFORCEMENT-VALUES.md` -- Section 4: CIRCUIT_BREAKER constants
- `src/enforcement/types.ts` -- UserAction, FailureResponse types
- `src/enforcement/constants.ts` -- Existing enforcement constants
- `tests/integration/conductor-scheduler-executor.test.ts` -- Test Group 4: Circuit breaker integration tests
- `tests/step-scheduler.test.ts` -- 83 tests including circuit breaker unit tests
- `.planning/STATE.md` -- GAP-004 tracking
- `.planning/ROADMAP.md` -- Phase 9 acceptance criteria

### Secondary (MEDIUM confidence)
- `src/renderer/components/App.tsx` -- Current renderer structure (simple state-based routing)
- `src/renderer/components/ChatInterface.tsx` -- Tailwind styling patterns to match
- `src/renderer/global.d.ts` -- Current ElectronAPI type (missing circuit breaker methods)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All technology already in use, no new dependencies
- Architecture: HIGH -- Every file examined, IPC flow traced end-to-end, bugs identified with line numbers
- Pitfalls: HIGH -- Bugs verified by reading actual code, not hypothetical

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days -- stable codebase, no external dependencies)
