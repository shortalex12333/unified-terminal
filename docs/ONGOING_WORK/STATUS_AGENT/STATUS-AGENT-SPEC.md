# Status Agent — Definitive Specification

> **Status**: GOSPEL — This document is the authoritative reference for the Status Agent: translation, user queries, interrupts, and the frontend data contract.
> **Last Updated**: 2026-03-04
> **Companion to**: PROMPT-INJECTION-ARCHITECTURE.md, UNIVERSAL-ADAPTER-TEST-ARCHITECTURE.md, HARDCODED-ENFORCEMENT-VALUES.md

---

## Executive Summary

The Status Agent is the only actor in the system that faces the user. Every other actor — Conductor, PA, Bodyguard, Spine, workers — operates invisibly. The Status Agent has three jobs: translate technical events into human language, render decision points as visual buttons/inputs when user direction is needed, and handle interrupts surgically so corrections reach ONLY the affected agents while everything else continues uninterrupted.

The user never sees: Codex, GSD, MCP, JSON, exit codes, session IDs, token counts, agent names, or file paths.

The user always sees: plain English, progress filling up, branches growing, and buttons when their input matters.

---

## 1. The Three Jobs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STATUS AGENT: THREE JOBS, ONE SKIN                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   JOB 1: TRANSLATOR                                                        │
│   ─────────────────                                                         │
│   Technical event from any agent  ──►  Human-readable status line          │
│   "codex exec exit 0, 3 files"    ──►  "Built your homepage"               │
│   Click to expand ──►  "Created 3 files: homepage, styles, images"         │
│                                                                             │
│   JOB 2: QUERY ROUTER                                                      │
│   ────────────────────                                                      │
│   Agent needs user direction      ──►  Buttons / text input rendered       │
│   "Design preference unclear"     ──►  [Minimal] [Bold] [Playful]         │
│   User picks "Minimal"            ──►  Routed to SPECIFIC agent via PA     │
│                                                                             │
│   JOB 3: INTERRUPT HANDLER                                                 │
│   ────────────────────────                                                  │
│   User contradicts or stops       ──►  Identify affected agent(s)          │
│   "Don't generate images"         ──►  Pause image-gen ONLY                │
│   All other agents                ──►  Continue uninterrupted              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Critical architectural rule:** The Status Agent is NOT an LLM agent. Jobs 1 and 3 are pure code (regex translation, Spine lookup, IPC routing). Job 2 uses an LLM call ONLY when the query needs natural language interpretation (e.g., user typed a free-text correction). Button clicks and structured inputs are routed without any LLM involvement.

---

## 2. Job 1: The Translator

### 2.1 Event Source → Human Output

Every actor in the system emits typed events. The Status Agent subscribes to all of them and translates:

```typescript
// src/status-agent/translator.ts

interface StatusEvent {
  source:     string;          // "conductor" | "executor-step-3" | "bodyguard" | "pa" | "spine"
  type:       string;          // event type key
  detail:     string;          // technical detail (for cascade)
  timestamp:  number;
}

interface StatusLine {
  id:           string;        // unique ID for this status line
  text:         string;        // human-readable: "Building your homepage"
  expandable:   boolean;       // can the user click to see more?
  expandedText: string | null; // cascade detail: "Created 3 files..."
  state:        "pending" | "active" | "done" | "error" | "paused" | "waiting_user";
  stepId:       number | null; // links to DAG step (for tree rendering)
  parentId:     string | null; // for branch nesting
  progress:     number | null; // 0-100 if calculable
  icon:         string;        // emoji or icon class
}
```

### 2.2 The Translation Map

Every technical event has a pre-defined human translation. NO LLM CALLS for translation — this is a lookup table:

