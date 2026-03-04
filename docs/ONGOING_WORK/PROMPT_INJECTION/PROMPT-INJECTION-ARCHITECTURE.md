# Prompt Injection Architecture — Definitive Specification

> **Status**: GOSPEL — This document is the authoritative reference for how prompts are assembled, injected, mutated, and recovered across all runtimes and agents.
> **Last Updated**: 2026-03-03
> **Companion to**: HARDCODED-ENFORCEMENT-VALUES.md, HARD-RAILS.md, ADAPTERS.md

---

## Executive Summary

Every other AI orchestration system asks agents to follow rules. Ours doesn't ask. The Prompt Assembly Pipeline constructs the complete cognitive state of every agent BEFORE it wakes up. The agent doesn't choose to follow constraints — the constraints are already inside its context when it begins thinking. When an agent fails, it never gets the same prompt twice. The Mutation Engine rewrites the prompt using error state, Spine delta, and Bodyguard results, breaking circular retry loops on the first re-attempt.

---

## 1. The Two-Layer Architecture

### The Critical Distinction

Prompt injection operates on **two completely separate lifecycles**:

| Layer | Type | Purpose | When It Runs |
|-------|------|---------|--------------|
| **Prompt Assembly** | Synchronous | Builds the complete prompt from components | Before every agent spawn |
| **Prompt Delivery** | Channel-specific | Physically injects assembled prompt into runtime | At agent spawn time |

**These are not the same thing.** Assembly decides WHAT goes in. Delivery decides HOW it gets there. Conflating them leads to architectural misunderstanding.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROMPT ASSEMBLY LAYER (Sync)                             │
│                       "The War Room"                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SOURCES ──fetch──► ASSEMBLER ──compose──► COMPLETE PROMPT                │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Source 1: IDENTITY     │  Who the agent IS                        │  │
│   │  [conductor-system.md]  │  Role, boundaries, output format         │  │
│   ├─────────────────────────┼──────────────────────────────────────────┤  │
│   │  Source 2: SKILL        │  What the agent KNOWS                    │  │
│   │  [trigger-map → .md]    │  Domain expertise, process, criteria     │  │
│   ├─────────────────────────┼──────────────────────────────────────────┤  │
│   │  Source 3: SPINE STATE  │  What the project IS right now           │  │
│   │  [SPINE.md snapshot]    │  Files, git, tests, tech stack, agents   │  │
│   ├─────────────────────────┼──────────────────────────────────────────┤  │
│   │  Source 4: MANDATE      │  What this agent must DO                 │  │
│   │  [DAG step object]      │  Task, declared files, acceptance crit   │  │
│   ├─────────────────────────┼──────────────────────────────────────────┤  │
│   │  Source 5: HANDOFF      │  What the previous agent DID             │  │
│   │  [PA summary]           │  Compressed output, format expectations  │  │
│   ├─────────────────────────┼──────────────────────────────────────────┤  │
│   │  Source 6: CORRECTION   │  What went WRONG last time              │  │
│   │  [error + bodyguard]    │  Only present on retry. Mutation engine. │  │
│   ├─────────────────────────┼──────────────────────────────────────────┤  │
│   │  Source 7: CONSTRAINT   │  What the agent CANNOT do               │  │
│   │  [scope + tools + env]  │  Declared files, tool perms, env vars   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   OUTPUT: Single assembled prompt string, ready for delivery               │
│           Token-counted, truncated if over model budget                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROMPT DELIVERY LAYER (Channel-Specific)                 │
│                           "The Transmission"                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Assembled Prompt ──route──► CHANNEL ADAPTER ──inject──► RUNTIME          │
│                                                                             │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│   │  CLI STDIN   │ │  DOM PASTE   │ │  API BODY    │ │  SESSION     │     │
│   │  (pipe)      │ │  (clipboard) │ │  (HTTP POST) │ │  (resume)    │     │
│   │              │ │              │ │              │ │              │     │
│   │ Codex CLI    │ │ ChatGPT Web  │ │ Future: API  │ │ Codex resume │     │
│   │ Claude Code  │ │              │ │ direct calls │ │ Claude resume│     │
│   │ Gemini CLI   │ │              │ │              │ │              │     │
│   │              │ │              │ │              │ │              │     │
│   │ Size: unlim  │ │ Size: ~8000  │ │ Size: model  │ │ Size: ~2000  │     │
│   │ Encoding:    │ │ Encoding:    │ │   window     │ │ Encoding:    │     │
│   │   UTF-8      │ │   HTML-safe  │ │ Encoding:    │ │   shell-safe │     │
│   │ Escape:      │ │ Escape:      │ │   JSON       │ │ Escape:      │     │
│   │   shell      │ │   none       │ │ Escape:      │ │   shell      │     │
│   │              │ │              │ │   JSON str   │ │              │     │
│   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘     │
│          │                │                │                │              │
│          └────────────────┴────────────────┴────────────────┘              │
│                                     │                                      │
│                              Agent receives                                │
│                           complete cognitive                               │
│                                  state                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Seven Injection Sources

### 2.1 Source 1: IDENTITY (Always Present)

The agent's base personality and constraints. Loaded from the agent's role file. This is NOT the skill — this is WHO the agent is regardless of what skill it has.

| Agent | Identity File | Token Budget | Loaded When |
|-------|--------------|-------------|-------------|
| Conductor | `skills/orchestration/conductor-system.md` | ~600 tokens | App launch (persistent) |
| Intake | `skills/orchestration/intake.md` | ~400 tokens | First user message |
| PA | `skills/messenger/pa-comparison.md` | ~400 tokens | Every handoff |
| Executor | `skills/workers/gsd-executor.md` (base section only) | ~300 tokens | Step dispatch |
| Planner | `skills/workers/gsd-planner.md` (base section only) | ~300 tokens | Plan phase |
| Researcher | `skills/workers/gsd-researcher.md` (base section only) | ~300 tokens | Research step |
| Any worker | The worker's `## You Are` + `## Hard Boundaries` sections | ~200-400 tokens | Step dispatch |

**Assembly rule:** Identity is ALWAYS the first section of the assembled prompt. It goes BEFORE everything else. The agent reads its identity before it reads anything about the task.

```
ASSEMBLED PROMPT ORDER:
  [1] IDENTITY      ← "You are the executor. You write code. You NEVER review."
  [2] CONSTRAINT    ← "Tools: read, write, bash. Scope: these 3 files only."
  [3] SPINE STATE   ← "Project: next.js 14, 47 files, tests passing."
  [4] SKILL         ← "TDD methodology: write test → fail → implement → pass."
  [5] MANDATE       ← "Create ContactForm.tsx with name, email, message fields."
  [6] HANDOFF       ← "Previous step created the route. Form component is next."
  [7] CORRECTION    ← (only on retry) "Last attempt failed: forgot form validation."
```

