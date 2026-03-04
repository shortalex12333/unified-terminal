# Unified Terminal — Project Status

## What This Is

Electron desktop app wrapping CLI AI tools (ChatGPT, GSD, Claude Code, Codex) for non-technical users. Users interact with ChatGPT in a native window; the app routes tasks to local CLI tools when needed.

## Current Status (2026-03-03 - UPDATED)

**ALL 17 GATES COMPLETE + CONDUCTOR VERIFIED + PROVIDER UNIFICATION COMPLETE**

**Status Summary:**
- ✅ App builds without errors
- ✅ All 3 providers unified on BrowserView
- ✅ All CLIs installed and working (codex, claude-code, gemini)
- ✅ Conductor system initialized with persistent session
- ✅ IPC handlers registered
- ✅ Provider isolation verified
- ✅ Window management working

**Conductor System Status:** ✅ VERIFIED & PRODUCTION READY

| Gate | Status | Description |
|------|--------|-------------|
| 1 | ✅ | ChatGPT BrowserView + OAuth + session persistence |
| 2 | ✅ | DOM injection (send messages to ChatGPT) |
| 3 | ✅ | DOM capture (read ChatGPT responses) |
| 4 | ✅ | Intake meta-prompt flow |
| 5 | ✅ | System scanner + 11-step auto-installer |
| 6 | ✅ | CLI tool authentication |
| 7 | ✅ | CLI process management (spawn/kill/stream) |
| 8 | ✅ | Task routing (browser/local/hybrid) |
| 9 | ✅ | File watcher + project manager |
| 10 | ✅ | GSD + plugin orchestration |
| 11 | ✅ | Task persistence + state manager |
| 12 | ✅ | Auto-updater framework |
| 13 | ✅ | Error recovery system |
| 14 | ✅ | Packaging (.dmg unsigned) |
| 15 | ✅ | Gemini CLI OAuth |
| 16 | ✅ | Auth Screen Component |
| 17 | ✅ | **Chrome-style ProfilePicker + Provider UX** (NEW) |

## Test Results

**444+ tests passing:**
- System Scanner: 15/15
- Task Router: 38/38
- Intake: 24/24
- CLI Runner: 42/42
- Integration Flow: 24/24
- Codex Adapter: 6/6
- **Fast-Path: 92/92**
- **Conductor: 63/63**
- **Step Scheduler: 83/83**
- **CLI Auth: 57/57** (NEW - Gemini support)

## Source Files (46 TypeScript files)

