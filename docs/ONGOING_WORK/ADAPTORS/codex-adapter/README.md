# Codex Adapter

Spawns Codex CLI in exec (non-interactive) mode for autonomous agent execution within Unified Terminal.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UNIFIED TERMINAL (Electron Main Process)                   │
│                                                             │
│  spawnCodexAgent(config)                                    │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CODEX ADAPTER                                       │   │
│  │                                                      │   │
│  │  1. Build CLI args from config                       │   │
│  │  2. Spawn: codex exec --full-auto --json ...         │   │
│  │  3. Pipe prompt via stdin                            │   │
│  │  4. Stream output via callbacks                      │   │
│  │  5. Parse JSONL for file operations                  │   │
│  │  6. Return structured result                         │   │
│  └─────────────────────────────────────────────────────┘   │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CODEX CLI (Child Process)                           │   │
│  │                                                      │   │
│  │  stdin  ← prompt                                     │   │
│  │  stdout → JSONL events                               │   │
│  │  stderr → error messages                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Files

```
codex-adapter/
├── index.ts      # Public API exports
├── types.ts      # Type definitions (AgentConfig, AgentResult, etc.)
├── adapter.ts    # Core implementation (spawnCodexAgent, isCodexAvailable)
├── verify.ts     # Verification script (run from terminal)
└── README.md     # This file
```

## Usage

### Basic Example

```typescript
import { spawnCodexAgent, isCodexAvailable } from './codex-adapter';

// Check if Codex is available
if (await isCodexAvailable()) {
  // Spawn an agent
  const handle = spawnCodexAgent({
    id: 'task-001',
    name: 'code-reviewer',
    prompt: 'Review the code in src/index.ts for bugs',
    tools: ['read'],           // read-only = sandbox read-only
    workingDir: '/path/to/project',
    timeout: 60000,            // 1 minute
  });

  // Stream output
  handle.onOutput((chunk) => {
    console.log('[Codex]', chunk);
  });

  // Wait for completion
  const result = await handle.onComplete();

  console.log('Status:', result.status);      // 'completed' | 'failed' | 'timeout' | 'killed'
  console.log('Exit code:', result.exitCode); // 0 = success
  console.log('Output:', result.output);
}
```

### With Write Access

```typescript
const handle = spawnCodexAgent({
  id: 'task-002',
  name: 'code-generator',
  prompt: 'Create a React component called UserProfile',
  tools: ['read', 'write'],    // write access = sandbox workspace-write
  workingDir: '/path/to/project',
});

const result = await handle.onComplete();

console.log('Files created:', result.filesCreated);
console.log('Files modified:', result.filesModified);
```

### Kill a Running Agent

```typescript
const handle = spawnCodexAgent({ ... });

// Kill after 10 seconds
setTimeout(() => {
  handle.kill();
}, 10000);

const result = await handle.onComplete();
console.log(result.status); // 'killed'
```

## API Reference

### `spawnCodexAgent(config: AgentConfig): AgentHandle`

Spawns a Codex agent with the given configuration.

**AgentConfig:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this agent |
| `name` | string | Yes | Human-readable name for logging |
| `prompt` | string | Yes | The instruction to execute |
| `tools` | Tool[] | Yes | Permissions: `['read']`, `['read', 'write']`, etc. |
| `workingDir` | string | Yes | Working directory for file operations |
| `timeout` | number | No | Max execution time in ms (default: 120000) |
| `model` | string | No | Model override (default: Codex default) |
| `env` | Record | No | Additional environment variables |

**AgentHandle:**

| Method | Description |
|--------|-------------|
| `onOutput(cb)` | Register callback for streaming output |
| `onComplete()` | Returns Promise<AgentResult> when done |
| `kill()` | Terminate the agent |

**AgentResult:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Matches config.id |
| `status` | Status | `'completed'` \| `'failed'` \| `'timeout'` \| `'killed'` |
| `exitCode` | number \| null | Process exit code |
| `output` | string | Full output from agent |
| `duration` | number | Execution time in ms |
| `error` | string? | Error message if not completed |
| `filesCreated` | string[] | Files created during execution |
| `filesModified` | string[] | Files modified during execution |

### `isCodexAvailable(): Promise<boolean>`

Checks if Codex CLI is installed and responding.

### `getSandboxMode(tools: Tool[]): SandboxMode`

Determines sandbox mode from tool permissions.

| Tools | Sandbox Mode |
|-------|--------------|
| `['read']` | `read-only` |
| `['read', 'grep']` | `read-only` |
| `['read', 'write']` | `workspace-write` |
| `['read', 'edit']` | `workspace-write` |

## CLI Command Generated

The adapter generates this command:

```bash
codex exec --full-auto --json --sandbox <mode> -C <workingDir> [-m <model>]
```

With prompt piped via stdin.

## Verification

Run from terminal (not inside Claude Code):

```bash
cd /path/to/codex-adapter
npx ts-node verify.ts
```

Expected output:

```
╔════════════════════════════════════════════════════════════╗
║           CODEX ADAPTER VERIFICATION                       ║
╚════════════════════════════════════════════════════════════╝

📋 UNIT TESTS (Pure Logic)

✅ getSandboxMode([read]) = read-only
✅ getSandboxMode([read, grep]) = read-only
✅ getSandboxMode([read, write]) = workspace-write
✅ getSandboxMode([read, edit]) = workspace-write

📋 INTEGRATION TESTS (Requires Codex CLI)

✅ Codex CLI is available
✅ Spawn agent with simple prompt

════════════════════════════════════════════════════════════
  SUMMARY
════════════════════════════════════════════════════════════
  Total:  6
  Passed: 6 ✅
  Failed: 0

  VERDICT: ✅ ALL TESTS PASS
```

## Key Decisions

1. **exec mode, not interactive** - Non-interactive mode works with pipes, doesn't require TTY
2. **--json flag** - Structured JSONL output for parsing file operations
3. **--full-auto** - No human approval prompts
4. **Prompt via stdin** - Handles large prompts (CLI args have length limits)
5. **No model by default** - ChatGPT accounts have limited model access; use Codex default
