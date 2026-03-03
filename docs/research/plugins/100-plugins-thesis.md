# 100+ Open‑Source Plugins & Tools — Ranked Thesis (v1 Draft)

Overview
- This thesis ranks and explains an open‑source, free plugin/tool ecosystem to power a consumer‑grade agentic desktop (Electron) that wraps CLI tools behind a ChatGPT‑first intake UI. Each entry includes application, limitations, usability, real‑world scenarios, efficiency/cost/compute notes, model fit, and conflicts.

Method Notes
- OSS only, free to use. Preference for active maintenance and clear licenses.
- Evidence‑oriented using GitHub signals and community references (to be appended in `sources.md`).
- Weighted scoring (Rel 1.2, Maint 1.0, Cov 1.0, Int 1.1, Sec 1.1, Perf 1.0, UX 1.1). Admission ≥ 3.8.

Top 25 (Expanded) — v1 Population Backbone

1) GSD (orchestration)
- Why: Phased, verifiable execution; emits progress lines we can parse into UX.
- Application: Plan→Research→Scaffold→Implement→Verify for build_product tasks.
- Limits: Requires robust CLI runner; long phases; depends on external model quality.
- Efficiency/Cost: Minimal direct token cost; orchestrator overhead negligible.
- Model Fit: Any (routes to Claude Code/Codex/Gemini chains).
- Conflicts: None; becomes the conductor.

2) Playwright MCP (automation)
- Why: Industrial browser automation; deterministic; screenshots; PDF.
- Application: Form fill, auth flows, data extraction, verification.
- Limits: Heavy deps; flaky sites with bot defenses.
- Efficiency/Cost: Compute‑heavy; prefer on capable hosts; fall back to Browser‑Use.
- Model Fit: Any.
- Conflicts: Headless deps vs low‑capability systems.

3) Browser‑Use (automation fallback)
- Why: High real‑world success on messy sites; simpler setup.
- Application: Navigations where Playwright meets anti‑bot; quick scrapes.
- Limits: Less deterministic; lower structural fidelity.
- Efficiency/Cost: Lower compute; more retries.
- Model Fit: Any.
- Conflicts: Do not run concurrently with Playwright on constrained hosts.

4) Firecrawl (research/extraction)
- Why: Structured extraction and site‑level crawling with selectors.
- Application: Market scans; competitor feature maps; docs ingestion.
- Limits: Rate limits; needs normalization.
- Efficiency/Cost: Token‑friendly vs naive browsing.
- Model Fit: Any.
- Conflicts: Coordinate with Browser‑Use; avoid duplicate fetch.

5) GitHub MCP (connector)
- Why: Repo/PR/issues lifecycle; anchor for verifiable output.
- Application: PR creation, diff reviews, CI signals.
- Limits: Requires auth; rate limits.
- Efficiency/Cost: Minimal tokens; network/API usage.
- Model Fit: Any.
- Conflicts: None.

6) Context7 MCP (docs grounding)
- Why: Library docs injection curbs hallucinations and saves tokens.
- Application: Code generation with live API references.
- Limits: Coverage; indexing freshness.
- Efficiency/Cost: Reduces tokens; improves quality.
- Model Fit: Any.
- Conflicts: None.

7) Memory MCP (persistence)
- Why: Cross‑session memory without cloud DB.
- Application: Remember org context, preferences, prior outputs.
- Limits: Scope drift; privacy guardrails needed.
- Efficiency/Cost: Small local overhead; token savings over time.
- Model Fit: Any.
- Conflicts: Ensure user‑visible controls.

8) Web Search MCP (research)
- Why: Broad discovery; paired with Firecrawl for structure.
- Application: Source discovery and quick facts.
- Limits: Quality varies; need citation policy.
- Efficiency/Cost: Token/latency depends on provider.
- Model Fit: Any.
- Conflicts: Deduplicate with ChatGPT browsing.

9) DALL·E / OpenAI Images MCP (images)
- Why: Rapid brand/art assets for content and landing pages.
- Application: Hero art, logos (with caution), social media images.
- Limits: Style consistency; licensing nuance.
- Efficiency/Cost: API cost per image; cache outputs.
- Model Fit: OpenAI chains.
- Conflicts: If OSS‑only strict, route to SD local later (heavier).

