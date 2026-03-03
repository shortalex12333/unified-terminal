# PROJECT CONTEXT — Single Source of Truth
## Last Updated: March 2, 2026

---

## 1. WHAT THIS IS

A desktop application (macOS first) that lets non-technical AI users leverage the full power of CLI-based AI agent tools through a clean, friendly interface. The user signs into their existing ChatGPT account inside our app. They describe what they want in plain English. The app does everything else.

We are a wrapper. We don't build AI. We don't host models. We don't charge for inference. We take the CLI tools that senior engineers use daily — GSD, Claude-Flow, Codex, Claude Code — and make them accessible to people who have never opened a terminal.

The app intercepts the user's first message, runs a structured intake workflow using the user's own LLM to ask smart clarifying questions, then orchestrates the full build across local CLI tools and the browser-based LLM interface simultaneously. The user sees clean progress updates, not terminal output.

---

## 2. WHO IT'S FOR

**Primary:** Non-technical people who pay for ChatGPT Plus/Pro and want AI to DO things, not just chat. They've heard of "agents" and "vibe coding" but won't touch a terminal. They want to type "build me an ecom brand" and watch it happen.

**Secondary:** Vibe coders who can kind of code but struggle with prompting, project structure, and leveraging tools efficiently. They install Codex but don't know how to use it well.

**Not for (yet):** Mobile users, enterprise teams, developers who are already productive with CLI tools.

**Key user insight:** These users don't know what plugins are. They don't care about GSD vs Flow vs Shipyard. They just want results. They are lazy (in the best sense), uneducated about AI tooling, and want outcomes not process. Every UX decision flows from this.

---

## 3. WHY IT MATTERS NOW

- CLI agent tools (Codex, Claude Code, GSD) are the most powerful AI experiences available
- 95%+ of AI users will never use them because terminal = scary
- Existing wrappers (LibreChat, Open WebUI) still require API keys and technical setup
- AI providers will never unify — OpenAI won't integrate Claude, Google won't prioritize OpenAI — only a third party can bridge them
- The current wave of "agentic browsers" (Perplexity Comet, ChatGPT Atlas) proves the market wants autonomous AI, but they're single-provider and subscription-locked
- The gap: no product takes existing CLI agent power and delivers it through consumer UX using existing subscriptions

---

## 4. CORE PRODUCT DECISIONS (LOCKED)

### Architecture
- **Electron desktop app** with embedded BrowserView loading ChatGPT (and later Claude/Gemini)
- User signs into ChatGPT INSIDE our app — we own the browser context
- No separate Chrome extension needed for MVP (phase 2 optional)
- Local CLI tools run as child processes within the same Electron app
- No WebSocket, no native messaging — everything in one process
- Background running by default (menu bar icon)

### Install & Setup
- Distributed as .dmg (macOS), notarized with Apple Developer ID
- Auto-updater via electron-updater + GitHub Releases (or S3)
- **One big install sweep on first launch** — Node.js, Python, Git, Codex CLI, Claude Code, GSD, Flow, all skills, all frameworks. ~5-10 minutes. User sees a friendly progress screen. No choices, no configuration.
- Hardware scan on first launch — RAM, OS, installed tools, Docker availability. Builds a capability profile silently. Disables features that can't run on user's machine.
- App Store submission in parallel for easier future updates (not blocking launch)

### Provider Strategy
- **OpenAI first** (largest user base, most users already have ChatGPT Plus)
- Gemini second (month 2)
- Anthropic third (month 2-3)
- Adapter interface designed from day 1 so all providers plug in identically

### File Structure
- App installs to `/Applications/`
- CLI tools install to standard locations (npm global, brew, pyenv)
- User projects live at `~/Documents/our_brand_name/[project-name]/`
- New folder per project, auto-created
- Our development repo: `~/Documents/unified-terminal/`

### Business Model
- Free app, free to use
- Leverages user's existing LLM subscription (ChatGPT Plus/Pro)
- Revenue later: premium workflow templates, team features (month 4+)
- "Open source" = free for users. NOT a public GitHub repo.

### What We Don't Do
- No mobile (parked for month 2+)
- No iOS app (parked)
- No Chrome extension for MVP
- No API keys from users
- No hosting LLM inference
- No building custom AI models
- No WhatsApp/Telegram integrations
- No features requiring us to build a separate backend service

---

## 5. THE INTAKE LAYER (This Is The Product)

The single most important feature. What separates us from raw CLI tools.

### The Problem
User types: "build me an ecom site"
Every CLI tool will fail with this because there's no context — no audience, no product, no tech preferences, no constraints.

