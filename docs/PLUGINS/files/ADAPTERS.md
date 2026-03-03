# Runtime Adapters: The Portability Layer

## What This Is

The adapter layer is the ONLY place runtime-specific logic lives. Everything upstream (Conductor, PA, Skill Injector, Bodyguard) produces runtime-agnostic AgentConfig objects. The adapter translates AgentConfig into whatever the target runtime expects.

Same project can have: research on ChatGPT (web), code on Codex (CLI), review on Claude Code (different CLI). None know about each other. Spine, PA, and Bodyguards are the integration layer.

---

## The AgentConfig Interface (Runtime-Agnostic)

```typescript
interface AgentConfig {
  name: string;            // "executor", "researcher", "reviewer"
  role: string;            // human-readable description
  model: string;           // "gpt-4o", "claude-sonnet-4", "gemini-pro"
  tools: string[];         // ["read", "write", "bash", "web_search"]
  maxTokens: number;       // output token limit
  prompt: string;          // the full prompt body (skill pre-loaded)
  declaredFiles: string[]; // files this agent is allowed to touch
  timeout: number;         // kill after N seconds
  workingDir: string;      // project directory
}
```

This is what the Conductor and Skill Injector produce. The adapter takes it from here.

---

## Adapter Per Runtime

### Codex CLI (OpenAI)

**How it works:**
Codex is a CLI tool that spawns an autonomous coding agent. It reads a system prompt, gets a task, and executes with full filesystem access. Supports `--full-auto` mode (no human confirmation) and persistent sessions via `codex resume <id>`.

**Spawn command construction:**
```typescript
function toCodexCommand(config: AgentConfig): string {
  const parts = [
    "codex",
    "--full-auto",
    `--model ${config.model}`,
    `-C ${config.workingDir}`,
    "--json",
  ];

  // Tool permissions: Codex uses --allowed-tools
  if (config.tools.length > 0) {
    parts.push(`--allowed-tools "${config.tools.join(",")}"`);
  }

  // System prompt: Codex reads from stdin or --system flag
  // We pipe the full prompt via stdin
  return `echo '${escapeShell(config.prompt)}' | ${parts.join(" ")}`;
}
```

**Output parsing:**
Codex with `--json` outputs structured JSON:
```json
{
  "status": "completed" | "failed" | "cancelled",
  "output": "...",
  "files_modified": ["src/index.ts", "src/utils.ts"],
  "exit_code": 0
}
```

**Session management:**
```typescript
// First spawn: get session ID
const result = await exec(toCodexCommand(config));
const sessionId = result.sessionId;

// Resume later
await exec(`codex resume ${sessionId} --json "${newInstruction}"`);
```

**Error handling:**
| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Pass to Bodyguard |
| 1 | Task failed | Log error, pass to Conductor for re-plan |
| 2 | Timeout | Kill, respawn with narrower mandate |
| 130 | SIGINT (user cancelled) | Stop build |

**Model routing:**
```typescript
const CODEX_MODELS = {
  fast: "gpt-4o-mini",      // Simple tasks, quick turnaround
  standard: "gpt-4o",       // Default for most code tasks
  reasoning: "o3",           // Complex architectural decisions
};
```

**Estimated lines:** ~250 TypeScript
**What is missing for us:**
- Session ID persistence across app restarts (save to disk, restore on launch)
- Timeout handling (Codex can hang; need process.kill after config.timeout)
- Working directory validation (must exist, must be a git repo)
- Auth: OAuth token management (Gate 6 handles this, adapter just passes env vars)

---

### Claude Code (Anthropic)

**How it works:**
Claude Code is a CLI agent that reads CLAUDE.md for behavior + .claude/skills/ for capabilities. Supports YAML frontmatter in agent files for tool permissions. Persistent sessions via `claude resume`.

**Spawn command construction:**
```typescript
function toClaudeCommand(config: AgentConfig): string {
  // Claude Code reads agent definition from a markdown file
  // We write a temp file with YAML frontmatter + prompt body
  const agentFile = writeAgentFile(config);

  return `claude --agent ${agentFile} -C ${config.workingDir}`;
}

function writeAgentFile(config: AgentConfig): string {
  const frontmatter = {
    name: config.name,
    model: config.model,
    tools: mapToolsToClaudeFormat(config.tools),
    maxTokens: config.maxTokens,
  };

  const content = [
    "---",
    yaml.stringify(frontmatter),
    "---",
    "",
    config.prompt,
  ].join("\n");

  const path = `/tmp/agents/${config.name}-${Date.now()}.md`;
  fs.writeFileSync(path, content);
  return path;
}
```

**Tool permission mapping:**
Claude Code uses `.claude/settings.json` for allowed tools:
```json
{
  "allowedTools": ["Read", "Write", "Bash", "WebSearch"],
  "blockedTools": ["Edit"]  // orchestrator-only: no direct edits
}
```
The adapter maps generic tool names to Claude-specific ones:
```typescript
const CLAUDE_TOOL_MAP = {
  "read": "Read",
  "write": "Write",
  "bash": "Bash",
  "web_search": "WebSearch",
  "edit": "Edit",
};
```

**Output parsing:**
Claude Code outputs to stdout. Less structured than Codex. Need to parse:
- Exit code (0 = success, 1 = failure, 2 = timeout)
- Stdout for results (may contain markdown, JSON, or free text)
- File modifications (detected via git diff after execution)

**Session management:**
```typescript
const sessionId = await exec("claude --agent ... --json");
// Resume
await exec(`claude resume ${sessionId} --json "${instruction}"`);
```

