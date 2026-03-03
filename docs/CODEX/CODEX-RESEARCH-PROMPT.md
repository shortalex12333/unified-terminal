# CODEX OVERNIGHT RESEARCH TASK
## Run: `codex --full-auto` with this file as input
## Expected: ~1M tokens, 6-8 hours autonomous execution

---

You are a senior systems architect researching best practices for building an AI agent orchestration platform. This platform wraps CLI tools (Codex, Claude Code, GSD, Claude-Flow) inside an Electron desktop app so non-technical users can leverage them without ever seeing a terminal.

Your research output will be saved to `~/Documents/unified-terminal/research/` with one markdown file per section. Create the directory if it doesn't exist.

You have internet access. Use it extensively. Search GitHub repos, read READMEs, examine source code, read blog posts, documentation, and issue trackers. Do not summarize from memory — fetch real, current information.

---

## SECTION 1: CLI RUNNER ARCHITECTURE
**Output file: `research/01-cli-runner-architecture.md`**

Research how the best open-source projects handle spawning and managing CLI child processes in Electron/Node.js apps. Specifically investigate:

### 1.1 Process Spawning
- Compare `child_process.spawn` vs `child_process.exec` vs `node-pty` vs `execa` for long-running AI CLI tools
- What does VS Code use internally to run terminal processes? Examine their source: https://github.com/microsoft/vscode — look at `src/vs/platform/terminal/`
- What does Warp terminal use? https://github.com/warpdotdev
- What does Hyper terminal use? https://github.com/vercel/hyper
- How does Cursor IDE spawn AI agents? Look at their architecture if any public info exists
- For each approach: pros, cons, memory usage, TTY support, signal handling, cross-platform behavior
- Specific recommendation for our use case: spawning Codex CLI, Claude Code, and GSD which are all long-running, interactive, TTY-dependent processes

### 1.2 Output Streaming & Parsing
- How to capture stdout/stderr in real-time from CLI processes without buffering delays
- How to strip ANSI escape codes, color codes, cursor movements from terminal output
- How to parse unstructured terminal output into structured status updates
- Research the `strip-ansi` npm package, `ansi-regex`, and alternatives
- How does iTerm2 parse terminal output? How does Warp do it?
- Pattern matching approaches for translating CLI output to user-friendly messages:
  - "Creating src/app/page.tsx" → "Creating the Homepage"
  - "npm install" → "Installing dependencies"
  - "error: ..." → "Issue detected"
- Research how GitHub Actions parses and groups terminal output into collapsible sections
- Research how Vercel's build output is parsed and displayed in their dashboard

### 1.3 Interactive Prompt Handling
- How to detect when a CLI process is waiting for user input (stdin)
- How to programmatically respond to interactive prompts
- Research `expect` (the Unix tool) and Node.js equivalents: `node-expect`, `spawn-expect`
- How does `node-pty` handle interactive prompts differently from `child_process`?
- Specific investigation: how does Codex CLI's `--full-auto` flag work vs interactive mode?
- Specific investigation: how does Claude Code's `--dangerously-skip-permissions` work?
- Specific investigation: what interactive prompts does GSD show during `/gsd:new-project` and `/gsd:execute-phase`?
- For each tool: document every interactive prompt a user might encounter and what the expected input is

### 1.4 Process Lifecycle Management
- How to gracefully kill long-running processes and all their children
- Research `tree-kill` vs `process.kill` vs `taskkill` (Windows) vs `kill -9`
- How to detect zombie processes and clean them up
- How to handle process crashes and automatic restart
- How to pause/resume processes (SIGSTOP/SIGCONT)
- How to set process priority (nice levels) so CLI tools don't hog the CPU
- How to limit memory usage per process
- How to handle multiple concurrent CLI processes (GSD spawns sub-agents which spawn their own processes)
- Research process pooling and queueing strategies

### 1.5 Environment & PATH Management
- How Electron apps should set up PATH for child processes
- How nvm-installed Node.js affects PATH in child processes
- How to ensure npm global packages are findable
- How to handle Python virtual environments in child processes
- Research how VS Code's integrated terminal resolves PATH
- Document the exact PATH construction needed for: Codex CLI, Claude Code, GSD, Gemini CLI, all MCP servers

---

## SECTION 2: PLUGIN ECOSYSTEM DEEP DIVE
**Output file: `research/02-plugin-ecosystem.md`**

### 2.1 GSD (Get Shit Done) — Complete Analysis
Search and read the full GSD repository: https://github.com/gsd-build/get-shit-done

