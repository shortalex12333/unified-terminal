# Actor Communication Architecture

## Overview

This document defines the communication flows between the key actors in the unified-terminal system:

| Actor | Role | Reads | Writes |
|-------|------|-------|--------|
| **Bodyguard** | THE GATE - runs checks | Step context, project files | bodyguard.jsonl |
| **Spine** | State snapshots | Filesystem, git | spine.jsonl |
| **Monkey** | Slop detector (READ-ONLY on sub_spines) | sub_spines, agent outputs | monkey_detections.jsonl (ONE-WAY) |
| **PA** | Orchestration brain (central decision point) | ALL ledgers | pa_decisions.jsonl, pa_queries.jsonl |
| **Orchestrator** | Task assignment (Step Scheduler) | pa_decisions, orchestrator | orchestrator.jsonl |
| **Workers** | CLI agents | assignments | worker_checkpoints.jsonl |

---

## The Ledger System

All actor-to-actor communication happens through **append-only JSONL ledger files** in `.kenoki/ledgers/`:

```
.kenoki/
└── ledgers/
    ├── bodyguard.jsonl         # Gate verdicts
    ├── spine.jsonl             # State snapshots/diffs
    ├── monkey_detections.jsonl # Slop detections (ONE-WAY to PA)
    ├── monkey_patterns.jsonl   # Learned patterns
    ├── pa_decisions.jsonl      # PA decisions
    ├── pa_queries.jsonl        # User questions
    ├── orchestrator.jsonl      # Task assignments
    └── worker_checkpoints.jsonl # Agent progress
```

### Key Properties

1. **Append-only**: No edits, no deletes. Full audit trail.
2. **UUID v7 IDs**: Time-ordered for efficient querying
3. **correlationId**: Links entries across ledgers for tracing
4. **File watchers**: Actors watch ledgers for new entries

---

## Communication Flows

### 1. Monkey → PA (ONE-WAY)

```
┌──────────────┐                    ┌──────────────┐
│    Monkey    │                    │      PA      │
│  (observer)  │                    │   (brain)    │
└──────┬───────┘                    └──────▲───────┘
       │                                   │
       │ writeMonkeyDetection()            │ watches ledger
       │                                   │
       ▼                                   │
┌──────────────────────────────────────────┴──────┐
│           monkey_detections.jsonl                │
│ {type: "DETECTION", payload: {detectionType,    │
│  agentId, evidence, suggestedQuestion, ...}}    │
└─────────────────────────────────────────────────┘
```

**KEY CONSTRAINT**: Monkey NEVER receives direct replies. It learns by observing changes in `sub_spines/` and writing learned patterns.

### 2. PA → User (via Status Agent)

```
┌──────────────┐    surfaceQuestion()    ┌──────────────┐
│      PA      │ ────────────────────▶   │ Status Agent │
└──────────────┘                         └──────┬───────┘
       │                                        │
       │ writePAQuery()                         │ IPC to renderer
       ▼                                        ▼
┌──────────────────────┐              ┌─────────────────┐
│  pa_queries.jsonl    │              │     Frontend    │
│ {queryId, question,  │              │  (shows toast)  │
│  priority, status}   │              └────────┬────────┘
└──────────────────────┘                       │
                                               ▼
                              User answers/skips via keyboard
```

### 3. PA → Orchestrator (Decisions)

```
┌──────────────┐    writePADecision()    ┌──────────────┐
│      PA      │ ──────────────────────▶ │ Orchestrator │
└──────────────┘                         └──────────────┘
       │                                        ▲
       │                                        │ watches ledger
       ▼                                        │
┌─────────────────────────────────────────────────┐
│              pa_decisions.jsonl                  │
│ {decisionType: "CORRECTION" | "HANDOVER_INIT",  │
│  targetAgent, trigger, action, fileWritten}     │
└─────────────────────────────────────────────────┘
```

### 4. Orchestrator → Workers (Assignments)

```
┌──────────────┐   writeAssignment()   ┌──────────────┐
│ Orchestrator │ ─────────────────────▶│    Worker    │
└──────────────┘                       └──────────────┘
       │                                      │
       │                                      │ writeCheckpoint()
       ▼                                      ▼
┌──────────────────────┐          ┌──────────────────────┐
│  orchestrator.jsonl  │          │ worker_checkpoints   │
│ {type: "ASSIGNMENT", │          │   .jsonl             │
│  stepId, workerId}   │          └──────────────────────┘
└──────────────────────┘
```

### 5. Bodyguard → PA (Verdicts)

```
┌──────────────┐                    ┌──────────────┐
│  Bodyguard   │    gateCheck()     │      PA      │
│  (THE GATE)  │                    │   (brain)    │
└──────┬───────┘                    └──────▲───────┘
       │                                   │
       │ writeBodyguardVerdict()           │ watches ledger
       ▼                                   │
┌──────────────────────────────────────────┴──────┐
│              bodyguard.jsonl                     │
│ {verdict: "PASS" | "HARD_FAIL" | "SOFT_FAIL",   │
│  stepId, checksRun, reasons, failedChecks}      │
└─────────────────────────────────────────────────┘
```

### 6. Spine → PA (State Changes)

```
┌──────────────┐                    ┌──────────────┐
│    Spine     │    buildSpine()    │      PA      │
│  (snapshots) │    compareSpines() │   (brain)    │
└──────┬───────┘                    └──────▲───────┘
       │                                   │
       │ writeSpineSnapshot/Diff()         │ watches ledger
       ▼                                   │
┌──────────────────────────────────────────┴──────┐
│                spine.jsonl                       │
│ {type: "STATE_SNAPSHOT" | "STATE_DIFF",         │
│  projectDir, fileCount, filesAdded, ...}        │
└─────────────────────────────────────────────────┘
```

