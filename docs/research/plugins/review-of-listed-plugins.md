# Review — Initial GitHub Plugins List (Purpose, Application, LLM, Tech, Limits)

Source list: docs/research/### List of plugins github open source.md

Note: This is a quick, engineering-focused assessment to decide what we wire first. It calls out fit, gaps, and risks so we don’t burn tokens or time on the wrong pieces.

## everything-claude-code (affaan-m/everything-claude-code)
- Overview: Aggregated collection of Claude Code skills/plugins, patterns, and examples.
- Purpose: Discovery/bootstrapping of Claude Code ecosystem components.
- Application: Use as a catalog to pull concrete skills into our Skills layer; do not load wholesale.
- LLM utilized: Claude (Claude Code).
- Technical: Mixed curation; quality varies; requires pinning to specific skill repos with clear licenses.
- Limitations: Not a runnable plugin; uneven maintenance; risk of stale patterns.
- Comments: Treat as index; extract only skills that align with orchestrator-only + verification-integrity.

## awesome-claude-code (hesreallyhim/awesome-claude-code)
- Overview: “Awesome list” for Claude Code resources.
- Purpose: Discovery of high-signal skills/tools.
- Application: Same approach as above; curate per-skill, not list.
- LLM utilized: Claude.
- Technical: Links out; no uniform structure; manual vetting required.
- Limitations: Signal/noise; outbound links can be dead or outdated.
- Comments: Good for breadth; we still need a scoring pass before inclusion.

## ui-ux-pro-max-skill (nextlevelbuilder/ui-ux-pro-max-skill)
- Overview: A focused Claude Code skill for UI/UX tasks.
- Purpose: Improve design defaults, component structure, and copy tone in generated UI.
- Application: Load as a conditional skill when task matches “design/ui/ux”.
- LLM utilized: Claude Code.
- Technical: Likely a SKILL.md + patterns; ensure triggers and acceptance criteria exist.
- Limitations: Subjective outputs; requires clear acceptance tests (visual + semantic checks).
- Comments: Include as optional skill behind a size cap to avoid context bloat.

## get-shit-done (gsd-build/get-shit-done)
- Overview: Orchestrator with phases (plan→research→scaffold→implement→verify) and progress semantics.
- Purpose: Top-level PM; token hygiene via phase summaries; resume checkpoints.
- Application: Primary orchestrator across providers.
- LLM utilized: Any (routes to provider code tools inside phases).
- Technical: CLI; emits parseable logs; long-running; integrates well with our CLI runner and output translator.
- Limitations: Requires good phase design; not a code editor by itself; relies on downstream tools.
- Comments: Central to our stack; combine with Claude-Flow bursts inside phases.

## obsidian-skills (kepano/obsidian-skills)
- Overview: Skill framework for Obsidian use; not directly a Claude Code skill pack.
- Purpose: Note-taking/workflow in Obsidian.
- Application: Low fit; only useful if we add Obsidian as a target.
- LLM utilized: N/A (contextual for Obsidian).
- Technical: Plugin for Obsidian; different host/runtime.
- Limitations: Not applicable to our agent pipeline.
- Comments: Exclude for MVP; revisit if we add Obsidian export workflow.

## superpowers (obra/superpowers)
- Overview: Utility toolkit (general purpose/CLI/automation patterns).
- Purpose: Developer quality-of-life; may include useful helpers.
- Application: Consider cherry-picking specific utilities (if any) into scripts.
- LLM utilized: N/A (helper layer).
- Technical: Depends on exact repo contents; audit before inclusion.
- Limitations: Scope creep; not a plugin.
- Comments: Treat as inspirational repo, not runtime dependency.

## context7 (upstash/context7)
- Overview: MCP/server for library/API docs grounding.
- Purpose: Reduce hallucinations and token spend by injecting relevant doc snippets.
- Application: Load during code phases; cite sources in PRs.
- LLM utilized: Any.
- Technical: Run as MCP; cache docs locally by version; snippet retrieval not dumps.
- Limitations: Coverage/staleness; network dependency unless pre-cached.
- Comments: High value; add guardrails for version pinning and cache policy.

## repomix (yamadashy/repomix)
- Overview: Combine repo files into a single contextable artifact (tree mixing).
- Purpose: Provide controlled, compressed context for LLM edits; reduces token waste.
- Application: Pre-edit snapshot for code tools; attach as “read-only” evidence.
- LLM utilized: Any.
- Technical: CLI; configurable ignore rules; size caps; chunking.
- Limitations: Large repos still big; risk of leaking secrets if not filtered.
- Comments: Integrate with Gitleaks and size thresholds; good prep step.

