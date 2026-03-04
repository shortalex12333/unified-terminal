# Electron Build Framework — Architecture Reference

> **Status**: GOSPEL — Definitive reference for how the app is built, packaged, and structured.
> **Last Updated**: 2026-03-04

---

## 1. What Is Electron?

Electron is a framework that lets you build desktop apps using web technologies (HTML, CSS, JavaScript). It bundles:

1. **Chromium** — The browser engine (renders UI)
2. **Node.js** — Server-side JavaScript (access to filesystem, spawn processes)
3. **Your Code** — The app logic

When a user installs your `.dmg`, they get a self-contained app with its own browser and Node runtime — no dependencies required.

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR APP (.app)                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Chromium   │  │   Node.js    │  │  Your Code   │  │
│  │   (browser)  │  │  (runtime)   │  │  (JS/TS)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Bundled size: ~150-200MB                               │
└─────────────────────────────────────────────────────────┘
```

---

## 2. The Two Process Model

Electron runs **two types of processes** that communicate via IPC (Inter-Process Communication):

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ELECTRON APP                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     MAIN PROCESS                                │ │
│  │                     (Node.js)                                   │ │
│  │                                                                 │ │
│  │  CAPABILITIES:                                                  │ │
│  │  ✓ Full filesystem access (read/write any file)                │ │
│  │  ✓ Spawn child processes (codex, claude, git, npm)             │ │
│  │  ✓ Native OS integration (tray, notifications, menus)          │ │
│  │  ✓ Create/manage windows                                       │ │
│  │  ✓ Network requests without CORS                               │ │
│  │                                                                 │ │
│  │  FILES:                                                         │ │
│  │  src/main/index.ts          — App entry point                  │ │
│  │  src/main/cli-runner.ts     — Spawns CLI processes             │ │
│  │  src/main/codex-adapter.ts  — Parses Codex JSON                │ │
│  │  src/main/conductor.ts      — Routes messages                  │ │
│  │  src/main/preload.ts        — IPC bridge (exposes APIs)        │ │
│  │                                                                 │ │
│  └──────────────────────────────┬─────────────────────────────────┘ │
│                                 │                                    │
│                           IPC BRIDGE                                 │
│                    (ipcMain ↔ ipcRenderer)                          │
│                                 │                                    │
│  ┌──────────────────────────────┴─────────────────────────────────┐ │
│  │                    RENDERER PROCESS                             │ │
│  │                    (Chromium Browser)                           │ │
│  │                                                                 │ │
│  │  CAPABILITIES:                                                  │ │
│  │  ✓ Render HTML/CSS/React                                       │ │
│  │  ✓ DOM manipulation                                            │ │
│  │  ✓ User interactions (clicks, input)                           │ │
│  │  ✗ NO direct filesystem access (security sandbox)              │ │
│  │  ✗ NO spawning processes directly                              │ │
│  │  ✓ Can REQUEST main process via IPC                            │ │
│  │                                                                 │ │
│  │  FILES:                                                         │ │
│  │  src/renderer/App.tsx           — Root React component         │ │
│  │  src/renderer/ProfilePicker.tsx — Provider selection UI        │ │
│  │  src/renderer/ChatInterface.tsx — Bottom nav bar               │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Why Two Processes?

**Security.** The renderer (where web content runs) is sandboxed. Even if malicious code runs in the renderer, it cannot:
- Delete files
- Spawn malware processes
- Access system credentials

Only the Main Process has those powers, and the Renderer must explicitly request them via IPC.

---

## 3. The Preload Bridge

The `preload.ts` script runs BEFORE the renderer loads. It exposes specific Main Process functions to the Renderer via `window.electronAPI`:

```typescript
// src/main/preload.ts (runs in isolated context)

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer can call these:
  cli: {
    spawn: (tool, args) => ipcRenderer.invoke('cli:spawn', tool, args),
    kill: (processId) => ipcRenderer.invoke('cli:kill', processId),
  },
  providerView: {
    show: (provider) => ipcRenderer.invoke('provider:show-view', provider),
    hide: () => ipcRenderer.invoke('provider:hide-view'),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },
});
```

```typescript
// src/renderer/App.tsx (can now use these)

