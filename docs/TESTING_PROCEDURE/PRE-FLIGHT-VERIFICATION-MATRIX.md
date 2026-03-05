# PRE-FLIGHT VERIFICATION MATRIX

## What This Is

Every test the system must pass before a user touches it. No real project context needed. Synthetic inputs exercise every joint. Binary pass/fail only.

The rule: if you can't prove it works with a fake input, it doesn't work.

---

## LAYER 1: ELECTRON SHELL (Does the app exist?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 1.1 | App launches | Double-click .app | Window appears, no crash | Visual | |
| 1.2 | BrowserView loads ChatGPT | App launch | chat.openai.com renders | Visual + no console errors | |
| 1.3 | OAuth popup: Google | Click "Sign in with Google" | Popup opens, completes, returns authenticated | Manual flow | |
| 1.4 | OAuth popup: Microsoft | Click "Sign in with Microsoft" | Same as above | Manual flow | |
| 1.5 | OAuth popup: Apple | Click "Sign in with Apple" | Same as above | Manual flow | |
| 1.6 | Email/password sign-in | Type credentials | Authenticated session | Manual flow | |
| 1.7 | Session persistence | Sign in → quit → relaunch | Still signed in, no re-auth | Quit and reopen | |
| 1.8 | 2FA flow | Account with 2FA enabled | 2FA prompt appears, completes | Manual with 2FA account | |
| 1.9 | Window resize | Drag corners | BrowserView resizes correctly, no black bars | Visual | |
| 1.10 | Menu bar icon | Minimize to tray | Icon appears, click reopens | Visual | |
| 1.11 | Multiple instance prevention | Open app twice | Second launch focuses first, doesn't create second | Launch twice | |
| 1.12 | macOS permissions | First launch | Clipboard + notification permissions requested | System dialog | |

---

## LAYER 2: DOM ADAPTER (Can we control ChatGPT?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 2.1 | Inject text | IPC: `chatgpt:inject("hello")` | "hello" appears in ChatGPT input field | Inspect BrowserView | |
| 2.2 | Send message | IPC: inject + send | ChatGPT generates response | Watch BrowserView | |
| 2.3 | Capture response | Send "say exactly: TESTWORD123" | Capture returns string containing TESTWORD123 | Code assertion | |
| 2.4 | Capture streaming | Send any prompt | Capture returns incremental chunks, final complete | Log output timing | |
| 2.5 | Rate limit detection | Inject rate limit text into DOM (mock) | RateLimitMonitor fires `onLimited` | Event listener assertion | |
| 2.6 | Rate limit recovery | Clear rate limit text from DOM | `onResumed` fires within polling interval | Event listener assertion | |
| 2.7 | New conversation | IPC: `chatgpt:newConversation` | Fresh conversation, no prior context | Visual + URL change | |
| 2.8 | DOM selector resilience | Change ChatGPT's textarea class | Fallback selectors find input | Mock DOM mutation + inject | |
| 2.9 | Paste long content | Inject 5,000 character string | Full string appears, React state updates | Compare injected vs captured | |
| 2.10 | Special characters | Inject `"quotes", <html>, \n\t, emoji 🔥` | All characters survive round-trip | String comparison | |

---

## LAYER 3: CLI ADAPTERS (Can we spawn and control runtimes?)

