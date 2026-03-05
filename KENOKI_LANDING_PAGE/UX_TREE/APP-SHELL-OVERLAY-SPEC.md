# App Shell & Overlay Architecture — Definitive Specification

> **Status**: GOSPEL — This document is the authoritative reference for how the UI shell, overlay, ChatGPT BrowserView, and resource awareness coexist.
> **Last Updated**: 2026-03-04
> **Companion to**: STATUS-AGENT-SPEC.md, PROMPT-INJECTION-ARCHITECTURE.md, CONDUCTOR-ARCHITECTURE.md

---

## Executive Summary

The app has two faces: ChatGPT (the browser the user already knows) and the Build Tree (where orchestrated work becomes visible). These are NOT two separate apps or screens. They're layers. ChatGPT is the background — always there, always usable. The Build Tree is a panel that slides over it when a build runs, and collapses to a minimal top bar when the user wants to chat. The user is never locked out of ChatGPT. They can talk to it, ask questions, browse — while the build continues in the background. A session fuel gauge shows resource consumption in terms they understand: "About 60% of today's session used."

---

## 1. The Three App States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    APP STATES                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STATE 1: IDLE                                                            │
│   ─────────────────                                                         │
│   ChatGPT BrowserView: FULL SCREEN                                         │
│   Build Tree: HIDDEN                                                        │
│   Top Bar: app branding only, no build info                                │
│   User experience: "This is just ChatGPT in a nice window"                 │
│                                                                             │
│   STATE 2: BUILDING (tree expanded)                                         │
│   ──────────────────────────────────                                        │
│   ChatGPT BrowserView: LEFT PANEL (shrunk to ~55% width)                   │
│   Build Tree: RIGHT PANEL (~45% width, slides in from right)               │
│   Top Bar: project name + progress bar + fuel gauge + [Hide Tree ✕]        │
│   User experience: "I can see what's being built AND still use ChatGPT"    │
│                                                                             │
│   STATE 3: BUILDING (tree minimised)                                       │
│   ─────────────────────────────────                                         │
│   ChatGPT BrowserView: FULL SCREEN (restored)                              │
│   Build Tree: COLLAPSED to top bar pill                                    │
│   Top Bar: [🔨 Building candle store ━━━━━░░ 67% ⚡ 12min] [Expand ▼]     │
│   User experience: "Build's running, I can chat, tap to see progress"      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 State Transitions

```
                    ┌─────────┐
                    │  IDLE   │
                    └────┬────┘
                         │ User initiates build
                         │ (types "build me an ecom store")
                         ▼
                 ┌────────────────┐
                 │   BUILDING     │
                 │ (tree expanded)│
                 └───┬────────┬──┘
                     │        │
          User hits  │        │  User hits
          [✕ Hide]   │        │  [Expand ▼]
                     ▼        │  from top bar
              ┌──────────┐    │
              │ BUILDING  │◄──┘
              │(minimised)│
              └─────┬─────┘
                    │
                    │ Build completes
                    ▼
               ┌─────────┐
               │COMPLETE  │ → shows output links in tree
               └────┬────┘   then user dismisses → back to IDLE
                    │
                    ▼
               ┌─────────┐
               │  IDLE    │
               └──────────┘
```

### 1.2 Transition Triggers (Hardcoded)

```typescript
const STATE_TRANSITIONS = {
  // IDLE → BUILDING: when Conductor classifies Tier 1+ task
  IDLE_TO_BUILDING: {
    trigger:    "conductor:classify",
    condition:  (tier) => tier >= 1,     // Tier 0 (fast-path) stays in IDLE
    animation:  "slide-in-right 300ms ease-out",
    treeWidth:  "45%",                   // of total window width
  },

  // BUILDING → MINIMISED: user hits close/hide button on tree panel
  BUILDING_TO_MINIMISED: {
    trigger:    "user:hide-tree",
    animation:  "slide-out-right 250ms ease-in, topbar-expand 200ms ease-out",
    topBarHeight: 44,                    // px
  },

  // MINIMISED → BUILDING: user clicks top bar pill or [Expand]
  MINIMISED_TO_BUILDING: {
    trigger:    "user:expand-tree",
    animation:  "slide-in-right 300ms ease-out",
    treeWidth:  "45%",
  },

  // BUILDING → COMPLETE: all DAG steps done + archive written
  BUILDING_TO_COMPLETE: {
    trigger:    "conductor:build-complete",
    animation:  "completion-glow 600ms ease-out",  // tree gets a subtle glow
    autoMinimise: false,                 // stay expanded to show output links
  },

  // COMPLETE → IDLE: user dismisses tree
  COMPLETE_TO_IDLE: {
    trigger:    "user:dismiss-tree",
    animation:  "slide-out-right 250ms ease-in",
  },
};
```