**What is missing for us:**
- YAML frontmatter generation (need yaml library or template string)
- Tool name translation (our generic names to Claude-specific)
- Settings.json generation per project (tool permissions)
- MCP server configuration (Context7, Memory MCP, etc. in .claude/mcp.json)
- Output parsing is less structured than Codex -- need robust regex/JSON extraction

**Estimated lines:** ~200 TypeScript

---

### Gemini CLI (Google)

**How it works:**
Gemini CLI is newer, less mature. Agent file format is markdown with headers (not YAML frontmatter). Supports basic tool permissions via CLI flags. NO session resume yet (as of March 2026).

**Spawn command construction:**
```typescript
function toGeminiCommand(config: AgentConfig): string {
  const agentFile = writeGeminiAgentFile(config);

  const parts = [
    "gemini",
    `--agent ${agentFile}`,
    `--model ${config.model}`,
  ];

  // Gemini uses CLI flags for tool permissions
  if (config.tools.includes("web_search")) {
    parts.push("--enable-web-search");
  }

  return parts.join(" ");
}

function writeGeminiAgentFile(config: AgentConfig): string {
  // Gemini uses markdown headers, not YAML frontmatter
  const content = [
    `# ${config.name}`,
    "",
    `## Role`,
    config.role,
    "",
    `## Instructions`,
    config.prompt,
  ].join("\n");

  const path = `/tmp/agents/${config.name}-${Date.now()}.md`;
  fs.writeFileSync(path, content);
  return path;
}
```

**Output parsing:**
Gemini CLI outputs structured text to stdout. Format still evolving.
```typescript
// Parse Gemini output -- format may change
function parseGeminiOutput(stdout: string): AgentResult {
  try {
    return JSON.parse(stdout); // If --json flag supported
  } catch {
    return {
      status: stdout.includes("Error") ? "failed" : "completed",
      output: stdout,
      files_modified: detectModifiedFiles(), // git diff
    };
  }
}
```

**Critical limitation:** No session resume. Every Gemini agent is a fresh spawn. This means:
- Cannot maintain Conductor as persistent Gemini session
- Gemini is best for WORKER tasks (short-lived, task-scoped)
- For orchestration, use Codex or Claude Code

**Model routing:**
```typescript
const GEMINI_MODELS = {
  fast: "gemini-flash",      // Quick tasks, large context
  standard: "gemini-pro",    // Default
  reasoning: "gemini-pro",   // No separate reasoning model yet
};
```

**What is missing for us:**
- Session resume (not available; work around with fresh spawns)
- Agent file format validation (format still evolving, may change)
- Tool permission mapping (fewer tools than Codex/Claude)
- Google auth integration (separate from our OAuth flow)
- Output format stability (CLI is pre-1.0, output format may change)

**Estimated lines:** ~200 TypeScript (simpler because fewer features)

---

### ChatGPT Web (BrowserView)

**How it works:**
Not a CLI adapter. This is the Electron BrowserView pointed at chat.openai.com. We inject messages, capture responses, and extract content programmatically.

**This is NOT an agent adapter.** It is a web executor. The "agent" is the user's ChatGPT Plus subscription. We route to it for:
- Intake quiz (natural conversation)
- Image generation (DALL-E)
- Web search (ChatGPT browsing)
- Content writing (blog posts, copy)

**Implementation:**
```typescript
class WebExecutor {
  private view: BrowserView;

  async execute(step: DAGStep): Promise<StepResult> {
    // Inject message into ChatGPT input
    await this.view.webContents.executeJavaScript(`
      document.querySelector('textarea').value = '${escapeJS(step.detail)}';
      document.querySelector('form button[type=submit]').click();
    `);

    // Wait for response
    const response = await this.waitForResponse();

    // Extract content (text, images, files)
    return this.parseResponse(response);
  }

  private async waitForResponse(): Promise<string> {
    // Poll for completion indicator
    // ChatGPT shows a "stop generating" button while running
    // When it disappears, response is complete
  }
}
```

**What is missing:**
- Robust response detection (ChatGPT UI changes break selectors)
- Image extraction (DALL-E images are in specific DOM elements)
- Rate limit detection (regex patterns for limit messages)
- File download handling (code interpreter outputs)
- Multi-turn conversation management (maintain context across steps)

**Estimated lines:** ~300 TypeScript (most complex because it is browser automation, not CLI)

---

## Summary: What We Need to Build

| Adapter | Lines | Difficulty | Blockers |
|---------|-------|-----------|----------|
| Codex CLI | ~250 | Medium | Session persistence, timeout handling |
| Claude Code | ~200 | Medium | YAML frontmatter, MCP config, output parsing |
| Gemini CLI | ~200 | Easy (fewer features) | No session resume, format instability |
| ChatGPT Web | ~300 | Hard (browser automation) | Selector fragility, rate limits |
| **Total** | **~950** | **2-3 days** | Auth (handled by Gate 6) |

---

## Key Principles

1. **Adapters are the ONLY runtime-specific code.** Everything else is agnostic.
2. **Same AgentConfig, different output.** Conductor does not know which runtime will execute.
3. **Fallback order:** Codex (primary CLI) > Claude Code (secondary CLI) > Gemini (tertiary). ChatGPT Web for non-code tasks only.
4. **Session resume is a feature, not a requirement.** Gemini works without it (fresh spawn per task).
5. **Output normalization:** Every adapter returns the same AgentResult interface regardless of runtime.
6. **Auth is NOT the adapter's job.** Gate 6 handles OAuth. Adapter reads tokens from env vars.

```typescript
interface AgentResult {
  status: "completed" | "failed" | "timeout" | "killed";
  output: string;
  filesModified: string[];
  tokensUsed: { input: number; output: number };
  duration: number;  // milliseconds
  runtime: "codex" | "claude" | "gemini" | "chatgpt-web";
}
```