### 3A: Codex CLI

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 3A.1 | Codex installed | `which codex` | Path returned, exit 0 | Exit code | |
| 3A.2 | Codex auth | `codex auth status` | Authenticated | Exit code + stdout | |
| 3A.3 | Spawn trivial task | `codex exec "create /tmp/test.txt with 'hello'"` | File exists, contains "hello" | `fs.existsSync + readFile` | |
| 3A.4 | JSON output parsing | `codex exec --json "say hello"` | Valid JSON with `output` field | `JSON.parse` succeeds | |
| 3A.5 | Session resume | Spawn → get session ID → resume with "continue" | Second response references first | Content inspection | |
| 3A.6 | Timeout enforcement | Spawn task, set 3s timeout | SIGTERM sent at 3s, SIGKILL at 8s | Process exit + timing | |
| 3A.7 | PID tracking | Spawn → record PID → kill | Process dead, no orphans | `ps aux | grep PID` | |
| 3A.8 | Token usage capture | Spawn task | `AgentResult.tokenUsage` has non-zero values | Field assertion | |
| 3A.9 | Error capture | Spawn impossible task | `AgentResult.error` populated, `success: false` | Field assertion | |
| 3A.10 | Sandbox modes | Each CODEX_SANDBOX value | Correct `--sandbox` flag in spawn command | Command string inspection | |

### 3B: Claude Code

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 3B.1 | Claude installed | `which claude` | Path returned | Exit code | |
| 3B.2 | Claude auth | `claude auth status` | Authenticated | Exit code | |
| 3B.3 | Spawn trivial task | `claude --agent "create /tmp/test.txt"` | File exists | `fs.existsSync` | |
| 3B.4 | Session resume | Spawn → get ID → `claude resume <id>` | Continues prior context | Content inspection | |
| 3B.5 | Tool permissions | Each CLAUDE_TOOL_MAP entry | Correct tool names in settings | Config inspection | |

### 3C: Gemini CLI

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 3C.1 | Gemini installed | `which gemini` | Path returned | Exit code | |
| 3C.2 | Gemini auth | `gemini auth status` | Authenticated | Exit code | |
| 3C.3 | Spawn trivial task | `gemini --agent "create /tmp/test.txt"` | File exists | `fs.existsSync` | |
| 3C.4 | No resume (expected) | Attempt resume | Graceful fail, fresh spawn instead | No crash | |

### 3D: Adapter Contract (all adapters)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 3D.1 | AgentResult shape | Any spawn | All fields present: success, output, filesCreated, filesModified, tokenUsage, duration, exitCode | Type assertion | |
| 3D.2 | Model routing | `fast/standard/reasoning` per adapter | Correct model string mapped | Config check | |
| 3D.3 | CLI not installed | Remove CLI from PATH | `AgentResult.error` = "not found", no crash | Error assertion | |
| 3D.4 | CLI auth expired | Revoke auth token | `AgentResult.error` = "auth", no crash | Error assertion | |

---

## LAYER 4: SKILL SYSTEM (Can we select and inject skills?)

### 4A: Skill Selector Agent

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 4A.1 | Agent spawns | Minimal AgentConfig | Agent returns JSON with `skills[]` and `reasoning` | JSON.parse | |
| 4A.2 | Frontend task | step: "build landing page" | Returns skill containing "frontend" or "design" | Array content check | |
| 4A.3 | TDD task | step: "implement with tests" | Returns tdd-guide.md | Array content check | |
| 4A.4 | Deploy task | step: "deploy to Vercel" | Returns deploy.md | Array content check | |
| 4A.5 | Trivial task | step: "What is CSS?" (tier 0) | Returns empty array | Length check | |
| 4A.6 | Unknown task | step: "frobnicate the widget" | Returns empty or generic, no crash | No throw | |
| 4A.7 | Max 3 skills | step: "build, test, deploy, review, and secure an app" | Returns ≤ 3 skills | Length check | |
| 4A.8 | Token budget | 3 large skills selected | Combined tokens ≤ 4,000 | Token count | |

### 4B: Skill Files

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 4B.1 | All files exist | Scan `resources/skills/` | Every file in catalog exists on disk | `fs.existsSync` per file | |
| 4B.2 | All have hints | Read line 1 of each skill | Contains `<!-- hints: ... -->` | Regex match | |
| 4B.3 | All under token limit | Tokenize each skill | Each ≤ 2,000 tokens | Tokenizer count | |
| 4B.4 | Critical skills have verify block | Read tdd-guide, security-reviewer, docker-local-first, deploy | Each has `## verify` section with JSON | Regex match | |
| 4B.5 | All have "Success Looks Like" | Read every skill | Section present | Regex match | |

