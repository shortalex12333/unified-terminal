# BUILD STATUS — What Exists, What's Next
## Last Updated: March 2, 2026

---

## SCAFFOLD ASSESSMENT

The repo at `~/Documents/unified-terminal/` has a complete Electron app scaffold. Here's what's coded vs what needs work.

---

## GATE 1: Electron + ChatGPT Sign-In

### Status: CODED — NEEDS TESTING

**What exists:**
- Electron main process with BrowserWindow + BrowserView (`src/main/index.ts`)
- Persistent session partition: `session.fromPartition('persist:chatgpt', { cache: true })`
- OAuth popup handler via `setWindowOpenHandler` covering Google, Microsoft, Apple, Auth0, OpenAI domains
- Custom user agent to avoid bot detection
- Single instance lock (prevents multiple app windows)
- macOS hiddenInset title bar with traffic light positioning
- Window resize handler keeps BrowserView properly sized
- Permission handler for clipboard and notifications

**What needs testing:**
- Does `chatgpt.com` load correctly in BrowserView?
- Does Google OAuth popup open and complete?
- Does Microsoft OAuth popup open and complete?
- Does Apple OAuth popup open and complete?
- Does email/password sign-in work?
- Does session persist after app restart?
- Does 2FA complete successfully?
- Does ChatGPT detect the session as Plus/Pro tier?

**What might need fixing:**
- OAuth redirect flows (some providers redirect instead of popup — may need `will-navigate` handler)
- If OpenAI blocks embedded browser via bot detection, need to adjust user agent or add `webContents.on('did-navigate')` handling
- BrowserView bounds calculation on first load before window is fully rendered

**Risk level:** Medium. The code is correct in principle. OAuth popup handling is the unknown.

---

## GATE 2: DOM Injection (Sending Messages)

### Status: CODED — NEEDS TESTING

**What exists:**
- IPC handler `chatgpt:inject` in main process
- ClipboardEvent paste strategy (most reliable for contentEditable)
- Fallback: keyboard Enter event if send button not found
- Send button click as primary send method
- 300ms delay between paste and send (lets React state update)
- Fallback selector chain via `buildFindElement()` helper

**What needs testing:**
- Does the paste strategy work with ChatGPT's current contentEditable div?
- Does React's state pick up the pasted content?
- Does the send button click trigger message submission?
- Does Enter key fallback work?
- Works on fresh conversation vs existing conversation?

**What might need fixing:**
- ChatGPT's input element type or selectors may have changed since scaffold was written
- The 300ms delay may be insufficient — may need to poll for React state update
- May need `nativeInputValueSetter` strategy for textarea fallback (if ChatGPT reverts from contentEditable)

**Risk level:** Medium. Paste via ClipboardEvent is the most reliable approach but ChatGPT's DOM is a moving target.

---

## GATE 3: DOM Capture (Reading Responses)

### Status: CODED — NEEDS TESTING

**What exists:**
- IPC handler `chatgpt:capture-start` sets up polling capture
- 150ms poll interval watches for response container changes
- Stop button detection for generation-in-progress state
- Completion detection: stop button disappears + content exists
- Main process polls BrowserView state every 200ms via `executeJavaScript`
- Streams chunks to renderer via `chatgpt:chunk` IPC event
- Captures innerHTML (preserves formatting, code blocks)

**What needs testing:**
- Does the response container selector find assistant messages?
- Does the polling capture tokens as they stream in?
- Is completion detection reliable (stop button presence/absence)?
- Does it handle code blocks, images, and mixed content?
- Does it handle errors (rate limit, network)?
- Does the `__captureBuffer` / `__captureComplete` pattern survive across messages?

**What might need fixing:**
- Response container selector may need updating
- innerHTML capture may include UI artifacts (copy buttons, etc.) — may need to filter
- Multiple rapid messages could confuse the "last response" detection
- Memory cleanup of `__captureInterval` if capture is started multiple times

**Risk level:** Low-Medium. The approach is sound. Selector accuracy is the main concern.

---

## GATE 4: Meta-Prompt Intake

### Status: CODED — NEEDS INTEGRATION TESTING

**What exists:**
- `INTAKE_PROMPT` template with `{USER_MESSAGE}` substitution (`src/intake/meta-prompts.ts`)
- `BRIEF_BUILDER_PROMPT` for structured JSON output after Q&A
- `RESEARCH_PROMPT` for research-only tasks
- `classifyTask()` function with signal-based scoring (`src/intake/task-classifier.ts`)
- `parseBriefFromJSON()` to parse ChatGPT's structured output (`src/intake/brief-builder.ts`)
- Task types: build_product, build_content, research, automate, general

