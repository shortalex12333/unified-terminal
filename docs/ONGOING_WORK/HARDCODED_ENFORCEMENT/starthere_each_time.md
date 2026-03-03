You just completed Instance 3 (plugin dissection). You know this architecture cold. Now you implement it.OUTPUT DIRECTORYAll files go into:
/Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/WHAT EXISTS (read these from project docs before writing anything)
HARDCODED-ENFORCEMENT-VALUES.md — 24 sections of production constants. These are YOUR source of truth for every number.
ENFORCEMENT-GAPS.md — 10 missing sections. YOU fill gaps 1,2,5,9,10 (HIGH severity blockers) and 3,4,6,7,8 (MEDIUM, need reasonable defaults).
HARD-RAILS.md — 11 check scripts already written in Python/bash. Copy them into checks/, don't rewrite.
DOMAIN-B-CODE-QUALITY.md — ENFORCER.json schema, bodyguard dispatcher pattern.
AGENT-TOPOLOGY-MVP.md — Agent tiers, sub-agent spawn rules, token budget allocation.
CONDUCTOR-ARCHITECTURE.md — Tier 0-3 routing, DAG structure, fast-path.
Read ALL of these before writing line one. Every constant you use must trace back to a source document. No invented numbers.GSD FRAMEWORK — THREE PHASESPHASE 1: PLAN (do this first, get my approval)Create plan.md with:

