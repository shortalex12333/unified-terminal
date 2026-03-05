# v1.0 Action Board

**Created:** 2026-03-04
**Status:** Active
**Worktree Branch:** instance3-instance4-implementation
**Main Branch State:** Diverged - missing critical CircuitBreakerModal integration and IPC fixes

---

## Summary

| Priority | Count | Effort |
|----------|-------|--------|
| P0 - Blockers | 3 | M-L |
| P1 - High | 7 | S-M |
| P2 - Medium | 8 | S-M |
| P3 - Low | 6 | S |

**Total Issues:** 24

---

## P0 - BLOCKERS (Fix Immediately)

### [ISSUE-001] Main branch missing CircuitBreakerModal integration
- **Source:** WIRING-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/renderer/components/App.tsx`
- **Line:** N/A (entire component missing)
- **Problem:** The CircuitBreakerModal component exists only in the worktree branch. Main branch App.tsx (103 lines) does not import or render CircuitBreakerModal. Users cannot interact with the circuit breaker when steps fail.
- **Fix:**
  1. Copy `CircuitBreakerModal.tsx` from worktree to main
  2. Import and render `<CircuitBreakerModal />` in App.tsx as overlay
  3. Update `global.d.ts` with `onStepNeedsUser` and `sendStepDecision` declarations
- **Effort:** M
- **Status:** [ ] Not Started

### [ISSUE-002] Main branch has broken conductor:user-decision IPC handler
- **Source:** WIRING-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/main/index.ts`
- **Line:** 2002-2013
- **Problem:** The handler sends the decision BACK to the renderer via `mainWindow.webContents.send()` instead of resolving the scheduler's internal Promise. Decisions never reach the step-scheduler.
- **Fix:**
  1. Remove the broken `conductor:user-decision` handler
  2. The worktree branch correctly removed this (see comment at L2031-2035)
  3. Ensure `step:user-decision` is handled by `ipcMain.handle()` which resolves `userDecisionResolver()`
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-003] Main branch missing step-needs-user forwarding in setupConductorIPC()
- **Source:** WIRING-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/main/index.ts`
- **Line:** setupConductorIPC() function
- **Problem:** Without `scheduler.on('step-needs-user', ...)` forwarding, the renderer never receives circuit breaker events. The modal never appears.
- **Fix:**
  1. Add to setupConductorIPC():
  ```typescript
  scheduler.on('step-needs-user', (options) => {
    mainWindow.webContents.send('step:needs-user', options);
  });
  ```
- **Effort:** S
- **Status:** [ ] Not Started

---

## P1 - HIGH (Fix Before Release)

### [ISSUE-004] API key exposure in CLI arguments (Security)
- **Source:** ADAPTER-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/engine/agent-spawner.ts`
- **Line:** 61-67
- **Problem:** API keys passed via CLI arguments (`--api-key`) are visible in process listings (`ps aux`), shell history, and system logs.
- **Fix:**
  ```typescript
  // BEFORE (insecure):
  args = ["--api-key", process.env.ANTHROPIC_API_KEY || ""];

  // AFTER (secure):
  const env = { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
  spawn(cmd, args, { env });  // Pass via env, not args
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-005] Script path mismatch in bodyguard.ts
- **Source:** ENFORCEMENT-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/bodyguard.ts`
- **Line:** 96-98
- **Problem:** `createCheckFromName()` generates paths like `check_test_exit_code.py` but actual scripts are named `check_tests.py`, `check_files_exist.py`, etc. All bodyguard checks fail to find their Python scripts.
- **Fix:** Add explicit script path mapping:
  ```typescript
  const CHECK_SCRIPT_MAP: Record<string, string> = {
    "test-exit-code": "check_tests.py",
    "file-existence": "check_files_exist.py",
    "file-non-empty": "check_files_nonempty.py",
    // ... etc
  };
  ```
- **Effort:** M
- **Status:** [ ] Not Started