---

## 2. Layout Architecture

### 2.1 Electron Window Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  ■ ■ ■  [App Name]                          [Top Bar / Build Pill]  │  ← macOS title bar
├──────────────────────────────────────────────────────────────────────┤
│                                │                                     │
│                                │                                     │
│                                │       BUILD TREE PANEL              │
│    CHATGPT BROWSERVIEW         │       (React overlay)               │
│    (Electron BrowserView)      │                                     │
│                                │       - Progress tree               │
│    User's real ChatGPT         │       - Query widgets               │
│    session. Full auth.         │       - Fuel gauge                  │
│    They can chat, browse,      │       - Input bar                   │
│    use plugins, upload files.  │       - Pause/Cancel                │
│                                │                                     │
│                                │                                     │
│                                │                                     │
│                                │       [📦 Output links at bottom]   │
│                                │                                     │
├──────────────────────────────────────────────────────────────────────┤
│  💬 Quick input: type here to send feedback without switching panels │  ← optional bottom bar
└──────────────────────────────────────────────────────────────────────┘

IDLE STATE (no build):
┌──────────────────────────────────────────────────────────────────────┐
│  ■ ■ ■  [App Name]                                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│              CHATGPT BROWSERVIEW (100% width)                        │
│                                                                      │
│              Full ChatGPT experience.                                │
│              No overlay. No panels. Just ChatGPT.                    │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

MINIMISED STATE (build running but tree hidden):
┌──────────────────────────────────────────────────────────────────────┐
│  ■ ■ ■  [App Name]  [🔨 Building candle store ━━━░░ 67%  12min ▼]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              CHATGPT BROWSERVIEW (100% width)                        │
│                                                                      │
│              User chats normally.                                    │
│              Build continues in background.                          │
│              Top bar pill shows progress.                            │
│              Click pill to expand tree.                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 BrowserView Resize Logic

```typescript
// src/main/layout-manager.ts

const LAYOUT = {
  TITLE_BAR_HEIGHT:    40,     // macOS hiddenInset title bar
  BOTTOM_BAR_HEIGHT:   48,     // optional quick input bar
  TREE_PANEL_WIDTH:    0.45,   // 45% of window width when expanded
  TREE_MIN_WIDTH:      320,    // never narrower than this
  TREE_MAX_WIDTH:      520,    // never wider than this
  CHATGPT_MIN_WIDTH:   480,    // ChatGPT needs at least this to be usable
  TOP_BAR_PILL_HEIGHT: 44,     // minimised state top bar
  ANIMATION_MS:        300,    // slide animation duration
  RESIZE_DEBOUNCE_MS:  50,     // debounce window resize events
};

function calculateBounds(
  windowWidth: number,
  windowHeight: number,
  state: "idle" | "building" | "minimised"
): { chatgpt: Electron.Rectangle; tree: Electron.Rectangle | null } {

  const contentTop = LAYOUT.TITLE_BAR_HEIGHT;
  const contentHeight = windowHeight - contentTop;

  if (state === "idle" || state === "minimised") {
    // ChatGPT gets full width
    const topBarOffset = state === "minimised" ? LAYOUT.TOP_BAR_PILL_HEIGHT : 0;
    return {
      chatgpt: {
        x: 0,
        y: contentTop + topBarOffset,
        width: windowWidth,
        height: contentHeight - topBarOffset,
      },
      tree: null,
    };
  }

  // BUILDING: split layout
  const treeWidth = Math.min(
    LAYOUT.TREE_MAX_WIDTH,
    Math.max(LAYOUT.TREE_MIN_WIDTH, Math.floor(windowWidth * LAYOUT.TREE_PANEL_WIDTH))
  );
  const chatWidth = windowWidth - treeWidth;

  // Ensure ChatGPT has minimum usable width
  if (chatWidth < LAYOUT.CHATGPT_MIN_WIDTH) {
    // Window too small for split — go full-tree, hide ChatGPT behind
    return {
      chatgpt: { x: 0, y: contentTop, width: windowWidth, height: contentHeight },
      tree: { x: 0, y: contentTop, width: windowWidth, height: contentHeight },
    };
  }

  return {
    chatgpt: {
      x: 0,
      y: contentTop,
      width: chatWidth,
      height: contentHeight,
    },
    tree: {
      x: chatWidth,
      y: contentTop,
      width: treeWidth,
      height: contentHeight,
    },
  };
}
```