### 4C: Skill-Was-Followed Verification

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 4C.1 | TDD: tests before impl | Mock git log: test file timestamp < impl timestamp | Check passes | check script exit 0 | |
| 4C.2 | TDD: impl before tests | Mock git log: impl timestamp < test timestamp | Check fails | check script exit 1 | |
| 4C.3 | Security: gitleaks ran | Mock gitleaks exit 0 | Check passes | check script exit 0 | |
| 4C.4 | Security: gitleaks never ran | No gitleaks in process log | Check fails | check script exit 1 | |
| 4C.5 | Docker: build ran | `docker build` in process log | Check passes | check script exit 0 | |
| 4C.6 | Verify block parsing | Skill with ## verify JSON | Parses to EnforcerCheck[] | JSON.parse succeeds | |
| 4C.7 | Missing verify block | Skill without ## verify | Returns empty checks (no crash) | Empty array | |
| 4C.8 | Critical fallback registry | Delete verify block from tdd-guide | Registry checks STILL run | Hard-coded checks fire | |

---

## LAYER 5: HARD RAILS (Do enforcement checks work?)

### 5A: The 11 Core Checks (each with PASS and FAIL synthetic input)

| # | Check | Pass Input | Fail Input | How to Check | Pass? |
|---|-------|-----------|-----------|-------------|-------|
| 5A.1 | Test exit code | Mock project: `npm test` exits 0, 5 tests pass | `npm test` exits 1 | `check_tests.py` exit code | |
| 5A.2 | Test empty suite | `npm test` exits 0 but 0 tests ran | Should be FAIL not PASS | `check_tests.py` catches empty suite | |
| 5A.3 | File existence | Create `/tmp/mock/src/index.ts` | Don't create it | `check_files_exist.py` with declared list | |
| 5A.4 | File non-empty | File with 200 bytes | File with 10 bytes | `check_files_nonempty.py` | |
| 5A.5 | Build artifact | Create `dist/` with `index.html` | Empty `dist/` | `check_build_artifact.py` | |
| 5A.6 | Scope enforcement | Modify only declared files | Modify undeclared `auth.ts` | `check_scope.py` with git mock | |
| 5A.7 | Scope whitelist | Modify `package-lock.json` (auto-gen) | Should not fail | Whitelisted files pass | |
| 5A.8 | Token threshold | 50% utilization (under 55% killAt) | 60% utilization (over 55%) | `check_tokens.py` | |
| 5A.9 | Token grace | 60% utilization, 90% task progress | Should PASS (grace) | `check_tokens.py` grace logic | |
| 5A.10 | Secret detection | Clean repo | Repo with `STRIPE_KEY=sk_live_...` | `check_secrets.sh` | |
| 5A.11 | Uninstall verify | Remove `lodash` from node_modules | Leave `lodash` in node_modules | `check_uninstall.py` | |
| 5A.12 | Docker health | Mock: curl returns 200 with HTML | curl returns 200 with "Cannot GET" | `check_docker_health.py` | |
| 5A.13 | Docker warming | First curl returns 502, second returns 200 | Should retry and eventually pass | Retry logic exercised | |
| 5A.14 | Lesson template | All 4 fields filled with real content | "What broke: TODO" (placeholder) | `check_lesson.py` | |
| 5A.15 | Responsive screenshots | 3 files > 1KB each at correct viewports | Missing mobile screenshot | `check_responsive.py` | |
| 5A.16 | Deploy health | Mock: curl deployed URL returns 200 | Returns 404 | `check_deploy_health.py` | |

