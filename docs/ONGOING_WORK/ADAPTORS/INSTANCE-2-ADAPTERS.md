# INSTANCE 2: RUNTIME ADAPTERS

## Identity

You are building the adapter layer. But adapters do not exist in a vacuum. Every adapter feature exists because a SPECIFIC absorbed plugin demands it. If you cannot name which plugin needs a feature, that feature does not belong.

This document starts from the plugins, traces what each requires from a runtime, and THEN specifies how each adapter fulfills those requirements. Plumbing follows purpose.

Instance 1 (Gateway) already has patterns: `codex-adapter.ts`, `chatgpt-adapter.ts`, `cli-executor.ts`, `web-executor.ts`. You extend and formalize these into a universal contract. Instance 3 (Dissection) will produce the 22 prompt files that flow THROUGH these adapters.

---

## What You Must Read First

1. `ADAPTERS.md` -- Full adapter spec. AgentConfig/AgentResult interfaces, per-runtime commands, output parsing, session management.
2. `DOMAIN-A-ORCHESTRATION.md` -- What we took from each plugin. Routing rules. Phase flow.
3. `DOMAIN-B-CODE-QUALITY.md` -- Verification prompts, tool requirements, ENFORCER.json schema.
4. `DOMAIN-C-RESEARCH.md` -- Research tools, fallback chains, web executor needs.
5. `DOMAIN-D-FRONTEND.md` -- Frontend design system, CSV payload injection, image generation routing.
6. `AGENT-TOPOLOGY-MVP.md` -- Which workers run on which runtime.
7. Instance 1 existing adapter files in `src/main/`.

---

## SECTION 1: THE PLUGINS AND WHAT THEY DEMAND

Every adapter feature traces to a real plugin requirement. Here is the complete map.

### Plugin Group 1: GSD Workers (6 prompts, from gsd-build/get-shit-done)

**gsd-executor.md -- The Build Worker**
- Purpose: Receives a mandate ("create the homepage with hero section, nav, footer"), executes it by writing code, running commands, producing files.
- Why we need it: This is the hands that build. Without it, nothing gets created.
- Tool permissions needed: `read`, `write`, `bash` (full access -- it must create files, run npm commands, modify configs)
- Input: Skill-injected prompt (400-800 tokens) + Spine state (current project files, test status) + step mandate from DAG
- Output: Files created/modified. Must declare which files it touched for scope enforcement.
- Preferred runtime: Codex CLI (`--full-auto --json` gives structured output with file list) or Claude Code (agent file with write permissions)
- Adapter requirement: **Spawn with tool permissions.** Codex uses `--allowed-tools`, Claude uses `settings.json allowedTools`, Gemini uses CLI flags. Adapter must translate generic `["read","write","bash"]` to runtime-specific format.
- Adapter requirement: **Parse file list from output.** Codex JSON includes `files_modified`. Claude stdout must be parsed. Gemini requires git diff fallback.
- Adapter requirement: **Working directory isolation.** Must set `-C {workingDir}` so executor works in project folder, not system root.
- Test: Spawn executor with mandate "create file hello.txt with content hello world." Verify: file exists, AgentResult.filesCreated includes hello.txt, exit code 0.

**gsd-planner.md -- The Decomposition Worker**
- Purpose: Takes a goal ("build candle store with payments"), breaks into ordered tasks with dependencies, file declarations, acceptance criteria.
- Why we need it: The Conductor needs a DAG. The planner produces it.
- Tool permissions needed: `read` ONLY. Planner reads codebase to understand existing structure. It does NOT write code.
- Input: User requirements from Intake + Spine state (existing files, tech stack detected)
- Output: JSON DAG. Array of steps, each with: task description, declared files, dependencies, acceptance criteria.
- Preferred runtime: Any CLI. Planning is model-quality-sensitive, not tool-sensitive.
- Adapter requirement: **Read-only tool enforcement.** Planner must NOT be given write access. If Codex, omit `write` from `--allowed-tools`. If Claude, exclude `Write` from settings.json. A planner that writes code has violated its mandate.
- Adapter requirement: **Structured JSON output.** Planner output must be parseable JSON, not prose. Adapter must validate JSON shape or flag parse failure.
- Test: Spawn planner with goal "add contact form." Verify: output is valid JSON, contains at least 2 steps, each step has declaredFiles array.

