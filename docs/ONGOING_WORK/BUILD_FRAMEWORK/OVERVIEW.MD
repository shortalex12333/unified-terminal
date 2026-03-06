This is the right framing. Let me map every plugin against your actual architecture (Spine, Conductor, PA, Bodyguard, Workers, Cron, Archivist, Skill Injector) and give you the real breakdown.

---

## THE TRUTH TABLE: What Each Plugin Actually Is

Let me be precise about what's prompt vs. what's code, because that determines your build strategy entirely.

### PROMPT LIBRARIES (editorial work, not engineering)

| Plugin | What It Actually Is | Lines of Real Code | Lines of Prompts | Your Architecture Mapping |
|--------|--------------------|--------------------|-------------------|--------------------------|
| **GSD** | ~15 markdown agent definitions + ~8 workflow orchestrator prompts + ~200 lines of shell/JS glue (`gsd-tools.cjs`) | ~400 | ~8,000+ | **Conductor** (phased DAG) + **Worker** templates (executor, planner, researcher, verifier, debugger) |
| **everything-claude-code** | 14 agents, 28 skills, 30 commands, rules for 6 languages. All markdown with frontmatter. The "code" is an install script and a hooks.json. | ~300 | ~15,000+ | **Skill Library** files (drop in directory, injector discovers) + **Worker** role prompts |
| **claude-code-workflows** | 112 agent .md files, 146 skill .md files, 72 plugin configs. Massive-sounding. It's a folder of text files. | ~200 | ~40,000+ | Same as above but bigger. Cherry-pick 20-30 best ones. |
| **Superpowers** | Structured planning skill + code-reviewer agent + session bootstrap hook. | ~150 (hook scripts) | ~3,000 | **Conductor** planning patterns + **Bodyguard** review patterns |
| **PAUL** | 26 commands, all markdown. PLAN→APPLY→UNIFY loop. State tracking in .paul/ directory. | ~100 (CLI wrapper) | ~5,000 | **Conductor** (iterative mode) + **Archivist** (UNIFY = reconciliation) |
| **CARL** | A Python hook (~200 lines) + a manifest format + domain rule files | ~200 | ~2,000 (rule templates) | **Skill Injector** — this IS your skill injector, just branded differently |
| **ui-ux-pro-max-skill** | CSV databases (styles, colors, fonts, charts) + a Python BM25 search script (~400 lines) + SKILL.md templates | ~500 | ~3,000 | **Skill Library** entry — one file the injector loads when task = frontend |

### ACTUAL CODE (engineering work)

| Plugin | What It Actually Does | Real Code Size | Portability | Your Architecture Mapping |
|--------|----------------------|----------------|-------------|--------------------------|
| **Claude-Flow/Ruflo** | Multi-agent spawning, swarm topologies (hierarchical/mesh), HNSW memory index, token tracking, model routing | ~2,500-3,000 lines TS | Claude Code only (uses Task tool) | **Conductor** (parallel dispatch) + **Context Warden** (token monitoring) + **Memory layer** |
| **Context7** | MCP server that serves library documentation snippets on demand | ~1,000 lines | Universal (MCP) | **Skill Injector** for code tasks — injects real API docs instead of hallucinated ones |
| **Repomix** | Scans repo, applies ignore rules, compresses into single context artifact | ~800 lines | Universal (CLI) | **Spine Agent** helper — creates the codebase snapshot that the Spine reads |
| **Claude-Mem** | PostToolUse hook captures actions → LLM compression → SQLite storage → SessionStart re-injection. Smart Explore with tree-sitter AST parsing. | ~2,000 lines TS | Claude Code only | **Archivist** (capture + compress) + **PA** (re-inject relevant context) |
| **Aider / OpenHands** | Full OSS code agents with their own CLI, model routing, diff application | ~10,000+ lines each | Universal | **Worker** alternatives when provider CLI is unavailable or throttled |

---

## MAPPING TO YOUR NERVOUS SYSTEM

Here's what matters: which of YOUR actors needs what from THESE plugins.

### SPINE AGENT (truth file, no AI, just facts)

**Needs from plugins:** Almost nothing. The Spine is YOUR code — filesystem scan, git status, test results, installed tools. Pure Node.js.

**One thing to steal:** Repomix's ignore-rule logic and size-cap chunking. Don't install Repomix as a dependency — lift the 50 lines of glob/ignore logic and put it in your spine-builder.ts. The Spine needs to know what files exist and their rough structure without reading everything.

**Build cost:** You already have this in your architecture. Repomix logic = 2 hours to extract.

### CONDUCTOR (routes request, produces DAG, re-plans)

