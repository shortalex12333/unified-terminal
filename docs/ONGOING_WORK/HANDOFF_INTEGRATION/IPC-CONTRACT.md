# IPC Contract: All Channels (Existing + New)

> Every IPC channel in the Electron app. Existing channels are LOCKED. New channels are what the build engineer adds.

---

## Existing Channels (LOCKED — Do Not Modify)

### Conductor / Scheduler

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `conductor:route` | Renderer → Main | `{ message: string }` | User sends message for routing |
| `step:progress` | Main → Renderer | `{ stepId, percent, message }` | Step execution progress |
| `step:needs-user` | Main → Renderer | `CircuitBreakerOptions` | Circuit breaker escalation |
| `step:user-decision` | Renderer → Main | `{ stepId, decision: 'retry'|'skip'|'stop' }` | User circuit breaker choice |
| `step:plan-complete` | Main → Renderer | `{ planId, status }` | Execution plan finished |

### Provider / Window

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `provider:switch` | Renderer → Main | `{ provider: 'chatgpt'|'claude' }` | Switch BrowserView provider |
| `provider:ready` | Main → Renderer | `{ provider }` | BrowserView loaded |
| `chatgpt:inject` | Main → BrowserView | `{ text }` | DOM injection to ChatGPT |
| `chatgpt:capture` | BrowserView → Main | `{ response }` | DOM capture from ChatGPT |

### CLI Auth

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `cli:auth-start` | Main → Renderer | `{ tool: 'codex'|'claude' }` | OAuth flow starting |
| `cli:auth-complete` | Main → Renderer | `{ tool, success }` | OAuth flow done |
| `cli:auth-error` | Main → Renderer | `{ tool, error }` | OAuth flow failed |

---

## New Channels (Build Engineer Adds These)

### Status Agent → Renderer

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `status:line` | Main → Renderer | `StatusLine` | New status line to display |
| `status:line-update` | Main → Renderer | `{ id: string, partial: Partial<StatusLine> }` | Update existing line (state change, progress) |
| `status:query` | Main → Renderer | `UserQuery` | Decision point — render buttons/input |
| `status:query-timeout` | Main → Renderer | `{ queryId: string, defaultValue: string }` | Auto-selected default after timeout |
| `status:interrupt-ack` | Main → Renderer | `{ affected: string[], unaffected: string[], message: string }` | Confirm which steps were affected by correction |

### Renderer → Status Agent

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `user:query-response` | Renderer → Main | `{ queryId: string, value: string }` | User picked an option or typed text |
| `user:correction` | Renderer → Main | `{ text: string }` | Free-text correction (unprompted) |
| `user:stop-step` | Renderer → Main | `{ stepId: number }` | Stop specific step |
| `user:stop-all` | Renderer → Main | `{}` | Stop everything |

---

## Type Definitions

### StatusLine (Main → Renderer via `status:line`)

```typescript
interface StatusLine {
  id: string;                    // unique ID (e.g., "sl-conductor-1709571234567")
  text: string;                  // human-readable, max 8 words, present tense
  expandable: boolean;           // click to reveal expandedText?
  expandedText: string | null;   // technical cascade detail
  state: 'pending' | 'active' | 'done' | 'error' | 'paused' | 'waiting_user';
  stepId: number | null;         // links to DAG step
  parentId: string | null;       // for tree nesting (child of another line)
  progress: number | null;       // 0-100 if calculable
  icon: string;                  // emoji: ✅ ⚡ 🔍 🔧 ⏸️ ❓ etc.
}
```

### UserQuery (Main → Renderer via `status:query`)

```typescript
interface UserQuery {
  id: string;                    // unique query ID
  source: string;                // which agent/step is asking
  stepId: number | null;         // DAG step ID for routing response
  agentHandle: string;           // process handle of asking agent
  type: 'choice' | 'text' | 'confirm' | 'upload';
  question: string;              // human-friendly question text
  options: QueryOption[];        // for choice type: buttons
  placeholder: string | null;   // for text type: input placeholder
  defaultChoice: string | null; // auto-select after timeout
  timeout: number;              // ms before defaultChoice activates
  priority: 'normal' | 'blocking'; // blocking = agent is paused
}

interface QueryOption {
  label: string;                 // button text: "Minimal"
  value: string;                 // routing value: "style-minimal"
  detail: string | null;        // tooltip
  icon: string | null;          // optional icon
}
```

### CircuitBreakerOptions (Existing, for reference)

```typescript
interface CircuitBreakerOptions {
  stepId: number;
  stepDetail: string;
  stepAction: string;
  failureCount: number;
  lastError: string;
  confidence: 'definitive' | 'heuristic';
  actions: Array<{ label: string; value: 'retry' | 'skip' | 'stop' }>;
  fallbackAction: 'stop';
  fallbackTimeoutMs: number;
}
```

---

## Event Flow Diagrams

### Normal Step Execution
```
Conductor classifies → status:line { text: "Understanding what you need..." }
Conductor plan ready → status:line { text: "Got it! Planning 5 steps." }
                      → status:query { question: "Here's what I'm going to build. Look good?" }
User clicks "Let's go!" → user:query-response { value: "approve" }
Step 1 starts → status:line { text: "Setting up your project..." }
Step 1 done → status:line-update { id: "...", state: "done" }
Step 2 starts → status:line { text: "Building your homepage..." }
...and so on
```

### Circuit Breaker (Existing Flow + Status Translation)
```
Step fails 3x → step:needs-user { CircuitBreakerOptions }
              → status:line { text: "Found an issue, fixing it..." }
User clicks "Retry" → step:user-decision { decision: "retry" }
                    → status:line-update { state: "active", text: "Trying again..." }
```

### User Correction (New Flow)
```
User types "Don't use red, use blue" → user:correction { text: "Don't use red, use blue" }
Status Agent classifies → DESIGN category → matches step-3 (styling)
PA validates + routes → correction to step-3 only
Status Agent confirms → status:interrupt-ack { affected: ["step-3"], message: "Got it — using blue instead." }
                      → status:line { text: "Updating your design..." }
```