const result = await window.electronAPI.cli.spawn('codex', ['exec', '--json']);
```

---

## 4. BrowserView vs Renderer

These are **two different things**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APP WINDOW                                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  RENDERER (React)                                                ││
│  │  ══════════════════                                              ││
│  │  • YOUR code                                                     ││
│  │  • ProfilePicker, ChatInterface, AgentRootTree                  ││
│  │  • Controlled by you                                             ││
│  │  • Can overlay on top of BrowserView                            ││
│  │                                                                  ││
│  │  z-index: HIGH (on top)                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  BROWSERVIEW (Embedded Website)                                  ││
│  │  ══════════════════════════════                                  ││
│  │  • chatgpt.com or claude.ai                                     ││
│  │  • THEIR code (not yours)                                       ││
│  │  • Separate Chromium instance                                   ││
│  │  • Has its own cookies/localStorage                             ││
│  │  • You can inject JS, but don't own it                          ││
│  │                                                                  ││
│  │  z-index: LOW (behind)                                          ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Insight

**The Tree Panel overlay is part of the RENDERER, not BrowserView.**

The Renderer can:
- Position itself beside BrowserView (split screen)
- Overlay on top of BrowserView (floating panel)
- Be transparent (show BrowserView through gaps)
- Slide in/out with CSS animations

---

## 5. Window Layout Management

```typescript
// src/main/index.ts

// Create main window
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 820,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});

// Load React renderer
mainWindow.loadURL('http://localhost:3001');  // dev
mainWindow.loadFile('dist/renderer/index.html');  // prod

// Create BrowserView for ChatGPT
const chatView = new BrowserView({
  webPreferences: {
    partition: 'persist:chatgpt',  // Isolated session
  },
});
mainWindow.addBrowserView(chatView);

// Position BrowserView (leaves room for overlay)
chatView.setBounds({
  x: 0,
  y: 40,                    // Below title bar
  width: 700,               // 55% of window (leaves 45% for tree panel)
  height: 780,
});

chatView.webContents.loadURL('https://chatgpt.com');
```

### Layout States

```
STATE: IDLE (no build)
┌──────────────────────────────────────────────────────┐
│  Title Bar                                           │
├──────────────────────────────────────────────────────┤
│                                                      │
│              BrowserView (100% width)                │
│              chatgpt.com                             │
│                                                      │
│              Renderer hidden or minimal              │
│                                                      │
└──────────────────────────────────────────────────────┘

STATE: BUILDING (tree expanded)
┌──────────────────────────────────────────────────────┐
│  Title Bar                              [Progress]   │
├──────────────────────────────┬───────────────────────┤
│                              │                       │
│  BrowserView (55%)           │  Renderer (45%)       │
│  chatgpt.com                 │  AgentRootTree        │
│                              │                       │
│  User can still chat         │  Shows build progress │
│                              │                       │
└──────────────────────────────┴───────────────────────┘

STATE: MINIMISED (tree collapsed)
┌──────────────────────────────────────────────────────┐
│  Title Bar      [🔨 Building... ━━░░ 67%  ▼ Expand] │
├──────────────────────────────────────────────────────┤
│                                                      │
│              BrowserView (100% width)                │
│              chatgpt.com                             │
│                                                      │
│              Renderer = just top bar pill            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 6. IPC Event Flow (Main ↔ Renderer)

### Main Process Emits Events

```typescript
// src/main/agent-registry.ts (future)

class AgentRegistry {
  private mainWindow: BrowserWindow;

  spawnAgent(config: AgentConfig) {
    const processId = cliRunner.spawn('codex', args);

    // Emit to renderer
    this.mainWindow.webContents.send('agent:started', {
      id: config.id,
      label: config.label,
      state: 'active',
    });

    // On progress
    cliRunner.on('output', (data) => {
      const progress = this.parseProgress(data);
      this.mainWindow.webContents.send('agent:progress', {
        id: config.id,
        progress,
      });
    });

    // On complete
    cliRunner.on('exit', (code) => {
      this.mainWindow.webContents.send('agent:completed', {
        id: config.id,
        state: code === 0 ? 'done' : 'error',
      });
    });
  }
}
```

### Renderer Listens

```typescript
// src/renderer/AgentRootTree.tsx (future)

useEffect(() => {
  window.electronAPI.on('agent:started', (event, data) => {
    setTree(prev => [...prev, {
      id: data.id,
      label: data.label,
      state: 'active',
      progress: 0,
    }]);
  });

  window.electronAPI.on('agent:progress', (event, data) => {
    setTree(prev => prev.map(node =>
      node.id === data.id
        ? { ...node, progress: data.progress }
        : node
    ));
  });

  window.electronAPI.on('agent:completed', (event, data) => {
    setTree(prev => prev.map(node =>
      node.id === data.id
        ? { ...node, state: data.state, progress: 100 }
        : node
    ));
  });
}, []);
```

---

## 7. Build & Package Process

### Development

```bash
npm run dev
# Runs concurrently:
# 1. TypeScript compiler (watches src/main/)
# 2. Vite dev server (watches src/renderer/)
# 3. Electron (loads from localhost:3001)
```

### Production Build

```bash
npm run dist:mac:arm64
```

