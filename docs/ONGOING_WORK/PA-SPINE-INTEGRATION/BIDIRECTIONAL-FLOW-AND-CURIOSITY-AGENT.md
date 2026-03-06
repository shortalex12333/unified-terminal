# Bidirectional Flow: PA ↔ Status Agent ↔ User

**Status:** Theoretical Design
**Problem:** When and how does the PA ask the user for clarification?

---

## The Two Directions

### Direction 1: User → Status Agent → PA (Understood)

```
User types message
    │
    ▼
Status Agent receives via IPC
    │
    ├── Classifies: is it a correction? new request? stop?
    │
    ▼
PA receives classified message
    │
    ├── Routes to appropriate agent
    └── Writes decision files
```

### Direction 2: PA → Status Agent → User (THE QUESTION)

**When does PA ask the user something?**

```
Sub-agent encounters ambiguity
    │
    ▼
Writes to sub_spine: "Blocked: Need user input on X"
    │
    ▼
PA reads sub_spine, detects BLOCKED + question
    │
    ▼
PA writes to: .kenoki/queries/agent_{id}_query.md
    │
    ▼
Hard rails watch → trigger Status Agent
    │
    ▼
Status Agent sends to renderer via IPC
    │
    ▼
User sees question in UI (NOT blocking, just rendered)
    │
    ▼
User can: Answer | Skip | Answer later
    │
    ▼
Answer flows back: User → Status Agent → PA → Agent
```

---

## The Curious-Monkey-Agent Concept

### Problem Statement

> "Some users ask retarded vague inputs. How can we tell sub-agents to ask good questions?"

AI agents have two failure modes:
1. **Too confident** — makes assumptions, produces AI slop
2. **Too needy** — asks 47 questions before doing anything

Neither is good. We need a curiosity layer that:
- Detects when work is **generic** (users will hate it)
- Detects when work is **assumptive** (could be wrong)
- Generates **non-technical questions** for non-technical users
- Does NOT block execution — refines as we go

### The Curious-Monkey-Agent

**Role:** Reads sub-spines and agent outputs. Looks for:

| Signal | Example | Question Generated |
|--------|---------|-------------------|
| Generic wording | "Professional website" | "What makes your business different from competitors?" |
| Assumed audience | Building login page | "Who will use this? Staff only? Customers? Both?" |
| Color/style unspecified | "Clean design" | "Any brand colors? Or should I suggest a palette?" |
| Missing scope | "Add contact form" | "What happens after they submit? Email to you? Save to database?" |
| Technical assumption | Using React | (No question — user is non-technical, we decide) |

### Prompt Injection Strategy

Every agent gets this injected into their context:

```markdown
## Curiosity Protocol

Before finalizing any deliverable, ask yourself:
"What information would help me make this LESS generic?"

If you identify gaps, write them to your sub_spine under `Questions`:

## Questions for User (non-technical language only)
- [ ] [Your question here — imagine explaining to your grandma]
- [ ] [Another question]

These will be shown to the user. They can skip or answer.
DO NOT BLOCK on these. Continue working with best assumptions.
Mark assumptions clearly: "ASSUMED: [what you assumed]"
```

---

## Incremental Question System (Never Blocks)

### Design Principle

> "Never stops the process, just refines as we go."

**NOT this:**
```
Agent: "I need 5 answers before I can start"
User: *closes app*
```

**THIS:**
```
Agent: *starts working immediately*
Agent: *while working* "Quick question: blue or green?" [Skip]
Agent: *continues working*
Agent: "Another one: formal or casual tone?" [Skip]
Agent: *continues working*
User: *answers one question*
Agent: *adjusts work based on answer*
```

### UI Rendering Options

#### Option A: Floating Questions (Chat-like)

```
┌─────────────────────────────────────┐
│  Building your website...           │
│  ████████░░░░░░░░░░░░░ 40%          │
├─────────────────────────────────────┤
│  💭 Quick question:                 │
│  "What's the vibe - playful or     │
│   professional?"                    │
│  ┌─────────┐ ┌─────────┐ ┌──────┐  │
│  │ Playful │ │ Profess │ │ Skip │  │
│  └─────────┘ └─────────┘ └──────┘  │
└─────────────────────────────────────┘
```