### 2.3 Can Users Use ChatGPT During a Build?

**YES. Always.**

ChatGPT BrowserView is never disabled, never hidden (only resized), never locked. The user can:

| Action | During Build? | What Happens |
|--------|--------------|-------------|
| Chat with ChatGPT | YES | Normal conversation. Our system uses a SEPARATE conversation for build work. |
| Upload files to ChatGPT | YES | Doesn't affect the build unless they upload into the build conversation. |
| Use ChatGPT plugins | YES | Their plugins work normally. |
| Browse with ChatGPT | YES | Web browsing works normally in their session. |
| Start a NEW conversation | YES | They can have multiple conversations. Build uses its own. |
| Type in the tree's input bar | YES | Feedback routes to the specific agent via PA. |

**The critical implementation detail:**

Our build system injects prompts into a DEDICATED ChatGPT conversation (created by the intake flow). The user's other ChatGPT conversations are untouched. If the user is chatting in a different conversation while the build runs, we inject into our build conversation in the background without switching their view.

```typescript
// src/main/chatgpt-session.ts

const SESSION_CONFIG = {
  // We create a new conversation for each build project
  BUILD_CONVERSATION_PREFIX: "🔨",    // conversation title starts with this

  // When injecting, we check: is the user viewing our build conversation?
  // If YES: inject directly (they see it happening)
  // If NO: inject in background (navigate to build conversation, inject, navigate back)
  BACKGROUND_INJECT: true,

  // If user is actively typing in ChatGPT, we WAIT before injecting
  // Don't interrupt their typing
  INJECT_WAIT_IF_TYPING_MS: 2000,    // wait 2 seconds after last keystroke

  // Maximum time to wait for user to finish typing before we inject anyway
  INJECT_MAX_WAIT_MS: 10000,          // 10 seconds then inject
};
```

---

## 3. The Top Bar (Minimised State)

When the user hides the tree panel, the build doesn't stop. It collapses to a top bar pill that shows critical info at a glance:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ■ ■ ■  App Name   │ 🔨 Building candle store ━━━━━░░ 67%  ~12min │ ▼ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Top Bar Data

```typescript
interface TopBarState {
  projectName:     string;        // "candle store"
  progress:        number;        // 0-100
  timeRemaining:   string;        // "~12min"
  status:          "building" | "paused" | "waiting_user" | "error" | "complete";
  activeStepLabel: string;        // "Building pages..." (current step, human-friendly)
  fuelGauge:       number;        // 0-100 (session budget consumed)
}
```

### 3.2 Top Bar Interactions

| User Action | Result |
|-------------|--------|
| Click anywhere on pill | Tree panel slides open (MINIMISED → BUILDING) |
| Hover on progress | Tooltip: "Step 4 of 9: Building your pages" |
| Hover on time | Tooltip: "Based on current pace. Depends on ChatGPT speed." |
| Pill turns yellow | Query waiting: "We need your input — click to respond" |
| Pill turns red briefly | Error detected, but auto-retrying |
| Pill shows checkmark | Build complete! Click to see your finished project. |

### 3.3 Notification Escalation

When the tree is minimised and something needs user attention:

```typescript
const NOTIFICATION_ESCALATION = {
  // Level 1: Top bar pill colour change (non-intrusive)
  QUERY_NON_BLOCKING: {
    action: "pill-colour-yellow",
    sound: false,
    bounce: false,
  },

  // Level 2: Top bar pill pulse + subtle bounce (needs attention soon)
  QUERY_BLOCKING: {
    action: "pill-pulse-yellow",
    sound: false,
    bounce: true,              // macOS dock bounce once
  },

  // Level 3: System notification (build complete or critical error)
  BUILD_COMPLETE: {
    action: "pill-colour-green",
    sound: true,               // system notification sound
    bounce: true,
    notification: {
      title: "Your candle store is ready!",
      body: "Click to see your finished project.",
    },
  },

  ERROR_CRITICAL: {
    action: "pill-colour-red",
    sound: false,
    bounce: true,
    notification: {
      title: "Build needs your help",
      body: "Something went wrong — click to see options.",
    },
  },
};
```

