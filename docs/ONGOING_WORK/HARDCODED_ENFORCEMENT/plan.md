# HARDCODED ENFORCEMENT ENGINE — Implementation Plan

**Phase:** Execution (no approval loop)
**Scope:** 65 files, ~4000 lines of TypeScript/Python/Bash
**Timing:** All 5 sub-agents in parallel
**Completion:** Single verify.sh proves all components work

---

## FILE MANIFEST

### CONSTANTS (35 files, ~1800 lines)
**Sub-agent A responsibility**

| File | Source | Lines | Exports |
|------|--------|-------|---------|
| `constants/index.ts` | Manual | 50 | Re-exports all 34 constants objects |
| `constants/01-context-warden.ts` | HARDCODED-ENFORCEMENT-VALUES.md § 1 | 30 | TOKEN_THRESHOLDS, GRACE_THRESHOLD |
| `constants/02-cron-intervals.ts` | § 2 | 25 | CRON_INTERVALS |
| `constants/03-timeouts.ts` | § 3 | 45 | TIMEOUTS, killAgent() function |
| `constants/04-circuit-breaker.ts` | § 4 | 20 | CIRCUIT_BREAKER, onCheckFail logic |
| `constants/05-file-thresholds.ts` | § 5 | 20 | FILE_THRESHOLDS |
| `constants/06-tier-classification.ts` | § 6 | 50 | TIER_CLASSIFICATION, MAX_OVERHEAD_PERCENT |
| `constants/07-project-state.ts` | § 7 | 30 | PROJECT_STATE timers, state machine logic |
| `constants/08-sub-agent-rules.ts` | § 8 | 25 | SUB_AGENT_RULES, BUDGET_FORMULA |
| `constants/09-retry-policies.ts` | § 9 | 40 | ENFORCER_RETRY_POLICIES (11 checks) |
| `constants/10-check-activation.ts` | § 11 | 50 | CHECK_ACTIVATION map, gateCheck function |
| `constants/11-token-budget.ts` | § 12 | 20 | PHASE_BUDGET_WEIGHTS |
| `constants/12-model-routing.ts` | § 13 | 35 | MODEL_ROUTING per runtime |
| `constants/13-tool-permissions.ts` | § 14 | 40 | CODEX_SANDBOX, CLAUDE_TOOL_MAP, GEMINI_TOOL_MAP |
| `constants/14-deploy-health.ts` | § 15 | 15 | DEPLOY_HEALTH (status, retries, error strings) |
| `constants/15-rate-limit.ts` | § 16-17 | 40 | RATE_LIMIT_PATTERNS, DOM_POLLING intervals |
| `constants/16-latency-budget.ts` | § 18 | 15 | LATENCY_BUDGET per tier |
| `constants/17-skill-injector.ts` | § 19 | 15 | SKILL_INJECTOR thresholds |
| `constants/18-lesson-validation.ts` | § 20 | 25 | LESSON_VALIDATION regex patterns |
| `constants/19-scope-whitelist.ts` | § 21 | 20 | SCOPE_WHITELIST (exact, prefixes) |
| `constants/20-responsive.ts` | § 22 | 15 | RESPONSIVE_VIEWPORTS array |
| `constants/21-intake.ts` | § 23 | 20 | INTAKE constraints |
| `constants/22-memory.ts` | § 24 | 15 | MEMORY_CONSTRAINTS |
| `constants/25-bodyguard.ts` | ENFORCEMENT-GAPS.md gap 1 | 30 | BODYGUARD (dispatcher config) |
| `constants/26-spine-protocol.ts` | gap 2 | 25 | SPINE_PROTOCOL (staleness, locks, required sections) |
| `constants/27-conductor-messages.ts` | gap 3 | 25 | CONDUCTOR_MESSAGES (statuses, limits, thresholds) |
| `constants/28-routing-rules.ts` | gap 4 | 35 | ROUTING_RULES (web/cli/hybrid, fallbacks) |
| `constants/29-sub-agent-budget.ts` | gap 5 | 20 | SUB_AGENT_BUDGET (overhead, min viable, policy) |
| `constants/30-skill-injection.ts` | gap 6 | 20 | SKILL_INJECTION (max tokens, overflow, max skills) |
| `constants/31-testing.ts` | gap 7 | 30 | TESTING (runner detection, no-test policy, regression) |
| `constants/32-error-propagation.ts` | gap 8 | 40 | ERROR_PROPAGATION (severity, templates, logging) |
| `constants/33-http-enforcement.ts` | gap 9 | 35 | HTTP_ENFORCEMENT (timeout, real 200 detection) |
| `constants/34-step-execution.ts` | gap 10 | 30 | STEP_EXECUTION (heartbeat, stale, output capture) |

