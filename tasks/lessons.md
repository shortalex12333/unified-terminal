# Unified Terminal — Lessons Learned

## LESSON: Agent-Based Over Keyword Matching

**Date:** 2026-03-04
**Context:** Building skill selector for the enforcement pipeline
**Failure:** Initial implementation used keyword matching only — spec required agent-based semantic selection
**Root Cause:** Took the simpler path without checking the spec. "Code pretending to understand task semantics" (user's words)
**Guard Added:** Always check spec before implementing. If spec says agent-based, it means LLM-powered, not regex/keyword
**Reusable Pattern:** PRIMARY path should be the spec'd approach; FALLBACK should be the simpler approach. Never make the fallback the only path.
**Tags:** architecture, skills, enforcement, spec-compliance

---

## LESSON: Timeout Budget Must Track Across Batches

**Date:** 2026-03-04
**Context:** Bodyguard runs enforcement checks in parallel batches
**Failure:** Each batch got the full timeout budget instead of the remaining budget. Later batches could starve.
**Root Cause:** `TOTAL_GATE_TIMEOUT_MS / batch.length` recalculated fresh each iteration instead of tracking elapsed time
**Guard Added:** Track `elapsedMs` across loop iterations. Calculate `remainingMs = TOTAL - elapsed`. Add Math.max(1000, ...) floor.
**Reusable Pattern:** Any batched operation with a total time budget must track remaining budget, not reset per-batch.
**Tags:** enforcement, bodyguard, timeout, resource-management

---

## LESSON: Type Property Names Must Match Real Interface

**Date:** 2026-03-04
**Context:** Wiring step-scheduler to use validated skill output
**Failure:** Used `validated.accepted` instead of `validated.skills` — property didn't exist
**Root Cause:** Guessed at property name instead of reading the ValidationResult interface
**Guard Added:** Always read the actual type definition before using its properties. Don't guess from naming conventions.
**Reusable Pattern:** When bridging between modules, read both sides' type definitions first.
**Tags:** typescript, types, integration, step-scheduler

---

## LESSON: Async Functions Need Await

**Date:** 2026-03-04
**Context:** Calling selectSkills() and executeVerifyCommand() in step-scheduler
**Failure:** 5 TypeScript errors from missing await on async calls
**Root Cause:** Functions looked synchronous from their names but returned Promises
**Guard Added:** Check return type before calling. If it's Promise<T>, await it.
**Reusable Pattern:** When integrating new modules, compile after EACH import+usage, not after wiring everything.
**Tags:** typescript, async, integration

---

## LESSON: "Native Runtime" Is Deployment-Context-Dependent

**Date:** 2026-03-04
**Context:** Documented Claude Code as "native — no adapter needed"
**Failure:** True when Claude Code IS the orchestrator (current dev environment). False when Electron app spawns Claude Code as a child process for user's project.
**Root Cause:** Confused development-time truth with runtime truth. The Electron app is NOT Claude Code — it spawns Claude Code.
**Guard Added:** Always ask: "Is this true at DEVELOPMENT time or DEPLOYMENT time?" If they differ, the deployment truth wins.
**Reusable Pattern:** Adapter/translator decisions must be made from the deployment architecture, not the development environment.
**Tags:** architecture, adapters, claude-code, deployment