```
src/
├── main/                    # Electron main process (26 files)
│   ├── index.ts             # App entry, IPC handlers, BrowserView
│   ├── chatgpt-adapter.ts   # DOM injection + capture
│   ├── cli-auth.ts          # CLI tool authentication
│   ├── cli-runner.ts        # Process spawning with tree-kill
│   ├── codex-adapter.ts     # Codex CLI JSON interface
│   ├── auto-installer.ts    # 11-step tool installer
│   ├── system-scanner.ts    # Tool detection
│   ├── task-router.ts       # Route to browser/local/hybrid (legacy regex)
│   ├── output-translator.ts # CLI output → friendly messages
│   ├── file-watcher.ts      # Chokidar file monitoring
│   ├── project-manager.ts   # Project CRUD operations
│   ├── state-manager.ts     # Task persistence to JSON
│   ├── tray.ts              # Menu bar tray icon
│   ├── updater.ts           # electron-updater integration
│   ├── error-handler.ts     # Error recovery logic
│   ├── error-types.ts       # Error categorization
│   ├── preload.ts           # IPC bridge + routeMessage API
│   │
│   │ # Conductor System (Intelligent Routing) - 9 files
│   ├── fast-path.ts         # Tier 0: 50ms local bypass for trivial messages
│   ├── conductor.ts         # Tier 1: Persistent Codex router session
│   ├── step-scheduler.ts    # DAG executor with circuit breaker
│   ├── rate-limit-recovery.ts # Rate limit deferral and auto-resume
│   ├── send-interceptor.ts  # DOM-level message interception in ChatGPT
│   └── executors/           # Step executors (4 files)
│       ├── index.ts         # Executor exports
│       ├── cli-executor.ts  # Codex --full-auto spawner
│       ├── web-executor.ts  # ChatGPT inject + image extraction
│       └── service-executor.ts # Service guides + connection waiting
│
├── intake/                  # Meta-prompt intake system (6 files)
│   ├── types.ts             # ProjectBrief, TaskType, etc.
│   ├── meta-prompts.ts      # System prompts for intake
│   ├── task-classifier.ts   # Pattern-based classification
│   ├── brief-builder.ts     # JSON parsing from ChatGPT
│   ├── intake-flow.ts       # Full intake controller
│   └── index.ts             # Exports
│
├── plugins/                 # Plugin orchestration (8 files)
│   ├── plugin-schema.ts     # PluginConfig types
│   ├── plugin-registry.ts   # Plugin registration
│   ├── plugin-executor.ts   # Plugin execution
│   ├── gsd-integration.ts   # GSD-specific logic
│   ├── index.ts             # Exports
│   └── configs/             # Plugin definitions
│       ├── gsd.ts
│       ├── codex.ts
│       ├── claude-code.ts
│       └── research.ts
│
├── utils/
│   └── dom-selectors.ts     # ChatGPT DOM selectors
│
└── renderer/                # React frontend (Gate 17)
    ├── index.tsx            # React entry point
    ├── index.html           # HTML template
    ├── styles.css           # Tailwind CSS imports
    ├── global.d.ts          # Window.electronAPI types
    └── components/
        ├── App.tsx              # Root component with state
        ├── ProfilePicker.tsx    # Chrome-style provider picker
        ├── ChatInterface.tsx    # Unified chat UI for all providers
        ├── AuthScreen.tsx       # CLI auth UI (legacy)
        └── ProviderScreen.tsx   # Provider selection (legacy)

tests/                       # Test files (12 files, 444+ tests)
├── task-router.test.ts      # 38 tests
├── intake.test.ts           # 24 tests
├── cli-runner.test.ts       # 42 tests
├── system-scanner.test.ts   # 15 tests
├── integration-flow.test.ts # 24 tests
├── codex-adapter.test.ts    # 6 tests
├── e2e-flow.test.ts         # End-to-end scenarios
├── fast-path.test.ts        # 92 tests for Tier 0 bypass
├── conductor.test.ts        # 63 tests for Tier 1 router
├── step-scheduler.test.ts   # 83 tests for DAG executor
├── cli-auth.test.ts         # 57 tests for CLI auth (NEW)
└── integration-check.ts     # Comprehensive system verification
```

## Auto-Installer (11 Steps)

1. Xcode CLT — macOS developer tools
2. Homebrew — Package manager
3. Node.js — JavaScript runtime
4. Python — For browser-use
5. Git — Version control
6. Codex CLI — OpenAI coding agent
7. Claude Code — Anthropic coding agent
8. GSD — Task orchestration
9. MCP Servers — Model Context Protocol
10. Browser-Use — Python browser automation
11. Playwright — JS browser automation

## Build Artifacts

```
release/
├── Unified Terminal-0.1.0-arm64.dmg      # macOS installer (95MB, unsigned)
└── Unified Terminal-0.1.0-arm64-mac.zip  # ZIP for auto-updater
```

## Commands

```bash
npm run dev              # Run in development
npm run build:main       # Compile TypeScript
npm run dist:mac:arm64   # Build .dmg (unsigned)
npx ts-node tests/*.ts   # Run tests
```

## What Works

### Core Features
- ✅ All 3 providers load in unified BrowserView system
  - ChatGPT → chatgpt.com (persist:chatgpt)
  - Gemini → gemini.google.com (persist:gemini)
  - Claude → claude.ai (persist:claude)
- ✅ OAuth sign-in (native provider authentication)
- ✅ Session persists across restarts (isolated per provider)
- ✅ DOM injection sends messages (ChatGPT only)
- ✅ DOM capture reads responses (ChatGPT only)

