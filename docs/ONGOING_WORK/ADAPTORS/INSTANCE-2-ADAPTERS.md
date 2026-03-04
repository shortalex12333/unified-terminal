# INSTANCE 2: RUNTIME ADAPTERS

## Current Status (2026-03-03)

**STATUS: CODEX + GEMINI COMPLETE**

| Component | Status | Tests |
|-----------|--------|-------|
| types.ts | ✅ Complete | - |
| permissions.ts | ✅ Complete | 6/6 |
| factory.ts | ✅ Complete | - |
| Codex adapter | ✅ Complete | 10/10 |
| Gemini adapter | ✅ Complete | 10/10 |
| Claude adapter | ⏭️ SKIPPED | Native runtime |
| ChatGPT Web adapter | ⏳ Pending | Day 4 |
| Verification harness | ✅ **34/34 PASS** | - |

### Key Decisions

1. **Claude adapter NOT needed** — Claude Code is the native runtime. Adapters translate TO other runtimes.
2. **Gemini is Worker-only** — Cannot resume sessions. Exit code 41 = auth required.
3. **gsd-planner and gsd-verifier are NOT read-only** — They write PLAN.md and VERIFICATION.md.

---

## Architecture

```
src/
├── index.ts           # Public API exports
├── types.ts           # Universal types (single source of truth)
├── permissions.ts     # Tool permissions + plugin requirements
├── factory.ts         # Adapter factory + runtime selection
├── codex/
│   └── adapter.ts     # Codex CLI adapter (~150 lines)
└── gemini/
    └── adapter.ts     # Gemini CLI adapter (~170 lines)

tests/
└── harness.ts         # Unified verification harness (34 tests)
```

---

## Runtime Capabilities

| Capability | Codex | Gemini | ChatGPT Web |
|------------|-------|--------|-------------|
| Session Resume | ✅ Yes | ❌ No | ❌ No |
| JSON Output | ✅ Yes | ✅ Yes | ❌ No |
| Tool Permissions | ✅ Yes | ✅ Yes | ❌ No |
| Max Tokens | 200K | 2M | Unlimited |
| Models | gpt-4o, o3-mini | gemini-2.0-flash/pro | GPT-4o |

### Sandbox/Approval Mode Mapping

| Tools | Codex | Gemini |
|-------|-------|--------|
| read-only | `--sandbox read-only` | `--approval-mode plan --sandbox` |
| includes write | `--sandbox workspace-write` | `--approval-mode yolo` |

---

## Plugin Compatibility

| Plugin | Codex | Gemini | ChatGPT Web |
|--------|-------|--------|-------------|
| **GSD Workers** ||||
| gsd-executor | ✅ | ✅ | ❌ |
| gsd-planner | ✅ | ✅ | ❌ |
| gsd-researcher | ✅ | ✅ | ✅ |
| gsd-debugger | ✅ | ✅ | ❌ |
| gsd-verifier | ✅ | ✅ | ❌ |
| gsd-codebase-mapper | ✅ | ✅ | ❌ |
| **Code Quality** ||||
| code-reviewer | ✅ | ✅ | ❌ |
| security-reviewer | ✅ | ✅ | ❌ |
| tdd-guide | ✅ | ✅ | ❌ |
| build-error-resolver | ✅ | ✅ | ❌ |
| doc-updater | ✅ | ✅ | ❌ |
| **Deployment** ||||
| worker-deploy | ✅ | ✅ | ❌ |
| worker-scaffold | ✅ | ✅ | ❌ |
| **Design** ||||
| skill-frontend-design | ✅ | ✅ | ❌ |
| **Special** ||||
| worker-image-gen | ❌ | ❌ | ✅ |
| worker-web-research | ✅ | ❌ | ✅ |

---

## Verification Results (2026-03-03)

