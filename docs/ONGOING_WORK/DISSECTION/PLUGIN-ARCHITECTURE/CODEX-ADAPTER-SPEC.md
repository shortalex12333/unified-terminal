# Codex Adapter Specification

## Purpose

Translate our universal skill format into Codex CLI native format. Codex is the PRIMARY execution runtime for workers and phases.

---

## The Universal Interface

Every skill follows this structure:

```typescript
interface SkillConfig {
  name: string;
  triggers: string[];
  runtime: 'codex' | 'claude' | 'gemini' | 'chatgpt' | 'any';
  model?: string;
  tools: string[];
  maxTokens?: number;
  prompt: string;      // The full skill content
}
```

The adapter translates this to Codex's native format.

---

## Codex Native Format

Codex uses `.codex/skills/{skill-name}/SKILL.md` with frontmatter:

```markdown
---
name: skill-name
description: One line description
model: o3  # or o4-mini, etc.
tools:
  - shell
  - file
  - web_search
---

{skill content}
```

---

## Translation Table

| Universal | Codex Native |
|-----------|--------------|
| `name` | `name` (same) |
| `triggers` | Not used (handled by our Skill Injector) |
| `runtime: codex` | Include in Codex skills |
| `runtime: any` | Include in Codex skills |
| `runtime: chatgpt` | Exclude from Codex (route to web) |
| `model: sonnet` | `model: o4-mini` (cheaper) |
| `model: opus` | `model: o3` (powerful) |
| `model: haiku` | `model: o4-mini` (cheapest) |
| `read file` | `tools: [file]` |
| `write file` | `tools: [file]` |
| `execute command` | `tools: [shell]` |
| `web search` | `tools: [web_search]` |
| `spawn agent` | `codex` subprocess |

---

## Skills That Run on Codex

| Skill | Model | Tools |
|-------|-------|-------|
| gsd-executor | o3 | shell, file |
| gsd-planner | o3 | file |
| gsd-debugger | o3 | shell, file |
| gsd-verifier | o3 | shell, file |
| gsd-researcher | o4-mini | file, web_search |
| gsd-codebase-mapper | o3 | file |
| tdd-guide | o4-mini | shell, file |
| code-reviewer | o4-mini | file |
| security-reviewer | o4-mini | shell, file |
| build-error-resolver | o4-mini | shell, file |
| doc-updater | o4-mini | file |
| discuss | o3 | file |
| plan | o3 | file |
| execute | o3 | shell, file |
| verify | o3 | shell, file |
| unify | o4-mini | file |

---

## Skills That Route Elsewhere

| Skill | Routes To | Why |
|-------|-----------|-----|
| web-researcher | ChatGPT | Needs native browsing |
| worker-image-gen | ChatGPT | Needs DALL-E |
| frontend-design | Any (BM25 is local) | No LLM needed for query |

---

## Adapter Code Pattern

```typescript
// codex-adapter.ts

interface UniversalSkill {
  name: string;
  triggers: string[];
  runtime: string;
  model?: string;
  prompt: string;
}

function toCodexSkill(skill: UniversalSkill): string {
  // Map model names
  const modelMap: Record<string, string> = {
    'opus': 'o3',
    'sonnet': 'o4-mini',
    'haiku': 'o4-mini',
    'default': 'o4-mini'
  };

  // Extract tools from prompt content
  const tools = extractTools(skill.prompt);

  // Generate Codex frontmatter
  return `---
name: ${skill.name}
description: ${extractDescription(skill.prompt)}
model: ${modelMap[skill.model || 'default']}
tools:
${tools.map(t => `  - ${t}`).join('\n')}
---

${skill.prompt}`;
}

function extractTools(prompt: string): string[] {
  const tools: string[] = [];
  if (prompt.includes('execute') || prompt.includes('npm') || prompt.includes('git')) {
    tools.push('shell');
  }
  if (prompt.includes('read') || prompt.includes('write') || prompt.includes('file')) {
    tools.push('file');
  }
  if (prompt.includes('search') || prompt.includes('web')) {
    tools.push('web_search');
  }
  return tools.length ? tools : ['file']; // Default to file access
}
```

---

## Session Management

### Persistent Router Session

The Conductor maintains a persistent Codex session for classification:

```bash
# First message - session created
codex chat "Classify this task: {user_message}"
# Returns session_id in response

# Subsequent messages - resume session
codex resume {session_id}
codex chat "User wants to add a contact form"
```

**Session persists across:**
- Multiple user messages
- Context window warnings
- Rate limit recoveries