10) Whisper.cpp (audio → text)
- Why: Local, fast transcription on macOS/Linux.
- Application: Intake via voice; transcript processing.
- Limits: CPU‑heavy on long files; models weight.
- Efficiency/Cost: No API cost; compute only.
- Model Fit: Any.
- Conflicts: None.

11) Tesseract (OCR)
- Why: OSS OCR for PDFs/screenshots; enables automation flows.
- Application: Invoices, forms, docs scanning.
- Limits: Accuracy varies; requires pre/post processing.
- Efficiency/Cost: CPU cost; no tokens.
- Model Fit: Any.
- Conflicts: None.

12) Supabase CLI MCP (data)
- Why: OSS DB/auth/storage; quick app scaffolds.
- Application: Persistent data for generated apps; auth flows.
- Limits: Requires Docker; provisioning time.
- Efficiency/Cost: Free tier friendly; local first.
- Model Fit: Any.
- Conflicts: Avoid on constrained hosts.

13) Prisma (ORM CLI)
- Why: Database migrations and type‑safe queries.
- Application: Full‑stack app scaffolds.
- Limits: Node‑only; specific stack.
- Efficiency/Cost: Minimal; speeds delivery.
- Model Fit: Any code chain.
- Conflicts: None.

14) Vercel CLI (deploy)
- Why: One‑command deploy, preview URLs for verification.
- Application: Landing pages, Next.js apps.
- Limits: Auth; project linking.
- Efficiency/Cost: Free plan suffice for previews.
- Model Fit: Any code chain.
- Conflicts: None.

15) Netlify CLI (deploy alt)
- Why: Alternative host for JAMStack; redundancy.
- Application: Static sites, functions.
- Limits: Auth; config.
- Efficiency/Cost: Free plan previews.
- Model Fit: Any.
- Conflicts: None.

16) Jest/Vitest (testing)
- Why: Unit/integration tests as artifacts of quality.
- Application: Sanity checks and verification.
- Limits: Ecosystem differences.
- Efficiency/Cost: Low.
- Model Fit: Any code chain.
- Conflicts: Choose one per repo.

17) Cypress (E2E)
- Why: User‑level tests; good for verification.
- Application: E2E flows and smoke tests.
- Limits: Heavier than Playwright test.
- Efficiency/Cost: Medium.
- Model Fit: Any.
- Conflicts: Prefer Playwright test if already using Playwright MCP.

18) ESLint/Prettier (quality)
- Why: Baseline code quality and consistency.
- Application: Auto‑formatting and lint errors to surface in UX.
- Limits: Configuration noise.
- Efficiency/Cost: Low.
- Model Fit: Any.
- Conflicts: Respect project configs.

19) Semgrep (security)
- Why: OSS static analysis with wide rule sets.
- Application: Security scan before deploy.
- Limits: False positives; tuning.
- Efficiency/Cost: Low.
- Model Fit: Any.
- Conflicts: None.

20) Gitleaks (secrets)
- Why: Secret detection in generated repos.
- Application: Prevent accidental token leaks.
- Limits: Rule tuning; false positives.
- Efficiency/Cost: Low.
- Model Fit: Any.
- Conflicts: None.

21) ripgrep + jq/yq (ops helpers)
- Why: Fast search and JSON/YAML manipulation in pipelines.
- Application: Agent file ops and data shaping.
- Limits: None.
- Efficiency/Cost: Very low.
- Model Fit: Any.
- Conflicts: None.

22) zx (shell scripting)
- Why: High‑level scripts from Node; great for agents.
- Application: Orchestrating local steps.
- Limits: Node runtime.
- Efficiency/Cost: Low.
- Model Fit: Any.
- Conflicts: None.

23) Sharp/Imagemin (images)
- Why: Optimize images for web.
- Application: Asset pipelines for generated sites.
- Limits: Native deps.
- Efficiency/Cost: Low.
- Model Fit: Any.
- Conflicts: None.

24) wkhtmltopdf / Puppeteer PDF
- Why: Reliable PDF generation.
- Application: Reports, decks, docs.
- Limits: System deps; headless quirks.
- Efficiency/Cost: Medium compute.
- Model Fit: Any.
- Conflicts: Prefer Puppeteer PDF if Playwright MCP is present.

