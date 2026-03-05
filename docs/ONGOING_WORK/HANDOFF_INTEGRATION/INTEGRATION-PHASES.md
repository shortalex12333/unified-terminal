# Integration Phases: Status Agent + Electron App Wiring

> **Pre-requisite**: Merge worktree to main (see `MERGE-STRATEGY.md`)
> **Phases**: 6, in dependency order
> **Total new files**: 14 (8 source, 6 tests)
> **Total modified files**: 11 (additive only — no deletions in existing code)

---

## Dependency Graph

```
Phase 1: Event Bus               (unlocks everything)
    │
    ├── Phase 2: Translator       (depends on: event bus)
    │
    ├── Phase 3: IPC Bridge       (depends on: event bus + translator types)
    │
    └── Phase 4: React Wiring     (depends on: IPC bridge)
         │
         ├── Phase 5: PA Stub + Checkpoints  (depends on: translator + IPC)
         │
         └── Phase 6: Fuel Gauge             (depends on: React wiring)
```

Phase 1 is 20 lines of new code + one-line additions to 6 existing files. Unlocks everything.

---

## LOCKED FILES (Do NOT Modify)

These files were built by Instance 3/4 and are production-verified. Do not change them.

| File | Reason |
|------|--------|
| `src/enforcement/constants.ts` | 24 constant groups, spec-verified |
| `src/enforcement/bodyguard.ts` | Gate check logic, verified |
| `src/enforcement/enforcer.ts` | Check execution + retry logic |
| `src/enforcement/spine.ts` | Project snapshots |
| `src/enforcement/types.ts` | Shared types, consumed everywhere |
| `src/enforcement/index.ts` | Barrel exports |
| `src/skills/*.ts` | All 6 files — skill selection, validation, sandbox |
| `src/glue/*.ts` | All 3 files — prompt assembly, normalization |
| `src/adapters/*.ts` | All 6 files — Codex + Claude adapters, factory, permissions |
| `resources/skills/trigger-map.json` | 28 skills, keyword index |

### ADDITIVE-ONLY FILES (Append/extend, do NOT restructure)

| File | What You Add | What You Don't Touch |
|------|-------------|---------------------|
| `src/main/step-scheduler.ts` | StatusEvent emissions at each enforcement step | The 10-step executeStep() flow |
| `src/main/conductor.ts` | `conductor:classify` and `conductor:plan-ready` event emissions | Classification logic |
| `src/main/executors/cli-executor.ts` | `worker:spawn`, `worker:file-created`, `worker:complete` emissions | Spawn/kill logic |
| `src/main/executors/web-executor.ts` | `image-gen:start`, `image-gen:complete` emissions | DOM injection logic |
| `src/main/executors/service-executor.ts` | `deploy:start`, `deploy:live` emissions | Service connection logic |
| `src/main/preload.ts` | `status:*` channels in contextBridge | Existing IPC channels |
| `src/renderer/global.d.ts` | StatusLine, UserQuery, TreeNode type declarations | Existing Window.electronAPI types |
| `src/main/index.ts` | Status agent IPC handler registration | Existing executor registration |
| `src/main/rate-limit-recovery.ts` | `rate-limit:hit`, `rate-limit:resumed` emissions | Recovery logic |
| `src/main/bodyguard.ts` (via step-scheduler) | Events already emitted by enforcement flow | N/A |
| `src/renderer/components/App.tsx` | Render `<BuildPanel />` alongside existing layout | CircuitBreakerModal wiring |

---

## Phase 1: Event Bus (~20 lines new code)

**Goal**: Typed EventEmitter that every module can emit to and the Status Agent subscribes to.

**Create**: `src/main/status-agent/event-bus.ts`

