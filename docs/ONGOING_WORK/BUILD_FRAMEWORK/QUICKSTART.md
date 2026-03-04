# Electron Build Framework — Quick Reference

## The Mental Model

```
┌─────────────────────────────────────────────────────┐
│                   YOUR APP                           │
│                                                      │
│   MAIN PROCESS          RENDERER PROCESS            │
│   (Node.js)             (Chromium)                  │
│   ════════════          ═══════════════             │
│   Can spawn codex       Renders React UI            │
│   Can read files        Shows AgentRootTree         │
│   Controls windows      User interactions           │
│                                                      │
│         │                      ▲                    │
│         │      IPC             │                    │
│         └──────────────────────┘                    │
│                                                      │
│   BROWSERVIEW (separate)                            │
│   ════════════════════                              │
│   chatgpt.com embedded                              │
│   Has own session/cookies                           │
│   Renderer overlays on top                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Key Files

| What You Want | File |
|---------------|------|
| Spawn a CLI process | `src/main/cli-runner.ts` |
| Parse Codex output | `src/main/codex-adapter.ts` |
| Route messages | `src/main/conductor.ts` |
| Expose API to UI | `src/main/preload.ts` |
| React overlay UI | `src/renderer/*.tsx` |
| Window management | `src/main/index.ts` |

## Commands

```bash
# Development
npm run dev              # Hot reload both processes

# Build
npm run build:main       # Compile TypeScript only
npm run dist:mac:arm64   # Full .dmg build

# Test
npx vitest               # Unit tests
```

## IPC Pattern

**Main → Renderer (push events):**
```typescript
// Main process
mainWindow.webContents.send('agent:progress', { id, progress: 45 });

// Renderer
window.electronAPI.on('agent:progress', (e, data) => { ... });
```

**Renderer → Main (request/response):**
```typescript
// Renderer
const result = await window.electronAPI.cli.spawn('codex', args);

// Main process (in preload.ts exposure)
ipcMain.handle('cli:spawn', (e, tool, args) => { ... });
```

## Where Things Live

```
~/Library/Application Support/unified-terminal/
├── Partitions/
│   ├── persist:chatgpt/   # ChatGPT session
│   └── persist:claude/    # Claude session
└── state.json             # App state

/opt/homebrew/bin/codex    # Codex CLI (not bundled)
~/.local/bin/claude        # Claude Code (not bundled)
```

## The Overlay Works Because

1. **BrowserView** is positioned with `setBounds()` — can leave room for panel
2. **Renderer** is a normal Chromium window — can have transparent areas
3. **Renderer overlays BrowserView** — higher z-index
4. **IPC events** update React state — tree re-renders

## Build Output

```
npm run dist:mac:arm64
    │
    ▼
release/
├── Unified Terminal-0.1.0-arm64.dmg   # User installs this
└── mac-arm64/
    └── Unified Terminal.app/          # The actual app
        └── Contents/
            ├── Resources/app.asar     # Your bundled code
            └── Frameworks/            # Chromium + Node.js
```
