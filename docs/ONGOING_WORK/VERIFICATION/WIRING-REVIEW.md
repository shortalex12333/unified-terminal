# Wiring & Integration Review

**Reviewer:** Agent-5 (Wiring)
**Date:** 2026-03-04
**Status:** ISSUES_FOUND

---

## Summary

The Hardcoded Enforcement Engine v1.0 milestone wiring review reveals a **production-ready backend** with correct IPC pipeline and executor registration in the worktree branch (`instance3-instance4-implementation`). However, **critical integration gaps exist on the main branch** where the CircuitBreakerModal component has not been merged and key IPC fixes are missing.

**Key Findings:**
1. Worktree branch has complete circuit breaker wiring with all 10 steps functional
2. Main branch is missing CircuitBreakerModal integration entirely
3. Main branch still has the broken `conductor:user-decision` handler
4. Executor registration is correct in both branches
5. Test mode flag correctly skips BrowserView, auto-updater, and tray

---

## Files Reviewed

| File | Location | Status | Notes |
|------|----------|--------|-------|
| `step-scheduler.ts` | main | PASS | DAG execution, circuit breaker logic, MAX_RETRIES=3 correctly implemented |
| `index.ts` | main | ISSUES | Missing step-needs-user forwarding, broken conductor:user-decision still present |
| `index.ts` | worktree | PASS | Correct IPC wiring, executor registration, --test-mode flag |
| `global.d.ts` | main | PARTIAL | Has StatusAgent types but missing onStepNeedsUser declaration |
| `global.d.ts` | worktree | PASS | Correctly declares onStepNeedsUser and sendStepDecision |
| `App.tsx` | main | ISSUES | No CircuitBreakerModal component rendered |
| `App.tsx` | worktree | PASS | CircuitBreakerModal rendered as overlay (line 32) |
| `CircuitBreakerModal.tsx` | worktree only | PASS | 103 lines, listens for step:needs-user, sends decisions |
| `preload.ts` | main | PASS | onStepNeedsUser and sendStepDecision correctly exposed |

---

## 10-Step Enforcement Flow

Analysis is based on the step-scheduler.ts implementation (main branch) and index.ts wiring (worktree branch).

| Step | Description | Wired | Verified | Notes |
|------|-------------|-------|----------|-------|
| 1. State capture | Plan initialization in `execute()` | YES | YES | Lines 254-273: converts PlanStep to RuntimeStep with status='pending' |
| 2. Skill selection | Executor lookup by target type | YES | YES | Line 432: `this.executors.get(step.target)` |
| 3. Prompt assembly | Step detail passed to executor | YES | YES | Line 462: `executor.execute(step, context)` |
| 4. Pre-gate | canHandle() check | YES | YES | Lines 442-449: validates executor can handle action |
| 5. Execution | Actual step run | YES | YES | Lines 460-476: try/catch with result capture |
| 6. Normalization | Result/error handling | YES | YES | Lines 464-468 (success), 477-516 (failure + retry logic) |
| 7. Post-state | Step status updates | YES | YES | Events emitted: step-start, step-done, step-failed, step-skipped |
| 8. Post-gate | Circuit breaker check | YES | YES | Lines 484-497: MAX_RETRIES check triggers needs_user |
| 9. Skill verification | Re-planning on failure | YES | YES | Lines 595-628: conductor.replan() called on failures |
| 10. State comparison | Summary building | YES | YES | Lines 283-302: PlanExecutionResult with summary counts |

**Assessment:** All 10 steps of the enforcement flow are correctly implemented in step-scheduler.ts.

---

## Executor Registration

### Worktree Branch (Correct)

Location: `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/main/index.ts` lines 782-810

```typescript
scheduler.registerExecutor('cli', {
  execute: async (step, context) => cliExecutor.execute({...}),
  canHandle: (step) => step.target === 'cli',
});

scheduler.registerExecutor('service', {
  execute: async (step) => serviceExecutor.execute({...}),
  canHandle: (step) => step.target === 'service',
});

// WebExecutor registered lazily when chatGPTView is available
if (chatGPTView) {
  scheduler.registerExecutor('web', {...});
}
```

