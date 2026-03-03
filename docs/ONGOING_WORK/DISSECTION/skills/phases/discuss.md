---
skill_id: discuss
skill_type: phase
version: 1.0.0
triggers: [always_active]
runtime: orchestrated
---

# DISCUSS PHASE

## Purpose

Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied. Captures user preferences and locked decisions so research and planning agents can act without re-asking.

## Inputs Required

| Input | Source | Required |
|-------|--------|----------|
| Phase number | User argument | Yes |
| ROADMAP.md | `.planning/ROADMAP.md` | Yes |
| PROJECT.md | `.planning/PROJECT.md` | No (enhances context) |
| REQUIREMENTS.md | `.planning/REQUIREMENTS.md` | No (enhances context) |
| STATE.md | `.planning/STATE.md` | No (session continuity) |
| Prior CONTEXT.md files | `.planning/phases/*/CONTEXT.md` | No (avoids re-asking) |

## Process

### 1. Initialize
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
```
Parse: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `has_context`, `has_plans`.

If `phase_found` is false: Exit with error.

### 2. Check Existing Context
If CONTEXT.md exists: Offer update/view/skip options.
If plans exist without context: Warn that decisions won't affect existing plans unless replanned.

### 3. Load Prior Context
Read all prior CONTEXT.md files from earlier phases. Extract locked decisions and user preferences to avoid re-asking.

### 4. Scout Codebase (Lightweight)
Check `.planning/codebase/*.md` for existing maps. If none, do targeted grep for:
- Reusable components/hooks/utilities
- Established patterns (state, styling, data fetching)
- Integration points

### 5. Analyze Phase
From ROADMAP.md phase description:
1. Establish domain boundary
2. Check prior decisions for pre-answered questions
3. Generate 3-5 phase-specific gray areas (not generic categories)
4. Annotate with code context where relevant

### 6. Present Gray Areas
Use interactive selection (multiSelect: true). Each option includes:
- Specific area name (not generic)
- 1-2 questions it covers
- Code/prior decision annotations
- Recommended choice with rationale

### 7. Discuss Selected Areas
For each area: 4 questions, then check for more. Philosophy:
- Options are concrete ("Cards" not "Option A")
- Each answer informs the next question
- "You decide" captures Claude discretion
- Scope creep redirected to deferred ideas

### 8. Write CONTEXT.md
Structure:
```markdown
<domain>Phase Boundary</domain>
<decisions>Implementation Decisions + Claude's Discretion</decisions>
<code_context>Reusable Assets, Patterns, Integration Points</code_context>
<specifics>Specific Ideas or "I want it like X" moments</specifics>
<deferred>Ideas for other phases</deferred>
```

### 9. Commit and Update State
```bash
node gsd-tools.cjs commit "docs(${padded_phase}): capture phase context"
node gsd-tools.cjs state record-session --stopped-at "Phase ${PHASE} context gathered"
```

## Outputs Produced

| Output | Location | Purpose |
|--------|----------|---------|
| CONTEXT.md | `.planning/phases/XX-slug/XX-CONTEXT.md` | User decisions for downstream agents |
| STATE.md update | `.planning/STATE.md` | Session tracking |

## Transition Criteria

- Phase validated against roadmap
- Gray areas identified and presented
- Selected areas discussed until user satisfied
- CONTEXT.md captures concrete decisions (not vague vision)
- Deferred ideas preserved
- User knows next command: `/gsd:plan-phase {X}`

## Success Looks Like

- [ ] CONTEXT.md exists with `<decisions>` section populated
- [ ] Prior decisions were not re-asked
- [ ] Scope creep was redirected to `<deferred>` section
- [ ] Each decision is actionable by downstream agents
- [ ] User explicitly approved or moved to next step
