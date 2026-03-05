# Test Verification Matrix

> Maps every test to its acceptance criterion. A feature is DONE when its test passes. No ambiguity.

---

## Existing Tests (480+ — All Must Continue Passing)

| Test File | Count | Run Command |
|-----------|-------|-------------|
| `tests/fast-path.test.ts` | 92 | `npx ts-node tests/fast-path.test.ts` |
| `tests/conductor.test.ts` | 63 | `npx ts-node tests/conductor.test.ts` |
| `tests/step-scheduler.test.ts` | 83 | `npx ts-node tests/step-scheduler.test.ts` |
| `tests/cli-auth.test.ts` | 57 | `npx ts-node tests/cli-auth.test.ts` |
| `tests/cli-runner.test.ts` | 42 | `npx ts-node tests/cli-runner.test.ts` |
| `tests/task-router.test.ts` | 38 | `npx ts-node tests/task-router.test.ts` |
| `tests/intake.test.ts` | 24 | `npx ts-node tests/intake.test.ts` |
| `tests/integration-flow.test.ts` | 24 | `npx ts-node tests/integration-flow.test.ts` |
| `tests/integration/conductor-scheduler-executor.test.ts` | 23 | `npx ts-node tests/integration/conductor-scheduler-executor.test.ts` |
| `tests/system-scanner.test.ts` | 15 | `npx ts-node tests/system-scanner.test.ts` |
| `tests/e2e/electron-dispatch.test.ts` | 10 | `npx ts-node tests/e2e/electron-dispatch.test.ts` |
| `tests/circuit-breaker-modal.test.ts` | 9 | `npx ts-node tests/circuit-breaker-modal.test.ts` |
| `tests/claude-adapter.test.ts` | 8 | `npx ts-node tests/claude-adapter.test.ts` |
| `tests/codex-adapter.test.ts` | 6 | `npx ts-node tests/codex-adapter.test.ts` |
| `tests/compatibility-matrix-validation.ts` | 4 | `npx ts-node tests/compatibility-matrix-validation.ts` |

**Regression check**: `npx ts-node tests/*.test.ts && npx ts-node tests/integration/*.test.ts && npx ts-node tests/e2e/*.test.ts`

---

## New Tests (Build Engineer Creates These)

### Phase 1: Event Bus (8 tests)

| # | Test Name | Acceptance Criterion | Pass Condition |
|---|-----------|---------------------|----------------|
| 1 | Emit and receive status event | Bus delivers events to subscribers | Subscriber callback receives StatusEvent with correct source, type, detail |
| 2 | Multiple subscribers | All subscribers receive same event | 3 subscribers each receive the emitted event |
| 3 | Unsubscribe works | Removed listener stops receiving | After removeListener, no callback on next emit |
| 4 | Events include timestamp | Timestamp auto-populated | `event.timestamp` is within 100ms of `Date.now()` |
| 5 | Events include stepId | Optional stepId passed through | `event.stepId === 5` when provided |
| 6 | Unknown event types don't crash | Graceful handling | No throw when emitting with unknown source |
| 7 | High-frequency emission | No dropped events | Emit 1000 events, subscriber receives 1000 |
| 8 | Singleton instance | Same bus everywhere | `require('./event-bus').statusBus === require('./event-bus').statusBus` |

### Phase 2: Translator (15 tests)

| # | Test Name | Acceptance Criterion | Pass Condition |
|---|-----------|---------------------|----------------|
| 1 | conductor:classify produces valid line | Translation exists | StatusLine with text "Understanding what you need..." |
| 2 | conductor:plan-ready includes step count | Step count extracted | text includes "Planning N steps" |
| 3 | worker:spawn humanizes task | Pattern matching works | "scaffold" → "Setting up your project..." |
| 4 | worker:file-created humanizes filename | PascalCase converted | "ContactForm.tsx" → "contact form" |
| 5 | worker:complete humanizes result | Duration included | expandedText includes duration |
| 6 | bodyguard:pass produces done state | Correct state | `state === 'done'`, `icon === '✅'` |
| 7 | bodyguard:fail-definitive produces error | Error state | `state === 'error'`, `icon === '🔧'` |
| 8 | rate-limit:hit produces paused | Rate limit UX | text === "Taking a short break...", `state === 'paused'` |
| 9 | deploy:live includes URL | URL in expanded text | expandedText contains the URL from detail |
| 10 | All lines ≤ 8 words | Word count enforced | Every TRANSLATIONS entry produces text with ≤ 8 words |
| 11 | Zero banned words | Banned word filter | No line text contains any word from BANNED_WORDS list |
| 12 | Unknown event returns generic | Graceful fallback | Unknown type → text "Working..." |
| 13 | Empty detail doesn't crash | JSON.parse guarded | detail="" → no throw, returns generic line |
| 14 | image-gen events correct icons | Icon mapping | `image-gen:start` → "🎨", `image-gen:complete` → "🖼️" |
| 15 | research events correct text | Research UX | `research:searching` → "Researching..." |

### Phase 3: IPC Bridge (10 tests)