## claude-mem (thedotmack/claude-mem)
- Overview: Memory utility for Claude sessions.
- Purpose: Persist insights between sessions.
- Application: Only in Anthropic workflows; ensure ToS compliance.
- LLM utilized: Claude.
- Technical: May rely on browser/session hooks; audit.
- Limitations: Fragile vs UI changes; potential ToS risk; avoid storing secrets.
- Comments: Optional; our Memory MCP is safer baseline.

## CodexBar (steipete/CodexBar)
- Overview: macOS menu bar utility for Codex/AI workflows.
- Purpose: Quick entry point; not a core plugin.
- Application: UX nicety for power users; non-essential to orchestrated builds.
- LLM utilized: OpenAI.
- Technical: macOS specific; outside Electron runtime.
- Limitations: Platform lock; limited integration.
- Comments: Defer.

## CARL — Context Aware Rule Loader (ChristopherKahler/carl)
- Overview: Loads context-aware rules/skills based on triggers.
- Purpose: Automate “which skill to load when,” minimizing token bloat.
- Application: Map to our Skills router (Layer 2) to conditionally inject skills.
- LLM utilized: Any.
- Technical: Needs clean trigger mapping; versioned skill packs; tests.
- Limitations: Misfires cause rule noise; strict trigger tests required.
- Comments: Strong fit with SKILL_VS_PROMPT_INJECTION.md principles.

## danger-zone (GitHub community discussion)
- Overview: Discussion thread (not a plugin).
- Purpose: General caution/edge cases.
- Application: Reference only.
- LLM utilized: N/A.
- Technical: N/A.
- Limitations: Not actionable runtime dependency.
- Comments: Exclude.

---

## Tech Stack Items (Not plugins but infra/services)
- Supabase (DB/auth/storage): OSS; great for app outputs; Docker dependency.
- Stripe (payments): Service; not OSS. Keep out of default bundle (optional).
- Cloudflare (DNS): Service; optional for custom domains.
- Posthog (analytics): OSS core with cloud option; optional.
- Upstash (Redis): Managed; not OSS; avoid by default.
- Postgres (DB): OSS; fine; prefer SQLite/DuckDB for MVP.
- GitHub (VC): Service; required for PR workflows; store only minimal tokens.
- Namecheap (domains): Paid service; out of scope for MVP.
- Vercel (deploy): Proprietary service; CLI is OSS but optional. Default to GitHub Pages.

---

## Summary — What We Wire First
- Must‑Haves
  - GSD (orchestrator); Claude‑Flow/Ruflo (swarm bursts); Claude Code Workflows (if on Anthropic)
  - Context7 MCP; Playwright MCP → Browser‑Use fallback; Firecrawl
  - Repomix (context prep); GitHub MCP; Memory MCP
  - QA/Sec: Playwright Test + Jest/Vitest; Semgrep, Gitleaks, OSV‑Scanner, ShellCheck, Hadolint
- Optional/Nice
  - ui‑ux‑pro‑max‑skill (conditional); CARL (skill triggers)
- Exclude/Defer
  - Obsidian skills (not relevant); superpowers (utility); CodexBar (UX nicety); Upstash/Stripe/Namecheap/Vercel (services) for default OSS bundle

## How We Use Them (Process)
1) Intake → GSD plan with Skills (orchestrator‑only, verification‑integrity)
2) Research → Firecrawl + Playwright; normalize with trafilatura/readability; dedupe sources; save CSV/JSON
3) Context → repomix snapshot + Context7 snippets
4) Code → Claude Code Workflows (or Codex/Gemini path); backups: Aider/OpenHands
5) QA/Sec → tests + scanners; block on secrets; parse friendly statuses
6) Deploy → GH Pages (default) or static artifact; always keep rollback
7) Artifacts → PR URL, preview (or static), sources, screenshots, reports

## Risks & Mitigations (from docs/LLM_LIMITATIONS)
- Forward‑only bias → phase gates; “STOP and verify” skills
- Token blow‑ups → summaries, dedupe, small doc snippets
- False “it works” → insist on evidence (tests, screenshots)
- Prompt bloat → move patterns into skills; load on triggers only