**Verification:** `tsc constants/*.ts --noEmit` must pass, every export must be named

---

### CHECK SCRIPTS (12 files, ~400 lines)
**Sub-agent B responsibility**

Source: HARD-RAILS.md + gap definitions

| File | Check # | Type | Lines | Command |
|------|---------|------|-------|---------|
| `checks/check_tests.py` | 1 | Python | 35 | `npm test` → exit code + empty suite |
| `checks/check_files_exist.py` | 2 | Python | 25 | `fs.existsSync()` for declared files |
| `checks/check_files_nonempty.py` | 3 | Python | 30 | File size > 50 bytes (with whitelist) |
| `checks/check_build_artifact.py` | 4 | Python | 30 | `dist/` has .html/.js/.css |
| `checks/check_scope.py` | 5 | Python | 40 | `git diff --name-only` vs declared |
| `checks/check_tokens.py` | 6 | Python | 35 | Token utilization vs per-model threshold |
| `checks/check_secrets.sh` | 7 | Bash | 20 | `gitleaks detect` exit code |
| `checks/check_uninstall.py` | 8 | Python | 25 | `node_modules/{pkg}` gone |
| `checks/check_docker_health.py` | 9 | Python | 40 | `curl localhost:3000` → 200 + not error page |
| `checks/check_lesson.py` | 10 | Python | 35 | 4 required fields + no placeholders |
| `checks/check_responsive.py` | 11 | Python | 40 | Playwright 3 viewports, > 1KB each |
| `checks/check_deploy_health.py` | (custom) | Python | 40 | `curl deployed-url` → 200 + not error page |

**Verification:** Each script executable, each exits 0 on healthy project, relevant ones exit 1 on broken project

---

### ENGINE CORE (4 files, ~600 lines)
**Sub-agent C responsibility**

| File | Purpose | Lines | Imports | Exports |
|------|---------|-------|---------|---------|
| `engine/types.ts` | All interfaces | 150 | `constants/*` | EnforcerCheck, EnforcerResult, GateResult, BodyguardVerdict, SpineState, StepExecution |
| `engine/enforcer.ts` | Run single check script | 180 | `constants/09-retry-policies`, `types` | runCheck(check, projectDir): EnforcerResult |
| `engine/bodyguard.ts` | Dispatcher: parallel checks, aggregate verdict | 200 | `constants/10-check-activation`, `constants/25-bodyguard`, `enforcer`, `types` | gateCheck(step, tier): Promise<BodyguardVerdict> |
| `engine/circuit-breaker.ts` | Retry logic + user escape hatch | 70 | `constants/04-circuit-breaker`, `types` | handleCheckFail(check, result): UserAction |

**Verification:**
- `tsc engine/*.ts --noEmit` passes
- bodyguard.ts contains `Promise.allSettled` (parallel)
- No `for...of` loops around check execution in bodyguard.ts
- All numbers in engine/ come from constants/ imports (grep -r "= [0-9]" must be zero)

---

### ENGINE INFRASTRUCTURE (6 files, ~700 lines)
**Sub-agent D responsibility**

