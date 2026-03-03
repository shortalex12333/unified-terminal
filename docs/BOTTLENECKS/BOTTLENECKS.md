# BOTTLENECKS — Ordered Build & Test Plan
## Last Updated: March 2, 2026

Every bottleneck listed in order of when it must be addressed. Each one is a gate — if it fails, everything after it is blocked. No skipping.

---

## GATE 1: ELECTRON + CHATGPT SIGN-IN
**Priority: CRITICAL — Day 1 — Pass/Fail for entire project**

### The Problem
ChatGPT uses multiple OAuth providers (Google, Microsoft, Apple) plus email/password. OAuth popups inside Electron's BrowserView have known issues — popups get blocked, lose session context, or redirect incorrectly. If users can't sign into ChatGPT inside our app, the product doesn't exist.

### What We Need To Test
1. BrowserView loads `https://chat.openai.com` correctly
2. "Sign in with Google" popup opens, completes, and returns to authenticated ChatGPT
3. "Sign in with Microsoft" popup opens, completes, and returns to authenticated ChatGPT
4. "Sign in with Apple" popup opens, completes, and returns to authenticated ChatGPT
5. Email/password sign-in works
6. Session persists after app restart (cookies/localStorage retained in BrowserView partition)
7. Two-factor authentication flows complete successfully
8. ChatGPT Plus/Pro features are available after sign-in (model selector shows GPT-4)

### Known Risks
- Electron's `setWindowOpenHandler` must catch OAuth popups and route them correctly
- Some OAuth flows use redirects instead of popups — need to handle both
- OpenAI may use CAPTCHA on login — Electron's embedded browser might trigger bot detection
- Session storage partition must persist between app launches or user has to sign in every time

### If This Fails
Pivot to: system default browser handles sign-in → returns auth token to our app via deep link or localhost callback. More complex but proven pattern (VS Code does this for GitHub auth).

### How To Test
```
1. Build bare Electron app with BrowserView pointing to chat.openai.com
2. Attempt sign-in with each OAuth provider
3. Verify authenticated session loads ChatGPT interface
4. Close app, reopen, verify session still active
5. Confirm model selector shows correct tier (Free vs Plus vs Pro)
```

### Definition of Done
User can open the app, sign into ChatGPT, and see their authenticated ChatGPT interface with all subscription features available. Session persists across app restarts.

---

## GATE 2: DOM INJECTION — SENDING MESSAGES TO CHATGPT
**Priority: CRITICAL — Day 2 — Proves we can control the LLM**

### The Problem
We need to programmatically type text into ChatGPT's input field and submit it. ChatGPT's textarea is a React-controlled component — you can't just set `.value` and dispatch an input event. React's synthetic event system ignores native DOM manipulation. The textarea may also be a contentEditable div, not an actual `<textarea>` element.

### What We Need To Test
1. Locate the input element (textarea or contentEditable div)
2. Programmatically insert text that React's state recognizes
3. Trigger the send action (click send button or simulate Enter keypress)
4. Confirm ChatGPT actually processes the message (not just visually appears)
5. Handle edge cases: empty conversation vs existing conversation, model selector state

### Known Risks
- ChatGPT's DOM structure changes frequently — class names, element hierarchy, component types
- React's controlled inputs reject direct DOM manipulation — need to use React's internal fiber/props or native InputEvent with correct properties
- The input might be a ProseMirror or Slate editor instance, not a simple textarea
- Content Security Policy in ChatGPT's page might block our injected scripts

### Technical Approach
```javascript
// Inject via Electron's webContents.executeJavaScript()
// Strategy 1: Find textarea, use native InputEvent
const textarea = document.querySelector('textarea[data-id]') 
  || document.querySelector('#prompt-textarea')
  || document.querySelector('[contenteditable="true"]');

// For React controlled inputs, we need to trigger through React's event system
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype, 'value'
).set;
nativeInputValueSetter.call(textarea, 'our message');
textarea.dispatchEvent(new Event('input', { bubbles: true }));

// Strategy 2: Use clipboard API as fallback
navigator.clipboard.writeText('our message');
document.execCommand('paste');

// Strategy 3: Simulate keyboard events character by character (slowest, most reliable)
```