This runs:

```
1. TypeScript Compile
   src/main/*.ts → dist/main/*.js

2. Vite Build (React)
   src/renderer/*.tsx → dist/renderer/index.html + assets

3. Electron Builder
   dist/ + node_modules + Chromium + Node.js
   → Unified Terminal.app
   → Unified Terminal-0.1.0-arm64.dmg
```

### Output Structure

```
release/
├── Unified Terminal-0.1.0-arm64.dmg     # macOS installer (95MB)
├── Unified Terminal-0.1.0-arm64-mac.zip # For auto-updater
└── mac-arm64/
    └── Unified Terminal.app/
        └── Contents/
            ├── MacOS/
            │   └── Unified Terminal      # Main executable
            ├── Resources/
            │   ├── app.asar              # Your bundled code
            │   └── electron.icns         # App icon
            └── Frameworks/
                ├── Electron Framework    # Chromium + Node
                └── ...
```

---

## 8. How CLI Tools Are Accessed

```
┌────────────────────────────────────────────────────────────────────┐
│                          USER'S MACHINE                             │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  UNIFIED TERMINAL APP                                          ││
│  │                                                                 ││
│  │  Main Process (Node.js)                                        ││
│  │       │                                                         ││
│  │       │ spawn('codex', ['exec', '--json'])                     ││
│  │       │                                                         ││
│  │       ▼                                                         ││
│  │  ┌─────────────────┐                                           ││
│  │  │  Child Process  │                                           ││
│  │  │  (codex CLI)    │                                           ││
│  │  └────────┬────────┘                                           ││
│  │           │                                                     ││
│  └───────────│─────────────────────────────────────────────────────┘│
│              │                                                      │
│              │ Uses PATH to find:                                   │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  /opt/homebrew/bin/codex     ← Codex CLI (installed globally)  ││
│  │  ~/.local/bin/claude         ← Claude Code (installed globally)││
│  │  /usr/local/bin/git          ← Git                             ││
│  │  /usr/local/bin/npm          ← npm                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Important:** The CLI tools are NOT bundled in the app. They must be installed on the user's machine. The app's System Scanner checks for them and the Auto-Installer can install missing tools.

---

## 9. Session Persistence

### BrowserView Sessions

```typescript
// Each provider has isolated storage
const chatView = new BrowserView({
  webPreferences: {
    partition: 'persist:chatgpt',  // Cookies saved to disk
  },
});

const claudeView = new BrowserView({
  webPreferences: {
    partition: 'persist:claude',   // Separate cookies
  },
});
```

Storage location:
```
~/Library/Application Support/unified-terminal/
├── Partitions/
│   ├── persist:chatgpt/         # ChatGPT cookies, localStorage
│   └── persist:claude/          # Claude cookies, localStorage
└── state.json                   # App state (tasks, preferences)
```

### CLI Session Resume

```typescript
// Codex supports session resume
const sessionId = '019cba0e-47bb-7791-89c4-be05f69c7ddd';
spawn('codex', ['resume', sessionId]);

// Claude Code also supports resume
spawn('claude', ['--resume', sessionId]);
```

---

## 10. Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Main Process | Node.js | OS access, spawn CLI, manage windows |
| Renderer | React + Chromium | UI overlay, tree panel, user interaction |
| BrowserView | Chromium (embedded) | Load chatgpt.com / claude.ai |
| Preload | Node.js (isolated) | Bridge between Main ↔ Renderer |
| IPC | Electron IPC | Message passing between processes |
| CLI Tools | External binaries | codex, claude, git (not bundled) |
| Package | electron-builder | Creates .dmg / .exe / .AppImage |

---

## 11. File Reference

| File | Process | Purpose |
|------|---------|---------|
| `src/main/index.ts` | Main | App entry, window creation, IPC handlers |
| `src/main/preload.ts` | Main (isolated) | Exposes APIs to renderer |
| `src/main/cli-runner.ts` | Main | Spawns CLI processes |
| `src/main/codex-adapter.ts` | Main | Parses Codex JSON output |
| `src/main/conductor.ts` | Main | Routes messages to CLI/web |
| `src/renderer/App.tsx` | Renderer | Root React component |
| `src/renderer/ProfilePicker.tsx` | Renderer | Provider selection UI |
| `src/renderer/ChatInterface.tsx` | Renderer | Bottom nav bar |
| `electron-builder.yml` | Build | Package configuration |
| `vite.config.ts` | Build | Renderer bundler config |
| `tsconfig.json` | Build | TypeScript configuration |

---

*This document is the authoritative reference for how the Electron app is structured. The overlay (AgentRootTree) lives in the Renderer process and communicates with CLI processes via IPC through the Main process.*