### [ISSUE-006] trigger-map.json not at runtime location
- **Source:** SKILLS-GLUE-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/resources/skills/trigger-map.json`
- **Line:** N/A (file missing)
- **Problem:** The selector expects `trigger-map.json` at `resources/skills/trigger-map.json` but it exists at `docs/ONGOING_WORK/DISSECTION/specs/trigger-map.json`. Both agent-based and keyword-based skill selection return empty arrays.
- **Fix:**
  ```bash
  mkdir -p resources/skills
  cp docs/ONGOING_WORK/DISSECTION/specs/trigger-map.json resources/skills/trigger-map.json
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-007] trigger-map.json format mismatch
- **Source:** SKILLS-GLUE-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/skills/selector.ts`
- **Line:** 39-44, 249
- **Problem:** Code expects `TriggerEntry[]` array but actual JSON has nested structure `{ skills: {...}, trigger_index: {...} }`. The `Array.isArray(catalog)` check fails, returning null.
- **Fix:** Update `loadCatalog()`:
  ```typescript
  const data = JSON.parse(raw);
  const catalog: TriggerEntry[] = Object.entries(data.skills || {}).map(
    ([name, entry]: [string, any]) => ({
      skill: entry.path,
      keywords: entry.triggers,
    })
  );
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-008] E2E tests are actually integration tests (mislabeled)
- **Source:** TEST-QUALITY-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/tests/e2e/electron-dispatch.test.ts`
- **Line:** 43-127
- **Problem:** Tests claim to be E2E but use mocked Electron via `require.cache`. No real Electron app is launched. `launchTestApp()` in fixtures.ts is never called.
- **Fix:**
  1. Rename `tests/e2e/` to `tests/integration/`
  2. Create actual E2E test using `launchTestApp()` from fixtures.ts
  3. Test real Electron launch, real IPC, real CircuitBreakerModal
- **Effort:** L
- **Status:** [ ] Not Started

### [ISSUE-009] CircuitBreakerModal never tested
- **Source:** TEST-QUALITY-REVIEW.md
- **File:** N/A (test file does not exist)
- **Line:** N/A
- **Problem:** No test file exists for CircuitBreakerModal component. No render test, no interaction test, no accessibility test. UI regression risk.
- **Fix:** Create `tests/components/CircuitBreakerModal.test.ts`:
  ```typescript
  test('renders with step info', () => {
    render(<CircuitBreakerModal step={mockStep} onDecision={jest.fn()} />);
    expect(screen.getByText('retry')).toBeDefined();
    expect(screen.getByText('skip')).toBeDefined();
    expect(screen.getByText('stop')).toBeDefined();
  });
  ```
- **Effort:** M
- **Status:** [ ] Not Started

### [ISSUE-010] Missing constants from spec
- **Source:** ENFORCEMENT-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/constants.ts`
- **Line:** Throughout
- **Problem:** Missing spec-defined constants: CRON_INTERVALS, TIMEOUTS, FILE_THRESHOLDS, PROJECT_STATE, SUB_AGENT_RULES, LATENCY_BUDGET.
- **Fix:** Add missing constant sections from HARDCODED-ENFORCEMENT-VALUES.md spec.
- **Effort:** M
- **Status:** [ ] Not Started

---

## P2 - MEDIUM (Should Fix)

