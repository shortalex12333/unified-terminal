 These new docs don’t add “more reasons.” They **compress the whole problem into first principles**: the model will *always* fail in predictable ways unless you add **external compensations**. That’s the headline. 

Below is the holistic view: probabilities (as a normalized risk model), patterns, opportunities, threats, strengths, weaknesses — now grounded in the “limitations → minimal intervention” framework you uploaded.

---

## 1) Holistic model: the 3 terminal causes

Your “first principles” doc nails this: every failure traces back to one of three terminal causes, and **the fix is always external** (tools / rails / gates), not “better prompting.” 

### Terminal causes

1. **Mathematical constraints** (attention, causal masking): can’t look ahead, can’t attend to absence. 
2. **Architectural constraints** (single forward pass): no built-in “reconsider,” fixed compute per token. 
3. **Training constraints** (next-token + RLHF): optimizes for plausibility and visible progress, not truth. 

Long-context failure research backs the same reality: models show positional/recency bias and degrade when relevant info is buried in long context. ([MIT Press Direct][1])

---

## 2) The failure taxonomy (what “they fuck up” collapses into)

From your limitations doc’s “Key Takeaways” (which are basically the governing laws): 

### A) **Absence blindness**

If something isn’t in context or isn’t turned into an explicit checkbox, it may as well not exist. 
**Consequence:** they skip the right doc, baseline, harness, or spec.

### B) **Local coherence trap**

They can make every step sound reasonable while the overall trajectory is wrong. 
**Consequence:** hours spent improving the wrong thing (your harness incident). 

### C) **Tool-selection as pattern matching**

Tools available ≠ tools used correctly. 
**Consequence:** picks a similarly-named tool that produces *some* result, then becomes locked in.

### D) **Action bias**

Reading looks like stalling; doing looks like progress. That bias is reinforced by the training incentives you describe. 

### E) **Overconfidence without calibration**

Confidence is linguistic, not probabilistic. 
**Consequence:** strong tone + wrong path = user trust death.

---

## 3) Normalized risk model (probability-weighted)

These are **risk contribution weights** (likelihood × damage) for real-world agent products. Not “scientific truth,” but a useful operating model.

| Failure mode                           | Normalized risk weight | Why it matters                                                          |
| -------------------------------------- | ---------------------: | ----------------------------------------------------------------------- |
| Wrong tool / wrong harness lock-in     |                   0.22 | Produces “progress” while moving away from goal                         |
| No baseline / anomaly blindness        |                   0.18 | Fails to detect “this number is impossible” (22% vs 95%)                |
| Absence blindness (didn’t read X)      |                   0.16 | Nothing forces missing info to become present                           |
| Local coherence trap (no global check) |                   0.14 | “Locally valid, globally wrong”                                         |
| Action bias (“looks busy”)             |                   0.12 | Over-optimizes visible motion over correctness                          |
| Context/positional bias in long runs   |                   0.10 | Long context degrades; mid-context details lost ([MIT Press Direct][1]) |
| No self-monitoring / loop behavior     |                   0.08 | Needs an external watchdog                                              |

**What changes with Kenoki:** your architecture isn’t trying to “fix the model.” It’s trying to **eliminate** these modes with enforcement.

---

## 4) The compounding math (why agents fail at scale)

This is the part most people miss.

If the probability of “major drift” per meaningful step is even modest, multi-step workflows almost guarantee at least one failure.

Example (illustrative):

* per-step “serious deviation” probability = 0.15
* 10 steps → P(at least one deviation) = 1 − (0.85¹⁰) ≈ 0.80

That’s why demos work (1–2 steps) and real builds rot (8–15 steps).

This connects directly to the long-context research problem: when context grows, models overweight beginning/end, and miss middle details — another reason mid-run drift becomes common. ([MIT Press Direct][1])

---

## 5) The “minimal guardrail system” (opportunity map)

Your first principles doc gives you the exact **minimum interventions** that pay off fastest.

If you ship only four hard rails, ship these (your doc says it explicitly): baseline registry, read-before-act, mandatory stops, tool matcher. 

### Opportunity framing (turn these into product features)

* **Baseline registry → “Sanity Check” feature**
  “This result looks off. We’re pausing before we waste time.” 
* **Read-before-act → “We check the spec first”**
  Not shown to user, but prevents hallucinated trajectories. 
* **Mandatory stops → “Quick alignment check”**
  Prevents sunk-cost lock in. 
* **Tool matcher → “Right tool, right job”**
  Stops the “wrong harness” catastrophe. 

**This is your moat:** most competitors try to improve generation; you improve *trajectory correctness*.

---

## 6) Context economics: why your /skills approach matters

Your “Skill vs Prompt Injection” doc formalizes the economics:

* Prompt injection costs tokens every turn; skills load on demand. 
* The doc shows token savings of ~86–88% in a 100 turn scenario by keeping the always-on prompt lean and loading expertise only when triggered. 

This isn’t just cost. It’s reliability:

* lean context → less attention dilution
* less dilution → fewer missed constraints
* fewer missed constraints → less drift

So “skills architecture” is a reliability feature, not a prompt convenience. 

---

## 7) Threats (real ones, not theoretical)

These are the threats that can still punch you in the mouth even if your rails are perfect:

1. **Provider UI/DOM drift** (wrapping web sessions breaks unexpectedly)
2. **Policy / ToS** risk as you scale automation over browser sessions
3. **Local model quality gap**: users blame Kenoki for “worse results,” even if it’s a fallback
4. **Context switching side effects**: switching providers mid-plan can change style/behavior; you need a strong “constitution” layer to keep invariants stable 
5. **Telemetry trust**: if you ever sell “patterns,” you need a crisp opt-in story or you’ll get punished on trust, even if anonymized.

---

## 8) Strengths vs Weaknesses (Kenoki-specific)

### Strengths

* Clear positioning: wrapper + orchestration for non-technical users using existing subscriptions 
* Correct direction: “external compensations,” not “hope the LLM behaves” 
* Token / context strategy is principled (skills vs prompt) 

### Weaknesses

* More moving parts = more operational fragility (especially web providers)
* Hard rails can increase latency (you must keep them invisible + framed as confidence)
* You’ll need ruthless prioritization: shipping guardrails that matter vs “nice architecture”

---

## 9) The clean “pattern detector” list (what to watch)

If you want a monitoring checklist, your limitations doc already gives the right questions to force every N turns. 
Turn those into automated triggers:

* **Metric anomaly** (baseline registry trips)
* **Repeated same action** (loop) 
* **Tool mismatch** (tool matcher rejects) 
* **No reference to authoritative doc when expected** (presence checklist) 
* **User expresses confusion** → force reframe 

---

If you want, I can convert all of this into a single “Kenoki Reliability Scorecard” (a rubric) where each build gets scored on:

* baseline checks hit/missed
* tool selection correctness
* number of forced stops
* number of loops detected
* proof artifacts produced

That becomes your internal north star for “agents are behaving” — and it maps directly to the failure laws you’ve collected.