| # | Test Name | Acceptance Criterion | Pass Condition |
|---|-----------|---------------------|----------------|
| 1 | status:line emitted and received | IPC roundtrip | Mock renderer receives StatusLine |
| 2 | status:line-update updates by ID | Partial update | Existing line's state changes to 'done' |
| 3 | status:query delivers UserQuery | Query rendering | Mock renderer receives UserQuery with options |
| 4 | user:query-response routes back | Response routing | Status agent handleQueryResponse called with correct queryId + value |
| 5 | user:correction triggers handler | Correction flow | Status agent handleCorrection called with text |
| 6 | user:stop-step stops step | Step-level stop | Status agent handleStopStep called with stepId |
| 7 | user:stop-all stops everything | Global stop | Status agent handleStopAll called |
| 8 | Consistent prefix | Channel naming | All status channels start with `status:` or `user:` |
| 9 | Unknown queryId no crash | Error handling | handleQueryResponse with bad ID → no throw, log warning |
| 10 | Rapid-fire no drops | Throughput | 100 status:line events in 100ms → all received |

### Phase 4: Status Tree (12 tests)

| # | Test Name | Acceptance Criterion | Pass Condition |
|---|-----------|---------------------|----------------|
| 1 | Empty state renders | No lines = no tree | Component renders without errors, shows "No activity" |
| 2 | Single line renders | Basic display | Line text + icon visible |
| 3 | Multiple lines in order | Ordering | Lines appear top-to-bottom in array order |
| 4 | Active line pulses | Visual indicator | Active state has CSS animation class |
| 5 | Completed line checkmark | Done indicator | Done state shows ✅ icon |
| 6 | Error line fix icon | Error indicator | Error state shows 🔧 icon |
| 7 | Expandable arrow | Click affordance | Expandable lines show expand indicator |
| 8 | Click expands | Cascade | Click toggles expandedText visibility |
| 9 | Parallel branches | Multi-agent | 2 active root nodes render as parallel branches |
| 10 | Progress bar | Overall progress | Bar fills to (completed / total) * 100% |
| 11 | Correction input | User feedback | Text input sends user:correction on submit |
| 12 | Stop button | Step control | Stop button sends user:stop-step with correct stepId |

### Phase 5: Checkpoints (10 tests)

| # | Test Name | Acceptance Criterion | Pass Condition |
|---|-----------|---------------------|----------------|
| 1 | PLAN_REVIEW fires | Checkpoint trigger | conductor:plan-ready → UserQuery emitted |
| 2 | PLAN_REVIEW blocks | Blocking behavior | Execution paused until user responds |
| 3 | PLAN_REVIEW auto-approves | Timeout | After 120s → auto-approve, execution continues |
| 4 | FIRST_OUTPUT fires | First visible output | First worker:complete → UserQuery emitted |
| 5 | PRE_DEPLOY fires | Deploy gate | Before deploy:start → UserQuery emitted |
| 6 | PRE_DEPLOY no timeout | Safety | timeout === null, user MUST confirm |
| 7 | PROGRESS_CHECK fires | Every 5 steps | 5th completed step → UserQuery emitted |
| 8 | PROGRESS_CHECK non-blocking | Continues | Agents continue while waiting for user |
| 9 | "Change something" pauses | User feedback | Modify response → execution paused |
| 10 | Response routes to agent | PA routing | Query response includes stepId for correct agent |

### Phase 6: Fuel Gauge (6 tests)

| # | Test Name | Acceptance Criterion | Pass Condition |
|---|-----------|---------------------|----------------|
| 1 | Initial state 0/N | Empty progress | Shows "0 / 5 steps" (or whatever total) |
| 2 | Updates on completion | Step tracking | "2 / 5 steps" after 2 done |
| 3 | Time elapsed | Clock | Counts up from build start |
| 4 | Estimated remaining | Prediction | Decreases as steps complete |
| 5 | Progress bar fills | Visual | Bar width = (completed / total) * 100% |
| 6 | Zero steps edge case | Empty plan | Shows "No steps planned" without crashing |

---

## Summary

| Phase | Test File | Test Count | Total |
|-------|-----------|------------|-------|
| 1 | `tests/event-bus.test.ts` | 8 | 8 |
| 2 | `tests/translator.test.ts` | 15 | 23 |
| 3 | `tests/ipc-status.test.ts` | 10 | 33 |
| 4 | `tests/status-tree.test.ts` | 12 | 45 |
| 5 | `tests/checkpoint.test.ts` | 10 | 55 |
| 6 | `tests/fuel-gauge.test.ts` | 6 | 61 |

**New tests**: 61
**Existing tests**: 480+
**Total after integration**: 540+

---

## Done Criteria (Binary)

```
npx tsc --noEmit                          → 0 errors
npx ts-node tests/event-bus.test.ts       → 8/8 pass
npx ts-node tests/translator.test.ts      → 15/15 pass
npx ts-node tests/ipc-status.test.ts      → 10/10 pass
npx ts-node tests/status-tree.test.ts     → 12/12 pass
npx ts-node tests/checkpoint.test.ts      → 10/10 pass
npx ts-node tests/fuel-gauge.test.ts      → 6/6 pass
ALL EXISTING tests still pass             → 480+/480+ pass
Send build message → real status lines appear in tree
Every status line ≤ 8 words, zero banned words
Checkpoints render before execution
Stop button kills processes
Fuel gauge shows accurate progress
```