### 2.2 Source 2: SKILL (On-Demand, From Skill Injector)

The domain expertise the agent needs for THIS specific task. Selected by the Skill Injector using trigger-map.json matching.

**Selection algorithm (hardcoded in `src/skill-injector/match.ts`):**

```typescript
const SKILL_INJECTION_CONFIG = {
  MIN_MATCH_SCORE:     0.2,     // Below this: no skill, generic worker
  TIE_BREAK:           "first", // First in trigger-map order wins ties
  MAX_SKILL_TOKENS:    2_000,   // Truncate if over
  FRONTEND_BM25_TOP_K: 5,       // Append top 5 CSV results for frontend
  FRONTEND_DEFAULT_Q:  "SaaS premium minimal clean apple whitespace",
};

function selectSkill(stepMandate: string, triggerMap: TriggerMap): SkillMatch | null {
  const tokens = tokenize(stepMandate); // lowercase, remove stopwords
  let bestMatch: SkillMatch | null = null;

  for (const [skillName, skillData] of Object.entries(triggerMap)) {
    const matchCount = skillData.triggers.filter(t => tokens.includes(t.toLowerCase())).length;
    const score = matchCount / skillData.triggers.length;

    if (score > SKILL_INJECTION_CONFIG.MIN_MATCH_SCORE) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { skillName, score, file: skillData.file };
      }
    }
  }
  return bestMatch;
}
```

**Special case — Frontend Design skill:**

```typescript
if (matchedSkill === "skill-frontend-design" && !project.hasDesignSystem) {
  // 1. Load base skill SKILL.md (~400 tokens)
  // 2. Run BM25 search against CSVs with design preference
  // 3. Append top 5 BM25 results (~500-2000 tokens)
  // Total injection: ~900-2400 tokens
  const bm25Query = project.designPreference || SKILL_INJECTION_CONFIG.FRONTEND_DEFAULT_Q;
  const csvResults = bm25Search(bm25Query, "skills/frontend-design/data/");
  skillContent += "\n\n## Design System Tokens\n" + csvResults.slice(0, 5).join("\n");
}
```

### 2.3 Source 3: SPINE STATE (Fetched Fresh Every Time)

The Spine is rebuilt from filesystem BEFORE every injection. The agent sees the project as it ACTUALLY IS, not as it was 5 minutes ago.

**Fetch sequence (hardcoded in `src/spine/spine-builder.ts`):**

```typescript
async function fetchSpineForInjection(workingDir: string): Promise<string> {
  // All reads are filesystem/git — no AI, no LLM, pure code
  const spine = {
    files:        await globFiles(workingDir),        // fs.readdirSync recursive
    git:          await gitStatus(workingDir),         // git status --porcelain + git log -1
    tests:        await lastTestResult(workingDir),    // read .vitest-results.json or npm test cache
    techStack:    await detectStack(workingDir),       // read package.json, tsconfig, etc
    activeAgents: await getActiveAgents(),             // from agent registry in memory
  };

  return formatSpineForPrompt(spine); // ~200-400 tokens
}
```

**What gets injected (abridged SPINE.md content):**

```
## Project State (auto-generated, do not modify)
- Path: /Users/dev/candle-store
- Framework: next.js@14.1.0 + typescript
- Files: 47 total (12 .tsx, 8 .ts, 5 .css, 4 .json, 18 other)
- Git: branch main, 3 uncommitted files
- Tests: 12 passed, 0 failed, 67% coverage
- Build: last success 2 min ago, dist/ 1.2MB
- Active: conductor (45% tokens), executor-3 (30% tokens)
```

**Critical rule:** Spine is NEVER cached between injections. Every agent spawn triggers a fresh Spine build. Cost: ~50ms (filesystem reads). Worth it: agent always sees truth.

### 2.4 Source 4: MANDATE (From DAG Step)

The specific task this agent must complete. Comes directly from the Conductor's DAG.

```typescript
interface Mandate {
  stepId:             number;
  task:               string;     // "Create ContactForm.tsx with validation"
  declaredFiles:      string[];   // ["src/components/ContactForm.tsx", "src/components/ContactForm.test.tsx"]
  acceptanceCriteria: string[];   // ["File exists", "Tests pass", "Form renders 3 fields"]
  dependsOn:          number[];   // [1, 2] — steps that must complete first
  worker:             string;     // "gsd-executor"
  tools:              string[];   // ["read", "write", "bash"]
  timeout:            number;     // 300000 (5 min)
}
```

**Injected as:**

```
## Your Mandate (Step 3 of 9)
Task: Create ContactForm.tsx with name, email, and message fields, plus form validation.
Files you MUST produce: src/components/ContactForm.tsx, src/components/ContactForm.test.tsx
Files you MUST NOT touch: anything else (scope enforcement is active)
Acceptance criteria:
  1. Both files exist on disk
  2. npm test exits 0 with test count > 0
  3. ContactForm component renders 3 input fields

Steps 1-2 are complete. Step 4 depends on your output.
Do NOT proceed to step 4. Complete step 3 and stop.
```

### 2.5 Source 5: HANDOFF (From PA / Messenger)

Compressed output from the previous step. The PA reads the last agent's full output, compresses to 2-3 sentences, and checks format compatibility with the next step's expectations.

**PA produces two outputs:**

```typescript
interface HandoffResult {
  summary:     string;   // "Step 2 created the route at /contact. No component exists yet."
  compatible:  boolean;  // Does output format match next step's input expectations?
  warnings:    string[]; // ["Previous step used JavaScript, next step expects TypeScript"]
}
```

**Injected as (only if previous step exists):**

```
## Previous Step Output (compressed by PA)
Step 2 completed: Created route /contact in app/contact/page.tsx. Route renders placeholder text. No form component exists yet — that is YOUR job.
⚠ Note: Previous step used JavaScript (.js). Your output must be TypeScript (.tsx).
```

**When PA flags incompatible:**

```
## Previous Step Output (compressed by PA)
⚠ FORMAT MISMATCH: Step 2 output is a JSON config file, but your mandate expects a React component. The Conductor may need to re-plan. Proceed with caution — if the input does not match what you expect, STOP and report.
```

### 2.6 Source 6: CORRECTION (The Mutation Engine — Only On Retry)

**This is the one-shot kill.** This is why our system doesn't loop.

Every other orchestration system retries with the SAME prompt. Agent fails at step 3, conductor says "try again," agent gets identical context, makes identical mistake, loops forever.

Our system MUTATES the prompt on every retry. The Correction source is built from:

1. **What failed:** The error output, exit code, stack trace
2. **What Bodyguard caught:** Which checks failed, which passed
3. **What Spine shows NOW:** Filesystem delta since last attempt
4. **What was tried:** The previous prompt (to avoid repeating the same approach)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MUTATION ENGINE ("The Anti-Loop")                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ATTEMPT 1 (fresh):                                                       │
│     Identity + Skill + Spine + Mandate + Handoff                           │
│     → Agent tries approach A                                               │
│     → FAILS: test-exit-code check returns 1                                │
│                                                                             │
│   ATTEMPT 2 (mutated):                                                     │
│     Identity + Skill + Spine(REFRESHED) + Mandate + Handoff                │
│     + CORRECTION:                                                          │
│       "Previous attempt FAILED. Here is what happened:                     │
│        Error: TypeError: Cannot read property 'email' of undefined         │
│        at ContactForm.tsx:14                                               │
│        Bodyguard result: file exists (PASS), tests (FAIL), scope (PASS)    │
│        What you tried: Created form with uncontrolled inputs.              │
│        What to do differently: Use useState for form state.                │
│        DO NOT repeat the same approach."                                   │
│     → Agent tries approach B (informed by failure)                         │
│     → PASSES                                                               │
│                                                                             │
│   ATTEMPT 3 (if needed, double-mutated):                                   │
│     Everything from attempt 2                                              │
│     + CORRECTION from attempt 2's failure                                  │
│     + "You have now failed TWICE. Approaches tried: A (uncontrolled),      │
│        B (useState without default values). The error pattern suggests     │
│        the issue is in the initial state, not the handler."                │
│     → Agent tries approach C                                               │
│     → Circuit breaker: if this fails too, ask user.                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The Correction builder (hardcoded logic, no LLM):**

```typescript
interface CorrectionContext {
  attemptNumber:    number;          // 2 or 3
  previousError:    string;          // stderr/error output, truncated to 2000 chars
  previousExitCode: number;          // process exit code
  bodyguardResults: CheckResult[];   // which checks passed/failed
  filesCreated:     string[];        // what the previous attempt DID produce
  filesModified:    string[];        // what it changed
  spineDelta:       string;          // what changed in filesystem since last attempt
  previousApproach: string;          // one-line summary of what was tried
}

function buildCorrectionBlock(ctx: CorrectionContext): string {
  const lines: string[] = [
    `## CORRECTION (Attempt ${ctx.attemptNumber} of 3)`,
    ``,
    `Your previous attempt FAILED. Do NOT repeat the same approach.`,
    ``,
    `### What Happened`,
    `Exit code: ${ctx.previousExitCode}`,
    `Error (last 2000 chars):`,
    "```",
    ctx.previousError.slice(-2000),
    "```",
    ``,
    `### Bodyguard Results`,
  ];

  for (const check of ctx.bodyguardResults) {
    lines.push(`- ${check.name}: ${check.passed ? "PASS" : "FAIL"} ${check.detail || ""}`);
  }

  lines.push(``);
  lines.push(`### What You Produced`);
  if (ctx.filesCreated.length) {
    lines.push(`Files created: ${ctx.filesCreated.join(", ")}`);
  }
  if (ctx.filesModified.length) {
    lines.push(`Files modified: ${ctx.filesModified.join(", ")}`);
  }

  lines.push(``);
  lines.push(`### What Changed Since Last Attempt`);
  lines.push(ctx.spineDelta || "No filesystem changes detected.");

  lines.push(``);
  lines.push(`### Approach That Failed`);
  lines.push(ctx.previousApproach);
  lines.push(``);
  lines.push(`You MUST try a DIFFERENT approach. If the same error occurs with a different approach, the issue may be environmental (missing dependency, wrong config), not in your code.`);

  return lines.join("\n");
}
```

**Token budget for correction:** max 800 tokens. If error output exceeds this, truncate from the MIDDLE (keep first 400 chars + last 400 chars — the error type is at the top, the stack trace root is at the bottom).

### 2.7 Source 7: CONSTRAINT (Scope + Tools + Environment)

Hardcoded limits the agent cannot exceed. This is NOT a suggestion — the adapter enforces these at the runtime level.

```
## Constraints (enforced by adapter, not by you)
Tools available: read, write, bash (translated to: --sandbox workspace-write --full-auto)
Working directory: /Users/dev/candle-store
Declared files: src/components/ContactForm.tsx, src/components/ContactForm.test.tsx
Token budget: 76,800 tokens (gpt-4o at 60% of 128K)
Timeout: 300 seconds
Environment: VERCEL_TOKEN=[REDACTED], NODE_ENV=development
```

**Critical:** Environment variables are injected but NEVER logged. The adapter passes them via `process.env` to the child process, not via the prompt text. The only mention in the prompt is `[REDACTED]` so the agent knows the variable EXISTS without seeing its value.

---

## 3. The Complete Assembly Pipeline

### 3.1 Assembly Function

```typescript
// src/prompt-assembler/assemble.ts

interface AssemblyInput {
  agent:       AgentRole;         // conductor, executor, planner, etc.
  step:        DAGStep | null;    // null for conductor/intake
  skill:       SkillMatch | null; // null if no skill matched
  spine:       SpineSnapshot;     // always fresh
  handoff:     HandoffResult | null; // null if first step
  correction:  CorrectionContext | null; // null if first attempt
  constraints: ConstraintBlock;
}

interface AssembledPrompt {
  content:     string;            // the final prompt string
  tokenCount:  number;            // estimated token count
  sources:     string[];          // ["identity:gsd-executor", "skill:tdd-guide", "spine", "mandate:3"]
  channel:     DeliveryChannel;   // "stdin" | "dom" | "api" | "resume"
}

const ASSEMBLY_TOKEN_BUDGETS = {
  identity:    600,   // max tokens for identity section
  skill:       2000,  // max tokens for skill content
  spine:       400,   // max tokens for spine state
  mandate:     400,   // max tokens for task mandate
  handoff:     300,   // max tokens for PA summary
  correction:  800,   // max tokens for error context
  constraint:  200,   // max tokens for scope/tools
  // TOTAL MAX: ~4700 tokens of injection overhead
  // Remaining: model effective budget minus 4700 = working budget for agent
};