25) OpenTelemetry (tracing basics)
- Why: Add minimal traces to generated apps for verifiable perf.
- Application: Perf validation in preview.
- Limits: Overkill for MVP; optional stub.
- Efficiency/Cost: Low.
- Model Fit: Any.
- Conflicts: None.

---

Additional Candidates (to reach 100+ with brief notes)
- Puppeteer (automation alt) — simpler API; Chrome‑only; less robust than Playwright.
- Scrapy (scraping) — Python powerhouse; heavy; great pipelines.
- BeautifulSoup/Cheerio (parsers) — HTML parsing; use for post‑processing.
- Mercury/Readability (content parse) — Cleaner text extraction.
- Newman (API tests) — CI‑friendly Postman runner.
- httpie/curl (HTTP) — API checks, downloaders.
- sqlc/Prisma Migrate/Knex (DB) — DB codegen/migrations.
- FastAPI/Express generators — Bootstraps for APIs.
- Lighthouse CI — Web perf budgets.
- imagemagick — Image transforms.
- Tauri CLI — Alt desktop shell (parked).
- Husky/lint‑staged — Pre‑commit quality.
- Commitlint — Commit hygiene for PRs.
- Conventional Changelog — Release notes.
- GitHub CLI — Issues/PR automation; alternative to MCP if needed.
- mkdocs/docusaurus — Docs sites.
- pandoc — Doc conversions.
- pdfgrep — PDF text grep for research.
- TUI viewers (bat, delta) — Better diffs/output for logs.
- semver tool — Version ops.
- dotenv‑cli — Env management.
- fs/mkdirp/rimraf — File ops helpers.
- csvkit — CSV manipulation in research artifacts.
- visidata — TUI data wrangler.
- playwright‑test — Keep E2E stack consistent.
- OSV‑scanner — Dependency vulns.
- hadolint — Dockerfile lint.
- shellcheck — Shell lint.
- ansible (parked) — Heavy; infra automation.
- terraform (parked) — Cloud infra; out of MVP scope.
- open‑api‑generator — Clients/servers from OpenAPI.
- redocly — API docs.
- swagger‑cli — OpenAPI validators.
- axe‑core/pa11y — Accessibility checks.
- cspell — Spell checks for docs.
- markdown‑lint — Markdown hygiene.
- mermaid‑cli — Diagrams in docs.
- plantuml (local) — Diagrams (optional).
- ffmpeg — Media tooling.
- yt‑dlp — Research video pulls (lawful use only).
- tiktoken — Token accounting helpers.
- fast‑xml‑parser — XML → JSON.
- exceljs — XLSX generation for deliverables.
- playwright‑recorder (OSS) — Record flows to code.
- opentelemetry‑collector (local) — Perf experiments.
- mitmproxy — Network capture for automation debug.
- mailhog — Local email sink for app previews.
- minio — S3‑compatible storage for local tests.
- localstack (parked) — AWS emulation; heavy.
- supabase‑studio (optional) — UI for DB.
- sqlite3/duckdb — Embedded DBs for artifacts.
- puppeteer‑cluster — Parallel crawls (careful with bans).
- playwright‑video — Record verification videos.
- openapi‑diff — Spec diffs for API changes.
- verdaccio — Local npm registry (advanced).
- wireit/npm‑scripts — Script orchestration.
- taskfile/just — Task runners as alternatives.

Token & Cost Policy (Summary)
- Estimate token cost per phase; warn at 70% of projected budget.
- Prefer local/OSS when equivalent (OCR, Whisper.cpp) to cut API cost.
- For research breadth, cap pages per domain and deduplicate sources.
- For images, batch requests and cache.

Sub‑Agent Hooks
- Router maps task → chain; orchestrator (GSD) sequences phases.
- CLI runner translates raw output into “Analyzing/Creating/Installing/Preview Ready”.
- File watcher surfaces artifacts as they appear (reports, CSV/JSON, images).

Verification & Artifacts
- Build: PR URL, preview URL, tests green.
- Research: thesis.md + catalog.csv + sources.md.
- Automation: screenshot set + CSV/JSON + pass/fail counts.
- Content/images: markdown + alt‑text + optimized assets.

Limitations & Risks
- Some stacks are heavy; auto‑degrade for low‑capability hosts.
- Community tools vary in quality; use runtime scoring and failover.
- Legal/ethical: obey robots, rate limits, and content rights.