#### Option B: Checklist Panel (Incremental)

```
┌────────────────┬────────────────────┐
│ Progress Tree  │ Refinement Questions│
│                │                     │
│ ✅ Structure   │ ○ Brand colors?     │
│ 🔄 Styling     │   → Not sure        │
│ ○ Content      │                     │
│ ○ Deploy       │ ○ Formal or casual? │
│                │   → [Answer]        │
│                │                     │
│                │ ○ Contact method?   │
│                │   → Skipped         │
│                │                     │
│                │ ✅ Mobile-first?    │
│                │   → Yes             │
└────────────────┴────────────────────┘
```

#### Option C: Answers-on-Hover (Minimal Intrusion)

Questions appear as subtle indicators. User hovers to answer.
If they never hover, agent continues with assumptions.

---

## Contradiction Handling

### The Problem

User answers question AFTER agent has already done work based on assumption.

**Example:**
```
Agent ASSUMED: "Professional tone" (common for business sites)
Agent built: Formal header, corporate colors, serif fonts
...
User answers: "Actually, playful and fun!"
```

**This is a contradiction.**

### Contradiction Detection

PA monitors for:

```
1. Agent's sub_spine shows: "ASSUMED: professional tone"
2. User answers: "playful"
3. PA detects: assumption ≠ answer
4. PA calculates: how much work is affected?
```

### Contradiction Severity Levels

| Level | Impact | Action |
|-------|--------|--------|
| **TRIVIAL** | CSS change only | Auto-adjust, no flag |
| **MINOR** | One component affected | Adjust + notify user |
| **MAJOR** | Multiple components | Flag for review |
| **BREAKING** | Architecture affected | Pause, ask user: "Rework or keep?" |

### Ambiguity Flag System

When contradiction detected, PA writes:

```markdown
# .kenoki/flags/ambiguity_{timestamp}.md

## Contradiction Detected

**Agent:** agent_abc123
**Original Assumption:** "Professional tone"
**User Answer:** "Playful and fun"
**Severity:** MAJOR

### Affected Work
- src/components/Header.tsx (styling)
- src/components/Footer.tsx (styling)
- src/styles/theme.ts (color palette)

### Options
1. REWORK: Adjust affected files (estimated: 3 components)
2. KEEP: Keep current work, ignore answer
3. HYBRID: Keep structure, adjust only colors

### Recommendation
REWORK — tone affects user perception significantly.
```

**PA then:**
1. Routes flag to Status Agent
2. Status Agent renders decision to user
3. User picks option
4. PA routes decision back to affected agents

---

## Three Actors in Curiosity System

### 1. Sub-Agents (Writers)

Responsibility: Write questions to sub_spine

```markdown
## sub_spine_agent_abc123.md

## Checkpoint 3 | 45% context | GREEN
Completed: Header layout, navigation structure
In Progress: Color scheme, typography
Blocked: None

## Questions for User
- [ ] Any existing brand colors? Or should I create a palette?
- [ ] Is this for a tech-savvy audience or general public?

## Assumptions Made
- ASSUMED: Mobile-first responsive design
- ASSUMED: English language only
```

### 2. Curious-Monkey-Agent (READ-ONLY Observer)

**Key Constraints:**
- **READ-ONLY** — Observes sub_spines, never participates in agent work
- **ONE-WAY** — Writes detections to PA, never receives direct replies
- **LEARNS INDIRECTLY** — Observes outcomes in sub_spines after PA acts, updates patterns.jsonl

**Data Flow:**

```
Monkey reads sub_spines (observation)
        │
        ▼
Monkey writes detection to .kenoki/monkey/detections.jsonl (one-way)
        │
        ▼
PA reads detections, decides what to do
        │
        ├─► Ignore (low confidence)
        ├─► Inject prod to agent (via corrections/)
        └─► Generate question (PA writes to queries/, not Monkey)
```

**Detection Logic (runs every 30 seconds):**