### 5B: Bodyguard Dispatcher

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 5B.1 | Parallel execution | 5 checks, each takes 1s | All complete in ~1s, not 5s | Duration check | |
| 5B.2 | Activation map: code step | step.modifiedCodeFiles = true | test-exit-code + scope-enforcement fire | Check list assertion | |
| 5B.3 | Activation map: tier 1 | tier = 1 | Only file-existence fires | Check list assertion | |
| 5B.4 | Activation map: tier 3 | tier = 3, frontend, build | All applicable checks fire | Check list assertion | |
| 5B.5 | Hard fail blocks | One definitive check fails | `GateResult.passed = false, canOverride = false` | Field assertion | |
| 5B.6 | Soft fail warns | One heuristic check fails, rest pass | `passed = false, canOverride = true` | Field assertion | |
| 5B.7 | All pass | Every check returns pass | `passed = true` | Field assertion | |
| 5B.8 | Check timeout | One check hangs (mock 120s) | Bodyguard times out that check, others unaffected | Duration + result | |
| 5B.9 | Total gate timeout | All checks hang | Entire gate fails after TOTAL_GATE_TIMEOUT_MS | Duration check | |

### 5C: Circuit Breaker

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 5C.1 | First failure | Step fails once | Retry automatically | Retry count = 1 | |
| 5C.2 | Second failure | Same step fails twice | Retry automatically | Retry count = 2 | |
| 5C.3 | Third failure | Same step fails three times | Ask user: Retry/Skip/Stop | IPC message sent | |
| 5C.4 | Definitive fail | Definitive check fails once | Ask user: Retry/Stop (NO skip) | No "Skip" option | |
| 5C.5 | User says Retry | User picks "Retry" | Step re-executes, count resets | Execution resumes | |
| 5C.6 | User says Skip | User picks "Skip" (heuristic) | Step marked SKIPPED, logged to spine | State check | |
| 5C.7 | User says Stop | User picks "Stop build" | Entire DAG aborts gracefully | No orphan processes | |

---

## LAYER 6: CONDUCTOR + ROUTING (Can we classify and plan?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 6.1 | Fast-path: greeting | "hi there" | Bypassed to ChatGPT, 0 agents, <50ms | Timer + route check | |
| 6.2 | Fast-path: question | "What is TypeScript?" | Bypassed to ChatGPT | Route check | |
| 6.3 | Fast-path: thanks | "thanks!" | Bypassed | Route check | |
| 6.4 | Tier 1: simple | "fix the typo on the about page" | 1 worker + bodyguard, <5s overhead | Agent count + timer | |
| 6.5 | Tier 2: medium | "add a contact form with email sending" | 3-7 step DAG, skill injection active | DAG step count | |
| 6.6 | Tier 3: complex | "build me a candle store with Stripe payments" | 8-15 step DAG, full nervous system | DAG step count + actors active | |
| 6.7 | DAG structure | Any tier 2+ input | Valid JSON DAG with id, target, action, detail, waitFor | JSON schema validation | |
| 6.8 | Dependency ordering | DAG with dependencies | Steps with `waitFor` don't execute until dependencies DONE | Execution order check | |
| 6.9 | CLI routing | "scaffold a Next.js app" | Target = cli, action = codex_scaffold | Route check | |
| 6.10 | Web routing | "generate a hero image" | Target = web, action = dall_e | Route check | |
| 6.11 | Hybrid routing | "research competitors then build landing page" | Mix of web + cli steps | Route check per step | |
| 6.12 | Max DAG steps | Absurdly complex request | DAG ≤ 50 steps | Length check | |
| 6.13 | Re-plan on failure | Step fails, conductor notified | Conductor produces revised DAG or retry | New DAG received | |

---

