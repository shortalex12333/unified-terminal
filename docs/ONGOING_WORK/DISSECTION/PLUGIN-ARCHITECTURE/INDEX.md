# Plugin Architecture Documentation Index

## Quick Navigation

| Document | Purpose | Read When |
|----------|---------|-----------|
| [OVERVIEW.md](./OVERVIEW.md) | High-level architecture, philosophy, 10 actors | Start here |
| [SOURCE-LINEAGE.md](./SOURCE-LINEAGE.md) | What we took from each repo, why, what changed | Understanding origins |
| [SKILL-CATALOG.md](./SKILL-CATALOG.md) | All 26 skills with I/O specs | Implementing skills |
| [CODEX-ADAPTER-SPEC.md](./CODEX-ADAPTER-SPEC.md) | Codex CLI integration details | Building adapters |
| [TOOL-ROUTING.md](./TOOL-ROUTING.md) | How to call external tools, MCPs, fallbacks | Connecting tools |
| [ENFORCER-GUIDE.md](./ENFORCER-GUIDE.md) | Binary check reference, ~180 checks | Writing enforcement |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER MESSAGE                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 0: FAST-PATH (50ms)                                       │
│  Regex catches trivials → direct to ChatGPT                     │
└─────────────────────────────────────────────────────────────────┘
                              │ not trivial
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: CONDUCTOR (persistent Codex session)                   │
│  Classifies → produces DAG → assigns tiers                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SKILL INJECTOR                                                 │
│  Reads Spine + trigger-map.json → picks skill → pre-loads       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WORKER (spawned per step)                                      │
│  Receives skill pre-loaded → does work → outputs to filesystem  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BODYGUARD (ENFORCER.json checks)                               │
│  Binary pass/fail → blocks if HARD rail fails                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PA / MESSENGER                                                 │
│  Compresses output → checks semantic match → passes to next     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     [NEXT STEP OR DONE]
```

---

## Key Numbers

| Metric | Count |
|--------|-------|
| Skills | 26 |
| Triggers | 143 |
| HARD checks | ~85 |
| SOFT checks | ~95 |
| Source repos audited | 6 |
| Files audited | ~1,195 |
| Files deleted | ~1,169 |
| Actors in nervous system | 10 |

---

## What We Built vs What We Deleted

**Built:**
- 26 skills in 7-section format
- 3 spec files (ENFORCER, trigger-map, manifest)
- 6 documentation files
- Unified architecture that works across Codex, Claude, Gemini

**Deleted:**
- Every "please remember to" instruction
- Every plugin that's just a personality
- PAUL's 26 slash commands
- Claude-Flow's 800-line CLI
- Claude-Mem's SQLite store
- 1,169 files of infrastructure noise

---

## The Three Rules

1. **Plan First** — No code without approved plan
2. **Verify Always** — Prove it works with evidence
3. **Learn Forever** — Structured lessons after every correction

---

## For Each Audience

### If you're building the Skill Injector:
→ Read [SKILL-CATALOG.md](./SKILL-CATALOG.md) for trigger keywords
→ Read trigger-map.json in `specs/`

### If you're building adapters:
→ Read [CODEX-ADAPTER-SPEC.md](./CODEX-ADAPTER-SPEC.md) for Codex
→ Similar patterns apply for Claude Code and Gemini

### If you're building the Bodyguard:
→ Read [ENFORCER-GUIDE.md](./ENFORCER-GUIDE.md) for check patterns
→ Read ENFORCER.json in `specs/`

### If you're adding new skills:
→ Follow 7-section format in [SKILL-CATALOG.md](./SKILL-CATALOG.md)
→ Add binary success criteria
→ Add entry to ENFORCER.json and trigger-map.json

### If you're understanding the philosophy:
→ Read [OVERVIEW.md](./OVERVIEW.md)
→ Read [SOURCE-LINEAGE.md](./SOURCE-LINEAGE.md)