---

## 4. The Fuel Gauge (Session Budget)

### 4.1 The Problem

Users don't know what tokens are. They don't care about token counts. But they DO care about:
- "Will this use up my ChatGPT Plus messages?"
- "Am I going to hit a rate limit?"
- "How much of my daily allowance is this costing?"

### 4.2 The Translation

We translate technical resource consumption into a FUEL metaphor:

```
Technical reality:                          What user sees:
─────────────────                          ─────────────────
ChatGPT messages: 40 of ~80 used today     ⛽ Session: 50% used
Codex API tokens: 45,000 of ~100,000       (invisible — included in fuel)
Context windows respawned: 3 times          (invisible)
Rate limit cooldown: 0                      (invisible unless active)
```

### 4.3 Fuel Calculation

```typescript
// src/status-agent/fuel-gauge.ts

interface FuelState {
  percent:       number;         // 0-100, main gauge value
  label:         string;         // "Light session" | "Moderate" | "Heavy"
  detail:        string;         // "About 40% of today's session"
  warning:       boolean;        // true when approaching limit
  warningText:   string | null;  // "Approaching daily limit — build may pause"
  breakdown:     FuelBreakdown;  // for expand-on-click detail
}

interface FuelBreakdown {
  chatgptMessages:  { used: number; estimated_limit: number; label: string };
  cliTokens:        { used: number; budget: number; label: string };
  agentSpawns:      { count: number; label: string };
}

const FUEL_CONFIG = {
  // ChatGPT Plus: ~80 messages per 3 hours (approximate, varies)
  // ChatGPT Pro: ~unlimited
  // We detect tier from DOM (Plus badge, Pro badge)
  CHATGPT_PLUS_ESTIMATE:   80,     // messages per 3-hour window
  CHATGPT_PRO_ESTIMATE:    999,    // effectively unlimited
  CHATGPT_FREE_ESTIMATE:   15,     // very limited

  // How we estimate message usage per build tier
  MESSAGES_PER_TIER: {
    0: 1,         // Tier 0: fast-path, 1 message
    1: 3,         // Tier 1: intake + simple task
    2: 15,        // Tier 2: medium build
    3: 40,        // Tier 3: complex build (candle store)
  },

  // CLI token consumption (from Codex --json usage reports)
  // This is invisible to the user but affects our internal budget management
  CLI_TOKEN_BUDGET: {
    tier_1: 15_000,
    tier_2: 50_000,
    tier_3: 150_000,
  },

  // Fuel gauge thresholds
  WARNING_PERCENT:    75,     // show warning at 75%
  CRITICAL_PERCENT:   90,     // show critical at 90%
  RATE_LIMIT_BUFFER:  5,      // reserve 5 messages for error recovery
};

function calculateFuel(
  tier: number,
  chatgptTier: "free" | "plus" | "pro",
  messagesUsedThisSession: number,
  cliTokensUsed: number,
  totalMessagesEstimate: number
): FuelState {

  const messageLimit = {
    free: FUEL_CONFIG.CHATGPT_FREE_ESTIMATE,
    plus: FUEL_CONFIG.CHATGPT_PLUS_ESTIMATE,
    pro:  FUEL_CONFIG.CHATGPT_PRO_ESTIMATE,
  }[chatgptTier];

  const estimatedTotalMessages = FUEL_CONFIG.MESSAGES_PER_TIER[tier] || 20;
  const messagesRemaining = messageLimit - messagesUsedThisSession;
  const buildNeedsMore = estimatedTotalMessages - totalMessagesEstimate;

  // Fuel percent: how much of the user's session budget this build has consumed
  const percent = Math.round((messagesUsedThisSession / messageLimit) * 100);

  const warning = percent >= FUEL_CONFIG.WARNING_PERCENT;
  let warningText: string | null = null;

  if (percent >= FUEL_CONFIG.CRITICAL_PERCENT) {
    warningText = "Almost at today's limit — build may need to pause and resume later";
  } else if (warning) {
    warningText = "Getting close to today's limit — we'll pace the remaining steps";
  }

  const label =
    percent < 30 ? "Light session" :
    percent < 60 ? "Moderate" :
    percent < 80 ? "Getting busy" :
    "Heavy session";

  return {
    percent,
    label,
    detail: `About ${percent}% of today's session used`,
    warning,
    warningText,
    breakdown: {
      chatgptMessages: {
        used: messagesUsedThisSession,
        estimated_limit: messageLimit,
        label: `~${messagesUsedThisSession} of ~${messageLimit} messages`,
      },
      cliTokens: {
        used: cliTokensUsed,
        budget: FUEL_CONFIG.CLI_TOKEN_BUDGET[`tier_${tier}`] || 50_000,
        label: "Code generation budget",
      },
      agentSpawns: {
        count: totalMessagesEstimate,
        label: `${totalMessagesEstimate} work steps completed`,
      },
    },
  };
}
```

### 4.4 How It Renders

In the tree panel (expanded):

```
  ⛽ Session
  ━━━━━━━━━━━━━━━━━░░░░  72%
  Moderate — about 72% of today's session used

  Click to see details ▸