## LAYER 7: STEP SCHEDULER (Does the backbone work?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 7.1 | Sequential execution | 3-step DAG, all sequential | Steps execute 1,2,3 in order | Execution log | |
| 7.2 | Pre-step spine refresh | Any step | spine.ts called BEFORE worker spawn | Call order log | |
| 7.3 | Post-step spine refresh | Any step completes | spine.ts called AFTER worker, BEFORE bodyguard | Call order log | |
| 7.4 | Skill injection | Step with matching skill | Skill content prepended to worker prompt | Prompt inspection | |
| 7.5 | Bodyguard gate | Step completes | Bodyguard runs applicable checks | Check execution log | |
| 7.6 | Gate pass → next step | Bodyguard passes | Scheduler advances to next step | State progression | |
| 7.7 | Gate fail → circuit breaker | Bodyguard hard-fails | Circuit breaker engaged | User prompted | |
| 7.8 | Step DONE state | Successful step | Step marked DONE in DAG | State check | |
| 7.9 | Step FAILED state | Step exhausts retries | Step marked FAILED | State check | |
| 7.10 | Step SKIPPED state | User skips heuristic fail | Step marked SKIPPED, downstream unblocked | State + dependency check | |
| 7.11 | Deadlock detection | DAG where step A waits for step B which waits for A | Detected, escalated to user | Error handling | |
| 7.12 | All steps complete | Full DAG runs | Scheduler reports COMPLETE | Final state | |

---

## LAYER 8: INFRASTRUCTURE AGENTS (Do the always-on services work?)

### 8A: Spine

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 8A.1 | File scan | Mock project dir with 5 files | SpineState.files lists all 5 | Field assertion | |
| 8A.2 | Git status | Mock git repo with uncommitted changes | SpineState.gitStatus shows changes | Field assertion | |
| 8A.3 | Test results | Project with passing tests | SpineState.lastTestRun.passed = true | Field assertion | |
| 8A.4 | No git repo | Directory without .git | SpineState.gitStatus = null, no crash | No throw | |
| 8A.5 | No node_modules | Project without npm install | SpineState handles gracefully | No throw | |
| 8A.6 | Write lock | Two spine refreshes simultaneously | Lock prevents concurrent write, second waits | No corruption | |
| 8A.7 | Stale detection | Spine data 60s old | Flagged stale, force refresh | Staleness flag | |

### 8B: Context Warden

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 8B.1 | Under threshold | Agent at 40% utilization | No action | Agent still running | |
| 8B.2 | Over threshold, low progress | Agent at 60%, task 30% done | SIGTERM sent | Process killed | |
| 8B.3 | Over threshold, high progress | Agent at 60%, task 90% done | Grace: let finish | Agent still running | |
| 8B.4 | Grace boundary | Agent at threshold, task exactly 85% | Let finish (≥ 0.85) | Agent still running | |
| 8B.5 | Cron fires | 30 seconds pass | Warden checks all active agents | Log entry | |
| 8B.6 | Kill sequence | Kill triggered | SIGTERM → 5s wait → SIGKILL if still alive | Process exit + timing | |
| 8B.7 | Respawn after kill | Agent killed for context | New agent spawned at same step | Fresh PID, same step | |

### 8C: Cron Manager

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 8C.1 | Register timer | Register 1s interval | Callback fires every ~1s | Call count | |
| 8C.2 | Unregister timer | Unregister | Callback stops firing | Call count frozen | |
| 8C.3 | Pause/resume | Pause, wait, resume | No callbacks during pause, resume works | Call timing | |
| 8C.4 | Multiple timers | 3 different intervals | All fire independently | Individual call counts | |

### 8D: Heartbeat Monitor

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 8D.1 | Active worker | Worker producing stdout every 30s | Heartbeat detected, no intervention | Status = healthy | |
| 8D.2 | Stuck worker | Worker silent for 3 minutes | Detected as stuck, killed | Process killed | |
| 8D.3 | File creation counts | Worker creates file (no stdout) | Heartbeat detected via filesystem | Status = healthy | |

---