### The Solution
Our app intercepts the first message. Sends it to ChatGPT (visible to user in the embedded browser) with a meta-prompt:

```
You are a project intake specialist. The user wants to accomplish the following:
"[USER'S ORIGINAL MESSAGE]"

Before any work begins, you need to understand the project fully.
Ask 3-5 clarifying questions in simple, non-technical language.
Focus on: who is this for, what already exists, what's the end goal,
what are the constraints (budget, timeline, existing accounts).

Do NOT ask technical questions (frameworks, databases, hosting).
Those decisions will be made automatically based on their answers.

Format each question as a simple choice or short answer.
```

ChatGPT generates the questions. User answers in the conversation. Our app captures the full exchange. Then the structured brief gets routed to the right execution path.

### Key Principle
If the user declines to answer or wants to skip the quiz, we continue anyway with reasonable defaults. Never block the user. The quiz makes output better, but absence of it shouldn't prevent output.

### Task Classification
Based on the intake, the system classifies the task:
- **Browser-only:** Research, analysis, writing, market research → stays in ChatGPT window
- **Local-required:** Code generation, file creation, project scaffolding → routes to CLI tools
- **Hybrid:** Most real tasks → uses both simultaneously (ChatGPT for reasoning/research, CLI for execution)

### The Value Principle
We give value, not volume. If context is missing, we ask. If the user's request is vague, we clarify. We don't assume. The worst part about current agentic workflows is they assume too much and produce generic output. We'd rather ask 3 good questions and deliver exactly what they need than auto-generate 50 files of mediocre code.

---

## 6. THE PLUGIN SYSTEM (Invisible To Users)

Users never see plugins. They never toggle them. They never choose them. The system activates the right tools automatically based on what the user asked for.

### What Gets Installed (One Sweep, First Launch)

**Project Orchestration:**
- GSD (Get Shit Done) — full project lifecycle: questioning → research → requirements → roadmap → phased execution → verification. 11+ sub-agents. Cross-runtime (Claude Code, Gemini CLI, OpenCode).
- Claude-Flow/Ruflo — multi-agent swarm orchestration. Parallel agents, shared memory, self-learning hooks.
- Claude-Code-Workflows — 112 specialized agents, 146 skills, 72 plugins.

**Code Execution:**
- Codex CLI (OpenAI) — autonomous coding, git ops, PR creation
- Claude Code (Anthropic) — agentic coding with deep tool use
- Gemini CLI (Google) — Google ecosystem integration (future)

**Browser Automation:**
- Browser-Use — 89.1% success rate on web tasks, anti-detect, CAPTCHA solving
- Puppeteer MCP — Chrome control, data extraction

**Connectors (MCP Servers):**
- GitHub MCP — repos, PRs, issues, CI/CD
- Composio — 500+ SaaS integrations
- Context7 — live library documentation injection
- Memory MCP — persistent knowledge graph across sessions
- Supabase MCP — database/auth/storage (if user has Supabase)
- Playwright MCP — browser testing

**Research & Content:**
- Firecrawl — structured web data extraction
- Open Interpreter — desktop automation, PDF filling, doc editing

### Routing Logic
```
User request → Intake classification → Execution plan

"build me an ecom site" →
  Category: HYBRID (code + research + design)
  Orchestrator: GSD
  Execution: CLI (Codex) for code, ChatGPT for research/copy/images
  Sub-agents: scaffolder, designer, content writer, SEO optimizer

"research protein powder market" →
  Category: BROWSER-ONLY (research + analysis)
  Orchestrator: Direct prompt chain
  Execution: ChatGPT with web search enabled
  Output: Structured report in project folder

"create a pitch deck for investors" →
  Category: HYBRID (content + file generation)
  Orchestrator: Direct prompt chain
  Execution: ChatGPT for content, CLI for file generation (pptx)
  Output: .pptx file in project folder
```

---

## 7. UX PHILOSOPHY

### Core Principles
1. **No transparency = no trust.** Show everything that's happening. For MVP, show it raw. Style later.
2. **Show enough to make them happy.** Not every sub-agent's line-by-line action. Status updates: "Creating homepage," "Generating images," "Running tests." Like watching a team through glass.
3. **Never ask technical questions.** "Who's your customer?" not "What framework?" Technical decisions are automatic.
4. **Assume users are lazy, uneducated about AI, and just want results.** Every screen must pass the test: would a non-technical person understand this without help?
5. **Value over volume.** Better to ask 3 questions and deliver exactly right than auto-generate 50 files of mediocre output.
6. **Files, code, images — show them.** Mirror what CLI generates but formatted cleanly. Code appears as it's written, just not in a terminal font with green text on black.
7. **Default to Ale-like branding/premium aesthetic.** Next.js or equivalent. Not the easiest build option — the best-looking one. This applies to generated output too: premium defaults.

