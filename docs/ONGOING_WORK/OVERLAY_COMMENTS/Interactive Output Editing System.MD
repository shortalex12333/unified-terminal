# Kenoki — Interactive Output Editing System

**Element Overlay Commenting Architecture (v1 MVP)**

**Status:** Implementation Specification
**Audience:** Product, Engineering, UX
**Purpose:** Define how Kenoki renders generated outputs and enables users to modify them through a structured overlay commenting system that routes feedback through the Status Agent and PA (Messenger).

---

# 1. Executive Overview

Kenoki produces artifacts such as websites, pages, images, and documents through an orchestration pipeline of agents. Once an artifact is generated, users must be able to **inspect, question, and modify specific elements of that output without interacting with code or technical systems.**

The solution is an **interactive overlay editing layer** that transposes artifact elements into selectable regions. Users hover over these regions and submit a single comment or instruction at a time. That comment is routed through the orchestration system to the appropriate agent.

This design enables **precise, surgical iteration** without requiring users to rebuild projects or understand the underlying architecture.

Key characteristics:

* All artifacts render visually
* Each element is selectable
* Users submit **one instruction at a time**
* Instructions route through the **Status Agent → PA → target agent**
* Only affected steps update

The overlay system becomes the **primary editing interface for non-technical users.**

---

# 2. Design Principles

## 2.1 No Technical Exposure

Users never see:

* code
* files
* CLI output
* agent architecture
* runtime logs
* models or tokens

Users interact only with **visual elements and natural language instructions.**

---

## 2.2 Direct Manipulation

Users modify artifacts by interacting directly with the rendered output.

Example:

User hovers over a headline and writes:

> “Make this headline shorter.”

Kenoki identifies the element and routes the instruction accordingly.

---

## 2.3 Single Instruction Flow

To reduce ambiguity and maintain deterministic behavior:

* users may submit **only one instruction at a time**
* instructions must reference **one element**

This constraint simplifies orchestration and prevents cascading failures.

---

## 2.4 Surgical Updates

Updates should modify only the necessary portion of the artifact.

Example:

If the user edits a headline:

* text generation agent updates headline
* styling, layout, and images remain untouched

---

# 3. System Architecture

The overlay editing system sits between the rendered artifact and the orchestration pipeline.

```
Artifact Render
      │
      ▼
Element Mapping Layer
      │
      ▼
Overlay Interaction System
      │
      ▼
User Comment Input
      │
      ▼
Status Agent
      │
      ▼
PA (Messenger)
      │
      ▼
Target Agent
      │
      ▼
Updated Artifact Element
```

---

# 4. Rendering Artifacts for Interaction

Artifacts must be rendered inside a **controlled preview container**.

Example container:

```
Preview Frame
└─ Overlay Layer
   └─ Element Highlight Regions
```

This allows Kenoki to track elements and inject interaction logic without modifying the artifact itself.

---

# 5. Element Mapping Layer

Before rendering, Kenoki generates an **element map**.

Each interactive element receives a unique identifier.

Example:

```
element_id: hero_title
element_type: text
path: /hero/title
agent_owner: content_writer
```

Additional metadata:

| Field        | Description                        |
| ------------ | ---------------------------------- |
| element_id   | Unique identifier                  |
| element_type | text, image, section, button       |
| agent_owner  | Responsible agent                  |
| project_id   | Associated project                 |
| element_path | Location within artifact structure |

This map allows the overlay to translate user interactions into structured commands.

---

# 6. Overlay Interaction System

The overlay layer sits above the artifact and mirrors its layout.

When the user hovers over an element:

* a highlight border appears
* the cursor changes to indicate editability
* a comment icon appears

Example visual behavior:

```
[ HERO TITLE ]
"Handmade Candle Store"

Hover → blue outline

Click → comment input opens
```

---

# 7. Comment Input Interface

The user interface allows a single comment submission.

Example interaction:

```
Selected Element:
Hero Title

User Instruction:
"Make this headline shorter and more playful"

[ Submit ]
```

Constraints:

* one comment per submission
* references one element
* optional question allowed