```typescript
const TRANSLATIONS: Record<string, (detail: string) => StatusLine> = {

  // ── CONDUCTOR ──────────────────────────────────────────────────
  "conductor:classify": (d) => ({
    text: "Understanding what you need...",
    expandedText: null,
    state: "active",
    icon: "💭",
  }),
  "conductor:plan-ready": (d) => {
    const stepCount = JSON.parse(d).steps?.length || "several";
    return {
      text: `Got it! Planning ${stepCount} steps to build this.`,
      expandedText: `Here's the plan:\n${formatPlanForHuman(JSON.parse(d))}`,
      expandable: true,
      state: "done",
      icon: "📋",
    };
  },
  "conductor:re-plan": (d) => ({
    text: "Adjusting the approach...",
    expandedText: `Changed plan because: ${simplifyReason(d)}`,
    expandable: true,
    state: "active",
    icon: "🔄",
  }),

  // ── EXECUTOR / WORKERS ────────────────────────────────────────
  "worker:spawn": (d) => ({
    text: humanizeWorkerTask(JSON.parse(d)),   // "Setting up your project..." / "Building your pages..."
    expandedText: null,
    state: "active",
    icon: "⚡",
  }),
  "worker:file-created": (d) => {
    const file = JSON.parse(d);
    return {
      text: `Creating ${humanizeFileName(file.name)}`,
      expandedText: `New file: ${file.path} (${file.sizeHuman})`,
      expandable: true,
      state: "active",
      icon: "📄",
    };
  },
  "worker:complete": (d) => ({
    text: humanizeWorkerComplete(JSON.parse(d)),  // "Homepage ready" / "Images created"
    expandedText: `Completed in ${JSON.parse(d).duration}. ${JSON.parse(d).filesCreated} files produced.`,
    expandable: true,
    state: "done",
    icon: "✅",
  }),

  // ── BODYGUARD ─────────────────────────────────────────────────
  "bodyguard:checking": (_) => ({
    text: "Checking everything works...",
    expandedText: null,
    state: "active",
    icon: "🔍",
  }),
  "bodyguard:pass": (_) => ({
    text: "All checks passed",
    expandedText: null,
    state: "done",
    icon: "✅",
  }),
  "bodyguard:fail-heuristic": (d) => ({
    text: "Found something to review",
    expandedText: `Check "${JSON.parse(d).checkName}" flagged a potential issue: ${simplifyCheckResult(d)}`,
    expandable: true,
    state: "waiting_user",
    icon: "⚠️",
  }),
  "bodyguard:fail-definitive": (d) => ({
    text: "Found an issue, fixing it...",
    expandedText: `${JSON.parse(d).checkName} failed. Auto-retry in progress.`,
    expandable: true,
    state: "error",
    icon: "🔧",
  }),

  // ── PA / MESSENGER ────────────────────────────────────────────
  "pa:handoff": (_) => ({
    text: "Moving to next step...",
    expandedText: null,
    state: "done",
    icon: "➡️",
  }),
  "pa:format-mismatch": (d) => ({
    text: "Adjusting output for next step...",
    expandedText: `Previous step's output needed reformatting: ${simplifyMismatch(d)}`,
    expandable: true,
    state: "active",
    icon: "🔄",
  }),

  // ── RATE LIMIT ────────────────────────────────────────────────
  "rate-limit:hit": (d) => ({
    text: "Taking a short break...",
    expandedText: `One of our tools needs to cool down. Estimated wait: ${JSON.parse(d).estimatedWait}. Other work continues in the background.`,
    expandable: true,
    state: "paused",
    icon: "⏸️",
  }),
  "rate-limit:resumed": (_) => ({
    text: "Back to work!",
    expandedText: null,
    state: "done",
    icon: "▶️",
  }),

  // ── IMAGES ────────────────────────────────────────────────────
  "image-gen:start": (d) => ({
    text: "Creating images for your site...",
    expandedText: `Generating: ${JSON.parse(d).description}`,
    expandable: true,
    state: "active",
    icon: "🎨",
  }),
  "image-gen:complete": (d) => ({
    text: "Images ready",
    expandedText: `Created ${JSON.parse(d).count} images`,
    expandable: true,
    state: "done",
    icon: "🖼️",
  }),

  // ── DEPLOY ────────────────────────────────────────────────────
  "deploy:start": (_) => ({
    text: "Publishing your site...",
    expandedText: null,
    state: "active",
    icon: "🚀",
  }),
  "deploy:live": (d) => ({
    text: "Your site is live!",
    expandedText: `Visit: ${JSON.parse(d).url}`,
    expandable: true,
    state: "done",
    icon: "🌐",
  }),

  // ── RESEARCH ──────────────────────────────────────────────────
  "research:searching": (d) => ({
    text: "Researching...",
    expandedText: `Looking into: ${JSON.parse(d).topic}`,
    expandable: true,
    state: "active",
    icon: "🔎",
  }),
  "research:complete": (d) => ({
    text: "Research complete",
    expandedText: `Found ${JSON.parse(d).sourceCount} sources. Key findings ready.`,
    expandable: true,
    state: "done",
    icon: "📊",
  }),
};
```

### 2.3 Human Language Helper Functions

```typescript
function humanizeWorkerTask(data: { role: string; mandate: string }): string {
  // Pattern match on mandate keywords → friendly phrase
  const TASK_PATTERNS: Array<[RegExp, string]> = [
    [/scaffold|init|setup|bootstrap/i,    "Setting up your project..."],
    [/homepage|landing|hero/i,            "Building your homepage..."],
    [/form|contact|input/i,              "Creating your forms..."],
    [/auth|login|signup/i,               "Setting up user accounts..."],
    [/payment|stripe|checkout/i,          "Setting up payments..."],
    [/image|logo|brand/i,                "Working on your visuals..."],
    [/test|verify|check/i,              "Testing everything..."],
    [/deploy|publish|launch/i,           "Publishing your site..."],
    [/database|schema|table/i,           "Setting up your data..."],
    [/style|css|design|theme/i,          "Styling your site..."],
    [/api|route|endpoint/i,             "Building the backend..."],
    [/content|copy|text/i,              "Writing your content..."],
  ];

  for (const [pattern, text] of TASK_PATTERNS) {
    if (pattern.test(data.mandate)) return text;
  }
  return "Working on your project...";
}

