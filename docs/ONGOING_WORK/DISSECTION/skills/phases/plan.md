---
skill_id: plan
skill_type: phase
version: 1.0.0
triggers: [always_active]
runtime: orchestrated
---

# PLAN PHASE

## Purpose

Create executable phase plans (PLAN.md files) with integrated research and verification. Orchestrates researcher, planner, and checker agents with a revision loop (max 3 iterations). Default flow: Research (if needed) -> Plan -> Verify -> Done.

## Inputs Required

| Input | Source | Required |
|-------|--------|----------|
| Phase number | User argument | Yes |
| ROADMAP.md | `.planning/ROADMAP.md` | Yes |
| CONTEXT.md | `.planning/phases/XX-slug/XX-CONTEXT.md` | Recommended |
| REQUIREMENTS.md | `.planning/REQUIREMENTS.md` | No |
| STATE.md | `.planning/STATE.md` | No |
| PRD file | `--prd <filepath>` argument | No (express path) |

## Process

### 1. Initialize
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
```
Parse: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `phase_found`, `phase_dir`, `has_research`, `has_context`, `has_plans`, `phase_req_ids`.

### 2. Parse Arguments
Flags: `--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--prd <filepath>`.

### 3. PRD Express Path (if --prd)
If PRD provided:
1. Read PRD file
2. Generate CONTEXT.md from requirements (all PRD items become locked decisions)
3. Skip to research step

### 4. Load CONTEXT.md
If no CONTEXT.md exists: Warn user, offer `/gsd:discuss-phase` or continue without.

### 5. Handle Research
Skip if: `--gaps`, `--skip-research`, or `research_enabled=false`.

**Spawn gsd-phase-researcher:**
```
Task(
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  prompt="Research Phase {X}: {name}. Files: CONTEXT.md, REQUIREMENTS.md, STATE.md"
)
```
Output: `{phase_dir}/{phase_num}-RESEARCH.md`

### 6. Create Validation Strategy
If research includes "Validation Architecture": Create `{phase_num}-VALIDATION.md` from template.

### 7. Check Existing Plans
If plans exist: Offer add more / view existing / replan from scratch.

### 8. Spawn gsd-planner Agent
```
Task(
  subagent_type="gsd-planner",
  model="{planner_model}",
  prompt="Plan Phase {X}. Files: CONTEXT.md, RESEARCH.md, REQUIREMENTS.md"
)
```

**Planner creates:**
- PLAN.md files with frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- `must_haves` for goal-backward verification

### 9. Handle Planner Return
- `PLANNING COMPLETE`: Proceed to checker
- `CHECKPOINT REACHED`: Present to user, get response, continue
- `PLANNING INCONCLUSIVE`: Show attempts, offer retry/context/manual

### 10. Spawn gsd-plan-checker Agent
```
Task(
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  prompt="Verify Phase {X} plans against CONTEXT.md, RESEARCH.md, phase_req_ids"
)
```

### 11. Revision Loop (Max 3 Iterations)
If checker finds issues:
1. Send structured issues back to planner
2. Planner revises (targeted updates, not full replan)
3. Re-check
4. Repeat until pass or max iterations

### 12. Present Final Status
Display: Phase number, plan count, wave count, research status, verification status.

### 13. Auto-Advance (if enabled)
If `--auto` or `workflow.auto_advance=true`:
```
Skill(skill="gsd:execute-phase", args="${PHASE} --auto --no-transition")
```

## Outputs Produced

| Output | Location | Purpose |
|--------|----------|---------|
| RESEARCH.md | `.planning/phases/XX-slug/XX-RESEARCH.md` | Technical research for planner |
| VALIDATION.md | `.planning/phases/XX-slug/XX-VALIDATION.md` | Nyquist validation strategy |
| PLAN.md files | `.planning/phases/XX-slug/XX-{plan_id}-PLAN.md` | Executable plans with tasks |

## Transition Criteria

- All plans created with valid frontmatter
- Plan checker passes (or user override)
- Dependencies correctly identified
- Waves assigned for parallel execution
- User knows next command: `/gsd:execute-phase {X}`

## Success Looks Like

- [ ] Research completed (or skipped with reason)
- [ ] PLAN.md files have `wave`, `depends_on`, `files_modified`, `autonomous` frontmatter
- [ ] Each plan has `<tasks>` in XML format
- [ ] Each plan has `must_haves` for verification
- [ ] All `phase_req_ids` appear in at least one plan's `requirements` field
- [ ] gsd-plan-checker returned `VERIFICATION PASSED` (or override)