**Needs from plugins:** The phased lifecycle pattern from GSD. The parallel dispatch primitives from Claude-Flow. The iterative loop from PAUL.

**What to actually take:**

From GSD — steal the **phase prompt templates** (discuss, plan, execute, verify). These are literally markdown files. The magic isn't in GSD's code; it's in the phrasing: how the discuss-phase prompt forces the agent to ask the RIGHT clarifying questions, how the plan-phase prompt forces task decomposition with dependency ordering, how the verify prompt forces evidence-based checks. Copy those 4-5 prompts. Rewrite in your voice. Done.

From GSD — steal the **state machine concept** (.planning/STATE.md tracks current phase, blockers, decisions). Your Spine already does this. Merge.

From Claude-Flow — steal the **parallel dispatch pattern**: "spawn N agents with different mandates, collect results, merge." The code is ~200 lines of the actual spawn/collect logic. The rest of Claude-Flow is their CLI, their config, their orchestration layer — you don't need any of that because you ARE the orchestration layer.

From PAUL — steal the **UNIFY concept**: after every plan executes, force a reconciliation step. "What was planned? What actually happened? What drifted?" This is a single prompt template. Your Archivist does this at project-end; PAUL does it after every phase. Steal the prompt, apply it at your phase gates.

**Build cost:** 2-3 days. Copy prompts (1 day). Write the parallel dispatch adapter (1 day). Wire the state machine into your Spine (half day).

### PA / MESSENGER (semantic glue between steps)

**Needs from plugins:** Nothing directly. This is YOUR unique actor — no existing plugin does this because they all assume single-runtime, single-agent operation. The PA is the actor that reads "ChatGPT generated a landscape image" and compares it to "the code expects portrait crop" and intervenes.

**What to steal indirectly:** Claude-Mem's **observation compression pattern**. The PA needs to read the last step's output and summarize it in 2-3 sentences for comparison against the next step's expectations. Claude-Mem does exactly this — capture action, compress with LLM, store as compact observation. Lift the compression prompt template (it's a prompt, not code). Skip their SQLite storage — your Spine is the storage.

**Build cost:** 1-2 days. The PA is a prompt + a comparison function. "Here is what step N produced. Here is what step N+1 expects. Do they match? If not, what needs to change?"

### SKILL INJECTOR (reads spine + next step, picks skill, pre-loads worker)

**Needs from plugins:** This IS what CARL does. And it's what ui-ux-pro-max's activation trigger does. And it's what everything-claude-code's skill discovery does.

**The first-principles version:**

```
1. Read Spine → what kind of project, what phase, what task type
2. Read skill directory listing (filenames only, not contents)
3. Match task keywords to skill filenames (regex or simple BM25)
4. Load the ONE matching skill file into the worker's prompt
5. If no match, load nothing — generic worker
```

CARL does step 3 with a Python hook and a manifest file. You can do it with 50 lines of Node.js and a naming convention: `skill-frontend-design.md`, `skill-api-scaffolding.md`, `skill-database-migration.md`. The injector reads filenames, matches against task classification from intake, loads the right one. No manifest needed — the filename IS the manifest.

**From ui-ux-pro-max:** Don't install the whole skill. Extract the CSV databases (styles.csv, colors.csv, typography.csv — ~500KB total) and the BM25 search script (~400 lines Python). Drop into your skill library as `skill-frontend-design/`. When the injector detects a frontend task, it runs the search script with the user's description as query, gets back design system recommendations, and injects those into the worker prompt. The skill stays on disk, never in the system prompt until needed.

**Apple-like default:** Hardcode the search query fallback: if no style keywords from user, default query = `"SaaS premium minimal clean apple whitespace"`. This returns the Apple-like design system every time without asking.

**Build cost:** 1 day for the injector. 1 day to curate the skill library (30-40 files from GSD + everything-claude-code + ui-ux-pro-max). The injector itself is trivial — the editorial curation is the real work.

### WORKER AGENTS (do the actual work)

**Needs from plugins:** The agent role prompts from GSD (executor, planner, researcher, debugger, verifier) and the best skill prompts from everything-claude-code.

**What to actually take — the 30 files that matter:**

From GSD: `gsd-executor.md`, `gsd-planner.md`, `gsd-researcher.md`, `gsd-debugger.md`, `gsd-verifier.md`, `gsd-codebase-mapper.md`. These are the worker archetypes. 6 files.

From everything-claude-code: `tdd-guide.md` (test-driven), `code-reviewer.md` (review), `security-reviewer.md` (security), `doc-updater.md` (docs), `build-error-resolver.md` (debugging). Best-in-class role prompts. 5 files.

