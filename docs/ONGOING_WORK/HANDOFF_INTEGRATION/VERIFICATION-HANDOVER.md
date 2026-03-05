# Verification Handover: Instance 6 Final Integration

> **Prepared:** 2026-03-05
> **For:** Verification Team (first-time system exposure)
> **Scope:** Instance 6 changes + full system topology explanation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Topology Overview](#2-system-topology-overview)
3. [Data Flow: Event → Screen](#3-data-flow-event--screen)
4. [Instance 6 Changes (What Was Modified)](#4-instance-6-changes-what-was-modified)
5. [File-by-File Change Breakdown](#5-file-by-file-change-breakdown)
6. [Verification Checklist](#6-verification-checklist)
7. [Architecture Deep Dive](#7-architecture-deep-dive)
8. [Test Commands](#8-test-commands)
9. [Glossary](#9-glossary)

---

## 1. Executive Summary

### What This System Does

The **Unified Terminal** is an Electron desktop app that provides a unified interface to multiple AI providers (ChatGPT, Claude). Users interact with AI providers via embedded web views, while complex multi-step tasks are routed to CLI tools (Codex CLI, Claude Code) that run in the background.

### What Instance 6 Did

Instance 6 completed the **final integration wiring** between the backend execution pipeline and the frontend visibility system. Specifically:

| Change | Purpose |
|--------|---------|
| Wired `imageGenEvents` in `web-executor.ts` | DALL-E image generation shows "Creating image..." in status tree |
| Wired `rateLimitEvents` in `rate-limit-recovery.ts` | Rate limits show "Taking a short break..." in status tree |
| Wired `deployEvents` in `service-executor.ts` | Vercel deploys show "Going live..." in status tree |
| Wired `getRunningAgents()` in `status-agent/index.ts` | User corrections route to correct running agent |

### Why This Matters

Before Instance 6, certain backend operations happened invisibly. Users would not see:
- When DALL-E was generating an image
- When a rate limit was hit and the system was waiting
- When a Vercel deploy was in progress
- Which agents a user correction should affect

After Instance 6, all these operations are visible in the status tree and corrections route correctly.

---

## 2. System Topology Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ELECTRON APP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     RENDERER PROCESS (React)                          │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐  │   │
│  │  │ ProfilePicker│   │ ChatInterface│   │ AppShell                 │  │   │
│  │  │ (pick AI)    │   │ (messages)   │   │ ┌────────────┐┌────────┐ │  │   │
│  │  └──────────────┘   └──────────────┘   │ │ProgressTree││FuelGauge │ │   │
│  │                                         │ │ (status)   ││(budget)  │ │   │
│  │  ┌──────────────────────────────────┐  │ └────────────┘└────────┘ │  │   │
│  │  │    useStatusAgent Hook           │  └──────────────────────────┘  │   │
│  │  │    (IPC listener + state)        │                                 │   │
│  │  └──────────────────────────────────┘                                 │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                           ▲                                                   │
│                           │ IPC (status:* channels)                          │
│                           ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      MAIN PROCESS (Node.js)                           │   │
│  │                                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │                    STATUS AGENT                                 │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐   │   │   │
│  │  │  │ Translator │  │ IPC Sender │  │ Interrupt Dispatcher   │   │   │   │
│  │  │  │ (event→   │  │ (→renderer)│  │ (corrections→agents)   │   │   │   │
│  │  │  │  status)   │  └────────────┘  └────────────────────────┘   │   │   │
│  │  │  └────────────┘                                                │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                           ▲                                            │   │
│  │                           │ systemEvents (Event Bus)                  │   │
│  │                           │                                            │   │
│  │  ┌────────────────────────┴───────────────────────────────────────┐   │   │
│  │  │                    BACKEND PIPELINE                             │   │   │
│  │  │                                                                  │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐  │   │   │
│  │  │  │ TIER 0: Fast-Path (50ms)                                  │  │   │   │
│  │  │  │ Simple messages bypass Conductor, go direct to ChatGPT    │  │   │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │   │   │
│  │  │                           │                                     │   │   │
│  │  │                           ▼                                     │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐  │   │   │
│  │  │  │ TIER 1: Conductor (Persistent Codex Session)             │  │   │   │
│  │  │  │ Classifies messages → creates execution DAG (plan)       │  │   │   │
│  │  │  │ Emits: conductorEvents.classifyStart/Complete/planReady  │  │   │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │   │   │
│  │  │                           │                                     │   │   │
│  │  │                           ▼                                     │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐  │   │   │
│  │  │  │ TIER 3: Step Scheduler (DAG Executor)                    │  │   │   │
│  │  │  │ Executes steps in dependency order with circuit breaker  │  │   │   │
│  │  │  │ Emits: schedulerEvents.stepStart/Progress/Done/Failed    │  │   │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │   │   │
│  │  │                           │                                     │   │   │
│  │  │           ┌───────────────┼───────────────┐                    │   │   │
│  │  │           ▼               ▼               ▼                    │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐           │   │   │
│  │  │  │ WebExecutor│  │ CLIExecutor│  │ ServiceExecutor│           │   │   │
│  │  │  │ (ChatGPT   │  │ (Codex     │  │ (Vercel deploy │           │   │   │
│  │  │  │  + DALL-E) │  │  --full-   │  │  + guides)     │           │   │   │
│  │  │  │            │  │  auto)     │  │                │           │   │   │
│  │  │  │ EMITS:     │  │            │  │ EMITS:         │           │   │   │
│  │  │  │ imageGen   │  │ EMITS:     │  │ deployEvents   │           │   │   │
│  │  │  │ Events     │  │ workerEvts │  │                │           │   │   │
│  │  │  └────────────┘  └────────────┘  └────────────────┘           │   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐  │   │   │
│  │  │  │ Rate Limit Recovery                                       │  │   │   │
│  │  │  │ Detects ChatGPT rate limits, defers steps, auto-resumes  │  │   │   │
│  │  │  │ EMITS: rateLimitEvents.hit/deferred/resumed               │  │   │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │   │   │
│  │  │                                                                 │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      BROWSERVIEW (AI Provider)                        │   │
│  │  Embedded web view for ChatGPT/Claude with DOM injection/capture      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Component | Responsibility |
|-----------|----------------|
| **Renderer Process** | React UI, receives status updates via IPC |
| **Main Process** | Node.js, runs pipeline, Status Agent, IPC handling |
| **Event Bus** | Central typed EventEmitter (`systemEvents`) |
| **Status Agent** | Translates raw events to human-readable status lines |
| **Conductor** | AI classifier that routes messages and creates plans |
| **Step Scheduler** | Executes plans step-by-step with error recovery |
| **Executors** | Web (ChatGPT/DALL-E), CLI (Codex), Service (Vercel) |

---

## 3. Data Flow: Event → Screen

This is the critical path that Instance 6 completed.

### Complete Flow Diagram

```
[Backend Operation]
       │
       │ (1) Executor/Recovery calls event emitter
       ▼
┌──────────────────────────────────────────┐
│ events.ts - Type-safe Emitters           │
│                                          │
│ imageGenEvents.start(prompt)             │
│ rateLimitEvents.hit(provider, ms)        │
│ deployEvents.start(target)               │
│ schedulerEvents.stepStart(id, action)    │
│                                          │
│ All call → emitEvent(source, type, data) │
│            → systemEvents.emitStatus()   │
└──────────────────────────────────────────┘
       │
       │ (2) Status Agent subscribes to all events
       ▼
┌──────────────────────────────────────────┐
│ status-agent/index.ts - Manager          │
│                                          │
│ systemEvents.onAll((event) => {          │
│   // Track running agents (for routing)  │
│   updateRunningAgentsFromEvent(event)    │
│                                          │
│   // Translate to human text             │
│   const statusLine = translate(event)    │
│                                          │
│   // Send to renderer                    │
│   sendStatusLine(statusLine)             │
│ })                                       │
└──────────────────────────────────────────┘
       │
       │ (3) Translator converts event to status line
       ▼
┌──────────────────────────────────────────┐
│ status-agent/translator.ts               │
│                                          │
│ Pure lookup table (NO LLM):              │
│                                          │
│ 'image-gen:start' → {                    │
│   text: 'Creating image...',             │
│   icon: '🎨',                            │
│   state: 'active'                        │
│ }                                        │
│                                          │
│ 'rate-limit:hit' → {                     │
│   text: 'Pausing briefly (Xs)...',       │
│   icon: '⏳',                            │
│   state: 'paused'                        │
│ }                                        │
│                                          │
│ Max 8 words, present tense, no jargon    │
└──────────────────────────────────────────┘
       │
       │ (4) IPC sender transmits to renderer
       ▼
┌──────────────────────────────────────────┐
│ status-agent/ipc.ts                      │
│                                          │
│ mainWindow.webContents.send(             │
│   'status:line',                         │
│   statusLine                             │
│ )                                        │
└──────────────────────────────────────────┘
       │
       │ (5) preload.ts exposes IPC to renderer
       ▼
┌──────────────────────────────────────────┐
│ preload.ts (contextBridge)               │
│                                          │
│ window.electronAPI.statusAgent = {       │
│   onStatusLine: (callback) => {          │
│     ipcRenderer.on('status:line', cb)    │
│   }                                      │
│ }                                        │
└──────────────────────────────────────────┘
       │
       │ (6) React hook receives and updates state
       ▼
┌──────────────────────────────────────────┐
│ hooks/useStatusAgent.ts                  │
│                                          │
│ useEffect(() => {                        │
│   api.onStatusLine((line) => {           │
│     // Build tree structure              │
│     setTree(buildRenderTree(...))        │
│   })                                     │
│ }, [])                                   │
└──────────────────────────────────────────┘
       │
       │ (7) React component renders tree
       ▼
┌──────────────────────────────────────────┐
│ components/ProgressTree.tsx              │
│                                          │
│ {tree.map(node => (                      │
│   <TreeNode key={node.id}                │
│     label={node.label}                   │
│     state={node.state}                   │
│     icon={node.icon} />                  │
│ ))}                                      │
│                                          │
│ User sees: "🎨 Creating image..."        │
└──────────────────────────────────────────┘
```

---

## 4. Instance 6 Changes (What Was Modified)

### 4.1 Image Generation Events (`web-executor.ts`)

**Before:** DALL-E operations were silent. User saw nothing during image generation.

**After:** Status tree shows "Creating image..." during generation.

```typescript
// Added import
import { imageGenEvents } from '../events';

// Added emissions in execute():
if (step.action === 'dall_e') {
  imageGenEvents.start(step.prompt);       // "Creating image..."
}

// On success:
if (images.length > 0) {
  imageGenEvents.complete(images[0]);      // "Image ready!"
}

// On error:
imageGenEvents.error(errorMessage);        // "Image creation failed"
```

### 4.2 Rate Limit Events (`rate-limit-recovery.ts`)

**Before:** Rate limits were handled silently. User saw nothing.

**After:** Status tree shows "Pausing briefly..." with countdown.

```typescript
// Import already existed, but emissions were missing

// Added in onRateLimited():
rateLimitEvents.hit('chatgpt', POLL_INTERVAL_MS);
for (const step of deferred) {
  rateLimitEvents.deferred(step.id, resumeAt.toISOString());
}

// Added in onRateCleared():
for (const step of steps) {
  rateLimitEvents.resumed(step.id);
}
```

### 4.3 Deploy Events (`service-executor.ts`)

**Before:** Vercel deploys were silent. User didn't know deployment was happening.

**After:** Status tree shows "Deploying..." and "Live and ready!" with URL.

```typescript
// Added import
import { deployEvents } from '../events';

// Added emissions:
if (step.action === 'deploy_vercel') {
  deployEvents.start('vercel');            // "Deploying vercel..."
}

// On success:
deployEvents.complete(deployUrl);          // "Live and ready!"

// On error:
deployEvents.error(errorMessage);          // "Deploy failed"
```

### 4.4 Running Agents Tracking (`status-agent/index.ts`)

**Before:** `getRunningAgents()` returned `[]`. User corrections couldn't be routed.

**After:** Running agents tracked from scheduler events. Corrections route correctly.

```typescript
// Added to state:
runningAgents: new Map<number, RunningAgent>()

// Added in handleEvent():
this.updateRunningAgentsFromEvent(event);

// New method added:
private updateRunningAgentsFromEvent(event: StatusEvent): void {
  if (event.source !== 'scheduler') return;

  const detail = JSON.parse(event.detail);
  const stepId = detail.stepId;

  if (event.type === 'step-start') {
    const category = this.categorizeAction(detail.action);
    this.state.runningAgents.set(stepId, {
      handle: `step-${stepId}`,
      stepId,
      category,
      status: 'running',
    });
  } else if (event.type === 'step-done' || event.type === 'step-failed') {
    this.state.runningAgents.delete(stepId);
  }
}

// New categorization method:
private categorizeAction(action: string): string {
  // Maps actions to categories: DESIGN, CONTENT, DEPLOYMENT, FEATURE, ASSET, GENERAL
  // Used by interrupt dispatcher to route corrections
}
```

### 4.5 Types Update (`status-agent/types.ts`)

```typescript
// Added to StatusAgentState:
runningAgents: Map<number, RunningAgent>;

// Added interface:
export interface RunningAgent {
  handle: string;
  stepId: number;
  category: string;
  status: 'running' | 'paused';
}
```

---

## 5. File-by-File Change Breakdown

### Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `src/main/executors/web-executor.ts` | +15 | imageGenEvents emissions |
| `src/main/rate-limit-recovery.ts` | +10 | rateLimitEvents emissions |
| `src/main/executors/service-executor.ts` | +12 | deployEvents emissions |
| `src/status-agent/index.ts` | +60 | Running agents tracking |
| `src/status-agent/types.ts` | +15 | RunningAgent interface |

### Files NOT Modified (But Relevant)

| File | Why Relevant |
|------|--------------|
| `src/main/events.ts` | Event emitters already existed (Instance 1-5) |
| `src/status-agent/translator.ts` | Translation rules already existed |
| `src/status-agent/ipc.ts` | IPC senders already existed |
| `src/renderer/hooks/useStatusAgent.ts` | React hook already existed |
| `src/main/preload.ts` | IPC bridge already existed |

---

## 6. Verification Checklist

### 6.1 TypeScript Compilation

```bash
cd /Users/celeste7/Documents/unified-terminal
npx tsc --noEmit
```

**Expected:** No errors

### 6.2 Build Verification

```bash
npm run build:main
npm run build:renderer
```

**Expected:** Both succeed without errors

### 6.3 Integration Check

```bash
npx ts-node tests/integration-check.ts
```

**Expected Results:**
- Fast-path routing: 8/8 tests passed
- Conductor files: 8 files present
- Test coverage: 253 tests
- IPC handlers: Registered
- Preload API: Exposed

### 6.4 Manual Event Flow Verification

To verify the event flow manually:

1. **Trigger an image generation:**
   ```typescript
   // In dev tools or test:
   import { imageGenEvents } from './src/main/events';
   imageGenEvents.start('test prompt');
   // Status Agent should emit 'image-gen:start'
   // Translator should produce "Creating image..."
   ```

2. **Simulate a rate limit:**
   ```typescript
   import { rateLimitEvents } from './src/main/events';
   rateLimitEvents.hit('chatgpt', 60000);
   // Should produce "Pausing briefly (60s)..."
   ```

3. **Simulate a deploy:**
   ```typescript
   import { deployEvents } from './src/main/events';
   deployEvents.start('vercel');
   // Should produce "Deploying vercel..."
   ```

### 6.5 Running Agents Verification

To verify running agents tracking:

```typescript
import { getStatusAgentManager } from './src/status-agent';
import { schedulerEvents } from './src/main/events';

// Simulate step start
schedulerEvents.stepStart(1, 'build_feature', 'Building homepage');

// Check running agents
const manager = getStatusAgentManager();
const agents = manager.getState().runningAgents;
console.log(agents);
// Should have entry for stepId 1 with category 'FEATURE'

// Simulate step done
schedulerEvents.stepDone(1, 'build_feature');

// Check agents cleared
console.log(manager.getState().runningAgents);
// Should be empty
```

---

## 7. Architecture Deep Dive

### 7.1 Event Bus (`src/main/events.ts`)

The Event Bus is a singleton `EventEmitter` that all backend components emit to. It provides type-safe emitters for each source.

**Key methods:**
- `emitEvent(source, type, detail)` - Emit an event
- `systemEvents.onAll(handler)` - Subscribe to all events
- `systemEvents.onStatus(source, type, handler)` - Subscribe to specific event

**Type-safe emitters:**
```typescript
conductorEvents.classifyStart(message)
schedulerEvents.stepStart(stepId, action, detail)
workerEvents.spawn(stepId, action, projectDir)
imageGenEvents.start(prompt)
rateLimitEvents.hit(provider, retryAfterMs)
deployEvents.start(target)
```

### 7.2 Status Agent (`src/status-agent/`)

The Status Agent is the translation layer between technical backend events and human-readable status lines.

**Structure:**
```
src/status-agent/
├── index.ts          # Manager (orchestrator)
├── types.ts          # Type definitions
├── translator.ts     # Event → StatusLine lookup table
├── voice.ts          # Brand voice rules (banned words, max length)
├── ipc.ts            # IPC senders to renderer
├── handlers.ts       # IPC handlers from renderer
├── query.ts          # User query routing
├── interrupt-classifier.ts  # Keyword-based correction classification
└── interrupt-dispatch.ts    # Route corrections to agents
```

**Key rules:**
- Max 8 words per status line
- Present progressive tense ("Building..." not "Built...")
- Banned words: "agent", "CLI", "API", "JSON", "token", "model", "Codex", "GSD", "exit code", "session ID", "context window", "prompt", "node_modules", "npm", "git commit"

### 7.3 Translator Lookup Table (`src/status-agent/translator.ts`)

Pure lookup-based translation. **No LLM calls.**

Example translations:
```typescript
'image-gen:start' → "Creating image..." (🎨)
'image-gen:complete' → "Image ready!" (🖼️)
'rate-limit:hit' → "Pausing briefly (Xs)..." (⏳)
'rate-limit:resumed' → "Resuming work..." (▶️)
'deploy:start' → "Deploying vercel..." (🚀)
'deploy:live' → "Live and ready!" (🌐)
```

### 7.4 IPC Channel Naming

All Status Agent IPC channels use the `status:` prefix:

**Main → Renderer (send):**
- `status:line` - New status line
- `status:line-update` - Update existing line
- `status:line-batch` - Batch of new lines
- `status:query` - User query
- `status:query-timeout` - Query timed out
- `status:fuel-update` - Fuel gauge update
- `status:build-started` - Build started
- `status:build-complete` - Build finished
- `status:interrupt-ack` - Correction acknowledged
- `status:shell-state` - Shell state change

**Renderer → Main (invoke):**
- `status:respond-query` - User query response
- `status:send-correction` - User correction
- `status:stop-step` - Stop specific step
- `status:stop-all` - Emergency stop all

### 7.5 React Integration

The `useStatusAgent` hook provides:

**State:**
- `tree` - Hierarchical tree of status nodes
- `query` - Current user query (if any)
- `fuel` - Fuel gauge state
- `buildState` - 'idle' | 'building' | 'complete'
- `overallProgress` - 0-100 percentage

**Actions:**
- `sendQueryResponse(queryId, value)` - Respond to query
- `sendCorrection(text)` - Send user correction
- `sendStopStep(stepId)` - Stop specific step
- `sendStopAll()` - Emergency stop

---

## 8. Test Commands

### Build and Check

```bash
# Full build
npm run build

# TypeScript check only
npx tsc --noEmit

# Main process only
npm run build:main

# Renderer only
npm run build:renderer
```

### Run Tests

```bash
# All tests
npx ts-node tests/*.ts

# Integration check
npx ts-node tests/integration-check.ts

# Specific test file
npx ts-node tests/status-agent.test.ts
```

### Development

```bash
# Start in dev mode
npm run dev

# Watch mode
npm run dev:watch
```

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **BrowserView** | Electron component that embeds a web page (used for ChatGPT/Claude) |
| **Conductor** | AI classifier that routes messages and creates execution plans |
| **DAG** | Directed Acyclic Graph - the execution plan with step dependencies |
| **Event Bus** | Central EventEmitter that all components emit to |
| **Executor** | Component that executes a specific type of step (Web/CLI/Service) |
| **Fast-path** | Tier 0 routing that bypasses Conductor for trivial messages |
| **Fuel** | Session budget/quota displayed as a gauge |
| **IPC** | Inter-Process Communication between main and renderer processes |
| **PA Envelope** | Payload wrapper for routing messages to agents |
| **Preload** | Script that bridges main and renderer processes |
| **Status Agent** | Translation layer from backend events to human-readable status |
| **Status Line** | Single line in the progress tree (max 8 words) |
| **Step Scheduler** | Executes DAG steps in dependency order |
| **Tree Node** | Hierarchical node in the status tree UI |

---

## Summary

Instance 6 completed the final wiring to make the backend visible to users. All major operations now emit events that flow through the Status Agent to the React UI.

**Verification Priority:**
1. TypeScript compiles without errors
2. Build succeeds
3. Integration check passes
4. Event → StatusLine translations are correct
5. Running agents track correctly for correction routing

**Questions?** Check `INSTANCE-6-CHANGELOG.md` for detailed change history.
