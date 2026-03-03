---
skill_id: execute
skill_type: phase
version: 1.0.0
triggers: [always_active]
runtime: orchestrated
---

# EXECUTE PHASE

## Purpose

Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean (10-15% context) and delegates plan execution to subagents with fresh 200k context each.

## Inputs Required

| Input | Source | Required |
|-------|--------|----------|
| Phase number | User argument | Yes |
| PLAN.md files | `.planning/phases/XX-slug/*-PLAN.md` | Yes |
| STATE.md | `.planning/STATE.md` | Yes |
| config.json | `.planning/config.json` | No |
| CLAUDE.md | `./CLAUDE.md` | No (project guidelines) |

## Process

### 1. Initialize
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "${PHASE_ARG}")
```
Parse: `executor_model`, `verifier_model`, `parallelization`, `branching_strategy`, `branch_name`, `plans`, `incomplete_plans`, `plan_count`, `phase_req_ids`.

### 2. Handle Branching
Based on `branching_strategy`:
- `none`: Stay on current branch
- `phase` or `milestone`: Create/checkout branch using `branch_name`

### 3. Discover and Group Plans
```bash
PLAN_INDEX=$(node gsd-tools.cjs phase-plan-index "${PHASE_NUMBER}")
```
Parse: `plans[]` (id, wave, autonomous, objective, files_modified, task_count, has_summary), `waves` (map of wave -> plan IDs).

Skip plans with `has_summary: true` (already complete).

### 4. Execute Waves
For each wave in sequence:

**4a. Describe What's Being Built (before spawning)**
```
## Wave {N}

**{Plan ID}: {Plan Name}**
{2-3 sentences: what this builds, technical approach, why it matters}

Spawning {count} agent(s)...
```

**4b. Spawn Executor Agents**
```
Task(
  subagent_type="gsd-executor",
  model="{executor_model}",
  prompt="
    Execute plan {plan_number} of phase {phase_number}-{phase_name}.
    Files: {plan_file}, STATE.md, CLAUDE.md
    Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md.
  "
)
```

If `parallelization=true`: Spawn all wave agents in parallel.
If `parallelization=false`: Execute sequentially within wave.

**4c. Wait for Wave Completion**

**4d. Spot-Check Claims**
For each SUMMARY.md:
- Verify first 2 files from `key-files.created` exist
- Check `git log --grep="{phase}-{plan}"` returns commits
- Check for `## Self-Check: FAILED` marker

If spot-check fails: Report which plan, offer retry or continue.

**4e. Report Wave Completion**
```
## Wave {N} Complete

**{Plan ID}: {Plan Name}**
{What was built - from SUMMARY.md}
{What this enables for next wave}
```

**4f. Handle Checkpoint Plans**
Plans with `autonomous: false` require user interaction:
- `human-verify`: Present for approval
- `decision`: Present options, get selection
- `human-action`: Cannot automate, present to user

Spawn continuation agent with user response, not resume (fresh agent is more reliable).

### 5. Aggregate Results
```markdown
## Phase {X}: {Name} Execution Complete

**Waves:** {N} | **Plans:** {M}/{total} complete

| Wave | Plans | Status |
| 1 | plan-01, plan-02 | Complete |
| CP | plan-03 | Verified |
| 2 | plan-04 | Complete |
```

### 6. Close Parent Artifacts (decimal phases only)
For phases like `4.1` (gap-closure):
- Update parent UAT gaps to `status: resolved`
- Resolve referenced debug sessions
- Move debug files to `.planning/debug/resolved/`

### 7. Verify Phase Goal
```
Task(
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  prompt="Verify phase {X} goal. Phase goal: {goal}. Check must_haves against codebase."
)
```
Output: `{phase_dir}/{phase_num}-VERIFICATION.md`

Route based on status:
- `passed`: Update roadmap
- `human_needed`: Present items for human testing
- `gaps_found`: Offer `/gsd:plan-phase {X} --gaps`

### 8. Update Roadmap
```bash
COMPLETION=$(node gsd-tools.cjs phase complete "${PHASE_NUMBER}")
```
Marks phase complete, advances STATE.md to next phase.

### 9. Offer Next / Auto-Advance
If `--no-transition`: Return status to parent (was spawned by auto-advance).
If `--auto` or config enabled: Execute transition workflow inline.
Otherwise: Show manual next steps.

## Outputs Produced

| Output | Location | Purpose |
|--------|----------|---------|
| SUMMARY.md per plan | `.planning/phases/XX-slug/*-SUMMARY.md` | Execution record |
| VERIFICATION.md | `.planning/phases/XX-slug/XX-VERIFICATION.md` | Goal achievement report |
| Code changes | Various | Actual implementation |
| Git commits | Repository | Atomic task commits |

## Transition Criteria

- All plans in all waves executed
- Each task committed atomically
- SUMMARY.md created for each plan
- VERIFICATION.md shows `passed` or `human_needed`
- ROADMAP.md updated with completion
- User knows next phase or gap-closure path

## Success Looks Like

- [ ] All plans have SUMMARY.md
- [ ] All spot-checks pass (files exist, commits present, no self-check failures)
- [ ] VERIFICATION.md status is `passed` or `human_needed` (not `gaps_found`)
- [ ] ROADMAP.md phase checkbox marked `[x]` with date
- [ ] STATE.md advanced to next phase
- [ ] No orphaned branches (if branching used)
