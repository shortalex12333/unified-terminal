# Adapter Layer Review

**Reviewer:** Agent-1 (Adapters)
**Date:** 2026-03-04
**Status:** ISSUES_FOUND

## Summary

The adapter layer implementation is **not located at the specified paths** (`/src/adapters/`). Instead, adapter code is distributed across two locations:
1. `/docs/ONGOING_WORK/ADAPTORS/codex-adapter/` - Codex CLI adapter (4 files)
2. `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/` - Runtime engine with agent spawning

The Codex adapter is well-designed with clear type definitions, proper error handling, and verification tests. However, **the Claude adapter mentioned in the task specification does not exist** - the architecture correctly skipped it since Claude Code is the native runtime. The COMPATIBILITY matrix contains **16 plugins** (not 29 as specified in the task).

## Files Reviewed

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `ADAPTORS/codex-adapter/types.ts` | 123 | PASS | Clean type definitions, proper Tool/SandboxMode types |
| `ADAPTORS/codex-adapter/adapter.ts` | 279 | PASS | Good process management, timeout handling, output parsing |
| `ADAPTORS/codex-adapter/verify.ts` | 143 | PASS | Unit + integration test harness |
| `ADAPTORS/codex-adapter/index.ts` | 20 | PASS | Clean re-exports |
| `HARDCODED_ENFORCEMENT/runtime/adapters/agent-adapter.ts` | 146 | ISSUES | Missing robust error handling, API key exposure risk |
| `HARDCODED_ENFORCEMENT/engine/types.ts` | 262 | PASS | Comprehensive type coverage |
| `HARDCODED_ENFORCEMENT/constants/13-tool-permissions.ts` | 29 | PASS | Correct tool mappings for Codex/Claude/Gemini |
| `HARDCODED_ENFORCEMENT/engine/agent-spawner.ts` | 334 | ISSUES | API key in CLI args is a security concern |
| `HARDCODED_ENFORCEMENT/engine/step-scheduler.ts` | 438 | PASS | Well-structured DAG execution with proper cleanup |
| `ADAPTORS/COMPATIBILITY.md` | 80 | ISSUES | Only 16 plugins, not 29 as specified |
| `ADAPTORS/INSTANCE-2-ADAPTERS.md` | 247 | PASS | Clear documentation, verification results |

**Files NOT Found (specified in task but do not exist):**
| File | Expected Path | Status |
|------|---------------|--------|
| types.ts (184 lines) | `/src/adapters/types.ts` | NOT FOUND |
| permissions.ts (453 lines) | `/src/adapters/permissions.ts` | NOT FOUND |
| factory.ts (102 lines) | `/src/adapters/factory.ts` | NOT FOUND |
| codex/adapter.ts (413 lines) | `/src/adapters/codex/adapter.ts` | NOT FOUND |
| claude/adapter.ts (433 lines) | `/src/adapters/claude/adapter.ts` | NOT FOUND |
| claude/frontmatter.ts (105 lines) | `/src/adapters/claude/frontmatter.ts` | NOT FOUND |

## Issues Found

### Critical