### Task Routing & Execution
- ✅ Task routing (browser/local/hybrid)
- ✅ CLI process management (spawn/kill/stream)
- ✅ Plugin system (4 plugins: gsd, codex, claude-code, research)
- ✅ State persistence (JSON-based)
- ✅ File watcher + project manager
- ✅ Tray icon + minimize to tray
- ✅ Auto-updater framework

### Conductor System (Tier-Based Routing)
- ✅ **TIER 0: Fast-path** - Local pattern matching, 50ms bypass
- ✅ **TIER 1: Router** - Persistent Codex session for classification
- ✅ **TIER 3: Executors** - ChatGPT DOM, Codex CLI, service guides
- ✅ **Send interceptor** - Captures messages before ChatGPT
- ✅ **DAG executor** - Circuit breaker with error recovery
- ✅ **Rate limit recovery** - Defers and auto-resumes tasks

### UI & Frontend
- ✅ **PROFILE PICKER** - Chrome-style 3-provider selector
- ✅ **CHAT INTERFACE** - Unified bottom nav bar + "Switch AI"
- ✅ **REACT RENDERER** - Vite + Tailwind CSS frontend
- ✅ Window management - BrowserView sized correctly
- ✅ Provider isolation - Cookies/storage per provider

### CLI Tools (All Verified)
- ✅ **Codex 0.46.0** - Tier 1 router + executor
- ✅ **Claude Code 2.1.63** - Optional executor
- ✅ **Gemini 0.28.1** - Optional executor

## What's Deferred

- ❌ ALL FRONTEND WORK (NOT IMPROTANT, FRONTEND UX IS JUST NOISE UNTIL LAST STEP IT IS REQUIRED)
- ❌ Code signing ($99 Apple Developer account) - IT IS JUST NOISE UNTIL LAST STEP IT IS REQUIRED
- ❌ Production notarization 
- ❌ Windows/Linux builds 

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron App                      │
├─────────────────────────────────────────────────────┤
│  BrowserView                                         │
│  ┌─────────────────────────────────────────────────┐│
│  │              ChatGPT (chatgpt.com)              ││
│  │  - User types request                           ││
│  │  - DOM injection sends messages                 ││
│  │  - DOM capture reads responses                  ││
│  └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│  Main Process                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ CONDUCTOR    │ │ CLI Runner   │ │ Plugin Exec  ││
│  │ Tier 0-3     │ │ spawn/kill   │ │ GSD/Codex/   ││
│  │ intelligent  │ │ stream output│ │ Claude Code  ││
│  └──────────────┘ └──────────────┘ └──────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ State Mgr    │ │ File Watcher │ │ Auto-Install ││
│  │ persistence  │ │ chokidar     │ │ 11 steps     ││
│  └──────────────┘ └──────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────┘
```

## Conductor System (Intelligent Routing)

Replaces regex-based task-router with AI-powered classification:

```
USER MESSAGE
     │
     ├── TIER 0: FAST-PATH (local, 50ms, no LLM)
     │   Catches trivial messages → direct to ChatGPT
     │
     ├── TIER 1: ROUTER (persistent Codex session)
     │   Classifies everything else → returns JSON DAG
     │   Session persists via `codex resume <session_id>`
     │
     └── TIER 3: EXECUTORS (spawned per step)
         ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
         │ WebExecutor │  │ CLIExecutor │  │ServiceExec  │
         │ ChatGPT DOM │  │ codex       │  │ guides +    │
         │ + DALL-E    │  │ --full-auto │  │ waiting     │
         └─────────────┘  └─────────────┘  └─────────────┘