### Progress Display
Instead of:
```
$ codex "create landing page"
> Analyzing requirements...
> Creating src/app/page.tsx
> Creating src/components/Hero.tsx
> Running npm install...
> Starting dev server on localhost:3000
```

Show:
```
✦ Analyzing your requirements
✦ Creating the Homepage
✦ Building the Hero Section
✦ Installing dependencies
✦ Preview ready — [Open Preview]
```

Same information. Different feeling.

---

## 8. TECH STACK

### App Shell
- **Electron** (latest stable) — desktop app framework
- **BrowserView** — embedded browser for ChatGPT sign-in and interaction
- **electron-updater** — auto-update distribution
- **electron-builder** — .dmg packaging + notarization

### App UI (Our Overlay)
- **React** — component framework
- **Next.js patterns** (but running in Electron, not a web server) — premium feel
- **Tailwind CSS** — styling (minimal for MVP, polish later)
- Overlay renders ON TOP of the BrowserView, not replacing it

### Backend (Local, In-Process)
- **Node.js** — Electron's main process handles everything
- **child_process** — spawning CLI tools (Codex, Claude Code, GSD)
- **chokidar** — file system watching (detect generated files)
- **tree-kill** — clean process management for CLI tools

### CLI Tools (Installed On User's Machine)
- **nvm** — Node.js version management
- **pyenv** or **brew** — Python management
- **npm** — installing Codex CLI, Claude Code, GSD, MCP servers
- **pip** — installing Python-based tools (Browser-Use, Open Interpreter)

### DOM Interaction (ChatGPT Adapter)
- **Electron's webContents.executeJavaScript()** — inject JS into BrowserView
- **MutationObserver** — capture streaming responses from ChatGPT DOM
- Adapter interface: `injectMessage()`, `onResponseChunk()`, `onResponseComplete()`, `isReady()`

### Data & State
- **Local JSON files** — project state, user preferences, capability profile
- **SQLite** (via better-sqlite3) — conversation history, task logs (if needed)
- No cloud database. No Supabase for OUR app. Everything local.

### Distribution
- **.dmg** via electron-builder
- **Apple Developer ID** for notarization (no Gatekeeper warnings)
- **GitHub Releases** or **S3** for hosting update binaries
- Mac App Store submission in parallel (not blocking)

---

## 9. SPRINT PLAN — WEEK 1

### Day 1: Prove Sign-In Works (Pass/Fail Gate)
- Electron app shell with BrowserView
- Load ChatGPT login page
- Handle OAuth popups (Google, Microsoft, Apple sign-in)
- Confirm: user can sign into ChatGPT inside our app
- Confirm: BrowserView has full access to authenticated session
- **If this fails, entire approach pivots. This is day 1 for a reason.**

### Day 2: DOM Adapter + System Scan
- Build ChatGPT DOM adapter:
  - `injectMessage(text)` — type into ChatGPT's textarea and submit
  - `onResponseChunk(callback)` — MutationObserver on response container
  - `onResponseComplete(callback)` — detect generation finished
  - `isReady()` — check if signed in and on conversation page
- System environment scanner:
  - Detect: Node.js, Python, Git, Docker, RAM, OS version
  - Output: capability profile JSON
  - Store locally for plugin routing decisions

### Day 3: Auto-Installer + First Plugin Working
- Build installer sequence:
  - Install nvm + Node.js 20 LTS
  - Install Python 3.11+ via brew
  - Install Git if missing
  - `npm install -g @openai/codex` (Codex CLI)
  - `npm install -g @anthropic-ai/claude-code` (Claude Code)
  - Install GSD: `npm install -g gsd`
  - Install all MCP servers and skills
  - Show progress screen with friendly status messages
- Handle CLI ToS acceptance:
  - Detect interactive prompts from CLI tools
  - Display in our UI as dialogs
  - Pipe user acceptance back to process stdin
- First end-to-end test:
  - User types message → meta-prompt injected into ChatGPT → ChatGPT responds with intake questions → user answers → capture structured brief
  - **This proves the intake layer works**

### Day 4: CLI Runner + Task Routing
- CLI process manager:
  - Spawn Codex/Claude Code as child processes
  - Stream stdout/stderr to our overlay
  - Format terminal output as friendly status updates
  - Handle process lifecycle (start, monitor, kill, restart)