### Selector Abstraction
Build a selector config file that's easy to update when ChatGPT changes:
```javascript
// src/utils/dom-selectors.ts — update this file when DOM breaks
export const CHATGPT_SELECTORS = {
  textarea: [
    '#prompt-textarea',
    'textarea[data-id]',
    '[contenteditable="true"][data-placeholder]',
    'div.ProseMirror',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'form button[type="submit"]',
  ],
  responseContainer: [
    '[data-message-author-role="assistant"]',
    '.agent-turn',
    '.markdown.prose',
  ],
  modelSelector: [
    'button[aria-haspopup="listbox"]',
    '[data-testid="model-selector"]',
  ],
};
// Try selectors in order, first match wins
```

### How To Test
```
1. Sign into ChatGPT (Gate 1 must pass)
2. Execute injection script via webContents.executeJavaScript()
3. Verify text appears in input field
4. Trigger send
5. Verify ChatGPT processes message and generates a response
6. Repeat 10 times to confirm reliability
```

### Definition of Done
We can programmatically send any text message to ChatGPT from our Electron main process and ChatGPT processes it as if the user typed it manually. Works on fresh conversations and existing ones.

---

## GATE 3: DOM CAPTURE — READING CHATGPT'S RESPONSES
**Priority: CRITICAL — Day 2 — Proves we can read LLM output**

### The Problem
ChatGPT streams responses token by token. We need to capture this stream in real-time to display in our overlay and feed to our orchestration layer. The response renders into the DOM progressively — we need to watch it happen and capture it as it streams.

### What We Need To Test
1. Detect when ChatGPT starts generating a response
2. Capture tokens as they appear in the DOM (streaming)
3. Detect when generation is complete
4. Extract the full final response text
5. Handle multi-part responses (text + code blocks + images)
6. Handle error states (rate limit messages, network errors, "something went wrong")

### Known Risks
- MutationObserver on deeply nested React components can be noisy — hundreds of mutations per response
- ChatGPT may use virtual scrolling that removes DOM nodes as they scroll out of view
- Code blocks render differently from prose — need to capture both
- Image generation (DALL-E) responses have a different DOM structure than text
- "Thinking" / "Searching" indicators need to be distinguished from actual response content

### Technical Approach
```javascript
// MutationObserver on the conversation container
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Filter to only text content changes in assistant messages
    const assistantMessages = document.querySelectorAll(
      '[data-message-author-role="assistant"]'
    );
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    if (lastMessage) {
      const currentText = lastMessage.innerText;
      // Send to main process via IPC or postMessage
      window.__PRISM_BRIDGE__.onChunk(currentText);
    }
  }
});

// Watch the conversation container
const container = document.querySelector('main') || document.querySelector('[role="main"]');
observer.observe(container, { 
  childList: true, 
  subtree: true, 
  characterData: true 
});

// Detect completion: ChatGPT shows action buttons (copy, regenerate) when done
const completionObserver = new MutationObserver(() => {
  const copyButtons = document.querySelectorAll('button[aria-label="Copy"]');
  // New copy button appeared = generation complete
  window.__PRISM_BRIDGE__.onComplete();
});
```

### Edge Cases To Handle
- User manually sends a message while our system is waiting for a response
- ChatGPT returns an error instead of a response
- Response includes images (DALL-E) — different capture logic needed
- Response includes interactive elements (Canvas, code execution results)
- ChatGPT "Searching the web..." indicator — wait for actual response
- Very long responses that take 60+ seconds to generate

### How To Test
```
1. Inject a test message (Gate 2 must pass)
2. Start MutationObserver before injection
3. Capture streaming tokens — verify they arrive incrementally
4. Detect completion — verify final text matches what's on screen
5. Test with: short response, long response, code block response, error response
6. Verify captured text is clean (no UI artifacts, button text, etc.)
```

### Definition of Done
We can send a message to ChatGPT and capture the complete response as it streams, with reliable completion detection. The captured text matches exactly what the user would see. Works for text, code blocks, and error states.

---

## GATE 4: META-PROMPT INTAKE — THE PRODUCT LAYER
**Priority: HIGH — Day 3 — Proves we add value**

### The Problem
We need to intercept the user's first message, wrap it in our meta-prompt framework, send it to ChatGPT, capture the intake questions ChatGPT generates, then capture the user's answers, and build a structured brief from the full exchange. This is the first moment the app feels like MORE than just ChatGPT in a window.