---

## Full Message Flow Example

**Scenario**: User types ambiguous request, Monkey detects slop, PA surfaces question, user answers.

```
┌───────────────────────────────────────────────────────────────────┐
│ 1. User types: "Build me a professional website"                  │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 2. Conductor classifies → CLI hybrid task → Step Scheduler        │
│    Orchestrator writes to orchestrator.jsonl: ASSIGNMENT          │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 3. Worker starts, writes sub_spine.md with "professional website" │
│    Worker writes to worker_checkpoints.jsonl                      │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 4. Monkey observes sub_spine (READ-ONLY)                          │
│    Detects: GENERIC_LANGUAGE "professional website"               │
│    Writes to monkey_detections.jsonl (ONE-WAY to PA):             │
│    {detectionType: "GENERIC_LANGUAGE",                            │
│     evidence: "professional website",                             │
│     suggestedQuestion: "What feeling should visitors get?",       │
│     confidence: 0.7, severity: "flag"}                            │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 5. PA watches monkey_detections.jsonl                             │
│    Reads new detection, decides to surface question               │
│    Writes to pa_queries.jsonl:                                    │
│    {queryId: "...", question: "What feeling should...",           │
│     priority: "medium", triggeredBy: "monkey", status: "pending"} │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 6. Status Agent receives event, sends to Frontend                 │
│    Frontend shows toast: "🐵 What feeling should visitors get?"   │
│    User types: "Trustworthy and minimal"                          │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 7. PA receives answer, updates pa_queries.jsonl:                  │
│    {status: "answered", answer: "Trustworthy and minimal"}        │
│    Writes correction to pa_decisions.jsonl:                       │
│    {decisionType: "CORRECTION", targetAgent: "worker-123",        │
│     trigger: {source: "monkey"}, action: "inject_clarification"}  │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 8. Hard rails inject correction into Worker's next prompt         │
│    Worker now knows: "trustworthy and minimal" not "professional" │
│    Worker updates sub_spine.md with clarified direction           │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│ 9. Monkey observes updated sub_spine (READ-ONLY)                  │
│    Sees answer was used, work improved                            │
│    Writes to monkey_patterns.jsonl:                               │
│    {originalDetectionId: "...", paActed: true, userAnswered: true,│
│     workImproved: true, lesson: "GENERIC_LANGUAGE → clarify",     │
│     confidenceAdjustment: +0.1}                                   │
│                                                                   │
│    Monkey learned: similar detections should have higher priority │
└───────────────────────────────────────────────────────────────────┘
```

---

## Actor Responsibilities Summary

### Bodyguard
- **Purpose**: THE GATE - validates work before/after execution
- **Reads**: Step context, check scripts, project files
- **Writes**: `bodyguard.jsonl` (gate verdicts)
- **Events**: `bodyguard:pass`, `bodyguard:fail`, `bodyguard:fail-heuristic`

### Spine
- **Purpose**: State snapshots for before/after comparison
- **Reads**: Filesystem (find), git (status, porcelain)
- **Writes**: `spine.jsonl` (snapshots, diffs)
- **Events**: `spine:refreshed`, `spine:compared`

### Monkey
- **Purpose**: Slop detector, ambiguity sensor (READ-ONLY observer)
- **Reads**: `sub_spines/` (markdown files), agent outputs
- **Writes**: `monkey_detections.jsonl`, `monkey_patterns.jsonl` (ONE-WAY to PA)
- **NEVER**: Receives direct replies, writes to sub_spines, communicates with Status Agent

### PA (Personal Assistant)
- **Purpose**: Central orchestration brain
- **Reads**: ALL ledgers (monkey, bodyguard, spine, worker_checkpoints)
- **Writes**: `pa_decisions.jsonl`, `pa_queries.jsonl`
- **Events**: `pa:query-sent`, `pa:query-response`, `pa:interrupt-routed`

### Orchestrator (Step Scheduler)
- **Purpose**: Head of sub-agent orchestration, DAG executor
- **Reads**: `pa_decisions.jsonl`, `orchestrator.jsonl`
- **Writes**: `orchestrator.jsonl` (assignments, completions)
- **Events**: `scheduler:plan-start`, `scheduler:step-done`, `scheduler:step-failed`

### Workers
- **Purpose**: CLI agents that do actual work
- **Reads**: Assignments from orchestrator, skill files
- **Writes**: `worker_checkpoints.jsonl`, `sub_spines/` (markdown)
- **Events**: `worker:spawn`, `worker:file-created`, `worker:complete`

---

## File Locations

```
src/
├── enforcement/
│   ├── bodyguard.ts       # THE GATE
│   ├── spine.ts           # State snapshots
│   └── constants.ts       # Thresholds, tier classification
├── monkey/
│   ├── index.ts           # CuriousMonkeyObserver
│   ├── detector.ts        # Slop detection logic
│   └── types.ts           # Detection types
├── pa/
│   ├── index.ts           # PAManager
│   ├── spine-reader.ts    # Sub-spine parsing
│   ├── decision-writer.ts # Decision file output
│   └── ledger-integration.ts # Ledger communication
├── ledger/
│   ├── types.ts           # All ledger entry types
│   ├── writer.ts          # Append-only JSONL writer
│   ├── reader.ts          # Read/watch ledger files
│   └── index.ts           # Module exports
└── main/
    ├── conductor.ts       # Message classifier
    └── step-scheduler.ts  # DAG executor (orchestrator)
```

---

## Key Constraints

1. **Monkey is ONE-WAY**: Writes detections, never receives replies
2. **PA is central**: Reads all ledgers, makes all decisions
3. **Ledgers are append-only**: Full audit trail
4. **correlationId for tracing**: Track related entries across ledgers
5. **File watchers for reactivity**: Actors respond to new entries
