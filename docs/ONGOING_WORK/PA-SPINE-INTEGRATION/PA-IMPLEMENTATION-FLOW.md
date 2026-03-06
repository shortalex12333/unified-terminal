# PA (Pattern Analyzer) Implementation Flow

**Status:** Design Specification
**Date:** 2026-03-06
**Purpose:** Complete data flow documentation for the PA in multi-agent spine architecture

---

## Table of Contents

1. [PA Initialization Flow](#1-pa-initialization-flow)
2. [Polling Cycle (Every 30s)](#2-polling-cycle-every-30s)
3. [User Correction Flow](#3-user-correction-flow)
4. [RED Agent -> Handover Flow](#4-red-agent---handover-flow)
5. [Pattern -> Skill Injection Flow](#5-pattern---skill-injection-flow)
6. [File Locations Table](#6-file-locations-table)
7. [Event Flow Table](#7-event-flow-table)
8. [Integration Points](#8-integration-points)

---

## 1. PA Initialization Flow

The PA initializes when a project starts and establishes its monitoring role.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PA INITIALIZATION SEQUENCE                               │
└─────────────────────────────────────────────────────────────────────────────────┘

    START
      │
      ▼
┌───────────────────────────────────────┐
│ 1. LOAD PA CONFIG                     │
│                                        │
│    configPath = ~/.kenoki/config.json │
│    paConfig = JSON.parse(read(path))  │
│                                        │
│    Extract:                           │
│    ├─ pollingIntervalMs (default 30s) │
│    ├─ tokenThresholds { amber, red }  │
│    ├─ patternDetectionRules[]         │
│    └─ skillSuggestionMap{}            │
└───────────────────────────────────────┘
      │
      ▼
┌───────────────────────────────────────┐
│ 2. VALIDATE KENOKI STRUCTURE          │
│                                        │
│    Required directories:              │
│    ├─ .kenoki/sub_spines/       ✓/✗   │
│    ├─ .kenoki/corrections/      ✓/✗   │
│    ├─ .kenoki/skill_flags/      ✓/✗   │
│    ├─ .kenoki/handovers/        ✓/✗   │
│    ├─ .kenoki/stop_signals/     ✓/✗   │
│    └─ .kenoki/registry/         ✓/✗   │
│                                        │
│    If missing: createKenokiStructure() │
└───────────────────────────────────────┘
      │
      ▼
┌───────────────────────────────────────┐
│ 3. LOAD AGENT REGISTRY                │
│                                        │
│    registryPath = .kenoki/registry/   │
│                   agents.json         │
│                                        │
│    registry = {                       │
│      version: 1,                      │
│      agents: {},    // session_id map │
│      roles: {}      // role -> agent  │
│    }                                  │
│                                        │
│    Validate all ALIVE agents exist    │
└───────────────────────────────────────┘
      │
      ▼
┌───────────────────────────────────────┐
│ 4. SUBSCRIBE TO EVENTS                │
│                                        │
│    EventBus.on('status-agent',        │
│                'correction-received', │
│                handleCorrection)      │
│                                        │
│    EventBus.on('carl',                │
│                'token-threshold',     │
│                handleTokenAlert)      │
│                                        │
│    EventBus.on('bodyguard',           │
│                'hard-fail',           │
│                handleAgentFailure)    │
│                                        │
│    EventBus.on('orchestrator',        │
│                'agent-spawned',       │
│                handleAgentSpawn)      │
└───────────────────────────────────────┘
      │
      ▼
┌───────────────────────────────────────┐
│ 5. START POLLING LOOP                 │
│                                        │
│    pollingInterval = setInterval(     │
│      () => pollingCycle(),            │
│      paConfig.pollingIntervalMs       │
│    )                                  │
│                                        │
│    // First poll immediately          │
│    pollingCycle()                     │
└───────────────────────────────────────┘
      │
      ▼
   PA READY
```

### Initialization Code Structure

```typescript
// src/main/pa/index.ts

interface PAConfig {
  pollingIntervalMs: number;      // 30000 default
  tokenThresholds: {
    amber: number;                // 60
    red: number;                  // 85
  };
  patternDetectionRules: PatternRule[];
  skillSuggestionMap: Record<string, string>;
}

interface PAState {
  config: PAConfig;
  registry: AgentRegistry;
  lastPollTime: number;
  pollingInterval: NodeJS.Timeout | null;
  isProcessing: boolean;
}

async function initializePA(projectDir: string): Promise<PAState> {
  // 1. Load config
  const config = await loadPAConfig(projectDir);

  // 2. Validate structure
  await validateKenokiStructure(projectDir);

  // 3. Load registry
  const registry = await loadAgentRegistry(projectDir);

  // 4. Subscribe to events
  subscribeToEvents();

  // 5. Start polling
  const pollingInterval = startPolling(config.pollingIntervalMs);

  return { config, registry, lastPollTime: Date.now(), pollingInterval, isProcessing: false };
}
```

---

## 2. Polling Cycle (Every 30s)

The PA's heartbeat: scan all agent states, detect patterns, make decisions.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              POLLING CYCLE                                       │
│                          (Executes every 30 seconds)                             │
└─────────────────────────────────────────────────────────────────────────────────┘

                              POLL TICK
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 1: refreshAgentCache()                              │
│                                                                                  │
│    Read: .kenoki/registry/agents.json                                           │
│                                                                                  │
│    ┌──────────────────────────────────────────────────────────────────────────┐ │
│    │ agents.json                                                              │ │
│    │ ═══════════════════════════════════════════════════════════════════════ │ │
│    │ {                                                                        │ │
│    │   "019cb484...": { status: "ALIVE", role: "FRONTEND", ... },            │ │
│    │   "conv_abc...": { status: "ALIVE", role: "BACKEND", ... },             │ │
│    │   "d379cf90...": { status: "DEAD", role: "FRONTEND", ... }              │ │
│    │ }                                                                        │ │
│    └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│    Filter: aliveAgents = agents.filter(a => a.status === 'ALIVE')               │
│    Output: AgentEntry[] (only ALIVE agents)                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ For each ALIVE agent
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 2: readAllSubSpines()                               │
│                                                                                  │
│    For each agentId in aliveAgents:                                             │
│      path = .kenoki/sub_spines/sub_spine_{agentId}.md                           │
│      content = fs.readFileSync(path, 'utf-8')                                   │
│      checkpoint = parseCheckpoint(content)                                      │
│                                                                                  │
│    ┌──────────────────────────────────────────────────────────────────────────┐ │
│    │ sub_spine_019cb484....md                                                 │ │
│    │ ═══════════════════════════════════════════════════════════════════════ │ │
│    │ ## Checkpoint 5 | 71% context used                                      │ │
│    │ **Completed:** Header, Footer components                                 │ │
│    │ **In Progress:** Navigation menu (dropdown logic)                       │ │
│    │ **Blocked:** None                                                        │ │
│    │ **Files:** src/components/{Header,Footer,Nav}.tsx                        │ │
│    │ **Next:** Wire dropdown state, add hover transitions                     │ │
│    │ **Errors:** TypeError: Cannot read property 'map' of undefined (x2)     │ │
│    └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│    Parsed Structure:                                                             │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ CheckpointData {                                                       │   │
│    │   checkpointNumber: 5,                                                 │   │
│    │   contextPercent: 71,                                                  │   │
│    │   status: 'AMBER',           // derived from contextPercent            │   │
│    │   completed: ['Header', 'Footer'],                                     │   │
│    │   inProgress: 'Navigation menu (dropdown logic)',                      │   │
│    │   blocked: null,                                                       │   │
│    │   filesTouched: ['src/components/Header.tsx', ...],                    │   │
│    │   nextSteps: 'Wire dropdown state, add hover transitions',            │   │
│    │   errors: ['TypeError: Cannot read property map of undefined'],        │   │
│    │   errorCount: { 'TypeError: Cannot read...': 2 }                       │   │
│    │ }                                                                      │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Output: Map<string, CheckpointData> (agentId -> checkpoint)                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 3: detectPatterns()                                 │
│                                                                                  │
│    For each checkpoint:                                                          │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ PATTERN DETECTION RULES                                                │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ 1. REPEATED ERROR                                                      │   │
│    │    IF errorCount[error] >= 2:                                          │   │
│    │      pattern = { type: 'REPEATED_ERROR', error, count }                │   │
│    │                                                                        │   │
│    │ 2. STUCK AGENT                                                         │   │
│    │    IF inProgress unchanged for 3+ checkpoints:                         │   │
│    │      pattern = { type: 'STUCK', task: inProgress, duration }           │   │
│    │                                                                        │   │
│    │ 3. CONTEXT PRESSURE                                                    │   │
│    │    IF contextPercent >= 60 AND < 85:                                   │   │
│    │      pattern = { type: 'AMBER', percent: contextPercent }              │   │
│    │                                                                        │   │
│    │ 4. RED THRESHOLD                                                       │   │
│    │    IF contextPercent >= 85:                                            │   │
│    │      pattern = { type: 'RED', percent: contextPercent }                │   │
│    │                                                                        │   │
│    │ 5. SCOPE VIOLATION                                                     │   │
│    │    IF filesTouched contains files outside agent's mandate:             │   │
│    │      pattern = { type: 'SCOPE_VIOLATION', files }                      │   │
│    │                                                                        │   │
│    │ 6. DEPENDENCY WAITING                                                  │   │
│    │    IF blocked contains reference to another agent:                     │   │
│    │      pattern = { type: 'WAITING', blockedBy: otherAgentId }            │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Output: Map<string, Pattern[]> (agentId -> detected patterns)                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 4: actOnPattern()                                   │
│                                                                                  │
│    For each (agentId, patterns) pair:                                           │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ PATTERN -> ACTION MAPPING                                              │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ REPEATED_ERROR:                                                        │   │
│    │   └─> writeSkillFlag(agentId, suggestSkillForError(error))            │   │
│    │       File: .kenoki/skill_flags/{agentId}_{skill}.flag                │   │
│    │                                                                        │   │
│    │ STUCK:                                                                 │   │
│    │   └─> writeCorrection(agentId, 'Consider alternative approach...')    │   │
│    │       File: .kenoki/corrections/{agentId}_{timestamp}.md              │   │
│    │                                                                        │   │
│    │ AMBER:                                                                 │   │
│    │   └─> updateMainSpine(agentId, 'AMBER')                               │   │
│    │       Log: "Agent {agentId} at {percent}% - approaching limit"        │   │
│    │                                                                        │   │
│    │ RED:                                                                   │   │
│    │   └─> initiateHandover(agentId)                                       │   │
│    │       File: .kenoki/handovers/{agentId}_handover.md                   │   │
│    │       Event: emit('pa', 'handover-required', { agentId })             │   │
│    │                                                                        │   │
│    │ SCOPE_VIOLATION:                                                       │   │
│    │   └─> writeCorrection(agentId, 'SCOPE WARNING: You touched...')       │   │
│    │       Alert: Bodyguard may issue HARD_FAIL                            │   │
│    │                                                                        │   │
│    │ WAITING:                                                               │   │
│    │   └─> checkBlockerStatus(blockedBy)                                   │   │
│    │       If blocker done: writeCorrection(agentId, 'Blocker resolved')   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Files Written:                                                                │
│    ├─ .kenoki/skill_flags/*       (Storekeeper reads)                           │
│    ├─ .kenoki/corrections/*       (Hard Rails inject)                           │
│    ├─ .kenoki/handovers/*         (Orchestrator reads)                          │
│    └─ .kenoki/main_spine.md       (Aggregate status)                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                           POLL COMPLETE
                      (Wait 30s for next poll)
```

### Polling Cycle Code Structure

```typescript
// src/main/pa/polling.ts

async function pollingCycle(state: PAState): Promise<void> {
  if (state.isProcessing) {
    console.log('[PA] Skipping poll - previous cycle still running');
    return;
  }

  state.isProcessing = true;

  try {
    // Step 1: Refresh agent cache
    const aliveAgents = await refreshAgentCache(state.registry);

    // Step 2: Read all sub-spines
    const checkpoints = await readAllSubSpines(aliveAgents);

    // Step 3: Detect patterns
    const patterns = detectPatterns(checkpoints, state.config.patternDetectionRules);

    // Step 4: Act on patterns
    for (const [agentId, agentPatterns] of patterns) {
      for (const pattern of agentPatterns) {
        await actOnPattern(agentId, pattern, state);
      }
    }

    // Update main spine with aggregate status
    await updateMainSpine(checkpoints);

    state.lastPollTime = Date.now();
  } finally {
    state.isProcessing = false;
  }
}

function detectPatterns(
  checkpoints: Map<string, CheckpointData>,
  rules: PatternRule[]
): Map<string, Pattern[]> {
  const patterns = new Map<string, Pattern[]>();

  for (const [agentId, checkpoint] of checkpoints) {
    const detected: Pattern[] = [];

    // Check repeated errors
    for (const [error, count] of Object.entries(checkpoint.errorCount)) {
      if (count >= 2) {
        detected.push({ type: 'REPEATED_ERROR', error, count });
      }
    }

    // Check context thresholds
    if (checkpoint.contextPercent >= 85) {
      detected.push({ type: 'RED', percent: checkpoint.contextPercent });
    } else if (checkpoint.contextPercent >= 60) {
      detected.push({ type: 'AMBER', percent: checkpoint.contextPercent });
    }

    // ... other pattern checks

    if (detected.length > 0) {
      patterns.set(agentId, detected);
    }
  }

  return patterns;
}
```

---

## 3. User Correction Flow

When the user provides feedback, the Status Agent classifies it and routes through PA.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USER CORRECTION FLOW                                   │
│                                                                                  │
│    "Actually make the button blue, not red"                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

    User types message
           │
           │ IPC: renderer -> main
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STATUS AGENT: handleCorrection()                         │
│                                                                                  │
│    Input: userText = "Actually make the button blue, not red"                   │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ STEP 1: isUrgentStop(userText)?                                        │   │
│    │                                                                        │   │
│    │   STOP_KEYWORDS = ['stop', 'halt', 'cancel', 'abort', 'kill']          │   │
│    │   URGENT_PATTERNS = [/stop.*(everything|all)/i, /emergency/i]          │   │
│    │                                                                        │   │
│    │   "Actually make the button blue, not red"                             │   │
│    │   Contains stop keyword? NO                                            │   │
│    │   Matches urgent pattern? NO                                           │   │
│    │                                                                        │   │
│    │   Result: NOT urgent stop -> continue to classification                │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STATUS AGENT: classifyInterrupt()                        │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ CLASSIFICATION KEYWORDS                                                │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ DESIGN/STYLING:                                                        │   │
│    │   ['color', 'blue', 'red', 'button', 'style', 'font', 'layout',       │   │
│    │    'margin', 'padding', 'css', 'tailwind', 'ui', 'ux']                │   │
│    │                                                                        │   │
│    │ LOGIC/BACKEND:                                                         │   │
│    │   ['function', 'api', 'endpoint', 'database', 'query', 'logic',       │   │
│    │    'algorithm', 'calculate', 'process', 'handler']                    │   │
│    │                                                                        │   │
│    │ CONTENT:                                                               │   │
│    │   ['text', 'copy', 'wording', 'message', 'label', 'title']            │   │
│    │                                                                        │   │
│    │ DEPLOYMENT:                                                            │   │
│    │   ['deploy', 'build', 'publish', 'vercel', 'production']              │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Input: "Actually make the button blue, not red"                              │
│    Matches: 'button' (DESIGN), 'blue' (DESIGN), 'red' (DESIGN)                  │
│                                                                                  │
│    Output: InterruptClassification {                                             │
│      category: 'DESIGN',                                                        │
│      confidence: 0.95,                                                          │
│      keywords: ['button', 'blue', 'red'],                                       │
│      needsLLM: false      // high confidence, no LLM needed                     │
│    }                                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
           │
           │ Emit event to PA
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PA: routeCorrection()                                   │
│                                                                                  │
│    Receive: { category: 'DESIGN', userText: '...button blue...' }              │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ STEP 1: Query registry for category -> agent                           │   │
│    │                                                                        │   │
│    │   categoryToRole = {                                                   │   │
│    │     'DESIGN': 'FRONTEND',                                              │   │
│    │     'LOGIC': 'BACKEND',                                                │   │
│    │     'CONTENT': 'FRONTEND',                                             │   │
│    │     'DEPLOYMENT': 'DEVOPS'                                             │   │
│    │   }                                                                    │   │
│    │                                                                        │   │
│    │   role = categoryToRole['DESIGN'] = 'FRONTEND'                         │   │
│    │   agent = registry.getCurrentAgent('FRONTEND')                         │   │
│    │                                                                        │   │
│    │   Returns: {                                                           │   │
│    │     id: "019cb484-9325-73e3-be57-e8a1bc456def",                        │   │
│    │     status: "ALIVE",                                                   │   │
│    │     role: "FRONTEND",                                                  │   │
│    │     mandate: "Header, Footer, Nav components"                          │   │
│    │   }                                                                    │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ STEP 2: Write correction file                                          │   │
│    │                                                                        │   │
│    │   path = .kenoki/corrections/                                          │   │
│    │          019cb484-9325-73e3-be57-e8a1bc456def_1709736000.md            │   │
│    │                                                                        │   │
│    │   ════════════════════════════════════════════════════════════════     │   │
│    │   ## Correction from User                                              │   │
│    │                                                                        │   │
│    │   **Target Agent:** 019cb484-9325-73e3-be57-e8a1bc456def               │   │
│    │   **Role:** FRONTEND                                                   │   │
│    │   **Category:** DESIGN                                                 │   │
│    │   **Priority:** IMMEDIATE                                              │   │
│    │   **Timestamp:** 2026-03-06T14:32:00Z                                  │   │
│    │                                                                        │   │
│    │   ### User Message                                                     │   │
│    │   "Actually make the button blue, not red"                             │   │
│    │                                                                        │   │
│    │   ### Required Action                                                  │   │
│    │   Apply this correction to your current work immediately.              │   │
│    │   ════════════════════════════════════════════════════════════════     │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
           │
           │ File created - Hard Rails detect
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    HARD RAILS: CorrectionsWatcher                                │
│                                                                                  │
│    chokidar.watch('.kenoki/corrections/*.md')                                   │
│                                                                                  │
│    on('add', async (filePath) => {                                              │
│      const correction = await parseCorrection(filePath);                        │
│                                                                                  │
│      ┌──────────────────────────────────────────────────────────────────────┐   │
│      │ INJECTION PAYLOAD                                                    │   │
│      │ ════════════════════════════════════════════════════════════════     │   │
│      │                                                                      │   │
│      │ [SYSTEM: USER CORRECTION RECEIVED]                                   │   │
│      │                                                                      │   │
│      │ The user has provided a correction that MUST be applied:            │   │
│      │                                                                      │   │
│      │ > "Actually make the button blue, not red"                          │   │
│      │                                                                      │   │
│      │ You MUST:                                                            │   │
│      │ 1. Stop your current task                                           │   │
│      │ 2. Apply this change immediately                                    │   │
│      │ 3. Update your sub-spine checkpoint with the change                 │   │
│      │ 4. Continue with remaining work                                     │   │
│      │                                                                      │   │
│      │ [END USER CORRECTION]                                                │   │
│      │ ════════════════════════════════════════════════════════════════     │   │
│      └──────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│      // Queue for injection on agent's next prompt assembly                     │
│      queuePromptInjection(correction.targetAgent, {                             │
│        type: 'CORRECTION',                                                      │
│        priority: correction.priority,                                           │
│        content: injectionPayload                                                │
│      });                                                                        │
│    });                                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
           │
           │ On agent's next prompt cycle
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AGENT RECEIVES CORRECTED PROMPT                               │
│                                                                                  │
│    Original prompt: "Continue working on navigation dropdown"                   │
│                                                                                  │
│    Assembled prompt:                                                             │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ [SYSTEM: USER CORRECTION RECEIVED]                                     │   │
│    │ The user has provided a correction that MUST be applied:              │   │
│    │ > "Actually make the button blue, not red"                            │   │
│    │ You MUST apply this change immediately.                               │   │
│    │ [END USER CORRECTION]                                                  │   │
│    │                                                                        │   │
│    │ [Your current mandate]                                                 │   │
│    │ Continue working on navigation dropdown...                             │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Agent applies correction -> Updates sub_spine checkpoint                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Correction Flow Code Structure

```typescript
// src/main/pa/correction.ts

interface InterruptClassification {
  category: 'DESIGN' | 'LOGIC' | 'CONTENT' | 'DEPLOYMENT' | 'UNKNOWN';
  confidence: number;
  keywords: string[];
  needsLLM: boolean;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  DESIGN: ['color', 'blue', 'red', 'button', 'style', 'font', 'layout', 'margin', 'padding', 'css', 'tailwind', 'ui', 'ux'],
  LOGIC: ['function', 'api', 'endpoint', 'database', 'query', 'logic', 'algorithm', 'calculate', 'process', 'handler'],
  CONTENT: ['text', 'copy', 'wording', 'message', 'label', 'title'],
  DEPLOYMENT: ['deploy', 'build', 'publish', 'vercel', 'production'],
};

function classifyInterrupt(userText: string): InterruptClassification {
  const text = userText.toLowerCase();
  const matches: Record<string, string[]> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const found = keywords.filter(kw => text.includes(kw));
    if (found.length > 0) {
      matches[category] = found;
    }
  }

  // Find category with most matches
  const sorted = Object.entries(matches).sort((a, b) => b[1].length - a[1].length);

  if (sorted.length === 0) {
    return { category: 'UNKNOWN', confidence: 0, keywords: [], needsLLM: true };
  }

  const [category, keywords] = sorted[0];
  const confidence = Math.min(keywords.length / 3, 1); // Max confidence at 3+ keywords

  return {
    category: category as InterruptClassification['category'],
    confidence,
    keywords,
    needsLLM: confidence < 0.7, // Need LLM if low confidence
  };
}

async function routeCorrection(
  classification: InterruptClassification,
  userText: string,
  registry: AgentRegistry
): Promise<void> {
  const CATEGORY_TO_ROLE: Record<string, string> = {
    DESIGN: 'FRONTEND',
    LOGIC: 'BACKEND',
    CONTENT: 'FRONTEND',
    DEPLOYMENT: 'DEVOPS',
  };

  const role = CATEGORY_TO_ROLE[classification.category] || 'FRONTEND';
  const agent = registry.getCurrentAgent(role);

  if (!agent) {
    console.error(`[PA] No alive agent for role ${role}`);
    return;
  }

  await writeCorrection(agent.id, {
    category: classification.category,
    priority: 'IMMEDIATE',
    userText,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 4. RED Agent -> Handover Flow

When an agent hits the token limit, CARL signals RED and PA orchestrates the handover.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          RED AGENT -> HANDOVER FLOW                              │
│                                                                                  │
│    Agent hits 85%+ token usage -> Must be replaced with fresh context           │
└─────────────────────────────────────────────────────────────────────────────────┘

                         CARL monitors agent
                                │
                                │ Token usage crosses 85%
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CARL: detectTokenBreach()                               │
│                                                                                  │
│    Agent: 019cb484-9325-73e3-be57-d379cf90cb12                                  │
│    Tokens: 87,500 / 100,000 (87.5%)                                             │
│    Threshold: RED (>= 85%)                                                      │
│                                                                                  │
│    CARL actions:                                                                 │
│    1. Update agent status in registry -> RED                                    │
│    2. Signal agent to flush final checkpoint                                    │
│    3. Emit event to PA                                                          │
│                                                                                  │
│    EventBus.emit('carl', 'token-breach', {                                      │
│      agentId: '019cb484...',                                                    │
│      tokenUsage: { current: 87500, limit: 100000, percent: 87.5 },             │
│      status: 'RED'                                                              │
│    });                                                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AGENT: flushFinalCheckpoint()                                 │
│                                                                                  │
│    Agent receives CARL signal -> Write everything you know                      │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ sub_spine_019cb484-9325-73e3-be57-d379cf90cb12.md                      │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ ## FINAL Checkpoint 7 | 87% context | STATUS: RED                      │   │
│    │                                                                        │   │
│    │ **Completed:**                                                         │   │
│    │ - Header component with responsive breakpoints                         │   │
│    │ - Footer component with social links                                   │   │
│    │ - Navigation base structure                                            │   │
│    │ - Dropdown container logic                                             │   │
│    │                                                                        │   │
│    │ **In Progress:**                                                       │   │
│    │ - Navigation dropdown hover state (60% done)                           │   │
│    │ - Dropdown item click handlers (not started)                           │   │
│    │                                                                        │   │
│    │ **Blocked:** None                                                      │   │
│    │                                                                        │   │
│    │ **Files Touched:**                                                     │   │
│    │ - src/components/Header.tsx (COMPLETE)                                 │   │
│    │ - src/components/Footer.tsx (COMPLETE)                                 │   │
│    │ - src/components/Nav.tsx (IN PROGRESS)                                 │   │
│    │ - src/components/Nav.module.css (IN PROGRESS)                          │   │
│    │                                                                        │   │
│    │ **Technical Context:**                                                 │   │
│    │ - Using useState for dropdown open/close                               │   │
│    │ - Using onMouseEnter/onMouseLeave for hover                            │   │
│    │ - CSS modules for scoped styling                                       │   │
│    │ - Need to add aria-expanded for accessibility                          │   │
│    │                                                                        │   │
│    │ **Next Steps:**                                                        │   │
│    │ 1. Complete hover transition animations                                │   │
│    │ 2. Add click handlers for dropdown items                               │   │
│    │ 3. Wire aria-expanded attribute                                        │   │
│    │ 4. Test with keyboard navigation                                       │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ PA polls (or receives event)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PA: handleRedAgent()                                    │
│                                                                                  │
│    PA reads sub_spine -> sees STATUS: RED                                       │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ STEP 1: Parse sub-spine for handover data                              │   │
│    │                                                                        │   │
│    │   extractHandoverContext(subSpine):                                    │   │
│    │   ├─ inProgress: "Navigation dropdown hover state (60% done)"         │   │
│    │   ├─ filesTouched: ['Header.tsx', 'Footer.tsx', 'Nav.tsx', ...]       │   │
│    │   ├─ technicalContext: "Using useState... CSS modules..."             │   │
│    │   └─ nextSteps: ["Complete hover transitions", ...]                   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ STEP 2: Write handover file                                            │   │
│    │                                                                        │   │
│    │ path = .kenoki/handovers/                                              │   │
│    │        019cb484-9325-73e3-be57-d379cf90cb12_handover.md                │   │
│    │                                                                        │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │ ## Handover from Agent 019cb484-9325-73e3-be57-d379cf90cb12            │   │
│    │                                                                        │   │
│    │ **Reason:** Token limit reached (87.5%)                                │   │
│    │ **Timestamp:** 2026-03-06T10:45:32Z                                    │   │
│    │ **Role:** FRONTEND                                                     │   │
│    │                                                                        │   │
│    │ ### Context Summary                                                    │   │
│    │ Previous agent was building navigation components for the             │   │
│    │ frontend. Header and Footer are complete. Navigation menu is          │   │
│    │ partially done.                                                        │   │
│    │                                                                        │   │
│    │ ### Completed Work                                                     │   │
│    │ - Header component with responsive breakpoints                         │   │
│    │ - Footer component with social links                                   │   │
│    │ - Navigation base structure                                            │   │
│    │ - Dropdown container logic                                             │   │
│    │                                                                        │   │
│    │ ### Remaining Work                                                     │   │
│    │ 1. Complete hover transition animations for dropdown                   │   │
│    │ 2. Add click handlers for dropdown menu items                          │   │
│    │ 3. Wire aria-expanded attribute for accessibility                      │   │
│    │ 4. Test with keyboard navigation                                       │   │
│    │                                                                        │   │
│    │ ### Technical Notes                                                    │   │
│    │ - Using useState for dropdown open/close state                         │   │
│    │ - Using onMouseEnter/onMouseLeave for hover detection                  │   │
│    │ - CSS modules (Nav.module.css) for scoped styling                      │   │
│    │ - Need to add aria-expanded for screen readers                         │   │
│    │                                                                        │   │
│    │ ### Files You Now Own                                                  │   │
│    │ - src/components/Header.tsx (COMPLETE - do not modify)                 │   │
│    │ - src/components/Footer.tsx (COMPLETE - do not modify)                 │   │
│    │ - src/components/Nav.tsx (CONTINUE HERE)                               │   │
│    │ - src/components/Nav.module.css (CONTINUE HERE)                        │   │
│    │                                                                        │   │
│    │ ### DO NOT TOUCH (Other agents' domains)                               │   │
│    │ - src/api/* (Backend agent)                                            │   │
│    │ - src/lib/* (Shared utilities)                                         │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Emit handover event
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PA: emitHandoverRequired()                              │
│                                                                                  │
│    EventBus.emit('pa', 'handover-required', {                                   │
│      deadAgentId: '019cb484-9325-73e3-be57-d379cf90cb12',                       │
│      role: 'FRONTEND',                                                          │
│      handoverPath: '.kenoki/handovers/019cb484..._handover.md',                 │
│      mandate: 'Continue FRONTEND work: finish Nav dropdown'                     │
│    });                                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR: spawnReplacementAgent()                         │
│                                                                                  │
│    1. Update registry: mark dead agent as DEAD, set replacedBy                  │
│                                                                                  │
│    2. Request Storekeeper approval for new agent tools                          │
│                                                                                  │
│    3. Spawn new agent with handover context:                                    │
│       ┌──────────────────────────────────────────────────────────────────────┐  │
│       │ NEW AGENT INITIAL PROMPT                                             │  │
│       │ ════════════════════════════════════════════════════════════════     │  │
│       │                                                                      │  │
│       │ [HANDOVER CONTEXT]                                                   │  │
│       │ You are replacing agent 019cb484... who hit their token limit.      │  │
│       │                                                                      │  │
│       │ READ THIS HANDOVER FILE FIRST:                                       │  │
│       │ .kenoki/handovers/019cb484..._handover.md                            │  │
│       │                                                                      │  │
│       │ Key points:                                                          │  │
│       │ - Header and Footer are DONE - do not modify                        │  │
│       │ - Nav.tsx is IN PROGRESS - continue from hover animations            │  │
│       │ - Using useState + CSS modules                                       │  │
│       │ - Need aria-expanded for accessibility                               │  │
│       │                                                                      │  │
│       │ Your mandate: Complete the navigation dropdown component.            │  │
│       │ [END HANDOVER CONTEXT]                                               │  │
│       │                                                                      │  │
│       │ [Your skills and tools follow...]                                    │  │
│       │ ════════════════════════════════════════════════════════════════     │  │
│       └──────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│    4. Register new agent:                                                        │
│       {                                                                          │
│         id: "019cb484-9325-73e3-be57-e8a1bc456def",  // NEW session ID          │
│         runtime: "codex",                                                        │
│         role: "FRONTEND",                                                        │
│         status: "ALIVE",                                                         │
│         replacedAgent: "019cb484-9325-73e3-be57-d379cf90cb12",                  │
│         handoverFrom: ".kenoki/handovers/019cb484..._handover.md"               │
│       }                                                                          │
│                                                                                  │
│    5. New agent starts executing with fresh token budget                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                       NEW AGENT CONTINUES WORK
```

### Handover Flow Code Structure

```typescript
// src/main/pa/handover.ts

interface HandoverContext {
  deadAgentId: string;
  role: string;
  completed: string[];
  inProgress: string;
  technicalNotes: string;
  filesTouched: string[];
  nextSteps: string[];
  doNotTouch: string[];
}

async function extractHandoverContext(subSpinePath: string): Promise<HandoverContext> {
  const content = await fs.readFile(subSpinePath, 'utf-8');

  // Parse markdown sections
  return {
    deadAgentId: extractAgentId(subSpinePath),
    role: parseSection(content, 'Role'),
    completed: parseList(content, 'Completed'),
    inProgress: parseSection(content, 'In Progress'),
    technicalNotes: parseSection(content, 'Technical Context'),
    filesTouched: parseList(content, 'Files Touched'),
    nextSteps: parseList(content, 'Next Steps'),
    doNotTouch: inferDoNotTouch(role), // Other agents' domains
  };
}

async function writeHandover(context: HandoverContext): Promise<string> {
  const handoverPath = path.join(
    KENOKI_DIR,
    'handovers',
    `${context.deadAgentId}_handover.md`
  );

  const content = `## Handover from Agent ${context.deadAgentId}

**Reason:** Token limit reached
**Timestamp:** ${new Date().toISOString()}
**Role:** ${context.role}

### Context Summary
Previous agent was working on ${context.inProgress}.

### Completed Work
${context.completed.map(c => `- ${c}`).join('\n')}

### Remaining Work
${context.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Technical Notes
${context.technicalNotes}

### Files You Now Own
${context.filesTouched.map(f => `- ${f}`).join('\n')}

### DO NOT TOUCH (Other agents' domains)
${context.doNotTouch.map(f => `- ${f}`).join('\n')}
`;

  await fs.writeFile(handoverPath, content);
  return handoverPath;
}

function emitHandoverRequired(context: HandoverContext, handoverPath: string): void {
  EventBus.emit('pa', 'handover-required', {
    deadAgentId: context.deadAgentId,
    role: context.role,
    handoverPath,
    mandate: `Continue ${context.role} work: ${context.nextSteps[0]}`,
  });
}
```

---

## 5. Pattern -> Skill Injection Flow

When PA detects repeated errors, it flags for skill injection via Storekeeper.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      PATTERN -> SKILL INJECTION FLOW                             │
│                                                                                  │
│    Agent makes same error twice -> PA suggests skill -> Storekeeper injects     │
└─────────────────────────────────────────────────────────────────────────────────┘

                    PA Polling Cycle
                          │
                          │ Reading sub-spines
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PA: detectRepeatedError()                                     │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ sub_spine_019cb484....md                                               │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ ## Checkpoint 3 | 45% context used                                     │   │
│    │ **Completed:** Header layout                                           │   │
│    │ **In Progress:** Responsive breakpoints                                │   │
│    │ **Errors:**                                                            │   │
│    │ - TypeError: Cannot read property 'map' of undefined                   │   │
│    │ - TypeError: Cannot read property 'map' of undefined                   │   │
│    │                                                                        │   │
│    │ ## Checkpoint 4 | 52% context used                                     │   │
│    │ **Completed:** Header layout, base breakpoints                         │   │
│    │ **In Progress:** Mobile menu toggle                                    │   │
│    │ **Errors:**                                                            │   │
│    │ - TypeError: Cannot read property 'map' of undefined                   │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Error Analysis:                                                               │
│      "Cannot read property 'map' of undefined" x 3 occurrences                  │
│      Threshold: 2                                                                │
│      Result: REPEATED_ERROR detected                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PA: suggestSkillForError()                                    │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ ERROR -> SKILL MAPPING                                                 │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ ERROR_SKILL_MAP = {                                                    │   │
│    │   "Cannot read property .* of undefined": "defensive-coding.md",      │   │
│    │   "Cannot read property .* of null": "defensive-coding.md",           │   │
│    │   "is not a function": "typescript-patterns.md",                      │   │
│    │   "Module not found": "import-resolver.md",                           │   │
│    │   "Hydration mismatch": "nextjs-hydration.md",                        │   │
│    │   "CORS error": "api-security.md",                                    │   │
│    │   "rate limit": "rate-limit-handling.md",                             │   │
│    │   "authentication failed": "auth-patterns.md"                         │   │
│    │ }                                                                      │   │
│    │                                                                        │   │
│    │ Input: "Cannot read property 'map' of undefined"                       │   │
│    │ Match: /Cannot read property .* of undefined/                          │   │
│    │ Output: "defensive-coding.md"                                          │   │
│    │                                                                        │   │
│    │ Skill content preview:                                                 │   │
│    │ ┌──────────────────────────────────────────────────────────────────┐  │   │
│    │ │ # Defensive Coding Patterns                                      │  │   │
│    │ │                                                                  │  │   │
│    │ │ ## Always Guard Array Operations                                 │  │   │
│    │ │ BEFORE calling .map(), .filter(), .reduce():                     │  │   │
│    │ │ - Check if variable exists: if (arr)                             │  │   │
│    │ │ - Check if it's an array: Array.isArray(arr)                     │  │   │
│    │ │ - Provide fallback: (arr || []).map(...)                         │  │   │
│    │ │                                                                  │  │   │
│    │ │ ## Pattern                                                       │  │   │
│    │ │ const items = data?.items ?? [];                                 │  │   │
│    │ │ items.map(item => ...)                                           │  │   │
│    │ └──────────────────────────────────────────────────────────────────┘  │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PA: writeSkillFlag()                                          │
│                                                                                  │
│    path = .kenoki/skill_flags/                                                  │
│           019cb484-9325-73e3-be57-e8a1bc456def_defensive-coding.flag            │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ FLAG FILE CONTENT                                                      │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ agent_id: 019cb484-9325-73e3-be57-e8a1bc456def                         │   │
│    │ skill_requested: defensive-coding.md                                   │   │
│    │ reason: Repeated error (3x): Cannot read property 'map' of undefined  │   │
│    │ timestamp: 2026-03-06T14:45:00Z                                        │   │
│    │ priority: HIGH                                                         │   │
│    │ inject_on: NEXT_PROMPT                                                 │   │
│    │                                                                        │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    EventBus.emit('pa', 'skill-flag-written', {                                  │
│      agentId: '019cb484...',                                                    │
│      skill: 'defensive-coding.md',                                              │
│      flagPath: '.kenoki/skill_flags/019cb484..._defensive-coding.flag'          │
│    });                                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          │ Storekeeper watches skill_flags/
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    STOREKEEPER: SkillFlagWatcher                                 │
│                                                                                  │
│    chokidar.watch('.kenoki/skill_flags/*.flag')                                 │
│                                                                                  │
│    on('add', async (flagPath) => {                                              │
│      const flag = await parseSkillFlag(flagPath);                               │
│                                                                                  │
│      ┌──────────────────────────────────────────────────────────────────────┐   │
│      │ STOREKEEPER VALIDATION                                               │   │
│      │ ════════════════════════════════════════════════════════════════     │   │
│      │                                                                      │   │
│      │ 1. Skill exists in inventory?                                       │   │
│      │    Check: /resources/skills/defensive-coding.md                      │   │
│      │    Result: EXISTS ✓                                                  │   │
│      │                                                                      │   │
│      │ 2. Agent still alive?                                                │   │
│      │    Query: registry.getAgent('019cb484...')                           │   │
│      │    Result: status === 'ALIVE' ✓                                      │   │
│      │                                                                      │   │
│      │ 3. Token budget allows injection?                                    │   │
│      │    Skill tokens: 450                                                 │   │
│      │    Agent remaining: 48,000                                           │   │
│      │    Result: WITHIN BUDGET ✓                                           │   │
│      │                                                                      │   │
│      │ 4. Skill not already injected?                                       │   │
│      │    Check: agent.injectedSkills                                       │   │
│      │    Result: NOT INJECTED ✓                                            │   │
│      │                                                                      │   │
│      │ Verdict: APPROVED FOR INJECTION                                      │   │
│      │ ════════════════════════════════════════════════════════════════     │   │
│      └──────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│      // Queue skill for injection on agent's next prompt                        │
│      queueSkillInjection(flag.agentId, flag.skill);                             │
│                                                                                  │
│      // Mark flag as processed                                                   │
│      await fs.rename(flagPath, flagPath.replace('.flag', '.processed'));        │
│    });                                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          │ On agent's next prompt cycle
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    STOREKEEPER: injectQueuedSkills()                             │
│                                                                                  │
│    Agent 019cb484... requests next step                                         │
│    Storekeeper intercepts prompt assembly                                       │
│                                                                                  │
│    ┌────────────────────────────────────────────────────────────────────────┐   │
│    │ ASSEMBLED PROMPT WITH INJECTED SKILL                                   │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    │                                                                        │   │
│    │ [PA-INJECTED SKILL: Defensive Coding]                                  │   │
│    │                                                                        │   │
│    │ You have been making repeated errors with undefined values.            │   │
│    │ Apply these patterns to prevent the error:                             │   │
│    │                                                                        │   │
│    │ ## Always Guard Array Operations                                       │   │
│    │ BEFORE calling .map(), .filter(), .reduce():                           │   │
│    │ - Check if variable exists: if (arr)                                   │   │
│    │ - Check if it's an array: Array.isArray(arr)                           │   │
│    │ - Provide fallback: (arr || []).map(...)                               │   │
│    │                                                                        │   │
│    │ ## Pattern                                                             │   │
│    │ const items = data?.items ?? [];                                       │   │
│    │ items.map(item => ...)                                                 │   │
│    │                                                                        │   │
│    │ [END PA-INJECTED SKILL]                                                │   │
│    │                                                                        │   │
│    │ [Your mandate and current task...]                                     │   │
│    │ ════════════════════════════════════════════════════════════════════   │   │
│    └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│    Track injection:                                                              │
│      agent.injectedSkills.push('defensive-coding.md');                          │
│      registry.updateAgent('019cb484...', agent);                                │
│                                                                                  │
│    Log:                                                                          │
│      .kenoki/audit/skill-injection-{timestamp}.yaml                             │
│      { agentId, skill, reason, timestamp }                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                 AGENT APPLIES SKILL
              (Error should not repeat)
```

### Skill Injection Code Structure

```typescript
// src/main/pa/skill-suggestion.ts

const ERROR_SKILL_MAP: Record<string, string> = {
  'Cannot read property .* of undefined': 'defensive-coding.md',
  'Cannot read property .* of null': 'defensive-coding.md',
  'is not a function': 'typescript-patterns.md',
  'Module not found': 'import-resolver.md',
  'Hydration mismatch': 'nextjs-hydration.md',
  'CORS error': 'api-security.md',
  'rate limit': 'rate-limit-handling.md',
  'authentication failed': 'auth-patterns.md',
};

function suggestSkillForError(error: string): string | null {
  for (const [pattern, skill] of Object.entries(ERROR_SKILL_MAP)) {
    if (new RegExp(pattern, 'i').test(error)) {
      return skill;
    }
  }
  return null;
}

async function writeSkillFlag(
  agentId: string,
  skill: string,
  reason: string
): Promise<string> {
  const flagPath = path.join(
    KENOKI_DIR,
    'skill_flags',
    `${agentId}_${skill.replace('.md', '')}.flag`
  );

  const content = `agent_id: ${agentId}
skill_requested: ${skill}
reason: ${reason}
timestamp: ${new Date().toISOString()}
priority: HIGH
inject_on: NEXT_PROMPT
`;

  await fs.writeFile(flagPath, content);

  EventBus.emit('pa', 'skill-flag-written', {
    agentId,
    skill,
    flagPath,
  });

  return flagPath;
}
```

---

## 6. File Locations Table

Complete mapping of all files in the PA/Spine ecosystem.

| File/Directory | Writer | Reader | Purpose |
|----------------|--------|--------|---------|
| **Registry** | | | |
| `.kenoki/registry/agents.json` | Orchestrator, PA | PA, Storekeeper, Bodyguard | Agent identity, status, roles |
| `.kenoki/registry/roles.json` | Orchestrator | PA | Role -> current agent mapping |
| **Sub-Spines** | | | |
| `.kenoki/sub_spines/sub_spine_{sessionId}.md` | Agent (CLI) | PA, Bodyguard | Per-agent checkpoint state |
| `.kenoki/main_spine.md` | PA | Orchestrator, Status Agent | Aggregate project state |
| **Corrections** | | | |
| `.kenoki/corrections/{agentId}_{timestamp}.md` | PA | Hard Rails (watcher) | User corrections for agents |
| **Skill Flags** | | | |
| `.kenoki/skill_flags/{agentId}_{skill}.flag` | PA | Storekeeper (watcher) | PA requests skill injection |
| `.kenoki/skill_flags/{agentId}_{skill}.processed` | Storekeeper | (archive) | Processed skill flags |
| **Handovers** | | | |
| `.kenoki/handovers/{agentId}_handover.md` | PA | Orchestrator | Context for replacement agent |
| **Stop Signals** | | | |
| `.kenoki/stop_signals/emergency.flag` | Status Agent, PA | Hard Rails (watcher) | Emergency halt all agents |
| **Storekeeper** | | | |
| `.kenoki/requests/step-{stepId}-request.yaml` | Worker Agent | Storekeeper | Tool request from worker |
| `.kenoki/responses/step-{stepId}-response.yaml` | Storekeeper | Worker Agent | Approved tools list |
| `.kenoki/audit/step-{stepId}-checkout.yaml` | Storekeeper | (audit log) | Tool usage audit trail |
| `.kenoki/inventory/skills-catalog.json` | System init | Storekeeper | Available skills inventory |
| `.kenoki/inventory/mcp-catalog.json` | System init | Storekeeper | Available MCP connections |
| `.kenoki/inventory/plugin-catalog.json` | System init | Storekeeper | Available plugins |
| **PA State** | | | |
| `.kenoki/pa/decisions.log` | PA | (audit log) | PA decision audit trail |
| `.kenoki/pa/pattern-history.json` | PA | PA | Historical patterns for trend detection |
| **Config** | | | |
| `~/.kenoki/config.json` | User/System | PA, Orchestrator | Global Kenoki settings |
| `.kenoki/project.json` | Orchestrator | PA, Agents | Project-specific settings |

---

## 7. Event Flow Table

All events in the PA/Spine system.

| Event | Emitter | Handler | Action |
|-------|---------|---------|--------|
| **Status Agent Events** | | | |
| `status-agent:correction-received` | Status Agent | PA | Route user correction to target agent |
| `status-agent:stop-all` | Status Agent | Orchestrator | Emergency halt all agents |
| `status-agent:query-response` | User (IPC) | Status Agent | Handle user's response to query |
| **CARL Events** | | | |
| `carl:token-threshold` | CARL | PA | Agent crossed 60%/85% threshold |
| `carl:token-breach` | CARL | PA, Agent | Agent at 85%+, must flush checkpoint |
| **PA Events** | | | |
| `pa:handover-required` | PA | Orchestrator | Spawn replacement agent |
| `pa:skill-flag-written` | PA | Storekeeper | PA requests skill injection |
| `pa:correction-written` | PA | Hard Rails | Correction file ready for injection |
| `pa:pattern-detected` | PA | (logging) | Pattern detected for audit |
| `pa:main-spine-updated` | PA | Status Agent | Aggregate status changed |
| **Orchestrator Events** | | | |
| `orchestrator:agent-spawned` | Orchestrator | PA, Registry | New agent created |
| `orchestrator:agent-killed` | Orchestrator | PA, Registry | Agent terminated |
| `orchestrator:step-complete` | Orchestrator | Storekeeper | Step finished, return tools |
| **Bodyguard Events** | | | |
| `bodyguard:hard-fail` | Bodyguard | PA, Orchestrator | Agent violated hard constraint |
| `bodyguard:soft-fail` | Bodyguard | PA | Agent warning, no action required |
| `bodyguard:scope-violation` | Bodyguard | PA | Agent touched files outside mandate |
| **Storekeeper Events** | | | |
| `storekeeper:request-received` | Storekeeper | (logging) | Worker requested tools |
| `storekeeper:approval-complete` | Storekeeper | Worker | Tools approved/denied |
| `storekeeper:injection-complete` | Storekeeper | Worker | Skills injected into prompt |
| `storekeeper:tools-returned` | Storekeeper | (logging) | Step complete, tools returned |
| **Hard Rails Events** | | | |
| `hard-rails:correction-injected` | Hard Rails | (logging) | Correction injected into agent |
| `hard-rails:emergency-halt` | Hard Rails | All Agents | Stop signal received |

---

## 8. Integration Points

How PA connects to other system components.

### 8.1 Status Agent Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       STATUS AGENT <-> PA INTEGRATION                            │
└─────────────────────────────────────────────────────────────────────────────────┘

     USER                  STATUS AGENT                    PA
       │                        │                          │
       │ "Make button blue"     │                          │
       │───────────────────────>│                          │
       │                        │                          │
       │                        │ classifyInterrupt()      │
       │                        │────────┐                 │
       │                        │        │                 │
       │                        │<───────┘                 │
       │                        │ { category: 'DESIGN' }   │
       │                        │                          │
       │                        │ emit('correction-received')
       │                        │─────────────────────────>│
       │                        │                          │
       │                        │                          │ routeCorrection()
       │                        │                          │────────┐
       │                        │                          │        │
       │                        │                          │<───────┘
       │                        │                          │
       │                        │                          │ writeCorrection()
       │                        │                          │────────┐
       │                        │                          │        │
       │                        │                          │<───────┘
       │                        │                          │
       │                        │ emit('correction-written')│
       │                        │<─────────────────────────│
       │                        │                          │
       │ "Correction queued"    │                          │
       │<───────────────────────│                          │
       │                        │                          │

INTEGRATION CODE:

// src/status-agent/handlers.ts
EventBus.on('status-agent', 'user-message', async (msg) => {
  if (isCorrection(msg.text)) {
    const classification = classifyInterrupt(msg.text);
    EventBus.emit('status-agent', 'correction-received', {
      text: msg.text,
      classification,
    });
  }
});

// src/main/pa/index.ts
EventBus.on('status-agent', 'correction-received', async (event) => {
  await routeCorrection(event.classification, event.text, registry);
});
```

### 8.2 Registry Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       REGISTRY <-> PA INTEGRATION                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                              REGISTRY
                    .kenoki/registry/agents.json
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
    ORCHESTRATOR               PA                  STOREKEEPER
         │                      │                      │
         │ registerAgent()      │ refreshAgentCache()  │ validateAgent()
         │ killAgent()          │ getCurrentAgent()    │ getAgentTokens()
         │ spawnReplacement()   │ getAliveAgents()     │
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                          SINGLE SOURCE
                           OF TRUTH

REGISTRY OPERATIONS:

interface RegistryOperations {
  // READ (PA, Storekeeper, Bodyguard)
  getAgent(id: string): AgentEntry | null;
  getCurrentAgent(role: string): AgentEntry | null;
  getAliveAgents(): AgentEntry[];

  // WRITE (Orchestrator only)
  registerAgent(entry: AgentEntry): void;
  killAgent(id: string, reason: string): void;
  updateAgentStatus(id: string, status: AgentStatus): void;
  updateTokenUsage(id: string, usage: TokenUsage): void;
}

// PA NEVER writes to registry directly
// PA reads registry, writes to corrections/skill_flags/handovers
```

### 8.3 Storekeeper Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      STOREKEEPER <-> PA INTEGRATION                              │
└─────────────────────────────────────────────────────────────────────────────────┘

          PA                           STOREKEEPER
           │                                │
           │ detectRepeatedError()          │
           │────────┐                       │
           │        │                       │
           │<───────┘                       │
           │                                │
           │ writeSkillFlag()               │
           │─────────────────────────────>  │ (file watcher detects)
           │ .kenoki/skill_flags/*.flag     │
           │                                │
           │                                │ parseSkillFlag()
           │                                │────────┐
           │                                │        │
           │                                │<───────┘
           │                                │
           │                                │ validateSkillRequest()
           │                                │────────┐
           │                                │        │
           │                                │<───────┘
           │                                │
           │                                │ queueSkillInjection()
           │                                │────────┐
           │                                │        │
           │                                │<───────┘
           │                                │
           │                                │ [On next prompt assembly]
           │                                │
           │                                │ injectSkillIntoPrompt()
           │                                │─────────────────────────> AGENT
           │                                │

COMMUNICATION:
- PA -> Storekeeper: Via skill_flags/ directory (file-based)
- Storekeeper watches: .kenoki/skill_flags/*.flag
- No direct function calls or events between PA and Storekeeper
```

### 8.4 Hard Rails Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       HARD RAILS <-> PA INTEGRATION                              │
└─────────────────────────────────────────────────────────────────────────────────┘

              PA                         HARD RAILS                    AGENT
               │                              │                          │
               │ writeCorrection()            │                          │
               │─────────────────────────────>│ (watcher detects)        │
               │ .kenoki/corrections/*.md     │                          │
               │                              │                          │
               │                              │ parseCorrection()        │
               │                              │────────┐                 │
               │                              │        │                 │
               │                              │<───────┘                 │
               │                              │                          │
               │                              │ queuePromptInjection()   │
               │                              │────────┐                 │
               │                              │        │                 │
               │                              │<───────┘                 │
               │                              │                          │
               │                              │ [On agent's next cycle]  │
               │                              │                          │
               │                              │ assemblePromptWithCorrection()
               │                              │─────────────────────────>│
               │                              │                          │
               │                              │                          │ apply correction
               │                              │                          │────────┐
               │                              │                          │        │
               │                              │                          │<───────┘
               │                              │                          │

HARD RAILS FILE WATCHERS:

const WATCHERS = {
  corrections: chokidar.watch('.kenoki/corrections/*.md'),
  skillFlags: chokidar.watch('.kenoki/skill_flags/*.flag'),
  stopSignals: chokidar.watch('.kenoki/stop_signals/*.flag'),
  subSpines: chokidar.watch('.kenoki/sub_spines/*.md'),
  handovers: chokidar.watch('.kenoki/handovers/*.md'),
};

// Corrections watcher
WATCHERS.corrections.on('add', injectCorrectionIntoAgent);

// Stop signals watcher
WATCHERS.stopSignals.on('add', emergencyHaltAllAgents);

// Sub-spine watcher (for Bodyguard validation)
WATCHERS.subSpines.on('change', validateSubSpineClaims);
```

---

## Summary

The PA (Pattern Analyzer) serves as the "meta-cognitive" layer of the multi-agent system:

1. **Observes** - Reads all sub-spines every 30 seconds
2. **Detects** - Identifies patterns (errors, context pressure, stuck agents)
3. **Decides** - Writes to decision files (corrections, skill flags, handovers)
4. **Does Not Execute** - Hard Rails and Storekeeper act on PA's written decisions

The elegance is in the separation:
- **PA writes files, never calls agents directly**
- **Hard Rails watch files, inject into prompts automatically**
- **Storekeeper controls all tool access through inventory approval**
- **Registry is single source of truth for agent identity**

This file-based architecture avoids the complexity of agent-to-agent communication while maintaining clear audit trails and separation of concerns.