function humanizeFileName(name: string): string {
  // Turn "ContactForm.tsx" → "contact form"
  return name
    .replace(/\.(tsx?|jsx?|css|html|json|md)$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .trim()
    .toLowerCase();
}

function simplifyReason(detail: string): string {
  const data = JSON.parse(detail);
  const REASON_MAP: Record<string, string> = {
    "step-failed":     "A step didn't work, trying a different approach",
    "scope-expanded":  "Discovered more work needed",
    "user-correction": "Updated based on your feedback",
    "retraction":      "Found an issue in earlier work, fixing it",
  };
  return REASON_MAP[data.reason] || "Optimizing the approach";
}
```

### 2.4 Cascade-on-Click Pattern

The frontend renders each `StatusLine`. When `expandable: true`, clicking the line reveals `expandedText`. For deeper cascades (e.g., "Building your homepage" → "Created 3 files" → individual file details), the tree structure handles nesting via `parentId`.

```
USER SEES (collapsed):

  ✅ Understood your requirements
  ✅ Set up your project
  ⚡ Building your homepage...              ← click to expand
  ○ Creating images for your site
  ○ Setting up payments
  ○ Testing everything
  ○ Publishing your site

USER CLICKS "Building your homepage...":

  ✅ Understood your requirements
  ✅ Set up your project
  ⚡ Building your homepage...              ← expanded
  │  ├─ 📄 Creating homepage layout
  │  ├─ 📄 Creating navigation
  │  └─ 📄 Creating hero section           ← active
  ○ Creating images for your site
  ○ Setting up payments
  ○ Testing everything
  ○ Publishing your site
```

---

## 3. Job 2: The Query Router

### 3.1 When Queries Happen

Agents need user direction in these scenarios:

| Trigger | Source | Example |
|---------|--------|---------|
| Ambiguous mandate | Conductor | "Should this be a single page or multiple pages?" |
| Design decision | Skill Injector | "Pick a style: Minimal / Bold / Playful" |
| Heuristic check fail | Bodyguard | "This might not look right on mobile. Fix it or keep going?" |
| Missing asset | Worker | "I need a logo. Generate one or do you have one?" |
| Scope expansion | Conductor | "This needs a database. Want me to add that?" |
| Circuit breaker | Step Scheduler | "This step failed 3 times. Retry / Skip / Stop?" |

### 3.2 The Query Object

```typescript
// src/status-agent/query.ts

interface UserQuery {
  id:            string;           // unique query ID
  source:        string;           // which agent/step is asking
  stepId:        number | null;    // DAG step ID (for routing response back)
  agentHandle:   string;           // process handle or session ID of the asking agent
  type:          "choice" | "text" | "confirm" | "upload";
  question:      string;           // human-friendly question text
  options:       QueryOption[];    // for choice type: button options
  placeholder:   string | null;    // for text type: input placeholder
  defaultChoice: string | null;    // what happens if user ignores for 30s
  timeout:       number;           // ms before defaultChoice activates
  priority:      "normal" | "blocking";  // blocking = agent is paused waiting
}

interface QueryOption {
  label:    string;                // button text: "Minimal"
  value:    string;                // routing value: "style-minimal"
  detail:   string | null;        // tooltip: "Clean lines, lots of whitespace"
  icon:     string | null;        // optional icon
}
```

### 3.3 Query Rendering

The frontend renders queries as interactive elements at the current position in the tree:

```
  ✅ Set up your project
  ⚡ Building your homepage...
  │
  │  ❓ What style should your site have?
  │
  │    ┌─────────┐  ┌─────────┐  ┌──────────┐
  │    │ Minimal │  │  Bold   │  │ Playful  │
  │    │ Clean,  │  │ Strong  │  │ Fun,     │
  │    │ simple  │  │ colors  │  │ colorful │
  │    └─────────┘  └─────────┘  └──────────┘
  │
  │    Or type your own: [                        ]
  │
  │    ⏱ Picking "Minimal" automatically in 25s...
  │
  ○ Creating images for your site
```

### 3.4 Response Routing

When the user picks an option or types text, the response flows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUERY RESPONSE FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User clicks [Minimal]                                                    │
│        │                                                                    │
│        ▼                                                                    │
│   Frontend sends IPC:                                                      │
│     { queryId: "q-123", value: "style-minimal", source: "user-click" }    │
│        │                                                                    │
│        ▼                                                                    │
│   Status Agent receives, constructs PA envelope:                           │
│     {                                                                      │
│       target:   query.agentHandle,     // the specific agent that asked    │
│       stepId:   query.stepId,          // the DAG step                     │
│       type:     "query_response",                                          │
│       priority: "normal",                                                  │
│       payload:  { question: query.id, answer: "style-minimal" }           │
│     }                                                                      │
│        │                                                                    │
│        ▼                                                                    │
│   PA receives envelope:                                                    │
│     1. Validates: is target agent still running? (Spine check)            │
│     2. Routes response to the SPECIFIC agent:                              │
│        - If agent is PAUSED waiting: resume with response injected         │
│        - If agent is RUNNING: queue response for next checkpoint           │
│        - If agent is DEAD: attach to correction for respawn               │
│     3. No other agents are affected.                                       │
│        │                                                                    │
│        ▼                                                                    │
│   Target agent receives (via Prompt Injection Architecture):               │
│     "User has chosen: Minimal style. Apply clean lines, generous           │
│      whitespace, muted color palette."                                     │
│                                                                            │
│   All other agents: UNAWARE. Continue working.                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Default/Timeout Behavior

```typescript
const QUERY_DEFAULTS = {
  // How long before auto-selecting the default
  TIMEOUT_MS:        30_000,     // 30 seconds

  // Show countdown to user
  COUNTDOWN_VISIBLE: true,

  // For "blocking" queries (agent is paused): shorter timeout
  BLOCKING_TIMEOUT_MS: 60_000,  // 60 seconds

  // For non-blocking: agent continues with default, applies correction later if user picks different
  NON_BLOCKING_BEHAVIOR: "continue_with_default",
};
```

### 3.6 The Codex Problem: Forced Checkpoints

You identified this precisely: Codex one-shots and fucks it up. It doesn't pause to ask. Claude Code pauses 10-15 times per project.

Our solution: the **mandatory checkpoint system** forces queries at defined intervals:

```typescript
const FORCED_CHECKPOINTS = {
  // After plan is generated, ALWAYS show to user before execution begins
  PLAN_REVIEW: {
    trigger:   "conductor:plan-ready",
    query: {
      type:     "confirm",
      question: "Here's what I'm going to build. Look good?",
      options:  [
        { label: "Let's go!", value: "approve" },
        { label: "Change something", value: "modify" },
      ],
      priority: "blocking",      // Conductor PAUSES until user responds
      timeout:  120_000,         // 2 minutes, then auto-approve
    },
  },

  // After first visible output (homepage, first component), show preview
  FIRST_OUTPUT: {
    trigger:   "worker:first-visible-output",
    query: {
      type:     "confirm",
      question: "Here's how it's looking so far. Continue?",
      options:  [
        { label: "Looking great!", value: "continue" },
        { label: "Not quite right", value: "adjust" },
      ],
      priority: "blocking",
      timeout:  60_000,
    },
  },

  // Before deploy, ALWAYS confirm
  PRE_DEPLOY: {
    trigger:   "conductor:pre-deploy",
    query: {
      type:     "confirm",
      question: "Ready to publish your site to the internet?",
      options:  [
        { label: "Publish it!", value: "deploy" },
        { label: "Let me review first", value: "pause" },
      ],
      priority: "blocking",
      timeout:  null,           // NEVER auto-deploy. User must confirm.
    },
  },

  // Every 5 completed steps for Tier 3 builds
  PROGRESS_CHECK: {
    trigger:   "conductor:steps-completed-modulo-5",
    query: {
      type:     "confirm",
      question: "Still on track?",
      options:  [
        { label: "Keep going", value: "continue" },
        { label: "I have feedback", value: "feedback" },
      ],
      priority: "normal",       // non-blocking — agents continue, user can interrupt
      timeout:  30_000,
    },
  },
};
```

This means even Codex, which would normally one-shot everything, gets STOPPED at these gates because the Conductor pauses before dispatching the next phase. The checkpoint isn't inside Codex — it's AROUND Codex, in our orchestration layer.

---

## 4. Job 3: The Interrupt Handler

### 4.1 The Surgical Correction Flow

This is the game changer. User hits stop or types a correction. Only the affected agent(s) get interrupted. Everyone else continues.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SURGICAL INTERRUPT PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   USER ACTION                                                              │
│   "No don't generate new images, use my existing logo"                     │
│        │                                                                    │
│        ▼                                                                    │
│   [1] STATUS AGENT: First-Pass Classification (code, not LLM)             │
│       • Parse user text for target keywords:                               │
│         "image" "generate" "logo" → matches step type: IMAGE_GEN          │
│       • Read Spine: which agents are currently running?                     │
│         Running: executor-step-3 (code), image-gen-step-5, deploy-step-9   │
│       • Match: image-gen-step-5 is the target                              │
│       • Construct correction envelope:                                      │
│         {                                                                   │
│           target:       "image-gen-step-5",                                │
│           correction:   "Use uploaded logo at /uploads/logo.png.           │
│                          Do NOT generate new images.",                      │
│           type:         "user_correction",                                 │
│           priority:     "elevated",                                        │
│           affectedSteps: [5],                                              │
│           timestamp:    Date.now(),                                        │
│         }                                                                   │
│        │                                                                    │
│        ▼                                                                    │
│   [2] PA/MESSENGER: Validates + Routes (hard rail)                         │
│       • Validate target: is step-5 actually running? (Spine confirms YES) │
│       • Validate scope: does this correction affect OTHER steps?           │
│         - Step 3 (code): uses images? NO → unaffected                     │
│         - Step 7 (content): references images? YES → secondary target     │
│         - Step 9 (deploy): includes images? YES but downstream, gets new  │
│           images naturally when step 5 re-runs                             │
│       • Final affected set: [5, 7]                                        │
│       • Unaffected: [3, 4, 6, 8, 9] → CONTINUE RUNNING                  │
│        │                                                                    │
│        ▼                                                                    │
│   [3] PA: Per-Agent Correction Dispatch                                    │
│                                                                             │
│       STEP 5 (image-gen, running on ChatGPT Web):                          │
│         Runtime: chatgpt_web → NO resume channel                           │
│         Action: KILL and respawn with correction baked into prompt          │
│         Prompt Injection adds CORRECTION source:                           │
│           "User has their own logo. Use /uploads/logo.png.                 │
│            Do NOT generate new images."                                     │
│                                                                             │
│       STEP 7 (content writer, running on Codex):                           │
│         Runtime: codex → HAS resume channel                                │
│         Action: Inject correction into running session:                     │
│           "---USER-UPDATE---                                               │
│            The logo has changed. User is providing their own.              │
│            Reference /uploads/logo.png in any content that mentions        │
│            the brand logo."                                                 │
│                                                                             │
│       STEPS 3, 4, 6, 8, 9: no message, no pause, no interruption         │
│                                                                             │
│        │                                                                    │
│        ▼                                                                    │
│   [4] STATUS AGENT: Confirms to User                                       │
│       Status line added:                                                   │
│         "✅ Got it — using your logo instead. Updating 2 steps."           │
│         Expanded: "Changed: image creation, content references.            │
│                    Unaffected: code, payments, testing, deploy."           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Classification: Status Agent Then PA

**Status Agent does first-pass (code-based keyword matching):**

```typescript
// src/status-agent/interrupt-classifier.ts

interface InterruptClassification {
  bestGuessTarget:   string | null;     // step ID or agent handle
  keywords:          string[];          // matched keywords
  confidence:        "high" | "medium" | "low";
  correctionText:    string;            // cleaned user intent
  needsLLM:         boolean;            // true if keywords didn't match anything
}

const INTERRUPT_KEYWORDS: Record<string, string[]> = {
  IMAGE_GEN:    ["image", "images", "logo", "photo", "picture", "generate", "dall-e", "visual"],
  DESIGN:       ["color", "colour", "style", "font", "layout", "look", "feel", "design", "theme"],
  CONTENT:      ["text", "copy", "words", "heading", "title", "description", "about"],
  CODE:         ["code", "function", "component", "page", "route", "button", "form"],
  DEPLOY:       ["deploy", "publish", "live", "launch", "domain", "url"],
  DATABASE:     ["database", "data", "table", "user", "account", "login", "auth"],
  PAYMENT:      ["payment", "stripe", "price", "checkout", "buy", "cart"],
};

function classifyInterrupt(
  userText: string,
  runningAgents: SpineAgentList
): InterruptClassification {

  const textLower = userText.toLowerCase();
  const matchedCategories: Array<{ category: string; score: number }> = [];

  for (const [category, keywords] of Object.entries(INTERRUPT_KEYWORDS)) {
    const matchCount = keywords.filter(kw => textLower.includes(kw)).length;
    if (matchCount > 0) {
      matchedCategories.push({ category, score: matchCount });
    }
  }

  // Sort by match count, highest first
  matchedCategories.sort((a, b) => b.score - a.score);

  if (matchedCategories.length === 0) {
    // No keyword match. Need LLM to interpret.
    return {
      bestGuessTarget: null,
      keywords: [],
      confidence: "low",
      correctionText: userText,
      needsLLM: true,
    };
  }

  // Find running agent that matches the top category
  const topCategory = matchedCategories[0].category;
  const targetAgent = runningAgents.find(a => agentMatchesCategory(a, topCategory));

  return {
    bestGuessTarget: targetAgent?.handle || null,
    keywords: matchedCategories.map(m => m.category),
    confidence: matchedCategories[0].score >= 2 ? "high" : "medium",
    correctionText: userText,
    needsLLM: false,
  };
}
```

**PA validates and may override:**

```typescript
// Inside PA routing logic

function validateInterrupt(
  classification: InterruptClassification,
  spine: SpineSnapshot
): ValidatedInterrupt {

  // Status Agent said "image-gen-step-5" is the target
  // PA checks: does step 5 ACTUALLY exist and is it running?
  const targetStep = spine.dagSteps.find(s => s.handle === classification.bestGuessTarget);

  if (!targetStep) {
    // Status Agent guessed wrong. PA searches all running steps.
    const actual = spine.dagSteps.find(s =>
      s.status === "running" &&
      agentMatchesCategory(s, classification.keywords[0])
    );
    return { ...classification, bestGuessTarget: actual?.handle || null, overridden: true };
  }

  // PA also checks: does this correction cascade to other running steps?
  const affected = spine.dagSteps.filter(s =>
    s.status === "running" &&
    s.dependencies.includes(targetStep.id) ||
    s.declaredFiles.some(f => targetStep.declaredFiles.includes(f))
  );

  return {
    ...classification,
    primaryTarget: targetStep.handle,
    secondaryTargets: affected.map(a => a.handle),
    unaffected: spine.dagSteps
      .filter(s => s.status === "running" && !affected.includes(s) && s !== targetStep)
      .map(s => s.handle),
    overridden: false,
  };
}
```

### 4.3 The Three Interrupt Mechanisms (Runtime-Dependent)

```typescript
// src/status-agent/interrupt-dispatch.ts

async function dispatchInterrupt(
  validated: ValidatedInterrupt,
  correction: string
): Promise<void> {

  // PRIMARY TARGET: immediate correction
  const primary = validated.primaryTarget;
  const runtime = getRuntime(primary);

  if (runtime === "codex" || runtime === "claude") {
    // Runtime supports session resume → INJECT mid-execution
    await deliverViaResume(primary.sessionId, runtime, buildInterruptPrompt(correction));
    // Agent receives correction WITHOUT being killed
  }
  else if (runtime === "gemini" || runtime === "chatgpt_web") {
    // Runtime does NOT support resume → KILL and RESPAWN with correction
    await killAgent(primary.handle);
    const correctedConfig = {
      ...primary.originalConfig,
      correction: {
        attemptNumber: primary.attemptNumber + 1,
        previousError: null,    // not an error — user correction
        userCorrection: correction,
      },
    };
    await cliDispatch(correctedConfig);
  }

  // SECONDARY TARGETS: queue correction for next checkpoint
  for (const secondary of validated.secondaryTargets) {
    const secRuntime = getRuntime(secondary);

    if (secRuntime === "codex" || secRuntime === "claude") {
      // Inject at next mandatory stop (don't interrupt mid-work)
      queueCorrectionForCheckpoint(secondary.handle, correction);
    } else {
      // Will get the correction when it naturally completes and respawns
      markStepForCorrection(secondary.stepId, correction);
    }
  }

  // UNAFFECTED: literally nothing happens to them
  // This line exists only as documentation: unaffected agents continue.
}
```

### 4.4 The Interrupt Prompt Template

What the agent actually receives when interrupted:

```typescript
function buildInterruptPrompt(userCorrection: string): string {
  return [
    "---USER-UPDATE---",
    "",
    "The user has provided a correction. This takes PRIORITY over your current approach.",
    "",
    `User said: "${userCorrection}"`,
    "",
    "Apply this change to your current work.",
    "If this contradicts your mandate, follow the USER'S instruction — they override the plan.",
    "If this doesn't affect your current work, acknowledge and continue.",
    "",
    "---END-USER-UPDATE---",
  ].join("\n");
}
```

---

## 5. The IPC Data Contract

### 5.1 Main Process → Renderer (Status Updates)

```typescript
// src/main/preload.ts additions

interface StatusIPC {
  // Status lines (translator output)
  "status:line":          (line: StatusLine) => void;
  "status:line-update":   (id: string, partial: Partial<StatusLine>) => void;

  // Queries (decision points for user)
  "status:query":         (query: UserQuery) => void;
  "status:query-timeout": (queryId: string, defaultValue: string) => void;

  // Tree structure updates
  "status:tree-node":     (node: TreeNode) => void;
  "status:tree-branch":   (parentId: string, childId: string) => void;

  // Interrupt confirmation
  "status:interrupt-ack": (detail: { affected: string[]; unaffected: string[]; message: string }) => void;
}
```

### 5.2 Renderer → Main Process (User Responses)

```typescript
interface UserResponseIPC {
  // Query response (button click or text input)
  "user:query-response":  (queryId: string, value: string) => void;

  // Free-text correction (user typed something unprompted)
  "user:correction":      (text: string) => void;

  // Stop button (user hit stop on a specific status line)
  "user:stop-step":       (stepId: number) => void;

  // Global stop (user hit the main stop button)
  "user:stop-all":        () => void;

  // File upload (user provides an asset mid-build)
  "user:upload":          (filePath: string, context: string) => void;
}
```

### 5.3 The Tree Node Structure

```typescript
interface TreeNode {
  id:         string;              // unique node ID
  parentId:   string | null;       // null = root level (main steps)
  label:      string;              // human-readable label
  state:      "pending" | "active" | "done" | "error" | "paused" | "waiting_user";
  progress:   number | null;       // 0-100
  expandable: boolean;
  expanded:   boolean;             // client-side state (starts false)
  children:   string[];            // child node IDs
  stepId:     number | null;       // DAG step reference
  agentId:    string | null;       // which agent owns this node
  output:     TreeNodeOutput | null;  // final output (link, file, preview)
}

interface TreeNodeOutput {
  type:     "url" | "file" | "preview" | "download";
  label:    string;                // "Visit your site" / "Download logo"
  value:    string;                // URL or file path
}
```

---

## 6. The Visual Tree: Vertical Timeline with Branches

### 6.1 Anatomy

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Building your candle store                              │
│  ═══════════════════════════════════════════ 67%          │
│                                                          │
│  ✅ Understood your requirements                     0:02│
│  │                                                       │
│  ✅ Set up your project                              0:45│
│  │                                                       │
│  ⚡ Building your pages                    ━━━━━━░░  60% │
│  │  ├─ ✅ Homepage layout                                │
│  │  ├─ ✅ Navigation bar                                 │
│  │  ├─ ⚡ Product gallery                   ← active     │
│  │  └─ ○ Footer                                          │
│  │                                                       │
│  │  ┌─ 🎨 Creating brand images           ← parallel    │
│  │  │  ├─ ✅ Hero banner                                 │
│  │  │  └─ ⚡ Product photos                              │
│  │  │                                                    │
│  │  └─ merge here when both complete                     │
│  │                                                       │
│  ○ Setting up payments                                   │
│  ○ Testing everything                                    │
│  ○ Publishing your site                                  │
│  │                                                       │
│  └─ 📦 Your finished site                  ← final      │
│     ├─ 🌐 Live URL (after deploy)                       │
│     ├─ 📁 Project files                                  │
│     └─ 📊 Performance report                             │
│                                                          │
│  ~15 minutes remaining                                   │
│                                                          │
│  ┌─────────────────┐  ┌──────────────────┐              │
│  │    ⏸ Pause      │  │   ✕ Cancel       │              │
│  └─────────────────┘  └──────────────────┘              │
│                                                          │
│  💬 Type a message or feedback...            [Send]      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Tree Rendering Rules

```typescript
const TREE_RENDER_CONFIG = {
  // Main steps (DAG top-level) are root nodes — always visible
  ROOT_ALWAYS_VISIBLE:   true,

  // Sub-steps (file creation, sub-agents) are children — collapsed by default
  CHILDREN_DEFAULT:      "collapsed",

  // Parallel branches shown when 2+ agents work simultaneously
  BRANCH_THRESHOLD:      2,

  // Branch merge: when parallel work converges back to the main trunk
  SHOW_MERGE:            true,

  // Max visible depth without scrolling
  MAX_VISIBLE_DEPTH:     2,         // root + 1 level of children

  // Animation: new nodes slide in from left
  NODE_ENTER_ANIMATION:  "slide-left 200ms ease-out",

  // Active node: gentle pulse animation
  ACTIVE_PULSE:          "pulse 2s ease-in-out infinite",

  // Completed node: brief checkmark animation then static
  COMPLETE_ANIMATION:    "check-pop 300ms ease-out",

  // Error node: brief shake then show correction status
  ERROR_ANIMATION:       "shake 200ms ease-in-out",

  // Time elapsed: shown on right edge for completed steps
  SHOW_ELAPSED:          true,

  // Progress bar: fills from left for the overall project
  OVERALL_PROGRESS_BAR:  true,

  // Final output node: always at bottom of tree, special styling
  OUTPUT_NODE_STYLE:     "highlighted",

  // User input area: always at bottom, below the tree
  INPUT_POSITION:        "bottom-fixed",
};
```

### 6.3 The Progress Bar (Vertical, Filling Up→Down)

The overall progress bar runs alongside the tree. Each completed root-level step fills a segment:

```typescript
function calculateProgress(dagSteps: DAGStep[]): number {
  const total = dagSteps.length;
  const completed = dagSteps.filter(s => s.status === "done").length;
  const active = dagSteps.filter(s => s.status === "running").length;

  // Completed steps count fully. Active steps count as half.
  return Math.round(((completed + active * 0.5) / total) * 100);
}
```

---

## 7. The Brand Voice System

### 7.1 Tone Rules

```typescript
const VOICE_RULES = {
  // NEVER say:
  BANNED_WORDS: [
    "executing", "spawning", "agent", "process", "thread", "runtime",
    "CLI", "API", "JSON", "token", "model", "LLM", "inference",
    "Codex", "GSD", "Claude Code", "Gemini", "MCP", "DAG",
    "stdin", "stdout", "stderr", "pipe", "spawn", "fork",
    "exit code", "session ID", "context window", "prompt",
    "node_modules", "package.json", "npm", "git commit",
  ],

  // ALWAYS use:
  PREFERRED_TERMS: {
    "agent":        "step",
    "execute":      "working on",
    "spawn":        "starting",
    "kill":         "stopping",
    "error":        "issue",
    "fail":         "didn't work",
    "retry":        "trying again",
    "deploy":       "publish",
    "repository":   "project",
    "commit":       "save",
    "rate limit":   "short break",
    "timeout":      "took too long",
    "context window": (never mention),
    "token":        (never mention),
  },

  // Sentence style:
  MAX_WORDS_PER_STATUS:  8,       // "Building your homepage" not "Currently executing the homepage construction worker agent"
  TENSE:                 "present-progressive",  // "Building..." not "Built" or "Will build"
  PERSON:                "first-plural",          // "We're building..." when personalizing
  EMOTION:               "calm-confident",        // Not excited, not apologetic
};
```

### 7.2 Error Voice

When things go wrong, the user should feel informed, not alarmed:

```typescript
const ERROR_VOICE = {
  // Auto-fixable errors: user barely notices
  AUTO_FIX:      "Found a small issue, fixing it...",       // then disappears when fixed

  // Needs retry: casual, no drama
  RETRY:         "That didn't quite work. Trying a different approach...",

  // Needs user: gentle, gives options
  USER_NEEDED:   "I need your help with something.",

  // Rate limit: normalize it
  RATE_LIMIT:    "Taking a short break — this is normal.",

  // Actual failure: honest but reassuring
  FAILURE:       "This step didn't work after a few tries. Here's what happened:",

  // NEVER: "Error", "Fatal", "Failed", "Exception", "Crash", "Critical", "Warning"
};
```

---

## 8. File Reference

| File | Purpose |
|------|---------|
| `src/status-agent/translator.ts` | Event → human text translation map |
| `src/status-agent/query.ts` | Query object construction + rendering data |
| `src/status-agent/interrupt-classifier.ts` | First-pass keyword classification of user corrections |
| `src/status-agent/interrupt-dispatch.ts` | Routes corrections to specific agents via PA |
| `src/status-agent/voice.ts` | Brand voice rules, banned words, preferred terms |
| `src/status-agent/tree-builder.ts` | Constructs TreeNode hierarchy from DAG + status events |
| `src/status-agent/forced-checkpoints.ts` | Mandatory pause points (plan review, first output, pre-deploy) |
| `src/renderer/components/ProgressTree.tsx` | Visual tree component with cascade-on-click |
| `src/renderer/components/QueryWidget.tsx` | Button/input rendering for user decisions |
| `src/renderer/components/InterruptBar.tsx` | Text input + stop button at bottom |
| `src/main/preload.ts` | IPC bridge additions for status + query + interrupt |

---

## 9. Hardcoded Values

```typescript
const STATUS_AGENT_CONSTANTS = {
  QUERY_TIMEOUT_MS:            30_000,    // 30s before auto-selecting default
  BLOCKING_QUERY_TIMEOUT_MS:   60_000,    // 60s for blocking queries
  DEPLOY_QUERY_TIMEOUT_MS:     null,      // NEVER auto-deploy
  PROGRESS_CHECK_INTERVAL:     5,         // every 5 completed steps
  MAX_STATUS_WORDS:            8,         // max words per status line
  TREE_MAX_VISIBLE_DEPTH:      2,         // root + 1 child level
  NODE_ANIMATION_MS:           200,       // slide-in animation
  INTERRUPT_CLASSIFY_TIMEOUT:  100,       // 100ms for keyword matching
  LLM_CLASSIFY_TIMEOUT:       3_000,     // 3s for LLM interpretation (fallback)
  INTERRUPT_MARKER:            "---USER-UPDATE---",
  INPUT_DEBOUNCE_MS:           300,       // debounce user typing
};
```

---

*This document is the authoritative reference for the Status Agent. All user-facing communication flows through this agent. No technical event reaches the frontend without translation. No user input reaches an agent without classification and routing through PA.*