**Session resets on:**
- Project completion
- Explicit user reset
- 24-hour inactivity

### Worker Sessions

Workers get fresh sessions (no persistence):

```bash
# One-shot execution
codex run --model o3 --skill gsd-executor "Execute plan 1 of phase 3"
```

Workers don't need history. They receive their full context pre-loaded.

---

## Rate Limit Handling

When Codex returns rate limit error:

1. **Defer message** to queue
2. **Set timer** for retry (exponential backoff)
3. **Notify user** if > 3 retries
4. **Switch model** if available (o3 → o4-mini)

```typescript
async function handleRateLimit(error: CodexError) {
  if (error.code === 'RATE_LIMITED') {
    const delay = Math.min(2 ** retryCount * 1000, 60000);
    await sleep(delay);

    if (retryCount > 3) {
      // Try cheaper model
      return retry({ model: 'o4-mini' });
    }
    return retry();
  }
}
```

---

## Context Window Management

### Thresholds (from ENFORCER.json)

| Situation | Action |
|-----------|--------|
| Usage < 55% | Continue normally |
| Usage 55-85% | Summarize at next natural break |
| Usage > 85% AND task > 85% done | Let finish |
| Usage > 85% AND task < 85% done | Kill, summarize, respawn |

### Kill and Respawn Pattern

```typescript
async function handleContextOverflow(session: CodexSession) {
  // 1. Extract summary from current session
  const summary = await session.chat(
    "Summarize your work so far in 200 tokens. Include: what's done, what's next, any blockers."
  );

  // 2. Kill session
  await session.terminate();

  // 3. Spawn fresh session with summary
  const newSession = await codex.run({
    model: session.model,
    skill: session.skill,
    context: `Previous work summary: ${summary}\n\nContinue from where you left off.`
  });

  return newSession;
}
```

---

## Command Reference

### Basic Commands

```bash
# Start interactive session
codex chat "message"

# Resume existing session
codex resume {session_id}

# One-shot execution
codex run "task description"

# Run with specific model
codex run --model o3 "task"

# Run with skill loaded
codex run --skill gsd-executor "task"

# Full auto mode (no confirmation prompts)
codex run --full-auto "task"
```

### Skill Commands

```bash
# List available skills
codex skills list

# Show skill content
codex skills show gsd-executor

# Run with skill
codex run --skill gsd-debugger "Debug: npm test returns exit code 1"
```

### Session Commands

```bash
# List sessions
codex sessions list

# Get session status
codex sessions status {session_id}

# Terminate session
codex sessions kill {session_id}
```

---

## Integration with Unified Terminal

### IPC Handlers

```typescript
// In main process
ipcMain.handle('codex:classify', async (event, message) => {
  return conductor.classify(message);
});

ipcMain.handle('codex:run', async (event, { skill, task }) => {
  return codexAdapter.run(skill, task);
});

ipcMain.handle('codex:resume', async (event, sessionId) => {
  return codexAdapter.resume(sessionId);
});
```

### Renderer Calls

```typescript
// In renderer
const classification = await window.electronAPI.codex.classify(userMessage);

if (classification.executor === 'cli') {
  const result = await window.electronAPI.codex.run({
    skill: classification.skill,
    task: userMessage
  });
}
```

---

## Error Handling

| Error | Recovery |
|-------|----------|
| `RATE_LIMITED` | Exponential backoff, model downgrade |
| `CONTEXT_OVERFLOW` | Kill, summarize, respawn |
| `AUTH_FAILED` | Redirect to auth screen |
| `SKILL_NOT_FOUND` | Fall back to default skill |
| `TIMEOUT` | Retry with shorter task |

---

## File Structure for Codex Skills

```
.codex/
├── skills/
│   ├── gsd-executor/
│   │   └── SKILL.md
│   ├── gsd-planner/
│   │   └── SKILL.md
│   ├── gsd-debugger/
│   │   └── SKILL.md
│   └── ... (16 total)
├── config.json          # Model defaults, rate limits
└── sessions/            # Persisted session data
    └── {session_id}.json
```

---

## Testing Codex Integration

```bash
# Test skill loading
codex run --skill gsd-executor --dry-run "Test task"

# Test session persistence
codex chat "Start a project"
# Note session_id
codex resume {session_id}
codex chat "Continue"

# Test rate limit handling
for i in {1..20}; do codex run "Quick task $i"; done

# Test context overflow
codex run --skill gsd-executor "Generate a 50,000 word essay"
```
