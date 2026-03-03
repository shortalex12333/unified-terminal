# Domain F: Persistence & Memory

## What This Domain Covers
How the system remembers: within a session (Spine), across sessions (Archivist + Memory MCP), across projects (lessons.md), and how project lifecycle states are managed.

## Actors
| Actor | Role | Rail |
|-------|------|------|
| Spine Agent | Continuous truth file. Filesystem scan + git status + test results. No AI. | HARD (code, pure Node.js) |
| Archivist | Runs at project CLOSE. Produces PROJECT-ARCHIVE.md + llms.txt. | SOFT (LLM summary) |
| PA / Messenger | On REOPEN: reads archive to restore context. Enables GSD-to-PAUL switch. | SOFT (LLM) |
| Memory MCP | Cross-session persistent knowledge graph. Universal across runtimes. | External tool |

---

## Locked Decisions
| Decision | Winner | Why | Loser |
|----------|--------|-----|-------|
| Cross-session memory | Memory MCP | Universal across all runtimes. Not locked to Claude Code. | Claude-Mem (deleted) |
| Within-session truth | Spine Agent | Code-based filesystem scan. No AI opinions. Millisecond refresh. | Any AI-generated summary |
| Observation compression | PA (using Claude-Mem pattern) | Compresses step output into 2-3 sentence summary for handoff | -- |

---

## What We Absorbed

### From Claude-Mem
**Observation compression prompt:**
Their pattern: PostToolUse hook captures output > LLM compresses to essential facts > stores in SQLite > re-injects at session start.

What we took: The compression prompt template ("Summarize this step output in 2-3 sentences. Include: what changed, what was produced, what the next step needs to know.").
What we threw away: Their SQLite store (Spine IS our store), their capture hook system (PA does this natively), their re-injection logic (Spine refresh handles this).

Location: Integrated into PA prompt at `/skills/messenger/pa-comparison.md`

---

## Project State Machine

```
OPEN -----> Active work. Steps executing. Spine refreshing.
  |
  | (15 min inactivity OR user closes app)
  v
PAUSED ---> User left. Timer starts: 24 hours.
  |
  | (User returns within 24h)     (24 hours pass)
  +-----> OPEN (resume exactly)     |
                                    v
                              CLOSED --> Archivist runs.
                                |        PROJECT-ARCHIVE.md produced.
                                |        llms.txt generated.
                                |        GSD-to-PAUL switch staged.
                                |
                                | (User returns after 24h)
                                v
                              REOPENED --> PA reads archive.
                                          Conductor detects existing project.
                                          PAUL mode activates.
                                          Quick Spine refresh.
                                          "Welcome back. Here is where we left off."
```

**User never explicitly closes a project.** The system handles it. 24-hour window prevents premature archival ("add a contact page" 2 hours later does not trigger archive).

---

## Lesson Template (Structured, Not Freeform)

Every worker that encounters an error must fill this template:
```markdown
## Lesson: [ISO timestamp]
**What broke:** [one sentence, specific]
**Root cause:** [one sentence, the actual why]
**Fix applied:** [one sentence, what was done]
**Prevention rule:** [machine-readable rule for ENFORCER.json]
```

Example:
```markdown
## Lesson: 2026-03-03T14:22:00Z
**What broke:** Stripe webhook handler returned 500 on test event
**Root cause:** Missing STRIPE_WEBHOOK_SECRET env var in Docker container
**Fix applied:** Added to docker-compose.yml environment block
**Prevention rule:** {"check": "docker exec app env | grep STRIPE_WEBHOOK_SECRET", "pass": "output.length > 0", "rail": "HARD"}
```

The `Prevention rule` field is machine-readable. At archival time, Archivist can extract these and add them to ENFORCER.json for future builds. Lessons compound.

---

## Hard Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| Lesson template filled | Regex: all 4 fields present, none are placeholder ("one sentence") | SEND BACK. Worker re-fills before proceeding. |
| Spine refresh timing | Double refresh per step: post-step + pre-next-step | Code-enforced sequencing |

## Soft Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| Lesson quality | Archivist reviews at project end. Deduplicates, ranks actionability. | Low-quality flagged, not deleted. |
| Archive completeness | LLM checks archive covers all features built | WARN. Re-run with checklist. |
