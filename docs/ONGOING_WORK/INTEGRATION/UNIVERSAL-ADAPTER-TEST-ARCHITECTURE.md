# Universal CLI Adapter & Test Architecture — Definitive Specification

> **Status**: GOSPEL — This document is the authoritative reference for how CLI runtimes connect, how they're tested, and how the universal adapter normalizes all differences.
> **Last Updated**: 2026-03-04
> **Companion to**: PROMPT-INJECTION-ARCHITECTURE.md, HARDCODED-ENFORCEMENT-VALUES.md, ADAPTERS.md
> **Architectural model**: Follows F1 Search Engine pattern — one orchestrator, multiple strategies, unified output.

---

## Executive Summary

The app talks to three CLI runtimes (Codex, Claude Code, Gemini CLI) and one web runtime (ChatGPT). Each has different syntax, different permission models, different output formats, different session semantics. Instead of maintaining three divergent adapters where bugs hide in the differences, we build ONE universal CLI adapter that speaks a common language upstream and translates to runtime-specific commands downstream. This is `f1_search_cards()` for agent execution — one function, multiple strategies, unified result.

---

## 1. The F1 Parallel

Your F1 engine doesn't have separate search logic per strategy. It has ONE RPC (`f1_search_cards`) that dispatches to trigram, BM25, vector, and exact match in parallel, then fuses results through RRF (K=60).

Our system doesn't have separate adapter logic per runtime. It has ONE universal adapter (`cli_dispatch`) that dispatches to Codex, Claude Code, or Gemini via runtime-specific translators, then normalizes results into a common `AgentResult`.

```
F1 SEARCH ENGINE                          OUR AGENT SYSTEM
──────────────                          ─────────────────

User Query                              AgentConfig (runtime-agnostic)
     │                                       │
     ▼                                       ▼
f1_search_cards()                       cli_dispatch()
     │                                       │
     ├── Trigram (pg_trgm)              ├── Codex Translator
     ├── BM25 (tsvector)                ├── Claude Code Translator
     ├── Vector (pgvector)              ├── Gemini Translator
     └── Exact (string =)              └── ChatGPT Web Translator
     │                                       │
     ▼                                       ▼
RRF Fusion (K=60)                       Result Normalizer
     │                                       │
     ▼                                       ▼
Ranked Results                          AgentResult (common shape)
     │                                       │
     ▼                                       ▼
SSE to Frontend                         Bodyguard → PA → Next Step
```

The caller (Conductor, Bodyguard, Prompt Assembler) never knows which CLI produced the result. They work with `AgentConfig` in and `AgentResult` out. The translation is invisible.

---

## 2. Architecture: Where The Universal Adapter Lives

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE CROSSROADS                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   UPSTREAM (knows nothing about runtimes)                                  │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐               │
│   │Conductor │  │  Prompt   │  │Bodyguard │  │   Spine   │               │
│   │          │  │ Assembler │  │          │  │           │               │
│   └────┬─────┘  └─────┬─────┘  └────┬─────┘  └─────┬─────┘               │
│        │              │              │              │                      │
│        └──────────────┼──────────────┘              │                      │
│                       │                             │                      │
│                       ▼                             │                      │
│              ┌────────────────────────────────────┐ │                      │
│              │     UNIVERSAL CLI ADAPTER          │ │                      │
│              │     src/adapter/cli-dispatch.ts    │ │                      │
│              │                                    │◄┘                      │
│              │  Input:  AgentConfig               │                        │
│              │  Output: AgentResult               │                        │
│              │                                    │                        │
│              │  ┌──────────────────────────────┐  │                        │
│              │  │  CAPABILITY REGISTRY         │  │                        │
│              │  │  What each runtime CAN do    │  │                        │
│              │  └──────────────────────────────┘  │                        │
│              │                                    │                        │
│              │  ┌──────────────────────────────┐  │                        │
│              │  │  TRANSLATOR DISPATCH         │  │                        │
│              │  │  AgentConfig → CLI command    │  │                        │
│              │  └──────────────────────────────┘  │                        │
│              │                                    │                        │
│              │  ┌──────────────────────────────┐  │                        │
│              │  │  RESULT NORMALIZER           │  │                        │
│              │  │  CLI output → AgentResult     │  │                        │
│              │  └──────────────────────────────┘  │                        │
│              └──────────┬─────────────────────────┘                        │
│                         │                                                  │
│   DOWNSTREAM (knows everything about runtimes)                             │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│   │   Codex     │ │ Claude Code │ │ Gemini CLI  │ │ ChatGPT Web │        │
│   │ Translator  │ │ Translator  │ │ Translator  │ │ Translator  │        │
│   │             │ │             │ │             │ │             │        │
│   │ stdin pipe  │ │ YAML agent  │ │ MD agent    │ │ DOM paste   │        │
│   │ --sandbox   │ │ settings.json│ │ CLI flags  │ │ ClipboardEvt│        │
│   │ --json out  │ │ stdout parse│ │ stdout parse│ │ MutationObs │        │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Answer to your A/B/C:** This is **B** — but elevated to a first-class architectural layer called "The Crossroads." It is NOT part of Instance 4 (Instance 4 is enforcement — bodyguard, circuit breaker, step scheduler). It is NOT a replacement for Instance 2 (Instance 2 discovered HOW each runtime works — sandbox modes, YAML frontmatter, session resume). The Crossroads USES Instance 2's discoveries and FEEDS Instance 4's enforcement.