```
EVERY 30 SECONDS:
  FOR EACH sub_spine:

    # Check for AI slop
    IF agent output contains:
      - "Professional website" (generic)
      - "User-friendly interface" (meaningless)
      - "Modern design" (says nothing)
    THEN:
      WRITE to detections.jsonl: {type: "generic_language", agent_id, confidence}
      # PA decides whether to inject correction

    # Check for missing questions
    IF agent has made assumptions BUT has no questions:
      WRITE to detections.jsonl: {type: "silent_assumptions", agent_id, confidence}
      # PA decides whether to generate questions

    # Check for stale questions
    IF question has been pending > 10 minutes:
      WRITE to detections.jsonl: {type: "stale_question", question_id, confidence}
      # PA decides whether to escalate to user

    # LEARNING: Check outcomes from previous detections
    IF previous detection led to PA action:
      OBSERVE: Did sub_spine improve? Did agent course-correct?
      UPDATE: patterns.jsonl with outcome (positive/negative reinforcement)
```

**Monkey NEVER:**
- Writes directly to corrections/ (PA does this)
- Writes directly to queries/ (PA does this)
- Receives replies from PA or agents
- Blocks or gates agent work

### 3. PA (Orchestrator)

Responsibility: Route questions, detect contradictions, coordinate

```
ON new question in sub_spine:
  WRITE to .kenoki/queries/
  EMIT to Status Agent

ON user answer:
  READ relevant sub_spines
  DETECT contradictions with existing assumptions
  IF contradiction:
    CALCULATE severity
    WRITE ambiguity flag
    ROUTE to Status Agent for user decision
  ELSE:
    WRITE correction to .kenoki/corrections/
    Agent picks up correction automatically
```

---

## Question Injection Template

Add to agent CLAUDE.md or mandate:

```markdown
## Curiosity Protocol

### Before You Work
Ask yourself: "What would help me make this LESS generic?"

Write questions to your sub_spine under `## Questions for User`.
Use non-technical language. Imagine explaining to someone who:
- Doesn't know what CSS is
- Doesn't care about your technical decisions
- Just wants their thing to work and look good

### While You Work
Mark every assumption:
```
ASSUMED: [what you assumed and why it seemed reasonable]
```

### Example Questions (Good)
- "What feeling should visitors get? Calm? Excited? Trustworthy?"
- "Any websites you love the look of? (I'll check them out)"
- "Who's the main person using this? Age range?"

### Example Questions (Bad - Too Technical)
- "Should I use CSS Grid or Flexbox?" (They don't know/care)
- "REST or GraphQL for the API?" (Meaningless to them)
- "Which database schema?" (You decide)

### Never Block
Keep working. Questions are refinements, not blockers.
If they skip, use your best judgment. You're the expert.
```

---

## Summary

| Component | Role |
|-----------|------|
| **Sub-Agents** | Write questions + mark assumptions in sub_spine |
| **Curious-Monkey** | READ-ONLY observer. Writes detections to PA (one-way). Learns by observing sub_spine outcomes. |
| **PA** | Reads detections, routes questions, injects corrections, detects contradictions, coordinates flags |
| **Status Agent** | Render questions to user, collect answers |
| **Hard Rails** | Watch query files, inject answers back to agents |

**Key Principles:**
1. Never block execution
2. Questions are refinements, not gates
3. Assumptions are explicit and traceable
4. Contradictions are detected and surfaced
5. User always has "Skip" option

---

## Open Questions

1. **Monkey persistence:** ✅ RESOLVED — Runs on interval (30 seconds), not continuously. Lightweight polling avoids resource drain.
2. **Monkey transmission:** ✅ RESOLVED — One-way to PA via detections.jsonl. Never hears direct replies.
3. **Monkey learning:** ✅ RESOLVED — Observes outcomes in sub_spines after PA acts, updates patterns.jsonl with reinforcement signals.
4. **Question priority:** How do we prevent question fatigue?
5. **Answer timing:** What if user answers after agent is done?
6. **Multi-agent contradictions:** What if two agents have contradictory assumptions?