From your own architecture: `worker-web-research.md` (ChatGPT browser tasks), `worker-cli-code.md` (local code execution), `worker-image-gen.md` (image tasks via web), `worker-deploy.md` (deploy pipeline). Your specific workers. 4 files.

From ui-ux-pro-max: Not the whole skill — just the design system generation prompt and the search script. 2 files.

From PAUL: The UNIFY reconciliation prompt. 1 file.

**Total: ~18-20 markdown files.** That's your worker library. Not 112 agents, not 146 skills. Twenty files, each doing one thing well.

**The adapter for multi-runtime:**

```typescript
// This is the entire adapter layer
function toNativeAgent(config: AgentConfig, runtime: 'claude' | 'codex' | 'gemini'): string {
  switch (runtime) {
    case 'claude':
      return `---\nname: ${config.name}\ndescription: ${config.description}\ntools: ${config.tools.join(', ')}\nmodel: ${config.model}\n---\n\n${config.prompt}`;
    case 'codex':
      return `# ${config.name}\n\n${config.description}\n\n## Tools Available\n${config.tools.join(', ')}\n\n## Instructions\n${config.prompt}`;
    case 'gemini':
      return `# Agent: ${config.name}\n\n${config.prompt}\n\nAvailable tools: ${config.tools.join(', ')}`;
  }
}
```

That's it. Different frontmatter. Same prompt body. The adapter is 15 lines of code.

### BODYGUARD (phase gate, binary pass/fail)

**Needs from plugins:** The verification-integrity skill (from your skills-analysis docs) and the docker-local-first skill.

**What to steal:** Two prompt templates:

1. **verification-integrity prompt:** "Here are the test results. Did the tests ACTUALLY run? (check: are there test files? did the runner execute? is the output real or empty?) Did the build ACTUALLY succeed? (check: is there a dist/ folder? does the entry point resolve? are there error strings in stdout?)"

2. **docker-local-first prompt:** "Before pushing, verify locally: does the container build? does the app start? can you hit the health endpoint?"

These are prompts. The Bodyguard's code is YOUR code — it runs the checks (filesystem inspection, process spawning, HTTP calls) and returns binary pass/fail. The prompts just tell it what to check.

**Build cost:** Already in your architecture. Extract the two prompt templates from your skills-analysis docs. 2 hours.

### CONTEXT WARDEN (cron-triggered, monitors tokens, hard kills)

**Needs from plugins:** Claude-Flow's token tracking logic. That's it.

**First principles:** Every LLM API response includes `usage: { input_tokens, output_tokens }`. Sum them per agent. When sum > threshold, kill and respawn. The threshold is: `model_context_window * 0.6` (because accuracy degrades past 60% as the research shows).

For Claude Code CLI specifically, the `context_window.remaining_percentage` field is available via statusline hooks. For Codex, you count tokens from API responses. For Gemini, same.

**The code:**

```typescript
class ContextWarden {
  private tokenCounts: Map<string, number> = new Map();
  private threshold: number;
  
  constructor(modelContextWindow: number) {
    this.threshold = modelContextWindow * 0.6;
  }
  
  record(agentId: string, tokens: number) {
    const current = this.tokenCounts.get(agentId) || 0;
    this.tokenCounts.set(agentId, current + tokens);
    if (current + tokens > this.threshold) {
      this.killAndRespawn(agentId);
    }
  }
  
  private killAndRespawn(agentId: string) {
    // Kill current process
    // Read last state from Spine
    // Spawn fresh agent with summary of progress so far
    // Reset token counter
  }
}
```

That's Claude-Flow's token budgeting reduced to 20 lines. You don't need their HNSW index, their swarm topologies, their config system. You need a counter and a threshold.

**Build cost:** Half a day.

### ARCHIVIST (runs once at project completion)

**Needs from plugins:** Claude-Mem's compression pattern. PAUL's UNIFY prompt.

**What to steal:** One prompt template:

"Read the project spine, the execution log, the test results, and the deployed URL. Produce a summary containing: tech stack, pages/features built, database schema, deployment location, auth method, design decisions, known issues. Format as structured markdown. This summary will be used to onboard a future agent who needs to modify this project."

That's the Archivist's entire soul. The "code" is: read files, pass to LLM with this prompt, save output as `PROJECT-ARCHIVE.md`. The GSD-to-PAUL handoff happens here — when the user returns, the PA reads this archive instead of scanning the codebase.

**llms.txt generation lives here too.** After the archive is written, the Archivist also generates llms.txt from the same data. Different format, same source content:

```
# {project_name}
> {one-line description from intake}

