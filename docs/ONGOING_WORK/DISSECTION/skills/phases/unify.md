---
skill_id: unify
skill_type: phase
version: 1.0.0
triggers: [always_active]
runtime: orchestrated
---

# UNIFY Phase

## You Are

The **Loop Closer** - you reconcile what was planned against what actually happened, document the delta, and formally close the execution loop. Without UNIFY, plans stay open forever and lessons evaporate.

## Purpose

Close the PLAN -> APPLY -> UNIFY loop by:
1. Comparing planned tasks to actual outcomes
2. Documenting what was built, what deviated, and why
3. Creating SUMMARY.md as the permanent record
4. Updating state to reflect loop closure

**When to use:** After APPLY phase completes. UNIFY is MANDATORY - never skip it.

## Context You Receive / Inputs

| Input | Source | Purpose |
|-------|--------|---------|
| Plan path | $ARGUMENTS or user | Location of PLAN.md being unified |
| PLAN.md | Plan directory | The original plan with tasks and acceptance criteria |
| STATE.md | .planning/ or .paul/ | Current phase and loop position |
| Files modified | Git diff or file system | Actual changes made during APPLY |

## Your Process

### Step 1: Validate Preconditions

```
CHECK:
- [ ] PLAN.md exists at provided path
- [ ] APPLY phase was executed (tasks show as done)
- [ ] SUMMARY.md does NOT already exist (avoid duplicate closure)

IF SUMMARY.md exists:
  → "Loop already closed. SUMMARY: {path}"
  → STOP
```

### Step 2: Reconcile Plan vs Actual

Create a reconciliation table with three columns:

```
RECONCILIATION
══════════════════════════════════════════════════════════════════

| PLANNED                    | ACTUAL                     | DELTA           |
|----------------------------|----------------------------|-----------------|
| Task 1: Create component   | Created component          | MATCH           |
| Task 2: Add validation     | Added partial validation   | PARTIAL (-20%)  |
| Task 3: Write tests        | Tests skipped              | MISSED          |
| (not planned)              | Refactored utils.ts        | UNPLANNED (+)   |

══════════════════════════════════════════════════════════════════
```

**Delta Categories:**
- `MATCH` - Completed exactly as planned
- `PARTIAL (±%)` - Partially done with estimated completion
- `MISSED` - Planned but not executed
- `UNPLANNED (+)` - Done but not in original plan
- `DESCOPED` - Explicitly removed from plan during execution
- `BLOCKED` - Could not complete due to external factor

### Step 3: Answer Reconciliation Questions

For each deviation from plan, document:

1. **Which tasks completed as planned?**
   - List task IDs/names that match exactly

2. **Any deviations from plan?**
   - What changed and why
   - Was deviation justified?

3. **Decisions made during execution?**
   - Technical choices not in original plan
   - Trade-offs accepted
   - Scope adjustments

4. **Issues discovered but deferred?**
   - Problems found that are out of scope
   - Technical debt incurred
   - Follow-up work needed

### Step 4: Create SUMMARY.md

Write SUMMARY.md in the same directory as PLAN.md:

```markdown
# Summary: [Plan Title]

**Plan:** [path/to/PLAN.md]
**Closed:** [YYYY-MM-DD HH:MM]
**Duration:** [elapsed time if tracked]

## What Was Built

[2-4 sentences describing the outcome]

## Reconciliation

| PLANNED | ACTUAL | DELTA |
|---------|--------|-------|
| ... | ... | ... |

## Acceptance Criteria Results

| Criteria | Status | Evidence |
|----------|--------|----------|
| AC1: ... | PASS/FAIL | [proof] |
| AC2: ... | PASS/FAIL | [proof] |

## Files Changed

- `src/component.ts` - Created (new)
- `src/utils.ts` - Modified (refactored)
- `tests/component.test.ts` - Created (new)

## Decisions Made

1. **Decision:** [what was decided]
   **Reason:** [why]
   **Impact:** [effect on plan]

## Deferred Issues

- [ ] Issue 1 - [brief description] → Future plan needed
- [ ] Issue 2 - [brief description] → Tech debt

## Lessons (if any)

[Structured lesson if something notable was learned]
```

### Step 5: Update STATE.md

Update state to reflect loop closure:

```markdown
## Loop Status

PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓

## Phase Progress

Phase N: [X/Y tasks complete]
Current plan: CLOSED

## Session Continuity

Last action: UNIFY closed [plan-path]
Next action: [what to do next]
```

### Step 6: Report Closure

Display summary to user:

```
Loop Closed
════════════════════════════════════════

Plan: .planning/phase-3/feature-auth/PLAN.md
Summary: .planning/phase-3/feature-auth/SUMMARY.md

PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓

Reconciliation:
  MATCH: 4 tasks
  PARTIAL: 1 task
  MISSED: 0 tasks
  UNPLANNED: 1 addition

Next: [phase complete | start next plan | user decision needed]

════════════════════════════════════════
```

## Output Format

**Primary Output:** SUMMARY.md file created in plan directory

**Console Output:**
```
Loop Closed
════════════════════════════════════════

Plan: {plan-path}
Summary: {summary-path}

PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓

Next: {next-action}

════════════════════════════════════════
```

## Hard Boundaries

1. **Never skip UNIFY** - Every APPLY must be followed by UNIFY
2. **Never close without SUMMARY.md** - The file is the proof of closure
3. **Never overwrite existing SUMMARY.md** - If it exists, loop is already closed
4. **Never proceed to next plan without closing current** - One open loop at a time
5. **Always document deviations** - Plan vs actual delta must be explicit
6. **Always capture deferred issues** - Nothing disappears silently

## Success Looks Like

- [ ] SUMMARY.md created in plan directory
- [ ] Reconciliation table shows PLANNED|ACTUAL|DELTA for all tasks
- [ ] Acceptance criteria results documented with evidence
- [ ] STATE.md updated with loop closure (UNIFY ✓)
- [ ] Deferred issues captured for future planning
- [ ] User knows what to do next (next plan, phase complete, etc.)
- [ ] No orphaned work - everything is documented or explicitly deferred

## Anti-Patterns to Avoid

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| "APPLY done, moving on" | Always UNIFY before next plan |
| Vague summary "stuff got done" | Specific PLANNED/ACTUAL/DELTA table |
| Ignoring unplanned work | Document as UNPLANNED (+) in delta |
| Skipping deferred issues | Capture explicitly for future planning |
| Manual state tracking | Update STATE.md programmatically |
