# Domain G: Tiered Enforcement

## What This Domain Covers
Not every task needs every agent. Tiered model prevents overhead drowning simple tasks while guaranteeing quality on complex builds.

## The Tiers

### Tier 0: Trivial (< 1 minute)
**Agents:** None. Fast-path regex catches trivials, bypasses to ChatGPT. No Conductor, no DAG.
**Examples:** What is the capital of France? / Generate image / Thanks!
**Overhead:** 50ms (local, no network).

### Tier 1: Simple (1-5 min)
**Agents:** 1 Worker + Bodyguard (post-completion only).
Conductor classifies, spawns single worker. Bodyguard runs relevant micro-checks after. No Skill Injector, no PA, no Context Warden.
**Examples:** Fix typo / Change hero image / Update copyright year.
**Overhead:** 3-5s.

### Tier 2: Medium (5-30 min)
**Agents:** Bodyguard + Scope Enforcer + Skill Injector. PA only on cross-runtime handoffs. Context Warden as cron.
Full DAG but lighter enforcement. PA only when output crosses web/CLI boundary.
**Examples:** Add contact form / Set up Stripe / Create admin page.
**Overhead:** 15-30s per step.

### Tier 3: Complex (30+ min)
**Agents:** Full nervous system. All actors, all gates, all checks.
Complete GSD lifecycle. Every step: pre-step Spine refresh, Skill Injection, execution, post-step refresh, Bodyguard, PA comparison, gate.
**Examples:** Build candle store / SaaS dashboard with auth / Portfolio with CMS.
**Overhead:** 2-4 min total across 45-min build = 6-9%.

## Overhead Budget
| Tier | Steps | Time/step | Total overhead | % of task |
|------|-------|-----------|----------------|-----------|
| 0 | 0 | 50ms | 50ms | ~0% |
| 1 | 1 | 3-5s | 3-5s | 5-10% |
| 2 | 3-7 | 5-10s | 30-60s | 5-10% |
| 3 | 8-15 | 10-20s | 2-4min | 6-9% |

Key: overhead % stays roughly constant (5-10%) because more complex tasks justify more checking.

## Context Warden Thresholds
| Model | Window | Kill At | Effective Budget | Grace |
|-------|--------|---------|-----------------|-------|
| Claude Sonnet 4 | 200K | 55% | 110K | >85% done: finish |
| Claude Opus 4 | 200K | 65% | 130K | >85% done: finish |
| GPT-4o | 128K | 60% | 77K | >85% done: finish |
| GPT-4o-mini | 128K | 50% | 64K | >85% done: finish |
| Gemini Pro | 1M | 60% | 600K | >85% done: finish |
| Gemini Flash | 1M | 50% | 500K | >85% done: finish |
| Default | 128K | 55% | 70K | >85% done: finish |

Grace period:
- tokenUsage > threshold AND taskProgress > 0.85 --> let finish (killing costs more)
- tokenUsage > threshold AND taskProgress < 0.85 --> kill, respawn at current step

## User Escape Hatch
Heuristic (soft) checks show: [Retry] [Skip this check] [Stop build]
Definitive (hard) checks: NO skip button. Must fix.
Overrides logged to Spine. Archivist records which checks were skipped.
