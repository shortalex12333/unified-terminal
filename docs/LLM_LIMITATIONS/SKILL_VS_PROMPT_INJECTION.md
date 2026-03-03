# Skill vs Prompt Injection — When to Use Each

**Understanding the architecture of context management in agentic workflows.**

---

## The Core Difference

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROMPT INJECTION                │  /SKILL                         │
├─────────────────────────────────────────────────────────────────────┤
│  • Always in context             │  • Loaded on trigger/demand     │
│  • Consumes tokens every turn    │  • Only consumes when needed    │
│  • No conditional logic          │  • Has trigger conditions       │
│  • Static text                   │  • Can have references, files   │
│  • User must paste/manage        │  • System manages automatically │
│  • No versioning                 │  • Can be versioned/updated     │
│  • Identity & constraints        │  • Domain expertise & workflows │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Architecture (3 Layers)

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: PROMPT INJECTION (Always Present)                        │
│  ─────────────────────────────────────────                          │
│  • CLAUDE.md (project root)                                         │
│  • ~/.claude/CLAUDE.md (global)                                     │
│  • System prompt                                                    │
│                                                                     │
│  Token cost: EVERY turn                                             │
│  Use for: Identity, constraints, non-negotiables                    │
│  Analogy: Constitution — always applies                             │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2: /SKILL (On-Demand)                                        │
│  ─────────────────────────────                                      │
│  • .claude/skills/*/SKILL.md                                        │
│  • Triggered by keywords or user invocation                         │
│  • Can reference additional files in references/                    │
│                                                                     │
│  Token cost: Only when triggered                                    │
│  Use for: Domain expertise, workflows, methodologies                │
│  Analogy: Expert consultant — called when needed                    │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3: /COMMAND (User-Invoked)                                   │
│  ─────────────────────────────────                                  │
│  • Slash commands like /commit, /review, /plan                      │
│  • Explicit user action required                                    │
│                                                                     │
│  Token cost: Only when invoked                                      │
│  Use for: Specific actions, utilities, shortcuts                    │
│  Analogy: Tool in toolbox — picked up when needed                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## When to Use Prompt Injection

### Criteria

| Use Prompt Injection When... | Example |
|------------------------------|---------|
| Rule must apply to EVERY response | "You are an orchestrator" |
| Non-negotiable constraint | "Never expose API keys" |
| Identity/persona definition | "You do NOT implement directly" |
| Short (< 500 tokens) | Core behavioral rules |
| No conditional activation needed | Applies universally |

### Examples

**CLAUDE.md (Always Present)**
```markdown
# Core Identity
You are an orchestrator/PM. You do NOT implement code directly.
You PLAN, DELEGATE, REVIEW, and VERIFY.

# Non-Negotiable Constraints
- All queries MUST include yacht_id via get_user_yacht_id()
- Signature column: '{}'::jsonb or valid payload, NEVER NULL
- Never commit secrets (.env, credentials)

# Behavioral Rules
- Read relevant files before suggesting changes
- Use sub-agents for implementation work
- Verify locally before pushing to remote
```

**Token budget:** ~200-500 tokens, present in EVERY turn.

---

## When to Use /SKILL

### Criteria

| Use /SKILL When... | Example |
|--------------------|---------|
| Domain-specific expertise | Debugging methodology |
| Complex multi-step workflow | Verification process |
| Conditional activation needed | "When tests fail..." |
| Large content (> 500 tokens) | Detailed patterns, checklists |
| Evolving knowledge | Updated separately from core |
| Reusable across projects | Share between codebases |
| Has supporting reference files | Examples, templates |

### Examples

**verification-integrity/SKILL.md (Loaded on Trigger)**
```yaml
---
name: verification-integrity
triggers:
  - test failure
  - test pass
  - 404 error
  - 401 error
  - "it works"
  - "tests pass"
---

# Verification Integrity

[800+ tokens of detailed false failure/success patterns]
[Checklists, decision trees, examples]
[Only loaded when trigger keywords detected]
```

**Token budget:** ~800-2000 tokens, only when triggered (maybe 10% of turns).

---

## Decision Tree

```
Need guidance for Claude?
         │
         ▼
    Must apply to EVERY response?
         │
         ├── YES ──────────────────────────────────────┐
         │                                             │
         │    Fits in < 500 tokens?                    │
         │         │                                   │
         │         ├── YES → PROMPT INJECTION          │
         │         │         (Put in CLAUDE.md)        │
         │         │                                   │
         │         └── NO → HYBRID APPROACH            │
         │                   Core rules in CLAUDE.md   │
         │                   Details in /SKILL with    │
         │                   always_active: true       │
         │                                             │
         └── NO ───────────────────────────────────────┤
                                                       │
              Triggered by specific context?           │
                   │                                   │
                   ├── YES → /SKILL with triggers      │
                   │                                   │
                   └── NO → User must invoke?          │
                             │                         │
                             ├── YES → /COMMAND        │
                             │                         │
                             └── NO → /SKILL with      │
                                      always_active    │
```

---

## Hybrid Approach (Best Practice)

The most effective pattern combines both:

### In CLAUDE.md (Always Present, ~50 tokens)
```markdown
# Verification
When verifying test results, apply verification-integrity skill.
Surface signals lie — always verify the verification.
```

### In verification-integrity/SKILL.md (On-Demand, ~800 tokens)
```markdown
# Full Verification Integrity Skill

## False Failure Patterns
[Detailed patterns, examples, commands]

## False Success Patterns
[Detailed patterns, examples, commands]

## Checklists
[Pre-flight, post-failure, post-success checklists]
```

**Result:** Core rule always present (reminding Claude to use the skill), detailed content loaded only when needed.

---

## Token Economics

### Scenario: 100 Turn Conversation

| Approach | Tokens/Turn | Total Tokens | Cost Impact |
|----------|-------------|--------------|-------------|
| Everything in prompt | 5000 | 500,000 | Baseline |
| Core + skills (10 triggers) | 500 + (1000 × 10) | 60,000 | **88% savings** |
| Core + skills (20 triggers) | 500 + (1000 × 20) | 70,000 | **86% savings** |

### Why This Matters

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONTEXT WINDOW ECONOMICS                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Context window is finite (128K-200K tokens typically)              │
│                                                                     │
│  If you put everything in prompt injection:                         │
│  • Context fills faster                                             │
│  • Important rules get lost in noise                                │
│  • Recency bias pushes old rules out                                │
│  • Cost increases linearly                                          │
│                                                                     │
│  If you use skills strategically:                                   │
│  • Context stays lean                                               │
│  • Important rules stay prominent                                   │
│  • Relevant expertise loads when needed                             │
│  • Cost scales sub-linearly                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Skill Anatomy

### File Structure
```
.claude/skills/
└── my-skill/
    ├── SKILL.md           # Main skill content
    └── references/        # Optional supporting files
        ├── patterns.md
        ├── examples.md
        └── checklist.md
```

### SKILL.md Format
```yaml
---
name: my-skill
description: >
  What this skill does and when to use it.
triggers:
  - keyword1
  - keyword2
  - "phrase to match"
always_active: false  # Set true if should always load
---

# Skill Title

## Content here...
```

### Trigger Types

| Trigger Type | Example | When Fires |
|--------------|---------|------------|
| Keyword | `test failure` | Word appears in context |
| Phrase | `"it works"` | Exact phrase appears |
| Action | `implementing` | Detected action type |
| Domain | `docker` | Domain detected |
| Always | `always_active: true` | Every turn |

---

## Common Mistakes

### Mistake 1: Everything in CLAUDE.md

```markdown
# CLAUDE.md (BAD - 5000 tokens)
[Identity rules]
[All verification patterns]
[All debugging patterns]
[All deployment patterns]
[All code review patterns]
...
```

**Problem:** Context bloats, important rules lost in noise, costs increase.

**Fix:** Core identity in CLAUDE.md, detailed patterns in skills.

---

### Mistake 2: No Prompt Injection at All

```markdown
# CLAUDE.md (BAD - empty or minimal)
# (relies entirely on skills)
```

**Problem:** No always-on guardrails, skills might not trigger.

**Fix:** Core constraints MUST be in prompt injection.

---

### Mistake 3: Duplicating Content

```markdown
# CLAUDE.md
[Full verification checklist]

# verification-integrity/SKILL.md
[Same full verification checklist]
```

**Problem:** Wasted tokens, maintenance burden, inconsistency risk.

**Fix:** Reference in CLAUDE.md, detail in skill.

---

## Integration with LLM Limitations

From `LLM_AGENTIC_WORKFLOW_LIMITATIONS.md`:

| LLM Limitation | How Skill Architecture Helps |
|----------------|------------------------------|
| Context recency bias | Core rules in prompt injection stay prominent |
| Context window = reality | Skills load relevant knowledge on-demand |
| Attention dilution | Lean context = more attention per rule |
| RLHF action bias | Skill triggers on action to inject guardrails |
| No metacognition | Skills provide externalized self-monitoring |

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROMPT INJECTION (CLAUDE.md)                                       │
├─────────────────────────────────────────────────────────────────────┤
│  ✓ "You are X" (identity)                                           │
│  ✓ "Never do Y" (constraints)                                       │
│  ✓ "Always check Z" (invariants)                                    │
│  ✓ Short, critical, universal                                       │
│  ✓ < 500 tokens                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  /SKILL                                                             │
├─────────────────────────────────────────────────────────────────────┤
│  ✓ "When doing X, here's the detailed process"                      │
│  ✓ "The workflow for Y involves these 10 steps"                     │
│  ✓ "Here are 15 patterns to watch for in Z"                         │
│  ✓ Long, specific, conditional                                      │
│  ✓ Triggered by keywords or context                                 │
│  ✓ Has supporting reference files                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  THE RULE                                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PROMPT INJECTION = Constitution (always applies)                   │
│  SKILL = Expert Consultant (called when needed)                     │
│                                                                     │
│  Put IDENTITY and CONSTRAINTS in prompt injection.                  │
│  Put DOMAIN KNOWLEDGE and WORKFLOWS in skills.                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Aspect | Prompt Injection | /Skill |
|--------|------------------|--------|
| **When loaded** | Every turn | On trigger |
| **Token cost** | Always paid | Paid when needed |
| **Content type** | Identity, constraints | Expertise, workflows |
| **Length** | Short (< 500 tokens) | Long (500-2000+ tokens) |
| **Conditional** | No | Yes (triggers) |
| **Location** | CLAUDE.md | .claude/skills/ |
| **Analogy** | Constitution | Expert consultant |

**The key insight:** Don't put everything in CLAUDE.md. That's like reading the entire encyclopedia before every conversation. Put the constitution there, call the experts when needed.

---

*Document version: 1.0*
*Location: /Users/celeste7/Documents/unified-terminal/docs/LLM_LIMITATIONS/SKILL_VS_PROMPT_INJECTION.md*
*Related: OVERCOMING_LIMITATIONS_FIRST_PRINCIPLES.md, LLM_AGENTIC_WORKFLOW_LIMITATIONS.md*
