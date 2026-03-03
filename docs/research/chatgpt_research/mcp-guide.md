# MCP Guide — What to Use, Why, How (OSS‑First)

Purpose
- Define the MCP servers we will ship (and how) across Claude, Codex, and Gemini provider bundles. Cover usage patterns, value, process integration, and limitations anchored to real failure modes in docs/LLM_LIMITATIONS/.

Core MCPs (Provider‑agnostic)
- GitHub MCP
  - Why: Repos/PRs/issues lifecycles; verifiable outputs (PR URLs, diffs)
  - How: Spawn via PluginExecutor; auth via cli-auth; emit PR URL; gate merges on QA/security
  - Process: Plan → implement → PR → tests → review; rollback script included
  - Limits: Rate‑limits; secrets; require gh auth; mitigation: cache, retries, Gitleaks block
- Playwright MCP (Automation)
  - Why: Deterministic browser automation with screenshots/PDFs for verification
  - How: Headless runs with per‑step screenshots; structured logs parsed by output-translator
  - Process: Form fill, scraping, auth flows, verification; fall back to Browser‑Use
  - Limits: Heavy deps; anti‑bot; mitigation: curl‑impersonate for fetches, backoff, manual cue mode
- Firecrawl (Research/Extraction)
  - Why: Structured content extraction and site crawling; reduces token spend vs naive browsing
  - How: CLI/server invoked per domain; artifacts: JSON/CSV + sources list
  - Process: Discover (search) → crawl → normalize → feed into LLM (summarize)
  - Limits: Rate‑limits, structure drift; mitigation: domain caps, normalization pass
- Context7 MCP (Docs Grounding)
  - Why: Inject library docs and APIs to curb hallucinations and token waste
  - How: On code phases, fetch relevant docs; cache locally; feed snippets, not whole manuals
  - Process: Gate “implement” on references; surface citations in PR
  - Limits: Coverage/staleness; mitigation: cache versioned docs, refresh policy
- Memory MCP (Persistence)
  - Why: Cross‑session memory without cloud DB; reduces repetition, token costs
  - How: Store brief, decisions, verified outcomes; retrieval by task hash
  - Process: At phase boundaries, persist summary + artifact pointers; rehydrate on resume
  - Limits: Scope creep; mitigation: schema (what/why/where), TTLs
- Supabase MCP (Optional DB)
  - Why: Quick OSS DB/auth/storage for generated apps
  - How: Provision local env; Prisma client generation; migrations
  - Limits: Docker dependency; mitigation: capability scan; offer SQLite/DuckDB fallback

Provider Mapping
- Claude: All core MCPs; Claude‑Flow agent assignment chooses when to use Playwright vs Browser‑Use; GSD enforces checkpoints
- Codex: All core MCPs; Codex CLI + GitHub MCP for repo ops; GSD plans/gates
- Gemini: All core MCPs; same routing; ensure headless deps installed first‑launch

LLM Limitation Mitigations (from docs/LLM_LIMITATIONS)
- Forward‑only/No re‑planning: GSD phases + verification‑integrity skill; MCP outputs must pass explicit checklists
- Token blow‑ups: Context7 snippets (not dumps); Firecrawl over browsing; summaries at phase boundaries
- False success/failure: Screenshots/PDF from Playwright + semantic checks; PR green build requirement
- “Look busy” bias: docker-local-first skill; always verify locally before pushing

Operational Notes
- Run MCP servers/tools as child processes; never embed secrets in prompts; redact logs
- Timeouts + retries with exponential backoff
- All artifacts saved under project/output with index.json for our UI