Instance 2 = the scouts (went out, learned each runtime's quirks)
The Crossroads = the translator (speaks all languages, presents one face upstream)
Instance 4 = the enforcement (doesn't care which runtime, applies rules uniformly)

---

## 3. The Capability Registry

Each runtime has different abilities. Before dispatching, the adapter checks: CAN this runtime do what the AgentConfig requests?

```typescript
// src/adapter/capability-registry.ts

interface RuntimeCapabilities {
  available:         boolean;   // is the CLI binary installed?
  version:           string;    // detected version string
  sessionResume:     boolean;   // can it resume persistent sessions?
  jsonOutput:        boolean;   // does it output structured JSON?
  stdinPrompt:       boolean;   // can it receive prompt via stdin?
  sandboxModes:      string[];  // what isolation modes does it support?
  maxPromptTokens:   number;    // practical limit before truncation
  toolPermissions:   string;    // how it handles tool restrictions
  models:            string[];  // what models can it route to?
  authMethod:        string;    // how it authenticates
  outputParsing:     string;    // "json" | "stdout-regex" | "git-diff"
}

const CAPABILITY_REGISTRY: Record<string, RuntimeCapabilities> = {
  codex: {
    available:       false,     // set by system scanner at launch
    version:         "",        // detected: "v0.46.0"
    sessionResume:   true,      // codex resume <id>
    jsonOutput:      true,      // --json flag produces structured output
    stdinPrompt:     true,      // prompt via stdin pipe
    sandboxModes:    ["read-only", "workspace-write", "danger-full-access"],
    maxPromptTokens: 100_000,   // practical limit
    toolPermissions: "sandbox", // --sandbox <mode>
    models:          ["gpt-5-codex", "gpt-5"],
    authMethod:      "oauth-browser",  // opens browser for GitHub/OpenAI auth
    outputParsing:   "json",    // parse --json output directly
  },

  claude: {
    available:       false,
    version:         "",
    sessionResume:   true,      // claude resume <id>
    jsonOutput:      false,     // no --json flag, stdout is unstructured
    stdinPrompt:     true,      // prompt via stdin or --agent file
    sandboxModes:    [],        // uses settings.json allowedTools, not sandbox
    maxPromptTokens: 150_000,   // claude-sonnet-4.5 200K window
    toolPermissions: "settings-json",  // .claude/settings.json
    models:          ["claude-haiku-4", "claude-opus-4.5", "claude-opus-4.6"],
    authMethod:      "oauth-browser",  // opens browser for Anthropic auth
    outputParsing:   "stdout-regex",   // parse stdout with regex + git diff
  },

  gemini: { ## We are not using gemini for now, problematic ##
    available:       false,
    version:         "",
    sessionResume:   false,     // NO session resume as of March 2026
    jsonOutput:      false,     // no structured output flag
    stdinPrompt:     true,      // prompt via stdin
    sandboxModes:    [],        // CLI flags for permissions
    maxPromptTokens: 500_000,   // gemini-pro 1M window
    toolPermissions: "cli-flags",  // --allow-read, --allow-write etc
    models:          ["gemini-flash", "gemini-pro"],
    authMethod:      "gcloud-auth",   // gcloud auth login
    outputParsing:   "stdout-regex",  // parse stdout with regex + git diff
  },

  chatgpt_web: {
    available:       false,     // set by auth state detection
    version:         "",        // ChatGPT Plus/Pro detected from DOM
    sessionResume:   false,     // each injection is a new message
    jsonOutput:      false,     // unstructured natural language
    stdinPrompt:     false,     // DOM paste, not stdin
    sandboxModes:    [],        // no sandbox — web browsing model
    maxPromptTokens: 8_000,     // practical paste limit
    toolPermissions: "none",    // user's subscription determines capabilities
    models:          ["user-subscription"],
    authMethod:      "browser-session",  // logged in via BrowserView
    outputParsing:   "dom-capture",      // MutationObserver + polling
  },
};
```

### 3.1 Capability Check Before Dispatch

```typescript
function canDispatch(config: AgentConfig, runtime: string): { ok: boolean; reason?: string } {
  const cap = CAPABILITY_REGISTRY[runtime];

  if (!cap.available)
    return { ok: false, reason: `${runtime} CLI not installed` };

  if (config.sessionMode === "persistent" && !cap.sessionResume)
    return { ok: false, reason: `${runtime} does not support session resume` };

  if (estimateTokens(config.prompt) > cap.maxPromptTokens)
    return { ok: false, reason: `Prompt ${estimateTokens(config.prompt)} tokens exceeds ${runtime} limit ${cap.maxPromptTokens}` };

  return { ok: true };
}
```

### 3.2 Runtime Selection (When AgentConfig Doesn't Specify)

If the Conductor doesn't specify a target runtime, the adapter picks:

```typescript
const RUNTIME_PREFERENCE_ORDER = ["codex", "claude", "gemini"];

function selectRuntime(config: AgentConfig): string {
  // 1. Explicit target? Use it.
  if (config.target) return config.target;

  // 2. Persistent session needed? Only codex and claude support it.
  if (config.sessionMode === "persistent") {
    for (const rt of ["codex", "claude"]) {
      if (canDispatch(config, rt).ok) return rt;
    }
  }

  // 3. Web browsing needed? ChatGPT Web.
  if (config.tools.includes("web_search") || config.tools.includes("browse")) {
    if (canDispatch(config, "chatgpt_web").ok) return "chatgpt_web";
  }

  // 4. Default: first available in preference order
  for (const rt of RUNTIME_PREFERENCE_ORDER) {
    if (canDispatch(config, rt).ok) return rt;
  }

  throw new Error("NO_RUNTIME_AVAILABLE: No CLI tool is installed and authenticated");
}
```

---

## 4. The Four Translators

Each translator converts AgentConfig → runtime-specific spawn command. This is where Instance 2's discoveries live.

### 4.1 Codex Translator

```typescript
// src/adapter/translators/codex.ts

const CODEX_SANDBOX_MAP: Record<string, string> = {
  // Discovered by Instance 2 verification: Codex uses --sandbox, NOT --allowed-tools
  "read":                 "--sandbox read-only",
  "read,bash":            "--sandbox read-only",         // bash for analysis cmds
  "read,write":           "--sandbox workspace-write",
  "read,write,bash":      "--sandbox workspace-write --full-auto",
  "read,write,bash,web":  "--sandbox danger-full-access",
};

function translateToCodex(config: AgentConfig): SpawnCommand {
  const toolKey = config.tools.sort().join(",");
  const sandbox = CODEX_SANDBOX_MAP[toolKey] || "--sandbox workspace-write --full-auto";

  return {
    binary:   "codex",
    args:     ["exec", "--json", sandbox, "--skip-git-repo-check", "-C", config.workingDir],
    stdin:    config.prompt,            // full assembled prompt piped via stdin
    env:      config.env || {},         // VERCEL_TOKEN etc passed via process.env
    timeout:  config.timeout,
    parseOutput: parseCodexJsonOutput,  // structured JSON parser
  };
}

function parseCodexJsonOutput(stdout: string): NormalizedOutput {
  // Codex --json outputs newline-delimited JSON events
  const lines = stdout.trim().split("\n").filter(l => l.startsWith("{"));
  const events = lines.map(l => JSON.parse(l));

  const completed = events.find(e => e.type === "turn.completed");
  const items = events.filter(e => e.type === "item.completed");

  return {
    output:       items.map(i => i.content || "").join("\n"),
    exitCode:     completed?.exit_code ?? 1,
    tokensUsed:   { input: completed?.usage?.input || 0, output: completed?.usage?.output || 0 },
    filesModified: [], // detected by git diff post-execution
    sessionId:    events.find(e => e.session_id)?.session_id || null,
    raw:          stdout,
  };
}
```

### 4.2 Claude Code Translator

```typescript
// src/adapter/translators/claude-code.ts

const CLAUDE_TOOL_MAP: Record<string, string> = {
  read: "Read", write: "Write", bash: "Bash",
  web_search: "WebSearch", edit: "Edit",
};

function translateToClaude(config: AgentConfig): SpawnCommand {
  // Claude Code reads from agent .md files with YAML frontmatter
  const agentFile = writeAgentFile(config);

  return {
    binary:   "claude",
    args:     ["code", "--agent", agentFile, "-C", config.workingDir],
    stdin:    null,                      // prompt is in the agent file
    env:      config.env || {},
    timeout:  config.timeout,
    parseOutput: parseClaudeStdout,      // regex-based parser
    cleanup:  () => fs.unlinkSync(agentFile),  // delete temp agent file
  };
}

function writeAgentFile(config: AgentConfig): string {
  const claudeTools = config.tools.map(t => CLAUDE_TOOL_MAP[t] || t);

  const content = [
    "---",
    `name: ${config.name}`,
    `model: ${config.model}`,
    `tools: [${claudeTools.join(", ")}]`,
    `maxTokens: ${config.maxTokens}`,
    "---",
    "",
    config.prompt,
  ].join("\n");

  const path = `/tmp/agents/${config.name}-${Date.now()}.md`;
  fs.mkdirSync("/tmp/agents", { recursive: true });
  fs.writeFileSync(path, content, "utf-8");
  return path;
}

function parseClaudeStdout(stdout: string): NormalizedOutput {
  // Claude Code stdout is unstructured. Extract what we can.
  return {
    output:       stdout,
    exitCode:     0,                     // set by process exit code, not parsed
    tokensUsed:   estimateFromLength(stdout), // approximate: no exact usage in stdout
    filesModified: [],                   // detected by git diff post-execution
    sessionId:    extractSessionId(stdout),   // regex for session ID if present
    raw:          stdout,
  };
}
```

### 4.3 Gemini Translator ### WE ARE NOT USIGN GEMINI, TOO PROBLEMATIC ###

```typescript
// src/adapter/translators/gemini.ts

const GEMINI_TOOL_MAP: Record<string, string> = {
  read: "--allow-read", write: "--allow-write",
  bash: "--allow-execute", web_search: "--allow-search",
};

function translateToGemini(config: AgentConfig): SpawnCommand {
  const toolFlags = config.tools.map(t => GEMINI_TOOL_MAP[t] || "").filter(Boolean);

  return {
    binary:   "gemini",
    args:     ["--agent", ...toolFlags, "-C", config.workingDir],
    stdin:    config.prompt,
    env:      config.env || {},
    timeout:  config.timeout,
    parseOutput: parseGeminiStdout,
  };
}

function parseGeminiStdout(stdout: string): NormalizedOutput {
  return {
    output:       stdout,
    exitCode:     0,
    tokensUsed:   estimateFromLength(stdout),
    filesModified: [],
    sessionId:    null,                  // Gemini has no session resume
    raw:          stdout,
  };
}
```

### 4.4 ChatGPT Web Translator

```typescript
// src/adapter/translators/chatgpt-web.ts
// This translator does NOT use CLI spawn — it uses DOM injection (see PROMPT-INJECTION-ARCHITECTURE.md)

function translateToChatGPT(config: AgentConfig): DomCommand {
  return {
    channel:      "dom",
    content:      config.prompt,
    maxPasteChars: 8_000,
    splitMessage:  config.prompt.length > 8_000,
    captureConfig: {
      pollInterval: 150,     // ms
      completionDelay: 500,  // ms after stop button disappears
    },
    parseOutput:  parseChatGPTDom,
  };
}
```

---

## 5. The Normalized Result

Every translator produces the same shape. Upstream never sees runtime differences.

```typescript
// src/adapter/types.ts

interface NormalizedOutput {
  output:        string;                // the agent's text response
  exitCode:      number;                // 0 = success, non-0 = failure
  tokensUsed:    { input: number; output: number }; // exact if available, estimated if not
  filesModified: string[];              // detected by git diff post-execution
  sessionId:     string | null;         // for persistent sessions
  raw:           string;                // full unprocessed stdout/stderr
}

interface AgentResult {
  config:        AgentConfig;           // what was requested
  runtime:       string;                // which runtime executed
  output:        NormalizedOutput;      // normalized response
  timing:        { startMs: number; endMs: number; durationMs: number };
  injectionLog:  InjectionLog;          // what was injected (from Prompt Assembler)
  error:         CapturedError | null;  // if failed: classified error with stderr
}
```

### 5.1 Post-Execution Normalization (All Runtimes)

Regardless of which translator ran, this always executes after:

```typescript
async function normalizePostExecution(
  result: AgentResult,
  config: AgentConfig
): Promise<AgentResult> {

  // 1. Git diff to detect file modifications (works for ALL CLI runtimes)
  const gitDiff = execSync("git diff --name-only HEAD", { cwd: config.workingDir });
  result.output.filesModified = gitDiff.toString().trim().split("\n").filter(Boolean);

  // 2. Git snapshot for Bodyguard scope enforcement
  result.output.scopeCheck = {
    declaredFiles: new Set(config.declaredFiles),
    actuallyModified: new Set(result.output.filesModified),
  };

  // 3. Token estimation (if runtime didn't provide exact count)
  if (result.output.tokensUsed.input === 0) {
    result.output.tokensUsed = estimateFromLength(result.output.raw);
  }

  return result;
}
```

---

## 6. The Master Dispatch Function

This is `f1_search_cards()` for our system. One function, called by everyone.

```typescript
// src/adapter/cli-dispatch.ts

async function cliDispatch(config: AgentConfig): Promise<AgentResult> {
  const startMs = Date.now();

  // [1] SELECT RUNTIME
  const runtime = selectRuntime(config);
  const capability = CAPABILITY_REGISTRY[runtime];

  // [2] VALIDATE
  const check = canDispatch(config, runtime);
  if (!check.ok) throw new Error(`DISPATCH_BLOCKED: ${check.reason}`);

  // [3] ASSEMBLE PROMPT (calls Prompt Injection Architecture)
  const assembled = assemblePrompt({
    agent: config.name,
    step: config.step,
    skill: config.skill,
    spine: await fetchSpineForInjection(config.workingDir),
    handoff: config.handoff,
    correction: config.correction,
    constraints: { tools: config.tools, declaredFiles: config.declaredFiles, env: config.env },
  });

  // [4] LOG INJECTION
  const injectionLog = logInjection(assembled, runtime);

  // [5] TRANSLATE + SPAWN
  let normalizedOutput: NormalizedOutput;

  if (runtime === "chatgpt_web") {
    // DOM channel — different flow
    const domCmd = translateToChatGPT({ ...config, prompt: assembled.content });
    normalizedOutput = await executeDom(domCmd);
  } else {
    // CLI channel — stdin pipe
    const translator = TRANSLATORS[runtime]; // codex | claude | gemini
    const spawnCmd = translator({ ...config, prompt: assembled.content });
    normalizedOutput = await executeCli(spawnCmd);
  }

  // [6] NORMALIZE
  const result: AgentResult = {
    config, runtime, output: normalizedOutput,
    timing: { startMs, endMs: Date.now(), durationMs: Date.now() - startMs },
    injectionLog,
    error: normalizedOutput.exitCode !== 0
      ? captureError(normalizedOutput)
      : null,
  };

  return normalizePostExecution(result, config);
}
```

---

## 7. Test Architecture

### 7.1 The Three Test Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEST ARCHITECTURE (3 Levels)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LEVEL 1: UNIT TESTS (no CLI, no network, no Electron)                   │
│   ─────────────────────────────────────────────────                         │
│   What: Test translators, parsers, capability checks, prompt assembly      │
│   How:  Vitest. Mock child_process.spawn. Assert command construction.     │
│   Speed: <1 second per test. Runs in CI. Runs offline.                    │
│   Count: ~50 tests                                                         │
│                                                                             │
│   LEVEL 2: INTEGRATION TESTS (real CLI, real filesystem, no Electron)     │
│   ──────────────────────────────────────────────────────────────            │
│   What: Actually spawn each CLI, send a real prompt, parse real output     │
│   How:  Vitest with real child_process. Temp directories. Git repos.      │
│   Speed: 10-60 seconds per test. Requires CLI tools installed.            │
│   Count: ~25 tests (run locally, not in CI without credentials)           │
│                                                                             │
│   LEVEL 3: E2E TESTS (Electron + BrowserView + real ChatGPT)             │
│   ─────────────────────────────────────────────────────────                 │
│   What: Full app launch, DOM injection, response capture, error recovery  │
│   How:  Playwright + Electron. Real ChatGPT session.                      │
│   Speed: 30-120 seconds per test. Requires logged-in ChatGPT.            │
│   Count: ~10 tests (manual trigger, not automated CI)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Level 1: Unit Tests (Universal Adapter Logic)

These test the TRANSLATOR logic without touching any CLI tool. Every test runs in <1 second.

```typescript
// tests/unit/translators/codex.test.ts

import { describe, it, expect } from "vitest";
import { translateToCodex } from "../../../src/adapter/translators/codex";

describe("Codex Translator", () => {

  it("maps read-only tools to read-only sandbox", () => {
    const cmd = translateToCodex({
      name: "gsd-planner", tools: ["read"], prompt: "Plan the project",
      workingDir: "/tmp/test", timeout: 60000,
    });
    expect(cmd.args).toContain("--sandbox");
    expect(cmd.args).toContain("read-only");
    expect(cmd.args).not.toContain("workspace-write");
  });

  it("maps read+write+bash to workspace-write with full-auto", () => {
    const cmd = translateToCodex({
      name: "gsd-executor", tools: ["read", "write", "bash"],
      prompt: "Create the component", workingDir: "/tmp/test", timeout: 300000,
    });
    expect(cmd.args.join(" ")).toContain("workspace-write");
    expect(cmd.args.join(" ")).toContain("--full-auto");
  });

  it("pipes prompt via stdin, not as CLI argument", () => {
    const longPrompt = "x".repeat(5000);
    const cmd = translateToCodex({
      name: "test", tools: ["read"], prompt: longPrompt,
      workingDir: "/tmp/test", timeout: 60000,
    });
    expect(cmd.stdin).toBe(longPrompt);
    expect(cmd.args.join(" ")).not.toContain(longPrompt);
  });

  it("includes --json flag for structured output", () => {
    const cmd = translateToCodex({
      name: "test", tools: ["read"], prompt: "test",
      workingDir: "/tmp/test", timeout: 60000,
    });
    expect(cmd.args).toContain("--json");
  });

  it("passes working directory via -C flag", () => {
    const cmd = translateToCodex({
      name: "test", tools: ["read"], prompt: "test",
      workingDir: "/Users/dev/my-project", timeout: 60000,
    });
    expect(cmd.args).toContain("-C");
    expect(cmd.args).toContain("/Users/dev/my-project");
  });
});

// tests/unit/translators/claude-code.test.ts

describe("Claude Code Translator", () => {

  it("generates YAML frontmatter agent file", () => {
    const cmd = translateToClaude({
      name: "code-reviewer", tools: ["read"], model: "claude-sonnet-4.5",
      prompt: "Review this code", workingDir: "/tmp/test", timeout: 60000, maxTokens: 4096,
    });
    const fileContent = fs.readFileSync(cmd.agentFile, "utf-8");
    expect(fileContent).toContain("---");
    expect(fileContent).toContain("tools: [Read]");
    expect(fileContent).toContain("model: claude-sonnet-4.5");
    expect(fileContent).toContain("Review this code");
  });

  it("translates generic tool names to Claude format", () => {
    const cmd = translateToClaude({
      name: "test", tools: ["read", "write", "bash"], model: "claude-sonnet-4.5",
      prompt: "test", workingDir: "/tmp/test", timeout: 60000, maxTokens: 4096,
    });
    const fileContent = fs.readFileSync(cmd.agentFile, "utf-8");
    expect(fileContent).toContain("Read");
    expect(fileContent).toContain("Write");
    expect(fileContent).toContain("Bash");
    expect(fileContent).not.toContain("read");  // should be translated
  });

  it("cleans up temp agent file after execution", async () => {
    const cmd = translateToClaude({
      name: "test", tools: ["read"], model: "claude-sonnet-4.5",
      prompt: "test", workingDir: "/tmp/test", timeout: 60000, maxTokens: 4096,
    });
    expect(fs.existsSync(cmd.agentFile)).toBe(true);
    cmd.cleanup();
    expect(fs.existsSync(cmd.agentFile)).toBe(false);
  });
});

// tests/unit/translators/gemini.test.ts  ### WE ARE NOT USIGN GEMINI, TOO PROBLEMATIC ###

describe("Gemini Translator", () => {

  it("maps tools to CLI permission flags", () => {
    const cmd = translateToGemini({
      name: "test", tools: ["read", "write"], prompt: "test",
      workingDir: "/tmp/test", timeout: 60000,
    });
    expect(cmd.args).toContain("--allow-read");
    expect(cmd.args).toContain("--allow-write");
  });

  it("does NOT include session resume flags", () => {
    const cmd = translateToGemini({
      name: "test", tools: ["read"], prompt: "test",
      workingDir: "/tmp/test", timeout: 60000,
      sessionMode: "persistent",
    });
    // Gemini has no resume — translator should not include resume flags
    expect(cmd.args.join(" ")).not.toContain("resume");
  });
});
```

### Unit Tests: Output Parsers

```typescript
// tests/unit/parsers/codex-output.test.ts

describe("Codex Output Parser", () => {

  it("parses structured --json output", () => {
    const stdout = [
      '{"type":"thread.started","session_id":"abc123"}',
      '{"type":"turn.started"}',
      '{"type":"item.completed","content":"Created ContactForm.tsx"}',
      '{"type":"turn.completed","usage":{"input":6210,"output":85},"exit_code":0}',
    ].join("\n");

    const result = parseCodexJsonOutput(stdout);
    expect(result.exitCode).toBe(0);
    expect(result.tokensUsed.input).toBe(6210);
    expect(result.tokensUsed.output).toBe(85);
    expect(result.sessionId).toBe("abc123");
    expect(result.output).toContain("Created ContactForm.tsx");
  });

  it("handles failed execution", () => {
    const stdout = '{"type":"turn.completed","usage":{"input":500,"output":10},"exit_code":1}\n';
    const result = parseCodexJsonOutput(stdout);
    expect(result.exitCode).toBe(1);
  });

  it("handles empty output gracefully", () => {
    const result = parseCodexJsonOutput("");
    expect(result.exitCode).toBe(1);
    expect(result.output).toBe("");
  });
});

// tests/unit/parsers/capability-check.test.ts

describe("Capability Registry", () => {

  it("rejects persistent session on Gemini", () => {
    CAPABILITY_REGISTRY.gemini.available = true;
    const check = canDispatch({ sessionMode: "persistent" }, "gemini");
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("session resume");
  });

  it("rejects when CLI not installed", () => {
    CAPABILITY_REGISTRY.codex.available = false;
    const check = canDispatch({ tools: ["read"] }, "codex");
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("not installed");
  });

  it("selects ChatGPT for web_search tasks", () => {
    CAPABILITY_REGISTRY.chatgpt_web.available = true;
    const runtime = selectRuntime({ tools: ["web_search"] });
    expect(runtime).toBe("chatgpt_web");
  });

  it("falls through preference order when first unavailable", () => {
    CAPABILITY_REGISTRY.codex.available = false;
    CAPABILITY_REGISTRY.claude.available = true;
    const runtime = selectRuntime({ tools: ["read", "write"] });
    expect(runtime).toBe("claude");
  });
});
```

### Unit Tests: Prompt Assembly

```typescript
// tests/unit/prompt-assembly.test.ts

describe("Prompt Assembly", () => {

  it("includes all 7 sources in correct order", () => {
    const assembled = assemblePrompt({
      agent: "gsd-executor",
      step: mockStep,
      skill: { skillName: "tdd-guide", score: 0.8, file: "skills/workers/tdd-guide.md" },
      spine: mockSpine,
      handoff: { summary: "Previous step done", compatible: true, warnings: [] },
      correction: { attemptNumber: 2, previousError: "TypeError", /* ... */ },
      constraints: { tools: ["read", "write", "bash"], declaredFiles: ["src/index.ts"] },
    });

    // Order matters: identity before skill, correction LAST
    const identityPos = assembled.content.indexOf("## You Are");
    const skillPos = assembled.content.indexOf("## Skill Pre-Load");
    const correctionPos = assembled.content.indexOf("## CORRECTION");

    expect(identityPos).toBeLessThan(skillPos);
    expect(skillPos).toBeLessThan(correctionPos);
  });

  it("produces different hash on retry (mutation works)", () => {
    const attempt1 = assemblePrompt({ correction: null, /* ... */ });
    const attempt2 = assemblePrompt({
      correction: { attemptNumber: 2, previousError: "TypeError" },
      /* same everything else */
    });
    expect(attempt1.promptHash).not.toBe(attempt2.promptHash);
  });

  it("stays within token budget", () => {
    const assembled = assemblePrompt({ /* max everything */ });
    expect(assembled.tokenCount).toBeLessThanOrEqual(4700);
  });
});
```

### 7.3 Level 2: Integration Tests (Real CLI, Real Filesystem)

These require the actual CLI tools installed. They run against a real temp directory with a real git repo.

```typescript
// tests/integration/codex-real.test.ts
// REQUIRES: codex CLI installed and authenticated

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cliDispatch } from "../../src/adapter/cli-dispatch";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("Codex Real Integration", () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp project directory with git repo
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-test-"));
    execSync("git init", { cwd: testDir });
    execSync("git commit --allow-empty -m 'init'", { cwd: testDir });
    fs.writeFileSync(path.join(testDir, "package.json"), '{"name":"test","version":"1.0.0"}');
    execSync("git add -A && git commit -m 'setup'", { cwd: testDir });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("TEST 1: Spawn executor, create file, verify file exists", async () => {
    const result = await cliDispatch({
      name: "gsd-executor",
      role: "Create a file",
      model: "gpt-5",
      tools: ["read", "write", "bash"],
      maxTokens: 1024,
      prompt: "Create a file called hello.txt containing 'Hello World'. Nothing else.",
      declaredFiles: ["hello.txt"],
      workingDir: testDir,
      timeout: 60_000,
      target: "codex",
      sessionMode: "fresh",
    });

    expect(result.output.exitCode).toBe(0);
    expect(fs.existsSync(path.join(testDir, "hello.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(testDir, "hello.txt"), "utf-8")).toContain("Hello");
  }, 120_000);

  it("TEST 2: Read-only sandbox prevents file creation", async () => {
    const result = await cliDispatch({
      name: "gsd-planner",
      role: "Read only",
      model: "gpt-5-codex",
      tools: ["read"],
      maxTokens: 1024,
      prompt: "Try to create a file called hack.txt. Write anything to it.",
      declaredFiles: [],
      workingDir: testDir,
      timeout: 60_000,
      target: "codex",
      sessionMode: "fresh",
    });

    // File should NOT exist — read-only sandbox prevents writes
    expect(fs.existsSync(path.join(testDir, "hack.txt"))).toBe(false);
  }, 120_000);

  it("TEST 3: Large prompt via stdin (>2000 chars)", async () => {
    const largePrompt = "Create hello.txt with 'test'. " + "Context: ".repeat(300);
    expect(largePrompt.length).toBeGreaterThan(2000);

    const result = await cliDispatch({
      name: "test-large",
      role: "Test large prompt",
      model: "gpt-5-codex",
      tools: ["read", "write"],
      maxTokens: 1024,
      prompt: largePrompt,
      declaredFiles: ["hello.txt"],
      workingDir: testDir,
      timeout: 60_000,
      target: "codex",
      sessionMode: "fresh",
    });

    expect(result.output.exitCode).toBe(0);
  }, 120_000);

  it("TEST 4: Token tracking returns real numbers", async () => {
    const result = await cliDispatch({
      name: "test-tokens",
      role: "Test token tracking",
      model: "gpt-5-codex",
      tools: ["read"],
      maxTokens: 256,
      prompt: "List the files in this directory. Output just filenames.",
      declaredFiles: [],
      workingDir: testDir,
      timeout: 60_000,
      target: "codex",
      sessionMode: "fresh",
    });

    expect(result.output.tokensUsed.input).toBeGreaterThan(0);
    expect(result.output.tokensUsed.output).toBeGreaterThan(0);
  }, 120_000);

  it("TEST 5: Timeout kills process", async () => {
    const startMs = Date.now();

    try {
      await cliDispatch({
        name: "test-timeout",
        role: "Intentionally slow",
        model: "gpt-5-codex",
        tools: ["read", "write", "bash"],
        maxTokens: 4096,
        prompt: "Write a very long essay about every country in the world. Make it 10000 words.",
        declaredFiles: [],
        workingDir: testDir,
        timeout: 5_000,  // 5 second timeout
        target: "codex",
        sessionMode: "fresh",
      });
    } catch (err) {
      expect(err.message).toContain("TIMEOUT");
    }

    const elapsed = Date.now() - startMs;
    expect(elapsed).toBeLessThan(15_000); // should die within timeout + grace
  }, 30_000);
});
```

### Claude Code Integration Tests

```typescript
// tests/integration/claude-real.test.ts
// REQUIRES: claude CLI installed and authenticated

describe("Claude Code Real Integration", () => {
  let testDir: string;

  // Same beforeEach/afterEach as Codex tests

  it("TEST 1: Agent file created with correct YAML frontmatter", async () => {
    const result = await cliDispatch({
      name: "code-reviewer",
      tools: ["read"],
      model: "claude-sonnet-4.5",
      prompt: "List all .ts files in the project.",
      declaredFiles: [],
      workingDir: testDir,
      timeout: 60_000,
      target: "claude",
      sessionMode: "fresh",
    });

    // Verify agent file was created and cleaned up
    expect(result.runtime).toBe("claude");
    expect(result.output.exitCode).toBe(0);
  }, 120_000);

  it("TEST 2: Read-only tools prevent file writes", async () => {
    const result = await cliDispatch({
      name: "code-reviewer",
      tools: ["read"],
      model: "claude-sonnet-4.5",
      prompt: "Create a file called hack.txt with content 'hacked'.",
      declaredFiles: [],
      workingDir: testDir,
      timeout: 60_000,
      target: "claude",
      sessionMode: "fresh",
    });

    expect(fs.existsSync(path.join(testDir, "hack.txt"))).toBe(false);
  }, 120_000);
});
```

### Gemini Integration Tests

```typescript
// tests/integration/gemini-real.test.ts
// REQUIRES: gemini CLI installed and authenticated ### WE ARE NOT USIGN GEMINI, TOO PROBLEMATIC ###

describe("Gemini CLI Real Integration", () => {

  it("TEST 1: Basic prompt execution", async () => {
    const result = await cliDispatch({
      name: "test-gemini",
      tools: ["read"],
      model: "gemini-flash",
      prompt: "List the files in this directory.",
      declaredFiles: [],
      workingDir: testDir,
      timeout: 60_000,
      target: "gemini",
      sessionMode: "fresh",
    });

    expect(result.runtime).toBe("gemini");
    expect(result.output.exitCode).toBe(0);
    expect(result.output.output.length).toBeGreaterThan(0);
  }, 120_000);

  it("TEST 2: Session resume correctly throws", async () => {
    expect(() => {
      canDispatch({ sessionMode: "persistent" }, "gemini");
    }).toThrow(/session resume/i);
  });
});
```

### 7.4 Level 3: E2E Tests in Electron

These test the full Electron app with real ChatGPT BrowserView interaction.

```typescript
// tests/e2e/electron-chatgpt.test.ts
// REQUIRES: Electron app running, ChatGPT logged in

import { test, expect, _electron as electron } from "@playwright/test";

let electronApp;
let window;

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: [".", "--test-mode"] });
  window = await electronApp.firstWindow();
  // Wait for ChatGPT to load in BrowserView
  await window.waitForTimeout(5000);
});

test.afterAll(async () => {
  await electronApp.close();
});

test("E2E 1: DOM injection sends message to ChatGPT", async () => {
  // Trigger injection via IPC
  await window.evaluate(() => {
    window.electronAPI.injectMessage("What is 2 + 2? Reply with just the number.");
  });

  // Wait for response capture
  await window.waitForTimeout(10_000);

  // Check captured response
  const response = await window.evaluate(() => window.electronAPI.getLastCapture());
  expect(response).toBeDefined();
  expect(response.text).toContain("4");
});

test("E2E 2: Rate limit detection works", async () => {
  // This test requires hitting the actual rate limit OR injecting a mock
  // For automated testing, we mock the DOM text:
  await window.evaluate(() => {
    document.body.innerHTML += '<div class="test-ratelimit">You\'ve reached your message limit</div>';
  });

  const detected = await window.evaluate(() => window.electronAPI.checkRateLimit());
  expect(detected).toBe(true);
});

test("E2E 3: Full dispatch through universal adapter", async () => {
  // This test runs a real task through the complete pipeline
  const result = await window.evaluate(async () => {
    return window.electronAPI.dispatch({
      name: "test-e2e",
      tools: ["read"],
      prompt: "What files are in this directory?",
      workingDir: "/tmp/test-project",
      timeout: 30000,
    });
  });

  expect(result.runtime).toBeDefined();
  expect(result.output.exitCode).toBe(0);
});
```

### 7.5 The Compatibility Matrix

What Instance 2 discovered, codified as a truth table:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPATIBILITY MATRIX                                     │
├───────────────────┬──────────┬──────────────┬──────────┬──────────────────┤
│   Feature         │  Codex   │ Claude Code  │  Gemini  │  ChatGPT Web    │
├───────────────────┼──────────┼──────────────┼──────────┼──────────────────┤
│ SPAWN             │ ✅ exec  │ ✅ --agent   │ ✅ --agent│ ✅ DOM paste    │
│ STDIN PROMPT      │ ✅ pipe  │ ✅ pipe/file │ ✅ pipe  │ ❌ DOM only     │
│ JSON OUTPUT       │ ✅ --json│ ❌ stdout    │ ❌ stdout│ ❌ DOM capture  │
│ SESSION RESUME    │ ✅ resume│ ✅ resume    │ ❌ none  │ ❌ per-message  │
│ SANDBOX/PERMS     │ ✅ modes │ ✅ settings  │ ✅ flags │ ❌ n/a          │
│ TOKEN TRACKING    │ ✅ exact │ ❌ estimate  │ ❌ estimate│ ❌ estimate    │
│ READ-ONLY ENFORCE │ ✅ proven│ ✅ via tools │ ⚠️ untested│ ❌ n/a         │
│ WORKING DIR       │ ✅ -C    │ ✅ -C        │ ✅ -C    │ ❌ n/a          │
│ TIMEOUT/KILL      │ ✅ SIGTERM│ ✅ SIGTERM  │ ✅ SIGTERM│ ⚠️ tab close   │
│ MULTI-MODEL       │ ✅ 3     │ ✅ 3         │ ✅ 2     │ ❌ user sub     │
├───────────────────┼──────────┼──────────────┼──────────┼──────────────────┤
│ CONDUCTOR CAPABLE │ ✅ YES   │ ✅ YES       │ ❌ NO    │ ❌ NO           │
│ WORKER CAPABLE    │ ✅ YES   │ ✅ YES       │ ✅ YES   │ ✅ YES          │
│ REVIEWER CAPABLE  │ ✅ YES   │ ✅ YES       │ ✅ YES   │ ❌ NO           │
│ RESEARCHER CAP.   │ ⚠️ no web│ ⚠️ no web   │ ⚠️ no web│ ✅ YES          │
│ IMAGE GEN CAP.    │ ❌ NO    │ ❌ NO        │ ❌ NO    │ ✅ YES (DALL-E) │
├───────────────────┼──────────┼──────────────┼──────────┼──────────────────┤
│ MATURITY          │ HIGH     │ HIGH         │ MEDIUM   │ FRAGILE (DOM)   │
│ PRIORITY          │ PRIMARY  │ SECONDARY    │ TERTIARY │ RESEARCH+IMAGES │
└───────────────────┴──────────┴──────────────┴──────────┴──────────────────┘
```

### 7.6 Test Automation in Electron

How tests actually run inside the Electron context:

```typescript
// src/main/test-runner.ts (runs inside Electron main process)

class AdapterTestRunner {
  private results: TestResult[] = [];

  async runAll(): Promise<TestReport> {
    // Level 1: Unit tests (always run)
    const unitResults = await this.runUnit();

    // Level 2: Integration tests (only if CLIs available)
    const integrationResults = await this.runIntegration();

    // Level 3: E2E (only if ChatGPT logged in)
    const e2eResults = await this.runE2E();

    return { unit: unitResults, integration: integrationResults, e2e: e2eResults };
  }

  private async runUnit(): Promise<TestResult[]> {
    // These run via vitest in a child process
    const result = execSync("npx vitest run tests/unit/ --reporter=json", {
      encoding: "utf-8",
      timeout: 30_000,
    });
    return JSON.parse(result).testResults;
  }

  private async runIntegration(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Only run tests for CLIs that are actually available
    for (const runtime of ["codex", "claude", "gemini"]) {
      if (CAPABILITY_REGISTRY[runtime].available) {
        const result = execSync(
          `npx vitest run tests/integration/${runtime}-real.test.ts --reporter=json`,
          { encoding: "utf-8", timeout: 300_000 }
        );
        results.push(...JSON.parse(result).testResults);
      } else {
        results.push({ name: `${runtime}-skipped`, status: "skip", reason: "CLI not installed" });
      }
    }

    return results;
  }

  private async runE2E(): Promise<TestResult[]> {
    if (!CAPABILITY_REGISTRY.chatgpt_web.available) {
      return [{ name: "e2e-skipped", status: "skip", reason: "ChatGPT not logged in" }];
    }
    // Playwright tests against the running Electron app
    const result = execSync("npx playwright test tests/e2e/ --reporter=json", {
      encoding: "utf-8",
      timeout: 600_000,
    });
    return JSON.parse(result).testResults;
  }
}
```

---

## 8. What's Native vs What Needs Adaptation

### 8.1 Claude Code Is Native FOR SKILLS — Not For Everything

Your question: "Would this only be prevalent for Claude Code as that is naturally native?"

Claude Code is native in ONE sense: our skill files (.md with triggers, 7-section format) are the same format Claude Code reads natively from `.claude/skills/`. So Instance 3's skill library works directly with Claude Code without any translation.

BUT Claude Code is NOT native in these senses:
- It doesn't output structured JSON (Codex does)
- It doesn't have sandbox modes (Codex does)
- It needs YAML frontmatter agent files (our format, not standard)
- Its tool name format is different ("Read" not "read")
- Its session resume syntax is different from Codex

So Claude Code needs just as much TRANSLATOR work as Codex. The skill files are portable, but the spawning, output parsing, and permission management are all runtime-specific.

### 8.2 Work Required Per Runtime

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORK REQUIRED PER RUNTIME                               │
├──────────────────┬─────────────────────────────────────────────────────────┤
│                  │                                                         │
│  CODEX           │  LEAST work for translator (best structured output).   │
│  ──────          │  --json flag gives us exact token counts, exit codes,  │
│                  │  session IDs. Sandbox model verified (9/9 tests pass). │
│                  │  REMAINING: Session persistence across app restarts.   │
│                  │  Timeout handling (process.kill). Working dir validate. │
│                  │  Estimated: 1 day to production-ready.                 │
│                  │                                                         │
├──────────────────┼─────────────────────────────────────────────────────────┤
│                  │                                                         │
│  CLAUDE CODE     │  MEDIUM work. Skills are natively portable but         │
│  ──────────      │  output parsing needs regex (no --json). Need YAML     │
│                  │  frontmatter file generation. Need settings.json       │
│                  │  manipulation for tool permissions. Need temp file     │
│                  │  cleanup. Token counts are ESTIMATED, not exact.       │
│                  │  REMAINING: YAML generation. Output parser. Settings   │
│                  │  writer. Temp agent file lifecycle. Session resume     │
│                  │  testing.                                               │
│                  │  Estimated: 2 days to production-ready.                │
│                  │                                                         │
├──────────────────┼─────────────────────────────────────────────────────────┤
│                  │                                                         │
│  GEMINI CLI      │  MOST work. No session resume (workers only, no       │
│  ──────────      │  conductor). No JSON output. Permission flags may     │.   ### WE ARE NOT USIGN GEMINI, TOO PROBLEMATIC ###
│                  │  change between versions. Tool name mapping needs      │
│                  │  verification against current CLI version. Newer,      │
│                  │  less documented, more likely to have breaking changes.│
│                  │  REMAINING: Full translator build. Permission flag     │
│                  │  verification. Output parser. Version compatibility    │
│                  │  check. No session resume = cannot be Conductor.       │
│                  │  Estimated: 3 days to production-ready.                │
│                  │                                                         │
├──────────────────┼─────────────────────────────────────────────────────────┤
│                  │                                                         │
│  CHATGPT WEB     │  FRAGILE. DOM selectors break when ChatGPT updates    │
│  ────────────    │  their frontend. Paste strategy may need updating.    │
│                  │  Rate limit detection is regex on page text. Image    │
│                  │  extraction needs MutationObserver on img elements.   │
│                  │  This is the maintenance-heavy adapter.                │
│                  │  REMAINING: All selector chains need live verification.│
│                  │  Capture pipeline needs streaming test. Rate limit     │
│                  │  detection needs real-world validation.                │
│                  │  Estimated: 2 days + ongoing maintenance.              │
│                  │                                                         │
└──────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 9. Future-Proofing: Adding Runtime 4, 5, N

When a new CLI tool appears (OpenCode, Aider, Cursor CLI, whatever):

```
Step 1: Add entry to CAPABILITY_REGISTRY with all fields       (30 min)
Step 2: Write translator function (AgentConfig → SpawnCommand)  (2-4 hours)
Step 3: Write output parser (stdout → NormalizedOutput)         (1-2 hours)
Step 4: Write 5 unit tests for the translator                   (1 hour)
Step 5: Write 3 integration tests against real CLI              (2 hours)
Step 6: Add to RUNTIME_PREFERENCE_ORDER if it should be auto-selected
Step 7: Update compatibility matrix
```

Total: 1 day for a new runtime. Zero changes to Conductor, Bodyguard, Prompt Assembler, Skill Injector, PA, or any other upstream component. That's the value of the crossroads.

---

## 10. File Reference

| File | Purpose |
|------|---------|
| `src/adapter/cli-dispatch.ts` | Master dispatch function. One function, all runtimes. |
| `src/adapter/capability-registry.ts` | What each runtime can and cannot do. |
| `src/adapter/types.ts` | AgentConfig, AgentResult, NormalizedOutput, SpawnCommand. |
| `src/adapter/translators/codex.ts` | Codex CLI translator. Sandbox mapping. JSON parser. |
| `src/adapter/translators/claude-code.ts` | Claude Code translator. YAML frontmatter. Settings.json. |
| `src/adapter/translators/gemini.ts` | Gemini CLI translator. Permission flags. | ### WE ARE NOT USIGN GEMINI, TOO PROBLEMATIC ###
| `src/adapter/translators/chatgpt-web.ts` | ChatGPT DOM translator. Paste + capture. |
| `src/adapter/normalizer.ts` | Post-execution normalization (git diff, scope check, token estimate). |
| `tests/unit/translators/*.test.ts` | Level 1: translator logic tests (~50 tests). |
| `tests/integration/*-real.test.ts` | Level 2: real CLI spawn tests (~25 tests). |
| `tests/e2e/electron-chatgpt.test.ts` | Level 3: full Electron E2E tests (~10 tests). |

---

*This document is the authoritative reference for the Universal CLI Adapter and Test Architecture. All runtime integration must flow through `cli_dispatch()`. No upstream component may interact with a CLI tool directly.*