### What We Need To Test
1. User types a message in our overlay or directly in ChatGPT's input
2. App intercepts before it sends (or captures immediately after)
3. Meta-prompt is prepended to user's message
4. ChatGPT generates smart, non-technical clarifying questions
5. User answers questions naturally in the conversation
6. App captures the full Q&A exchange
7. App builds a structured brief (task type, requirements, constraints)
8. Brief correctly routes to the right execution path

### Known Risks
- Meta-prompt might be too long and eat into context window
- ChatGPT might not follow our meta-prompt format consistently
- User might answer vaguely or skip questions — need graceful handling
- Detecting when the intake phase is "done" and execution should begin is ambiguous
- If user is in the middle of a different conversation, our meta-prompt injects into wrong context

### Technical Approach
```
User types: "build me an ecom store"

App intercepts → wraps in meta-prompt:
"You are a project intake specialist. The user wants: [build me an ecom store].
Ask 3-5 simple, non-technical questions. Focus on: audience, existing assets,
end goal, constraints. Do NOT ask about frameworks or technical choices.
End your questions with: INTAKE_COMPLETE when user has answered all questions."

ChatGPT responds with questions → User answers naturally

App watches for INTAKE_COMPLETE marker or detects 2+ Q&A exchanges

App parses conversation → builds structured brief:
{
  task_type: "hybrid",
  category: "ecommerce",
  requirements: { audience: "...", product: "...", timeline: "..." },
  execution_plan: ["research", "scaffold", "design", "content", "deploy"],
  plugins_needed: ["gsd", "codex", "browser-use"]
}
```

### How To Handle User Declining
If user says "just build it" or "skip questions":
- Don't block. Continue with reasonable defaults.
- The meta-prompt includes: "If user declines questions, proceed with best assumptions and note what you assumed."
- Our app detects the skip and routes to execution with a simpler brief.

### How To Test
```
1. Gates 1-3 must pass
2. User sends a vague project request
3. Verify meta-prompt is injected correctly
4. Verify ChatGPT asks non-technical questions
5. User answers 3-4 questions
6. Verify structured brief is generated
7. Verify task classification is correct
8. Test skip flow: user says "just do it" — verify app handles gracefully
```

### Definition of Done
User describes a project in plain English → app asks smart questions via ChatGPT → captures answers → produces a structured brief that correctly identifies what tools and execution paths are needed. Works for code projects, research tasks, and document creation.

---

## GATE 5: SYSTEM SCAN + AUTO-INSTALLER
**Priority: HIGH — Day 3 — Proves we can set up the environment**

### The Problem
Most users won't have Node.js, Python, Git, Codex CLI, Claude Code, GSD, or any other tool installed. On first launch, the app needs to detect what's missing and install everything in one sweep. This must be invisible to the user — they see a progress screen, not a terminal.

### What We Need To Install (Full Sweep)
```
Layer 1 — System Prerequisites:
├── Homebrew (if not present — required for other installs on macOS)
├── Git (if not present)
├── Node.js 20 LTS (via nvm)
└── Python 3.11+ (via brew)

Layer 2 — CLI Agent Tools:
├── Codex CLI: npm install -g @openai/codex
├── Claude Code: npm install -g @anthropic-ai/claude-code
└── GSD: npm install -g gsd (or git clone + npm install)

Layer 3 — Plugin Dependencies:
├── Claude-Flow/Ruflo: npm install -g claude-flow
├── Browser-Use: pip install browser-use
├── Open Interpreter: pip install open-interpreter
├── Playwright: npx playwright install (for browser automation)
└── All MCP servers: batch npm install

Layer 4 — Skills & Frameworks:
├── GSD skills and agents (bundled with GSD install)
├── Claude-Code-Workflows skills (git clone or npm)
├── Plugin prompt frameworks (bundled with our app)
└── Default project templates
```

