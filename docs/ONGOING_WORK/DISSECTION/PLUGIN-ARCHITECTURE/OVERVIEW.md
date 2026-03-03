# Unified Terminal Plugin Architecture

## What This Is

A **nervous system** for AI-assisted software development. Not one fat agent with 20 skills stuffed into its context — a distributed architecture where specialized agents are born, do one job, and die. The system enforces quality through code-based gates, not polite suggestions.

## The Reframe That Changes Everything

> **Agents are free. Use as many as you want.**

Everyone else builds one agent, stuffs it with 15 responsibilities, and wonders why it forgets half of them by message 30. That's not architecture. That's a prayer.

Our approach: spawn a fresh agent with a tight mandate. It does its job. It dies. The next agent spawns with exactly what it needs. Context never degrades because context is never reused beyond its purpose.

---

## The 10 Actors

| Actor | Job | Rail Type | Implementation |
|-------|-----|-----------|----------------|
| **Spine Agent** | Owns truth file. Reads filesystem/git/tests. Updates continuously. | HARD (code) | Node.js, no AI |
| **Conductor** | Routes user request. Produces DAG. Tier 1 classifier. | HARD (code + LLM) | Persistent Codex session |
| **PA / Messenger** | Semantic glue between steps. Catches mismatches. Compresses output. | SOFT (LLM) | Spawned per transition |
| **Skill Injector** | Reads spine + next step. Picks skill. Pre-loads into worker. | HARD (code) | BM25 + trigger-map.json |
| **Worker Agents** | Do the actual work. Code, research, images. | SOFT (LLM) | Spawned per step |
| **Bodyguard** | Sits at every phase gate. Checks external reality. Binary pass/fail. | HARD (code) | ENFORCER.json checks |
| **Context Warden** | Monitors token counts. Hard kills at threshold. | HARD (code) | Cron-triggered |
| **Cron Layer** | Fires timers that spawn agents. Test runner, continue injector. | HARD (code) | Node.js setInterval |
| **Archivist** | Runs at project completion. Produces handoff summary. | SOFT (LLM) | Spawned once at end |
| **Intake** | Captures user requirements. Defaults to Apple-like aesthetic. | SOFT (LLM) | First interaction |

---

## The Philosophy

### Skills = Binary. Plugins = Analog.

A **skill** is a gate. It passes or it fails. The Docker health check doesn't care about feelings. The build either compiles or it doesn't. Binary.

A **plugin** is a vibe. "You are a careful senior engineer." That's a personality. The AI might follow it. Might not. Depends on its mood, context pressure, how deep it is into a conversation. Analog, unreliable, degrading over time.

**We converted plugins to skills.** Every "please remember to" instruction is now a binary check in ENFORCER.json. The AI doesn't need to remember. The bodyguard enforces.

### The Worker Never Chooses

Traditional approach: Load agent with 20 skills. Hope it picks the right one.

Our approach: The **Skill Injector** reads what step is about to execute, consults trigger-map.json, and pre-loads exactly one skill into the worker's context. The worker doesn't know other skills exist. It can't choose wrong. It can't forget. It can't skip. The skill IS its reality.

### Surround AI With Code That Doesn't Lie

The AI is the muscle. It generates, it creates, it writes. But it's blind to its own failures.

So you build **eyes that aren't AI** — filesystem checks, process exit codes, HTTP status codes, git diffs, token counters, test runners — and you make those eyes the gatekeepers.

The AI proposes. Reality disposes. The user sees things that actually work, because nothing reaches them without passing through gates that can't be hallucinated past.

---

## What We Built

```
skills/                          # 26 skill files
├── phases/         (5)          # discuss, plan, execute, verify, unify
├── workers/        (14)         # gsd-*, tdd-guide, code-reviewer, etc.
├── verification/   (2)          # verification-integrity, docker-local-first
├── frontend-design/(4+CSVs)     # SKILL.md, search.py, data/*.csv
├── templates/      (3)          # lesson, archive, llms-txt
└── messenger/      (1)          # pa-comparison

specs/                           # Machine-readable specifications
├── ENFORCER.json                # ~180 binary checks
├── trigger-map.json             # 26 skills, 143 triggers
└── plugin-requirements-manifest.json  # Tool permissions per skill

audits/                          # Source repo inventories
├── gsd-audit.md
├── ecc-audit.md
└── supplementary-audit.md

originals/                       # Verbatim source prompts (22 files)
```

---

## The Tiers

| Tier | Duration | Agents | Overhead |
|------|----------|--------|----------|
| **0: Trivial** | < 1 min | None (fast-path regex) | 50ms |
| **1: Simple** | 1-5 min | 1 Worker + Bodyguard (post-only) | 3-5s |
| **2: Medium** | 5-30 min | Bodyguard + Scope Enforcer + Skill Injector | 30-60s |
| **3: Complex** | 30+ min | Full nervous system (all 10 actors) | 2-4 min |

Overhead stays ~6-9% because complex tasks justify more checking.

---

## Key Files

| File | Purpose |
|------|---------|
| `OVERVIEW.md` | This file. High-level architecture. |
| `SOURCE-LINEAGE.md` | What we took from each repo, why, what we changed. |
| `SKILL-CATALOG.md` | All 26 skills with input/output/process specs. |
| `CODEX-ADAPTER-SPEC.md` | How skills translate to Codex runtime. |
| `TOOL-ROUTING.md` | How to call external tools (CLI, web, services). |
| `ENFORCER-GUIDE.md` | Complete binary check reference. |

---

## The Three Rules

1. **Plan First** — No code without approved plan
2. **Verify Always** — Prove it works with evidence (not opinion)
3. **Learn Forever** — Structured lessons after every correction

---

## What We Threw Away

| Deleted | Why |
|---------|-----|
| Every "please remember to" instruction | Bodyguard enforces, AI doesn't need to remember |
| Every plugin that's just a personality prompt | Unreliable. Degrades over time. |
| Every skill that's just advice | Cron agent and bodyguard run checks regardless |
| Claude-Mem's SQLite store | Spine IS our store |
| PAUL's 26 slash commands | Conductor handles routing |
| Claude-Flow's HNSW memory | Overkill. Memory MCP is universal. |
| Netlify CLI | Vercel wins. One deploy target. |
| DuckDB | SQLite more universal. |
| ImageMagick | Sharp is Node-native. |

---

## The User Never Sees This

They see "Building your candle store" with steps ticking off.

Behind the curtain: ten agents are born and die across 45 minutes, a bodyguard rejects a bad build and forces a retry, the warden kills a worker at 45% context and respawns it fresh, the PA notices the hero image is wrong and sends it back for regeneration, and the cron runner catches a regression in the payment flow.

The user sees: **"Your site is ready."**
