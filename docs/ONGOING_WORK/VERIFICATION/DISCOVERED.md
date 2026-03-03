# Discoveries During Verification

**Verifier:** Instance V
**Date:** 2026-03-03

---

## Valuable Findings

### 1. GSD Has More Agents Than Extracted

**Source:** `/tmp/verification/gsd/agents/`

Instance 3 extracted 6 workers from GSD. The repo actually has 12 agents:

| Agent | Extracted? | Value |
|-------|------------|-------|
| gsd-executor | YES | Core |
| gsd-planner | YES | Core |
| gsd-debugger | YES | Core |
| gsd-verifier | YES | Core |
| gsd-codebase-mapper | YES | Core |
| gsd-phase-researcher | YES | Core |
| gsd-project-researcher | NO | Domain research for new projects |
| gsd-plan-checker | NO | Validates plans before execution |
| gsd-integration-checker | NO | E2E flow verification |
| gsd-roadmapper | NO | Requirement mapping to phases |
| gsd-research-synthesizer | NO | Combines parallel research |
| gsd-nyquist-auditor | NO | Automatic test generation |

**Recommendation:** Consider extracting `gsd-plan-checker` (validates plans) and `gsd-nyquist-auditor` (test generation) in a future pass.

---

### 2. Skill Compression Ratios Vary Dramatically

| Skill | Source | Rewritten | Compression |
|-------|--------|-----------|-------------|
| gsd-executor | 489 lines | 101 lines | 79% smaller |
| gsd-planner | ~900 lines | ~130 lines | 86% smaller |
| tdd-guide | 80 lines | 124 lines | 55% LARGER |

**Insight:** Instance 3 expanded simpler skills (added structure) while compressing complex ones (removed cruft). This is intentional and correct - the goal was standardization, not just copying.

---

### 3. ECC Repository Is Massive

**Stats:** 998 files, 350+ markdown files

Instance 3 correctly triaged to extract only 5 high-value prompts:
- tdd-guide
- code-reviewer
- security-reviewer
- build-error-resolver
- doc-updater

The remaining 993 files are:
- 112 agent configs (framework-specific)
- Translations (Japanese, Chinese)
- IDE-specific rules (.cursor, .opencode)
- Community contributions
- Language-specific reviewers (Go, Python, Swift)

**Recommendation:** If Go/Python support needed later, these reviewers exist and can be extracted.

---

### 4. ui-ux-pro-max Has Framework-Specific CSVs

**Source:** `/tmp/verification/uiux/`

Instance 3 extracted generic CSVs (styles, colors, typography, charts). The repo also has:
- React-specific patterns
- Next.js patterns
- Vue patterns
- SwiftUI patterns
- Flutter patterns

**Current state:** Placeholders in `skills/frontend-design/data/`

**Recommendation:** Fetch full CSV data when UI generation quality matters.

---

### 5. Deviation Rules Are Gold

The GSD gsd-executor has a critical pattern that was preserved in rewriting:

**Deviation Rules (1-4):**
1. Auto-fix bugs (broken behavior)
2. Auto-add missing critical functionality (security, validation)
3. Auto-fix blocking issues (dependencies, imports)
4. STOP for architectural changes (user decision needed)

This pattern is unique to GSD and gives executors autonomy without scope creep.

---

### 6. Goal-Backward Verification Pattern

From gsd-verifier, the verification pattern:

> Don't ask "did you complete the tasks?"
> Ask "does the codebase deliver what was promised?"

This is the key insight that separates GSD from simpler task runners. The Bodyguard + Verifier architecture inherits this.

---

### 7. PA Comparison Is Critical Infrastructure

The `pa-comparison.md` skill (messenger/pa-comparison.md) is the semantic glue between steps:

- Compresses previous step output to 2-3 sentences
- Checks expected inputs exist
- Decides: pass (continue) or intervene (route to different executor)

This was added by Instance 3 after reading conversation.md - good alignment with architecture.

---

### 8. Context Warden Thresholds Are Model-Aware

ENFORCER.json includes model-specific token thresholds:

| Model | Window | Kill At | Effective |
|-------|--------|---------|-----------|
| Claude Opus 4 | 200K | 65% | 130K |
| Claude Sonnet 4 | 200K | 55% | 110K |
| GPT-4o | 128K | 60% | 77K |
| Gemini Pro | 1M | 60% | 600K |

This allows Context Warden to adapt to different models. Instance 3 correctly included this.

---

## Concerns Noted

### 1. Phase vs Worker Confusion

Both `plan` (phase skill) and `gsd-planner` (worker skill) exist with overlapping triggers. No clear routing logic in trigger-map.json.

**Question for architects:** When does Conductor route to phase skill vs worker skill?

### 2. PAUL Repo Not Verified

Instance 3 mentions extracting from PAUL (unify-phase.md) but I couldn't verify - no public URL found. Audit says "Internal/research".

**Status:** Trust but verify later if PAUL becomes public.

### 3. Claude-Mem Source Unclear

Instance 3 mentions Claude-Mem for observation compression pattern. No clear source repo verified.

**Status:** The pattern itself (pa-comparison.md) looks solid regardless of source.

---

## Files Worth Reading

For future Instance work, these source files are high-value:

1. `/tmp/verification/gsd/agents/gsd-plan-checker.md` - Plan validation logic
2. `/tmp/verification/gsd/agents/gsd-nyquist-auditor.md` - Test generation patterns
3. `/tmp/verification/gsd/get-shit-done/references/checkpoints.md` - Checkpoint handling
4. `/tmp/verification/gsd/get-shit-done/references/questioning.md` - Requirements philosophy
5. `/tmp/verification/ecc/skills/verification-loop/SKILL.md` - 6-phase verification

---

## Recommendations for Next Steps

1. **Instance 2 (Adapters):** Use `specs/plugin-requirements-manifest.json` for tool permissions
2. **Instance 4 (Hard Rails):** Use `specs/ENFORCER.json` after fixing regex bug
3. **Instance 5 (Topology):** Use `specs/trigger-map.json` after standardizing runtimes
4. **Future:** Extract plan-checker and nyquist-auditor from GSD

---

*Discoveries documented by Instance V on 2026-03-03*
