# Runtime Adapters

Translates universal `AgentConfig` interface to runtime-specific CLI commands.

## Quick Start

```typescript
import { getAdapter, selectRuntime } from './src/factory';

// Get specific adapter
const codex = getAdapter('codex');
const gemini = getAdapter('gemini');

// Or let factory choose based on requirements
const runtime = await selectRuntime(
  needsSessionResume: false,  // Gemini can't resume
  preferredRuntime: 'codex'   // Optional preference
);

// Spawn an agent
const handle = await codex.spawn({
  id: 'task-123',
  name: 'gsd-executor',
  role: 'Execute the plan',
  model: 'gpt-5-codex',
  tools: ['read', 'write', 'bash'],
  maxTokens: 4096,
  prompt: 'Implement feature X according to PLAN.md',
  declaredFiles: ['src/feature.ts'],
  workingDir: '/path/to/project',
  timeout: 120000,
  target: 'codex',
});

// Stream output
handle.onOutput((chunk) => console.log(chunk));

// Wait for completion
const result = await handle.onComplete();
console.log(result.status);        // 'completed' | 'failed' | 'timeout' | 'killed'
console.log(result.filesModified); // ['src/feature.ts']
```

## Architecture

```
src/
├── types.ts          # Universal types (AgentConfig, AgentResult, Adapter)
├── permissions.ts    # Tool permissions + plugin requirements
├── factory.ts        # Adapter factory + runtime selection
├── codex/
│   └── adapter.ts    # Codex CLI adapter
└── gemini/
    └── adapter.ts    # Gemini CLI adapter

tests/
└── harness.ts        # Unified verification harness
```

## Key Concepts

### Claude Code is Native

Claude Code is the **native runtime** - no adapter needed. These adapters enable plugins designed for Claude Code to run on other runtimes.

### Runtimes

| Runtime | Session Resume | Role |
|---------|---------------|------|
| Claude Code | Yes | Native (no adapter) |
| Codex | Yes | Conductor or Worker |
| Gemini | **No** | Worker only |

### Tool Permissions

Tools are mapped to runtime-specific sandbox/approval modes:

| Tools | Codex | Gemini |
|-------|-------|--------|
| read-only | `--sandbox read-only` | `--approval-mode plan --sandbox` |
| includes write | `--sandbox workspace-write` | `--approval-mode yolo` |

### Plugin Requirements

See `src/permissions.ts` for canonical tool requirements per plugin.

Critical rules:
- `code-reviewer` and `security-reviewer` **MUST** be read-only
- `gsd-planner` and `gsd-verifier` are **NOT** read-only (they write docs)

## Verification

```bash
npx ts-node tests/harness.ts
```

Expected output: All tests pass (VERDICT: PASS)

## Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Universal types |
| `src/permissions.ts` | Tool permissions |
| `src/factory.ts` | Adapter factory |
| `src/codex/adapter.ts` | Codex implementation |
| `src/gemini/adapter.ts` | Gemini implementation |
| `tests/harness.ts` | Verification tests |
| `COMPATIBILITY.md` | Plugin compatibility matrix |