| Executor | Target | Registered | MainWindow Set | Notes |
|----------|--------|------------|----------------|-------|
| cli | 'cli' | YES | N/A | Uses cliExecutor singleton |
| service | 'service' | YES | YES (L780) | `serviceExecutor.setMainWindow(mainWindow!)` |
| web | 'web' | CONDITIONAL | N/A | Only when chatGPTView exists |

**Assessment:** Executor registration is correct. The lazy web executor registration is intentional because chatGPTView is null at startup until a provider is selected.

### Main Branch

The main branch has only basic conductor initialization without the executor registration block. This code needs to be merged.

---

## IPC Pipeline

### Complete Pipeline (Worktree Branch)

```
MAIN PROCESS                                          RENDERER
=============                                         ========

step-scheduler.ts
  |
  ├── this.emit('step-needs-user', options)
  |       |
  |       v
  |   setupConductorIPC() [index.ts L1909-1912]
  |       |
  |       ├── scheduler.on('step-needs-user', ...)
  |       |
  |       └── mainWindow.webContents.send('step:needs-user', options)
  |                   |
  |                   v
  |               preload.ts [L646-662]
  |                   |
  |                   └── ipcRenderer.on('step:needs-user', handler)
  |                               |
  |                               v
  |                       window.electronAPI.onStepNeedsUser(callback)
  |                               |
  |                               v
  |                       CircuitBreakerModal.tsx [L29-40]
  |                               |
  |                               └── setState({visible: true, ...})
  |                                           |
  |                                           v
  |                                       User clicks button
  |                                           |
  |                                           v
  |                       handleDecision() calls sendStepDecision()
  |                               |
  |                               v
  |               preload.ts [L667-669]
  |                   |
  |                   └── ipcRenderer.invoke('step:user-decision', stepId, decision)
  |                               |
  v                               v
step-scheduler.ts [L671-686]
  |
  └── ipcMain.handle('step:user-decision', ...)
          |
          └── this.userDecisionResolver(decision)  // Resolves Promise
```

### Pipeline Gaps (Main Branch)

| Gap | Location | Impact |
|-----|----------|--------|
| Missing step-needs-user forwarding | setupConductorIPC() | Renderer never receives circuit breaker events |
| Broken conductor:user-decision | index.ts L2002-2013 | Sends decision back to renderer instead of main process |
| No CircuitBreakerModal | App.tsx | No UI for user decisions |
| Missing IPC type declarations | global.d.ts | TypeScript errors if modal added |

---

## Issues Found

### Critical

1. **Main branch missing CircuitBreakerModal integration**
   - File: `/Users/celeste7/Documents/unified-terminal/src/renderer/components/App.tsx`
   - The main branch App.tsx (103 lines) does not import or render CircuitBreakerModal
   - The worktree App.tsx (35 lines) correctly renders `<CircuitBreakerModal />` as overlay

2. **Main branch has broken conductor:user-decision handler**
   - File: `/Users/celeste7/Documents/unified-terminal/src/main/index.ts` lines 2002-2013
   - The handler uses `mainWindow.webContents.send('step:user-decision', ...)` which sends the decision BACK to the renderer instead of resolving the scheduler's internal Promise
   - The worktree branch correctly removed this handler (see comment at L2031-2035)

3. **Main branch missing step-needs-user forwarding in setupConductorIPC()**
   - File: `/Users/celeste7/Documents/unified-terminal/src/main/index.ts`
   - The worktree adds `scheduler.on('step-needs-user', ...)` at L1909-1912
   - Without this, the renderer never receives circuit breaker events

### Major

4. **Main branch global.d.ts missing circuit breaker IPC declarations**
   - File: `/Users/celeste7/Documents/unified-terminal/src/renderer/global.d.ts`
   - Missing: `onStepNeedsUser` and `sendStepDecision` on ElectronAPI interface
   - The worktree global.d.ts correctly declares these at L122-130

5. **WebExecutor registration is conditional and potentially fragile**
   - At app startup, `chatGPTView` is null until user selects a provider
   - The web executor is only registered if chatGPTView exists at init time
   - Any plan requiring web steps before a provider is selected will fail
   - Recommendation: Register with a lazy executor wrapper that waits for chatGPTView