function assemblePrompt(input: AssemblyInput): AssembledPrompt {
  const sections: string[] = [];
  const sources: string[] = [];

  // [1] IDENTITY — always first, always present
  const identity = loadIdentity(input.agent);
  sections.push(truncateToTokens(identity, ASSEMBLY_TOKEN_BUDGETS.identity));
  sources.push(`identity:${input.agent}`);

  // [2] CONSTRAINT — immediately after identity
  const constraint = buildConstraintBlock(input.constraints);
  sections.push(truncateToTokens(constraint, ASSEMBLY_TOKEN_BUDGETS.constraint));
  sources.push("constraint");

  // [3] SPINE STATE — fresh filesystem truth
  const spineBlock = formatSpineForPrompt(input.spine);
  sections.push(truncateToTokens(spineBlock, ASSEMBLY_TOKEN_BUDGETS.spine));
  sources.push("spine");

  // [4] SKILL — only if Skill Injector matched
  if (input.skill) {
    const skillContent = loadSkillFile(input.skill.file);
    sections.push(truncateToTokens(skillContent, ASSEMBLY_TOKEN_BUDGETS.skill));
    sources.push(`skill:${input.skill.skillName}`);
  }

  // [5] MANDATE — the specific task
  if (input.step) {
    const mandate = formatMandate(input.step);
    sections.push(truncateToTokens(mandate, ASSEMBLY_TOKEN_BUDGETS.mandate));
    sources.push(`mandate:${input.step.stepId}`);
  }

  // [6] HANDOFF — compressed previous step output
  if (input.handoff) {
    const handoffBlock = formatHandoff(input.handoff);
    sections.push(truncateToTokens(handoffBlock, ASSEMBLY_TOKEN_BUDGETS.handoff));
    sources.push("handoff");
  }

  // [7] CORRECTION — only on retry. ALWAYS LAST so it's freshest in context.
  if (input.correction) {
    const correctionBlock = buildCorrectionBlock(input.correction);
    sections.push(truncateToTokens(correctionBlock, ASSEMBLY_TOKEN_BUDGETS.correction));
    sources.push(`correction:attempt-${input.correction.attemptNumber}`);
  }

  const content = sections.join("\n\n---\n\n");
  const tokenCount = estimateTokens(content);
  const channel = selectChannel(input.agent, input.constraints.runtime);

  return { content, tokenCount, sources, channel };
}
```

### 3.2 Token Accounting

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOKEN BUDGET BREAKDOWN (gpt-4o example)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Model context window:           128,000 tokens                           │
│   Kill threshold (60%):            76,800 tokens effective                 │
│                                                                             │
│   Injection overhead:                                                      │
│     Identity:         600 tokens                                           │
│     Constraint:       200 tokens                                           │
│     Spine:            400 tokens                                           │
│     Skill:          2,000 tokens (max, often less)                         │
│     Mandate:          400 tokens                                           │
│     Handoff:          300 tokens                                           │
│     Correction:       800 tokens (only on retry)                           │
│     ─────────────────────────                                              │
│     Total overhead:  3,900 tokens (first attempt)                          │
│                      4,700 tokens (retry with correction)                  │
│                                                                             │
│   WORKING BUDGET:    72,900 tokens (first attempt)                         │
│                      72,100 tokens (retry)                                 │
│                                                                             │
│   This is the agent's space for THINKING and PRODUCING OUTPUT.             │
│   Injection overhead = 5.1% of effective budget (first attempt)            │
│   Injection overhead = 6.1% of effective budget (retry)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Delivery Channels

### 4.1 Channel 1: CLI STDIN (Codex, Claude Code, Gemini CLI)

The primary channel for all CLI-based runtimes. Prompt is piped via stdin to avoid shell escaping issues and argument length limits.

```typescript
// src/adapters/delivery/stdin-delivery.ts

const STDIN_CONFIG = {
  MAX_ARG_LENGTH:     2_000,    // chars. Above this: MUST use stdin pipe
  ENCODING:           "utf-8",
  SHELL_ESCAPE:       true,     // escape ' " \ $ ` in prompt content
  NEWLINE:            "\n",     // LF, not CRLF
};

async function deliverViaStdin(
  assembled: AssembledPrompt,
  runtime: "codex" | "claude" | "gemini",
  config: AgentConfig
): Promise<ChildProcess> {

  const command = buildCommand(runtime, config);
  // e.g., "codex exec --json --sandbox workspace-write --full-auto -C /path"

  const child = spawn(command.binary, command.args, {
    cwd: config.workingDir,
    env: { ...process.env, ...config.env },  // env vars injected here, not in prompt
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Write assembled prompt to stdin
  child.stdin.write(assembled.content);
  child.stdin.end();

  return child;
}
```

**Why stdin, not command args:**
- Shell argument limit: ~262,144 chars on macOS, but shell escaping is fragile
- Stdin has no practical limit
- No shell interpretation of prompt content (prevents accidental command injection)
- Binary-safe: handles any UTF-8 content

### 4.2 Channel 2: DOM PASTE (ChatGPT Web)

The channel for ChatGPT BrowserView injection. Uses Electron's `webContents.executeJavaScript()` to paste into the contentEditable div.

```typescript
// src/adapters/delivery/dom-delivery.ts

const DOM_CONFIG = {
  MAX_PASTE_CHARS:      8_000,  // practical limit before ChatGPT input lags
  POST_PASTE_DELAY_MS:  300,    // wait for React state update
  COMPLETION_DETECT_MS: 500,    // buffer after generation ends
  CAPTURE_POLL_MS:      150,    // polling interval for response capture
  SELECTOR_CHAIN: [
    "#prompt-textarea",
    "textarea[data-id]",
    '[contenteditable="true"][data-placeholder]',
    "div.ProseMirror",
  ],
  SEND_BUTTON_CHAIN: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'form button[type="submit"]',
  ],
};

async function deliverViaDom(
  assembled: AssembledPrompt,
  chatView: BrowserView
): Promise<CaptureHandle> {

  // STEP 1: Locate input element
  const inputFound = await chatView.webContents.executeJavaScript(`
    (() => {
      const selectors = ${JSON.stringify(DOM_CONFIG.SELECTOR_CHAIN)};
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { window.__injectionTarget = el; return sel; }
      }
      return null;
    })()
  `);

  if (!inputFound) throw new Error("DOM_INJECT_FAIL: No input element found");

  // STEP 2: Paste via ClipboardEvent (most reliable for React controlled inputs)
  await chatView.webContents.executeJavaScript(`
    (() => {
      const el = window.__injectionTarget;
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', ${JSON.stringify(assembled.content)});
      el.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt, bubbles: true, cancelable: true
      }));
    })()
  `);

  // STEP 3: Wait for React state to absorb the paste
  await sleep(DOM_CONFIG.POST_PASTE_DELAY_MS);

  // STEP 4: Click send
  const sent = await chatView.webContents.executeJavaScript(`
    (() => {
      const selectors = ${JSON.stringify(DOM_CONFIG.SEND_BUTTON_CHAIN)};
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) { btn.click(); return true; }
      }
      // Fallback: Enter key
      window.__injectionTarget.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      return 'fallback-enter';
    })()
  `);

  // STEP 5: Start capture polling
  return startCapture(chatView, DOM_CONFIG.CAPTURE_POLL_MS);
}
```

**Size constraint:** ChatGPT's input can handle ~8000 characters before the UI lags. For larger prompts (frontend builder with CSV data), we split into a two-message sequence:

```
Message 1: "I'm going to give you a skill and design system, then a task. Acknowledge with OK."
Message 2: [Full assembled prompt]
```

This primes the context without overwhelming the input element.

### 4.3 Channel 3: API BODY (Future Direct API Calls)

Reserved for when we add direct API adapter support (Anthropic Messages API, OpenAI Chat API). Not MVP but the assembly pipeline produces API-ready output.

```typescript
async function deliverViaApi(
  assembled: AssembledPrompt,
  apiConfig: ApiAdapterConfig
): Promise<ApiResponse> {
  return fetch(apiConfig.endpoint, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiConfig.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: apiConfig.model,
      messages: [
        { role: "system", content: assembled.content },
        { role: "user", content: "Execute the mandate described above." }
      ],
      max_tokens: apiConfig.maxOutputTokens,
    }),
  });
}
```

### 4.4 Channel 4: SESSION RESUME (Persistent Agents)

For the Conductor (Codex persistent session) and any agent that survives across steps. The injection is APPENDED to an existing session, not a fresh spawn.

```typescript
// src/adapters/delivery/resume-delivery.ts