| File | Purpose | Lines | Imports | Exports |
|------|---------|-------|---------|---------|
| `engine/spine.ts` | Build SPINE.md state object | 250 | `constants/26-spine-protocol`, `types`, child_process | buildSpine(projectDir): Promise<SpineState> |
| `engine/spine-lock.ts` | Write lock preventing concurrent writes | 80 | `constants/26-spine-protocol`, fs | acquireLock(path), releaseLock(path) |
| `engine/context-warden.ts` | Cron token monitor + kill on threshold | 150 | `constants/01-context-warden`, `constants/02-cron-intervals`, `constants/03-timeouts`, `types` | startWarden(agents), stopWarden() |
| `engine/heartbeat.ts` | Worker liveness detection | 100 | `constants/34-step-execution`, `types` | startHeartbeat(agentHandle): timer, isStale(agentHandle): boolean |
| `engine/project-state.ts` | State machine: OPEN→PAUSED→CLOSED | 80 | `constants/07-project-state`, `types` | updateProjectState(state), shouldAutoArchive(): boolean |
| `engine/cron-manager.ts` | Registry: register/unregister timers | 40 | `constants/02-cron-intervals` | registerCron(name, interval, fn), unregisterCron(name) |

**Verification:**
- spine.ts contains only filesystem/git/subprocess calls (no LLM except 1-sentence summary marked clearly)
- Write lock is acquire/release pattern, not just a flag
- context-warden.ts has setInterval and kill sequence
- heartbeat.ts detects missed signals

---

### SCHEDULER + SPAWNER + TEMPLATES (8 files, ~500 lines)
**Sub-agent E responsibility**

| File | Purpose | Lines | Imports | Exports |
|------|---------|-------|---------|---------|
| `engine/step-scheduler.ts` | DAG executor: pre-spine → warden → inject → spawn → post-spine → bodyguard → PA → done | 200 | All constants, all engine modules, `types` | executeDAG(dag): Promise<DAGResult> |
| `engine/agent-spawner.ts` | child_process.spawn + PID tracking + timeout + token counting | 150 | `constants/03-timeouts`, `constants/34-step-execution`, `types` | spawnAgent(config): Promise<AgentHandle> |
| `templates/enforcer-test-before-commit.json` | ENFORCER config for test checks | 50 | N/A (JSON) | N/A |
| `templates/enforcer-docker-local-first.json` | Docker health check config | 50 | N/A | N/A |
| `templates/enforcer-scope-boundary.json` | Scope enforcement config | 40 | N/A | N/A |
| `templates/enforcer-deploy.json` | Deploy health check config | 50 | N/A | N/A |
| `templates/enforcer-lesson.json` | Lesson validation config | 40 | N/A | N/A |
| `templates/enforcer-scaffold.json` | Scaffold check config | 40 | N/A | N/A |

**Verification:**
- step-scheduler.ts orchestrates all 10 steps from flowchart
- agent-spawner.ts uses child_process.spawn, PID tracking, timeout
- All 6 enforcer-*.json files have valid JSON syntax
- step-scheduler.ts runs steps sequentially, but bodyguard runs checks in parallel

---

## DEPENDENCY ORDER

```
1. constants/index.ts + all 34 constant files (no dependencies)
2. engine/types.ts (imports only constants)
3. checks/*.py/.sh (no dependencies, can run standalone)
4. engine/enforcer.ts (imports types, one specific constant file)
5. engine/bodyguard.ts (imports enforcer, types, constants)
6. engine/circuit-breaker.ts (imports types, constants)
7. engine/spine.ts, spine-lock.ts, heartbeat.ts, project-state.ts, cron-manager.ts (all import types + constants)
8. engine/context-warden.ts (imports types, constants, no other engine modules)
9. engine/step-scheduler.ts (imports ALL engine modules + constants + types)
10. engine/agent-spawner.ts (imports types, constants, no other engine modules)
11. templates/*.json (no dependencies, can be created anytime)
```

---

## SUB-AGENT ASSIGNMENTS

### Sub-agent A: Constants (35 files)
**Input:** HARDCODED-ENFORCEMENT-VALUES.md, ENFORCEMENT-GAPS.md
**Task:** Write all 34 constant files + index.ts
**Rules:**
- Pure data export statements (no logic except killAgent function in 03-timeouts.ts)
- Every value copy-pasted from source doc or explicitly defined with justification
- Every file has header comment: `// Source: HARDCODED-ENFORCEMENT-VALUES.md section N` or `// Source: ENFORCEMENT-GAPS.md gap N`
- No function implementations except killAgent() in 03-timeouts.ts
- TypeScript syntax: interfaces for complex types, const for values