### What We Need To Test
1. Detect each tool's presence and version
2. Install missing tools in correct dependency order
3. Handle macOS permission dialogs (Homebrew install, Xcode CLI tools)
4. Handle installation failures gracefully (network issues, permission denied)
5. Verify each tool works after installation (run version check)
6. Complete full sweep in under 10 minutes on clean machine
7. Skip already-installed tools (don't reinstall on subsequent launches)
8. Show accurate progress to user throughout

### Known Risks
- Homebrew installation prompts for sudo password — our app needs to handle this securely
- Xcode Command Line Tools popup from Apple — can't be automated, user must click "Install"
- npm global installs may fail due to permission issues — nvm solves this for Node packages
- Python package installs may conflict with system Python on macOS
- Total download size could be 2-3 GB on a clean machine — need good progress indication
- If user's internet is slow, 10 minutes becomes 30 minutes

### macOS Security Considerations
- First `child_process.exec()` call may trigger "allow terminal access" dialog
- Homebrew install requires password entry — display a friendly explanation
- Gatekeeper may block unsigned binaries — all our installs come from trusted sources (npm, pip, brew)
- Apple Silicon vs Intel — some tools have different install paths

### Technical Approach
```javascript
// src/main/auto-installer.ts

const INSTALL_STEPS = [
  { 
    name: 'Checking your system',
    check: () => exec('which brew'),
    install: () => exec('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'),
    weight: 15  // percentage of total progress
  },
  {
    name: 'Setting up Node.js',
    check: () => exec('node --version'),
    install: () => exec('curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install 20'),
    weight: 15
  },
  // ... etc for each tool
];

// Run sequentially, skip if check passes, show progress
for (const step of INSTALL_STEPS) {
  updateProgress(step.name);
  const exists = await step.check().catch(() => false);
  if (!exists) {
    await step.install();
    const verified = await step.check().catch(() => false);
    if (!verified) {
      logError(`Failed to install: ${step.name}`);
      // Continue with remaining installs, track what failed
    }
  }
  advanceProgress(step.weight);
}
```

### User-Facing Progress Screen
```
Setting up your AI workspace...

✓ System check complete
✓ Node.js ready  
✦ Installing AI tools...          [████████░░░░░░░░] 52%
  Setting up code generation
  Setting up project management
  Setting up research tools
○ Finalizing setup

This takes about 5-10 minutes on first launch.
You won't need to do this again.
```

### How To Test
```
1. Run on a clean macOS (or VM with minimal installs)
2. Verify each tool gets detected correctly (present vs missing)
3. Verify install sequence completes without manual intervention (except Apple password prompt)
4. Verify all tools work after installation
5. Relaunch app — verify it skips all installs (fast startup)
6. Time the full sweep — must be under 10 minutes on reasonable internet
```

### Definition of Done
User launches app for the first time → sees a friendly progress screen → all tools install automatically → app transitions to sign-in screen → everything works. Second launch skips install entirely and loads in under 3 seconds.

---

## GATE 6: CLI TOOL AUTH + TERMS ACCEPTANCE
**Priority: HIGH — Day 3-4 — Proves CLI tools are usable**

### The Problem
Each CLI tool has its own authentication and terms acceptance flow that normally runs interactively in a terminal. We need to intercept these, display them in our UI, and pipe user responses back.

### Per-Tool Auth Requirements
```
Codex CLI:
├── Requires: GitHub OAuth login
├── Flow: Opens browser for GitHub auth → returns token
├── ToS: Accepts on first run
└── Storage: Token saved to ~/.codex/

Claude Code:
├── Requires: Anthropic account login
├── Flow: Opens browser for Anthropic auth → returns session
├── ToS: Accepts on first run  
└── Storage: Session saved to ~/.claude/

GSD:
├── Requires: No separate auth (runs on top of Claude Code or Codex)
├── Config: .planning/config.json per project
└── First run: Interactive project setup (we handle this via intake layer)

Gemini CLI (Future):
├── Requires: Google OAuth
├── Flow: Opens browser for Google auth → returns token
└── Storage: Token saved to ~/.gemini/
```

### What We Need To Test
1. Detect when CLI process is requesting interactive input (auth prompt, ToS, questions)
2. Parse the prompt text from stdout
3. Display it in our overlay as a dialog
4. Capture user's response (accept/decline, text input)
5. Pipe response to CLI process stdin
6. Verify CLI process continues after receiving input
7. Verify auth tokens are saved and persist across sessions
8. Handle timeout — if user doesn't respond in 5 minutes, don't let process hang

### Known Risks
- CLI tools open the system browser for OAuth — this breaks our "stay in app" experience
- We may need to intercept the browser open and redirect to our embedded BrowserView instead
- Some CLI tools check if they're running in a TTY and behave differently in non-TTY contexts
- Auth tokens may expire — need to handle re-authentication gracefully

### Technical Approach
```javascript
// Spawn CLI with pseudo-TTY to get interactive prompts
const pty = require('node-pty');
const proc = pty.spawn('codex', ['--init'], {
  name: 'xterm-color',
  cols: 120,
  rows: 30,
  cwd: projectPath,
  env: { ...process.env, BROWSER: 'echo' }  // Prevent auto-opening browser
});

proc.onData((data) => {
  const text = data.toString();
  
  // Detect auth prompt
  if (text.includes('authenticate') || text.includes('sign in') || text.includes('accept')) {
    // Show dialog in our overlay
    showAuthDialog(text, (userResponse) => {
      proc.write(userResponse + '\n');
    });
  } else {
    // Regular output — format and show in progress display
    updateProgressDisplay(text);
  }
});
```

### How To Test
```
1. Gate 5 must pass (tools installed)
2. Run Codex CLI for first time — verify GitHub auth flow completes
3. Run Claude Code for first time — verify Anthropic auth flow completes
4. Verify ToS acceptance is captured and forwarded correctly
5. Close app, reopen — verify tools don't re-prompt for auth
6. Revoke auth token manually — verify app handles re-auth gracefully
```

### Definition of Done
Each CLI tool can be authenticated through our app's UI without the user ever opening a terminal or a separate browser window. Auth persists across sessions. ToS acceptance is displayed cleanly and recorded.

---

## GATE 7: CLI PROCESS MANAGEMENT — RUNNING TOOLS
**Priority: HIGH — Day 4 — Proves we can execute locally**

### The Problem
We need to spawn CLI tools (Codex, Claude Code, GSD) as child processes, stream their output in real-time, handle their input requests, manage their lifecycle (start, pause, resume, kill), and deal with crashes. These processes can run for 30+ minutes on large tasks.

### What We Need To Test
1. Spawn a CLI tool with correct working directory and environment
2. Stream stdout/stderr in real-time to our overlay
3. Detect and handle interactive prompts (file overwrites, confirmations, choices)
4. Parse terminal output into structured status updates
5. Kill process cleanly when user cancels
6. Detect process crash and offer recovery
7. Handle multiple concurrent processes (GSD spawns sub-agents)
8. Manage process state across app minimize/background

### Known Risks
- Long-running processes may be killed by macOS when app goes to background
- GSD spawns its own child processes (sub-agents) — killing parent must clean up children
- Terminal output contains ANSI escape codes, color codes, progress bars — need to strip or parse
- Some CLI tools buffer output and don't flush until newline — causes delayed display
- Memory leaks from long-running processes reading large codebases

### Terminal Output → Status Updates Translation
```
Raw CLI output:                          Our display:
─────────────────────────────────────    ─────────────────────────────
$ codex "create landing page"            
> Analyzing requirements...              ✦ Analyzing your requirements
> Creating src/app/page.tsx              ✦ Creating the Homepage
> Creating src/components/Hero.tsx       ✦ Building the Hero Section  
> Writing CSS styles...                  ✦ Styling your pages
> Running npm install...                 ✦ Installing dependencies
> added 347 packages in 12s             
> Starting dev server...                 ✦ Preview ready
> Server running on localhost:3000        [Open Preview]
```

### Translation Rules
```javascript
const OUTPUT_PATTERNS = [
  { match: /creating?\s+(.*\.tsx?)/i, display: (m) => `Creating ${friendlyName(m[1])}` },
  { match: /installing?\s+dependencies/i, display: () => 'Installing dependencies' },
  { match: /running?\s+tests?/i, display: () => 'Running tests' },
  { match: /server.*?(\d+)/i, display: (m) => `Preview ready on port ${m[1]}` },
  { match: /error/i, display: (m) => `Issue detected — fixing...` },
  { match: /✓|success|complete/i, display: (m) => `Step complete` },
  // Default: suppress noisy output, show only meaningful status changes
];
```

### How To Test
```
1. Gates 5-6 must pass (tools installed and authenticated)
2. Spawn Codex with a simple task — verify output streams in real-time
3. Verify status updates translate correctly from raw output
4. Send a cancellation — verify process and all children are killed cleanly
5. Force-crash a process — verify app detects and offers recovery
6. Run a 10+ minute task — verify app stays responsive, no memory issues
7. Minimize app during execution — verify process continues in background
8. Test GSD specifically — verify sub-agent processes are tracked
```

### Definition of Done
CLI tools run reliably as background processes. Output streams to our overlay as friendly status updates. Processes survive app background/minimize. Crashes are detected and recoverable. Multiple concurrent processes are managed cleanly.

---

## GATE 8: TASK ROUTING — BROWSER VS LOCAL VS HYBRID
**Priority: HIGH — Day 4 — Proves we can orchestrate**

### The Problem
After the intake brief is built, the system must decide: does this task run in the ChatGPT browser window, on local CLI tools, or both? This routing decision determines the entire execution path. Getting it wrong means using the wrong tool for the job.

### Routing Matrix
```
Task Type              → Execution Path
─────────────────────────────────────────────────────────
Research / Analysis    → BROWSER: ChatGPT with web search
Market research        → BROWSER: ChatGPT with web search
Content writing        → BROWSER: ChatGPT direct
Image generation       → BROWSER: ChatGPT with DALL-E
Code generation        → LOCAL: Codex CLI or Claude Code
Full project build     → HYBRID: GSD orchestrates both
Website creation       → HYBRID: CLI for code, browser for content/images
Document creation      → HYBRID: CLI for file generation, browser for content
Web automation         → LOCAL: Browser-Use or Playwright
Data scraping          → LOCAL: Firecrawl or Browser-Use
```

### What We Need To Test
1. Task classifier correctly identifies category from structured brief
2. Browser-only tasks execute entirely in ChatGPT window
3. Local-only tasks execute entirely via CLI
4. Hybrid tasks coordinate both — CLI generates code while ChatGPT generates content
5. Handoffs between browser and local work correctly (browser generates copy → local injects into code)
6. Failure in one path doesn't crash the other (CLI fails but browser results are preserved)

### Technical Approach
```javascript
// src/main/task-router.ts
classifyTask(brief) {
  const signals = {
    needsCode: /build|create|develop|website|app|landing page|store/i,
    needsResearch: /research|analyze|find|compare|market|competitor/i,
    needsContent: /write|draft|copy|blog|email|pitch/i,
    needsImages: /design|image|logo|brand|visual|mockup/i,
    needsFiles: /document|presentation|spreadsheet|pdf|deck/i,
    needsAutomation: /automate|scrape|fill|book|schedule/i,
  };

  const matches = Object.entries(signals)
    .filter(([_, regex]) => regex.test(brief.rawRequest))
    .map(([key]) => key);

  if (matches.includes('needsCode') || matches.includes('needsAutomation')) {
    if (matches.includes('needsResearch') || matches.includes('needsContent') || matches.includes('needsImages')) {
      return 'hybrid';
    }
    return 'local';
  }
  return 'browser';
}
```

### How To Test
```
1. Gates 1-7 must pass
2. Send 10 different task types through the classifier
3. Verify correct routing for each
4. Execute one task per category end-to-end:
   - Browser-only: "research the protein powder market in the US"
   - Local-only: "create a Python script that sorts CSV files"
   - Hybrid: "build me a landing page for my dog walking business"
5. Verify hybrid coordination: both paths produce output, output is combined
```

### Definition of Done
System correctly classifies any user task into browser/local/hybrid and routes accordingly. Hybrid tasks coordinate both paths without conflicts. Results from all paths are captured and presented to the user.

---

## GATE 9: FILE OUTPUT + PROJECT STRUCTURE
**Priority: MEDIUM — Day 4-5 — Proves users get tangible results**

### The Problem
CLI tools generate files on the filesystem. Users need to see what was created, preview files, and access their project output. The app needs a workspace concept with a clean file browser.

### What We Need To Test
1. Project folder auto-creates at `~/Documents/our_brand_name/[project-name]/`
2. CLI tools write output to correct project folder
3. File watcher detects new/changed files in real-time
4. File tree displays in overlay
5. Common files are previewable (HTML in iframe, images inline, code with syntax highlighting)
6. User can open project folder in Finder
7. User can open files in VS Code or default editor
8. Multiple projects tracked independently

### Known Risks
- CLI tools may write to unexpected locations (current working directory, home folder, /tmp)
- Need to set correct `cwd` when spawning every CLI process
- Large projects (thousands of files) could make the file tree sluggish
- Some generated files may be temporary build artifacts — need to distinguish from real output

### How To Test
```
1. Run a code generation task (Gate 7)
2. Verify files appear in correct project folder
3. Verify file watcher picks up changes in real-time
4. Verify file tree in overlay is accurate
5. Preview an HTML file, an image, a code file
6. Click "Open in Finder" — verify it opens correct folder
```

### Definition of Done
Every generated file appears in a project folder the user can find. The overlay shows a live file tree. Common files are previewable. The user's tangible output is organized and accessible.

---

## GATE 10: GSD + PLUGIN ORCHESTRATION
**Priority: MEDIUM — Day 5 — Proves complex workflows work**

### The Problem
GSD is the most powerful plugin — it manages entire project lifecycles with sub-agents, phased execution, verification, and research. Wiring it up proves that complex, multi-step workflows can run through our app. If GSD works, simpler plugins definitely work.

### What We Need To Test
1. GSD installs correctly and initializes in a project folder
2. GSD's questioning phase maps to our intake layer (don't duplicate)
3. GSD's sub-agent spawning works through our CLI runner
4. Phase-by-phase progress displays correctly in overlay
5. User can approve/decline at phase boundaries
6. GSD's verification phase runs and results display
7. GSD works with Codex CLI as the backend executor
8. Full project: intake → GSD planning → phased execution → output