**What needs building:**
- The actual intake FLOW: intercept user message → inject meta-prompt → wait for ChatGPT response → user answers → inject brief builder prompt → parse JSON → route to execution
- This is an orchestration sequence that ties Gates 2+3 together with the intake prompts
- Need to handle: user skips questions, user gives vague answers, ChatGPT doesn't follow format

**What needs testing:**
- Does the intake prompt generate good non-technical questions?
- Does the brief builder prompt produce valid JSON?
- Does the flow work end-to-end: type → quiz → answers → brief → route?
- Does skip/decline handling work?

**Risk level:** Low. The prompts exist. The flow just needs to be wired together.

---

## GATE 5: System Scan + Auto-Installer

### Status: SCAN CODED, INSTALLER IS PLACEHOLDER

**What exists:**
- `SystemScanner` class detects: Node.js, Python, Git, Docker, Codex, Claude Code, GSD (`src/main/system-scanner.ts`)
- Outputs structured `SystemProfile` with tools and capabilities
- IPC handler `system:scan` exposes to renderer
- IPC handler `system:install-tools` exists but is a PLACEHOLDER

**What needs building:**
- The entire auto-installer: `src/main/auto-installer.ts`
- Install sequence: Homebrew → Node.js (nvm) → Python (brew) → Git → Codex CLI → Claude Code → GSD → all MCP servers → all skills
- Progress reporting via IPC to renderer
- Error handling per install step (continue on failure, track what failed)
- SetupScreen component in renderer to show progress
- Skip-if-present logic for subsequent launches
- macOS password prompt handling for Homebrew
- `scripts/install-tools.sh` referenced in repo structure but doesn't exist yet

**Risk level:** Medium-High. This is a lot of sequential system operations with many failure modes (permissions, network, macOS security dialogs).

---

## GATE 6: CLI Tool Auth + Terms

### Status: NOT BUILT

**What needs building:**
- Interactive prompt detection in CLI stdout
- UI dialog display for auth/ToS prompts
- stdin piping for user responses
- Per-tool auth handlers (Codex GitHub auth, Claude Code Anthropic auth)
- May need `node-pty` for proper TTY emulation (not in package.json yet)
- Auth persistence verification

**Risk level:** Medium. Each CLI tool has different auth flows.

---

## GATE 7: CLI Process Management

### Status: CODED — NEEDS ENHANCEMENT

**What exists:**
- `CLIRunner` class with spawn/kill/killAll (`src/main/cli-runner.ts`)
- Process tracking via Map
- stdout/stderr streaming via EventEmitter
- tree-kill for clean child process cleanup
- PATH augmented to include npm global and nvm paths
- IPC handlers `cli:run` and `cli:kill`

**What needs building:**
- Terminal output → friendly status update translation (the pattern matching layer)
- Multiple concurrent process coordination
- GSD-specific process management (it spawns sub-agents)
- Process timeout handling
- Crash detection and recovery prompts
- May need `node-pty` instead of `child_process.spawn` for TTY-dependent tools

**Risk level:** Low-Medium. Core is solid. Enhancement is incremental.

---

## GATE 8: Task Routing

### Status: CODED — NEEDS REFINEMENT

**What exists:**
- `TaskRouter` class with keyword-based classification (`src/main/task-router.ts`)
- Three categories: browser_only, local_only, hybrid
- Suggested plugins per category
- Detection flags: requiresCLI, requiresWebSearch, requiresImageGen
- Default to hybrid for ambiguous tasks

**What needs building:**
- Integration with intake brief (currently classifies raw message, should also consider structured brief)
- Actual execution orchestration per path (browser path, local path, hybrid coordinator)
- Plugin activation based on routing decision

**Risk level:** Low. Logic is straightforward. Execution orchestration is the real work.

---

## GATE 9: File Output + Project Structure

### Status: CODED — NEEDS INTEGRATION

**What exists:**
- `FileWatcher` class with chokidar (`src/main/file-watcher.ts`)
- File tree generation with depth control
- Ignores node_modules and .git
- Change detection (add, change, remove events)
- IPC handlers `files:tree` and `files:changed`
- `PROJECT_ROOT` set to `~/Documents/our_brand_name`

**What needs building:**
- Project folder auto-creation per task
- Setting correct `cwd` when spawning CLI processes
- File preview in renderer (HTML iframe, image display, code syntax highlighting)
- "Open in Finder" / "Open in VS Code" buttons
- Project listing and management UI

**Risk level:** Low. Standard file system operations.

---

## GATE 10: GSD + Plugin Orchestration

### Status: NOT BUILT

**What exists:**
- Plugin config directory exists (`src/plugins/configs/`) but is empty
- Plugin schema types referenced in CONTEXT.md but not implemented

