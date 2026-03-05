# Status Agent Implementation Status

**Last Updated:** 2026-03-04
**Status:** Core handlers wired and functional

---

## Overview

The Status Agent is the **user-facing translation layer** in the Unified Terminal Electron app. It sits between backend processes (conductor, scheduler, workers) and the frontend UI (React overlay with progress tree).

```
┌─────────────────────────────────────────────────────────┐
│                    USER (Electron Window)                │
│  ┌─────────────────────────────────────────────────────┐│
│  │     React Overlay (ProgressTree, TopBarPill)        ││
│  │     - Shows progress                                ││
│  │     - Accepts user input (queries, corrections)     ││
│  │     - Stop buttons                                  ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────┘
                           │ IPC (bidirectional)
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    STATUS AGENT                          │
│                                                          │
│  JOB 1: TRANSLATOR    JOB 2: QUERY      JOB 3: INTERRUPT │
│  Event → StatusLine   User answer →     User correction →│
│  (lookup table)       route to agent    classify & route │
└──────────────────────────┬──────────────────────────────┘
                           │ systemEvents bus
                           ▼
┌─────────────────────────────────────────────────────────┐
│     BACKEND (Conductor, Scheduler, Workers, etc.)        │
└─────────────────────────────────────────────────────────┘
```

---

## What Each Job Does

### Job 1: Translator
Converts backend events into human-readable status lines.
- **Input:** `StatusEvent` (e.g., `scheduler:step-start`)
- **Output:** `StatusLine` with friendly text (e.g., "Setting up project...")
- **Method:** Pure lookup table, NO LLM calls

### Job 2: Query Router
Routes user answers to questions back to the correct agent.
- **Input:** User clicks a button answering a question
- **Output:** PA envelope routed to the specific agent that asked
- **Key insight:** Answers go to ONE agent, not broadcast to all

### Job 3: Interrupt Classifier & Dispatcher
Routes user corrections mid-execution to the right agent(s).
- **Input:** User types "make it blue instead" while building
- **Output:** Correction delivered to the image-generation agent, others continue unaware
- **Method:** Keyword classification (NO LLM), surgical routing

---

## Implementation Status

### Completed (2026-03-04)

| Component | File | Status |
|-----------|------|--------|
| Event translation | `translator.ts` | ✅ Complete |
| Query creation | `query.ts` | ✅ Complete |
| Query response routing | `query.ts` + `index.ts` | ✅ Wired |
| Interrupt classification | `interrupt-classifier.ts` | ✅ Complete |
| Interrupt dispatch | `interrupt-dispatch.ts` | ✅ Complete |
| Correction handling | `index.ts:handleCorrection()` | ✅ Wired |
| Stop step | `index.ts:handleStopStep()` | ✅ Wired |
| Stop all | `index.ts:handleStopAll()` | ✅ Wired |
| IPC senders | `ipc.ts` | ✅ Complete |
| IPC handlers | `handlers.ts` | ✅ Complete |
| Preload bridge | `preload-additions.ts` | ✅ Complete |
| Voice rules | `voice.ts` | ✅ Complete |
| TopBarPill elapsed time | `AppShell.tsx` | ✅ Added |

### Handler Wiring Details

These four handlers were previously stubs. Now wired:

```typescript
// 1. handleQueryResponse() - Routes user answers
handleQueryResponse(queryId, value) {
  const query = this.state.queries.get(queryId);
  const envelope = routeQueryResponse(queryId, value, query);
  emitEvent('pa', 'query-response-routed', envelope);
  this.state.queries.delete(queryId);
}

// 2. handleCorrection() - Classifies and dispatches corrections
handleCorrection(text) {
  if (isUrgentStop(text)) {
    this.handleStopAll();
    return;
  }
  const classification = classifyInterrupt(text, runningAgents);
  if (classification.needsLLM) {
    emitEvent('conductor', 'resolve-correction', { text, classification });
  } else {
    const validated = validateInterrupt(classification, runningAgents);
    const actions = dispatchInterrupt(validated, text);
    // Route to affected agents, send ack to UI
  }
}

// 3. handleStopStep() - Stops one specific step
handleStopStep(stepId) {
  emitEvent('scheduler', 'stop-step', { stepId });
}

// 4. handleStopAll() - Emergency stop all execution
handleStopAll() {
  emitEvent('scheduler', 'stop-all', {});
}
```