Complete file manifest (every file, path, estimated lines, depends-on)
Sub-agent assignments (which sub-agent writes which files)
Dependency order (what must exist before what)
Verification criteria per file (binary pass/fail, not subjective)
PHASE 2: EXECUTE (after plan approval)Build this file tree:HARDCODED_ENFORCEMENT/
├── plan.md
│
├── constants/                        # SINGLE SOURCE OF TRUTH
│   ├── index.ts                      # Re-exports everything. ~50 lines.
│   ├── 01-context-warden.ts          # TOKEN_THRESHOLDS (from doc section 1)
│   ├── 02-cron-intervals.ts          # CRON_INTERVALS (section 2)
│   ├── 03-timeouts.ts                # TIMEOUTS + killAgent() (section 3)
│   ├── 04-circuit-breaker.ts         # CIRCUIT_BREAKER (section 4)
│   ├── 05-file-thresholds.ts         # FILE_THRESHOLDS (section 5)
│   ├── 06-tier-classification.ts     # TIER_CLASSIFICATION (section 6)
│   ├── 07-project-state.ts           # PROJECT_STATE timers (section 7)
│   ├── 08-sub-agent-rules.ts         # SUB_AGENT_RULES (section 8)
│   ├── 09-retry-policies.ts          # ENFORCER_RETRY_POLICIES (section 9)
│   ├── 10-check-activation.ts        # CHECK_ACTIVATION map (section 11)
│   ├── 11-token-budget.ts            # PHASE_BUDGET_WEIGHTS (section 12)
│   ├── 12-model-routing.ts           # MODEL_ROUTING (section 13)
│   ├── 13-tool-permissions.ts        # CODEX_SANDBOX, CLAUDE/GEMINI maps (section 14)
│   ├── 14-deploy-health.ts           # DEPLOY_HEALTH (section 15)
│   ├── 15-rate-limit.ts              # RATE_LIMIT_PATTERNS + DOM_POLLING (sections 16-17)
│   ├── 16-latency-budget.ts          # LATENCY_BUDGET (section 18)
│   ├── 17-skill-injector.ts          # SKILL_INJECTOR thresholds (section 19)
│   ├── 18-lesson-validation.ts       # LESSON_VALIDATION (section 20)
│   ├── 19-scope-whitelist.ts         # SCOPE_WHITELIST (section 21)
│   ├── 20-responsive.ts              # RESPONSIVE_VIEWPORTS (section 22)
│   ├── 21-intake.ts                  # INTAKE (section 23)
│   ├── 22-memory.ts                  # MEMORY_CONSTRAINTS (section 24)
│   │
│   │  # GAPS — YOU DEFINE THESE (follow same format as sections 1-24)
│   ├── 25-bodyguard.ts               # GAP 1: max parallel, total timeout, mixed result policy
│   ├── 26-spine-protocol.ts          # GAP 2: staleness, write lock, required sections
│   ├── 27-conductor-messages.ts      # GAP 3: valid statuses, max DAG steps, replan threshold
│   ├── 28-routing-rules.ts           # GAP 4: WEB_ONLY, CLI_ONLY, HYBRID, fallbacks
│   ├── 29-sub-agent-budget.ts        # GAP 5: overhead tax, min viable, exceeded policy
│   ├── 30-skill-injection.ts         # GAP 6: max tokens, overflow, max skills per worker
│   ├── 31-testing.ts                 # GAP 7: runner detection order, no-test policy
│   ├── 32-error-propagation.ts       # GAP 8: severity levels, user message template
│   ├── 33-http-enforcement.ts        # GAP 9: HTTP timeout, real 200 detection, DNS timeout
│   └── 34-step-execution.ts          # GAP 10: heartbeat interval, stale detection, output capture
│
├── checks/                           # 11 HARD RAIL SCRIPTS (copy from HARD-RAILS.md, don't rewrite)
│   ├── check_tests.py                # #1: npm test exit code + empty suite detection
│   ├── check_files_exist.py          # #2: declared files on disk
│   ├── check_files_nonempty.py       # #3: size > 50 bytes
│   ├── check_build_artifact.py       # #4: dist/ has .html/.js/.css
│   ├── check_scope.py                # #5: git diff vs declared files
│   ├── check_tokens.py               # #6: utilization vs per-model threshold
│   ├── check_secrets.sh              # #7: gitleaks exit code
│   ├── check_uninstall.py            # #8: node_modules/{pkg} gone
│   ├── check_docker_health.py        # #9: curl 200 + not error page
│   ├── check_lesson.py               # #10: 4 fields + no placeholders
│   ├── check_responsive.py           # #11: 3 viewport screenshots > 1KB
│   └── check_deploy_health.py        # #12: curl deployed URL (same pattern as #9, different target)
│
├── engine/                           # THE ENFORCEMENT ENGINE
│   ├── types.ts                      # Interfaces: EnforcerCheck, EnforcerResult, GateResult, BodyguardVerdict, SpineState
│   ├── enforcer.ts                   # Reads ENFORCER.json → runs check command → returns pass/fail with evidence
│   ├── bodyguard.ts                  # Dispatcher: reads CHECK_ACTIVATION → Promise.allSettled → aggregates → verdict
│   ├── circuit-breaker.ts            # 3-fail → IPC to Electron → user picks retry/skip/stop
│   ├── spine.ts                      # buildSpine(): find + git + npm test + build + docker + curl → SpineState
│   ├── spine-lock.ts                 # Write lock: lockfile acquire/release preventing concurrent spine writes
│   ├── context-warden.ts             # Cron: every 30s check all agents' tokens. Kill + respawn at threshold. Grace rule.
│   ├── step-scheduler.ts             # DAG executor: pre-spine → warden → inject → spawn → post-spine → bodyguard → PA → done
│   ├── agent-spawner.ts              # child_process.spawn + PID tracking + timeout + token counting
│   ├── project-state.ts              # State machine: OPEN → PAUSED(15min) → CLOSED(24h) → REOPENED
│   ├── cron-manager.ts               # setInterval manager: register/unregister/pause/resume timers
│   └── heartbeat.ts                  # Worker liveness: stdout/file/api signals. 3 missed = stuck → kill.
│
├── templates/                        # ENFORCER.json per skill
│   ├── enforcer-test-before-commit.json
│   ├── enforcer-docker-local-first.json
│   ├── enforcer-scope-boundary.json
│   ├── enforcer-deploy.json
│   ├── enforcer-lesson.json
│   └── enforcer-scaffold.json
│
└── verify.sh                         # PHASE 3: one script that proves everything worksSUB-AGENT ASSIGNMENTSYou SHOULD use sub-agents. Here's how to split:Sub-agent A: Constants (sections 1-24 from doc + gaps 25-34)

34 constant files + index.ts
Pure data, no logic. Fastest to write.
Every value copy-pasted from HARDCODED-ENFORCEMENT-VALUES.md
Gap values defined by you following the same format
Estimated: 34 files, ~1,800 lines total
Sub-agent B: Check Scripts (from HARD-RAILS.md)

Copy the 11 Python/bash scripts verbatim from HARD-RAILS.md
Add check_deploy_health.py (same pattern as docker health, different URL source)
Make each executable: chmod +x
Test: each script should exit 0 on a healthy project, exit 1 on a broken one
Estimated: 12 files, ~400 lines total
Sub-agent C: Engine Core (the real work)

types.ts, enforcer.ts, bodyguard.ts, circuit-breaker.ts
These import from constants/. They implement the flowchart.
bodyguard.ts is the most critical: reads CHECK_ACTIVATION, matches step type to applicable checks, runs Promise.allSettled, classifies hard/soft fails, returns verdict
Estimated: 4 files, ~600 lines total
Sub-agent D: Engine Infrastructure