**gsd-researcher.md -- The Evidence Gatherer**
- Purpose: Gathers market data, competitor analysis, API documentation, pricing info. Cites sources. Produces structured report.
- Why we need it: Hybrid projects need research BEFORE code. "Build me a SaaS" requires market research, pricing model, competitor features.
- Tool permissions needed: `web_search`, `browse` (web access is primary need -- NO file write)
- Input: Research question + scope constraints + required output format
- Output: Structured report (markdown or CSV) with citations (URLs required).
- Preferred runtime: **ChatGPT Web** (native browsing, DALL-E for visual research) or any CLI with web search tool.
- Adapter requirement: **Web executor support.** This is WHY the ChatGPT BrowserView adapter exists. Research agents need web browsing, not filesystem access. The adapter must inject the research prompt, capture the response including any links/images, and extract structured data.
- Adapter requirement: **Response extraction handles long output.** Research responses can be 2000+ words. Adapter must capture the FULL response, not truncate.
- Adapter requirement: **Multi-turn conversation.** Research often requires follow-up: "Now compare pricing of the top 3." Adapter must maintain conversation context for ChatGPT web, or include prior output in next CLI spawn.
- Test: Spawn researcher with question "What are the top 3 website builders by pricing?" Verify: output contains at least 3 URLs, structured sections, over 500 words.

**gsd-debugger.md -- The Error Investigator**
- Purpose: Takes a failing test or build error, follows structured investigation: reproduce, isolate, hypothesize, test, fix, verify.
- Why we need it: When Bodyguard detects a failure, Conductor dispatches debugger instead of having the executor guess.
- Tool permissions needed: `read`, `bash` (must run tests, read logs, check state), `write` (to apply fix)
- Input: Error output from previous step + relevant source files + test output
- Output: Fixed code + explanation of root cause + lesson template filled.
- Preferred runtime: Codex CLI or Claude Code (need full filesystem access to investigate)
- Adapter requirement: **Pass previous step output as context.** Debugger needs the error message, stack trace, and relevant file contents. Adapter must support injecting prior AgentResult.output into the new agent's context.
- Adapter requirement: **Large prompt payload.** Debugger prompt + error output + file contents can exceed 4000 tokens. Adapter must handle prompts piped via stdin (not CLI arg) for Codex. Claude handles via agent file body.
- Test: Create a deliberately failing test. Spawn debugger with error output. Verify: test passes after debugger runs.

**gsd-verifier.md -- The Post-Execution Checker**
- Purpose: Reviews completed work against original requirements. Did the executor build what was asked?
- Why we need it: This is the SOFT rail complement to Bodyguard's hard rails. Bodyguard checks "did files get created?" Verifier checks "did the RIGHT files get created with the RIGHT content?"
- Tool permissions needed: `read`, `bash` (run tests, check output, compare) -- NO `write`
- Input: Original mandate from DAG step + executor's output + current file state
- Output: PASS/FAIL with specific reasons. If FAIL, what exactly is wrong.
- Preferred runtime: Any CLI.
- Adapter requirement: **Read-only enforcement.** Same as planner. Verifier that modifies files has corrupted the verification.
- Adapter requirement: **Dual-input context.** Verifier needs BOTH the original mandate AND the executor's result. Adapter must combine these into a single prompt payload.
- Test: Spawn executor, then spawn verifier with executor's result + original mandate. Verify: verifier output is parseable PASS/FAIL.

**gsd-codebase-mapper.md -- The Repo Analyzer**
- Purpose: Maps an existing codebase: file structure, entry points, dependencies, test coverage, tech stack detection.
- Why we need it: When user says "edit my existing site," we need to understand the codebase before planning changes. This feeds the Spine.
- Tool permissions needed: `read`, `bash` (run `find`, `grep`, `cat package.json`, etc.) -- NO `write`
- Input: Working directory path.
- Output: Spine-compatible JSON: file tree, dependencies, tech stack, test coverage stats.
- Preferred runtime: Any CLI.
- Adapter requirement: **Read-only + bash for analysis commands.** Must not modify anything.
- Test: Point at a real project directory. Verify: output is JSON with fileTree, dependencies, techStack fields.

---

### Plugin Group 2: everything-claude-code Skills (5 prompts, from affaan-m/everything-claude-code)

**tdd-guide.md -- Test-Driven Development Workflow**
- Purpose: Enforces write-test-first discipline. Sequence: write test > run test (MUST FAIL) > write implementation > run test (MUST PASS) > refactor.
- Why we need it: TDD catches bugs at creation time. Without enforcement, agents skip tests and write code directly. This is the most common LLM failure mode.
- Tool permissions needed: `read`, `write`, `bash` (creates test files AND implementation files, runs test commands)
- Input: Feature requirement + target file paths
- Output: Test file + implementation file + test results showing red-green cycle.
- Preferred runtime: Codex CLI (best at following structured coding workflows)
- Adapter requirement: **Sequential command execution visibility.** TDD requires running tests TWICE (once to fail, once to pass). Adapter must capture intermediate test output, not just final result.
- Adapter requirement: **File creation ordering matters.** Test file must exist before implementation file. This is checkable by timestamp. Adapter must preserve creation timestamps in AgentResult.
- Test: Spawn with "add a multiply(a,b) function with tests." Verify: test file created BEFORE implementation file. Tests pass.

