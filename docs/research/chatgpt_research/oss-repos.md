# OSS Repos to Use — How, Why, Process, Limits

Automation & Research
- Playwright (microsoft/playwright)
  - Why: Deterministic browser control; screenshots/PDF; robust selectors
  - Use: Headless runs; per‑step screenshots; parse logs to friendly statuses
  - Process: Form fill, auth, scraping; verification via artifacts
  - Limits: Heavy deps; anti‑bot; mitigate with curl‑impersonate + backoff
- Browser‑Use
  - Why: High success on messy sites; simple fallback
  - Use: When Playwright blocked; smaller tasks
  - Limits: Less deterministic; structure loss
- Firecrawl
  - Why: Structured extraction; token‑efficient
  - Use: Crawl domains to JSON/CSV + sources; feed summaries downstream
  - Limits: Rate‑limits; normalize output
- trafilatura / readability‑lxml / Cheerio / BeautifulSoup
  - Why: Clean text/DOM parsing; post‑process scrapes
  - Use: Normalize content; reduce token input
  - Limits: Varying accuracy across sites

Code & Scaffolds
- Aider / OpenHands (OSS code agents)
  - Why: Local edits/refactors; fallback when providers throttle
  - Use: Apply diffs from plan; dry‑run patches; commit after QA
  - Limits: Model quality; enforce tests/linters
- Web frameworks: Next.js, Astro, Svelte; APIs: Fastify/Hono
  - Why: Modern defaults; fast scaffolds
  - Use: Scaffold → implement → QA → deploy
  - Limits: Choose one per project
- DB: Prisma + SQLite/DuckDB
  - Why: Simple, testable; migrations
  - Use: Generate client, run migrations, test queries
  - Limits: Large schemas need tuning

QA, Security, Deploy, Obs
- QA: Playwright Test, Jest, Vitest — run gates; parse “compiled successfully”/port ready
- Security: Semgrep, Gitleaks, OSV‑Scanner, ShellCheck, Hadolint — block on secrets/vulns
- Deploy: GitHub Pages (default) or static artifact zip; local preview server fallback
- Observability: OpenTelemetry Collector (sample traces); mitmproxy for flow debug

Images & Media (OSS)
- ComfyUI / InvokeAI / diffusers (Stable Diffusion stack)
  - Why: Local image gen; avoid paid APIs
  - Use: Generate hero/brand art; optimize via ImageMagick/sharp
  - Limits: GPU/CPU heavy; capability profile required

Process Glue
- jq, ripgrep, csvkit, visidata, zx, Taskfile/just, dotenv‑cli — reliable CLI glue for agents

From LLM_LIMITATIONS (real failures to avoid)
- Don’t cram everything into always‑present prompts; move patterns into skills
- Force plan→delegate→verify (orchestrator-only) before any “do” step
- Verify evidence: tests, screenshots, PR checks; treat “success” claims as untrusted until proven
- Token discipline: summarize, dedupe, ground with docs (Context7), and prefer extracted text over HTML dumps