**1. Specified Files Do Not Exist**
- The task specified files at `/src/adapters/` but this directory does not exist
- The adapter implementation is located in `/docs/ONGOING_WORK/` which is unconventional (documentation folders typically don't contain production code)
- **Impact:** Cannot verify the specific code mentioned in the task specification
- **Recommendation:** Either move adapter code to `/src/adapters/` or update task specifications to reference correct paths

**2. Claude Adapter Does Not Exist**
- Task mentions `claude/adapter.ts` (433 lines) and `claude/frontmatter.ts` (105 lines)
- These files were deliberately not created per the design decision: "Claude adapter NOT needed - Claude Code is the native runtime"
- **Impact:** The task specification may be outdated or refers to planned but unimplemented features
- **Recommendation:** Update task specification to reflect actual architecture decisions

### Major

**3. API Key Exposure in CLI Arguments (Security)**
- File: `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/agent-spawner.ts`, lines 61-67
```typescript
case "claude":
  cmd = "claude";
  args = ["--api-key", process.env.ANTHROPIC_API_KEY || ""];  // API KEY IN ARGS!
  break;

case "gemini":
  cmd = "gemini";
  args = ["--api-key", process.env.GOOGLE_API_KEY || ""];     // API KEY IN ARGS!
  break;
```
- **Impact:** API keys passed via CLI arguments are visible in process listings (`ps aux`), shell history, and system logs
- **Recommendation:** Pass API keys via environment variables to child process, not as arguments:
```typescript
const env = {
  ...process.env,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
};
spawn(cmd, args, { env });
```

**4. Plugin Count Mismatch**
- Task specifies "29 skills in COMPATIBILITY"
- Actual count in `COMPATIBILITY.md`: **16 unique plugins**
  - GSD Workers: 6 (executor, planner, researcher, debugger, verifier, codebase-mapper)
  - Code Quality: 5 (code-reviewer, security-reviewer, tdd-guide, build-error-resolver, doc-updater)
  - Deployment: 2 (worker-deploy, worker-scaffold)
  - Design: 1 (skill-frontend-design)
  - Special: 2 (worker-image-gen, worker-web-research)
- **Impact:** Specification discrepancy indicates either missing plugins or incorrect requirement
- **Recommendation:** Clarify whether 29 is the target or if 16 is sufficient

**5. Missing Error Propagation in runtime/adapters/agent-adapter.ts**
- The `buildCLIArguments()` function does not validate config fields before use
- No handling for missing `sessionId` or invalid `type` values at runtime
```typescript
function buildCLIArguments(config: AgentConfig): string[] {
  const args: string[] = [];
  // No validation that config.sessionId is defined!
  switch (config.type) {
    case 'codex':
      args.push('execute', '--session-id', config.sessionId, '--full-auto');
```
- **Recommendation:** Add input validation before building arguments

### Minor

**6. Inconsistent Tool Type Definition**
- `codex-adapter/types.ts` defines: `type Tool = 'read' | 'write' | 'bash' | 'edit' | 'grep' | 'glob'`
- `constants/13-tool-permissions.ts` adds `'web'` and `'web_search'` tools
- **Recommendation:** Consolidate Tool type to single source of truth

**7. Duplicate Code in runtime/index.ts**
- `updateProjectState(config.projectDir)` is called twice (lines 61 and 72)
```typescript
// Initialize project state
updateProjectState(config.projectDir);  // Line 61

async initialize() {
  // Update project state
  updateProjectState(config.projectDir);  // Line 72 - duplicate
```
- **Recommendation:** Remove duplicate call

**8. Type Casting in step-scheduler.ts**
- Multiple instances of unsafe type assertions (`as any`, `as unknown as`)
- Lines 145, 325-326, 354-355, 376, 384
```typescript
clearInterval(heartbeatTimer as any);  // Line 145
if ((agentHandle as any).childProcess) {  // Line 325
```
- **Recommendation:** Define proper interface extensions rather than using type assertions

## Positive Findings

1. **Well-Structured Type Definitions**
   - `codex-adapter/types.ts` is clean and well-documented
   - Clear separation between AgentConfig (input), AgentResult (output), and AgentHandle (running process)
   - Proper use of TypeScript union types for Status and SandboxMode

2. **Comprehensive Error Handling in codex-adapter**
   - Timeout handling with SIGTERM then SIGKILL fallback
   - Process cleanup on timeout/kill
   - Output stream capture for both stdout and stderr

3. **Good Sandbox Mode Logic**
   - `getSandboxMode()` correctly identifies write tools
   - Maps tool permissions to CLI flags accurately

4. **Verification Test Suite**
   - `verify.ts` provides both unit tests (no CLI needed) and integration tests
   - Clean test infrastructure with pass/fail reporting

5. **Clear Documentation**
   - `INSTANCE-2-ADAPTERS.md` provides clear architecture overview
   - `COMPATIBILITY.md` clearly shows plugin compatibility matrix
   - Decision rationale documented (why Claude adapter was skipped)

6. **DAG Execution Flow**
   - `step-scheduler.ts` implements comprehensive 10-step flowchart
   - Proper circuit breaker integration for handling failures
   - User action options (Retry/Skip/Stop) for failure recovery

## Recommendations

### High Priority

1. **Relocate Adapter Code to /src/adapters/**
   - Move production code from `/docs/ONGOING_WORK/` to `/src/adapters/`
   - Documentation folder should contain docs, not implementation

2. **Fix API Key Security Issue**
   - Pass API keys via environment variables to child processes
   - Never include secrets in command-line arguments

3. **Clarify Plugin Count Requirement**
   - Verify whether 29 or 16 plugins is the correct target
   - If 29, implement the missing 13 plugins
   - If 16, update the task specification

### Medium Priority

4. **Consolidate Type Definitions**
   - Create single `types.ts` that exports all adapter-related types
   - Eliminate duplicate/inconsistent Tool type definitions

5. **Add Input Validation**
   - Validate AgentConfig before building CLI arguments
   - Throw meaningful errors for missing required fields

6. **Remove Type Assertions**
   - Define proper interface extensions for AgentHandle with childProcess
   - Replace `as any` with proper typing

### Low Priority

7. **Add YAML Frontmatter Support**
   - If Claude Code needs frontmatter when spawned as child process, implement the missing `claude/frontmatter.ts`
   - Currently no frontmatter utilities exist

8. **Implement Factory Pattern**
   - Create actual `factory.ts` to abstract runtime selection
   - The documentation references it but implementation is incomplete

## Checklist

- [x] Type safety verified - **PARTIAL** (types are defined but not consistently used)
- [x] Error handling complete - **PARTIAL** (good in codex-adapter, gaps in runtime adapter)
- [ ] Security reviewed - **ISSUES FOUND** (API keys in CLI arguments)
- [ ] COMPATIBILITY has 29 entries - **FAILED** (only 16 plugins)
- [x] Tool mappings correct - **PASS** (CODEX_SANDBOX, CLAUDE_TOOL_MAP, GEMINI_TOOL_MAP all correct)

---

**Overall Assessment:** The adapter layer has a solid foundation with good type definitions and error handling in the Codex adapter. However, there are significant issues around file locations not matching specifications, security concerns with API key handling, and a discrepancy between specified and actual plugin counts. The architecture decision to skip the Claude adapter is sound, but the task specification should be updated to reflect reality.
