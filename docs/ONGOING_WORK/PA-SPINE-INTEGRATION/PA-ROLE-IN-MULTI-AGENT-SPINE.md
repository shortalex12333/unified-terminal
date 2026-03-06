# PA Role in Multi-Agent Spine Architecture

**Status:** Theoretical Design
**Depends On:** Storekeeper Pattern (just implemented)

---

## Core Insight: File-Based Prompt Injection

> "CLI to inject prompt to another CLI is hard. But to have CLI inject update to .txt/.md file, then trigger hard rails to auto-inject prompt to assigned role is seamless."

The PA doesn't command agents directly. The PA:
1. Reads state files (sub-spines, user messages)
2. Writes decision files (corrections, skill flags)
3. Hard rails watch those files → auto-inject prompts

---

## Architecture Overview

```
USER INPUT                          ORCHESTRATOR (PA)
    │                                     │
    ▼                                     │ owns
┌─────────────┐                    ┌──────┴──────┐
│ StatusAgent │                    │ main_spine.md│
│ (Frontend   │◄────reads─────────│ (task-level   │
│  Message    │                    │  checkpoints) │
│  Collector) │                    └──────┬───────┘
└──────┬──────┘                           │
       │                                  │ reads ALL
       │ user message                     ▼
       │ /correction              ┌───────────────────────────────────────┐
       ▼                          │      SUB-SPINES (Per Agent)            │
┌──────────────┐                  │  ┌──────────────────────────────────┐ │
│     PA       │──reads──────────▶│  │ sub_spine_agent_1.md            │ │
│  (Decision   │                  │  │ ## Checkpoint 3 | 32% context   │ │
│   Router)    │                  │  │ Completed: Header, Footer, Nav  │ │
│              │                  │  │ In Progress: None               │ │
│              │                  │  │ Status: GREEN                   │ │
│              │                  │  └──────────────────────────────────┘ │
│              │                  │  ┌──────────────────────────────────┐ │
│              │──reads──────────▶│  │ sub_spine_agent_2.md            │ │
│              │                  │  │ ## Checkpoint 5 | 71% context ⚠ │ │
│              │                  │  │ Completed: Form layout          │ │
│              │                  │  │ In Progress: Validation (50%)   │ │
│              │                  │  │ Status: AMBER                   │ │
│              │                  │  └──────────────────────────────────┘ │
│              │                  │  ┌──────────────────────────────────┐ │
│              │──reads──────────▶│  │ sub_spine_agent_3.md            │ │
│              │                  │  │ ## Checkpoint 2 | 45% context   │ │
│              │                  │  │ Completed: API endpoints        │ │
│              │                  │  │ In Progress: Integration        │ │
│              │                  │  │ Status: GREEN                   │ │
│              │                  │  └──────────────────────────────────┘ │
└──────┬───────┘                  └───────────────────────────────────────┘
       │                                      ▲
       │ writes                               │ write ONLY their own
       ▼                                      │
┌──────────────┐                    ┌─────────┴─────────┐
│ DECISION     │                    │    CLI AGENTS     │
│ FILES        │                    │                   │
│ ────────────────────────────────▶│  Agent-1 (header) │
│ • corrections/agent_2.md         │  Agent-2 (forms)  │
│ • skill_flags/agent_2_tailwind   │  Agent-3 (API)    │
│ • stop_signals/emergency.flag    │                   │
└──────────────┘                    └───────────────────┘
       │
       │ watched by
       ▼
┌──────────────────────────────────────────────────────┐
│                    HARD RAILS                         │
│  (File Watchers + Auto-Injection Triggers)           │
│                                                       │
│  corrections/*.md   → injects into target agent      │
│  skill_flags/*      → Storekeeper adds skill         │
│  stop_signals/*     → Bodyguard halts execution      │
│  sub_spine_*.md     → Bodyguard verifies claims      │
└──────────────────────────────────────────────────────┘
```

---

## Actor Roles Detailed

### 1. Status Agent (Frontend Message Collector)

**Location:** `src/status-agent/`
**Role:** Collects user input from renderer, translates backend events

| Job | Input | Output |
|-----|-------|--------|
| Collect user message | IPC from renderer | `handleCorrection(text)` |
| Classify interrupt | User text + running agents | `InterruptClassification` |
| Route to PA | Classified interrupt | `emitEvent('pa', 'interrupt-routed')` |
| Translate events | Backend StatusEvents | Human-readable status lines |