```typescript
// src/main/status-agent/event-bus.ts
import { EventEmitter } from 'events';

export interface StatusEvent {
  source: string;       // "conductor" | "executor-step-3" | "bodyguard" | "pa" | "spine"
  type: string;         // event type key (e.g., "conductor:classify")
  detail: string;       // JSON string with technical details
  timestamp: number;
  stepId?: number;      // DAG step reference
}

class StatusEventBus extends EventEmitter {
  emit(event: 'status', payload: StatusEvent): boolean {
    return super.emit('status', payload);
  }
  on(event: 'status', listener: (payload: StatusEvent) => void): this {
    return super.on('status', listener);
  }
}

export const statusBus = new StatusEventBus();
```

**Modify (one-line additions)**: Add `statusBus.emit(...)` calls to these files:

| File | Location | Event |
|------|----------|-------|
| `src/main/conductor.ts` | After `classify()` returns | `conductor:classify` |
| `src/main/conductor.ts` | After plan is built | `conductor:plan-ready` |
| `src/main/step-scheduler.ts` | Start of executeStep() | `bodyguard:checking` |
| `src/main/step-scheduler.ts` | After gate check pass | `bodyguard:pass` |
| `src/main/step-scheduler.ts` | After gate check fail | `bodyguard:fail-definitive` or `bodyguard:fail-heuristic` |
| `src/main/executors/cli-executor.ts` | After spawn | `worker:spawn` |
| `src/main/executors/cli-executor.ts` | On file output | `worker:file-created` |
| `src/main/executors/cli-executor.ts` | On complete | `worker:complete` |
| `src/main/executors/web-executor.ts` | After image gen start | `image-gen:start` |
| `src/main/executors/web-executor.ts` | After image gen done | `image-gen:complete` |
| `src/main/rate-limit-recovery.ts` | On rate limit hit | `rate-limit:hit` |
| `src/main/rate-limit-recovery.ts` | On resume | `rate-limit:resumed` |

**Test**: `tests/event-bus.test.ts` — 8 tests
- Emit and receive status event
- Multiple subscribers receive same event
- Unsubscribe works
- Events include timestamp
- Events include stepId when provided
- Unknown event types don't crash
- High-frequency emission doesn't drop events
- Event bus is singleton (same instance everywhere)

**Done when**: `npx ts-node tests/event-bus.test.ts` → 8/8 pass

---

## Phase 2: Translator (~150 lines new code)

**Goal**: Lookup table that converts StatusEvent → StatusLine. No LLM. Max 8 words per line.

**Create**: `src/main/status-agent/translator.ts`

Implement the TRANSLATIONS map from `STATUS-AGENT-SPEC.md` Section 2.2. Every technical event has a pre-defined human translation.

Key types (create in `src/main/status-agent/types.ts`):

```typescript
export interface StatusLine {
  id: string;
  text: string;              // max 8 words, present tense
  expandable: boolean;
  expandedText: string | null;
  state: 'pending' | 'active' | 'done' | 'error' | 'paused' | 'waiting_user';
  stepId: number | null;
  parentId: string | null;
  progress: number | null;
  icon: string;
}
```

**Banned words enforcement**: The translator MUST reject any StatusLine whose `text` contains a banned word. See `STATUS-AGENT-SPEC.md` Section 7.1 for the full list.

```typescript
const BANNED_WORDS = [
  'executing', 'spawning', 'agent', 'process', 'thread', 'runtime',
  'CLI', 'API', 'JSON', 'token', 'model', 'LLM', 'inference',
  'Codex', 'GSD', 'Claude Code', 'Gemini', 'MCP', 'DAG',
  'stdin', 'stdout', 'stderr', 'pipe', 'spawn', 'fork',
  'exit code', 'session ID', 'context window', 'prompt',
  'node_modules', 'package.json', 'npm', 'git commit',
];

function validateStatusLine(line: StatusLine): StatusLine {
  const words = line.text.split(/\s+/);
  if (words.length > 8) {
    line.text = words.slice(0, 8).join(' ') + '...';
  }
  for (const banned of BANNED_WORDS) {
    if (line.text.toLowerCase().includes(banned.toLowerCase())) {
      throw new Error(`Banned word "${banned}" in status line: "${line.text}"`);
    }
  }
  return line;
}
```

