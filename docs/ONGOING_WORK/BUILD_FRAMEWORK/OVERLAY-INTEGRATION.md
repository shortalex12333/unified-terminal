# Overlay Integration — Connecting Build Framework to UX_TREE

> How the Electron architecture enables the AgentRootTree overlay

---

## The Integration Points

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   STATUS_AGENT/UX_TREE/              BUILD_FRAMEWORK/               │
│   ════════════════════               ════════════════               │
│                                                                      │
│   AgentRootTree.jsx      ◄────────   Renderer Process              │
│   (React component)                   (Chromium)                    │
│        │                                   ▲                        │
│        │                                   │                        │
│        │ Expects IPC events:               │                        │
│        │ • agent:started                   │ IPC Bridge             │
│        │ • agent:progress                  │                        │
│        │ • agent:completed                 │                        │
│        │                                   │                        │
│        ▼                                   │                        │
│   APP-SHELL-OVERLAY-SPEC.md  ◄────────   Main Process              │
│   (Layout states)                         (Node.js)                 │
│        │                                   │                        │
│        │ IDLE/BUILDING/MINIMISED          │                        │
│        │                                   │                        │
│        ▼                                   ▼                        │
│   Fuel Gauge             ◄────────   cli-runner.ts                 │
│   (Resource tracking)                codex-adapter.ts               │
│                                      conductor.ts                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Current State → Future State

### CURRENT (Proof of Concept)

```
Main Process                    Renderer
═══════════                    ════════
cli-runner.ts                  ProfilePicker.tsx
    │                          ChatInterface.tsx
    │ spawn('codex')           (no tree visibility)
    │
    └─► console.log only
        No IPC events
        No UI visibility
```

### FUTURE (UX_TREE Integration)

```
Main Process                    Renderer
═══════════                    ════════
AgentRegistry (NEW)            AgentRootTree.jsx
    │                              │
    ├─► spawn codex                │
    │                              │
    ├─► emit('agent:started') ────►├─► Add node to tree
    │                              │   state: 'active'
    │                              │
    ├─► parse JSON progress        │
    ├─► emit('agent:progress') ───►├─► Update progress bar
    │                              │   progress: 45%
    │                              │
    └─► emit('agent:completed') ──►└─► Node turns green
                                       state: 'done'
```

---

## What Needs To Be Built

### 1. AgentRegistry (Main Process)

Wraps CLI spawning with event emission:

```typescript
// src/main/agent-registry.ts

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { getCLIRunner } from './cli-runner';

interface AgentNode {
  id: string;
  label: string;           // Human-friendly, no "codex" word
  state: 'pending' | 'active' | 'done' | 'error';
  progress: number;        // 0-100
  children: AgentNode[];
  parallel?: boolean;
}

class AgentRegistry extends EventEmitter {
  private mainWindow: BrowserWindow;
  private activeAgents: Map<string, AgentNode> = new Map();

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  async spawnAgent(config: {
    id: string;
    label: string;
    tool: 'codex' | 'claude';
    prompt: string;
    parentId?: string;
  }): Promise<string> {
    const node: AgentNode = {
      id: config.id,
      label: config.label,
      state: 'active',
      progress: 0,
      children: [],
    };

    this.activeAgents.set(config.id, node);

    // Emit to renderer
    this.emitToRenderer('agent:started', node);

    // Spawn the actual process
    const runner = getCLIRunner();
    const processId = runner.spawn(config.tool, ['exec', '--json'], {
      background: true,
    });

    // Listen for output
    runner.on('output', ({ processId: pid, data }) => {
      if (pid === processId) {
        const progress = this.parseProgress(data);
        if (progress !== null) {
          node.progress = progress;
          this.emitToRenderer('agent:progress', {
            id: config.id,
            progress,
          });
        }
      }
    });

    // Listen for completion
    runner.on('status', ({ processId: pid, status }) => {
      if (pid === processId) {
        node.state = status === 'completed' ? 'done' : 'error';
        node.progress = 100;
        this.emitToRenderer('agent:completed', {
          id: config.id,
          state: node.state,
        });
        this.activeAgents.delete(config.id);
      }
    });

    return processId;
  }

  private parseProgress(data: string): number | null {
    // Parse Codex JSON output for progress indicators
    try {
      const lines = data.split('\n').filter(Boolean);
      for (const line of lines) {
        const msg = JSON.parse(line);
        if (msg.type === 'turn.completed' && msg.usage) {
          // Estimate progress from token usage
          // This is a heuristic — real implementation would be smarter
          return Math.min(95, Math.round(msg.usage.output_tokens / 1000 * 10));
        }
      }
    } catch {}
    return null;
  }

  private emitToRenderer(channel: string, data: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  getActiveAgents(): AgentNode[] {
    return Array.from(this.activeAgents.values());
  }
}

export const agentRegistry = new AgentRegistry();
```

