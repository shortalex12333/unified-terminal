# Unified Terminal — Milestones Archive

## v1.0: Production-Ready Enforcement Pipeline
**Status:** COMPLETE
**Completed:** 2026-03-04
**Phases:** 1-10

### Summary
Built the Universal CLI Adapter with hardcoded enforcement engine. Enables Kenoki to spawn CLI tools (Codex, Claude Code) as child processes with:
- Adapter layer translating internal format to CLI-specific commands
- Bodyguard running parallel gate checks on every step
- Spine tracking file state for drift detection
- Circuit breaker with user escalation
- 480+ tests passing across unit, integration, E2E, and compatibility categories

### Key Deliverables
- `src/enforcement/` — 6 engine modules (bodyguard, spine, enforcer, etc.)
- `src/adapters/` — Universal adapter interfaces + Codex + Claude translators
- `src/skills/` — Skill selection, validation, verify parsing
- `src/glue/` — Prompt assembly and output normalization
- 29-skill COMPATIBILITY map in permissions.ts
- Production readiness: 16/16 criteria PASS

### Statistics
- 28 new files created (~6,000 lines)
- 480+ tests passing
- 6 known gaps identified and resolved
- Score: 95/100 (code review)

---

## v2.0: Primary Input Architecture (IN PROGRESS)
**Status:** IN PROGRESS
**Started:** 2026-03-06
**Phases:** 11+

### Goal
Replace parasitic ChatGPT interceptor pattern with Kenoki-first primary input. User intent enters through OUR UI with explicit path selection, not intercepted from ChatGPT's input field.

### Core Changes
- 4 explicit entry paths: Build Something, Just Chat, Open Existing, Quick Task
- Project type classifier (cheap agent, ~200 tokens)
- Capability registry mapping project types to skills/MCPs
- Brief templates with targeted questions
- Brief validator (hard rail - no incomplete briefs)
- Conductor refactored to receive complete briefs

### Planning Document
See: `/docs/ARCHITECTURE_REFACTOR_PLAN.md`

---
