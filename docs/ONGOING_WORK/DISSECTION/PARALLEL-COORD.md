# PARALLEL COORDINATION: 5 Instances, Phased

## The Insight

Adapters and dissection are DIFFERENT concerns that happen to run in parallel. Adapters prove we can control runtimes. Dissection produces the content that runs through those runtimes. Neither needs the other to start. Both need to finish before enforcement makes sense.

Hard rails and topology depend on BOTH adapters and dissection being done. They are later work.

```
TIME -->

INSTANCE 1 (Gateway)     ████████████████████████████████████████████
  Already running. Electron, BrowserView, intake UI.

INSTANCE 2 (Adapters)     ██████████████████░░░░░░░░░░░░░░░░░░░░░░░
  Days 1-5. Prove runtime control works.

INSTANCE 3 (Dissection)   ██████████████████░░░░░░░░░░░░░░░░░░░░░░░
  Days 1-4. Extract, rewrite, organize prompt library.

                                    |
                          CHECKPOINT: Day 5
                          types.ts from I2 -> I1
                          ENFORCER.json from I3 -> I4
                          skills/ from I3 -> I2 for testing
                                    |
                                    v

INSTANCE 4 (Hard Rails)   ░░░░░░░░░░░░░░░░░░████████████████░░░░░░░
  Days 6-10. Spine, Bodyguard, Enforcers, 11 check scripts.

INSTANCE 5 (Topology)     ░░░░░░░░░░░░░░░░░░░░░░████████████████████
  Days 8-12. Step scheduler, cron, warden, agent lifecycle.

                                              |
                                    CHECKPOINT: Day 12
                                    Full integration test.
                                    Mock DAG through all layers.
```

---

## Instance Summary

### Instance 1: GATEWAY (Already Running)
**What:** Electron app, ChatGPT BrowserView, intake UI, fast-path.
**Produces:** The shell users interact with.
**Receives from others:**
- Day 5: `types.ts` (shared contract) from Instance 2
- Day 7: Adapter files from Instance 2 (drop into `src/main/adapters/`)
- Day 10: Enforcement module from Instance 4 (Bodyguard)
- Day 12: Step scheduler from Instance 5

### Instance 2: ADAPTERS (Plugin-Driven)
**What:** 4 runtime adapters (Codex, Claude, Gemini, ChatGPT Web) + shared types + tests. Every adapter feature traces to a specific absorbed plugin requirement (e.g., code-reviewer needs read-only enforcement, frontend-builder needs 3000+ token payload, image-gen needs binary extraction from DOM).
**Produces:** ~950 lines TS, ~600 lines tests, 4 capability JSONs, 1 plugin-adapter-map.json (traceability).
**Receives from others:**
- Day 1: Instance 3 audit output (lightweight plugin requirements manifest — tool permissions, input format, output expectations per prompt)
- Day 4: `skills/` directory from Instance 3 (swap toy test prompts for real plugin content)
**Sends to others:**
- Day 2: `types.ts` to Instance 1 (early, so they can code against the interface)
- Day 5: All adapter files + plugin-adapter-map.json to Instance 1
- Day 5: `AgentResult` format + adapter logs schema to Instance 4 (Bodyguard parses these)

### Instance 3: DISSECTION (Prompt Library)
**What:** Read 6 repos, extract ~22 prompts, rewrite in our format, organize skill library.
**Produces:** 22 prompt .md files, ENFORCER.json, trigger-map.json, CSV data, BM25 script.
**Receives from others:** Nothing. Works independently from source repos.
**Sends to others:**
- Day 4: `skills/` directory to Instance 2 (test prompts through adapters)
- Day 4: `ENFORCER.json` to Instance 4 (defines what to enforce)
- Day 4: `trigger-map.json` to Instance 5 (Skill Injector needs this)

### Instance 4: HARD RAILS (Enforcement Engine) -- LATER
**What:** Spine, Bodyguard dispatcher, 11 Python check scripts, circuit breaker.
**Produces:** ~650 lines code. The enforcement ceiling.
**Receives from others:**
- Day 5: `ENFORCER.json` from Instance 3 (what to check)
- Day 5: `AgentResult` interface from Instance 2 (what Bodyguard receives)
**Sends to others:**
- Day 10: Bodyguard module to Instance 1 (gate between steps)
- Day 10: Spine module to Instance 5 (scheduler refreshes Spine)

### Instance 5: TOPOLOGY (Agent Lifecycle) -- LATER
**What:** Step scheduler, cron layer, Context Warden, agent state machine.
**Produces:** ~500 lines code. The orchestration engine.
**Receives from others:**
- Day 8: Adapters from Instance 2 (scheduler spawns via adapters)
- Day 8: Bodyguard from Instance 4 (scheduler runs checks between steps)
- Day 4: `trigger-map.json` from Instance 3 (Skill Injector)
**Sends to others:**
- Day 12: Full step scheduler to Instance 1 (the engine that drives everything)