- Task router:
  - Classify incoming task (browser-only, local-required, hybrid)
  - Route to correct execution path
  - For hybrid: coordinate between ChatGPT browser and local CLI
- File watcher:
  - Monitor project output directory
  - Detect new/changed files
  - Show in overlay file tree
  - Preview support for common file types (HTML, images, code)

### Day 5: Plugin Framework + GSD Integration
- Plugin schema implementation:
  - Parse plugin configs
  - Resolve dependencies
  - Auto-activate based on task classification
  - No user-facing toggle — all automatic
- Wire up GSD as primary orchestrator:
  - Map GSD commands to our task flow
  - Translate GSD phase outputs to friendly progress updates
  - Handle GSD's sub-agent spawning and monitoring
- Wire up basic plugins:
  - Research mode (prompt framework only, browser-side)
  - Code builder (routes to Codex CLI)
  - Document writer (routes to CLI for file generation)

### Day 6: Polish + Persistence
- Task persistence:
  - Save state before each execution step
  - Resume capability after app restart
  - Background execution (menu bar mode)
- Auto-updater:
  - electron-updater configuration
  - GitHub Releases integration
  - Update prompt on app launch
- Error handling:
  - CLI crash recovery (retry from last step)
  - ChatGPT error detection (rate limit, network)
  - Graceful degradation messaging
- Token/usage awareness:
  - Estimate token usage from plugin execution plans
  - Show approximate % of session usage
  - Warn before hitting limits: "This task will use ~40% of your remaining messages. Continue?"
- New conversation per project:
  - Auto-create new ChatGPT conversation for each project
  - Name folder: `~/Documents/our_brand_name/[project-name]/`

### Day 7: Package + Ship
- electron-builder config for .dmg
- Apple notarization
- Landing page (GitHub Pages or simple HTML)
- Test full flow: fresh install → first launch → setup → sign in → intake → build → output
- Ship

---

## 10. KNOWN RISKS

| Risk | Impact | Mitigation |
|------|--------|------------|
| ChatGPT OAuth doesn't work in Electron BrowserView | Project-killing | Day 1 test. Pivot to system browser + WebSocket if needed. |
| OpenAI changes ChatGPT DOM | Adapter breaks | Multiple fallback selectors. Health-check on launch. "Direct mode" fallback. Weekend maintenance per DOM update. |
| Users hit ChatGPT message caps during orchestration | Tasks fail mid-execution | Token estimation, usage warnings, efficient prompt compression. |
| macOS security dialogs during CLI install | User abandonment | Batch permissions, explain in progress screen, sign everything. |
| CLI tools change their APIs/interfaces | Plugins break | Abstract CLI interaction behind adapter layer. Pin tool versions. |
| OpenAI ToS changes block embedded browser usage | Product viability threat | Multi-provider support. If OpenAI blocks, push users to Claude/Gemini. |
| GSD/Flow plugins have bugs or break | Core feature degraded | Pin to stable versions. Fallback to simpler prompt-chain orchestration. |

---

## 11. WHAT SUCCESS LOOKS LIKE

### Week 1
A non-technical person downloads a .dmg, installs it, opens it, signs into ChatGPT, types "build me a landing page for my dog walking business," answers 3-4 friendly questions, and watches as the app creates a complete, deployable website in their Documents folder. They never open a terminal.

### Month 1
500-1,000 users. 5 working execution paths (research, code, documents, web automation, full project). Community feedback driving plugin improvements.

### Month 3
10,000+ users. Gemini and Claude support. 20+ automatic plugins. Users building real businesses with the tool.

### Month 6
50,000+ users. Premium templates generating revenue. Team features in beta.

---

## 12. WHAT TO BUILD FIRST

The order matters. Each step proves the next is possible.

```
1. Electron + BrowserView + ChatGPT sign-in     ← PROVES: we can embed LLM
2. DOM adapter (inject + capture)                ← PROVES: we can control LLM
3. Meta-prompt intake quiz                       ← PROVES: we can add value on top
4. System scan + auto-installer                  ← PROVES: we can set up CLI tools
5. CLI process runner                            ← PROVES: we can execute locally
6. Task router (browser vs local vs hybrid)      ← PROVES: we can orchestrate
7. GSD/plugin integration                        ← PROVES: we can run real workflows
8. File output + progress display                ← PROVES: users get tangible results
9. Persistence + error recovery                  ← PROVES: it's reliable
10. Package + ship                               ← PROVES: it's distributable
```

Each numbered item is a gate. If any gate fails, we fix it before moving to the next. No skipping.

---

## 13. REPO STRUCTURE