```

Expanded:

```
  ⛽ Session Details
  ━━━━━━━━━━━━━━━━━░░░░  72%

  ChatGPT messages     ~32 of ~80 used
  Work steps           6 of 9 complete
  Estimated remaining  ~8 more messages needed

  ⚠ Getting close to limit — we'll pace the remaining steps
```

In the top bar (minimised):

```
  [🔨 Building candle store ━━━░░ 67%  12min  ⛽72%]
```

Just the small fuel icon and percentage. Non-intrusive.

### 4.5 ChatGPT Tier Detection

We detect the user's subscription tier from the DOM to set accurate limits:

```typescript
// src/main/chatgpt-tier-detect.ts

async function detectChatGPTTier(chatView: BrowserView): Promise<"free" | "plus" | "pro"> {
  return chatView.webContents.executeJavaScript(`
    (() => {
      const text = document.body.innerText;
      // Pro users see "ChatGPT Pro" in sidebar or settings
      if (text.includes('ChatGPT Pro') || text.includes('Pro plan')) return 'pro';
      // Plus users see "ChatGPT Plus" or the model selector shows GPT-4
      if (text.includes('ChatGPT Plus') || text.includes('Plus plan')) return 'plus';
      if (document.querySelector('[data-testid="model-selector"]')?.textContent?.includes('4')) return 'plus';
      return 'free';
    })()
  `);
}
```

### 4.6 Rate Limit Anticipation

Instead of HITTING the rate limit and then waiting, we ANTICIPATE it:

```typescript
const RATE_LIMIT_ANTICIPATION = {
  // When fuel gauge > 85%, slow down ChatGPT message injection
  SLOW_DOWN_THRESHOLD:   85,
  SLOW_DOWN_DELAY_MS:    5_000,    // 5 second gap between messages (normally 0)

  // When fuel gauge > 92%, defer non-critical ChatGPT messages
  DEFER_THRESHOLD:       92,
  DEFER_TYPES:           ["research", "image-gen"],  // these can wait

  // When fuel gauge > 98%, pause all ChatGPT usage
  // CLI (Codex/Claude) continues — different budget
  PAUSE_THRESHOLD:       98,
  PAUSE_MESSAGE:         "Pausing to avoid hitting your message limit. Code work continues.",

  // Reserve messages for error recovery (always keep N messages in reserve)
  RESERVE_MESSAGES:      5,
};
```

This means we rarely HIT the actual rate limit. We see it coming and slow down or defer, keeping the build running on CLI while ChatGPT messages are rationed.

---

## 5. Conversation Isolation

### 5.1 The Build Conversation

When a build starts, we create a NEW ChatGPT conversation for it. All build-related injections go into this conversation. The user's existing conversations are never touched.

```typescript
async function createBuildConversation(
  chatView: BrowserView,
  projectName: string
): Promise<string> {
  // Click "New Chat" in ChatGPT sidebar
  await chatView.webContents.executeJavaScript(`
    (() => {
      const newChat = document.querySelector('nav a[href="/"]')
        || document.querySelector('button[aria-label="New chat"]');
      if (newChat) newChat.click();
    })()
  `);

  await sleep(1000); // wait for new conversation to load

  // Inject a naming message so user can identify this conversation
  await injectMessage(chatView,
    "This conversation is being used by [App Name] to build your project. " +
    "You can chat normally in other conversations while this runs."
  );

  // Return the conversation URL/ID for tracking
  const url = await chatView.webContents.executeJavaScript("window.location.href");
  return url;
}
```

### 5.2 Background Injection

When the user is in a DIFFERENT ChatGPT conversation and we need to inject into the build conversation:

```typescript
async function backgroundInject(
  chatView: BrowserView,
  buildConversationUrl: string,
  message: string
): Promise<void> {
  // 1. Save current conversation URL
  const currentUrl = await chatView.webContents.executeJavaScript("window.location.href");
  const isInBuildConvo = currentUrl === buildConversationUrl;

  if (isInBuildConvo) {
    // User is watching the build. Inject directly.
    await injectMessage(chatView, message);
    return;
  }

  // 2. User is in a different conversation.
  //    Strategy: navigate to build conversation, inject, navigate back.
  //    This causes a brief flicker — mitigate by doing it quickly.

  // Check if user is typing (don't interrupt)
  const isTyping = await chatView.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector('#prompt-textarea, [contenteditable="true"]');
      return input && input.textContent && input.textContent.length > 0;
    })()
  `);

  if (isTyping) {
    // Wait for user to stop typing (max 10 seconds)
    await waitForTypingStop(chatView, SESSION_CONFIG.INJECT_MAX_WAIT_MS);
  }

  // 3. Navigate to build conversation
  await chatView.webContents.loadURL(buildConversationUrl);
  await sleep(800); // wait for conversation to load

  // 4. Inject
  await injectMessage(chatView, message);

  // 5. Navigate back to user's conversation
  await chatView.webContents.loadURL(currentUrl);
}
```