---

# 8. Comment Classification

Once submitted, the system categorizes the instruction.

Example categories:

| Category | Example            |
| -------- | ------------------ |
| edit     | change text        |
| delete   | remove section     |
| replace  | swap image         |
| update   | modify style       |
| question | user clarification |

Example classification:

```
User input:
"Change this image"

Category:
replace
```

---

# 9. Instruction Payload Structure

When the user submits a comment, Kenoki generates a structured payload.

Example payload:

```
{
  project_id: "uuid",
  element_id: "hero_title",
  element_type: "text",
  user_instruction: "Make this headline shorter",
  instruction_type: "edit",
  timestamp: "2026-03-05T20:30:00Z"
}
```

This payload is forwarded to the Status Agent.

---

# 10. Status Agent Responsibilities

The Status Agent performs the following tasks:

1. receives the instruction payload
2. translates instruction into human-readable status updates
3. identifies the relevant step or agent
4. forwards the instruction to the PA

Example status message:

```
Updating your headline...
```

Users see progress but never see internal routing.

---

# 11. PA (Messenger) Routing

The PA determines:

* which agent owns the element
* whether that agent is currently running
* whether a correction must be injected or queued

Example routing:

```
Element: hero_title
Agent Owner: content_writer

PA sends instruction to content_writer agent.
```

If the agent is inactive, it is restarted with the correction included.

---

# 12. Agent Update Execution

The receiving agent updates only the targeted element.

Example change flow:

```
Old:
Handmade Candle Store

User Instruction:
"Make this headline shorter"

New:
Handmade Candles
```

Once completed:

* updated artifact is re-rendered
* overlay remains active

---

# 13. Visual Feedback Loop

Users must immediately see that their request was processed.

Feedback states:

| State      | UI Behavior       |
| ---------- | ----------------- |
| submitted  | comment sent      |
| processing | spinner animation |
| updated    | element refreshed |
| failed     | retry prompt      |

Example status line:

```
Updating this section...
Done.
```

---

# 14. Supported User Actions (MVP)

For launch, the overlay must support:

| Action   | Example           |
| -------- | ----------------- |
| Edit     | change headline   |
| Replace  | swap image        |
| Remove   | delete section    |
| Update   | adjust layout     |
| Question | ask clarification |

Multiple comments are not supported simultaneously.

Users must submit sequentially.

---

# 15. Error Handling

If an instruction cannot be completed:

1. Status Agent reports issue
2. agent retries with adjusted prompt
3. user receives updated message

Example:

```
That change didn’t work. Trying another approach...
```

Users should never see technical errors.

---

# 16. Security Considerations

Overlay editing must ensure:

* no direct file system editing
* all changes pass through agent orchestration
* artifact modifications remain reversible

Recommended safeguards:

* version snapshots
* undo capability (future release)

---

# 17. Performance Requirements

Interaction latency targets:

| Operation          | Target     |
| ------------------ | ---------- |
| overlay hover      | <50ms      |
| comment submission | <100ms     |
| element update     | <3 seconds |

---

# 18. Future Enhancements

After MVP, the overlay system can expand to support:

### Multi-comment threads

Users attach multiple instructions to the same element.

### Element history

View previous edits and revert changes.

### Drag-to-edit interactions

Move elements visually.

### Live collaboration

Multiple users interacting with artifacts.

---

# 19. Strategic Value

The overlay editing system enables Kenoki to function as:

**AI-powered artifact editor rather than static generator.**

Benefits:

* eliminates rebuild cycles
* improves iteration speed
* creates intuitive UX for non-technical users
* captures structured workflow data

This architecture aligns with Kenoki’s core philosophy:

> Users interact with outcomes, not infrastructure.

---

# 20. Summary

The Kenoki overlay editing system transforms generated artifacts into interactive canvases.

Users modify elements by:

1. hovering over a component
2. submitting a natural-language instruction
3. routing the instruction through the Status Agent and PA
4. updating the artifact element in place

This system enables continuous improvement of generated outputs while preserving the simplicity required for non-technical users.

---

**End of Document**
