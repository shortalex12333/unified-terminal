# Domain C: Research & Extraction

## What This Domain Covers
Gathering external information: market research, competitor analysis, API documentation, web scraping, data extraction. Grounds LLM output in real data instead of hallucination.

## Actors
| Actor | Role | Rail |
|-------|------|------|
| Worker (researcher) | gsd-researcher.md prompt. Gathers evidence, cites sources, structured output. | SOFT |
| PA / Messenger | Compares research output format to what code agent expects. Flags mismatches. | SOFT |
| Intake | Captures research scope, target audience, depth requirement before spawning. | SOFT |

---

## External Tools Kept

| Tool | What It Does | Why Keep | Fallback Order |
|------|-------------|----------|---------------|
| Context7 MCP | Returns real API signatures on demand | Cannot replicate their documentation index | Primary for API docs |
| Firecrawl | Structured web extraction to JSON/CSV | Token-efficient vs naive browsing. Handles pagination. | Primary scraper |
| Playwright MCP | Browser automation for JS-rendered sites | Auth flows, screenshots, JS-heavy SPAs | Secondary scraper |
| Browser-Use | Anti-detect browsing, CAPTCHA solving | Fallback when Playwright blocked by anti-bot | Tertiary scraper |
| trafilatura | Clean text extraction from raw HTML | Normalizes HTML before feeding to LLM. Removes nav, ads, boilerplate. | HTML cleaner |
| Web Search MCP | Broad web discovery | Fact-checking, general research. Deduplicate with ChatGPT native browsing. | Primary search |
| Repomix | Compresses repo into single context artifact | For existing codebase analysis. Applies ignore rules, respects gitignore. | Codebase grounding |

---

## Fallback Chains

```
Web scraping:  Firecrawl --> Playwright MCP --> Browser-Use --> manual
API docs:      Context7 MCP --> Repomix snapshot --> raw file read
Search:        Web Search MCP --> ChatGPT native browsing (deduplicate)
HTML cleaning: trafilatura --> custom regex strip --> raw HTML (last resort)
```

**Critical constraint:** Playwright and Browser-Use are NEVER concurrent on user machines. Both are memory-hungry (~500MB each). Sequential fallback only.

---

## Absorbed Prompts

### From GSD
**gsd-researcher.md**
What it is: Research agent prompt. Forces: define research question > identify source types > gather evidence > cite everything > produce structured output.
What we took: The structured output format (claims with citations) and the source-type hierarchy (primary docs > official blogs > news > forums > reddit).
What we changed: Added our output format requirements (must produce CSV or JSON, not just prose).
Location: `/skills/workers/gsd-researcher.md`

### From GSD
**gsd-codebase-mapper.md**
What it is: Prompt for analyzing existing codebases. Maps: file structure, entry points, dependency graph, test coverage, tech stack.
What we took: The mapping methodology (start from package.json/requirements.txt, trace imports, identify patterns).
What we changed: Made it produce Spine-compatible output (same format as Spine truth file).
Location: `/skills/workers/gsd-codebase-mapper.md`

---

## Hard Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| Source citation | Research output must contain URLs. Regex: at least 1 `http(s)://` per factual claim. | SEND BACK. Worker re-does with citations. |
| Output format | Research step must produce file (CSV/JSON/markdown). `fs.existsSync()` check. | BLOCK. No ephemeral research. |
| Token budget | Research agents are token-hungry. Context Warden monitors. Kill at threshold. | KILL and respawn with narrower scope. |

## Soft Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| Source quality | LLM evaluates: primary (docs, SEC) vs secondary (blogs) vs tertiary (forums) | WARN. Flag if all sources are forums/Reddit. |
| Deduplication | LLM checks if same fact gathered from multiple searches | WARN. Token waste detected. |
| Scope adherence | LLM checks if research answers the original question or drifted | ADJUST. PA narrows next research step. |
