⏺ Here's the full picture of what we've built and how every piece connects.
                                              
  ---                                                
  The 30,000-Foot View            

  A user types a message into ChatGPT's BrowserView. Before that message reaches ChatGPT, our system intercepts it,        
  classifies it, potentially routes work to CLI agents (Codex or Claude Code), enforces safety rails at every step, and
  delivers results back to the user.                                                                                       
                                                                                                      
  Two runtimes, one enforcement layer:         

  ┌────────────┬───────────────────────────────────────────────────────────────────────────┬───────────────────────────┐
  │  Runtime   │                               How It Works                                │           Model           │
  ├────────────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────┤
  │ Codex CLI  │ We spawn codex as a child process, pipe prompts via stdin, parse JSONL    │ gpt-5-codex (400K         │
  │            │ output                                                                    │ context)                  │
  ├────────────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────┤
  │ Claude     │ Native runtime — it IS the environment we're running in, no adapter       │ opus-4.6 / sonnet-4.6     │
  │ Code       │ needed                                                                    │                           │
  └────────────┴───────────────────────────────────────────────────────────────────────────┴───────────────────────────┘

  Both runtimes go through the exact same enforcement pipeline. No exceptions.

  ---
  The Full Flow (10 Steps)

  When the Conductor decides a task needs CLI work, it creates a DAG (directed acyclic graph) of steps. Each step goes
  through this:

  USER MESSAGE
       │
       ▼
  ┌─────────────────────────────────┐
  │  SEND INTERCEPTOR               │  Captures message before ChatGPT sees it
  │  (src/main/send-interceptor.ts) │
  └────────────┬────────────────────┘
               │
               ▼
  ┌─────────────────────────────────┐
  │  TIER 0: FAST-PATH              │  Pattern match. "hello" → straight to ChatGPT
  │  (src/main/fast-path.ts)        │  No LLM call. <50ms.
  └────────────┬────────────────────┘
               │ (non-trivial messages)
               ▼
  ┌─────────────────────────────────┐
  │  TIER 1: CONDUCTOR              │  Persistent Codex session classifies the task.
  │  (src/main/conductor.ts)        │  Returns a JSON DAG: [{action, runtime, detail}]
  └────────────┬────────────────────┘
               │
               ▼
  ┌─────────────────────────────────┐
  │  STEP SCHEDULER                 │  Executes each DAG step through the
  │  (src/main/step-scheduler.ts)   │  10-step enforcement flow below ▼
  └─────────────────────────────────┘

  The 10 Steps Inside executeStep()

  Every single step — whether it's "write a React component" or "run the tests" — goes through ALL of these:

  Step 1: PRE-SPINE
      │   Snapshot the project state (files, git status, DAG progress)
      │   This is the "before picture"
      │
  Step 2: SKILL SELECTION (agent-based)
      │   Spawn a ~400-token Codex agent that reads the task description
      │   + a catalog of available skills, picks 0-3 that apply.
      │   FALLBACK: keyword matching if Codex is unavailable.
      │
  Step 3: SKILL VALIDATION
      │   Token budget check. Are the selected skills within limits?
      │   Tier 0-1 gets max 1 skill. Tier 2 gets 2. Tier 3 gets 3.
      │
  Step 4: PROMPT ASSEMBLY
      │   Combine: system prompt + spine context + skill guidance
      │   + task instructions into one prompt. 80K token ceiling.
      │   If over budget, skill sections get truncated first.
      │
  Step 5: PRE-GATE (Bodyguard)
      │   Run ALL applicable enforcement checks IN PARALLEL.
      │   Which checks run depends on: action type, tier, whether
      │   code was modified, frontend status.
      │   Verdict: PASS → continue. HARD_FAIL → stop. SOFT_FAIL → warn.
      │
  Step 6: EXECUTE
      │   Actually spawn the agent (Codex CLI or Claude Code)
      │   with the assembled prompt. Wait for completion.
      │
  Step 7: NORMALIZE
      │   Convert raw agent output into a standard format.
      │   Extract: files changed, commands run, errors, warnings.
      │
  Step 8: POST-SPINE
      │   Snapshot project state AGAIN (the "after picture")
      │   Compare with pre-spine to detect what changed.
      │
  Step 9: POST-GATE (Bodyguard again)
      │   Run enforcement checks on the RESULT.
      │   Did the agent break something? Did tests fail?
      │   Same parallel execution, same verdict system.
      │
  Step 10: SKILL VERIFY
          Parse verify blocks from selected skills.
          Run whitelisted commands (git diff, find, wc, etc.)
          to confirm the agent followed skill guidance.

  ---
  Deep Dive: Each Component

  1. Adapters — How We Talk to Runtimes

  src/adapters/codex/adapter.ts — The Codex translator

  Your code calls:  adapter.spawn(config)

  What actually happens:
  1. Builds CLI args: codex --model gpt-5-codex --full-auto --json
  2. Adds sandbox mode (--sandbox=docker or network-only or none)
  3. Adds tool permissions (--tool sysop --tool bash etc.)
  4. Validates prompt size (rejects if > 100K tokens)
  5. Spawns child process via Node's spawn()
  6. Pipes the assembled prompt to stdin
  7. Parses JSONL output line by line
  8. Returns an AgentHandle with:
     - onComplete(): Promise<AgentResult>  — wait for finish
     - onProgress(cb): void               — stream progress
     - kill(): void                        — abort with SIGTERM→SIGKILL

  Why Claude Code doesn't need an adapter: Claude Code IS the runtime. When we need Claude Code to do something, we're
  already running inside it. It's like asking "how does the CPU talk to itself?" — it doesn't need to.

  The factory pattern:
  getAdapter('codex')  → returns CodexAdapter singleton
  getAdapter('codex')  → returns SAME instance (cached)

  2. Enforcement — The Hardcoded Rails

  This is the heart of Instance 3/4. Three components:

  Spine (State Snapshots)

  src/enforcement/spine.ts

  buildSpine() captures:
  ├── File inventory (find . -type f, excluding node_modules/.git)
  ├── Git status (branch, uncommitted, untracked)
  ├── DAG progress (total steps, completed, failed, current)
  └── Timestamp

  compareSpines(before, after) returns:
  ├── filesAdded: string[]
  ├── filesModified: string[]
  ├── filesRemoved: string[]
  ├── gitChanges: { before vs after }
  ├── testStateChanged: boolean   (did test files change?)
  └── buildStateChanged: boolean  (did build output change?)

  Why this matters: The spine is how we detect what an agent actually DID vs what it was told to do. If a step says "edit
  src/foo.ts" but the agent also modified "src/auth.ts", the post-spine comparison catches that.

  Bodyguard (The Gate)

  src/enforcement/bodyguard.ts

  The bodyguard decides WHICH checks run based on context:

  EVERY step gets:        lint-check, type-check
  Code was modified:    + test-run, security-scan
  Tier 2+:              + coverage-check, bundle-size
  Post-build:           + artifact-verify
  Pre-deploy:           + staging-test, rollback-plan
  Frontend:             + lighthouse, a11y-check

  Then runs them ALL IN PARALLEL via Promise.allSettled(). Not sequential. If you have 6 checks, they all start
  simultaneously.

  Batching prevents resource exhaustion:
  MAX_PARALLEL_CHECKS = 4

  If 6 checks needed:
    Batch 1: [lint, type, test, security]     ← parallel
    Batch 2: [coverage, bundle-size]          ← parallel (after batch 1)

  Timeout budget tracks across batches:
  Total budget: 30 seconds
  Batch 1 takes 12 seconds → 18 seconds remaining
  Batch 2 gets 18/2 = 9 seconds per check (min 1 second)

  Enforcer (Check Execution)

  src/enforcement/enforcer.ts

  Runs a single check. Two modes:

  1. Python scripts: python3 checks/check_lint.py /project/dir
    - Exit 0 = pass, non-zero = fail
    - Timeout kills with SIGTERM
  2. Inline commands: find . -name "*.test.*" | wc -l
    - For lightweight checks defined in constants
    - Uses execFile("/bin/sh", ["-c", command]) — NOT exec()
    - Commands come from hardcoded constants, never user input

  Retry logic: Each check has a retry policy:
  ENFORCER_RETRY_POLICIES = {
    'lint-check':     { attempts: 1, delayMs: 0,    confidence: 'definitive' },
    'test-run':       { attempts: 2, delayMs: 1000, confidence: 'definitive' },
    'security-scan':  { attempts: 1, delayMs: 0,    confidence: 'heuristic' },
  }

  - Definitive confidence = HARD_FAIL if it fails (blocks execution)
  - Heuristic confidence = SOFT_FAIL (warns but continues)

  3. Skills — What the Agent Knows

  Skills are markdown files that contain guidance for specific task types. Think of them as "cheat sheets" injected into
  the agent's prompt.

  Example skill: resources/skills/tdd-guide.md
  # TDD Guide
  Write the failing test FIRST. Run it. Then write minimal implementation.
  Never skip the red-green-refactor cycle.

  ## verify
  ```json
  { "check": "find . -name '*.test.*' -newer src/ | wc -l" }

  #### Skill Selection (Agent-Based)
  **`src/skills/selector.ts`**

  This is the CRITICAL architectural piece. Two paths:

  **PRIMARY (Agent-Based):**
  1. Load trigger-map.json (skill catalog)
  2. Spawn a ~400-token Codex agent with:
    - System: "You are a Skill Selector. Pick 0-3 skills."
    - User: Task description + available skills list
  3. Agent returns JSON: { "skills": ["tdd-guide.md"], "reasoning": "..." }
  4. Validate: every path must exist in catalog (hallucination guard)
  5. Return with [agent] prefix in reasoning

  **FALLBACK (Keyword Matching):**
  If Codex unavailable OR agent spawn fails OR output unparseable:
  1. Tokenize task description
  2. Score each skill by keyword overlap
  3. Return top N matches with [keyword-fallback] prefix

  **Why agent-based matters:** Keywords can't understand "refactor the auth module to use JWT" should get the
  security-reviewer skill. An agent can. Keywords match tokens; agents understand intent.

  #### Skill Validation
  **`src/skills/validator.ts`**

  After selection, validation enforces:
  - Token budget (skills can't consume more than their allocation)
  - Tier limits (simple tasks don't get overloaded with guidance)
  - Path verification (skill files must actually exist)

  #### Verify Sandbox
  **`src/skills/verify-sandbox.ts`**

  Skills can include `## verify` blocks with commands to run after execution. But we can't let skills run arbitrary
  commands. The sandbox enforces:

  ALLOWED: git, find, wc, ls, cat, test, grep, head, tail, stat, diff
  BLOCKED: rm, mv, cp, chmod, chown, kill, sudo, curl, wget, npm, node

  If a verify command contains a blocked command, it's rejected with a reason.

  ### 4. Glue — Connecting Everything

  #### Prompt Assembly
  **`src/glue/assemble-prompt.ts`**

  Takes all the pieces and builds the final prompt:

  ┌─────────────────────────────────────────────┐
  │ SYSTEM PROMPT                               │
  │ "You are a coding agent. Follow these       │
  │  skills exactly..."                         │
  ├─────────────────────────────────────────────┤
  │ SPINE CONTEXT (XML format)                  │
  │                                      │
  │                        │
  │        │
  │   │
  │                                     │
  ├─────────────────────────────────────────────┤
  │ SKILL SECTIONS                              │
  │ --- tdd-guide.md ---                        │
  │ Write failing test first...                 │
  │ --- security-reviewer.md ---                │
  │ Check for injection vulnerabilities...      │
  ├─────────────────────────────────────────────┤
  │ TASK INSTRUCTIONS                           │
  │ "Write a login endpoint that validates      │
  │  JWT tokens and returns user profile"       │
  └─────────────────────────────────────────────┘

  Total: ≤ 80,000 tokens (skills truncated first if over)

  #### Result Normalization
  **`src/glue/normalizer.ts`**

  After the agent finishes, raw output gets normalized into `GateCheckInput`:

  ```typescript
  {
    stepId: "3",
    action: "execute",
    output: "Created src/auth/login.ts with JWT validation...",
    filesChanged: ["src/auth/login.ts", "tests/auth/login.test.ts"],
    exitCode: 0,
    runtimeUsed: "codex",
    // ... used by post-gate bodyguard
  }

  ---
  What This Prevents

  Prompt Injection

  An agent can't escape its rails because:
  1. Skills are loaded from local files, not from agent output
  2. Verify commands run through a sandbox allowlist
  3. The prompt is assembled by our code, not by the agent
  4. Post-gate checks run after execution to catch damage

  Scope Creep

  1. Pre-spine captures "before" state
  2. Post-spine captures "after" state
  3. compareSpines() detects files the agent touched that weren't in scope
  4. Post-gate bodyguard can HARD_FAIL if unauthorized files changed

  Silent Failures

  1. Every check has a confidence level (definitive vs heuristic)
  2. Definitive failures block execution — no "it probably worked"
  3. checkCompliance() verifies enough checks ran to produce a valid verdict
  4. If all checks timed out, the gate does NOT auto-pass

  Resource Exhaustion

  1. Prompt size capped at 80K tokens (of 400K context)
  2. Gate timeout budget tracked across batches with 1s minimum per check
  3. Agent spawn timeout: 15 seconds for skill selector
  4. Circuit breaker in step-scheduler: too many failures → stop the DAG

  Agent Hallucination (Skill Selection)

  1. Agent picks skills by path from a catalog
  2. Every path is validated against the catalog — fake paths rejected
  3. If agent returns paths not in catalog, entire selection is thrown out
  4. Falls back to keyword matching (dumber but deterministic)

  ---
  The Two Runtimes in Practice

  Codex Path

  User: "Add input validation to the signup form"
    → Conductor: { action: "codex_build", runtime: "codex", detail: "..." }
    → Adapter: codex --model gpt-5-codex --full-auto --json
    → Skills: [form-validation.md, security-reviewer.md]
    → Pre-gate: lint ✅, type-check ✅
    → Execute: Codex writes code
    → Post-gate: test-run ✅, security-scan ✅
    → Verify: "find . -name '*.test.*' | wc -l" → 3 test files ✅

  Claude Code Path

  User: "Research the best auth library for Node.js"
    → Conductor: { action: "research", runtime: "claude-code" }
    → Claude Code is native — no spawn needed
    → Skills: [research.md]
    → Pre-gate: (minimal for research tasks)
    → Execute: Claude Code does research natively
    → Post-gate: (minimal)
    → Result delivered to user

  ChatGPT Web Path (No Enforcement)

  User: "Generate an image of a sunset"
    → Fast-path or Conductor: { action: "web_chat", runtime: "chatgpt" }
    → Web Executor injects message into ChatGPT DOM
    → ChatGPT generates image via DALL-E
    → No enforcement needed (no code, no files)

  ---
  Summary

  ┌───────────────────┬───────────────────────────────────────────────────────────────────────────┐
  │      Concern      │                             How It's Handled                              │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Agent assignment  │ Conductor classifies → DAG step has runtime field                         │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Role enforcement  │ Skills inject role-specific guidance into prompt                          │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Spawn safety      │ try-catch + timeout + SIGTERM→SIGKILL escalation                          │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Hardcoded rails   │ Constants in enforcement/constants.ts — no magic numbers                  │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Prompt injection  │ Skills from local files, verify through sandbox, prompt assembled by code │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Scope detection   │ Pre/post spine comparison catches unauthorized changes                    │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Quality gates     │ Bodyguard runs checks in parallel, blocks on HARD_FAIL                    │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Token budget      │ 80K ceiling, skills truncated first, prompt validated before spawn        │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Failure recovery  │ Circuit breaker, retry policies, rate-limit deferral                      │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ Progress tracking │ DAG progress passed to spine from scheduler's live state                  │
  └───────────────────┴───────────────────────────────────────────────────────────────────────────┘

  Every message flows through the same pipeline. No shortcuts. No "trust the agent." Agent selects, code enforces.