Document:
- Every slash command available (`/gsd:new-project`, `/gsd:discuss-phase`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`, `/gsd:complete-milestone`, `/gsd:new-milestone`, `/gsd:map-codebase`, `/gsd:debug`, etc.)
- Every sub-agent GSD uses (gsd-planner, gsd-plan-checker, gsd-phase-researcher, gsd-roadmapper, gsd-project-researcher, gsd-research-synthesizer, gsd-codebase-mapper, etc.) — document what each one does
- The full lifecycle flow: questioning → research → requirements → roadmap → discuss-phase → plan-phase → execute-phase → verify-work → complete-milestone
- What files GSD creates: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, .planning/ directory structure
- How GSD handles model selection (quality/balanced/budget profiles)
- How GSD tracks token usage and manages context windows
- How GSD's multi-runtime support works (Claude Code, Gemini CLI, OpenCode adapters)
- GSD's installer system — how it converts commands between runtimes
- Common failure modes and how GSD recovers
- GSD's verification system — how it validates phase completion
- Token cost data: how many tokens does a typical GSD project consume per phase?
- What makes GSD good: strengths, unique approaches, what problems it actually solves
- What makes GSD bad: limitations, known issues, common complaints from users (check GitHub issues)
- How to run GSD programmatically (not interactively) — can we pipe commands to it?

### 2.2 Claude-Flow / Ruflo — Complete Analysis
Search and read: https://github.com/ruvnet/ruflo (or claude-flow)

Document:
- Architecture: how does multi-agent swarm orchestration work?
- What topologies are supported (hierarchical, mesh, adaptive)?
- How does agent-to-agent communication work?
- How does the memory system work (HNSW-indexed search)?
- How do hooks and self-learning patterns work?
- How does it integrate with Claude Code and Codex simultaneously?
- The stream-json chaining system for real-time agent piping
- Performance benchmarks: how fast is it vs sequential execution?
- Token usage: how many tokens does swarm orchestration add on top of the actual task?
- Can it run headlessly / programmatically?
- Common failure modes

### 2.3 Claude-Code-Workflows / Agents — Complete Analysis
Search and read: https://github.com/wshobson/agents

Document:
- All 72 plugins — what does each one do?
- The 112 specialized agents — categorize by domain (architecture, language, infrastructure, quality, data/AI, documentation, business, SEO)
- The 146 agent skills — how does progressive disclosure work?
- The Conductor workflow (context → spec → plan → implement)
- Agent Teams feature — how does multi-agent orchestration work?
- How plugins are composed and installed
- Token efficiency: which plugins are lightweight vs heavy?

### 2.4 Shipyard — Analysis
Search and read about Shipyard plugin.

Document:
- How it combines GSD lifecycle with Superpowers skill framework
- IaC validation (Terraform, Ansible, Docker, K8s, CloudFormation)
- Security auditor agent
- Code simplification features
- When to use Shipyard vs GSD vs Claude-Code-Workflows

### 2.5 Other Notable Plugins
For each of these, search GitHub, read the README, and document what it does, how it works, token efficiency, and whether it's useful for our product:

- **Superpowers** — structured lifecycle planning + skills framework
- **Local-Review** — parallel code review agents
- **Dev-Browser** — lightweight Playwright alternative
- **Plannotator** — structured planning annotations
- **MCP-Builder** — skill for creating MCP servers
- **Connect-Apps (Composio)** — 500+ SaaS integrations
- **Context7** — live documentation injection
- **Memory MCP** — persistent knowledge graph
- **Claude-Mem** — long-term memory across sessions
- **Brave Search MCP** — web search for Claude Code
- **Puppeteer MCP** — browser automation
- **Reddit MCP** — social media integration
- **GitHub MCP** — full GitHub API integration
- **PostgreSQL MCP** — database queries
- **File System MCP** — advanced file operations
- **SQLite MCP** — SQLite management
- **Blender MCP** — 3D modeling
- **System MCP** — terminal commands and file ops

### 2.6 Plugin Quality Assessment Framework
Based on all the above research, create a scoring framework for evaluating plugins:
- Reliability (does it actually work consistently?)
- Token efficiency (how many tokens does it consume per task?)
- Value density (how much useful output per token spent?)
- User complexity (how much setup/configuration needed?)
- Error recovery (does it handle failures gracefully?)
- Maintenance burden (how often does it break with updates?)
- Cross-model compatibility (does it work with Codex, Claude Code, Gemini CLI?)
- Output quality (does it produce production-grade results?)

Score every plugin from 2.1-2.5 using this framework.

---

## SECTION 3: TOKEN ECONOMICS & MODEL ROUTING
**Output file: `research/03-token-economics.md`**

### 3.1 Token Usage Per Task Type
Research and estimate token consumption for common user tasks:
- "Build me a landing page" — how many tokens across intake + planning + execution + verification?
- "Research the protein powder market" — how many tokens for comprehensive research?
- "Create a pitch deck" — tokens for content + file generation?
- "Build an ecom store with payments" — tokens for full GSD lifecycle?
- "Automate filling out 10 forms" — tokens for browser automation?

For each, break down: intake quiz tokens, system prompt tokens, sub-agent orchestration tokens, actual generation tokens, verification tokens.

### 3.2 ChatGPT Tier Limits
Research current (March 2026) limits for:
- ChatGPT Free: messages per hour, model access, web search access, image generation
- ChatGPT Plus ($20/mo): messages per hour for GPT-4o, GPT-4o-mini, web search, DALL-E
- ChatGPT Pro ($200/mo): limits, o1 access, advanced features
- ChatGPT Team: per-user limits
- How do these limits affect our orchestration? If we send 20 messages for an intake quiz + GSD phases, how fast do users hit caps?

### 3.3 Model Routing Strategy
- When to use GPT-4o (reasoning, planning, complex decisions)
- When to use GPT-4o-mini (quick tasks, classification, simple responses)
- When to use DALL-E (image generation within workflows)
- When to use web search (research tasks, current data)
- How to detect which models are available in the user's ChatGPT tier
- How to switch models mid-conversation via DOM manipulation of ChatGPT's model selector
- Can we use different models for different phases of a GSD project?

### 3.4 Token Optimization Strategies
- How to minimize system prompt size while maintaining quality
- Prompt compression techniques (research from academic papers)
- How GSD manages context windows across long projects
- How Claude-Flow's token optimizer works (claims 32% reduction)
- How Context7 MCP reduces token usage by providing only relevant documentation
- When to start new conversations vs continue existing ones
- How to summarize previous context when starting new conversations

### 3.5 Cost Estimation for Users
- Build a model: for a typical user running 5 tasks per day on ChatGPT Plus, how many tasks can they complete before hitting limits?
- Compare: same tasks using Codex CLI (API-based, token costs) vs ChatGPT browser (subscription-based, message limits)
- What's the actual "free" capacity? How much can users do before the product feels limited?

---

## SECTION 4: MCP SERVER ARCHITECTURE
**Output file: `research/04-mcp-servers.md`**

### 4.1 MCP Protocol Deep Dive
Search and read: https://spec.modelcontextprotocol.io/

Document:
- The full MCP protocol specification (tools, resources, prompts, sampling)
- How MCP servers are started and connected
- stdio vs SSE vs WebSocket transports
- How tool annotations work (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- How context is managed across MCP server connections
- MCP tool search / lazy loading (how does it reduce context usage by 95%?)

### 4.2 Running MCP Servers in Our App
- How to start MCP servers from within an Electron app
- How to manage multiple MCP server processes simultaneously
- How to route tool calls from CLI agents to the correct MCP server
- Memory and CPU impact of running 5-10 MCP servers simultaneously
- How to lazy-load MCP servers (start on demand, stop when idle)

### 4.3 Essential MCP Servers for Our Product
For each MCP server we plan to bundle, document:
- How to install
- How to configure
- What tools it provides
- Token overhead (schema size injected into context)
- Dependencies
- Whether it requires API keys or external accounts
- Reliability and maintenance status

### 4.4 MCP Server Conflict Resolution
- What happens when multiple MCP servers provide similar tools?
- How to namespace tools to avoid conflicts
- How to prioritize which MCP server handles a request
- Token budget: if we load 10 MCP server schemas, how many tokens does that consume?

---

## SECTION 5: AUTO-INSTALLER RESEARCH
**Output file: `research/05-auto-installer.md`**

### 5.1 Tool Installation on macOS
For each tool, document the exact installation command, verification command, common failure modes, and macOS-specific gotchas:

- **Homebrew**: installation, sudo requirements, Apple Silicon vs Intel paths, how to detect if already installed
- **Xcode Command Line Tools**: how to install silently, the popup that can't be automated, how to detect if installed
- **Node.js via nvm**: install nvm, install Node 20 LTS, set default, verify, PATH setup
- **Python via brew**: install, verify, PATH for pip packages, how to avoid conflicting with system Python
- **Git**: usually pre-installed on macOS, how to verify
- **Codex CLI**: `npm install -g @openai/codex`, version check, first-run auth flow
- **Claude Code**: `npm install -g @anthropic-ai/claude-code`, version check, first-run auth flow
- **GSD**: installation method (npm or git clone), version check, dependency on Claude Code
- **Claude-Flow/Ruflo**: installation method, dependencies
- **Browser-Use**: `pip install browser-use`, Python dependencies, Playwright browsers
- **Playwright**: `npx playwright install`, browser binary downloads (size warning: ~500MB)
- **Open Interpreter**: `pip install open-interpreter`, dependencies

### 5.2 Silent Installation Patterns
Research how other Electron apps handle first-launch dependency installation:
- How does VS Code install extensions and language servers silently?
- How does Docker Desktop install its CLI tools?
- How does Homebrew Cask handle post-install scripts?
- How does nvm handle shell profile modification (`.zshrc`, `.bashrc`)?

### 5.3 Error Recovery for Installation
- What if Homebrew install fails (no sudo, no internet, disk full)?
- What if npm install fails (permission denied, package not found)?
- What if Python version conflict exists?
- How to retry failed installations
- How to skip non-critical tools and continue

### 5.4 Installation Time Estimates
Research and estimate download sizes and install times for each tool on a 100Mbps connection:
- Homebrew: download size, install time
- Node.js: download size, install time
- Python: download size, install time
- Codex CLI + dependencies: download size
- Claude Code + dependencies: download size
- GSD + all skills: download size
- Playwright browsers: download size (this is the big one)
- Total: estimated time and disk space for full sweep

---

## SECTION 6: CHATGPT DOM INTERACTION
**Output file: `research/06-chatgpt-dom.md`**

### 6.1 Current ChatGPT DOM Structure (March 2026)
- Load chatgpt.com and document the current DOM structure
- The exact element for the message input (contentEditable div? textarea? ProseMirror?)
- The exact element for the send button
- The exact element for response containers
- The exact element for the model selector
- The exact element for "new chat" button
- The exact element for conversation history sidebar items
- The exact element for the stop/regenerate buttons
- The exact element for web search toggle
- The exact element for image generation results
- How code blocks are rendered in responses
- How "thinking" and "searching" indicators are structured

### 6.2 DOM Injection Strategies
Research the most reliable ways to programmatically type into ChatGPT:
- ClipboardEvent paste approach (our current implementation)
- React fiber/internals approach (accessing React's internal state)
- InputEvent approach with native value setter
- execCommand('insertText') approach
- Keyboard event simulation character by character
- For each: reliability score, speed, risk of detection, risk of breaking on DOM updates
- What do browser automation tools (Playwright, Puppeteer) use?
- What does the AIPRM Chrome extension use?

### 6.3 Response Capture Strategies
- MutationObserver approach (our current implementation)
- Network interception (intercepting SSE/fetch before DOM render)
- Polling approach (setInterval checking last response)
- IntersectionObserver for detecting new messages scrolling in
- For each: reliability, latency, resource usage, risk of missing tokens

### 6.4 DOM Change History
Research how often ChatGPT's DOM has changed in the past year:
- Check web archives, GitHub issues on AIPRM and similar extensions
- What selectors broke and when?
- What's the typical lifespan of a selector before it changes?
- Best practices for building resilient selectors

---

## SECTION 7: COMPETITIVE ANALYSIS
**Output file: `research/07-competitive-analysis.md`**

### 7.1 Existing Products in This Space
For each competitor, document: what it does, pricing, user count, tech stack, strengths, weaknesses, what we can learn:

- **AIPRM** — ChatGPT prompt management extension (2M+ users)
- **Monica AI** — browser AI assistant (5M+ users)
- **TypingMind** — ChatGPT alternative frontend
- **LibreChat** — open-source multi-provider chat
- **Open WebUI** — open-source LLM frontend
- **Chatbox** — desktop AI client
- **Jan** — offline AI assistant
- **Msty** — local AI chat interface
- **Claude Cowork** — Anthropic's own GUI wrapper for Claude Code
- **Cursor** — AI code editor (different market but relevant architecture)
- **Windsurf** — AI code editor
- **Bolt.new** — browser-based AI code generator
- **v0.dev** — Vercel's AI UI generator
- **Replit Agent** — browser-based AI developer

### 7.2 What They Got Right
Synthesize: across all competitors, what UX patterns, features, and architectures work well?

### 7.3 What They Got Wrong
Synthesize: common failures, user complaints, limitations that create our opportunity.

### 7.4 Our Differentiation
Based on competitive research, refine our positioning: what specifically can we do that none of them can?

---

## SECTION 8: ERROR HANDLING & RECOVERY PATTERNS
**Output file: `research/08-error-recovery.md`**

### 8.1 Error Taxonomy
Research and categorize every error type our app might encounter:
- Network errors (disconnection, timeout, DNS failure)
- Auth errors (token expired, session invalid, 2FA required)
- CLI errors (process crash, OOM, permission denied, tool not found)
- DOM errors (selector not found, page structure changed, content security policy)
- LLM errors (rate limit, context overflow, content filter, model unavailable)
- File system errors (disk full, permission denied, path too long)
- User errors (invalid input, cancelled mid-task, closed app during execution)

### 8.2 Recovery Strategies Per Error Type
For each error type, document:
- Detection method (how do we know it happened?)
- User-facing message (non-technical, actionable)
- Automatic recovery action (retry? skip? fallback?)
- State preservation (what do we save before recovery?)
- Escalation path (when do we give up and tell the user?)

### 8.3 How Other Products Handle Errors
- How does Vercel handle build failures in their dashboard?
- How does GitHub Actions display and recover from workflow errors?
- How does VS Code handle extension crashes?
- How does Electron handle renderer process crashes?

---

## SECTION 9: SECURITY & PRIVACY
**Output file: `research/09-security-privacy.md`**

### 9.1 Electron Security Best Practices
- Research Electron's security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- How to properly configure BrowserView for untrusted content
- Context isolation, sandbox mode, node integration risks
- How to prevent XSS from ChatGPT's DOM affecting our app
- How to securely handle OAuth tokens

### 9.2 CLI Tool Security
- How to safely spawn child processes without shell injection
- How to handle user credentials for Codex/Claude Code
- Where auth tokens are stored on the filesystem (are they encrypted?)
- How to prevent plugins from accessing files outside the project directory

### 9.3 User Privacy
- What data does our app collect? (Answer should be: nothing)
- How to ensure ChatGPT conversations stay in the user's session only
- How to handle the fact that ChatGPT trains on conversations

---

## SECTION 10: PERFORMANCE & OPTIMIZATION
**Output file: `research/10-performance.md`**

### 10.1 Electron Performance
- Memory usage baseline for Electron app with BrowserView
- How to prevent memory leaks from long-running BrowserView sessions
- How to handle Electron's known high memory usage
- macOS App Nap prevention for background execution
- How to profile and optimize Electron apps

### 10.2 CLI Process Performance
- How to limit concurrent child processes based on available CPU/RAM
- Process pooling strategies for frequent short-lived tasks
- How to detect when the system is under load and throttle accordingly
- Expected resource usage: Codex CLI, Claude Code, GSD running simultaneously

### 10.3 Startup Time Optimization
- How to reduce Electron cold start time
- Lazy loading strategies for features not needed on launch
- How to make the "second launch" (no install needed) feel instant

---

## SECTION 11: DISTRIBUTION & UPDATES
**Output file: `research/11-distribution.md`**

### 11.1 macOS Distribution
- Code signing with Apple Developer ID — exact steps
- Notarization process — automated via electron-builder
- DMG creation best practices
- Universal binary (arm64 + x64) vs separate builds
- How to handle Gatekeeper on first launch

### 11.2 Auto-Update Architecture
- electron-updater: how it works, configuration, best practices
- Differential updates vs full downloads
- How to host updates (GitHub Releases vs S3 vs custom server)
- How to handle update failures gracefully
- How to force-update for critical security fixes
- How Slack, Discord, VS Code handle auto-updates

### 11.3 Crash Reporting
- How to collect crash reports from Electron (without compromising privacy)
- Sentry vs Electron's built-in crashReporter
- How to get useful diagnostics without collecting user data

---

## OUTPUT FORMAT

For each section, create a comprehensive markdown file with:
1. Executive summary (3-5 sentences)
2. Detailed findings with code examples where applicable
3. Specific recommendations for our product
4. Sources cited with URLs
5. Open questions that need further investigation

Save all files to `~/Documents/unified-terminal/research/`

Create an index file `research/00-index.md` that summarizes all sections with key takeaways and prioritized action items.

Total expected output: 11 research files + 1 index file.

Take your time. Be thorough. Use real sources. This research will guide the entire build.