**Trade-off acknowledged:** Background injection causes a brief visual flicker if the user is looking at ChatGPT. This is acceptable for Tier 2-3 builds where the user expects background work. For Tier 1 builds (simple, fast), we inject in the foreground since the user is watching the build conversation anyway.

**Future improvement:** ChatGPT may support multiple conversations via tabs or API. When available, we use that instead of navigate-inject-navigate.

---

## 6. Session Persistence

### 6.1 What Happens When User Closes the App Mid-Build

```typescript
const PERSISTENCE_CONFIG = {
  // Auto-save build state every N seconds
  AUTO_SAVE_INTERVAL_MS: 10_000,    // every 10 seconds

  // What we save
  SAVE_TO_DISK: {
    dagProgress:        true,       // which steps are done/running/pending
    spineSnapshot:      true,       // current project state
    fuelState:          true,       // session budget consumed
    treeState:          true,       // which nodes expanded, scroll position
    pendingQueries:     true,       // unanswered user queries
    agentSessions:      true,       // session IDs for codex/claude resume
    buildConvoUrl:      true,       // ChatGPT conversation URL
  },

  // Where we save
  SAVE_PATH: "~/Library/Application Support/[AppName]/builds/",

  // On relaunch: show "Resume build?" dialog
  RESUME_DIALOG: {
    title: "Welcome back!",
    body: "Your candle store build was in progress. Want to continue?",
    options: [
      { label: "Continue building", value: "resume" },
      { label: "Start fresh", value: "discard" },
    ],
  },
};
```

### 6.2 Resume Flow

```
App relaunches
  │
  ├─ Check: is there a saved build?
  │    │
  │    ├─ NO → IDLE state, full ChatGPT
  │    │
  │    └─ YES → Show resume dialog
  │         │
  │         ├─ "Continue building"
  │         │    → Load DAG progress
  │         │    → Resume Codex sessions (codex resume <id>)
  │         │    → Rebuild tree from saved state
  │         │    → BUILDING state, tree expanded
  │         │    → Status Agent: "Picking up where we left off..."
  │         │
  │         └─ "Start fresh"
  │              → Archive saved build (Archivist)
  │              → Clear state
  │              → IDLE state
```

---

## 7. Complete IPC Map

### 7.1 Main Process → Renderer