### IPC Channel Naming

All channels now use consistent `status:` prefix:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `status:line` | Main → Renderer | New status line |
| `status:line-update` | Main → Renderer | Update existing line |
| `status:tree-node` | Main → Renderer | Tree node update |
| `status:query` | Main → Renderer | User question |
| `status:query-timeout` | Main → Renderer | Query timed out |
| `status:fuel-update` | Main → Renderer | Fuel gauge update |
| `status:interrupt-ack` | Main → Renderer | Interrupt acknowledged |
| `status:error` | Main → Renderer | Error notification |
| `user:query-response` | Renderer → Main | User answered query |
| `user:correction` | Renderer → Main | User typed correction |
| `user:stop-step` | Renderer → Main | Stop one step |
| `user:stop-all` | Renderer → Main | Emergency stop |

---

## File Structure

```
src/status-agent/
├── index.ts              # Main orchestrator (StatusAgentManager)
├── types.ts              # Type definitions
├── translator.ts         # Event → StatusLine translation (Job 1)
├── voice.ts              # Brand voice rules
├── query.ts              # Query creation & routing (Job 2)
├── interrupt-classifier.ts  # Keyword classification (Job 3, Part 1)
├── interrupt-dispatch.ts    # Route to agents (Job 3, Part 2)
├── ipc.ts                # Main → Renderer IPC senders
├── handlers.ts           # Renderer → Main IPC handlers
└── preload-additions.ts  # Preload bridge for renderer
```

---

## Event Flow Examples

### Example 1: User Answers a Question

```
1. Backend asks: "Deploy now?"
   → conductor emits 'pa:query-sent'
   → StatusAgent creates UserQuery, sends via IPC

2. User clicks "Deploy now" button
   → Renderer sends 'user:query-response'
   → handleQueryResponse() called

3. Response routed
   → routeQueryResponse() creates PA envelope
   → Envelope emitted to 'pa:query-response-routed'
   → Original agent receives answer
```

### Example 2: User Types a Correction

```
1. User types "make the logo bigger"
   → Renderer sends 'user:correction'
   → handleCorrection() called

2. Classification
   → classifyInterrupt() scans for keywords
   → "logo" matches IMAGE_GEN category
   → confidence: high (if image agent is running)

3. Dispatch
   → validateInterrupt() resolves to image-gen agent
   → dispatchInterrupt() creates actions
   → Only image-gen agent receives correction
   → Other agents continue unaware

4. Acknowledgement
   → sendInterruptAck() tells UI "Updating image-gen..."
```

### Example 3: Emergency Stop

```
1. User clicks STOP ALL button
   → Renderer sends 'user:stop-all'
   → handleStopAll() called

2. Event emitted
   → emitEvent('scheduler', 'stop-all', {})
   → Scheduler receives event, halts all steps
```

---

## Remaining Work

| Item | Priority | Notes |
|------|----------|-------|
| Wire `getRunningAgents()` to scheduler state | Medium | Currently returns empty array |
| Add elapsed time calculation to TopBarPill caller | Low | Prop exists, needs state |
| Test with real backend events | High | Manual verification needed |

---

## Related Documentation

- `STATUS-AGENT-SPEC.md` - Full specification
- `UX_TREE/APP-SHELL-OVERLAY-SPEC.md` - UI component specs
- `summary.md` - Architecture topology diagram
- `QUICKSTART_README.md` - Quick reference
