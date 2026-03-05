# File Inventory: Everything Built by Instance 3/4

> Every file created or modified, with line counts and status.

---

## New Files Created (28 files, ~6,000 lines)

### src/enforcement/ (6 files, ~1,200 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 259 | AgentHandle, SpineState, SpineDiff, EnforcerCheck, BodyguardVerdict, DagStep, FailureResponse, ModelRouting |
| `constants.ts` | 520 | TOKEN_THRESHOLDS, BODYGUARD, MODEL_ROUTING, ENFORCER_RETRY_POLICIES, CHECK_ACTIVATION, CHECK_SCRIPT_PATHS, CRON_INTERVALS, TIMEOUTS, FILE_THRESHOLDS, TIER_CLASSIFICATION, CIRCUIT_BREAKER, + 13 more groups |
| `enforcer.ts` | 250 | runCheck(), runCheckWithRetry(), validateCheckOutput() — single check execution |
| `bodyguard.ts` | 300 | gateCheck(), checkCompliance() — parallel gate dispatcher + verdict aggregation |
| `spine.ts` | 300 | buildSpine(), compareSpines(), validateSpineState() — lightweight project snapshots |
| `index.ts` | 65 | Barrel exports for all enforcement types, constants, functions |

### src/adapters/ (6 files, ~1,100 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 185 | Tool, Runtime, AgentConfig, AgentResult, Capabilities, AgentHandle, Adapter interface |
| `codex/adapter.ts` | 400 | CodexAdapter class — spawn Codex CLI, session resume, JSON output, sandbox modes |
| `claude/adapter.ts` | 433 | ClaudeAdapter class — spawn Claude Code, YAML frontmatter, tool name translation |
| `claude/frontmatter.ts` | 105 | generateFrontmatter(), writeTempAgentFile(), cleanupTempFile(), mapToolName() |
| `permissions.ts` | 280 | 29-skill COMPATIBILITY map, getCodexSandbox(), hasWritePermission(), hasExecPermission() |
| `factory.ts` | 100 | getAdapter(), getAvailableRuntimes(), selectRuntime(), clearAdapterCache() — singleton factory |

### src/skills/ (6 files, ~800 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `selector.ts` | 275 | selectSkills() — agent-based PRIMARY, keyword FALLBACK, loadCatalog() |
| `validator.ts` | 114 | validateSelection() — tier limits (0-1→1, 2→2, 3→3), 4K token budget per worker |
| `verify-parser.ts` | 115 | parseVerifyBlock() — extract ## verify JSON from skill markdown |
| `critical-checks.ts` | 96 | CRITICAL_SKILL_CHECKS (4 hardcoded entries), getChecksForSkill() |
| `verify-sandbox.ts` | 156 | isCommandAllowed(), executeVerifyCommand() — allowlist/blocklist enforcement |
| `index.ts` | 65 | Barrel exports |

### src/glue/ (3 files, ~400 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `assemble-prompt.ts` | 212 | assemblePrompt() — 80K token builder, skill sections + spine context + user input |
| `normalizer.ts` | 169 | normalize() — AdapterResult → GateCheckInput for bodyguard |
| `index.ts` | 22 | Barrel exports |

### resources/skills/ (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `trigger-map.json` | 433 | 28 skills with keyword triggers, used by selector.ts loadCatalog() |

### tests/ (7 test files, ~5,000 lines)

| File | Lines | Test Count | Purpose |
|------|-------|-----------|---------|
| `codex-adapter.test.ts` | 130 | 6 | Codex adapter: session resume, JSON output, sandbox |
| `claude-adapter.test.ts` | 245 | 8 | Claude adapter: frontmatter, tool translation, JSON parsing |
| `circuit-breaker-modal.test.ts` | 274 | 9 | CircuitBreakerModal: constants integration, IPC data, decision mapping |
| `integration/conductor-scheduler-executor.test.ts` | 1,005 | 23 | Full pipeline: Conductor → Scheduler → Executor |
| `e2e/electron-dispatch.test.ts` | 543 | 10 | DOM injection, rate limit, adapter dispatch, error recovery |
| `e2e/fixtures.ts` | 200 | — | Playwright Electron launch helpers |
| `e2e/mocks.ts` | 150 | — | Mock ChatGPT DOM, CLI responses, rate limit content |
| `compatibility-matrix-validation.ts` | 314 | 4 | Production readiness: Codex JSON, Claude agent, session resume, ChatGPT DOM |

### scripts/ (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `verify-production-readiness.sh` | 200 | 13-check production readiness gate script |

### docs/ (1 file)

| File | Lines | Purpose |
|------|-------|---------|
| `docs/ONGOING_WORK/ADAPTORS/PRODUCTION-READINESS.md` | 300 | 16-point production readiness checklist with sign-off |

---

## Modified Files (3 files)

| File | Lines Added | Purpose |
|------|-------------|---------|
| `src/main/step-scheduler.ts` | +500 | 10-step enforcement flow in executeStep(), circuit breaker, DAG progress |
| `src/main/index.ts` | +30 | 3 executors registered, step-needs-user IPC forwarding, scheduler.setMainWindow() |
| `src/plugins/configs/codex.ts` | -1, +1 | Removed OPENAI_API_KEY from requiredEnv (OAuth only) |

---

## Deleted Files (Structural Cleanup)

| File | Reason |
|------|--------|
| `docs/ONGOING_WORK/ADAPTORS/src/types.ts` | Dead duplicate of src/adapters/types.ts |
| `docs/ONGOING_WORK/ADAPTORS/src/permissions.ts` | Dead duplicate (14 entries vs canonical 29) |
| `docs/ONGOING_WORK/ADAPTORS/src/factory.ts` | Dead duplicate (referenced Gemini, shelved) |
| `docs/ONGOING_WORK/ADAPTORS/src/codex/adapter.ts` | Dead duplicate of src/adapters/codex/adapter.ts |
| `docs/ONGOING_WORK/ADAPTORS/src/gemini/adapter.ts` | Gemini shelved, no canonical needed |
| `docs/ONGOING_WORK/ADAPTORS/src/index.ts` | Referenced shelved GeminiAdapter |
| `docs/ONGOING_WORK/ADAPTORS/PARALLEL-COORD.md` | Duplicate coordinate doc |
| `docs/ONGOING_WORK/DISSECTION/PARALLEL-COORD.md` | Duplicate coordinate doc |
| `docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/DEFINITIVE-ARCHITECTURE-NEW.md` | Version-suffix violation, canonical exists |

## Renamed Files

| From | To | Reason |
|------|-----|--------|
| `docs/ONGOING_WORK/VERIFICATION/PARALLEL-COORD-v3.md` | `PARALLEL-COORDINATION.md` | Version suffix removed |
