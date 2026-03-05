# Instance 6: Final Integration Wiring

> **Date:** 2026-03-04
> **Purpose:** Wire remaining event emissions and scheduler state to complete frontend visibility pipeline.

---

## Gap Analysis (Pre-Work Assessment)

### Already Built (Instance 1-5)

| Component | Status | Files |
|-----------|--------|-------|
| Event Bus | ✅ Complete | `src/main/events.ts` |
| Status Agent | ✅ Complete | `src/status-agent/` (9 files) |
| React Hook | ✅ Complete | `src/renderer/hooks/useStatusAgent.ts` |
| ProgressTree | ✅ Complete | `src/renderer/components/ProgressTree.tsx` |
| AppShell | ✅ Complete | `src/renderer/components/AppShell.tsx` |
| FuelGauge | ✅ Complete | Inline in AppShell.tsx (lines 156-206) |
| Conductor events | ✅ Wired | `conductorEvents.*` in conductor.ts |
| Scheduler events | ✅ Wired | `schedulerEvents.*` in step-scheduler.ts |
| Worker events | ✅ Wired | `workerEvents.*` in cli-executor.ts |

### Remaining Gaps

| File | Line | Issue | Fix Required |
|------|------|-------|--------------|
| `src/status-agent/index.ts` | 547-551 | `getRunningAgents()` returns `[]` | Wire to scheduler `runningSteps` |
| `src/main/executors/web-executor.ts` | N/A | No `imageGenEvents` emissions | Add image-gen event lifecycle |
| `src/main/rate-limit-recovery.ts` | N/A | No `rateLimitEvents` emissions | Add rate-limit event lifecycle |
| `src/main/executors/service-executor.ts` | N/A | No `deployEvents` emissions | Add deploy event lifecycle |

---

## Changes Made

### 1. Wire `getRunningAgents()` to Scheduler State

**Files Modified:**
- `src/status-agent/types.ts` - Added `runningAgents` field to StatusAgentState
- `src/status-agent/index.ts` - Added tracking logic

**Changes:**
1. Added `runningAgents: Map<number, RunningAgent>` to state
2. Added `updateRunningAgentsFromEvent()` method to handle scheduler events
3. Added `categorizeAction()` method to map action types to interrupt categories
4. Updated `getRunningAgents()` to return from state map

**Before:**
```typescript
private getRunningAgents(): RunningAgent[] {
  // TODO: Wire to actual scheduler state
  return [];
}
```

**After:**
```typescript
private getRunningAgents(): RunningAgent[] {
  return Array.from(this.state.runningAgents.values());
}
```

**Reason:** Interrupt dispatch needs to know which agents are running to route corrections.

---

### 2. Add Image Generation Events to Web Executor

**File:** `src/main/executors/web-executor.ts`

**Changes:**
- Import `imageGenEvents` from `../events`
- Emit `imageGenEvents.start(prompt)` before DALL-E execution
- Emit `imageGenEvents.progress(percent)` during polling (if calculable)
- Emit `imageGenEvents.complete(url)` on success with first image URL
- Emit `imageGenEvents.error(error)` on failure

**Reason:** Status Agent needs these events to show "Creating your image..." status lines.

---

### 3. Add Rate Limit Events to Recovery Module

**File:** `src/main/rate-limit-recovery.ts`

**Changes:**
- Import `rateLimitEvents` from `./events`
- Emit `rateLimitEvents.hit(provider, retryAfterMs)` when rate limit detected
- Emit `rateLimitEvents.deferred(taskId, resumeAt)` when steps are deferred
- Emit `rateLimitEvents.resumed(taskId)` when steps resume

**Reason:** Status Agent translates these to "Taking a short break..." UX.

---

### 4. Add Deploy Events to Service Executor

**File:** `src/main/executors/service-executor.ts`

**Changes:**
- Import `deployEvents` from `../events`
- Emit `deployEvents.start(target)` when Vercel deploy begins
- Emit `deployEvents.progress(stage, percent)` for deploy stages
- Emit `deployEvents.complete(url)` when deploy finishes with live URL
- Emit `deployEvents.error(error)` on deploy failure

**Reason:** Status Agent shows "Going live..." and final URL in status tree.

---

## Test Verification

| Test | Expected | Actual |
|------|----------|--------|
| TypeScript compilation | No errors | ✅ PASS |
| Build (main + renderer) | Success | ✅ PASS |
| Integration check | All components operational | ✅ PASS |
| DALL-E step shows "Creating your image..." | Status line appears | Pending manual test |
| Rate limit shows "Taking a short break..." | Status line appears | Pending manual test |
| Deploy shows "Going live..." | Status line appears | Pending manual test |
| Interrupt routes to correct agent | `affected` array populated | Pending manual test |

**Integration Check Results:**
- Fast-path routing: 8/8 tests passed
- Conductor files: 8 files present
- Test coverage: 253 tests
- IPC handlers: Registered
- Preload API: Exposed

---

## Notes

- `src/enforcement/bodyguard.ts` does not exist yet - bodyguardEvents emissions are future work
- All changes are additive (no existing file structure modified)
- Voice rules and translation map already handle these event types

---

## Rollback

If issues arise, revert the specific file changes. The Status Agent gracefully handles unknown events by returning generic "Working..." status lines.
