# Instance 2 (Adapters) Verification Report

**Verifier:** Instance V
**Date:** 2026-03-03
**Scope:** Codex CLI Adapter verification

---

## Executive Summary

| Aspect | Status | Score |
|--------|--------|-------|
| types.ts Contract | PASS with minor issue | 95% |
| tool-map.ts Translation | **FAIL - Critical Bug** | 70% |
| codex-adapter.ts Implementation | PASS | 90% |
| Verification Tests | PASS (9/9) | 100% |
| Cross-Instance Consistency | **FAIL - Tool Mismatch** | 60% |
| **Overall** | **NEEDS FIXES** | **83%** |

**Verdict:** Instance 2 produced working code but has **CRITICAL tool permission bugs** that must be fixed.

---

## Critical Finding: Tool Permission Mismatch

### The Problem

Instance 2 assumed some workers should be **read-only** when the original GSD source grants them **write permissions**.

**Evidence from original GSD repo (`/tmp/verification/gsd/agents/`):**

| Worker | Original GSD Tools | Instance 2 Tools | Instance 3 Manifest | Correct? |
|--------|-------------------|------------------|---------------------|----------|
| gsd-verifier | Read, **Write**, Bash, Grep, Glob | `['read', 'bash'], readOnly: true` | Read, Write, Bash, Grep, Glob | Instance 2 WRONG |
| gsd-planner | Read, **Write**, Bash, Glob, Grep, WebFetch | `['read'], readOnly: true` | Read, Write, Bash, Glob, Grep, WebFetch | Instance 2 WRONG |

### Why This Matters

- **gsd-verifier** writes `VERIFICATION.md` reports — it NEEDS write permission
- **gsd-planner** writes `PLAN.md` files — it NEEDS write permission

Instance 2's enforcement of `readOnly: true` will **BLOCK these workers from functioning**.

### Root Cause

Instance 2 made a philosophical assumption: "Verifiers and planners shouldn't modify code."

