# Market Research Mandate — 100 Open‑Source Plugins (Senior‑Level)

Mission
- Compile a credible, ranked catalog of 100+ open‑source, free plugins/tools relevant to our Electron desktop app that wraps CLI AI tools for non‑technical users.
- Focus on enabling: ChatGPT interface (image gen, web search, market research), and local CLI for autonomous creation (code, automation, orchestration).
- Produce a 4,000+ word thesis with explicit rationale, usage scenarios, limitations, and cost/compute implications.

Primary Sources (evidence‑first)
- GitHub (repos, stars, issues, releases, license)
- Reddit (community feedback; r/LocalLLaMA, r/MachineLearning, r/Artificial, r/opensource)
- Instagram (light signals; dev / AI accounts — link posts sparingly; prefer GitHub data)
- Bonus: Hacker News, Product Hunt, vendor docs, RFCs, MCP specs

Strict Inclusion Criteria
- Open source, free to use
- Active maintenance (commits/releases in last 12–18 months)
- Clear license (MIT/Apache/BSD/GPL et al.)
- Demonstrable value for: research, automation, orchestration, coding, content, images, connectors, testing, deployment, security, or observability

Each Plugin Record (schema)
- name
- category (one of: orchestration, code, automation, research, connectors, content, images, testing, deploy, security, observability, mcp‑server)
- repo_url
- license, stars, last_commit, latest_release
- maturity_score (0–5)
- reliability_score (0–5)
- integration_cost (low/med/high)
- efficiency_notes (runtime, token overhead)
- model_fit (codex | claude‑code | gemini | any)
- mcp (yes/no; details)
- use_cases (3–5 concrete scenarios)
- limitations (bulleted, frank)
- conflicts (known incompatibilities, OS quirks)
- references (links: issues, docs, notable threads)

Ranking Method (explain in output)
- Weighted score: reliability 1.2, maintenance 1.0, coverage 1.0, integration 1.1, security 1.1, performance 1.0, UX 1.1
- Admission threshold ≥ 3.8 weighted; include 100+ that pass, and optionally 10–20 “watchlist” below threshold

Deliverables (write to docs/research/plugins/)
- 100-plugins-thesis.md — 4,000+ words; ranked list with deep analysis and top 20 expanded case studies
- catalog.csv — flat CSV with the full schema
- catalog.json — JSON array with the full schema
- methodology.md — assumptions, scoring, search queries, limitations
- sources.md — raw links grouped by plugin, plus general sources
- index.md — executive summary, “why this matters”, and prioritized action items for population v1.1
- zip bundle: research-plugins-bundle.zip containing all above

Must Include (application‑level guidance)
- What is a “good” plugin for our thesis; why
- Application by model (Codex CLI, Claude Code, Gemini CLI) and by task (build_product, research, automate, content+images)
- Token budget policy and model routing suggestions per plugin
- Sub‑agent hooks (where in our flow this plugin activates; invisible triggers)
- Direction on documents/artifacts each plugin tends to produce (reports, CSV/JSON, code, PRs)

How to Work
- Use web search extensively; gather GitHub signals (stars, issues, activity); link to sources
- Prefer credibility over hype; call out known failure modes and maintenance risks
- Be opinionated; if two are close, pick one and explain the trade‑offs
- Summarize “best principles” and “must‑haves per task” at the top of index.md

Output Conventions
- Markdown files must be readable standalone
- Use tables for scorecards and matrices; keep columns machine‑friendly
- Keep all relative paths under docs/research/plugins/