### Known Risks
- GSD expects to run interactively in a terminal — needs adaptation for our controlled environment
- GSD spawns sub-agents that themselves are Claude Code sessions — nested process management
- GSD's progress output format may not match our parsing patterns
- GSD + Codex (instead of Claude Code) may have compatibility issues — GSD was built for Claude Code

### How To Test
```
1. All previous gates must pass
2. User says "build me a personal finance tracker app"
3. Intake layer captures requirements
4. GSD initializes with structured brief
5. GSD creates roadmap — verify it displays in overlay
6. GSD begins phase 1 execution — verify sub-agents spawn and work
7. Phase 1 completes — verify user is notified and can proceed
8. Run through full project lifecycle to completion
9. Verify all generated files are in project folder
```

### Definition of Done
GSD runs a complete project lifecycle through our app. User sees phased progress, can intervene at boundaries, and gets a complete project output. This proves our entire orchestration layer works.

---

## GATE 11: TASK PERSISTENCE + BACKGROUND EXECUTION
**Priority: MEDIUM — Day 6 — Proves reliability**

### The Problem
Tasks can run for 30+ minutes. Users will close the app, laptop will sleep, WiFi will drop. The app must survive all of this and resume where it left off.

### What We Need To Test
1. Task state saves before each execution step
2. App restart resumes task from last saved state
3. App runs in background via menu bar icon
4. macOS doesn't kill background process during long tasks
5. Notification fires when task completes or needs input
6. Network interruption is detected and handled (ChatGPT portion pauses, CLI portion continues)
7. Laptop sleep/wake resumes correctly