```
╔════════════════════════════════════════════════════════════╗
║     UNIFIED ADAPTER VERIFICATION HARNESS                    ║
╚════════════════════════════════════════════════════════════╝

📋 Permission Logic Tests
✅ isReadOnly([read]) = true
✅ isReadOnly([read, bash]) = true
✅ isReadOnly([read, write]) = false
✅ isReadOnly([read, edit]) = false
✅ hasWritePermission([read]) = false
✅ hasWritePermission([write]) = true

📋 Codex Sandbox Mapping Tests
✅ getCodexSandbox([read]) = read-only
✅ getCodexSandbox([read, bash]) = read-only
✅ getCodexSandbox([read, write]) = workspace-write
✅ getCodexSandbox([read, write, bash]) = workspace-write

📋 Gemini Approval Mapping Tests
✅ getGeminiApproval([read]) = plan
✅ getGeminiApproval([read, bash]) = plan
✅ getGeminiApproval([read, write]) = yolo
✅ getGeminiApproval([read, write, bash]) = yolo

📋 Plugin Requirements Tests
✅ code-reviewer is read-only
✅ security-reviewer is read-only
✅ gsd-planner is NOT read-only (writes PLAN.md)
✅ gsd-verifier is NOT read-only (writes VERIFICATION.md)
✅ gsd-planner has write tool
✅ gsd-verifier has write tool

📋 Adapter Capability Tests
✅ Codex supports session resume
✅ Codex supports JSON output
✅ Gemini does NOT support session resume
✅ Gemini supports JSON output
✅ Codex supports grep tool
✅ Gemini supports grep tool

📋 Plugin Compatibility Tests
✅ gsd-executor compatible with Codex
✅ gsd-executor compatible with Gemini
✅ code-reviewer compatible with Codex
✅ code-reviewer compatible with Gemini
✅ worker-image-gen NOT compatible with Codex
✅ worker-image-gen NOT compatible with Gemini

📋 Adapter Availability Tests
✅ Codex availability check runs
✅ Gemini availability check runs
   Codex available: true
   Gemini available: true

════════════════════════════════════════════════════════════
                    VERIFICATION SUMMARY
════════════════════════════════════════════════════════════
Total: 34
Passed: 34
Failed: 0

VERDICT: ✅ PASS
```

---

## Implementation Timeline

| Day | Task | Status |
|-----|------|--------|
| 1 | types.ts + Codex adapter | ✅ Complete |
| 2 | Claude adapter | ⏭️ SKIPPED (native) |
| 3 | Gemini adapter | ✅ Complete |
| 4 | ChatGPT Web adapter | ⏳ Pending |
| 5 | Integration + Factory | ⏳ Pending |

---

## Files Delivered

```
ADAPTORS/
├── README.md              # Usage documentation
├── COMPATIBILITY.md       # Plugin compatibility matrix
├── INSTANCE-2-ADAPTERS.md # This document
├── tsconfig.json          # TypeScript configuration
├── src/
│   ├── index.ts           # Public API exports
│   ├── types.ts           # Universal types
│   ├── permissions.ts     # Tool permissions + plugin requirements
│   ├── factory.ts         # Adapter factory
│   ├── codex/
│   │   └── adapter.ts     # Codex CLI adapter
│   └── gemini/
│       └── adapter.ts     # Gemini CLI adapter
└── tests/
    └── harness.ts         # Unified verification harness
```

---

## Usage

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
  model: 'gpt-4o',
  tools: ['read', 'write', 'bash'],
  maxTokens: 4096,
  prompt: 'Implement feature X according to PLAN.md',
  declaredFiles: ['src/feature.ts'],
  workingDir: '/path/to/project',
  timeout: 120000,
  target: 'codex',
});

// Wait for completion
const result = await handle.onComplete();
console.log(result.status);        // 'completed' | 'failed' | 'timeout' | 'killed'
console.log(result.filesModified); // ['src/feature.ts']
```

---

## Next Steps

1. **Day 4: ChatGPT Web adapter** — DOM injection/extraction for DALL-E image generation
2. **Day 5: Integration testing** — End-to-end DAG execution across runtimes

---

## Critical Constraints

1. **Gemini cannot be Conductor** — No session resume = Worker only
2. **code-reviewer/security-reviewer MUST be read-only** — Enforced at spawn time
3. **gsd-planner/gsd-verifier write docs** — NOT read-only (writes PLAN.md, VERIFICATION.md)
4. **Large prompts via stdin** — CLI arg limits ~4096 chars, use stdin for >2000 chars