### Minor

6. **Main branch App.tsx diverged significantly from worktree**
   - Main: 103 lines with StartingScreen, ProviderState, TerminalUI
   - Worktree: 35 lines with simpler flow (ProfilePicker -> ChatInterface)
   - This is a design divergence, not a bug, but will complicate merging

---

## Known Flaw Verification

| Flaw | Confirmed | Details |
|------|-----------|---------|
| "The broken conductor:user-decision IPC handler was removed" | PARTIALLY | Removed in WORKTREE (L2031 comment). Still PRESENT in main branch (L2002-2013). |
| "CircuitBreakerModal never tested in running Electron" | CONFIRMED | The modal exists in worktree but requires manual E2E testing. No Playwright tests exercise the actual modal display and button clicks. Tests mock the IPC events. |
| "--test-mode flag skips BrowserView, auto-updater, tray" | CONFIRMED | Lines 170-184 in worktree index.ts: `export const isTestMode = process.argv.includes('--test-mode');` and conditional logic throughout. |

---

## Test Mode Flag Behavior

Location: `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/main/index.ts`

```typescript
// Lines 170-184
export const isTestMode = process.argv.includes('--test-mode');

if (isTestMode) {
  console.log('[App] Running in TEST MODE -- skipping ChatGPT, updater, tray');
}
```

**What --test-mode skips:**
1. ChatGPT BrowserView creation (no real login needed)
2. Auto-updater initialization
3. Tray icon creation

**E2E test usage:**
- `tests/e2e/fixtures.ts` line 34: `args: [path.join(projectRoot, 'dist/main/index.js'), '--test-mode']`

**Assessment:** Test mode is correctly implemented and documented.

---

## Recommendations

### Immediate Actions (Before v1.0 Release)

1. **Merge worktree IPC fixes to main branch**
   - Add step-needs-user forwarding to setupConductorIPC()
   - Remove or fix the broken conductor:user-decision handler
   - Add CircuitBreakerOptions import

2. **Merge CircuitBreakerModal component to main branch**
   - Copy CircuitBreakerModal.tsx to main
   - Import and render in App.tsx
   - Update global.d.ts with type declarations

3. **Add E2E test for CircuitBreakerModal**
   - Test that modal appears when step-needs-user fires
   - Test all three buttons (retry, skip, stop)
   - Verify decision reaches scheduler

### Future Improvements

4. **Make WebExecutor registration lazy/dynamic**
   - Create executor wrapper that queues requests until chatGPTView available
   - Or register a placeholder executor that errors clearly

5. **Reconcile App.tsx divergence**
   - Decide which flow is correct (103-line vs 35-line)
   - Document the decision
   - Merge or explicitly deprecate one version

6. **Add integration test for full circuit breaker flow**
   - Not just mocked IPC, but actual Electron app with simulated failures

---

## Checklist

- [x] All 10 steps wired (in step-scheduler.ts)
- [x] Executors registered correctly (in worktree, 3 executors)
- [x] IPC pipeline complete (in worktree only)
- [ ] Circuit breaker integrated (worktree only, main branch missing)
- [x] Test mode works (worktree, skips expected components)
- [ ] Main branch matches worktree wiring (DIVERGED - needs merge)

---

## Appendix: File Locations

| File | Main Branch | Worktree |
|------|-------------|----------|
| step-scheduler.ts | `/Users/celeste7/Documents/unified-terminal/src/main/step-scheduler.ts` | Same |
| index.ts | `/Users/celeste7/Documents/unified-terminal/src/main/index.ts` | `.claude/worktrees/instance3-instance4-implementation/src/main/index.ts` |
| CircuitBreakerModal.tsx | NOT EXISTS | `.claude/worktrees/instance3-instance4-implementation/src/renderer/components/CircuitBreakerModal.tsx` |
| App.tsx | `/Users/celeste7/Documents/unified-terminal/src/renderer/components/App.tsx` | Worktree has different version |
| global.d.ts | `/Users/celeste7/Documents/unified-terminal/src/renderer/global.d.ts` | Worktree has extended version |
| preload.ts | `/Users/celeste7/Documents/unified-terminal/src/main/preload.ts` | Same |