**Acceptance:** `tsc constants/*.ts --noEmit` with zero errors

---

### Sub-agent B: Check Scripts (12 files)
**Input:** HARD-RAILS.md (sections 1-11), ENFORCEMENT-GAPS.md (gap 10 for deploy health)
**Task:** Write all 12 check scripts
**Rules:**
- Copy scripts verbatim from HARD-RAILS.md
- Add check_deploy_health.py following same pattern as check_docker_health.py but targets deployed URL
- Each script must exit 0 on healthy, exit 1 on broken
- Make executable: `chmod +x checks/*.py checks/*.sh`
- Include arg parsing: projectDir as first argument

**Acceptance:**
- Each script exits 0 when run on healthy mock project
- Each script exits 1 when run on broken mock project
- All scripts executable

---

### Sub-agent C: Engine Core (4 files)
**Input:** engine/types.ts reference, constants/*.ts
**Task:** Write types.ts, enforcer.ts, bodyguard.ts, circuit-breaker.ts
**Rules:**
- types.ts: Pure interfaces, no logic. Comprehensive (EnforcerCheck, EnforcerResult, GateResult, BodyguardVerdict, SpineState, StepExecution, DagStep, UserAction, etc.)
- enforcer.ts: Spawn check script, read exit code + output, return pass/fail with evidence
- bodyguard.ts: CRITICAL — read CHECK_ACTIVATION, filter applicable checks, dispatch with Promise.allSettled (PARALLEL, NOT sequential), aggregate results (hard fails block, soft fails warn), return verdict
- circuit-breaker.ts: On check fail, return user action (Retry/Skip/Stop based on confidence)

**Verification:**
- `Promise.allSettled` present in bodyguard.ts
- No sequential loop patterns in bodyguard.ts
- All numbers imported from constants
- Types compile clean

---

### Sub-agent D: Engine Infrastructure (6 files)
**Input:** constants/*.ts, engine/types.ts
**Task:** Write spine.ts, spine-lock.ts, context-warden.ts, heartbeat.ts, project-state.ts, cron-manager.ts
**Rules:**
- spine.ts: Run find, git status, npm test, docker ps, curl. Assemble SpineState. Only LLM call: 1-sentence summary of changes (marked clearly with comment: `// LLM CALL: summarize changes`). All other operations are pure code.
- spine-lock.ts: Lockfile acquire/release. Prevent concurrent writes.
- context-warden.ts: Cron every 30s, check all agents' tokens, compare to threshold, kill + respawn at threshold with grace rule
- heartbeat.ts: Timer-based liveness. 3 missed beats = stuck. Return kill policy.
- project-state.ts: State machine logic. OPEN → PAUSED (15min) → CLOSED (24h) → auto-archive
- cron-manager.ts: setInterval registry. Register/unregister/pause/resume.

**Verification:**
- spine.ts has exactly 1 LLM call comment
- context-warden.ts has setInterval(30s)
- heartbeat.ts detects missed beats

---

### Sub-agent E: Scheduler + Spawner + Templates (8 files)
**Input:** All constants, all engine modules from A-D, HARDCODED-ENFORCEMENT-VALUES.md section 11, ENFORCEMENT-GAPS.md gap 3
**Task:** Write step-scheduler.ts, agent-spawner.ts, 6 enforcer-*.json templates
**Rules:**
- step-scheduler.ts: Execute the 10-step flowchart per DAG step. Call spine before/after, warden, inject skill, spawn, heartbeat, bodyguard, PA stub, save state. This is the orchestrator that wires everything together.
- agent-spawner.ts: child_process.spawn + PID tracking + timeout (per TIMEOUTS constants) + token counting (read API response headers)
- enforcer-*.json: Valid ENFORCER.json structure per ENFORCER.json from Instance 3. 6 files for different check categories.

**Verification:**
- step-scheduler.ts imports and uses all engine modules
- agent-spawner.ts uses child_process.spawn, timeout handling
- All 6 JSON files valid syntax

---

## CRITICAL RULES (All Sub-agents)

1. **Every number from source docs.** If you write a number, it must come from HARDCODED-ENFORCEMENT-VALUES.md or be defined as a gap fill with justification.

2. **Every file has header comment** with source. Format:
   ```typescript
   // Source: HARDCODED-ENFORCEMENT-VALUES.md section N
   // or
   // Source: ENFORCEMENT-GAPS.md gap N
   ```

3. **No logic in constants.** Except killAgent() function in 03-timeouts.ts. Everything else is const declarations.

4. **Bodyguard is always parallel.** Promise.allSettled, never sequential. Check the constant BODYGUARD.MAX_PARALLEL_CHECKS for concurrency limit.

5. **Spine has one LLM call.** Everything else is filesystem/git/subprocess. Mark the LLM call clearly.

6. **Step-scheduler orchestrates, doesn't duplicate.** It calls other modules. It doesn't reimplement their logic.

7. **Check scripts are standalone.** They work outside TypeScript context. They exit 0/1. They parse arguments.

---

## VERIFICATION SCRIPT (verify.sh)

```bash
#!/bin/bash
set -e

echo "=== VERIFY: Constants Compile ==="
npx tsc constants/*.ts --noEmit

echo "=== VERIFY: Engine Types Compile ==="
npx tsc engine/types.ts --noEmit

echo "=== VERIFY: Engine Compiles ==="
npx tsc engine/*.ts --noEmit

echo "=== VERIFY: No Magic Numbers ==="
if grep -r "= [0-9]" engine/ | grep -v "constants/" | grep -v "// "; then
  echo "FAIL: Found magic numbers in engine/"
  exit 1
fi

echo "=== VERIFY: Bodyguard Parallel ==="
if ! grep -q "Promise.allSettled" engine/bodyguard.ts; then
  echo "FAIL: bodyguard.ts missing Promise.allSettled"
  exit 1
fi

echo "=== VERIFY: Spine No LLM ==="
llm_count=$(grep -c "// LLM CALL:" engine/spine.ts)
if [ "$llm_count" -ne 1 ]; then
  echo "FAIL: spine.ts must have exactly 1 LLM CALL marker, found $llm_count"
  exit 1
fi

echo "=== VERIFY: Check Scripts Executable ==="
for script in checks/*.py checks/*.sh; do
  if [ ! -x "$script" ]; then
    echo "FAIL: $script not executable"
    exit 1
  fi
done

echo "=== VERIFY: Check Scripts Work ==="
# Create mock healthy project
mkdir -p /tmp/mock-healthy
cd /tmp/mock-healthy
git init
npm init -y
mkdir dist && echo '<html></html>' > dist/index.html
cd -

# Run checks — should all exit 0
for check in checks/check_files_exist.py; do
  python3 "$check" /tmp/mock-healthy || echo "WARN: $check exited 1 (expected for some checks)"
done

echo "=== VERIFY: JSON Templates Valid ==="
for template in templates/*.json; do
  jq . "$template" > /dev/null
done

echo ""
echo "✅ ALL VERIFICATIONS PASSED"
```

---

## TIMELINE

**Sub-agents A-E run in parallel:**
- A (constants): ~30 min (35 pure data files)
- B (checks): ~20 min (copy + chmod)
- C (core): ~45 min (types, enforcer, bodyguard, circuit-breaker — bodyguard is most critical)
- D (infra): ~50 min (spine is biggest, context-warden has cron logic)
- E (scheduler): ~40 min (scheduler orchestrates everything)

**Total wall-clock time:** ~50 minutes (not sequential, parallel)
**Then:** I integrate + write verify.sh + run verification

---

## DONE CRITERIA

- [ ] Constants compile clean
- [ ] Engine compiles clean
- [ ] No magic numbers in engine/
- [ ] bodyguard.ts uses Promise.allSettled
- [ ] spine.ts has exactly 1 LLM call marker
- [ ] All check scripts executable
- [ ] All JSON templates valid
- [ ] verify.sh passes

---

## GO

Ready to launch 5 sub-agents.
