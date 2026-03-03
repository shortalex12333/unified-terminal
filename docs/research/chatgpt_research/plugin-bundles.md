# Provider Plugin Bundles — Claude, Codex, Gemini (GSD + CrewAI)

CrewAI vs GSD
- Use GSD as the top‑level orchestrator (plan→research→scaffold→implement→verify). Invoke CrewAI inside phases that benefit from parallel agent exploration (research sweeps, variant generation). Persist plan/phase state in GSD for resume.
- Limits of CrewAI: token budgeting not explicit; state/resume not first‑class; Python dependency gravity; nondeterminism. Mitigate with phase ceilings, hard timeouts, and verification gates.

Claude (Anthropic) Bundle
- Orchestrator: GSD (primary), Claude‑Flow/Ruflo (swarm within phases)
- Code: Claude Code Workflows (primary); Aider/OpenHands (backup)
- Research/Automation: Firecrawl; Playwright MCP→Browser‑Use; trafilatura/readability; SearXNG
- Connectors: GitHub MCP; Context7; Memory MCP; Supabase MCP (optional)
- Skills (enable by default): orchestrator-only, orchestration-discipline, swarm-orchestration, verification-integrity, docker-local-first, reasoningbank-* and agentdb-*, v3-mcp-optimization/performance/security
- Token policy: phase summaries; per‑agent ceilings; breadth caps; demote model for long tail

Codex (OpenAI) Bundle
- Orchestrator: GSD; CrewAI optional within phases
- Code: Codex CLI (primary); Aider/OpenHands backup
- Research/Automation/Connectors: same pattern as Claude
- Token policy: high‑quality model for planning/diffs; demote for bulk edits; dedupe evidence

Gemini (Google) Bundle
- Orchestrator: GSD; CrewAI within phases
- Code: Gemini CLI (verify edit/apply); Aider/OpenHands backup
- Research/Automation/Connectors: same pattern
- Token policy: serialize long automation; cap search breadth; summaries at boundaries

Safety Nets & Fallbacks
- Automation: Playwright → Browser‑Use → manual screenshot cues
- Code: Provider tool → OSS code agent → dry‑run patch preview
- Deploy: GitHub Pages → static artifact zip → local preview server
- Data: SQLite → DuckDB → CSV/JSON
- QA: Playwright Test → Jest/Vitest smoke → manual checklist if blocked
- Security: block secrets; fail‑closed on tool errors; override requires explicit ack

LLM Limitation Mitigations
- Forward‑only: orchestrator-only + verification-integrity gates
- Token blow‑ups: Context7 snippets; Firecrawl over browsing; phase summaries
- False signals: screenshots/PDF + semantic checks; PR green builds mandatory
- “Look busy”: docker-local-first; evidence‑first artifacts (PR URL, CSV/JSON, images)
