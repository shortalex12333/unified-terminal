# LLM Agentic Workflow Limitations: A Deep Analysis

> **Purpose:** This document catalogs fundamental LLM limitations that cause failures in agentic workflows. Each limitation includes root cause analysis drilling down to "why" until no deeper explanation exists.
>
> **Origin:** Derived from a real incident where an LLM spent hours debugging the wrong test harness while the correct production pipeline (with 89.2% recall) existed and was documented. The LLM had access to plugins, documentation, and tools—but didn't use them correctly.

---

## Table of Contents

1. [The Incident That Sparked This Document](#the-incident)
2. [Architectural Limitations](#architectural-limitations)
3. [Training-Induced Limitations](#training-induced-limitations)
4. [Context & Memory Limitations](#context--memory-limitations)
5. [Reasoning Limitations](#reasoning-limitations)
6. [Tool & Plugin Usage Failures](#tool--plugin-usage-failures)
7. [Metacognitive Gaps](#metacognitive-gaps)
8. [Agentic Workflow Failure Patterns](#agentic-workflow-failure-patterns)
9. [Mitigation Strategies](#mitigation-strategies)
10. [Template: Diagnosing Agentic Failures](#template-diagnosing-agentic-failures)

---

## The Incident

### What Happened

An LLM was tasked with investigating search recall metrics. The system had:

| Component | Status |
|-----------|--------|
| Production harness (`ranking_truth_harness.py`) | ✅ Available, 89.2% recall |
| Production plugins (`action_surfacing.py`, `domain_microactions.py`) | ✅ Available, working |
| Architecture documentation (`F1_SEARCH_ENGINE_ARCHITECTURE.md`) | ✅ Available, documented 95.99% recall |
| Wrong harness (`v12_recall_harness.py`) | ❌ Used instead, showed 22% recall |
| Mock embeddings | ❌ Used instead of real OpenAI embeddings |

**Result:** Hours spent "improving" 22% recall when the real system was at 89.2%. The LLM had everything it needed but used the wrong tools.

### The Core Questions

1. Why didn't the LLM read the architecture doc first?
2. Why didn't the LLM use the production plugins?
3. Why didn't the LLM question 22% vs documented 95.99%?
4. Why did the LLM continue down the wrong path for hours?

This document answers these questions at the deepest level possible.

---

## Architectural Limitations

### 1. Autoregressive Prediction: Forward-Only Processing

**What it is:**
LLMs predict `P(next_token | all_previous_tokens)`. Processing is strictly left-to-right, forward-only.

**Why this causes failures:**

```
Level 1: Can't look ahead to consequences
  ↓ Why?
Level 2: Architecture only conditions on past tokens
  ↓ Why?
Level 3: Transformer attention is causal-masked for generation
  ↓ Why?
Level 4: Training requires predicting next token, not future sequences
  ↓ Why?
Level 5: Backpropagation needs a single prediction target per step
  ↓ Why?
Level 6: This is how gradient descent works on sequential data
  ↓ [TERMINAL] Mathematical constraint of optimization
```

**Manifestation in agentic workflows:**
- Cannot evaluate "if I take this action, will it lead to goal?"
- Each step optimizes locally, not globally
- No lookahead planning without explicit chain-of-thought

**The incident:** Kept "improving" the wrong harness because each step (fix embeddings → recall goes up) looked locally correct. No evaluation of "am I on the right path overall?"

---

### 2. Attention Mechanism: Cannot Attend to Absence

**What it is:**
Attention computes relevance scores between tokens that **exist** in context.

```python
attention_weights = softmax(Q @ K.T / sqrt(d_k))
# Q, K are embeddings of EXISTING tokens
```

**Why this causes failures:**

```
Level 1: Can't notice missing information
  ↓ Why?
Level 2: Attention only fires on present keys
  ↓ Why?
Level 3: Keys are embeddings of tokens in context
  ↓ Why?
Level 4: You can't embed something that isn't there
  ↓ Why?
Level 5: Embeddings require input tokens to encode
  ↓ [TERMINAL] Mathematical impossibility—no input, no embedding
```

**Manifestation in agentic workflows:**
- Won't notice "I should have read file X but didn't"
- Won't notice "the user mentioned Y but I ignored it"
- Missing context has no signal

**The incident:** User said "read F1_SEARCH_ENGINE_ARCHITECTURE.md". The LLM acknowledged but didn't prioritize it. The absence of that document's content from active reasoning had no attention signal.

---

### 3. Single Forward Pass: No Iterative Refinement

**What it is:**
Standard inference is one forward pass through the network. No internal loops, no reconsidering.

**Why this causes failures:**

```
Level 1: Can't "think again" about a conclusion
  ↓ Why?
Level 2: Each token is committed once generated
  ↓ Why?
Level 3: Autoregressive generation is append-only
  ↓ Why?
Level 4: Revising would require regenerating from revision point
  ↓ Why?
Level 5: No architecture for "internal debate" or reconsideration
  ↓ [TERMINAL] Current architectures lack recurrent refinement loops
```

**Manifestation in agentic workflows:**
- First interpretation of a problem becomes the interpretation
- Wrong initial framing persists
- No "wait, let me reconsider" mechanism

**The incident:** First saw "v12_recall_harness.py" in session summary. That framing ("this is the harness to use") was never reconsidered.

---

### 4. Fixed Computation Budget Per Token

**What it is:**
Each token gets the same number of layers, same computation. Simple tokens and complex decisions get equal processing.

**Why this causes failures:**

```
Level 1: Can't "think harder" about important decisions
  ↓ Why?
Level 2: Computation is fixed by architecture depth
  ↓ Why?
Level 3: All tokens traverse same layer count
  ↓ Why?
Level 4: Dynamic computation would require different architecture
  ↓ Why?
Level 5: Transformers are static-depth by design
  ↓ [TERMINAL] Architectural choice—alternatives exist but aren't standard
```

**Manifestation in agentic workflows:**
- Deciding "which tool to use" gets same compute as generating filler text
- Critical path decisions aren't recognized as needing more thought
- No adaptive depth based on importance

**The incident:** Choosing which harness to use was a critical decision. It got the same computational depth as generating a status message.

---

## Training-Induced Limitations

### 5. Next-Token Prediction ≠ Correctness

**What it is:**
Training objective is cross-entropy loss on predicting the next token. This optimizes for **plausibility**, not **truth**.

```python
loss = -log P(actual_next_token | context)
# Minimized when model predicts likely tokens
# NOT when model predicts correct/useful tokens
```

**Why this causes failures:**

```
Level 1: Fluent nonsense has low loss
  ↓ Why?
Level 2: Loss only measures likelihood, not correctness
  ↓ Why?
Level 3: Training data contains likely sequences, not labeled truths
  ↓ Why?
Level 4: Supervised pretraining has no "correctness" signal
  ↓ Why?
Level 5: Labeling correctness at scale is intractable
  ↓ [TERMINAL] Fundamental data labeling constraint
```

**Manifestation in agentic workflows:**
- Generates plausible-sounding explanations that are wrong
- Confident incorrect statements have low perplexity
- "Sounds right" ≠ "is right"

**The incident:** Generated coherent explanations for why embeddings were the problem. Explanations were fluent and plausible. They were also wrong.

---

### 6. RLHF Optimizes for Appearance of Helpfulness

**What it is:**
Reinforcement Learning from Human Feedback trains models based on human preference rankings. Humans prefer responses that **look** helpful.

**Why this causes failures:**

```
Level 1: Action bias—doing looks more helpful than thinking
  ↓ Why?
Level 2: Human raters reward visible progress
  ↓ Why?
Level 3: Reading/thinking looks like stalling to raters
  ↓ Why?
Level 4: Raters see output, not reasoning quality
  ↓ Why?
Level 5: RLHF signal is based on surface-level judgment
  ↓ Why?
Level 6: Deep evaluation would require domain expertise per task
  ↓ [TERMINAL] Practical constraint of RLHF data collection
```

**Manifestation in agentic workflows:**
- Bias toward running commands over reading documentation
- Bias toward showing output over verifying approach
- "Looking busy" is rewarded over "being correct"

**The incident:** Running `v12_recall_harness.py` and showing results looked productive. Reading `F1_SEARCH_ENGINE_ARCHITECTURE.md` for two turns would have looked like stalling. RLHF biased toward the former.

---

### 7. Trained to Be Confident, Not Calibrated

**What it is:**
RLHF penalizes uncertainty and hedging. "I think..." and "I'm not sure..." receive lower preference scores.

**Why this causes failures:**

```
Level 1: Doesn't express uncertainty when uncertain
  ↓ Why?
Level 2: Uncertainty trained out by RLHF
  ↓ Why?
Level 3: Human raters prefer confident responses
  ↓ Why?
Level 4: Uncertainty looks incompetent
  ↓ Why?
Level 5: Cultural bias—confidence signals expertise
  ↓ [TERMINAL] Human cognitive bias in preference data
```

**Manifestation in agentic workflows:**
- Proceeds confidently down wrong paths
- Doesn't flag "I might be wrong about this"
- No uncertainty threshold that triggers verification

**The incident:** Confidently stated embeddings were the problem. Confidently "fixed" them. Never expressed "I'm not sure this is the right harness."

---

### 8. No Training Signal for "Stop and Reconsider"

**What it is:**
Training data and RLHF don't include examples of productive stopping. Completion is always rewarded over pausing.

**Why this causes failures:**

```
Level 1: No learned behavior for "I should stop and think"
  ↓ Why?
Level 2: Training data is complete conversations/documents
  ↓ Why?
Level 3: No training examples of "stopping mid-task to reconsider"
  ↓ Why?
Level 4: Such examples would need explicit curation
  ↓ Why?
Level 5: It's not natural in human-generated text
  ↓ [TERMINAL] Training data reflects human writing patterns, which don't include explicit "pause" decisions
```

**Manifestation in agentic workflows:**
- Continues executing even when approach is clearly failing
- No natural breakpoint for "let me verify my assumptions"
- Completion bias overrides correctness

**The incident:** After 5+ turns of debugging, no internal trigger said "stop—verify you're using the right harness."

---

## Context & Memory Limitations

### 9. Context Window = Entire Reality

**What it is:**
LLMs have no persistent memory. The context window is the complete universe of available information.

**Why this causes failures:**

```
Level 1: Anything not in context doesn't exist
  ↓ Why?
Level 2: No retrieval from long-term memory
  ↓ Why?
Level 3: Architecture has no persistent memory component
  ↓ Why?
Level 4: Transformers are designed as stateless functions
  ↓ Why?
Level 5: Statefulness would require different training paradigm
  ↓ [TERMINAL] Architectural design choice
```

**Manifestation in agentic workflows:**
- No memory of "last time I made this mistake"
- No memory of "in this codebase, always check X first"
- Each session starts from zero

**The incident:** No memory of previous sessions where similar harness confusion occurred. No learned rule like "always verify against production baseline first."

---

### 10. Context Recency Bias

**What it is:**
Recent context has more influence than earlier context, even when earlier context is more important.

**Why this causes failures:**

```
Level 1: Recent instructions override earlier authoritative sources
  ↓ Why?
Level 2: Attention weights decay with distance (in practice)
  ↓ Why?
Level 3: Training sequences are typically short-to-medium length
  ↓ Why?
Level 4: Long-range dependencies are harder to learn
  ↓ Why?
Level 5: Gradient signal weakens over long sequences during training
  ↓ [TERMINAL] Vanishing gradient problem in sequence modeling
```

**Manifestation in agentic workflows:**
- Session summary (recent) overrides architecture doc (mentioned earlier)
- Last message dominates response direction
- Earlier context fades even if more important

**The incident:** Session summary said "fix embeddings." User's mention of architecture doc was earlier and faded. Recent context dominated.

---

### 11. Summarization Loses Critical Details

**What it is:**
Long conversations are summarized to fit context windows. Summarization loses nuance and specific details.

**Why this causes failures:**

```
Level 1: Important details get compressed away
  ↓ Why?
Level 2: Summarization optimizes for general meaning, not specifics
  ↓ Why?
Level 3: No way to know what will be important later
  ↓ Why?
Level 4: Importance is task-dependent and emerges over time
  ↓ Why?
Level 5: Summarization happens before future context is known
  ↓ [TERMINAL] Temporal causality—can't know future needs
```

**Manifestation in agentic workflows:**
- Critical file paths get lost in summarization
- Specific user instructions get generalized away
- "Why was I doing this again?" after long sessions

**The incident:** Session summary mentioned "v12_recall_harness.py" but likely lost context about it being a simplified harness vs. production.

---

## Reasoning Limitations

### 12. No Global Coherence Verification

**What it is:**
LLMs check local coherence (does this token fit here?) but not global coherence (does this entire approach make sense?).

**Why this causes failures:**

```
Level 1: Can have locally coherent but globally nonsensical plans
  ↓ Why?
Level 2: No mechanism evaluates the entire approach
  ↓ Why?
Level 3: Generation is token-by-token, not plan-then-execute
  ↓ Why?
Level 4: Architecture doesn't separate planning from execution
  ↓ Why?
Level 5: Single-model design without specialized components
  ↓ [TERMINAL] Architectural choice—multi-component systems exist but aren't standard
```

**Manifestation in agentic workflows:**
- Each step follows from previous step, but overall trajectory is wrong
- No checkpoint asking "does this whole plan make sense?"
- Locally valid ≠ globally valid

**The incident:** Each step made sense:
1. Harness shows 22% recall → investigate
2. Embeddings are mock → fix embeddings
3. Recall improves to 22% → progress!

Each step locally valid. Global trajectory: completely wrong harness.

---

### 13. No Comparative Baseline Reasoning

**What it is:**
LLMs process absolute values, not relative comparisons to expected baselines.

**Why this causes failures:**

```
Level 1: "22% recall" is processed as a number, not compared to expectations
  ↓ Why?
Level 2: Expectations aren't automatically retrieved
  ↓ Why?
Level 3: No mechanism links "recall metric" to "expected recall"
  ↓ Why?
Level 4: Would require structured knowledge retrieval
  ↓ Why?
Level 5: LLMs have implicit knowledge, not queryable databases
  ↓ [TERMINAL] Knowledge is distributed in weights, not structured for lookup
```

**Manifestation in agentic workflows:**
- Accepts implausible values without skepticism
- Doesn't flag "this is way off from expected"
- No alarm bells for anomalous results

**The incident:** 22% vs documented 95.99% should have been a massive red flag. But 22% was processed as "a number to improve" not "an anomaly to explain."

---

### 14. Pattern Matching Without Causal Understanding

**What it is:**
LLMs match patterns from training data. They don't build causal models of why things work.

**Why this causes failures:**

```
Level 1: Correlational reasoning fails in novel situations
  ↓ Why?
Level 2: No causal model to generalize from
  ↓ Why?
Level 3: Training is pattern matching, not causal learning
  ↓ Why?
Level 4: Causal structure isn't labeled in training data
  ↓ Why?
Level 5: Extracting causation from text is unsolved
  ↓ [TERMINAL] Open research problem in AI
```

**Manifestation in agentic workflows:**
- Applies patterns that look similar but have different causal structure
- Fixes symptoms rather than root causes
- "This worked before" without understanding why

**The incident:** Pattern: "low recall → check embeddings → fix embeddings." Applied this pattern without understanding causal structure: "low recall might mean wrong harness, not bad embeddings."

---

## Tool & Plugin Usage Failures

### 15. Tools Available ≠ Tools Used

**What it is:**
Having access to tools doesn't mean the LLM will use them appropriately. Tool selection is another prediction problem subject to all the above limitations.

**Why this causes failures:**

```
Level 1: Doesn't select optimal tool for the task
  ↓ Why?
Level 2: Tool selection is next-token prediction
  ↓ Why?
Level 3: Predicts "likely tool given context" not "correct tool given goal"
  ↓ Why?
Level 4: No explicit tool evaluation mechanism
  ↓ Why?
Level 5: Tools are just tokens to predict, not resources to reason about
  ↓ [TERMINAL] Tool use is bolted onto language modeling, not native
```

**Manifestation in agentic workflows:**
- Has access to production plugins but uses mock implementations
- Has access to documentation but reads code instead
- Has search tools but greps manually

**The incident:** Had access to:
- `action_surfacing.py` (production plugin) → didn't use
- `domain_microactions.py` (production plugin) → didn't use
- `generate_query_embedding()` (real-time OpenAI) → used cached mock instead
- `F1_SEARCH_ENGINE_ARCHITECTURE.md` (authoritative doc) → didn't read

All tools available. Wrong tools used.

---

### 16. No Tool Capability Reasoning

**What it is:**
LLMs don't reason about what tools can and cannot do. They pattern-match tool names to tasks.

**Why this causes failures:**

```
Level 1: Uses tool based on name, not capabilities
  ↓ Why?
Level 2: No model of tool functionality
  ↓ Why?
Level 3: Tools are learned from usage examples, not specifications
  ↓ Why?
Level 4: Training shows tool invocations, not tool capabilities
  ↓ Why?
Level 5: Capability modeling would require structured representations
  ↓ [TERMINAL] Current training paradigm doesn't build capability models
```

**Manifestation in agentic workflows:**
- Uses "recall_harness" because name matches, not because it's the right one
- Doesn't distinguish mock vs. production implementations
- Name similarity overrides functional suitability

**The incident:** `v12_recall_harness.py` has "recall" and "harness" in name. Pattern matched to task "evaluate recall." Didn't evaluate whether it was the *right* recall harness.

---

### 17. Plugin Instructions Not Internalized

**What it is:**
Even when plugins provide usage instructions, LLMs may not follow them correctly under cognitive load.

**Why this causes failures:**

```
Level 1: Instructions in context compete with task context
  ↓ Why?
Level 2: Attention is divided across all context
  ↓ Why?
Level 3: Long contexts dilute attention to any single element
  ↓ Why?
Level 4: Attention is a limited resource
  ↓ Why?
Level 5: Softmax normalization means more context = less attention per item
  ↓ [TERMINAL] Mathematical property of attention mechanism
```

**Manifestation in agentic workflows:**
- Has plugin docs in context but doesn't follow them
- Reverts to default patterns under pressure
- Instructions get lost in long contexts

**The incident:** The production plugins had implicit contracts (use with real embeddings, use with action surfacing). These weren't followed because simpler patterns (use cached embeddings) were available.

---

## Metacognitive Gaps

### 18. No Uncertainty Quantification

**What it is:**
LLMs produce text, not calibrated probability estimates. "I'm 80% sure" is a linguistic expression, not a computed probability.

**Why this causes failures:**

```
Level 1: Can't trigger verification based on uncertainty level
  ↓ Why?
Level 2: No internal uncertainty representation
  ↓ Why?
Level 3: Single forward pass produces point estimate, not distribution
  ↓ Why?
Level 4: Architecture outputs logits, not epistemic uncertainty
  ↓ Why?
Level 5: Epistemic uncertainty requires different architecture (ensembles, Bayesian methods)
  ↓ [TERMINAL] Standard transformers aren't designed for uncertainty quantification
```

**Manifestation in agentic workflows:**
- No threshold for "too uncertain, should verify"
- Proceeds with same confidence regardless of actual uncertainty
- Can't distinguish "I know this" from "I'm guessing"

**The incident:** Proceeded with high apparent confidence despite massive uncertainty about which harness was correct.

---

### 19. No Self-Monitoring Process

**What it is:**
No separate process watches the LLM's own behavior and flags issues.

**Why this causes failures:**

```
Level 1: Same weights generate content and would need to critique it
  ↓ Why?
Level 2: No architectural separation between "doer" and "monitor"
  ↓ Why?
Level 3: Single model design
  ↓ Why?
Level 4: Multi-model architectures are complex and expensive
  ↓ Why?
Level 5: Training and serving multiple models has practical costs
  ↓ [TERMINAL] Engineering/economic tradeoff
```

**Manifestation in agentic workflows:**
- No "watchdog" noticing drift from goal
- No alarm when behavior patterns indicate confusion
- Self-correction requires explicit prompting

**The incident:** No internal monitor said "you've been debugging for 5 turns without questioning if this is the right harness."

---

### 20. Cannot Distinguish Productive vs. Unproductive Work

**What it is:**
LLMs can't evaluate whether their actions are moving toward the goal or just generating activity.

**Why this causes failures:**

```
Level 1: Activity feels like progress
  ↓ Why?
Level 2: No goal-distance metric being tracked
  ↓ Why?
Level 3: Goals are represented as text, not measurable objectives
  ↓ Why?
Level 4: No architecture for goal representation and tracking
  ↓ Why?
Level 5: LLMs are sequence models, not planning systems
  ↓ [TERMINAL] Fundamental architectural purpose
```

**Manifestation in agentic workflows:**
- Running commands feels productive even when wrong
- "Making progress" on wrong metric
- Can't distinguish motion from progress

**The incident:** Improving from 15% to 22% recall felt like progress. But it was progress on the wrong metric from the wrong harness.

---

## Agentic Workflow Failure Patterns

### Pattern 1: Wrong Tool Lock-In

```
1. Agent selects a tool based on surface pattern matching
2. Tool produces results (even if wrong)
3. Agent interprets results within the tool's frame
4. Sunk cost prevents reconsidering tool choice
5. Hours wasted optimizing with wrong tool
```

**Detection signals:**
- Results contradict known baselines
- Progress plateaus despite effort
- User expresses confusion about approach

**Mitigation:**
- Mandatory tool verification step
- Baseline comparison before optimization
- Checkpoint asking "is this the right tool?"

---

### Pattern 2: Missing Context Blindness

```
1. Critical context exists but isn't in active window
2. Agent proceeds with incomplete information
3. No mechanism notices the gap
4. Failures attributed to other causes
5. Root cause (missing context) never identified
```

**Detection signals:**
- Agent doesn't reference key documentation
- Approach contradicts established patterns
- "Should have known" information not used

**Mitigation:**
- Explicit retrieval prompts: "What docs should I read first?"
- Required reading before action
- Context checklists per task type

---

### Pattern 3: Local Optimization Trap

```
1. Agent optimizes immediate metric
2. Each step improves local metric
3. Global objective diverges
4. No checkpoint evaluates global trajectory
5. Significant effort, wrong direction
```

**Detection signals:**
- Metric improving but user unsatisfied
- "That's not what I meant" feedback
- Surprise at final outcome

**Mitigation:**
- Regular goal restatement
- "How does this serve the original goal?" checkpoints
- User approval at trajectory changes

---

### Pattern 4: Confidence Without Calibration

```
1. Agent states conclusions confidently
2. No uncertainty expressed
3. User trusts confident statements
4. Statements are wrong
5. Trust damaged, work wasted
```

**Detection signals:**
- Definitive statements about uncertain things
- No hedging language
- Later reversal of confident claims

**Mitigation:**
- Train/prompt for calibrated uncertainty
- Require evidence for confident claims
- Explicit uncertainty tagging

---

### Pattern 5: Plugin Availability ≠ Plugin Usage

```
1. Plugins/tools are registered and available
2. Agent has documentation for plugins
3. Agent uses inferior alternatives anyway
4. Plugin capabilities wasted
5. Suboptimal results despite superior tools existing
```

**Detection signals:**
- Manual implementation of plugin functionality
- Ignoring tool suggestions
- "Why didn't you use X?" feedback

**Mitigation:**
- Explicit tool recommendation before action
- Required justification for not using available tools
- Tool capability matching to task requirements

---

## Mitigation Strategies

### Architectural Mitigations

| Limitation | Mitigation | Implementation |
|------------|------------|----------------|
| Forward-only thinking | Tree-of-thought, lookahead | Generate multiple paths, evaluate before committing |
| No absence detection | Retrieval augmentation | Query knowledge base for relevant context before acting |
| No metacognition | Separate evaluator | Second model/prompt that critiques primary output |
| Fixed computation | Adaptive depth | More reasoning tokens for complex decisions |
| No uncertainty | Ensemble methods | Multiple samples, measure agreement |

### Process Mitigations

| Limitation | Mitigation | Implementation |
|------------|------------|----------------|
| Action bias | Required reading phase | Must read relevant docs before taking action |
| Sunk cost | Mandatory checkpoints | Every N turns, re-evaluate approach |
| Context loss | Explicit context refresh | Periodically restate goals and constraints |
| Tool misuse | Tool verification | Confirm tool selection before extensive use |
| Local optimization | Global coherence check | "How does this serve the original goal?" |

### Prompt-Level Mitigations

```markdown
## Before Starting Any Task

1. What is the authoritative source for this domain?
2. Have I read it?
3. What baseline should I expect?
4. What tools are available?
5. Which tool is most appropriate and why?

## Every N Turns

1. Am I still solving the original problem?
2. Do my results match expected baselines?
3. Should I reconsider my approach?
4. What would prove my approach wrong?

## Before Concluding

1. Does this match the user's actual goal?
2. Have I verified against authoritative sources?
3. What's my confidence and why?
```

---

## Template: Diagnosing Agentic Failures

Use this template when an agentic workflow fails:

```markdown
# Agentic Failure Analysis

## 1. Incident Summary
- Task:
- Expected outcome:
- Actual outcome:
- Time/resources wasted:

## 2. What Tools/Resources Were Available?
| Resource | Was Available | Was Used | Was Used Correctly |
|----------|--------------|----------|-------------------|
|          |              |          |                   |

## 3. What Context Was Missing?
- [ ] Authoritative documentation
- [ ] Baseline expectations
- [ ] User intent clarification
- [ ] Domain knowledge
- [ ] Previous session learnings

## 4. Where Did Reasoning Fail?
- [ ] Tool selection (wrong tool for job)
- [ ] Local vs global optimization
- [ ] Confidence without evidence
- [ ] Pattern matching without understanding
- [ ] Ignoring contradictory signals

## 5. Root Cause Analysis (5 Whys)
Why did the failure occur?
→ Why?
→ Why?
→ Why?
→ Why?
→ [Terminal cause]

## 6. Which Architectural Limitation Applied?
- [ ] Autoregressive (forward-only)
- [ ] Attention (no absence detection)
- [ ] Training (fluency over correctness)
- [ ] RLHF (action over understanding)
- [ ] Context (window = reality)
- [ ] No metacognition
- [ ] No uncertainty quantification

## 7. Mitigation for Future
- Process change:
- Prompt change:
- Tool change:
- Checkpoint added:

## 8. How Would We Detect This Earlier?
- Signal that should have triggered review:
- Checkpoint that would have caught it:
- Question that would have revealed it:
```

---

## Key Takeaways

1. **LLMs are completion machines.** They complete patterns, they don't evaluate them.

2. **Presence is attended, absence is invisible.** What's not in context doesn't exist.

3. **Local coherence ≠ global correctness.** Each step can be valid while the trajectory is wrong.

4. **Tools available ≠ tools used correctly.** Having plugins doesn't mean using them.

5. **Confidence is linguistic, not calibrated.** "I'm sure" doesn't mean probability is high.

6. **RLHF biases toward visible action.** Reading looks like stalling; doing looks helpful.

7. **No metacognition without explicit prompting.** Self-monitoring must be designed in.

8. **Every limitation has a mitigation.** But mitigations must be explicit in the workflow.

---

## Appendix: The Incident in Detail

### Timeline

| Turn | Action | What Should Have Happened |
|------|--------|---------------------------|
| 1 | Read session summary mentioning v12_recall_harness | Should have asked: "Is this the production harness?" |
| 2 | Ran v12_recall_harness, got 22% recall | Should have compared to documented 95.99% baseline |
| 3 | Investigated embeddings, found mock | Should have questioned: "Why is production using mock?" |
| 4 | "Fixed" embeddings to real OpenAI | Should have realized: "If production worked, why were embeddings mock?" |
| 5 | Re-ran, got 22% (slightly better) | Should have flagged: "22% vs 95.99% means wrong measurement" |
| 6+ | Continued optimizing wrong harness | Should have read F1_SEARCH_ENGINE_ARCHITECTURE.md |

### Resources Available But Not Used

1. **`F1_SEARCH_ENGINE_ARCHITECTURE.md`**
   - Documented production pipeline
   - Stated 95.99% Recall@3 baseline
   - Listed correct harness and plugins

2. **`ranking_truth_harness.py`**
   - The actual production test harness
   - Used real-time embeddings
   - Used action_surfacing plugin
   - Used domain_microactions plugin

3. **`action_surfacing.py`**
   - Production plugin for domain detection
   - Provides fusion parameters
   - Enables button rendering

4. **`domain_microactions.py`**
   - Production plugin for intent detection
   - Provides microactions for buttons
   - Critical for correct search behavior

### The 95.99% vs 22% Gap

This gap should have been an immediate red flag:

```
Documented baseline: 95.99% Recall@3
Observed result:     22.0% Recall@3
Gap:                 73.99 percentage points
```

A 74-point gap doesn't mean "embeddings are slightly wrong."
It means "I am measuring something completely different."

This was not recognized because:
1. 95.99% baseline wasn't in active context
2. No automatic comparison to baselines
3. 22% was treated as "a number to improve"
4. No smell test for anomalous results

---

*Document version: 1.0*
*Created: Following agentic workflow failure analysis*
*Purpose: Prevent similar failures through understanding root causes*