## LAYER 9: PROJECT LIFECYCLE (Does state management work?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 9.1 | State: OPEN → PAUSED | 15 min inactivity | State transitions to PAUSED | State check | |
| 9.2 | State: PAUSED → OPEN | User returns within 24h | State transitions to OPEN, resumes | State check | |
| 9.3 | State: PAUSED → CLOSED | 24h passes | Archivist runs, state = CLOSED | State + archive exists | |
| 9.4 | State: CLOSED → REOPENED | User returns after 24h | PA reads archive, PAUL mode | State + PA log | |
| 9.5 | Archivist output | Project CLOSED | PROJECT-ARCHIVE.md exists, >500 bytes | File check | |
| 9.6 | llms.txt generation | Project CLOSED after build | llms.txt exists with project info | File + content check | |
| 9.7 | Lesson template enforcement | Worker encounters error | Lesson with 4 fields, no placeholders | Regex validation | |
| 9.8 | Lesson with placeholder | Worker writes "What broke: TODO" | Rejected, sent back | Re-fill enforcement | |
| 9.9 | State persistence | Kill app mid-task, relaunch | Task resumes from last saved step | Resume prompt appears | |
| 9.10 | Background execution | Minimize to tray | Tasks continue running | Progress advances | |

---

## LAYER 10: FRONTEND / UX (Does the user see the right things?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 10.1 | Intake quiz displays | New project started | 3-5 clarifying questions shown | Visual | |
| 10.2 | "Just build it" shortcut | User says "just build it" | Proceeds with defaults, no quiz | Flow check | |
| 10.3 | Progress display | Task running | User sees step-by-step progress (non-technical) | Visual | |
| 10.4 | Error display: non-technical | Hard fail on test suite | "Some tests didn't pass. Retrying." NOT "exit code 1" | Message content | |
| 10.5 | Rate limit display | ChatGPT rate limited | "ChatGPT needs a breather. Code tasks continue." | Message content | |
| 10.6 | Circuit breaker UI | 3 failures, user prompted | Retry / Skip / Stop buttons visible | Visual | |
| 10.7 | Definitive fail UI | Definitive check fails | Retry / Stop only (NO skip) | Visual — no skip button | |
| 10.8 | Output folder | Task completes | `~/Documents/[brand]/[project]/` exists with files | Finder check | |
| 10.9 | File watcher | New file created by worker | Progress UI updates to show new file | Visual | |
| 10.10 | Sleep/wake recovery | Close laptop 5 min, reopen | App reconnects, task resumes | State continuity | |

---

## LAYER 11: EDGE CASES (Does it survive the weird stuff?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 11.1 | No internet | Disconnect WiFi | CLI tasks continue, web tasks pause with message | Behavior split | |
| 11.2 | Internet returns | Reconnect WiFi | Web tasks auto-resume | Auto-continuation | |
| 11.3 | Disk full | Fill disk to 99% | Graceful warning before starting task | Warning message | |
| 11.4 | CLI crashes mid-task | `kill -9` the Codex process | State saved, retry offered | No data loss | |
| 11.5 | ChatGPT DOM changes | Mock: textarea class renamed | Fallback selectors find input | Still functional | |
| 11.6 | ChatGPT session expires | Mock: auth cookie cleared | Re-auth prompt in BrowserView | No crash | |
| 11.7 | Huge DAG | 50-step plan | All steps execute without memory explosion | Completion + RAM check | |
| 11.8 | Concurrent spine writes | Two workers finish within 10ms | Write lock prevents corruption | SPINE.md is valid | |
| 11.9 | Unicode project name | Project: "café résumé 日本語" | Folder created, files work | Path handling | |
| 11.10 | Long-running task | 45-minute complex build | Token budget respected, warden fires, state persisted | Full lifecycle | |
| 11.11 | Empty project | User says "build something" with zero specifics | Intake asks questions OR proceeds with defaults | No crash | |
| 11.12 | User cancels mid-step | Click "Stop build" during execution | Worker killed, no orphan processes, state saved | `ps aux` clean | |
| 11.13 | Multiple projects | Start project A, switch to project B | Both have independent state, spines, DAGs | State isolation | |
| 11.14 | Rapid messages | User sends 5 messages in 2 seconds | Queue, don't crash, process in order | Ordered execution | |