**Test**: `tests/translator.test.ts` — 15 tests
- Each TRANSLATIONS entry produces valid StatusLine
- All status lines ≤ 8 words
- Zero banned words in any translation output
- Unknown event types return generic "Working..." line
- expandedText can contain technical detail (for cascade)
- humanizeWorkerTask() covers all TASK_PATTERNS
- humanizeFileName() converts PascalCase to readable
- simplifyReason() maps all known reason codes
- State transitions: pending → active → done
- Error states produce icon "🔧" not "❌"
- Rate limit produces "Taking a short break..."
- Deploy:live includes URL in expandedText
- Image gen events produce correct icon
- Conductor plan-ready includes step count
- Empty detail string doesn't crash JSON.parse (guard with try/catch)

**Done when**: `npx ts-node tests/translator.test.ts` → 15/15 pass, zero banned words

---

## Phase 3: IPC Bridge (~60 lines additions)

**Goal**: Wire preload.ts so renderer can receive status lines and send user responses.

**Modify**: `src/main/preload.ts`

Add these channels to the contextBridge.exposeInMainWorld block:

```typescript
// Status Agent → Renderer
onStatusLine: (callback: (line: StatusLine) => void) =>
  ipcRenderer.on('status:line', (_, line) => callback(line)),

onStatusLineUpdate: (callback: (id: string, partial: Partial<StatusLine>) => void) =>
  ipcRenderer.on('status:line-update', (_, id, partial) => callback(id, partial)),

onStatusQuery: (callback: (query: UserQuery) => void) =>
  ipcRenderer.on('status:query', (_, query) => callback(query)),

onStatusQueryTimeout: (callback: (queryId: string, defaultValue: string) => void) =>
  ipcRenderer.on('status:query-timeout', (_, queryId, defaultValue) => callback(queryId, defaultValue)),

onStatusInterruptAck: (callback: (detail: { affected: string[]; unaffected: string[]; message: string }) => void) =>
  ipcRenderer.on('status:interrupt-ack', (_, detail) => callback(detail)),

// Renderer → Status Agent
sendQueryResponse: (queryId: string, value: string) =>
  ipcRenderer.send('user:query-response', queryId, value),

sendCorrection: (text: string) =>
  ipcRenderer.send('user:correction', text),

sendStopStep: (stepId: number) =>
  ipcRenderer.send('user:stop-step', stepId),

sendStopAll: () =>
  ipcRenderer.send('user:stop-all'),
```

**Modify**: `src/renderer/global.d.ts`

Add the StatusLine, UserQuery, and new electronAPI methods to the Window interface.

**Modify**: `src/main/index.ts`

Register IPC handlers in the main process:

```typescript
// Status Agent IPC handlers
ipcMain.on('user:query-response', (_, queryId: string, value: string) => {
  statusAgent.handleQueryResponse(queryId, value);
});
ipcMain.on('user:correction', (_, text: string) => {
  statusAgent.handleCorrection(text);
});
ipcMain.on('user:stop-step', (_, stepId: number) => {
  statusAgent.handleStopStep(stepId);
});
ipcMain.on('user:stop-all', () => {
  statusAgent.handleStopAll();
});
```

**Test**: `tests/ipc-status.test.ts` — 10 tests
- `status:line` emitted and received via mock IPC
- `status:line-update` updates existing line by ID
- `status:query` delivers UserQuery to renderer
- `user:query-response` routes back to status agent
- `user:correction` triggers interrupt handler
- `user:stop-step` stops specific step
- `user:stop-all` stops all execution
- IPC channels use consistent `status:` prefix
- Unknown query ID in response doesn't crash
- Rapid-fire status lines don't drop events

**Done when**: `npx ts-node tests/ipc-status.test.ts` → 10/10 pass

---

## Phase 4: React Wiring (~200 lines new code)

