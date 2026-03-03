# Plugin Compatibility Matrix

## Runtime Capabilities

| Capability | Claude Code | Codex | Gemini |
|------------|-------------|-------|--------|
| Session Resume | ✅ Yes | ✅ Yes | ❌ No |
| JSON Output | ✅ Yes | ✅ Yes | ✅ Yes |
| Tool Permissions | ✅ Yes | ✅ Yes | ✅ Yes |
| Max Tokens | 200K | 200K | 2M |

**Note:** Claude Code is native (no adapter needed). Codex and Gemini use adapters.

## Plugin Compatibility

| Plugin | Codex | Gemini | Notes |
|--------|-------|--------|-------|
| **GSD Workers** ||||
| gsd-executor | ✅ | ✅ | |
| gsd-planner | ✅ | ✅ | Writes PLAN.md |
| gsd-researcher | ✅ | ✅ | Web search only |
| gsd-debugger | ✅ | ✅ | |
| gsd-verifier | ✅ | ✅ | Writes VERIFICATION.md |
| gsd-codebase-mapper | ✅ | ✅ | Read-only |
| **Code Quality** ||||
| code-reviewer | ✅ | ✅ | Read-only, audits only |
| security-reviewer | ✅ | ✅ | Read-only, audits only |
| tdd-guide | ✅ | ✅ | |
| build-error-resolver | ✅ | ✅ | |
| doc-updater | ✅ | ✅ | |
| **Deployment** ||||
| worker-deploy | ✅ | ✅ | |
| worker-scaffold | ✅ | ✅ | |
| **Design** ||||
| skill-frontend-design | ✅ | ✅ | |
| **Special** ||||
| worker-image-gen | ❌ | ❌ | Requires DALL-E (ChatGPT Web) |
| worker-web-research | ✅ | ❌ | Gemini has limited browsing |

## Tool Requirements

| Plugin | Tools | Read-Only |
|--------|-------|-----------|
| gsd-executor | read, write, bash | No |
| gsd-planner | read, write, bash, grep, glob | No |
| gsd-researcher | web_search | Yes |
| gsd-debugger | read, write, bash | No |
| gsd-verifier | read, write, bash, grep, glob | No |
| gsd-codebase-mapper | read, bash, grep, glob | Yes |
| code-reviewer | read | **Yes** |
| security-reviewer | read | **Yes** |
| tdd-guide | read, write, bash | No |
| build-error-resolver | read, write, bash | No |
| doc-updater | read, write | No |
| worker-deploy | read, bash, write | No |
| worker-scaffold | write, bash | No |
| skill-frontend-design | read, write, bash | No |

## Sandbox Mode Mapping

### Codex

| Tools | Sandbox Mode |
|-------|--------------|
| read-only | `--sandbox read-only` |
| includes write/edit | `--sandbox workspace-write` |

### Gemini

| Tools | Approval Mode |
|-------|---------------|
| read-only | `--approval-mode plan --sandbox` |
| includes write/edit | `--approval-mode yolo` |

## Key Constraints

1. **Gemini cannot be Conductor** - No session resume means it can only be a Worker
2. **code-reviewer/security-reviewer MUST be read-only** - Enforced at spawn time
3. **gsd-planner/gsd-verifier are NOT read-only** - They write documentation files