**Key Code:**
```typescript
// src/status-agent/index.ts:501-544
private handleCorrection(text: string): void {
  if (isUrgentStop(text)) {
    this.handleStopAll();
    return;
  }

  const classification = classifyInterrupt(text, runningAgents);

  if (classification.needsLLM) {
    emitEvent('conductor', 'resolve-correction', { text, classification });
  } else {
    const validated = validateInterrupt(classification, runningAgents);
    const actions = dispatchInterrupt(validated, text);
    // ... dispatch to agents
  }
}
```

**Proposed Change:** Instead of emitting events, PA writes to decision files:
```typescript
// PROPOSED: Write correction to file, hard rails pick up
writeFile('.kenoki/corrections/agent_2.md', buildCorrectionPrompt(text));
// Hard rails watch → auto-inject into agent-2's next prompt
```

---

### 2. PA (Personal Assistant / Orchestrator)

**Location:** `src/main/pa/` (proposed)
**Role:** Multi-spine reader, pattern detector, decision router

| Job | Reads | Writes | Effect |
|-----|-------|--------|--------|
| Monitor agent health | All sub-spines | main_spine.md | Checkpoint summaries |
| Detect patterns | sub_spine_*.md | skill_flags/*.md | Skill injection trigger |
| Route user corrections | Status Agent message | corrections/*.md | Agent prompt injection |
| Coordinate handovers | RED agent sub-spine | handover/*.md | Replacement agent context |

**Key Decision Logic:**

```
EVERY 30 SECONDS:
  FOR EACH sub_spine_agent_N.md:
    READ checkpoint data

    IF status == RED:
      READ "In Progress" section
      WRITE handover/agent_N_handover.md
      SIGNAL orchestrator: "spawn replacement"

    IF "same error twice" detected:
      WRITE skill_flags/agent_N_{skill}.flag
      # Storekeeper sees flag → injects skill on next prompt

    UPDATE main_spine.md with aggregate status

ON USER CORRECTION (from Status Agent):
  READ running agents from main_spine.md
  CLASSIFY correction target (design? content? deployment?)
  WRITE corrections/agent_N.md
  # Hard rails inject into agent-N's prompt
```

---

### 3. Bodyguard (Gatekeeper of Spine)

**Location:** `src/enforcement/bodyguard.ts`
**Role:** Validates agent claims against spine state, enforces hard rails

| Check | Input | Verdict |
|-------|-------|---------|
| File existence | sub_spine claims "created Header.tsx" | PASS/HARD_FAIL |
| Scope violation | Agent touched files outside mandate | HARD_FAIL |
| Token budget | CARL reports 85% usage | AMBER (warn PA) |
| Test exit code | npm test returned non-zero | HARD_FAIL |

**Current Flow:**
```
Agent completes step
    │
    ▼
Bodyguard.gateCheck(step, projectDir)
    │
    ├── determineApplicableChecks(context)
    ├── createCheckFromName() for each
    ├── Promise.allSettled() - ALL IN PARALLEL
    ├── aggregateVerdict()
    │
    ▼
PASS / SOFT_FAIL / HARD_FAIL
```

**Proposed Addition:** Bodyguard also validates sub-spine claims:
```typescript
// Check that files claimed in sub_spine actually exist
for (const file of subSpine.filesTouched) {
  if (!fs.existsSync(path.join(projectDir, file))) {
    return { verdict: 'HARD_FAIL', reason: `Claimed file does not exist: ${file}` };
  }
}
```

---

### 4. CARL (Context Accounting & Resource Limiter)

**Location:** `src/enforcement/carl.ts` (proposed)
**Role:** Monitor token usage per agent, signal RED/AMBER/GREEN

| Status | Token % | Action |
|--------|---------|--------|
| GREEN | < 60% | Continue |
| AMBER | 60-85% | Write checkpoint more frequently |
| RED | > 85% | Flush final checkpoint, signal PA for handover |

**Token Counting (Already Solved):**
```typescript
// src/adapters/types.ts - AgentResult already carries this
interface AgentResult {
  tokensUsed: number;
  contextWindow: number;
  // ... percent = tokensUsed / contextWindow
}
```

**CARL reads from adapter output, writes to sub-spine:**
```markdown
## Agent-2 | Checkpoint 5 | 71% context used ⚠
```

---

### 5. MCP (Model Context Protocol)

**Location:** `src/main/mcp/`
**Role:** External service connections (OAuth tokens, API keys)

| Server | Auth Type | Purpose |
|--------|-----------|---------|
| Stripe | OAuth | Payment processing |
| GitHub | OAuth | Repo operations |
| Vercel | OAuth | Deployments |
| Supabase | API Key | Database |
| Notion | OAuth | Documentation |

**MCP in Multi-Agent Context:**

When an agent needs an MCP connection:
1. Worker writes request: `requestedMcp: ['github', 'vercel']`
2. Storekeeper validates: "github connected? vercel connected?"
3. Storekeeper approves/denies
4. Connection handles passed to agent context

**No change needed** — MCP already follows request/fulfill pattern via Storekeeper.

---

### 6. Curious-Monkey-Agent (Slop Detector)

**Location:** `src/monkey/`
**Role:** Read-only observer of sub_spines, one-way writer to PA

| Job | Reads | Writes | Effect |
|-----|-------|--------|--------|
| Detect slop | sub_spines, agent outputs | detections.jsonl | PA may generate question |
| Detect silent assumptions | sub_spines | detections.jsonl | PA may inject prod to agent |
| Learn from outcomes | sub_spines (after answers) | patterns.jsonl | Tunes future detection |

**Key Constraints:**

1. **NEVER writes to queries/** — Only PA writes there
2. **NEVER communicates with Status Agent directly** — No bidirectional channel
3. **NEVER receives direct replies** — Observes transcribed outcomes only
4. **Is a SENSOR, not a participant** — Pure observation and pattern detection

**Detection Flow:**
```
1. Curious-Monkey watches sub_spines passively
        │
        ▼
2. Detects pattern: "Agent-2 assumed button color without asking"
        │
        ├── Writes to: .kenoki/monkey/detections.jsonl
        │   { "type": "silent_assumption", "agent": "agent_2",
        │     "detail": "chose blue button without user input", "ts": 1709736000 }
        │
        ▼
3. PA reads detections.jsonl on next poll cycle
        │
        ├── PA decides: inject prod? ask user? ignore?
        │
        ▼
4. PA writes correction OR question to appropriate file
        │
        ▼
5. Monkey observes outcome in sub_spine (after agent responds)
        │
        ├── Writes to: .kenoki/monkey/patterns.jsonl
        │   { "pattern": "color_assumptions", "outcome": "user_corrected",
        │     "learning": "always_ask_color_preference" }
        │
        ▼
6. Future detection tuned based on patterns.jsonl
```

**Why "Sensor, Not Participant":**

The Monkey never acts. It only observes and records. This prevents:
- Feedback loops (Monkey → Agent → Monkey)
- Authority confusion (who's in charge?)
- Scope creep (Monkey becoming a second orchestrator)

PA is the ONLY actor that translates Monkey observations into actions.

---

## File-Based Communication Flow

### User Correction Flow

```
1. User types: "Actually make the button blue, not red"
        │
        ▼
2. Status Agent receives via IPC
        │
        ├── isUrgentStop("...button blue...")? NO
        ├── classifyInterrupt() → { target: 'DESIGN', needsLLM: false }
        │
        ▼
3. PA receives classification
        │
        ├── getRunningAgents() from main_spine.md
        ├── findAgentInCategory('DESIGN') → Agent-2
        │
        ▼
4. PA writes correction file:
   .kenoki/corrections/agent_2_1709736000.md
   ═══════════════════════════════════════════
   ## Correction from User
   Target: Agent-2 (forms/styling)
   Original instruction: button color
   User correction: "Actually make the button blue, not red"
   Priority: IMMEDIATE
   ═══════════════════════════════════════════
        │
        ▼
5. Hard Rails (file watcher) sees new correction file
        │
        ├── parseCorrectionFile()
        ├── targetAgent = "agent_2"
        │
        ▼
6. Hard Rails injects into Agent-2's next prompt assembly:
   [SYSTEM: CORRECTION RECEIVED]
   The user has provided a correction: "Actually make the button blue, not red"
   You MUST apply this change to your current work.
   [END CORRECTION]
```

### Agent RED → Handover Flow

```
1. CARL detects Agent-2 at 87% context
        │
        ▼
2. CARL signals RED, Agent-2 flushes final checkpoint:
   .kenoki/sub_spines/sub_spine_agent_2.md
   ═══════════════════════════════════════════
   ## Agent-2 | Checkpoint 7 | 87% context | RED
   Completed: Form layout, validation logic
   In Progress: Submit handler (60% done)
   Blocked: None
   Files touched: src/components/ContactForm.tsx
   Next steps: Wire submit to API, add error states
   ═══════════════════════════════════════════
        │
        ▼
3. PA reads sub_spine, sees RED status
        │
        ├── Extract "In Progress" and "Next steps"
        │
        ▼
4. PA writes handover file:
   .kenoki/handovers/agent_2_handover.md
   ═══════════════════════════════════════════
   ## Handover from Agent-2

   ### Context Summary
   Agent-2 was working on ContactForm component.
   Completed: form layout, validation logic

   ### Remaining Work
   1. Wire submit handler to API endpoint
   2. Add error states for API failures

   ### Files You Own
   - src/components/ContactForm.tsx

   ### DO NOT TOUCH
   - Header, Footer, Nav (Agent-1's domain)
   - API endpoints (Agent-3's domain)
   ═══════════════════════════════════════════
        │
        ▼
5. Orchestrator spawns Agent-4
        │
        ├── Storekeeper: skills for "form API integration"
        ├── Initial prompt includes handover file content
        │
        ▼
6. Agent-4 continues with fresh token budget
```

---

## Hard Rails as Source of Truth

| File Pattern | Watcher | Action |
|--------------|---------|--------|
| `.kenoki/corrections/*.md` | CorrectionsWatcher | Inject into target agent's next prompt |
| `.kenoki/skill_flags/*` | SkillWatcher | Storekeeper adds flagged skill to next request |
| `.kenoki/stop_signals/emergency.flag` | StopWatcher | Kill all agents immediately |
| `.kenoki/sub_spines/*.md` | SpineWatcher | Bodyguard verifies claims |
| `.kenoki/handovers/*.md` | HandoverWatcher | Load into replacement agent prompt |

**Implementation Pattern:**
```typescript
// Hard rail: CorrectionsWatcher
chokidar.watch('.kenoki/corrections/*.md').on('add', async (filePath) => {
  const correction = await parseCorrection(filePath);
  const agent = findAgent(correction.target);

  // Queue for injection on agent's next prompt assembly
  queuePromptInjection(agent.id, {
    type: 'CORRECTION',
    priority: correction.priority,
    content: correction.userText,
  });
});
```

---

## RAM & Parallelism Reality Check

| Resource | Per Agent | 5 Agents | 8GB Mac Headroom |
|----------|-----------|----------|------------------|
| Node.js overhead | ~50-80MB | ~250-400MB | ✅ Fine |
| Streaming buffer | negligible | negligible | ✅ Fine |
| Model weights | 0 (cloud) | 0 (cloud) | ✅ Cloud inference |

**Recommendation:** Bump `MAX_PARALLEL_CLI` from 3 to 5, or make it dynamic based on `os.freemem()`.

---

## Sub-Spine vs Full Journal

**NOT This (Journal):**
```
10:01:03 - Started working on header
10:01:05 - Created Header.tsx
10:01:07 - Added import for React
10:01:08 - Added import for styles
...
```

**THIS (Checkpoint):**
```markdown
## Agent-2 | Checkpoint 3 | 74% context used
**Completed:** Header, Footer, Nav components
**In Progress:** Contact form (50% done, validation remaining)
**Blocked:** None
**Files touched:** src/components/{Header,Footer,Nav}.tsx
**Next:** Finish form validation, then integration test
```

Key difference: **Paraphrased. Summarized. Readable by both humans AND machines.** Small enough that reading all sub-spines costs negligible tokens.

---

## Implementation Order

1. **Create `.kenoki/` directory structure** with sub-dirs:
   - `sub_spines/`
   - `corrections/`
   - `skill_flags/`
   - `handovers/`
   - `stop_signals/`

2. **Add PA module** (`src/main/pa/`) that:
   - Polls sub-spines every 30s
   - Detects patterns (repeated errors → skill flags)
   - Receives corrections from Status Agent
   - Writes decision files

3. **Add CARL module** (`src/enforcement/carl.ts`) that:
   - Reads token usage from adapter results
   - Updates sub-spine status (GREEN/AMBER/RED)
   - Triggers handover on RED

4. **Add Hard Rail Watchers** that:
   - Watch `.kenoki/corrections/` → inject into prompts
   - Watch `.kenoki/skill_flags/` → trigger Storekeeper
   - Watch `.kenoki/stop_signals/` → emergency halt

5. **Wire Bodyguard** to validate sub-spine claims

---

## Summary

| Component | Current State | Proposed Change |
|-----------|---------------|-----------------|
| Status Agent | Event-based interrupt dispatch | + Write to correction files |
| PA | Conceptual | New module: reads sub-spines, writes decisions |
| Bodyguard | Gate checks | + Validate sub-spine claims |
| Spine | Single file state snapshot | + Per-agent sub-spines |
| CARL | Not implemented | New module: token accounting per agent |
| MCP | Request/fulfill via Storekeeper | No change needed |
| Curious-Monkey | Not implemented | New module: read-only slop detector, writes detections for PA |
| Hard Rails | Check scripts | + File watchers for auto-injection |

**The elegance:** CLI agents write to files. Hard rails watch files. Prompt injection happens automatically. No agent-to-agent communication complexity.