---

## LAYER 12: PACKAGING + DISTRIBUTION (Does it ship?)

| # | Test | Input | Expected | How to Check | Pass? |
|---|------|-------|----------|-------------|-------|
| 12.1 | DMG builds | `npm run dist:mac` | .dmg file produced, no errors | File exists | |
| 12.2 | DMG signed | Inspect with `codesign -dv` | Valid Apple Developer ID signature | codesign output | |
| 12.3 | DMG notarized | `spctl --assess` | Passes Gatekeeper | spctl output | |
| 12.4 | Clean install | Different Mac / clean user account | Drag to Applications, launch, no warnings | Manual test | |
| 12.5 | First launch flow | Never-opened app | Setup → scan → sign-in → first task | Full flow | |
| 12.6 | Auto-updater | Publish v0.0.2 while running v0.0.1 | Update detected, prompted, applied | Version change | |
| 12.7 | State survives update | Update from v1 to v2 | Projects, settings preserved | Data check | |
| 12.8 | App icon | Dock and Spotlight | Correct icon renders | Visual | |
| 12.9 | Uninstall clean | Drag to Trash | App gone, user data in Documents stays | Finder check | |

---

## WHAT YOU DIDN'T MENTION (added above, called out here)

1. **DOM selector resilience** (2.8) — ChatGPT changes their DOM regularly. Fallback selector chain must work.
2. **Rate limit detection + recovery** (2.5-2.6) — Critical for long tasks. Tested with mock DOM injection.
3. **Adapter "not installed" handling** (3D.3-3D.4) — What happens when Codex isn't installed? Must not crash.
4. **Spine write locking** (8A.6) — Two agents finishing simultaneously. Tested with concurrent mock writes.
5. **Heartbeat / stuck worker detection** (8D.1-8D.3) — Worker hangs silently. Must detect and kill.
6. **Context Warden grace period** (8B.3-8B.4) — The 85% boundary case specifically.
7. **Lesson template enforcement** (9.7-9.8) — Workers writing placeholder lessons. Rejected, not accepted.
8. **Deadlock detection** (7.11) — Circular DAG dependencies. Must detect, not hang forever.
9. **Concurrent spine writes** (11.8) — Race condition that corrupts state. Most subtle bug.
10. **User cancels mid-step** (11.12) — Orphan process cleanup. Must verify `ps aux` is clean.
11. **Skill-was-followed verification** (4C.1-4C.8) — The new hard rail from the agent-based skill selector.
12. **Critical skill fallback registry** (4C.8) — If someone deletes the verify block, hard-coded checks still fire.
13. **Multiple projects** (11.13) — State isolation between projects. Not obvious but critical.
14. **Sleep/wake recovery** (10.10) — macOS App Nap, BrowserView session expiry.
15. **Empty suite detection** (5A.2) — `npm test` exits 0 but ran 0 tests. Common false positive.

---

## HOW TO USE THIS

**Phase 1: Isolation tests** (Layers 1-5, 8)
Each component tested alone with mock inputs. No integration needed. Can run in parallel.

**Phase 2: Wiring tests** (Layers 6-7)
Conductor → Scheduler → Adapter → Bodyguard. Synthetic DAGs, synthetic tasks, real process spawning.

**Phase 3: Lifecycle tests** (Layer 9)
State machine transitions with timer manipulation. Archivist output validation.

**Phase 4: UX tests** (Layer 10)
Manual. Requires human eyes on screen. Non-technical person watches.

**Phase 5: Chaos tests** (Layer 11)
Break things deliberately. Kill processes, disconnect network, fill disk, corrupt DOM.

**Phase 6: Ship tests** (Layer 12)
Build, sign, notarize, install on clean machine, full flow.

Every checkbox must be filled before the .dmg goes out. No exceptions. No "we'll fix it later."