### [ISSUE-011] Plugin count mismatch (16 vs 29)
- **Source:** ADAPTER-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/COMPATIBILITY.md`
- **Line:** Throughout
- **Problem:** Task specifies 29 plugins but only 16 exist. Either 13 plugins are missing or the specification is outdated.
- **Fix:**
  1. Clarify correct target with stakeholder
  2. If 29 required: implement missing 13 plugins
  3. If 16 sufficient: update task specification
- **Effort:** S-L (depends on decision)
- **Status:** [ ] Not Started

### [ISSUE-012] Missing input validation in runtime/adapters/agent-adapter.ts
- **Source:** ADAPTER-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/adapters/agent-adapter.ts`
- **Line:** buildCLIArguments() function
- **Problem:** No validation that config.sessionId is defined. No handling for invalid `type` values at runtime.
- **Fix:** Add input validation:
  ```typescript
  function buildCLIArguments(config: AgentConfig): string[] {
    if (!config.sessionId) throw new Error('sessionId required');
    if (!['codex', 'claude', 'gemini'].includes(config.type)) {
      throw new Error(`Invalid agent type: ${config.type}`);
    }
    // ... rest of function
  }
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-013] CHECK_TIMEOUT_MS too low
- **Source:** ENFORCEMENT-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/constants.ts`
- **Line:** CHECK_TIMEOUT_MS
- **Problem:** Current value is 10_000ms (10s) but spec states 60_000ms (60s). May cause premature timeouts for test suites.
- **Fix:** Change `CHECK_TIMEOUT_MS = 10_000` to `CHECK_TIMEOUT_MS = 60_000`
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-014] Relative script paths in enforcer
- **Source:** ENFORCEMENT-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/bodyguard.ts`
- **Line:** Script path generation
- **Problem:** Bodyguard generates relative paths (`checks/check_*.py`) but scripts live in `/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/`. Paths won't resolve correctly.
- **Fix:** Add constant for scripts directory:
  ```typescript
  export const CHECKS_DIR = path.join(__dirname, '../../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks');
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-015] WebExecutor registration is conditional
- **Source:** WIRING-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/main/index.ts`
- **Line:** 782-810
- **Problem:** Web executor only registered if `chatGPTView` exists at init time. Plans requiring web steps before provider selection will fail.
- **Fix:** Register lazy executor wrapper that waits for chatGPTView:
  ```typescript
  scheduler.registerExecutor('web', {
    execute: async (step, context) => {
      if (!chatGPTView) {
        await waitForChatGPTView();  // New helper
      }
      return webExecutor.execute(...);
    },
    canHandle: () => true,  // Always accept
  });
  ```
- **Effort:** M
- **Status:** [ ] Not Started

### [ISSUE-016] Silent failures in assemblePrompt()
- **Source:** SKILLS-GLUE-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/glue/assemble-prompt.ts`
- **Line:** 156-160
- **Problem:** When a skill file is unreadable, it silently continues. Caller has no visibility into which skills failed to load.
- **Fix:** Add warnings array to PromptParts:
  ```typescript
  export interface PromptParts {
    // ...existing fields...
    warnings?: string[];  // ["Failed to read: skills/tdd-guide.md"]
  }
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-017] Main branch global.d.ts missing IPC declarations
- **Source:** WIRING-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/renderer/global.d.ts`
- **Line:** ElectronAPI interface
- **Problem:** Missing `onStepNeedsUser` and `sendStepDecision` on ElectronAPI interface. TypeScript errors if CircuitBreakerModal added.
- **Fix:** Add declarations:
  ```typescript
  interface ElectronAPI {
    // ...existing...
    onStepNeedsUser: (callback: (options: CircuitBreakerOptions) => void) => void;
    sendStepDecision: (stepId: string, decision: string) => Promise<void>;
  }
  ```
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-018] Enforcer completely mocked in integration tests
- **Source:** TEST-QUALITY-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/tests/integration/conductor-scheduler-executor.test.ts`
- **Line:** 122-132
- **Problem:** Enforcer module is replaced with always-passing mock. No validation that bodyguard checks actually run or integrate correctly.
- **Fix:** Add test that exercises real enforcer (or shimmed version) with known project fixtures.
- **Effort:** M
- **Status:** [ ] Not Started

---

## P3 - LOW (Nice to Have)

### [ISSUE-019] Inconsistent Tool type definitions
- **Source:** ADAPTER-REVIEW.md
- **File:** Multiple files
- **Line:** `codex-adapter/types.ts` vs `constants/13-tool-permissions.ts`
- **Problem:** Tool type definitions inconsistent. One adds 'web' and 'web_search' tools that the other doesn't have.
- **Fix:** Consolidate to single source of truth in shared types file.
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-020] Duplicate updateProjectState() call
- **Source:** ADAPTER-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/index.ts`
- **Line:** 61 and 72
- **Problem:** `updateProjectState(config.projectDir)` called twice.
- **Fix:** Remove duplicate call at line 72.
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-021] Type assertions (as any) in step-scheduler.ts
- **Source:** ADAPTER-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/main/step-scheduler.ts`
- **Line:** 145, 325-326, 354-355, 376, 384
- **Problem:** Multiple unsafe type assertions. Example: `clearInterval(heartbeatTimer as any)`
- **Fix:** Define proper interface extensions rather than using type assertions.
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-022] Incomplete blocked patterns in sandbox
- **Source:** SKILLS-GLUE-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/skills/verify-sandbox.ts`
- **Line:** 50-55
- **Problem:** Blocked patterns miss some dangerous commands: `ssh`/`scp`, `python -c`/`node -e`, `eval`/`exec` shell builtins.
- **Fix:** Add to blocklist: `ssh`, `scp`, `python -c`, `node -e`, `eval`, `exec`.
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-023] Verify parser allows dangerous pass expressions
- **Source:** SKILLS-GLUE-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/src/skills/verify-parser.ts`
- **Line:** 103
- **Problem:** The `pass` field is a string that gets evaluated. A malicious skill could define `"pass": "process.exit(1)"`.
- **Fix:** Document that skill files MUST be bundled assets. Consider expression validation if external skills ever allowed.
- **Effort:** S
- **Status:** [ ] Not Started

### [ISSUE-024] CIRCUIT_BREAKER.HEURISTIC_FAIL_OPTIONS case mismatch
- **Source:** ENFORCEMENT-REVIEW.md
- **File:** `/Users/celeste7/Documents/unified-terminal/.claude/worktrees/instance3-instance4-implementation/src/enforcement/constants.ts`
- **Line:** CIRCUIT_BREAKER section
- **Problem:** TypeScript uses `['retry', 'skip', 'stop']` but spec uses `["Retry", "Skip this check", "Stop build"]`. Inconsistent casing.
- **Fix:** Decide on canonical format and update both spec and code.
- **Effort:** S
- **Status:** [ ] Not Started

---

## Completed

*Move items here when done*

---

## Notes

- **Worktree branch:** `instance3-instance4-implementation` - contains most fixes already
- **Main branch state:** Diverged significantly. Missing CircuitBreakerModal, IPC fixes, and has broken handlers
- **Critical path:** ISSUE-001, ISSUE-002, ISSUE-003 must be fixed to get circuit breaker working
- **Security priority:** ISSUE-004 (API key exposure) should be fixed before any production deployment
- **Test infrastructure:** E2E tests are mislabeled and don't exercise real Electron. This limits confidence in v1.0.

### Effort Key
- **S** = Small (< 30 min)
- **M** = Medium (30 min - 2 hours)
- **L** = Large (> 2 hours)

### Priority Definitions
- **P0** = Blocker - system does not work without this fix
- **P1** = High - must fix before v1.0 release
- **P2** = Medium - should fix for quality/maintainability
- **P3** = Low - nice to have, can defer to v1.1