spine.ts, spine-lock.ts, context-warden.ts, heartbeat.ts, project-state.ts, cron-manager.ts
These are the always-running services
spine.ts is biggest: runs find, git, npm, docker, curl and assembles SpineState
Estimated: 6 files, ~700 lines total
Sub-agent E: Scheduler + Spawner + Templates

step-scheduler.ts (the backbone — wires everything together)
agent-spawner.ts
6 ENFORCER.json template files
step-scheduler.ts imports bodyguard, spine, context-warden, agent-spawner and orchestrates the per-step sequence
Estimated: 8 files, ~500 lines total
You (orchestrator): Write plan.md, assign sub-agents, review each output, write verify.sh, run final integration.THE FLOWCHART YOUR CODE IMPLEMENTSThis is what step-scheduler.ts does per DAG step:[1] Pre-step spine refresh        → spine.ts (HARD: code reads filesystem)
[2] Context warden check           → context-warden.ts (HARD: token arithmetic)
[3] Skill injection                → reads skill paths from DAG step (HARD: file existence)
[4] Spawn worker via adapter       → agent-spawner.ts (HARD: child_process.spawn)
[5] Monitor heartbeat              → heartbeat.ts (HARD: timer + signal detection)
[6] Post-step spine refresh        → spine.ts (HARD: code reads filesystem)
[7] Bodyguard gate                 → bodyguard.ts (HARD: parallel checks, binary results)
[8] Hard fail? → circuit-breaker   → circuit-breaker.ts (HARD: retry count + IPC)
[9] PA comparison                  → (SOFT: LLM-mediated, NOT your code — stub interface only)
[10] Mark DONE, save state         → (HARD: JSON write to disk)Steps 1-8 and 10 are your scope. Step 9 is a SOFT rail — you write the INTERFACE (what PA receives and returns) but NOT the implementation. The PA is an LLM agent; you just define the contract it must satisfy.CRITICAL RULESEvery constant traces to a source. If you use a number, it comes from HARDCODED-ENFORCEMENT-VALUES.md or you define it in a gap file with a comment explaining why that value.Check scripts are Python/bash, engine is TypeScript. The checks are invoked by enforcer.ts via child_process.spawn("python3", ["checks/check_tests.py", projectDir]). The engine wraps them in TypeScript but the actual verification is subprocess execution.Bodyguard is NEVER sequential. Always Promise.allSettled. The constant BODYGUARD.MAX_PARALLEL_CHECKS (gap 25) limits concurrency, but within that limit it's always parallel.Spine NEVER calls an LLM. It runs commands: find, git status, npm test, docker compose ps, curl. The one exception: a 1-sentence summary of changes, which is the ONLY LLM call in the entire spine module. Mark it clearly.The step-scheduler is the ONLY thing that spawns workers. No other module can call agent-spawner.ts directly.Gap values you define must be conservative. When in doubt, pick the value that fails SAFER (lower timeouts, stricter limits, harder kills). You can always relax later. You can't un-corrupt a spine file.PHASE 3: VERIFYCreate verify.sh that proves the implementation works:bash#!/bin/bash
# Verification script for hardcoded enforcement engine

echo "=== VERIFY: Constants ==="
# Every constants/*.ts file must export at least one named export
# TypeScript compiler must not error on any file

echo "=== VERIFY: Check Scripts ==="
# Create a mock healthy project in /tmp
# Run each check script against it — all must exit 0
# Create a mock broken project (empty files, no tests)
# Run each check script — relevant ones must exit 1

echo "=== VERIFY: Engine Types ==="
# TypeScript compiler on engine/types.ts — must compile clean

echo "=== VERIFY: Engine Imports ==="
# Every engine/*.ts file must import from constants/ (no magic numbers)
# grep -r "= [0-9]" engine/ should return ZERO matches (all numbers from constants)

echo "=== VERIFY: Bodyguard Parallel ==="
# grep for "Promise.allSettled" in bodyguard.ts — must exist
# grep for sequential patterns (for...of runCheck, await runCheck inside loop) — must NOT exist

echo "=== VERIFY: Spine No LLM ==="
# grep for "openai\|anthropic\|claude\|gpt" in spine.ts — must find only the 1-sentence summaryHARD BOUNDARIES
Do NOT build adapters (Instance 2 does that)
Do NOT build UI/Electron (Instance 1 does that)
Do NOT implement the PA agent (that's a SOFT rail — just define the interface)
Do NOT implement the Conductor's LLM brain (just define the message contract)
Do NOT use any number that isn't in the source documents or explicitly defined as a gap fill with justification
Every file must have a header comment: // Source: HARDCODED-ENFORCEMENT-VALUES.md section N or // Source: ENFORCEMENT-GAPS.md gap N
STARTRead the source documents. Write plan.md. Show me the plan. Then execute with sub-agents.