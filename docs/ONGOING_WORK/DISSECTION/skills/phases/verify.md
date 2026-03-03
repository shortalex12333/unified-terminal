---
skill_id: verify
skill_type: phase
version: 1.0.0
triggers: [always_active]
runtime: orchestrated
---

# VERIFY PHASE

## Purpose

Verify phase goal achievement through goal-backward analysis. Check that the codebase delivers what the phase promised, not just that tasks completed. Task completion does not equal goal achievement.

## Inputs Required

| Input | Source | Required |
|-------|--------|----------|
| Phase number | Spawning agent | Yes |
| Phase goal | ROADMAP.md | Yes |
| PLAN.md files | `.planning/phases/XX-slug/*-PLAN.md` | Yes |
| SUMMARY.md files | `.planning/phases/XX-slug/*-SUMMARY.md` | Yes |
| REQUIREMENTS.md | `.planning/REQUIREMENTS.md` | No |

## Process

### 1. Load Context
```bash
INIT=$(node gsd-tools.cjs init phase-op "${PHASE_ARG}")
node gsd-tools.cjs roadmap get-phase "${phase_number}"
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md
```
Extract phase goal from ROADMAP.md (the outcome, not tasks).

### 2. Establish Must-Haves

**Option A: From PLAN frontmatter**
```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node gsd-tools.cjs frontmatter get "$plan" --field must_haves)
done
```
Returns: `{ truths: [...], artifacts: [...], key_links: [...] }`

**Option B: From Success Criteria in ROADMAP.md**
Parse `success_criteria` array from phase. Use each criterion as a truth.

**Option C: Derive from phase goal (fallback)**
1. State the goal
2. Derive truths (3-7 observable behaviors)
3. Derive artifacts (concrete file paths)
4. Derive key_links (critical wiring)

### 3. Verify Truths
For each observable truth:
- Identify supporting artifacts
- Check artifact status
- Check wiring
- Determine truth status

**Status values:**
- `VERIFIED`: All supporting artifacts pass
- `FAILED`: Artifact missing/stub/unwired
- `UNCERTAIN`: Needs human verification

### 4. Verify Artifacts
```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node gsd-tools.cjs verify artifacts "$plan")
done
```

**Three levels:**
| Level | Check | Status |
|-------|-------|--------|
| 1 - Exists | File exists on disk | MISSING if false |
| 2 - Substantive | More than stub (>N lines, expected patterns) | STUB if issues |
| 3 - Wired | Imported AND used elsewhere | ORPHANED if not |

**Artifact matrix:**
| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| Y | Y | Y | VERIFIED |
| Y | Y | N | ORPHANED |
| Y | N | - | STUB |
| N | - | - | MISSING |

### 5. Verify Wiring (Key Links)
```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node gsd-tools.cjs verify key-links "$plan")
done
```

**Common patterns:**
| Pattern | Check | Evidence |
|---------|-------|----------|
| Component -> API | fetch/axios call, response used | WIRED / PARTIAL / NOT_WIRED |
| API -> Database | Prisma query, result returned | WIRED / PARTIAL / NOT_WIRED |
| Form -> Handler | onSubmit with real impl (not console.log) | WIRED / STUB / NOT_WIRED |
| State -> Render | useState appears in JSX | WIRED / NOT_WIRED |

### 6. Verify Requirements
If REQUIREMENTS.md exists:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md
```
For each requirement: Parse description, identify supporting truths, assign status: SATISFIED / BLOCKED / NEEDS HUMAN.

### 7. Scan Anti-Patterns
Scan files modified in this phase:

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -E "TODO\|FIXME"` | Warning |
| Placeholder content | `grep -iE "placeholder\|coming soon"` | Blocker |
| Empty returns | `grep -E "return null\|return \{\}"` | Warning |
| Log-only functions | Only console.log | Warning |

### 8. Identify Human Verification
**Always needs human:**
- Visual appearance
- User flow completion
- Real-time behavior (WebSocket/SSE)
- External service integration
- Performance feel
- Error message clarity

Format: Test Name -> What to do -> Expected result -> Why automated check impossible.

### 9. Determine Status
| Status | Criteria |
|--------|----------|
| `passed` | All truths VERIFIED, no blockers |
| `gaps_found` | Any truth FAILED, artifact MISSING/STUB, link NOT_WIRED |
| `human_needed` | All automated pass, human items remain |

**Score:** `verified_truths / total_truths`

### 10. Generate Fix Plans (if gaps_found)
1. Cluster related gaps (e.g., "API stub + component unwired" = "Wire frontend to backend")
2. Generate plan per cluster (objective, 2-3 tasks, re-verify step)
3. Order by dependency (missing -> stubs -> wiring -> verify)

### 11. Create Report
Write to `{phase_dir}/{phase_num}-VERIFICATION.md` using template:
- Frontmatter: phase, timestamp, status, score
- Goal achievement summary
- Artifact table
- Wiring table
- Requirements coverage
- Anti-patterns found
- Human verification items
- Gaps summary
- Fix plans (if gaps_found)

### 12. Return to Orchestrator
Return: status, score (N/M), report path.
- If gaps_found: List gaps + recommended fix plan names
- If human_needed: List items requiring human testing

## Outputs Produced

| Output | Location | Purpose |
|--------|----------|---------|
| VERIFICATION.md | `.planning/phases/XX-slug/XX-VERIFICATION.md` | Goal achievement report |

## Transition Criteria

- All must-haves verified with status and evidence
- All artifacts checked at three levels
- All key links verified
- Anti-patterns scanned
- Human verification items identified
- Overall status determined
- Report created and returned to orchestrator

## Success Looks Like

- [ ] Must-haves established (from frontmatter, criteria, or derived)
- [ ] Every truth has status + evidence
- [ ] Every artifact has level 1-3 check result
- [ ] Every key link has wiring status
- [ ] VERIFICATION.md has structured report
- [ ] Status is one of: `passed`, `gaps_found`, `human_needed`
- [ ] Score calculated: `N/M must-haves verified`
- [ ] Orchestrator can route based on status
