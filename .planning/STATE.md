# Unified Terminal — Project State

## Current Phase: 12 (File-Based Progress Monitor)
## Current Plan: 4 of 6 (COMPLETE)
## Last Completed: 12-04 (ActionOverlay & Status Files)
## Status: MILESTONE v2.0 IN PROGRESS
## Mode: PHASE 12 EXECUTION IN PROGRESS

Phase progress tracked in `.planning/phases/` directories and `ROADMAP.md`.

---

## Milestone v2.0: Progress Monitor Architecture

### Paradigm Shift (2026-03-06)

**OLD (V1 — DEAD):** Chat mirror — replicate ChatGPT UI, BriefQuestionnaire, streaming tokens
**NEW (V2 — ACTIVE):** Progress monitor — user sees progress tree + output files, never LLM interface

### Key Decisions

1. **No chat UI replication** — User doesn't see LLM output
2. **Two file worlds** — Agent (hidden ~/.kenoki/) + Human (visible ~/Documents/Kenoki/)
3. **File-based transposition** — chokidar watches agent folder, copies to human folder
4. **4 simple screens** — Home → Progress → Complete + ActionOverlay
5. **5 IPC channels** — project:update, project:progress, project:file, project:action, project:complete
6. **Dead code removal** — ChatInterface.tsx, ProfilePicker.tsx, ProviderScreen.tsx

### Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 11 | **Complete** | Classification Layer (local-classifier.ts, capability-registry) |
| 12 | **In Progress** | File-Based Progress Monitor (1/6 plans complete) |

---

## Architecture Spec Location

`.planning/architecture/v2-progress-monitor/`
- `INDEX.md` — Quick links, summary, success criteria
- `OVERVIEW.md` — Paradigm shift, 4 screens, two file worlds
- `MIGRATION.md` — What stays/dies, migration steps
- `VARIABLES.md` — All {{placeholders}}, JSON schemas, data flows

---

## v1.0 Final State (Archived)

- **Total tests:** 480+ passing
- **Production readiness:** 16/16 PASS
- **Score:** 95/100

---

## What Stays (Hidden from User)

- BrowserView (headless for DALL-E, search)
- DOM injection/capture (framework internal)
- Conductor (classification, DAG generation)
- All adapters, enforcement, spine, bodyguard
- CLI processes (background)

## What Dies

- ChatInterface.tsx
- ProfilePicker.tsx
- ProviderScreen.tsx
- Chat streaming display
- Conversation history UI

## What's New (Phase 12)

- `~/.kenoki/projects/` folder structure
- `~/Documents/Kenoki/` user-visible output
- `src/main/project-scaffold.ts`
- `src/main/file-bridge.ts` (chokidar watcher)
- `src/main/transposer.ts` (technical → human translation)
- `src/renderer/screens/HomeScreen.tsx`
- `src/renderer/screens/ProgressScreen.tsx`
- `src/renderer/screens/CompleteScreen.tsx`
- `src/renderer/components/ActionOverlay.tsx`

---

## Phase 11 Stats

- 4 new files created (~580 lines)
- 29 unit tests passing
- Commit: de1b44e

---

## Phase 12 Progress

### Completed Plans

**12-01: Project Scaffolding & Transposition Layer** (2026-03-06)
- Files: project-scaffold.ts (164 lines), transposer.ts (266 lines)
- Commits: b94c835, e5ea95b
- Duration: 1 minute
- Summary: `.planning/phases/12-progress-monitor/12-01-SUMMARY.md`

**12-02: File Bridge & IPC Integration** (2026-03-06)
- Files: file-bridge.ts (362 lines), global.d.ts (+45 lines)
- Commits: 112d86b, 5005bf5
- Duration: 2 minutes
- Summary: `.planning/phases/12-progress-monitor/12-02-SUMMARY.md`

**12-03: Frontend Screens (HomeScreen, ProgressScreen, CompleteScreen)** (2026-03-06)
- Files: HomeScreen.tsx (85 lines), ProgressScreen.tsx (105 lines), CompleteScreen.tsx (95 lines)
- Commits: c3a25b2, 159efff, 0c51b90
- Duration: 2 minutes
- Summary: `.planning/phases/12-progress-monitor/12-03-SUMMARY.md`

**12-04: ActionOverlay & Status Files** (2026-03-06)
- Files: ActionOverlay.tsx (99 lines), events.ts (+154 modified)
- Commits: 6ddf210, 1c9c363
- Duration: 2 minutes
- Summary: `.planning/phases/12-progress-monitor/12-04-SUMMARY.md`

### Key Decisions

1. **Dual folder fallback strategy** — Primary `~/Documents/Kenoki/`, fallback to `~/Desktop/Kenoki/` on permission errors
2. **Translation dictionaries as constants** — Exported for reusability across modules (5 dictionaries: roles, phases, statuses, MCPs, project types)
3. **Simple spine parsing** — Regex-based parser for markdown, no external library needed
4. **chokidar stability threshold** — 100ms stabilityThreshold with 50ms pollInterval to prevent partial file reads
5. **Workspace path mapping** — Extract path after `/workspace/`, map to flat `Files/` folder for simplicity
6. **5 distinct IPC channels** — Separate channels for update/progress/file/action/complete instead of single discriminated union
7. **Status file merge strategy** — Read existing file → merge with new status → write to prevent race conditions and data loss
8. **Traffic light status metaphor** — GREEN (active), AMBER (progress > 70%), RED (done) for intuitive status representation

---

## Next Action

Run `/gsd:execute-phase 12` to continue Phase 12 plans

**Wave 1 (parallel):** ~~12-01~~ ✅ + ~~12-02~~ ✅ — Backend foundation COMPLETE
**Wave 2 (parallel):** ~~12-03~~ ✅ + ~~12-04~~ ✅ — Frontend screens + overlay COMPLETE
**Wave 3 (sequential):** 12-05 then 12-06 — Wiring + cleanup