```typescript
// All IPC channels between main process and the overlay renderer

interface AppShellIPC {
  // Layout state
  "shell:state-change":    (state: "idle" | "building" | "minimised" | "complete") => void;
  "shell:resize":          (bounds: { chatgpt: Rectangle; tree: Rectangle | null }) => void;

  // Top bar (minimised state)
  "topbar:update":         (data: TopBarState) => void;
  "topbar:notification":   (level: "info" | "warning" | "blocking" | "complete" | "error") => void;

  // Fuel gauge
  "fuel:update":           (state: FuelState) => void;
  "fuel:warning":          (text: string) => void;

  // Build lifecycle
  "build:started":         (projectName: string, tier: number, estimatedTime: string) => void;
  "build:complete":        (outputs: TreeNodeOutput[]) => void;
  "build:error":           (message: string, canRetry: boolean) => void;

  // Session
  "session:resume-prompt": (savedState: SavedBuildState) => void;
  "session:chatgpt-tier":  (tier: "free" | "plus" | "pro") => void;
}
```

### 7.2 Renderer → Main Process

```typescript
interface AppShellUserIPC {
  // Layout control
  "user:hide-tree":        () => void;
  "user:expand-tree":      () => void;
  "user:dismiss-tree":     () => void;

  // Session
  "user:resume-build":     () => void;
  "user:discard-build":    () => void;

  // Quick input (bottom bar, available in all states)
  "user:quick-input":      (text: string) => void;
}
```

---

## 8. Hardcoded Layout Values

```typescript
const APP_SHELL_CONSTANTS = {
  // Window
  MIN_WINDOW_WIDTH:       800,
  MIN_WINDOW_HEIGHT:      600,
  DEFAULT_WINDOW_WIDTH:   1280,
  DEFAULT_WINDOW_HEIGHT:  820,

  // Title bar
  TITLE_BAR_HEIGHT:       40,
  TITLE_BAR_STYLE:        "hiddenInset",   // macOS native with traffic lights

  // Tree panel
  TREE_PANEL_RATIO:       0.45,            // 45% of window when expanded
  TREE_MIN_WIDTH:         320,
  TREE_MAX_WIDTH:         520,
  TREE_SLIDE_DURATION:    300,             // ms

  // ChatGPT
  CHATGPT_MIN_WIDTH:      480,
  CHATGPT_FULL_ON_IDLE:   true,

  // Top bar pill (minimised)
  TOP_BAR_HEIGHT:         44,
  TOP_BAR_PILL_RADIUS:    22,

  // Bottom quick input
  BOTTOM_BAR_HEIGHT:      48,
  BOTTOM_BAR_VISIBLE:     "building",      // only visible during build states

  // Auto-save
  AUTO_SAVE_INTERVAL:     10_000,          // 10 seconds

  // Fuel gauge
  FUEL_WARNING_PERCENT:   75,
  FUEL_CRITICAL_PERCENT:  90,
  FUEL_RESERVE_MESSAGES:  5,

  // Rate limit anticipation
  SLOW_DOWN_AT:           85,              // percent
  DEFER_AT:               92,
  PAUSE_AT:               98,

  // Background injection
  TYPING_WAIT_MS:         2_000,
  TYPING_MAX_WAIT_MS:     10_000,
  CONVO_SWITCH_DELAY_MS:  800,
};
```

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `src/main/layout-manager.ts` | Window layout calculations, BrowserView resize, state transitions |
| `src/main/chatgpt-session.ts` | Build conversation creation, background injection, conversation isolation |
| `src/main/chatgpt-tier-detect.ts` | Detect ChatGPT Plus/Pro/Free from DOM |
| `src/main/build-persistence.ts` | Save/restore build state across app restarts |
| `src/status-agent/fuel-gauge.ts` | Session budget calculation, rate limit anticipation |
| `src/renderer/components/AppShell.tsx` | Root layout: idle/building/minimised states |
| `src/renderer/components/TopBarPill.tsx` | Minimised state progress pill |
| `src/renderer/components/TreePanel.tsx` | Right panel container for ProgressTree |
| `src/renderer/components/FuelGauge.tsx` | Visual fuel meter with expand-on-click detail |
| `src/renderer/components/QuickInput.tsx` | Bottom bar text input (available in all build states) |
| `src/renderer/components/ResumeDialog.tsx` | "Welcome back" resume/discard dialog |
| `src/main/preload.ts` | IPC bridge additions for shell + fuel + session |

---

*This document is the authoritative reference for the app shell architecture. All layout decisions, ChatGPT coexistence rules, resource visibility, and state transitions are defined here. The user never loses access to ChatGPT. The build never hides unless the user asks. The fuel gauge never lies.*