**code-reviewer.md -- Quality Review Agent**
- Purpose: Reviews generated code against standards. Checks: naming, error handling, edge cases, performance, security basics.
- Why we need it: Executor writes code fast. Reviewer catches what it missed. This is the "second pair of eyes" that single-agent systems lack.
- Tool permissions needed: `read` ONLY. **Reviewer must NEVER have write access.** A reviewer that "fixes" code has violated separation of concerns. It reports, it does not modify.
- Input: Files to review (from executor's output) + review criteria
- Output: Structured review: per-file findings, severity (BLOCK/WARN/INFO), specific line references.
- Preferred runtime: Any CLI. Model quality matters more than runtime.
- Adapter requirement: **Strict read-only tool enforcement.** This is the critical test: can the adapter DENY write access even though the underlying runtime supports it? Codex: omit write from --allowed-tools. Claude: exclude Write from settings.json. Gemini: omit write flags.
- Adapter requirement: **Structured output parsing.** Review output must be parseable (JSON or structured markdown) so Bodyguard can extract BLOCK/WARN counts.
- Test: Spawn reviewer on a file with a known issue (unused variable, missing error handling). Verify: reviewer flags the issue. Verify: reviewer did NOT modify any files (git status clean).

**security-reviewer.md -- Vulnerability Scanner (LLM Layer)**
- Purpose: Complements Semgrep (AST-level). Checks LOGIC-level security: auth bypass paths, business logic flaws, unsafe data flows that static analysis misses.
- Why we need it: Semgrep catches `eval(user_input)`. Security reviewer catches "the admin endpoint has no auth check" -- a logic gap, not a code pattern.
- Tool permissions needed: `read` ONLY. Same strict enforcement as code-reviewer.
- Input: Files to review + known auth patterns + API endpoint list
- Output: Vulnerability report: severity (CRITICAL/HIGH/MEDIUM/LOW), affected files, remediation.
- Preferred runtime: Any CLI.
- Adapter requirement: Same read-only enforcement as code-reviewer.
- Test: Create endpoint without auth check. Spawn reviewer. Verify: flags the missing auth.

**build-error-resolver.md -- Structured Diagnosis**
- Purpose: When build fails, follows: read FULL error > identify root cause > check dependency vs code issue > fix root not symptom.
- Why we need it: Executors that encounter build errors loop: try fix > fail > try different fix > fail > context exhausted. Resolver follows a diagnostic tree instead of guessing.
- Tool permissions needed: `read`, `bash` (run diagnostic commands, check versions, read logs), `write` (apply fix)
- Input: Build error output + package.json + relevant config files
- Output: Root cause analysis + fix applied + verification that fix worked.
- Preferred runtime: Codex CLI or Claude Code.
- Adapter requirement: **Error output passthrough.** Must pass raw error text (potentially 500+ lines of stack trace) into the agent context without truncation.
- Test: Introduce a deliberate dependency version conflict. Spawn resolver. Verify: identifies the conflict, applies fix, build succeeds.

**doc-updater.md -- Documentation Maintenance**
- Purpose: After code changes, updates relevant documentation (README, API docs, inline comments).
- Why we need it: Agents write code but leave docs stale. This runs after executor and updates docs to match new reality.
- Tool permissions needed: `read`, `write` (but ONLY documentation files -- not source code)
- Input: List of changed files from executor + existing docs
- Output: Updated documentation files.
- Preferred runtime: Any CLI.
- Adapter requirement: **Scoped write permissions.** Must allow writing to .md, .txt, docs/ but NOT to .ts, .js, .py source files. This is a more granular permission than "write/no-write" -- it is file-type-scoped write.
- Adapter requirement: Each runtime handles this differently. Codex: `--allowed-tools` cannot scope by file type, so this becomes a Bodyguard scope-enforcement check AFTER execution. Claude: same limitation. This means the adapter cannot enforce this at spawn time -- it must be a post-execution hard rail.
- Test: Spawn after a code change. Verify: docs updated. Verify: no source files modified.

---

### Plugin Group 3: Phase Prompts (5 from GSD + 1 from PAUL)

**discuss.md, plan.md, execute.md, verify.md, debug.md -- GSD Phases**
- Purpose: These are NOT worker prompts. They are CONDUCTOR prompts that structure the entire project lifecycle.
- Why we need them: Without phases, the system is "dump everything into one agent." Phases force: ask questions first, plan before coding, verify after coding, debug when broken.
- Tool permissions: Varies by phase. discuss = web (conversation with user). plan = read. execute = dispatches workers (does not execute itself). verify = read+bash. debug = read+bash+write.
- Preferred runtime: Conductor runs as persistent Codex session (longest-lived agent). Phase prompts are loaded INTO the Conductor's context at phase transitions.
- Adapter requirement: **Session persistence.** The Conductor is NOT a short-lived worker. It persists across the entire project. Codex: `codex resume <sessionId>`. Claude: `claude resume <id>`. Gemini: CANNOT do this (no session resume) -- Gemini is NOT suitable for the Conductor role.
- Adapter requirement: **Phase prompt injection into existing session.** At each phase transition, the adapter must inject the new phase prompt into the persistent session, not spawn a new agent. This is fundamentally different from worker spawning.
- Test: Spawn Conductor session. Inject discuss phase. Get output. Inject plan phase into SAME session. Verify: session maintains context from discuss phase.

**unify.md -- PAUL Reconciliation**
- Purpose: After every phase: PLANNED | ACTUAL | DELTA. Forces comparison of what was supposed to happen vs what actually happened.
- Why we need it: Drift detection. Step 3 was supposed to produce a payment page. It produced a contact page instead. UNIFY catches this before step 4 builds on the wrong foundation.
- Tool permissions: `read` only. UNIFY reads the plan and the results. It does not modify anything.
- Input: TWO separate documents: the original plan for this phase + the actual results from execution.
- Output: Three-column comparison table + drift assessment + recommendation (proceed/re-plan/stop).
- Preferred runtime: Any CLI.
- Adapter requirement: **Dual-document input.** This is NOT a single-string prompt. UNIFY needs two clearly separated inputs. The adapter must structure the prompt with clear delimiters: `## PLANNED\n{plan}\n## ACTUAL\n{results}\n## YOUR ANALYSIS`. This is a prompt-construction requirement that the adapter handles at spawn time.
- Test: Provide plan ("create 3 pages") and result ("created 2 pages"). Verify: UNIFY flags the discrepancy.

---

### Plugin Group 4: Frontend Design (from ui-ux-pro-max-skill)

**skill-frontend-design + CSV data + BM25 search**
- Purpose: Injects design intelligence into frontend workers. Without this, LLMs produce Bootstrap 2019 UIs. With it, they produce design-system-consistent output matching specified aesthetics.
- Why we need it: UI quality is the most visible differentiator. Users SEE the output. Generic AI UIs look generic. Injected design systems look intentional.
- Tool permissions: Same as executor (`read`, `write`, `bash`) -- this is a skill OVERLAY on the executor, not a separate agent.
- Input: The skill prompt (~400 tokens) + matched design system data from CSV (~500-2000 tokens of matched results from BM25 search) + the actual task mandate
- Output: Code that follows the injected design tokens (colors, typography, spacing, component patterns).
- Preferred runtime: Codex CLI or Claude Code (need filesystem to write UI code).
- Adapter requirement: **Large context payload.** Executor prompt (400 tokens) + skill overlay (400 tokens) + CSV design data (500-2000 tokens) + Spine state (200 tokens) = up to 3000 tokens BEFORE the agent starts working. Adapter must handle prompts that are 3000+ tokens. For Codex: stdin pipe, not CLI arg (CLI arg limit ~4096 chars). For Claude: agent file body handles this naturally. For Gemini: must verify input token limit.
- Adapter requirement: **Skill injection is prompt concatenation.** The adapter receives an AgentConfig where `prompt` is ALREADY the concatenated result (base prompt + skill + CSV data). The adapter does not do the injection -- that is the Skill Injector's job upstream. But the adapter must handle the resulting large payload.
- Test: Spawn executor with design-system-injected prompt (3000+ tokens). Verify: execution completes without truncation errors. Verify: output HTML/CSS references design tokens from injected data.

---

### Plugin Group 5: Custom Workers (our architecture)

**worker-image-gen.md -- DALL-E Router**
- Purpose: Routes image generation requests to ChatGPT (DALL-E). Hero images, logos, product photos, backgrounds.
- Why we need it: User says "build candle store." Store needs product images, hero banner, logo. This agent generates them via ChatGPT's DALL-E.
- Tool permissions: Web-only. This agent runs EXCLUSIVELY on ChatGPT web.
- Input: Image description + style preferences (from design system) + dimensions
- Output: Image file(s). Binary content.
- Preferred runtime: ChatGPT Web ONLY.
- Adapter requirement: **Binary content extraction.** ChatGPT web adapter must detect image responses in the DOM, download them, save to project directory. This is NOT text output parsing -- it is file download from the BrowserView.
- Adapter requirement: **Image element detection.** DALL-E images appear as `<img>` elements with specific data attributes. MutationObserver must watch for image elements, not just text nodes.
- Test: Prompt "generate a hero image of artisan candles on a wooden table." Verify: image file saved to project directory. Verify: file is valid image (PNG/JPEG, > 10KB).

**worker-deploy.md -- Deployment Agent**
- Purpose: Handles build > test > deploy > verify sequence. Knows Vercel CLI commands, GH Pages workflow.
- Why we need it: Deployment is the final step. Getting from "code works locally" to "live on the internet."
- Tool permissions: `read`, `bash` (run build commands, deploy commands, curl health checks), `write` (config files for deploy)
- Input: Build output directory + deploy target (Vercel/GH Pages) + any required tokens
- Output: Deployed URL + health check result.
- Preferred runtime: Codex CLI (needs bash for deploy commands).
- Adapter requirement: **Environment variable passthrough.** Deploy needs VERCEL_TOKEN or GH_TOKEN. Adapter must pass env vars to the spawned process without logging them (security).
- Adapter requirement: **Service account detection.** Before spawning, adapter checks: is the required service account connected? If not, returns clear error instead of letting the agent fail.
- Test: Build a static site. Spawn deploy agent. Verify: returns a URL. Verify: curl URL returns 200.

**worker-web-research.md -- Web Research Agent**
- Purpose: Broader than gsd-researcher. Handles: market research, competitor analysis, content gathering, fact-checking.
- Why we need it: Researcher is ChatGPT-native. Uses browsing, not CLI file access.
- Adapter requirement: Same as gsd-researcher. Long response capture, multi-turn support.

**worker-scaffold.md -- Project Bootstrapper**
- Purpose: Creates initial project structure: package.json, folder structure, base configs, git init.
- Tool permissions: `write`, `bash` (npm init, git init, mkdir)
- Adapter requirement: **Working directory creation.** Scaffold may need to create the working directory itself. Adapter must handle case where workingDir does not yet exist.

---

### Plugin Group 6: Observation/Memory (from Claude-Mem)

**Observation compression (absorbed into PA prompt)**
- Purpose: Compresses step output into 2-3 sentence summary for handoff between steps. Preserves: what changed, what was produced, what next step needs.
- Why we need it: Without compression, each step's full output (potentially 2000+ tokens) passes to the next. At step 8 of a 12-step build, context is exhausted. Compression keeps handoffs to ~100 tokens.
- Tool permissions: None. This runs WITHIN the PA agent, not as a separate spawn.
- Adapter requirement: **Not a separate spawn.** This is embedded in the PA's prompt. The adapter must support prompts that include instructions to "summarize the following output" as part of the PA comparison task. No special adapter handling -- just normal prompt execution. But the adapter must NOT truncate the input (which includes the full previous-step output that needs compressing).

---

## SECTION 2: ADAPTER REQUIREMENTS DERIVED FROM PLUGINS

Every feature below traces to a specific plugin need documented above.

### Requirement 1: Tool Permission Mapping
**Required by:** ALL plugins (each has different permission needs)
**The problem:** Each runtime expresses tool permissions differently.

```typescript
// Generic tool names used in AgentConfig
type GenericTool = "read" | "write" | "bash" | "web_search" | "edit";

// Runtime-specific translations
const CODEX_TOOLS: Record<GenericTool, string> = {
  read: "read", write: "write", bash: "bash",
  web_search: "web_search", edit: "edit",
};

const CLAUDE_TOOLS: Record<GenericTool, string> = {
  read: "Read", write: "Write", bash: "Bash",
  web_search: "WebSearch", edit: "Edit",
};

const GEMINI_TOOLS: Record<GenericTool, string> = {
  read: "read_file", write: "write_file", bash: "run_command",
  web_search: "google_search", edit: "edit_file",
};
```

**Critical test:** Spawn code-reviewer with `tools: ["read"]`. Verify it CANNOT write files. This is the read-only enforcement that code-reviewer and security-reviewer and verifier and planner all depend on.

### Requirement 2: Session Persistence (vs Fresh Spawn)
**Required by:** Conductor (phase prompts), gsd-planner (multi-step planning)
**NOT needed by:** Workers (short-lived, task-scoped)

The Conductor persists across the entire project. Workers spawn fresh per step.

```typescript
interface AgentConfig {
  // ...existing fields...
  sessionMode: "persistent" | "fresh";  // NEW
  sessionId?: string;                    // for resume
}
```

Persistent: `codex resume <id>`. Fresh: `codex exec`. Gemini cannot do persistent -- mark as limitation in capability spec, Gemini is worker-only.

### Requirement 3: Large Prompt Payload
**Required by:** Frontend builder (3000+ tokens with CSV data), debugger (error output passthrough), build-error-resolver (stack traces)
**The problem:** CLI arg length limits (~4096 chars on most systems).

All three CLI adapters must pipe prompts via stdin when payload > 2000 chars:
```typescript
if (config.prompt.length > 2000) {
  // Pipe via stdin instead of CLI arg
  const child = spawn("codex", ["exec", "--full-auto", "--json", ...flags]);
  child.stdin.write(config.prompt);
  child.stdin.end();
} else {
  // Short enough for CLI arg
  spawn("codex", ["exec", "--full-auto", "--json", ...flags, config.prompt]);
}
```

### Requirement 4: Dual-Document Input
**Required by:** UNIFY (planned vs actual), verifier (mandate vs result), PA (step N vs step N+1)
**The problem:** These agents need two separate contexts, not one blended prompt.

Adapter constructs structured prompt with clear delimiters:
```typescript
function buildDualInput(primary: string, secondary: string, role: string): string {
  return [
    `## YOUR ROLE\n${role}`,
    `## DOCUMENT A: EXPECTED\n${primary}`,
    `## DOCUMENT B: ACTUAL\n${secondary}`,
    `## YOUR TASK\nCompare A and B. Report discrepancies.`,
  ].join("\n\n");
}
```

### Requirement 5: Binary Content Extraction
**Required by:** worker-image-gen (DALL-E images)
**Only affects:** ChatGPT Web adapter
**The problem:** Standard text extraction ignores images.

```typescript
class ChatGPTWebAdapter {
  private async extractImages(webview: BrowserView): Promise<string[]> {
    return webview.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('img[src*="oaidalleapiprodscus"]'))
        .map(img => img.src);
    `);
  }
}
```

### Requirement 6: Environment Variable Passthrough
**Required by:** worker-deploy (VERCEL_TOKEN, GH_TOKEN), executor (PATH for npm/node)
**The problem:** Secrets must reach the spawned process without being logged.

```typescript
function buildEnv(config: AgentConfig): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Inherit existing auth tokens
  // NEVER log env vars
  if (config.name === "deploy") {
    // Verify required tokens exist
    if (!env.VERCEL_TOKEN && !env.GH_TOKEN) {
      throw new AdapterError("Deploy requires VERCEL_TOKEN or GH_TOKEN");
    }
  }
  return env;
}
```

### Requirement 7: Working Directory Lifecycle
**Required by:** worker-scaffold (creates directory), all other workers (directory must exist)
**The problem:** Scaffold creates the project directory. All subsequent workers assume it exists.

```typescript
async spawn(config: AgentConfig): Promise<AgentHandle> {
  if (config.name === "scaffold") {
    // Scaffold: create workingDir if missing
    await fs.mkdir(config.workingDir, { recursive: true });
  } else {
    // All others: verify workingDir exists
    if (!await fs.access(config.workingDir).then(() => true).catch(() => false)) {
      throw new AdapterError(`Working directory missing: ${config.workingDir}`);
    }
  }
  // ...spawn logic
}
```

### Requirement 8: Intermediate Output Capture
**Required by:** tdd-guide (needs red-green test cycle visible), debugger (needs diagnostic steps visible)
**The problem:** Standard adapters capture only final output. TDD needs: test1=FAIL, then test2=PASS.

```typescript
interface AgentHandle {
  // ...existing fields...
  onOutput: (callback: (chunk: string) => void) => void;  // streaming
  outputHistory: string[];  // accumulated chunks for inspection
}
```

---

## SECTION 3: THE CONTRACT

```typescript
// types.ts

export type GenericTool = "read" | "write" | "bash" | "web_search" | "edit";
export type RuntimeTarget = "codex" | "claude" | "gemini" | "chatgpt-web";

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model: string;
  tools: GenericTool[];
  maxTokens: number;
  prompt: string;
  declaredFiles: string[];
  workingDir: string;
  timeout: number;
  target: RuntimeTarget;
  sessionMode: "persistent" | "fresh";
  sessionId?: string;
  env?: Record<string, string>;  // additional env vars (secrets)
}

export interface AgentResult {
  id: string;
  status: "completed" | "failed" | "timeout" | "killed";
  output: string;
  filesCreated: string[];
  filesModified: string[];
  tokensUsed: { input: number; output: number };
  duration: number;
  exitCode: number | null;
  runtime: RuntimeTarget;
  sessionId?: string;         // for persistent sessions
  images?: string[];          // file paths for extracted images
  intermediateOutputs?: string[];  // for TDD red-green visibility
}

export interface RuntimeAdapter {
  spawn(config: AgentConfig): Promise<AgentHandle>;
  kill(handle: AgentHandle): Promise<void>;
  resume(sessionId: string, instruction: string): Promise<AgentHandle>;
  isAvailable(): Promise<boolean>;
  capabilities(): RuntimeCapabilities;
}

export interface RuntimeCapabilities {
  sessionResume: boolean;
  jsonOutput: boolean;
  toolPermissions: boolean;
  maxPromptTokens: number;
  supportedTools: GenericTool[];
  models: Record<string, string>;
}

export interface AgentHandle {
  id: string;
  process: ChildProcess | null;
  sessionId: string | null;
  onOutput: (callback: (chunk: string) => void) => void;
  onComplete: () => Promise<AgentResult>;
  outputHistory: string[];
}
```

---

## SECTION 4: ADAPTER IMPLEMENTATION PHASES

### Phase 1: types.ts + Codex Adapter (Day 1)

**Why Codex first:** Most plugins target Codex (executor, planner, debugger, TDD, deploy, scaffold). If Codex works, 12 of 22 prompts can execute.

Build `types.ts` (shared contract) + `codex-adapter.ts` (~250 lines).

**Real-plugin test battery (not toy prompts):**

| Test | Simulates | Tool Permissions | Validates |
|------|-----------|-----------------|-----------|
| Spawn executor, create 2 files | gsd-executor | read, write, bash | File creation + output parsing |
| Spawn planner, READ ONLY | gsd-planner | read | Read-only enforcement (verify no files written) |
| Spawn with 3000-token prompt | frontend-builder | read, write, bash | Large payload via stdin |
| Spawn + kill after 5s | timeout handling | read, write, bash | Kill + SIGTERM + cleanup |
| Spawn, capture streaming output | tdd-guide | read, write, bash | Intermediate output capture |
| Spawn persistent, resume | Conductor | read | Session persistence |
| Spawn with env vars | worker-deploy | read, bash | Env passthrough, no logging |

### Phase 2: Claude Code Adapter (Day 2)

**Why second:** Different pattern tests contract flexibility. YAML frontmatter. Different tool names. MCP config.

Build `claude-adapter.ts` (~200 lines).

**Additional tests beyond Codex:**
| Test | Validates |
|------|-----------|
| YAML frontmatter generated correctly | Agent file format |
| Tool names translated (read->Read, write->Write) | Permission mapping |
| Temp agent file cleaned up after | Resource cleanup |
| Output parsed from unstructured stdout | Less-structured-than-Codex handling |

### Phase 3: Gemini Adapter (Day 2-3)

**Why third:** Tests the "minimum viable adapter." No session resume. Fresh spawn only.

Build `gemini-adapter.ts` (~200 lines).

**Critical test:** `resume()` throws clear error "Gemini does not support session resume." Capability spec marks `sessionResume: false`. Conductor must NEVER be assigned to Gemini.

### Phase 4: ChatGPT Web Adapter (Day 3-4)

**Why last:** Completely different pattern. DOM, not CLI. Only 3 plugins need it (researcher, image-gen, web-research), but they CRITICALLY need it.

Build `chatgpt-web-adapter.ts` (~300 lines).

**Plugin-specific tests:**
| Test | Simulates | Validates |
|------|-----------|-----------|
| Inject prompt, capture text response | gsd-researcher | Text extraction from DOM |
| Inject image prompt, capture image URL | worker-image-gen | Binary content extraction |
| Multi-turn: inject, get response, inject followup | research multi-turn | Conversation persistence |
| Detect rate limit message | all web agents | Rate limit handling |
| Detect auth state | all web agents | isAvailable() accuracy |

### Phase 5: Integration + Adapter Factory (Day 4-5)

Build `adapter-factory.ts` -- routes AgentConfig to correct adapter.

**End-to-end test simulating a real Tier 2 build:**
```typescript
// Simulate: "Add a contact form to my site"
// Conductor produces 3-step DAG:
const steps = [
  { name: "planner", tools: ["read"], target: "codex", sessionMode: "fresh" },
  { name: "executor", tools: ["read","write","bash"], target: "codex", sessionMode: "fresh" },
  { name: "verifier", tools: ["read"], target: "codex", sessionMode: "fresh" },
];

for (const step of steps) {
  const adapter = factory.getAdapter(step.target);
  const handle = await adapter.spawn(step as AgentConfig);
  const result = await handle.onComplete();
  assert(result.status === "completed");
  // Pass result.output as context to next step
}
```

---

## DO / DON'T

### DO
- Start every adapter from the PLUGIN requirements, not the runtime docs. "The code-reviewer needs read-only" determines what the adapter must enforce.
- Test with real-plugin-shaped payloads (3000-token prompts, dual-document input, multi-turn). Toy tests miss real failures.
- Fail loud and clear when a runtime cannot do what a plugin requires. `capabilities()` must be honest. If Gemini cannot resume, say so. If ChatGPT web cannot scope tool permissions, say so.
- Log every spawn with: config.name, config.tools, config.target, prompt length, timestamp. Instance 4 (Hard Rails) will consume these logs.
- Build the adapter factory last. It is trivial routing code. The adapters themselves are the hard part.

### DON'T
- Don't write prompt content. Instance 3 (Dissection) produces prompts. You receive them opaque.
- Don't build enforcement. Instance 4 (Hard Rails) checks AFTER execution. You handle BEFORE and DURING (spawn, permissions, timeout, kill).
- Don't assume DOM selectors are stable. ChatGPT updates weekly. Version selectors. Make them configurable.
- Don't log env vars. VERCEL_TOKEN and GH_TOKEN in logs = security incident.
- Don't let any adapter silently swallow errors. Parse failures, spawn failures, timeout kills -- all must surface as clear AgentResult.status values.

---

## Success Criteria (Binary)

1. `types.ts` compiles. All interfaces exported. Matches Section 3 exactly.
2. Codex adapter: planner spawn with `tools: ["read"]` produces NO file modifications (read-only enforced).
3. Codex adapter: executor spawn with 3000-token prompt succeeds (stdin pipe, no truncation).
4. Codex adapter: persistent session resumes with context retained.
5. Claude adapter: generated YAML frontmatter has correct tool names (Read, Write, not read, write).
6. Gemini adapter: `resume()` throws explicit unsupported error. `capabilities().sessionResume === false`.
7. ChatGPT web adapter: extracts image URL from DALL-E response.
8. ChatGPT web adapter: detects rate limit and returns clear error.
9. End-to-end: 3-step DAG (plan > execute > verify) completes on at least 1 CLI runtime.
10. All 4 capability JSONs written. Each has: sessionResume, toolPermissions, maxPromptTokens, models, supportedTools.
11. No adapter crashes on malformed output. All have try/catch with fallback.
12. Adapter factory routes correctly: code tasks to CLI, research to web, images to web.

---

## Deliverables

```
adapters/
  types.ts                      # Shared contract (Section 3)
  codex-adapter.ts              # Codex CLI (~250 lines)
  claude-adapter.ts             # Claude Code (~200 lines)
  gemini-adapter.ts             # Gemini CLI (~200 lines)
  chatgpt-web-adapter.ts        # ChatGPT BrowserView (~300 lines)
  adapter-factory.ts            # getAdapter(runtime) routing
  tool-map.ts                   # Generic-to-runtime tool name translation
tests/
  codex-adapter.test.ts         # 7 real-plugin-shaped tests
  claude-adapter.test.ts        # 4 format-specific tests
  gemini-adapter.test.ts        # Limitation handling tests
  chatgpt-web-adapter.test.ts   # DOM extraction tests
  integration.test.ts           # 3-step DAG end-to-end
specs/
  codex-capabilities.json
  claude-capabilities.json
  gemini-capabilities.json
  chatgpt-web-capabilities.json
  plugin-adapter-map.json       # Which plugin needs which adapter features
```

**plugin-adapter-map.json is NEW.** This is the traceability document:
```json
{
  "gsd-executor": {
    "target": ["codex", "claude", "gemini"],
    "tools": ["read", "write", "bash"],
    "requirements": ["file_creation", "working_dir", "scope_enforcement"],
    "payload_size": "medium"
  },
  "code-reviewer": {
    "target": ["codex", "claude", "gemini"],
    "tools": ["read"],
    "requirements": ["read_only_enforcement", "structured_output"],
    "payload_size": "medium"
  },
  "worker-image-gen": {
    "target": ["chatgpt-web"],
    "tools": ["web_search"],
    "requirements": ["binary_content_extraction", "image_detection"],
    "payload_size": "small"
  },
  "skill-frontend-design": {
    "target": ["codex", "claude"],
    "tools": ["read", "write", "bash"],
    "requirements": ["large_payload", "stdin_pipe"],
    "payload_size": "large"
  }
}
```

**Total: ~950 lines adapter code, ~600 lines tests, 5 capability specs, 1 traceability map.**
**Timeline: 5 days. Each day has a working adapter tested against real plugin patterns.**