### Known Risks
- macOS App Nap may throttle background Electron apps — need to disable
- Long-running child processes may be killed by macOS memory pressure
- WebView may lose ChatGPT session after sleep/wake — need reconnection logic
- State serialization for complex multi-agent workflows is non-trivial

### How To Test
```
1. Start a long task (GSD project build)
2. Minimize app — verify execution continues
3. Close app window (menu bar persists) — verify execution continues  
4. Force quit app mid-task — relaunch — verify resume prompt appears
5. Sleep laptop for 5 minutes — wake — verify task resumes
6. Disconnect WiFi during hybrid task — verify CLI portion continues, browser portion pauses gracefully
```

### Definition of Done
Tasks survive app minimize, close-to-tray, force quit + relaunch, and laptop sleep/wake. Users never lose progress. Background execution works silently with menu bar icon showing status.

---

## GATE 12: AUTO-UPDATER
**Priority: MEDIUM — Day 6 — Proves we can iterate**

### The Problem
Without App Store, we need our own update mechanism. Users should get bug fixes and new features automatically without manually downloading new .dmg files.

### What We Need To Test
1. App checks for updates on launch
2. Update prompt appears when new version is available
3. User clicks "Update" → downloads and installs seamlessly
4. App restarts into new version with state preserved
5. Update mechanism works with Apple notarization (no Gatekeeper blocks)
6. Force-update capability for critical security fixes