---

## Checkpoints (Hard Gates)

### Checkpoint 1: Day 2
**Gate:** `types.ts` compiles. AgentConfig, AgentResult, RuntimeAdapter, AgentHandle all exported.
**Who blocks:** Instance 1 cannot integrate adapters without this.
**Action:** Instance 2 sends `types.ts` to Instance 1 repo.

### Checkpoint 2: Day 4
**Gate:** Instance 3 audit complete. All 6 repos inventoried. Extract list finalized (may differ from original 22).
**Who blocks:** Nobody yet, but this is the quality gate. If audits reveal important files we missed, the extract list changes before Instance 3 spends 2 days rewriting.
**Action:** Review audits. Update extract list if needed. Proceed.

### Checkpoint 3: Day 5
**Gate:** At least 2 adapters pass integration test. At least 15 skill files rewritten and verified.
**Who blocks:** Instance 4 needs ENFORCER.json. Instance 2 needs skills to test with.
**Action:**
- Instance 3 sends `skills/` to Instance 2 for real-prompt testing
- Instance 3 sends `ENFORCER.json` to Instance 4 (can start now)
- Instance 2 sends adapter files to Instance 1

### Checkpoint 4: Day 8
**Gate:** Instance 4 has Spine + Bodyguard + 6 core checks working. Instance 2 adapters integrated into Instance 1.
**Who blocks:** Instance 5 (Topology) needs adapters + bodyguard to build step scheduler.
**Action:** Instance 5 begins. Has everything it needs.

### Checkpoint 5: Day 12
**Gate:** Integration test. Mock DAG:
1. Conductor produces 3-step plan (Tier 2 medium task)
2. Step scheduler picks up plan
3. Per step: Spine refresh > Skill Inject > Adapter spawn > Bodyguard check > PA compare
4. All 3 steps complete. Deployed result accessible.
**Who blocks:** This is ship-readiness for the orchestration layer.
**Action:** If passes, wire into Instance 1 gateway.

---

## Dependency Graph

```
Instance 2 (Adapters) ----types.ts----> Instance 1 (Gateway)
                     \
                      +--AgentResult--> Instance 4 (Hard Rails)
                      |
Instance 3 (Dissect) --ENFORCER.json-> Instance 4 (Hard Rails)
                     \
                      +--skills/------> Instance 2 (testing)
                      +--trigger-map--> Instance 5 (Topology)

Instance 4 (Rails) ---Bodyguard------> Instance 5 (Topology)
                    \
                     +--Bodyguard-----> Instance 1 (Gateway)

Instance 5 (Topo) ---scheduler-------> Instance 1 (Gateway)
```

**No cycles.** Instance 2 and 3 run fully parallel with zero dependencies on each other until Day 4 (skills for testing). Instance 4 starts Day 5. Instance 5 starts Day 8. Instance 1 receives pieces continuously.

---

## What If Something Slips

| Slip | Impact | Mitigation |
|------|--------|-----------|
| Adapters take 7 days not 5 | Instance 4 still starts on Day 5 (has ENFORCER.json). Instance 5 starts late. | Prioritize Codex adapter (most important). Ship with 2 adapters, add others later. |
| Dissection finds 30 files not 22 | Takes 5-6 days not 4 | Only rewrite the top 22. Remaining go on watchlist with originals preserved. |
| A source repo has changed significantly | Prompts we expected are gone or restructured | Audit catches this Day 1. Adjust extract list. Find alternatives or write from scratch. |
| Hard rails integration fails | Bodyguard checks don't match ENFORCER.json format | ENFORCER.json schema is locked. Instance 3 writes to schema. Instance 4 reads from schema. If mismatch, fix the writer (Instance 3). |
| Topology is more complex than estimated | Step scheduler needs more than 500 lines | Start with Tier 1 (simple: 1 worker + bodyguard). Add tiers incrementally. Tier 3 is last. |

---

## Communication Protocol

Each instance writes a daily STATUS.md:
```markdown
## Instance [N] Status: Day [X]

### Completed
- [specific deliverable] -- [file path] -- [PASS/FAIL]

### In Progress
- [what is being worked on] -- [expected completion]

### Blocked
- [what is blocking] -- [which instance needs to unblock]

### Discovered
- [unexpected findings that affect other instances]
```

**Instances do NOT talk to each other directly.** They communicate through:
1. STATUS.md files (daily)
2. Shared file deliverables (at checkpoints)
3. This coordination document (the source of truth for who owns what)

If an instance discovers something that changes another instance's scope (e.g., Instance 3 finds a critical prompt not on the list), they note it in STATUS.md under "Discovered." The human reviews and decides whether to update scope.
