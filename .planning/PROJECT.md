# Unified Terminal (Kenoki)

## Project Overview
Electron desktop app wrapping CLI AI tools for non-technical users. Users interact with a native interface; the app routes tasks to local CLI tools (Codex, Claude Code, GSD) as needed.

## Vision
Replace the parasitic ChatGPT wrapper pattern with a Kenoki-first experience where user intent is captured through our UI, classified intelligently, and orchestrated with the right tools.

## Current Milestone
**v2.0: Primary Input Architecture**

### Core Problem Being Solved
The current Conductor has an identity crisis:
- Parasitic on ChatGPT (intercepting DOM messages)
- Classification happens too late (after user already typed)
- No project type awareness (site vs app vs ecom)
- No capability registry (what skills/MCPs does each type need?)
- Brief collection is scattered and incomplete

### Target State
1. User explicitly chooses path: Build | Chat | Existing | Quick
2. For builds: Classifier detects project type (site/app/ecom)
3. Capability registry maps type → skills, MCPs, template
4. Brief agent asks targeted questions based on template
5. Brief validator enforces completeness (hard rail)
6. Conductor receives COMPLETE brief, produces DAG
7. Existing execution layer runs unchanged

## Tech Stack
- Electron (main process orchestration)
- React + Vite + Tailwind (renderer)
- TypeScript throughout
- Codex CLI (classification + execution)
- Claude Code (execution)
- MCP servers (Stripe, GitHub, Vercel, Supabase, Notion)

## Key Documentation
- `/docs/ARCHITECTURE_REFACTOR_PLAN.md` — Complete v2.0 implementation plan
- `/CLAUDE.md` — Project status and file inventory
- `/.planning/ROADMAP.md` — Phase-by-phase breakdown
- `/.planning/STATE.md` — Current execution state

## Milestones History
- v1.0: Production-Ready Enforcement Pipeline (COMPLETE)
- v2.0: Primary Input Architecture (IN PROGRESS)