### Technical Approach
- electron-updater with GitHub Releases as update server
- Differential updates (not full re-download) when possible
- Background download — prompt to install when ready

### How To Test
```
1. Publish v0.0.1 to GitHub Releases
2. Build v0.0.2 and publish
3. Launch v0.0.1 — verify update detected
4. Apply update — verify v0.0.2 runs correctly
5. Verify state (projects, settings) persists through update
```

### Definition of Done
Users always run the latest version with zero effort. Updates are detected, downloaded, and applied with one click. No data loss during updates.

---

## GATE 13: ERROR RECOVERY + EDGE CASES
**Priority: MEDIUM — Day 6 — Proves production readiness**

### The Problem
Things will break. CLI tools crash. ChatGPT rate limits hit. Network drops. Users do unexpected things. Every failure mode needs a graceful recovery path.

### Error Catalogue
```
Error                              → Recovery
──────────────────────────────────────────────────────────
CLI process crashes                → Save state, offer "Retry from last step"
ChatGPT rate limit hit             → Pause, show estimated wait time, auto-resume
ChatGPT returns error              → Retry once automatically, then show user message
Network disconnection              → Pause browser tasks, continue local tasks, reconnect when available
CLI tool not found (path issue)    → Re-run installer for specific tool
Auth token expired                 → Prompt re-authentication
Disk full                          → Warn before starting task, halt gracefully
Out of memory                      → Kill non-essential processes, warn user
File permission denied             → Explain and suggest fix
User closes app during execution   → Save state, resume on next launch
ChatGPT session expired            → Re-authenticate in BrowserView
GSD sub-agent hangs                → Timeout after 5 min, kill and retry
Generated code has errors          → Show error, offer auto-fix via LLM
```

