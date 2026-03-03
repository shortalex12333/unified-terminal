# One‑Shot Project Bundles — Per LLM Provider (OSS‑First)

Goal
- Define complete, OSS‑first plugin bundles for OpenAI (Codex slot), Anthropic (Claude slot), and Google (Gemini slot) that “one‑shot” a project by composing multiple tools with backups and safety nets. Also include a Local‑Only (no API) bundle.
- Every bundle covers: intake/research → automation/scrape → build/code → QA/security → artifacts/deploy → observability. Backups/fallbacks are listed for each capability.

Conventions
- Primary = first choice; Backup = automatic fallback; Safety = guardrails/recovery. All items are open‑source; service CLIs are optional and clearly marked.

---

## OpenAI (Codex Slot) — OSS‑First Bundle

Capabilities
- Orchestrator: Primary CrewAI; Backup LangGraph; Safety phase checkpoints (resume)
- Research/Search: Primary SearXNG; Backup DuckDuckGo local scripts; Safety dedupe + rate limiting
- Crawl/Extract: Primary Playwright + trafilatura/readability‑lxml; Backup Browser‑Use; Safety screenshots/PDF
- Parsing/Transform: Cheerio/BeautifulSoup/fast‑xml‑parser; jq/csvkit; Safety schema validators (ajv/jsonschema)
- Code Agent: Primary OpenHands (OSS); Backup Aider; Safety dry‑run diffs + PR gate
- Scaffolds: Next.js/Astro + Fastify/Hono; Prisma + SQLite/DuckDB; Safety migration plan + rollback
- QA: Playwright Test/Jest/Vitest; Safety golden tests + threshold gates
- Security: Semgrep, Gitleaks, OSV‑Scanner, ShellCheck, Hadolint; Safety block‑on‑fail for secrets
- Images: Primary ComfyUI; Backup InvokeAI/diffusers; Safety ImageMagick/sharp optimize
- Deploy (optional service): Primary GitHub Pages; Backup static artifact zip; Safety checksum + revert script
- Observability: OpenTelemetry Collector (sample traces); mitmproxy for debug capture

Execution Order (sample)
1) Research kit → sources.md + CSV/JSON
2) Scaffold app + DB → commit baseline
3) Code agent applies features → PR
4) QA + security gates → pass
5) Deploy (GH Pages/static) → preview URL
6) Artifacts saved (screenshots, reports, docs)

---

## Anthropic (Claude Slot) — OSS‑First Bundle

Capabilities
- Orchestrator: CrewAI → LangGraph
- Research: SearXNG → DuckDuckGo scripts; Crawl: Playwright → Browser‑Use; Extraction: trafilatura/readability
- Code Agent: OpenHands → Aider; Scaffolds: Astro/Next.js + Fastify/Hono; DB: Prisma + SQLite/DuckDB
- QA/Security: Playwright Test/Jest/Vitest; Semgrep/Gitleaks/OSV/ShellCheck/Hadolint
- Images: ComfyUI → InvokeAI; Assets: ImageMagick/sharp
- Deploy (optional): GitHub Pages → static export
- Observability: OTel Collector; mitmproxy (debug)

Safety Nets
- Phase resume markers; PR review gate; rollbacks for migrations; secret‑scan block; screenshot evidence for automation

---

## Google (Gemini Slot) — OSS‑First Bundle

Capabilities
- Orchestrator: CrewAI → LangGraph
- Research: SearXNG; Crawl: Playwright → Browser‑Use; Extraction: trafilatura/readability
- Code Agent: OpenHands → Aider; Web: Astro/Next.js; API: Fastify/Hono; DB: Prisma + SQLite/DuckDB
- QA/Security: Playwright Test/Jest/Vitest; Semgrep/Gitleaks/OSV/ShellCheck/Hadolint
- Images: ComfyUI → InvokeAI; Optimization: ImageMagick/sharp
- Deploy (optional): GitHub Pages; Artifacts zip fallback
- Observability: OTel Collector; mitmproxy

Safety Nets
- Rate‑limit guards; backoff/retry policies; artifact snapshot before each risky step

---

## Local‑Only (No API) — OSS Bundle

Capabilities
- LLM Runtime: Ollama (Mixtral/Qwen/etc.) → llama.cpp
- Orchestrator: CrewAI → LangGraph
- Research/Crawl: Playwright → Browser‑Use; SearXNG local; Extraction: trafilatura/readability
- Code Agent: OpenHands → Aider; Scaffolds: Astro/Next.js; DB: Prisma + SQLite/DuckDB
- QA/Security: Playwright Test/Jest/Vitest; Semgrep/Gitleaks/OSV/ShellCheck/Hadolint
- Images: ComfyUI → InvokeAI; Optimization: ImageMagick/sharp
- Deploy: GitHub Pages (generated static) → local preview server

Safety Nets
- Hardware profile check (RAM/CPU/GPU) to adjust concurrency and model sizes; caching

---

## Backups, Fallbacks, Safety Nets (Matrix)

- Search: SearXNG → custom scraper (curl‑impersonate) → cached sources
- Automation: Playwright → Browser‑Use → manual cues (screenshots + prompts)
- Code: OpenHands → Aider → dry‑run (patch preview only)
- Images: ComfyUI → InvokeAI → defer to stock assets
- Deploy: GH Pages → static zip → local server
- Data: SQLite → DuckDB → flat files (CSV/JSON)
- QA: Playwright Test → Jest/Vitest smoke → manual checklist
- Security: block secrets; fail‑closed on tool errors; allow override with explicit ack

---

## Why This One‑Shots Any Typical Project
- Coverage: Every phase from research to deploy is represented with at least one primary + backup tool; all open‑source.
- Determinism: QA/security gates and artifact generation make progress verifiable.
- Degradation: If a primary fails (anti‑bot, rate limits, hardware limits), fallbacks keep the flow moving with narrower scope.
- Cost & Tokens: OSS tools and local models (Ollama) avoid API cost; when providers are used, the surrounding stack remains OSS.
- Safety: Rollbacks, PR gates, and secret scanners prevent catastrophic outcomes.

---

## Minimal Kits (by Task)

- Research Kit: SearXNG, Playwright, trafilatura/readability, csvkit, visidata
- Build Kit: CrewAI, OpenHands/Aider, Astro/Next.js, Prisma+SQLite, Jest/Playwright Test
- Automation Kit: Playwright, Browser‑Use, curl‑impersonate, csvkit, screenshots
- Image Kit: ComfyUI/InvokeAI, ImageMagick/sharp
- Deploy Kit: GitHub Pages pipeline, static export, local preview server

Notes
- Service CLIs (Netlify/Vercel) are OSS but rely on proprietary services; keep them optional.