This is partially correct (they shouldn't modify *source code*), but they DO need to write *documentation files*. The original GSD design reflects this reality.

---

## Track 1: types.ts Contract (95%)

### Findings

**Lines:** 457
**Status:** Well-structured, comprehensive

**Strengths:**
- Clean TypeScript interfaces
- Good JSDoc documentation
- Covers all necessary types: AgentConfig, AgentResult, RuntimeAdapter, RuntimeCapabilities, AgentHandle
- Proper export structure

**Issue Found:**

**Location:** Lines 27-28
```typescript
* Codex:  read, write, bash, web_search, edit (--allowed-tools flag)
```

**Problem:** Comment says `--allowed-tools flag` but Codex actually uses `--sandbox` mode. Comment is outdated.

**Fix:**
```typescript
* Codex:  --sandbox mode (read-only, workspace-write, danger-full-access)
```

---

## Track 2: tool-map.ts Translation (70% - CRITICAL BUG)

### Findings

**Lines:** 305
**Status:** Correct sandbox translation, WRONG tool requirements

**Strengths:**
- Correctly discovered sandbox model (key insight!)
- `buildSandboxFlag()` works correctly
- `isReadOnly()` logic is sound
- Deprecated functions redirect properly

**Critical Bug:**

**Location:** `PLUGIN_TOOL_REQUIREMENTS` object (lines 210-245)

```typescript
// WRONG - Source has Write permission
'gsd-planner': { tools: ['read'], readOnly: true },
'gsd-verifier': { tools: ['read', 'bash'], readOnly: true },

// SHOULD BE (per original GSD source)
'gsd-planner': { tools: ['read', 'write', 'bash', 'web_search'], readOnly: false },
'gsd-verifier': { tools: ['read', 'write', 'bash'], readOnly: false },
```

**Impact:** These workers will fail to write their output files (PLAN.md, VERIFICATION.md).

---

## Track 3: codex-adapter.ts Implementation (90%)

### Findings

**Lines:** 726
**Status:** Solid implementation

**Strengths:**
- Full RuntimeAdapter interface implementation
- Correct use of `buildSandboxFlag()`
- Proper stdin handling for large payloads
- JSON output parsing from Codex
- Token tracking from `turn.completed.usage`
- Working directory lifecycle management
- Environment variable passthrough (for secrets)
- Timeout enforcement
- Session resume support

**Minor Issues:**

1. **Line 8-9 comment outdated:**
   ```typescript
   * - AgentConfig.tools → --allowed-tools flag
   ```
   Should reference `--sandbox` mode.

2. **No unit tests for kill() and resume():**
   These are marked "Planned" in VERIFICATION.md but not yet tested.

---

## Track 4: Verification Tests (100%)

### Findings

**Tests:** 9/9 passing
**Status:** Solid evidence

**Verified Features:**
| # | Feature | Evidence |
|---|---------|----------|
| 1 | Spawn agent | pid=42157, exit=0 |
| 2 | Read tool | VERIFICATION_MARKER_12345 found |
| 5 | Bash tool | BASH_VERIFICATION_TEST echoed |
| 6 | Tool restriction | 4/4 test cases pass |
| 8 | JSON output | 5 valid lines parsed |
| 9 | Token tracking | input=6210, output=85 |
| 10 | Working dir | pwd confirms correct |
| 19 | Capabilities | All fields match |
| 20 | Availability | /opt/homebrew/bin/codex v0.46.0 |

**Key Discovery Documented:** Codex uses sandbox model, not `--allowed-tools`.

**Missing Tests (11 planned):**
- Write tool, Edit tool, Session persistence
- Large payload, Timeout, Kill
- File detection, Env vars, Intermediate output, Error handling

---

## Track 5: Cross-Instance Consistency (60% - CONFLICT)

### Instance 2 vs Instance 3 Tool Comparison

| Worker | Instance 2 (tool-map.ts) | Instance 3 (manifest) | Match? |
|--------|-------------------------|----------------------|--------|
| gsd-executor | read, write, bash | Read, Write, Edit, Bash, Grep, Glob | PARTIAL |
| gsd-planner | read (readOnly) | Read, Write, Bash, Glob, Grep, WebFetch | **NO** |
| gsd-debugger | read, write, bash | Read, Write, Edit, Bash, Grep, Glob, WebSearch | PARTIAL |
| gsd-verifier | read, bash (readOnly) | Read, Write, Bash, Grep, Glob | **NO** |
| gsd-codebase-mapper | read, bash | Read, Bash, Grep, Glob | PARTIAL |
| gsd-researcher | web_search | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch | PARTIAL |

**Pattern:** Instance 2 uses minimal tool sets; Instance 3 matches original GSD source.

### Resolution

**Instance 3 is CORRECT** — it matches the original GSD agent definitions.

Instance 2 should update `PLUGIN_TOOL_REQUIREMENTS` to match Instance 3's `plugin-requirements-manifest.json`.

---

## Recommendations

### MUST FIX (Blocking)

1. **Fix gsd-planner tool permissions:**
   ```typescript
   'gsd-planner': { tools: ['read', 'write', 'bash', 'web_search'], readOnly: false },
   ```

2. **Fix gsd-verifier tool permissions:**
   ```typescript
   'gsd-verifier': { tools: ['read', 'write', 'bash'], readOnly: false },
   ```

3. **Update outdated comments:**
   - types.ts line 27-28: Change `--allowed-tools flag` to `--sandbox mode`
   - codex-adapter.ts line 8-9: Same fix

### SHOULD FIX (Quality)

4. **Add Grep and Glob to tool permissions:**
   Instance 3 correctly includes these; Instance 2 omits them.

5. **Add missing tests:**
   Complete the 11 planned tests for Write, Edit, Session persistence, etc.

6. **Align tool naming:**
   Instance 2 uses lowercase (`read`, `write`), Instance 3 uses PascalCase (`Read`, `Write`).
   The translation exists but documentation should be consistent.

### NICE TO HAVE

7. **Add cross-instance validation script:**
   Auto-compare Instance 2 tool-map.ts against Instance 3 manifest.

---

## Verification Evidence

### Files Reviewed

```
/docs/ONGOING_WORK/ADAPTORS/CODEX_CLI/
├── types.ts              (457 lines) - Contract definition
├── tool-map.ts           (305 lines) - Tool translation ← BUGS HERE
├── codex-adapter.ts      (726 lines) - Implementation
├── codex-adapter.test.ts (350 lines) - 7 tests
├── verification-harness.ts (600 lines) - 9 spec tests
├── VERIFICATION.md       - Evidence documentation
└── PLUGIN-COMPATIBILITY.md - 22 plugin matrix
```

### Original Source Comparison

```bash
# From /tmp/verification/gsd/agents/
gsd-verifier.md: tools: Read, Write, Bash, Grep, Glob  ← HAS WRITE
gsd-planner.md:  tools: Read, Write, Bash, Glob, Grep, WebFetch  ← HAS WRITE
```

---

## Final Verdict

**Instance 2 output is NOT READY for production.**

Quality Score: **83/100**

Deductions:
- -10 for gsd-planner read-only bug
- -5 for gsd-verifier read-only bug
- -2 for outdated comments

**Fix the 2 critical tool permission bugs, then the adapter is production-ready.**

---

*Verification completed by Instance V on 2026-03-03*
