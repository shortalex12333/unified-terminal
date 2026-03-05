# Engineer Handoff: Codex Adapter Integration

**Date:** 2026-03-04
**From:** Claude Code (Adapter Development)
**To:** Engineer connecting dissection plugin with adapter

---

## Summary

The Codex Adapter is complete and verified. It spawns Codex CLI in non-interactive (`exec`) mode, allowing Unified Terminal to execute autonomous agents programmatically.

**Status:** ✅ Verified working (user ran tests, all pass)

---

## What Was Built

```
docs/ONGOING_WORK/ADAPTORS/codex-adapter/
├── index.ts      # Public exports
├── types.ts      # Type definitions
├── adapter.ts    # Core implementation
├── verify.ts     # Verification script
└── README.md     # Full documentation
```

---

## How It Works

### The Problem We Solved

Codex CLI has two modes:
- **Interactive mode** (`codex "prompt"`) — Requires TTY, waits for human input
- **Exec mode** (`codex exec "prompt"`) — Non-interactive, works with pipes

For autonomous agents, we need exec mode.

### The Solution

```
Unified Terminal                    Codex CLI
     │                                  │
     │  spawn('codex', ['exec', ...])   │
     │─────────────────────────────────▶│
     │                                  │
     │  stdin.write(prompt)             │
     │─────────────────────────────────▶│
     │                                  │
     │  stdout (JSONL events)           │
     │◀─────────────────────────────────│
     │                                  │
     │  exit code                       │
     │◀─────────────────────────────────│
```

### CLI Command Generated

```bash
codex exec --full-auto --json --sandbox <mode> -C <workingDir>
```

Where `<mode>` is:
- `read-only` — if tools only include read/grep/glob
- `workspace-write` — if tools include write/edit

---

## Integration Points

### 1. Import the Adapter

```typescript
import {
  spawnCodexAgent,
  isCodexAvailable,
  AgentConfig,
  AgentResult,
  AgentHandle
} from '../docs/ONGOING_WORK/ADAPTORS/codex-adapter';
```

Or copy the folder to `src/main/codex-adapter/` and import from there.

### 2. Check Availability

```typescript
const available = await isCodexAvailable();
if (!available) {
  // Codex CLI not installed or not authenticated
  // Fall back to web adapter or show error
}
```

### 3. Spawn an Agent

```typescript
const handle = spawnCodexAgent({
  id: 'unique-task-id',
  name: 'gsd-executor',
  prompt: 'Your prompt here...',
  tools: ['read', 'write', 'bash'],
  workingDir: '/path/to/project',
  timeout: 120000,
});
```

### 4. Handle Output

```typescript
// Option A: Stream output in real-time
handle.onOutput((chunk) => {
  // Forward to UI, log, etc.
  console.log(chunk);
});

// Option B: Wait for completion
const result = await handle.onComplete();
```

### 5. Process Result

```typescript
const result = await handle.onComplete();

if (result.status === 'completed') {
  // Success
  console.log('Output:', result.output);
  console.log('Files created:', result.filesCreated);
  console.log('Files modified:', result.filesModified);
} else {
  // Failed, timeout, or killed
  console.error('Error:', result.error);
}
```

### 6. Kill if Needed

```typescript
// User cancels, timeout, etc.
handle.kill();

// Result will have status: 'killed'
const result = await handle.onComplete();
```

---

## Connection to Conductor System

The existing Conductor (`src/main/conductor.ts`) creates execution plans with steps like:

```typescript
{
  id: 1,
  target: 'cli',
  action: 'codex_build',
  detail: 'Create React component',
  ...
}
```

**Integration:** When `target === 'cli'`, use the Codex Adapter:

```typescript
// In step-scheduler.ts or cli-executor.ts
import { spawnCodexAgent } from './codex-adapter';

async function executeCliStep(step: Step): Promise<StepResult> {
  const handle = spawnCodexAgent({
    id: step.id.toString(),
    name: step.action,
    prompt: step.detail,
    tools: determineTools(step.action), // Map action to tools
    workingDir: projectDir,
  });

  return handle.onComplete();
}
```

---

## Tool Permissions Mapping

| Plugin/Action | Tools | Sandbox Mode |
|---------------|-------|--------------|
| `code-reviewer` | `['read']` | `read-only` |
| `security-reviewer` | `['read']` | `read-only` |
| `gsd-executor` | `['read', 'write', 'bash']` | `workspace-write` |
| `gsd-planner` | `['read', 'write', 'grep']` | `workspace-write` |
| `codex_build` | `['read', 'write']` | `workspace-write` |
| `codex_scaffold` | `['read', 'write', 'bash']` | `workspace-write` |

---

## Important Notes

### 1. No Model Flag by Default

ChatGPT accounts (subscription-based, not API) have limited model access. The adapter does NOT pass a model flag unless explicitly specified, allowing Codex to use its default.

### 2. Prompt via stdin

The prompt is piped via stdin, not as a CLI argument. This handles large prompts that would exceed CLI arg length limits.

### 3. JSONL Output

Codex outputs JSONL (one JSON object per line). The adapter parses this to extract file operations. Raw output is also available in `result.output`.

### 4. Timeout Handling

Default timeout is 2 minutes. After timeout:
1. SIGTERM is sent
2. If still running after 5s, SIGKILL is sent
3. Result status will be `'timeout'`

### 5. User Auth

Users authenticate Codex interactively once (`codex` in terminal). After that, `codex exec` uses the stored session. No API keys needed.

---

## Verification

To verify the adapter works:

```bash
cd /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/codex-adapter
npx ts-node verify.ts
```

This runs unit tests (pure logic) and integration tests (actual Codex spawn).

---

## File Locations

| File | Purpose |
|------|---------|
| `codex-adapter/index.ts` | Public API |
| `codex-adapter/types.ts` | Type definitions |
| `codex-adapter/adapter.ts` | Core implementation |
| `codex-adapter/verify.ts` | Verification script |
| `codex-adapter/README.md` | Full documentation |

---

## Questions?

The adapter is self-contained. Read `adapter.ts` (~150 lines) for the full implementation. The `verify.ts` script shows exactly how to use it.

Key functions:
- `spawnCodexAgent(config)` — Spawn an agent
- `isCodexAvailable()` — Check if CLI is ready
- `getSandboxMode(tools)` — Determine sandbox from permissions

---

## What About Gemini?

Gemini CLI requires interactive OAuth (browser popup) even in headless mode. For Gemini tasks, use the **Web Adapter** (BrowserView DOM injection) instead. The user already authenticates via BrowserView when they log into gemini.google.com.

**Topology:**
- **Codex** → CLI Adapter (this)
- **Gemini** → Web Adapter (BrowserView)
- **ChatGPT** → Web Adapter (BrowserView)