**Goal**: StatusTree component renders status lines as a vertical timeline tree.

**Create**: `src/renderer/components/StatusTree.tsx`

Renders `StatusLine[]` as a vertical tree with:
- Root nodes (DAG steps) always visible
- Sub-nodes (file operations) cascade on click
- Active nodes pulse gently
- Completed nodes show checkmark
- Error nodes show fix-in-progress
- Parallel branches when 2+ agents work simultaneously

**Create**: `src/renderer/components/BuildPanel.tsx`

Side panel containing:
- StatusTree
- Overall progress bar (completed / total steps)
- Time estimate ("~15 minutes remaining")
- Pause / Cancel buttons
- Text input for user corrections

**Create**: `src/renderer/hooks/useStatusAgent.ts`

React hook that subscribes to status IPC channels:

```typescript
export function useStatusAgent() {
  const [lines, setLines] = useState<StatusLine[]>([]);
  const [queries, setQueries] = useState<UserQuery[]>([]);

  useEffect(() => {
    window.electronAPI.onStatusLine((line) => {
      setLines(prev => [...prev, line]);
    });
    window.electronAPI.onStatusLineUpdate((id, partial) => {
      setLines(prev => prev.map(l => l.id === id ? { ...l, ...partial } : l));
    });
    window.electronAPI.onStatusQuery((query) => {
      setQueries(prev => [...prev, query]);
    });
    // ... cleanup
  }, []);

  return { lines, queries, sendResponse: window.electronAPI.sendQueryResponse };
}
```

**Modify**: `src/renderer/components/App.tsx`

Add `<BuildPanel />` to the layout. Show it when a build is active, hide when idle.

**Test**: `tests/status-tree.test.ts` — 12 tests
- StatusTree renders empty state (no lines)
- StatusTree renders single line with correct icon
- StatusTree renders multiple lines in order
- Active line shows pulse indicator
- Completed line shows checkmark
- Error line shows fix icon
- Expandable line shows expand arrow
- Click on expandable line reveals expandedText
- Parallel branches render correctly (2 active root nodes)
- Progress bar calculates correct percentage
- Text input sends correction via IPC
- Stop button sends stop-step via IPC

**Done when**: `npx ts-node tests/status-tree.test.ts` → 12/12 pass

---

## Phase 5: PA Stub + Checkpoints (~100 lines new code)

**Goal**: Query routing for user decisions + forced checkpoints at key moments.

**Create**: `src/main/status-agent/query-router.ts`

Handles:
1. Circuit breaker decisions (retry/skip/stop) — routes to step-scheduler
2. User corrections (free text) — classifies keyword, routes via PA envelope
3. Stop step/all — emits scheduler events

**Create**: `src/main/status-agent/checkpoint-manager.ts`

Implements forced checkpoints from `STATUS-AGENT-SPEC.md` Section 3.6:
- `PLAN_REVIEW`: After conductor:plan-ready → blocking confirm before execution
- `FIRST_OUTPUT`: After first worker:complete → blocking confirm to continue
- `PRE_DEPLOY`: Before deploy:start → NEVER auto-approve, user MUST confirm
- `PROGRESS_CHECK`: Every 5 completed steps → non-blocking "Still on track?"

```typescript
const FORCED_CHECKPOINTS = {
  PLAN_REVIEW: {
    trigger: 'conductor:plan-ready',
    query: {
      type: 'confirm' as const,
      question: "Here's what I'm going to build. Look good?",
      options: [
        { label: "Let's go!", value: 'approve' },
        { label: 'Change something', value: 'modify' },
      ],
      priority: 'blocking' as const,
      timeout: 120_000,
    },
  },
  // ... FIRST_OUTPUT, PRE_DEPLOY, PROGRESS_CHECK
};
```