### How To Test
```
1. Simulate each error condition
2. Verify graceful handling — no crashes, no data loss
3. Verify recovery works — user can continue from where they were
4. Verify error messages are non-technical and actionable
```

### Definition of Done
No error condition crashes the app. Every failure shows a clear message and offers a recovery action. State is preserved through any failure.

---

## GATE 14: PACKAGING + DISTRIBUTION
**Priority: HIGH — Day 7 — Proves it ships**

### The Problem
The Electron app must be packaged as a .dmg, signed with Apple Developer ID, notarized, and distributable via direct download. Users must be able to install it like any normal Mac app.

### What We Need To Test
1. electron-builder produces valid .dmg
2. .dmg is signed with Apple Developer ID
3. .dmg is notarized with Apple (no Gatekeeper warnings)
4. User can drag to Applications and launch
5. App icon appears correctly in Dock and menu bar
6. First launch triggers setup flow (Gate 5)
7. App appears in Spotlight search
8. Uninstall is clean (drag to Trash removes app, data stays in Documents)

### How To Test
```
1. Build .dmg on your Mac Studio
2. Transfer to a different Mac (or clean user account)
3. Install — verify no security warnings
4. Launch — verify full flow works (setup → sign-in → first task)
5. Verify file associations and icon rendering
```

### Definition of Done
A non-technical person can download a .dmg, install the app, and complete their first task without encountering any technical barriers, security warnings, or confusion.

---

## SUMMARY: BUILD ORDER

```
DAY 1:
  └── Gate 1: Electron + ChatGPT sign-in (PASS/FAIL — blocks everything)

DAY 2:
  ├── Gate 2: DOM injection (send messages)
  └── Gate 3: DOM capture (read responses)

DAY 3:
  ├── Gate 4: Meta-prompt intake layer
  ├── Gate 5: System scan + auto-installer
  └── Gate 6: CLI tool authentication

DAY 4:
  ├── Gate 7: CLI process management
  ├── Gate 8: Task routing (browser/local/hybrid)
  └── Gate 9: File output + project structure

DAY 5:
  └── Gate 10: GSD + plugin orchestration

DAY 6:
  ├── Gate 11: Task persistence + background
  ├── Gate 12: Auto-updater
  └── Gate 13: Error recovery

DAY 7:
  └── Gate 14: Package + ship
```

Each gate is tested before moving to the next. If a gate fails, fix it before proceeding. No skipping. No "we'll fix it later." The gates are ordered so that each one proves the next is possible.
