---
phase: 12-progress-monitor
plan: 01
subsystem: file-based-progress-monitor
tags: [scaffolding, translation, foundation]
dependencies:
  requires: []
  provides: [project-scaffold, transposer, dual-folder-structure]
  affects: [file-bridge, progress-screen]
tech-stack:
  added: [fs, path, os]
  patterns: [dual-folder-architecture, technical-to-human-translation]
key-files:
  created:
    - src/main/project-scaffold.ts
    - src/main/transposer.ts
  modified: []
decisions:
  - Use ~/Documents/Kenoki/ as primary human folder with ~/Desktop/Kenoki/ fallback
  - Graceful permission error handling with console logging
  - Translation dictionaries stored as exported constants for reusability
metrics:
  duration_seconds: 113
  duration_minutes: 1
  tasks_completed: 2
  files_created: 2
  lines_added: 430
  commits: 2
  completed_at: "2026-03-06T19:50:33Z"
---

# Phase 12 Plan 01: Project Scaffolding & Transposition Layer Summary

**One-liner:** Dual-folder project structure with technical-to-human translation for file-based progress monitoring

## Overview

Created the foundational layer for Kenoki's "two file worlds" architecture. Agents write to hidden `~/.kenoki_projects/{id}/` folders with technical data, while users see friendly output in `~/Documents/Kenoki/{name}/`. The transposer provides translation dictionaries and functions to convert agent status, file names, and spine markdown into user-friendly messages.

## Tasks Completed

### Task 1: Create project-scaffold.ts (164 lines)
**Commit:** `b94c835`

Created dual-folder project structure initialization:

- **Constants:** `KENOKI_HIDDEN` and `KENOKI_VISIBLE` for agent/human folder locations
- **Main function:** `createProjectStructure(projectId, projectName)` returns `ProjectPaths` object
- **Agent world structure:**
  ```
  ~/.kenoki_projects/{id}/
  ├── agent_registry.json
  ├── spine_master.md
  ├── project_brief.md
  ├── status/
  ├── skills/
  │   ├── active_mcps.json
  │   ├── active_skills.json
  │   └── active_plugins.json
  ├── pa/
  ├── corrections/
  └── handovers/
  ```
- **Human world structure:**
  ```
  ~/Documents/Kenoki/{name}/
  └── Files/
  ```
- **Helper:** `sanitizeProjectName()` removes invalid filesystem characters
- **Error handling:** Graceful fallback to `~/Desktop/Kenoki/` on permission errors

### Task 2: Create transposer.ts (266 lines)
**Commit:** `e5ea95b`

Created technical-to-human translation layer:

- **5 Translation Dictionaries:**
  - `ROLE_TO_HUMAN` — 16 agent roles to friendly names
  - `PHASE_TO_HUMAN` — 12 project phases to user messages
  - `STATUS_TO_HUMAN` — 5 agent statuses to progress labels
  - `MCP_TO_HUMAN` — 6 MCP integrations to display names
  - `PROJECT_TYPE_TO_HUMAN` — 7 project types to descriptions

- **4 Translation Functions:**
  - `translateStatus()` — Converts agent JSON status to `ProgressUpdate` messages
  - `translateSpine()` — Parses spine markdown to `ProgressTree` with phases and percentage
  - `friendlyFileName()` — Transforms technical file names (e.g., "hero-image.png" → "Hero Image")
  - `generateReadMe()` — Creates personalized Read Me for completed projects

- **Type Definitions:**
  - `AgentStatus`, `ProgressUpdate`, `ProgressNode`, `ProgressTree` interfaces

## Verification Results

✅ **Compilation:** Both files compile without TypeScript errors
✅ **Line counts:** project-scaffold.ts (164), transposer.ts (266) — total 430 lines
✅ **Exports verified:**
  - project-scaffold.ts: `KENOKI_HIDDEN`, `KENOKI_VISIBLE`, `createProjectStructure`, `sanitizeProjectName`, `ProjectPaths`
  - transposer.ts: All 5 dictionaries, all 4 functions, all type interfaces
✅ **Dictionary coverage:** Matches VARIABLES.md specification exactly
  - ROLE_TO_HUMAN: 16 entries ✓
  - PHASE_TO_HUMAN: 12 entries ✓
  - STATUS_TO_HUMAN: 5 entries ✓
  - MCP_TO_HUMAN: 6 entries ✓
  - PROJECT_TYPE_TO_HUMAN: 7 entries ✓
✅ **No external dependencies:** Uses only built-in fs, path, os modules

## Deviations from Plan

None — plan executed exactly as written.

## Integration Points

**Downstream dependencies:**
- `file-bridge.ts` (12-02) will use `KENOKI_HIDDEN` and `KENOKI_VISIBLE` constants
- `file-bridge.ts` will call `translateStatus()`, `translateSpine()`, `friendlyFileName()`
- `ProgressScreen.tsx` (12-04) will consume `ProgressUpdate` and `ProgressTree` types
- `CompleteScreen.tsx` (12-04) will use `generateReadMe()` output

**Data flow:**
```
Agent writes → status/agent_{id}.json
              ↓
file-bridge watches → calls translateStatus()
              ↓
IPC 'project:update' → ProgressScreen displays user message
```

## Key Decisions

1. **Fallback strategy:** Primary location is `~/Documents/Kenoki/`, fallback to `~/Desktop/Kenoki/` on permission errors, with console logging for debugging
2. **Dictionary exports:** All translation dictionaries exported as constants for reusability across modules
3. **Spine parsing:** Simple regex-based parser for `## Phase N: Name [STATUS]` format — no external markdown library needed
4. **File name translation:** Handles kebab-case and snake_case conversion to Title Case

## Technical Notes

**File structure created:**
- Agent world: 6 directories + 6 initial files (JSON/MD)
- Human world: 2 directories (root + Files/)

**Translation coverage:**
- Frontend roles: 7 (header, nav, hero, footer, products, cart, checkout)
- Backend roles: 5 (api, auth, payments, inventory, orders)
- Database roles: 2 (schema, migrations)
- Deploy roles: 2 (vercel, testing)

**Spine parsing logic:**
- Matches: `## Phase 1: Setup [COMPLETE]`
- Status mapping: COMPLETE → done, IN_PROGRESS/ACTIVE → active, else → pending
- Calculates percentage: (completed / total) * 100

## Next Steps (12-02)

Create `file-bridge.ts` to watch agent folders with chokidar, call transposer functions, and emit IPC events to frontend.

## Self-Check: PASSED

✅ Files exist:
- src/main/project-scaffold.ts
- src/main/transposer.ts

✅ Commits exist:
- b94c835 (Task 1)
- e5ea95b (Task 2)

✅ TypeScript compilation: No errors
✅ Exports verified: All required exports present
✅ Dictionary counts: All match specification exactly