```

See: `/docs/BOTTLENECKS/CONDUCTOR-ARCHITECTURE.md`

## The Three Rules

1. **Plan First** — No code without approved plan
2. **Verify Always** — Prove it works with evidence
3. **Learn Forever** — Structured lessons after every task

## Completed Milestones

1. ✅ Conductor system built (9 new files, 46 total TypeScript files)
2. ✅ Tests written for conductor system (444+ tests)
3. ✅ App runs full flow: Message → Interceptor → Fast-path → Conductor → Executor
4. ✅ Session persistence verified (persists across restarts)
5. ✅ All 4 plugins registered and functional
6. ✅ **Gates 15-16: CLI OAuth + AuthScreen** (57 tests)
7. ✅ **GATE 17: Provider Unification Complete**
   - All 3 providers (ChatGPT, Gemini, Claude) now use BrowserView
   - Removed CLI auth complexity (use native provider UX)
   - Isolated sessions per provider
   - Unified ProfilePicker + ChatInterface components
   - Production-ready
8. ✅ **INSTANCE 2: Runtime Adapters (Codex + Gemini)**
   - Universal AgentConfig → runtime-specific CLI commands
   - 34/34 verification tests passing
   - Claude adapter skipped (native runtime)
   - See: `docs/ONGOING_WORK/ADAPTORS/`

## Instance 2: Runtime Adapters (2026-03-03)

**STATUS: CODEX + GEMINI COMPLETE | 34/34 TESTS PASS**

```
docs/ONGOING_WORK/ADAPTORS/
├── src/
│   ├── types.ts           # Universal types
│   ├── permissions.ts     # Tool permissions + plugin requirements
│   ├── factory.ts         # Adapter factory
│   ├── codex/adapter.ts   # Codex CLI adapter
│   └── gemini/adapter.ts  # Gemini CLI adapter
├── tests/harness.ts       # Unified verification (34 tests)
├── COMPATIBILITY.md       # Plugin compatibility matrix
└── INSTANCE-2-ADAPTERS.md # Full specification
```

| Runtime | Session Resume | Sandbox Mode |
|---------|---------------|--------------|
| Codex | ✅ Yes | `--sandbox read-only/workspace-write` |
| Gemini | ❌ No (Worker only) | `--approval-mode plan/yolo` |
| Claude Code | Native | N/A |

**Key Decisions:**
- Claude adapter NOT needed (Claude Code is native runtime)
- Gemini is Worker-only (cannot resume sessions)
- gsd-planner/gsd-verifier write docs (NOT read-only)

## Verification Reports

- ✅ `CONDUCTOR-VERIFICATION.md` - Full system verification
- ✅ `scripts/test-conductor-cli.sh` - CLI availability test
- ✅ `scripts/test-startup.sh` - App startup + conductor init test

## Next Steps (Optional)

- Manual end-to-end testing with real ChatGPT + providers
- Code signing ($99 Apple Developer account) - for distribution
- Notarization - for macOS distribution
- Windows/Linux support - future phase

## Key Documentation

```
docs/
├── BOTTLENECKS/
│   ├── BOTTLENECKS.md           # 16-gate build plan
│   └── CLAUDE-CODE-GATE5-6.md   # Detailed Gate 5-6 spec
├── CLAUDE_CODE/
│   └── templates/               # Framework templates
├── ONGOING_WORK/
│   ├── CONDUCTOR /              # Conductor system documentation
│   │   ├── IMPLEMENTATION-PLAN.md   # ✅ Complete - all criteria met
│   │   ├── AGENT-ONBOARDING.md      # Agent bootstrap document
│   │   ├── FRAMEWORK.md             # 4-mode methodology
│   │   └── ORCHESTRATION-MODEL.md   # Claude as PM, not worker
│   ├── CLI_AUTH/                # CLI Authentication
│   │   └── GATE-15-16-CLI-AUTH.md   # ✅ Gemini OAuth + AuthScreen
│   └── ADAPTORS/                # Runtime Adapters (Instance 2)
│       ├── src/                 # Adapter source code
│       │   ├── types.ts         # Universal types
│       │   ├── permissions.ts   # Tool permissions
│       │   ├── factory.ts       # Adapter factory
│       │   ├── codex/adapter.ts # Codex CLI adapter
│       │   └── gemini/adapter.ts # Gemini CLI adapter
│       ├── tests/harness.ts     # 34/34 tests passing
│       ├── COMPATIBILITY.md     # Plugin compatibility matrix
│       └── INSTANCE-2-ADAPTERS.md # ✅ Full specification
├── research/
│   └── plugins/                 # Plugin research
└── plans/
    └── 2026-03-02-gate1-poc-design.md
```