**What needs building:**
- Plugin schema definition (`src/plugins/plugin-schema.ts`)
- Plugin loader and dependency resolver
- GSD-specific integration (map GSD commands to our task flow)
- Phase progress translation for overlay display
- Plugin configs for GSD, Claude-Flow, research, code-builder, doc-writer

**Risk level:** Medium. GSD integration is the most complex plugin and will surface edge cases.

---

## GATE 11: Task Persistence

### Status: PARTIALLY CODED

**What exists:**
- `StateManager` class with save/load/init (`src/main/state-manager.ts`)
- State stored in Electron's userData directory as JSON files
- `saveAll()` called on app quit

**What needs building:**
- Per-task state serialization (save before each execution step)
- Resume logic on app restart
- Menu bar / tray icon for background running
- macOS App Nap prevention
- Notification system (task complete, input needed)

**Risk level:** Low-Medium. StateManager foundation is solid.

---

## GATE 12: Auto-Updater

### Status: DEPENDENCY INSTALLED, NOT CONFIGURED

**What exists:**
- `electron-updater` in package.json dependencies
- `electron-builder.yml` has `publish: provider: github` config
- Entitlements plist allows network access

**What needs building:**
- `src/main/updater.ts` — check for updates on launch, download, prompt install
- GitHub Releases setup (owner/repo in electron-builder.yml still says "OWNER")
- Signing and notarization scripts (`scripts/notarize.js` referenced but empty)

**Risk level:** Low. electron-updater is well-documented and reliable.

---

## GATE 13: Error Recovery

### Status: NOT BUILT

**What needs building:**
- Error catalogue with recovery strategies per error type
- Retry logic for transient failures
- State preservation on crash
- User-facing error messages (non-technical, actionable)
- ChatGPT session reconnection after sleep/wake

**Risk level:** Low. Incremental work across existing modules.

---

## GATE 14: Packaging

### Status: CONFIG EXISTS, NOT TESTED

**What exists:**
- `electron-builder.yml` with full macOS config (dmg, arm64+x64, hardened runtime)
- Entitlements plist with required permissions
- Build script in package.json: `npm run dist:mac`
- App ID: `com.unified-terminal.app`

**What needs building/testing:**
- Apple Developer ID signing (need to configure in electron-builder or env vars)
- Notarization script
- Test on clean macOS account
- Verify dmg opens, installs to /Applications, and launches without security warnings

**Risk level:** Low-Medium. Config is solid but needs actual signing credentials and test.

---

## SUMMARY SCORECARD

| Gate | Status | Effort Remaining | Day |
|------|--------|-----------------|-----|
| 1. Electron + Sign-in | Coded, needs test | 2-4 hours testing + fixes | 1 |
| 2. DOM Injection | Coded, needs test | 1-2 hours testing + fixes | 2 |
| 3. DOM Capture | Coded, needs test | 2-3 hours testing + fixes | 2 |
| 4. Intake Flow | Prompts coded, flow needs wiring | 3-4 hours | 3 |
| 5. Auto-Installer | Scanner coded, installer NOT built | 6-8 hours | 3 |
| 6. CLI Auth | NOT built | 3-4 hours | 3-4 |
| 7. CLI Process Mgmt | Core coded, needs enhancement | 2-3 hours | 4 |
| 8. Task Routing | Coded, needs orchestration layer | 3-4 hours | 4 |
| 9. File Output | Watcher coded, needs UI + integration | 2-3 hours | 4-5 |
| 10. GSD + Plugins | NOT built | 6-8 hours | 5 |
| 11. Persistence | Foundation coded, needs completion | 3-4 hours | 6 |
| 12. Auto-Updater | Dependency ready, not configured | 1-2 hours | 6 |
| 13. Error Recovery | NOT built | 3-4 hours | 6 |
| 14. Packaging | Config exists, not tested | 2-3 hours | 7 |

**Total remaining effort: ~40-55 hours across 7 days**

---

## WHAT TO DO RIGHT NOW

### Step 1: Install dependencies and see if it compiles
```bash
cd ~/Documents/unified-terminal
npm install
npm run build:main
npm run dev
```
If this works, we have a running Electron app. If it doesn't, we fix compilation errors first.

### Step 2: Test Gate 1
Launch the app. Does ChatGPT load? Can you sign in? Do OAuth popups work? This is the single pass/fail moment.

### Step 3: If Gate 1 passes → proceed to Gate 2-3 testing
Inject a test message. Capture the response. If these work, we're 3 gates ahead on Day 1.

### Dependencies Not Yet Installed (needed for later gates)
```
node-pty          — TTY emulation for CLI tool auth (Gate 6)
```
Everything else is in package.json. The scaffold is ready to run.