const RESUME_CONFIG = {
  MAX_RESUME_CHARS:     2_000,   // keep resume injections short
  PHASE_TRANSITION_MARKER: "---PHASE-TRANSITION---",
};

async function deliverViaResume(
  assembled: AssembledPrompt,
  sessionId: string,
  runtime: "codex" | "claude"
): Promise<ChildProcess> {

  // Only inject: new Spine state + new mandate + correction
  // Identity and skill are already in the session context
  const resumeContent = [
    RESUME_CONFIG.PHASE_TRANSITION_MARKER,
    formatSpineForPrompt(assembled.spine),         // fresh spine
    assembled.mandate,                              // new step
    assembled.correction || "",                     // error context if retry
  ].join("\n\n");

  if (runtime === "codex") {
    return spawn("codex", ["resume", sessionId, "--json", resumeContent], {
      stdio: ["pipe", "pipe", "pipe"],
    });
  }

  if (runtime === "claude") {
    return spawn("claude", ["resume", sessionId, resumeContent], {
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
}
```

**Critical difference from fresh spawn:** Session resume does NOT re-inject identity, skill, or constraint. Those are already in the session's context window. Re-injecting would waste tokens and potentially contradict earlier context.

---

## 5. The Naming Convention: WHO Gets WHAT Through WHICH Channel

Every injection is tagged with a route: `[RECIPIENT]:[CHANNEL]:[SOURCES]`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INJECTION ROUTING TABLE                                  │
├──────────────┬───────────┬───────────────────────────────────┬─────────────┤
│  Recipient   │  Channel  │  Sources Injected                 │  Frequency  │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  CONDUCTOR   │  stdin    │  identity + spine                 │  Once (app  │
│  (codex)     │  resume   │  spine + mandate (on new phase)   │  launch)    │
│              │           │  spine + correction (on failure)   │  Per phase  │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  INTAKE      │  dom      │  identity + mandate               │  Once per   │
│  (chatgpt)   │           │  (user message wrapped in meta)    │  project    │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  EXECUTOR    │  stdin    │  identity + constraint + spine     │  Per step   │
│  (codex)     │           │  + skill + mandate + handoff       │             │
│              │           │  + correction (if retry)           │             │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  PLANNER     │  stdin    │  identity + constraint + spine     │  Per plan   │
│  (codex)     │           │  + skill + mandate                 │  phase      │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  RESEARCHER  │  dom      │  identity + constraint + spine     │  Per        │
│  (chatgpt)   │           │  + skill + mandate + handoff       │  research   │
│              │           │  (uses ChatGPT web for browsing)   │  step       │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  REVIEWER    │  stdin    │  identity + constraint + spine     │  Per review │
│  (codex/     │           │  + skill + mandate                 │  gate       │
│   claude)    │           │  (NO handoff — reviews cold)       │             │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  PA          │  stdin    │  identity + spine + mandate        │  Per        │
│  (any cli)   │           │  + BOTH outputs (step N & N+1     │  handoff    │
│              │           │    expectations)                    │             │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  DEBUGGER    │  stdin    │  identity + constraint + spine     │  On failure │
│  (codex)     │           │  + skill + mandate + correction    │  only       │
│              │           │  (correction is the PRIMARY input)  │             │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  DEPLOYER    │  stdin    │  identity + constraint + spine     │  Once per   │
│  (codex)     │           │  + skill + mandate                 │  deploy     │
│              │           │  + env (via process.env, NOT text) │             │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  IMAGE-GEN   │  dom      │  identity + mandate               │  Per image  │
│  (chatgpt)   │           │  (minimal — DALL-E prompt only)    │  request    │
├──────────────┼───────────┼───────────────────────────────────┼─────────────┤
│  ARCHIVIST   │  stdin    │  identity + spine + skill          │  Once per   │
│  (any cli)   │           │  + full execution log              │  project    │
│              │           │  (large context, uses opus/pro)     │  close      │
└──────────────┴───────────┴───────────────────────────────────┴─────────────┘
```

### 5.1 Log Format

Every injection is logged to Spine with this structure:

```typescript
interface InjectionLog {
  timestamp:   number;          // Date.now()
  recipient:   string;          // "executor-step-3"
  channel:     string;          // "stdin" | "dom" | "api" | "resume"
  sources:     string[];        // ["identity:gsd-executor", "skill:tdd-guide", "spine", "mandate:3"]
  tokenCount:  number;          // estimated tokens injected
  promptHash:  string;          // SHA-256 of assembled prompt (for dedup detection)
  attemptNum:  number;          // 1, 2, or 3
  correction:  boolean;         // true if correction source was included
}
```

**Why hash the prompt:** If the hash of attempt 2's prompt matches attempt 1's hash, the Mutation Engine FAILED to mutate. This should never happen (Spine refresh alone changes the hash), but if it does, the system halts the retry and escalates to user. A repeated prompt guarantees a repeated failure.

---

## 6. Failure Capture and Recovery

### 6.1 The Error Capture Pipeline

When an agent fails, the system captures EVERYTHING before the process dies:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ERROR CAPTURE PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Agent process exits with code != 0                                       │
│              │                                                              │
│              ▼                                                              │
│   [1] CAPTURE stdout (last 4000 chars)                                     │
│       Store: injectionLog.stdout                                           │
│              │                                                              │
│              ▼                                                              │
│   [2] CAPTURE stderr (last 4000 chars)                                     │
│       Store: injectionLog.stderr                                           │
│              │                                                              │
│              ▼                                                              │
│   [3] CAPTURE exit code                                                    │
│       Store: injectionLog.exitCode                                         │
│              │                                                              │
│              ▼                                                              │
│   [4] SNAPSHOT Spine (what changed during this attempt?)                   │
│       Diff: spine_before vs spine_after                                    │
│       Store: injectionLog.spineDelta                                       │
│              │                                                              │
│              ▼                                                              │
│   [5] RUN Bodyguard checks (even on failure — capture WHAT failed)        │
│       Store: injectionLog.bodyguardResults                                 │
│              │                                                              │
│              ▼                                                              │
│   [6] CLASSIFY error type (code, no LLM):                                 │
│       - exit 1 + "TypeError"     → CODE_ERROR                             │
│       - exit 1 + "ENOENT"        → FILE_NOT_FOUND                         │
│       - exit 2 + timeout signal  → TIMEOUT                                │
│       - exit 130 + SIGINT        → USER_CANCELLED                         │
│       - exit 1 + "401"           → AUTH_EXPIRED                           │
│       - exit 1 + "429"           → RATE_LIMITED                           │
│       - exit 1 + "ENOSPC"        → DISK_FULL                             │
│       - exit != 0 + no stderr    → UNKNOWN (needs investigation)          │
│       Store: injectionLog.errorType                                        │
│              │                                                              │
│              ▼                                                              │
│   [7] ROUTE to recovery:                                                   │
│       - CODE_ERROR     → Mutation Engine → retry with correction           │
│       - FILE_NOT_FOUND → Check Spine → file path mismatch? Fix mandate    │
│       - TIMEOUT        → Kill, narrow mandate, retry with smaller scope    │
│       - USER_CANCELLED → Stop build                                        │
│       - AUTH_EXPIRED   → Re-auth flow → retry same prompt (no mutation)   │
│       - RATE_LIMITED   → Defer step → continue other steps → resume later │
│       - DISK_FULL      → Alert user → halt                                │
│       - UNKNOWN        → Log everything → escalate to Conductor            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Error Type to Recovery Action Map

```typescript
const ERROR_RECOVERY: Record<string, RecoveryAction> = {
  CODE_ERROR: {
    action:     "mutate_and_retry",
    mutation:   "correction_block",       // build correction from error + bodyguard
    maxRetries: 3,
    onExhaust:  "escalate_to_user",
  },
  FILE_NOT_FOUND: {
    action:     "fix_mandate_and_retry",
    mutation:   "refresh_spine_correct_paths", // Spine shows actual files, fix declared paths
    maxRetries: 1,
    onExhaust:  "escalate_to_conductor",  // Conductor may need to re-plan
  },
  TIMEOUT: {
    action:     "narrow_and_retry",
    mutation:   "split_mandate",           // Break into 2 sub-tasks, each with half the work
    maxRetries: 1,
    onExhaust:  "escalate_to_conductor",
  },
  USER_CANCELLED: {
    action:     "stop",
    mutation:   null,
    maxRetries: 0,
    onExhaust:  "stop",
  },
  AUTH_EXPIRED: {
    action:     "reauth_and_retry",
    mutation:   null,                       // same prompt, just new auth
    maxRetries: 1,
    onExhaust:  "alert_user_auth",
  },
  RATE_LIMITED: {
    action:     "defer_and_continue",
    mutation:   null,                       // prompt is fine, just can't send now
    maxRetries: 0,                          // don't retry immediately
    onExhaust:  "schedule_resume",          // cron will resume when limit lifts
  },
  DISK_FULL: {
    action:     "halt",
    mutation:   null,
    maxRetries: 0,
    onExhaust:  "alert_user_disk",
  },
  UNKNOWN: {
    action:     "log_and_escalate",
    mutation:   null,
    maxRetries: 0,
    onExhaust:  "escalate_to_conductor",
  },
};
```

### 6.3 The Retraction System

When a step PASSES bodyguard checks but a LATER step discovers the output was wrong (e.g., Step 5 finds Step 3's component has a bug), the system must retract:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RETRACTION FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Step 5 fails. Debugger isolates root cause to Step 3's output.           │
│              │                                                              │
│              ▼                                                              │
│   [1] Conductor receives: "Step 3 output is the root cause"               │
│              │                                                              │
│              ▼                                                              │
│   [2] Git revert Step 3's commits:                                        │
│       git revert --no-commit <step-3-commit-hash>                          │
│       (Preserves Step 4's work if it's unrelated)                          │
│              │                                                              │
│              ▼                                                              │
│   [3] Re-plan from Step 3 onward:                                         │
│       Conductor injects into its own session:                              │
│       "Step 3 output was incorrect. Root cause: [debugger analysis].       │
│        Step 3 has been reverted. Re-plan steps 3-5."                       │
│              │                                                              │
│              ▼                                                              │
│   [4] New Step 3 spawns with DOUBLE correction:                           │
│       - Original correction (what failed the first time)                   │
│       - Retraction correction (what the debugger found)                    │
│       "Your previous output passed initial checks but caused Step 5 to    │
│        fail. The issue: [debugger analysis]. Produce output that avoids    │
│        this specific problem."                                             │
│              │                                                              │
│              ▼                                                              │
│   [5] Steps 3-5 re-execute with accumulated correction context            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 API/Subscription Error Detection

```typescript
const API_ERROR_PATTERNS: Record<string, { pattern: RegExp; errorType: string; recovery: string }[]> = {
  openai: [
    { pattern: /rate_limit_exceeded/i,         errorType: "RATE_LIMITED",    recovery: "defer_and_continue" },
    { pattern: /insufficient_quota/i,          errorType: "QUOTA_EXCEEDED",  recovery: "alert_user_billing" },
    { pattern: /invalid_api_key/i,             errorType: "AUTH_EXPIRED",    recovery: "reauth_and_retry" },
    { pattern: /context_length_exceeded/i,     errorType: "CONTEXT_OVERFLOW", recovery: "truncate_and_retry" },
    { pattern: /server_error|overloaded/i,     errorType: "SERVICE_DOWN",    recovery: "wait_60s_retry" },
  ],
  anthropic: [
    { pattern: /rate_limit|overloaded/i,       errorType: "RATE_LIMITED",    recovery: "defer_and_continue" },
    { pattern: /authentication_error/i,        errorType: "AUTH_EXPIRED",    recovery: "reauth_and_retry" },
    { pattern: /invalid_request.*token/i,      errorType: "CONTEXT_OVERFLOW", recovery: "truncate_and_retry" },
  ],
  google: [
    { pattern: /RESOURCE_EXHAUSTED/i,          errorType: "RATE_LIMITED",    recovery: "defer_and_continue" },
    { pattern: /UNAUTHENTICATED/i,             errorType: "AUTH_EXPIRED",    recovery: "reauth_and_retry" },
    { pattern: /INVALID_ARGUMENT.*token/i,     errorType: "CONTEXT_OVERFLOW", recovery: "truncate_and_retry" },
  ],
  chatgpt_web: [
    // These are detected from DOM text, not API responses
    { pattern: /you['']ve reached.*limit/i,    errorType: "RATE_LIMITED",    recovery: "defer_and_continue" },
    { pattern: /something went wrong/i,        errorType: "SERVICE_ERROR",   recovery: "wait_30s_retry" },
    { pattern: /network error/i,               errorType: "NETWORK",         recovery: "wait_10s_retry" },
  ],
};
```

---

## 7. The Do's and Don'ts

### 7.1 DO — Hard Rules

| # | Rule | Why | Enforcement |
|---|------|-----|-------------|
| 1 | DO refresh Spine before every injection | Stale state = wrong decisions. 50ms cost. | Code: `assemblePrompt()` calls `fetchSpine()` first |
| 2 | DO truncate each source to its token budget | Overflow kills the working budget | Code: `truncateToTokens()` per section |
| 3 | DO hash the assembled prompt and compare to last attempt | Identical prompts guarantee identical failures | Code: SHA-256 compare, halt if match |
| 4 | DO include Correction LAST in the assembled prompt | Most recent context = strongest influence on LLM | Code: Correction is always `sections[sections.length - 1]` |
| 5 | DO capture stderr before killing a process | Dead processes lose their error output forever | Code: Buffer stderr continuously, snapshot on exit |
| 6 | DO pass env vars via `process.env`, never in prompt text | Secrets in prompt text leak to logs, to LLM memory | Code: `spawn()` gets `env` param, prompt says `[REDACTED]` |
| 7 | DO use stdin for CLI injection, never command args | Shell escaping is fragile. Stdin is binary-safe. | Code: All CLI adapters pipe stdin |
| 8 | DO log every injection with sources, token count, hash | Debugging failures requires knowing what the agent SAW | Code: `InjectionLog` written to Spine |
| 9 | DO split DOM injection into two messages if >8000 chars | ChatGPT input lags on long pastes | Code: `DOM_CONFIG.MAX_PASTE_CHARS` check |
| 10 | DO run Bodyguard checks even on failed steps | Need to know WHAT passed to inform correction | Code: Bodyguard runs unconditionally |

### 7.2 DON'T — Hard Rules

| # | Rule | Why | What Happens Instead |
|---|------|-----|---------------------|
| 1 | DON'T retry with the same prompt | Circular failure guaranteed | Mutation Engine builds correction block |
| 2 | DON'T re-inject identity on session resume | Wastes tokens, may contradict earlier context | Resume injects only: spine + mandate + correction |
| 3 | DON'T inject Handoff for reviewers | Reviewers must evaluate cold, without knowing what previous agent intended | Reviewer gets: identity + constraint + spine + skill + mandate (no handoff) |
| 4 | DON'T inject Skill for Tier 0 tasks | Fast-path bypass. No assembly pipeline. 50ms. | Tier 0 goes direct to ChatGPT with raw user message |
| 5 | DON'T truncate error output from the middle | Error type is at top, stack trace root is at bottom. Middle is noise. | Keep first 2000 chars + last 2000 chars |
| 6 | DON'T inject more than 4700 tokens of overhead | Leaves insufficient working budget for the agent | Token budgets are hardcoded per source |
| 7 | DON'T cache Spine between injections | Even 30 seconds of staleness causes scope enforcement false positives | Fresh Spine build per injection, always |
| 8 | DON'T put corrections in the Identity section | Pollutes the agent's base personality with error-specific context | Correction is ALWAYS the last section |
| 9 | DON'T let agents self-inject (write to their own prompt) | Agent modifying its own instructions = hallucination amplification | All injection flows through the Assembly Pipeline, external to agent |
| 10 | DON'T retry auth errors with mutation | Auth failure is environmental, not prompt-related | Same prompt, new auth token |

---

## 8. Scenario Catalog

### Scenario 1: Happy Path (No Failures)

```
User: "Build me a candle store"
  │
  ├─ Intake [dom:chatgpt] ← identity + mandate
  │    User answers 4 questions. Brief produced.
  │
  ├─ Conductor [stdin:codex] ← identity + spine
  │    Classifies Tier 3. Produces 9-step DAG.
  │
  ├─ Step 1: Scaffold [stdin:codex] ← identity + constraint + spine + skill(scaffold) + mandate
  │    Creates project structure. Bodyguard: files exist ✅
  │
  ├─ Step 2: Research [dom:chatgpt] ← identity + constraint + spine + skill(researcher) + mandate + handoff
  │    Gathers competitor data. PA compresses for Step 3.
  │
  ├─ Step 3: Build Homepage [stdin:codex] ← identity + constraint + spine + skill(frontend+executor) + mandate + handoff
  │    Creates homepage. Bodyguard: files ✅, tests ✅, scope ✅
  │
  │ ... (Steps 4-8 follow same pattern)
  │
  ├─ Step 9: Deploy [stdin:codex] ← identity + constraint + spine + skill(deploy) + mandate + handoff
  │    Deploys to Vercel. Bodyguard: secrets ✅, health ✅
  │
  └─ Archive [stdin:claude] ← identity + spine + skill(archivist) + execution log
       Produces PROJECT-ARCHIVE.md + llms.txt
```

### Scenario 2: Step Failure → Mutation → Recovery

```
Step 3: Build Homepage
  │
  ├─ Attempt 1: [stdin:codex]
  │    Sources: identity + constraint + spine + skill + mandate + handoff
  │    Agent creates Hero.tsx, misses form validation
  │    Bodyguard: files ✅, tests ❌ (TypeError: email undefined)
  │    → CAPTURE: stderr, exit code 1, bodyguard results, spine delta
  │
  ├─ Attempt 2: [stdin:codex] (MUTATED)
  │    Sources: identity + constraint + spine(REFRESHED) + skill + mandate + handoff
  │      + CORRECTION: "TypeError at Hero.tsx:14, tests failed, add useState for form"
  │    Prompt hash: different from attempt 1 ✅
  │    Agent creates Hero.tsx with useState, form validates
  │    Bodyguard: files ✅, tests ✅, scope ✅
  │    → PASS. Continue to Step 4.
```

### Scenario 3: Rate Limit → Defer → Resume

```
Step 5: Generate Images [dom:chatgpt]
  │
  ├─ Inject prompt into ChatGPT
  │    DOM capture detects: "You've reached your message limit"
  │    ErrorType: RATE_LIMITED
  │    Recovery: defer_and_continue
  │
  ├─ Step 5 deferred. Steps 6-7 (CLI-only) continue on Codex.
  │    Cron polls every 60s: is ChatGPT available?
  │
  ├─ 45 minutes later: Cron detects limit lifted
  │    Step 5 resumes with SAME prompt (no mutation — prompt wasn't the problem)
  │    Images generated. Step 5 complete.
  │
  └─ Step 8 can now proceed (depended on Step 5 + Step 7).
```

### Scenario 4: Auth Expired Mid-Build

```
Step 6: Deploy to Vercel [stdin:codex]
  │
  ├─ Codex spawns with env: VERCEL_TOKEN=abc123
  │    Vercel CLI returns: "Error: Invalid token"
  │    ErrorType: AUTH_EXPIRED
  │    Recovery: reauth_and_retry (no prompt mutation)
  │
  ├─ System triggers Vercel re-auth flow in browser
  │    User re-authenticates (or token auto-refreshes)
  │    New token: VERCEL_TOKEN=xyz789
  │
  ├─ Retry Step 6 with identical prompt + new env
  │    Deploy succeeds. Bodyguard: health check ✅
```

### Scenario 5: Retraction (Late Discovery)

```
Step 3: Build ContactForm (passes bodyguard)
Step 4: Build API Route (passes bodyguard)
Step 5: Integration Test
  │
  ├─ Tests fail: ContactForm sends wrong field names to API
  │    Debugger isolates: Step 3 used "user_email", API expects "email"
  │    ErrorType: CODE_ERROR, root cause: Step 3
  │
  ├─ RETRACTION:
  │    git revert Step 3 commits
  │    Re-plan Steps 3-5
  │
  ├─ Step 3 v2: [stdin:codex] (DOUBLE CORRECTION)
  │    Correction 1: Original bodyguard results from first Step 3
  │    Correction 2: "Your output used 'user_email' but the API expects 'email'.
  │                   Match field names to: src/api/contact/route.ts schema."
  │    Agent produces corrected ContactForm
  │
  ├─ Steps 4-5 re-execute with updated context
```

### Scenario 6: Context Overflow → Warden Kill → Respawn

```
Conductor session running for 35 minutes
  │
  ├─ Cron (30s interval) checks token usage
  │    Conductor: 89,000 / 128,000 tokens (69.5%)
  │    Model: gpt-4o, threshold: 60%
  │    Task progress: 0.60 (Step 6 of 10)
  │    0.60 < 0.85 grace threshold → KILL
  │
  ├─ Context Warden:
  │    1. Snapshot current Spine (truth file)
  │    2. Snapshot DAG progress (which steps complete)
  │    3. SIGTERM Conductor process
  │    4. Wait 5s grace
  │    5. SIGKILL if still alive
  │
  ├─ Fresh Conductor spawn:
  │    Sources: identity + spine(FULL, includes DAG progress)
  │    + RESUME CONTEXT: "You are resuming a build. Steps 1-5 complete.
  │      Current step: 6. Remaining: 6-10. DO NOT re-plan completed steps."
  │    New session, fresh context window, full token budget
  │
  └─ Build continues from Step 6 with no loss of progress
```

---

## 9. File Reference

### 9.1 Assembly Pipeline

| File | Purpose |
|------|---------|
| `src/prompt-assembler/assemble.ts` | Main assembly function. Composes 7 sources into single prompt. |
| `src/prompt-assembler/truncate.ts` | Token estimation and truncation per source budget. |
| `src/prompt-assembler/sources/identity.ts` | Loads agent identity file by role name. |
| `src/prompt-assembler/sources/skill.ts` | Calls Skill Injector, loads matched skill. |
| `src/prompt-assembler/sources/spine.ts` | Fetches fresh Spine snapshot, formats for prompt. |
| `src/prompt-assembler/sources/mandate.ts` | Formats DAG step into mandate block. |
| `src/prompt-assembler/sources/handoff.ts` | Formats PA output into handoff block. |
| `src/prompt-assembler/sources/correction.ts` | Mutation Engine. Builds correction from error context. |
| `src/prompt-assembler/sources/constraint.ts` | Builds tool/scope/env constraint block. |

### 9.2 Delivery Channels

| File | Purpose |
|------|---------|
| `src/adapters/delivery/stdin-delivery.ts` | CLI stdin pipe for Codex, Claude Code, Gemini. |
| `src/adapters/delivery/dom-delivery.ts` | ChatGPT DOM paste via Electron BrowserView. |
| `src/adapters/delivery/api-delivery.ts` | Future API direct calls. |
| `src/adapters/delivery/resume-delivery.ts` | Session resume for persistent agents. |

### 9.3 Error Capture

| File | Purpose |
|------|---------|
| `src/error-capture/capture.ts` | Captures stdout, stderr, exit code on agent death. |
| `src/error-capture/classify.ts` | Classifies error type from exit code + stderr patterns. |
| `src/error-capture/recover.ts` | Routes error type to recovery action. |
| `src/error-capture/retraction.ts` | Git revert + re-plan for late-discovered failures. |

### 9.4 Supporting

| File | Purpose |
|------|---------|
| `src/skill-injector/match.ts` | Trigger matching algorithm (tokenize + score + threshold). |
| `src/spine/spine-builder.ts` | Filesystem scan → SPINE.md → prompt-ready format. |
| `src/utils/dom-selectors.ts` | ChatGPT DOM selector chains (update when DOM changes). |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Prompt Assembly** | The synchronous pipeline that composes 7 sources into one complete prompt |
| **Prompt Delivery** | The channel-specific mechanism that physically injects the prompt into a runtime |
| **Injection Source** | One of 7 categories of content composed into the final prompt |
| **Mutation Engine** | The component that builds Correction blocks on retry, ensuring no two attempts use identical prompts |
| **Correction Block** | Error context injected on retry: what failed, what bodyguard caught, what spine shows, what approach was tried |
| **Retraction** | Git-reverting a step's output when a later step reveals it was incorrect |
| **Injection Log** | Timestamped record of exactly what was injected, through which channel, with what token count and hash |
| **Prompt Hash** | SHA-256 of the assembled prompt. If consecutive attempts have the same hash, the system has failed to mutate. |
| **Working Budget** | Model effective tokens minus injection overhead. The space agents have for thinking and output. |
| **Channel** | The physical mechanism: stdin pipe, DOM paste, API body, or session resume |
| **One-Shot Kill** | The principle that proper injection enables first-attempt success by pre-loading the agent with complete context |
| **Circular Failure** | When identical prompts produce identical failures on retry. The Mutation Engine exists to prevent this. |

---

*This document is the authoritative reference for prompt injection architecture. All injection flows must conform to the assembly pipeline, delivery channels, and mutation rules documented here. No agent receives a prompt that was not assembled by this system.*