### 2. Preload Bridge Addition

```typescript
// src/main/preload.ts (add to existing)

agents: {
  onStarted: (callback: (data: AgentNode) => void) => {
    ipcRenderer.on('agent:started', (_, data) => callback(data));
  },
  onProgress: (callback: (data: { id: string; progress: number }) => void) => {
    ipcRenderer.on('agent:progress', (_, data) => callback(data));
  },
  onCompleted: (callback: (data: { id: string; state: string }) => void) => {
    ipcRenderer.on('agent:completed', (_, data) => callback(data));
  },
  getActive: () => ipcRenderer.invoke('agents:get-active'),
},
```

### 3. React Hook (Renderer)

```typescript
// src/renderer/hooks/useAgentTree.ts

import { useState, useEffect } from 'react';

interface AgentNode {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'done' | 'error';
  progress: number;
  children: AgentNode[];
}

export function useAgentTree() {
  const [tree, setTree] = useState<AgentNode[]>([]);

  useEffect(() => {
    window.electronAPI.agents.onStarted((node) => {
      setTree(prev => [...prev, node]);
    });

    window.electronAPI.agents.onProgress(({ id, progress }) => {
      setTree(prev => prev.map(node =>
        node.id === id ? { ...node, progress } : node
      ));
    });

    window.electronAPI.agents.onCompleted(({ id, state }) => {
      setTree(prev => prev.map(node =>
        node.id === id ? { ...node, state, progress: 100 } : node
      ));
    });

    // Load any already-running agents
    window.electronAPI.agents.getActive().then(setTree);
  }, []);

  return tree;
}
```

### 4. AgentRootTree Integration

```typescript
// src/renderer/components/AgentRootTree.tsx

import { useAgentTree } from '../hooks/useAgentTree';

export function AgentRootTree() {
  const tree = useAgentTree();  // Real data from IPC

  // ... rest of AgentRootTree.jsx component
  // Replace MOCK_TREE with `tree` from hook
}
```

---

## Label Translation (Banned Words)

The AgentRegistry translates technical terms to user-friendly labels:

```typescript
const LABEL_MAP: Record<string, string> = {
  'codex_scaffold': 'Setting up your project',
  'codex_build': 'Building your code',
  'codex_test': 'Testing everything',
  'codex_git': 'Saving your progress',
  'web_inject': 'Asking for help',
  'image_gen': 'Creating images',
};

// BANNED from UI output:
// "agent", "CLI", "API", "JSON", "token", "model",
// "Codex", "GSD", "exit code", "session ID",
// "context window", "prompt", "node_modules", "npm", "git commit"
```

---

## Layout Integration

The AgentRootTree appears based on app state:

```typescript
// src/renderer/App.tsx

function App() {
  const [appState, setAppState] = useState<'idle' | 'building' | 'minimised'>('idle');

  useEffect(() => {
    window.electronAPI.on('shell:state-change', (_, state) => {
      setAppState(state);
    });
  }, []);

  return (
    <div className="app-shell">
      {/* Tree panel - visible when building */}
      {appState === 'building' && (
        <div className="tree-panel">
          <AgentRootTree />
        </div>
      )}

      {/* Top bar pill - visible when minimised */}
      {appState === 'minimised' && (
        <TopBarPill />
      )}

      {/* BrowserView fills remaining space (managed by main process) */}
    </div>
  );
}
```

---

## Summary

| Layer | Current | Future |
|-------|---------|--------|
| CLI Spawning | `cli-runner.ts` | `AgentRegistry` wraps `cli-runner.ts` |
| Events | `console.log` only | IPC to renderer |
| UI | None | `AgentRootTree.tsx` |
| Layout | Fixed BrowserView | Dynamic split (idle/building/minimised) |
| Labels | Technical | Human-friendly (no banned words) |

---

*This document bridges BUILD_FRAMEWORK (how the app works) with STATUS_AGENT/UX_TREE (what the user sees). The key integration point is the AgentRegistry that emits IPC events consumed by AgentRootTree.*