**Test**: `tests/checkpoint.test.ts` — 10 tests
- PLAN_REVIEW fires on conductor:plan-ready
- PLAN_REVIEW blocks execution until user responds
- PLAN_REVIEW auto-approves after 120s timeout
- FIRST_OUTPUT fires after first worker:complete
- PRE_DEPLOY fires before deploy:start
- PRE_DEPLOY has NO timeout (user MUST confirm)
- PROGRESS_CHECK fires every 5 completed steps
- PROGRESS_CHECK is non-blocking (agents continue)
- User "Change something" response pauses execution
- Query responses route to correct agent via stepId

**Done when**: `npx ts-node tests/checkpoint.test.ts` → 10/10 pass

---

## Phase 6: Fuel Gauge (~50 lines new code)

**Goal**: Give users visibility into session budget (tokens used, time elapsed, estimated remaining).

**Create**: `src/renderer/components/FuelGauge.tsx`

Displays:
- Steps completed / total steps
- Time elapsed
- Estimated time remaining (based on average step duration)
- Visual progress bar

Uses data from `StatusLine[]` state (count done/total) + timestamps.

**Modify**: `src/renderer/components/BuildPanel.tsx`

Add `<FuelGauge />` below the StatusTree.

**Test**: `tests/fuel-gauge.test.ts` — 6 tests
- Shows 0/N steps initially
- Updates as steps complete
- Time elapsed counts up from build start
- Estimated remaining decreases as steps complete
- Progress bar fills proportionally
- Handles edge case: 0 total steps (empty plan)

**Done when**: `npx ts-node tests/fuel-gauge.test.ts` → 6/6 pass

---

## Done Criteria (All Phases)

Binary pass/fail. No ambiguity.

1. `npx tsc --noEmit` → 0 errors
2. All new test files pass: `npx ts-node tests/{event-bus,translator,ipc-status,status-tree,checkpoint,fuel-gauge}.test.ts`
3. All existing tests still pass: `npx ts-node tests/*.test.ts`
4. Send a build message and watch real status lines appear in the tree
5. Every status line ≤ 8 words with zero banned words
6. Checkpoints render before execution (plan review, pre-deploy)
7. Stop button kills processes (step-level and global)
8. Fuel gauge shows accurate progress

---

## File Summary

### New Files (14 total)
```
src/main/status-agent/event-bus.ts          # Phase 1
src/main/status-agent/types.ts              # Phase 2
src/main/status-agent/translator.ts         # Phase 2
src/main/status-agent/index.ts              # Phase 2
src/main/status-agent/query-router.ts       # Phase 5
src/main/status-agent/checkpoint-manager.ts # Phase 5
src/renderer/components/StatusTree.tsx       # Phase 4
src/renderer/components/BuildPanel.tsx       # Phase 4
src/renderer/hooks/useStatusAgent.ts        # Phase 4
src/renderer/components/FuelGauge.tsx        # Phase 6
tests/event-bus.test.ts                     # Phase 1
tests/translator.test.ts                    # Phase 2
tests/ipc-status.test.ts                    # Phase 3
tests/status-tree.test.ts                   # Phase 4
tests/checkpoint.test.ts                    # Phase 5
tests/fuel-gauge.test.ts                    # Phase 6
```

### Modified Files (11 total, additive only)
```
src/main/conductor.ts                       # Phase 1 (emit events)
src/main/step-scheduler.ts                  # Phase 1 (emit events)
src/main/executors/cli-executor.ts          # Phase 1 (emit events)
src/main/executors/web-executor.ts          # Phase 1 (emit events)
src/main/executors/service-executor.ts      # Phase 1 (emit events)
src/main/rate-limit-recovery.ts             # Phase 1 (emit events)
src/main/preload.ts                         # Phase 3 (add status channels)
src/renderer/global.d.ts                    # Phase 3 (add types)
src/main/index.ts                           # Phase 3 (register IPC handlers)
src/renderer/components/App.tsx             # Phase 4 (render BuildPanel)
src/renderer/components/BuildPanel.tsx       # Phase 6 (add FuelGauge)
```