```
~/Documents/unified-terminal/
├── package.json                    # Electron app dependencies
├── electron-builder.yml            # Build/packaging config
├── src/
│   ├── main/                       # Electron main process
│   │   ├── index.ts                # App entry point
│   │   ├── browser-view.ts         # ChatGPT embedded browser management
│   │   ├── cli-runner.ts           # Spawn and manage CLI processes
│   │   ├── system-scanner.ts       # Hardware/tool detection
│   │   ├── auto-installer.ts       # First-launch tool installation
│   │   ├── task-router.ts          # Classify and route tasks
│   │   ├── file-watcher.ts         # Monitor generated output
│   │   ├── updater.ts              # Auto-update logic
│   │   └── state-manager.ts        # Task persistence
│   │
│   ├── adapters/                   # LLM provider adapters
│   │   ├── adapter-interface.ts    # Shared interface definition
│   │   ├── chatgpt-adapter.ts      # ChatGPT DOM interaction
│   │   ├── claude-adapter.ts       # (Future) Claude.ai adapter
│   │   └── gemini-adapter.ts       # (Future) Gemini adapter
│   │
│   ├── plugins/                    # Plugin framework
│   │   ├── plugin-schema.ts        # Plugin definition types
│   │   ├── plugin-loader.ts        # Load and resolve plugins
│   │   ├── plugin-router.ts        # Activate plugins per task
│   │   └── configs/                # Plugin JSON configs
│   │       ├── gsd.json
│   │       ├── claude-flow.json
│   │       ├── research.json
│   │       ├── code-builder.json
│   │       └── doc-writer.json
│   │
│   ├── intake/                     # The intake layer
│   │   ├── meta-prompts.ts         # Prompt frameworks for intake quiz
│   │   ├── task-classifier.ts      # Categorize user requests
│   │   └── brief-builder.ts        # Structure captured answers
│   │
│   ├── renderer/                   # Electron renderer (our overlay UI)
│   │   ├── index.html
│   │   ├── App.tsx                 # Root React component
│   │   ├── components/
│   │   │   ├── Overlay.tsx         # Main overlay container
│   │   │   ├── ProgressBoard.tsx   # Task progress display
│   │   │   ├── FileTree.tsx        # Generated files browser
│   │   │   ├── StatusBar.tsx       # Bottom status + usage
│   │   │   ├── SetupScreen.tsx     # First-launch install progress
│   │   │   └── IntakeQuiz.tsx      # (Future) Branded intake UI
│   │   └── styles/
│   │       └── globals.css         # Tailwind + minimal custom
│   │
│   └── utils/
│       ├── logger.ts               # Structured logging
│       ├── process-utils.ts        # Child process helpers
│       └── dom-selectors.ts        # ChatGPT DOM element selectors (easy to update)
│
├── scripts/
│   ├── install-tools.sh            # CLI tool installation script
│   └── notarize.js                 # Apple notarization for .dmg
│
├── assets/
│   ├── icon.icns                   # App icon (macOS)
│   └── icon.png                    # App icon (general)
│
└── docs/
    ├── CONTEXT.md                  # This file
    ├── BOTTLENECKS.md              # Known issues and solutions
    └── SPRINT.md                   # Day-by-day build log
```

---

## 14. IMPORTANT NOTES

- **Frontend styling is last.** Everything visual is noise until the pipeline works. Get the process working first. Make it pretty at the end.
- **Name, URL, branding — last thing to do.** Don't waste time on this during sprint.
- **Assume premium output defaults.** When generating code for users, default to Next.js, Tailwind, premium aesthetic. Not the easiest option — the best-looking one. "Ale-like branding" unless user explicitly specifies otherwise.
- **We are not building for developers.** Every decision filters through: "would a non-technical person understand this?" If no, redesign.
- **Plugins are invisible.** Users never know they exist. They just work.
- **One sweep install.** Don't cascade, don't lazy-load. Install everything on first launch. Nobody cares what's installed. They care that it works.
- **Each LLM adapter is independent.** OpenAI adapter today. Same interface, different implementation for Claude and Gemini later. The rest of the app doesn't change.
- **Token usage matters.** Plugin frameworks already track this. We extrapolate to show users approximate % remaining. Warn before they get pissed, not after.
- **Error recovery is table stakes.** CLI crashes. Networks drop. The app saves state before each step and offers "retry from last step." This isn't a nice-to-have — it's minimum viable.
- **We are a wrapper. That's fine.** The value is in the intake layer, the automatic routing, and the UX. The raw power comes from tools other people built. We make those tools accessible. That's the entire business.
