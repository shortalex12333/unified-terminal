# Archive Template (PROJECT-ARCHIVE.md)
<!-- triggers: archive, complete, finish, close, ship, done -->
<!-- version: 1.0 -->
<!-- source: custom -->
<!-- runtime: any -->

## Purpose

Generate PROJECT-ARCHIVE.md when a project closes. This is the permanent record of what was built, how it was built, and what was learned.

## When to Generate

- Project marked complete
- 24 hours of inactivity after PAUSED state
- User explicitly requests archive

## Template

```markdown
# PROJECT-ARCHIVE: [Project Name]

**Archived:** YYYY-MM-DD
**Duration:** [X days/weeks]
**Status:** [COMPLETE | PARTIAL | ABANDONED]

---

## What Was Built

### Overview
[2-3 sentence description of the final product]

### Features Delivered
| Feature | Status | Notes |
|---------|--------|-------|
| [Feature 1] | [DONE/PARTIAL/CUT] | [Brief note] |
| [Feature 2] | [DONE/PARTIAL/CUT] | [Brief note] |

### Tech Stack
- **Frontend:** [Framework, styling]
- **Backend:** [Runtime, framework]
- **Database:** [Type, provider]
- **Deployment:** [Platform, URL if applicable]

---

## How It Was Built

### Phase Summary
| Phase | Goal | Outcome |
|-------|------|---------|
| 1 | [Goal] | [What happened] |
| 2 | [Goal] | [What happened] |

### Key Decisions
| Decision | Why | Impact |
|----------|-----|--------|
| [Decision 1] | [Reason] | [What changed because of it] |

### Challenges Overcome
| Challenge | Solution | Lesson |
|-----------|----------|--------|
| [Challenge 1] | [How we solved it] | [What we learned] |

---

## What Was Learned

### Lessons (from tasks/lessons.md)
[Copy or summarize key lessons]

### Patterns Worth Reusing
| Pattern | Where Applied | Why It Worked |
|---------|---------------|---------------|
| [Pattern 1] | [Files/features] | [Explanation] |

### Things to Do Differently
- [Retrospective insight 1]
- [Retrospective insight 2]

---

## Artifacts

### Code
- **Repository:** [URL or path]
- **Main branch:** [branch name]
- **Last commit:** [hash] - [message]

### Documentation
| Document | Location | Purpose |
|----------|----------|---------|
| CLAUDE.md | /CLAUDE.md | Project memory |
| tasks/lessons.md | /tasks/lessons.md | Accumulated lessons |

### Deployment
- **Production URL:** [URL]
- **Deploy command:** [command]
- **Rollback command:** [command]

---

## Reopening Instructions

If returning to this project:

1. Read this archive first
2. Check `tasks/lessons.md` for gotchas
3. Run `[health check command]` to verify state
4. Resume from Phase [N] or start fresh
```

## Hard Boundaries

- NEVER archive without summarizing lessons
- NEVER claim COMPLETE status if verification failed
- ALWAYS include reopening instructions

## Success Looks Like

- [ ] PROJECT-ARCHIVE.md created
- [ ] All sections filled (or marked N/A with reason)
- [ ] Tech stack documented
- [ ] Lessons summarized
- [ ] Deployment info included (or noted as local-only)
- [ ] Reopening instructions present