## About
{what the business does, from intake answers}

## Pages
{list of routes/pages built}

## Contact
{from intake if provided}

## Tech
Built with {stack}. Deployed at {url}.
```

Zero extra LLM calls. Template from archive data.

**Build cost:** 1 day.

---

## THE FINAL "WHAT TO KEEP" LIST

### Install as dependencies (real code, maintained externally)

| Tool | Why Keep | Install Method |
|------|----------|---------------|
| **Context7 MCP** | Live docs grounding. Prevents hallucinated APIs. You can't replicate their documentation index. | MCP server |
| **Playwright** | Browser automation. Industrial. Don't rebuild. | npm |
| **Vitest** | Your locked test runner. | npm |
| **ESLint + Prettier** (with eslint-config-prettier) | Your locked linting. | npm |
| **Semgrep + Gitleaks** | Security. Don't rebuild. | CLI install |
| **Repomix** | Context prep for existing codebases. Small, standalone. | npm (or lift 50 lines) |
| **Sharp** | Image optimization. Native binary, don't rebuild. | npm |

### Absorb into your codebase (steal the prompts, own the code)

| Source | What to Take | Maps to Your Actor |
|--------|-------------|-------------------|
| GSD | 5 phase prompt templates + state machine pattern | Conductor |
| GSD | 6 agent role prompts (executor, planner, researcher, debugger, verifier, mapper) | Worker library |
| everything-claude-code | 5 best skill prompts (TDD, code-review, security-review, docs, build-error) | Worker library |
| PAUL | UNIFY reconciliation prompt | Archivist |
| CARL | The concept (not the code) — keyword→skill matching | Skill Injector (your 50-line Node.js version) |
| Claude-Flow | Token counting + threshold kill pattern (20 lines) | Context Warden |
| Claude-Mem | Observation compression prompt template | PA / Archivist |
| ui-ux-pro-max | CSV databases + BM25 search script (~400 lines Python) | Skill Library entry + Apple-like default query |
| verification-integrity | Two verification prompt templates | Bodyguard |

### Delete / never install

| Tool | Why |
|------|-----|
| Jest | Vitest wins. |
| Cypress | Playwright Test wins. |
| Netlify CLI | Vercel wins. |
| PAUL (as a separate install) | Absorbed into your Conductor's iterative mode. |
| CARL (as a separate install) | You ARE the context management layer. |
| Claude-Mem (as a separate install) | Absorbed into your Archivist + PA. |
| Claude-Flow (as a separate install) | 20 lines of your Context Warden replaces it. |
| Superpowers | GSD's prompts are better and you're already taking those. |
| CodexBar | Menu bar nicety. You ARE the menu bar app. |
| Obsidian skills | Wrong ecosystem. |
| CrewAI / LangGraph | You don't need a second orchestration framework. Your Conductor IS the orchestrator. |

---

## BUILD ORDER

```
Day 1: Skill Library curation
  - Copy 18-20 markdown files from GSD + everything-claude-code + PAUL
  - Rewrite in your voice
  - Organize: /skills/workers/, /skills/phases/, /skills/verification/
  - Add skill-frontend-design/ with ui-ux-pro-max CSVs + search script
  - Add llms-txt-template.md

Day 2: Skill Injector + Adapter
  - 50 lines: read skill directory, match to task type, load into worker prompt
  - 15 lines: adapter function (AgentConfig → claude/codex/gemini native format)
  - Apple-like default query hardcoded

Day 3: Context Warden + Bodyguard
  - 20 lines: token counter + threshold kill
  - 2 prompt templates: verification-integrity, docker-local-first
  - Wire to cron layer (setInterval, not agent)

Day 4: Conductor phase logic
  - GSD's discuss→plan→execute→verify as a state machine
  - PAUL's iterative mode as alternate path
  - Gate at intake: new project → GSD mode, existing → PAUL mode
  - Parallel dispatch: spawn N workers, collect, merge

Day 5: PA + Archivist
  - PA prompt: compare step N output to step N+1 expectations
  - Archivist prompt: produce PROJECT-ARCHIVE.md + llms.txt
  - GSD→PAUL handoff via archive document
```

Five days to absorb the entire plugin ecosystem into your own architecture. After that, you own every line. No upstream breaking changes. No runtime lock-in. No installing 110 tools on first launch.

The 7 external dependencies you keep (Context7, Playwright, Vitest, ESLint/Prettier, Semgrep, Gitleaks, Sharp) are all real code tools that do things you genuinely can't replicate with prompts. Everything else was always just text files with good marketing.