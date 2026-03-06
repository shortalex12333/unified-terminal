# Agent Onboarding — CONDUCTOR System

**Paste this entire document to any Claude agent working on the CONDUCTOR routing system.**

---

# PART 1: OPERATING FRAMEWORK

## The Four Modes

You operate in **four modes**. Never mix them. Complete each before moving to next.

| Mode | What You Do | What You DON'T Do |
|------|-------------|-------------------|
| **PLANNER** | Create plan, list files, define criteria | Write code |
| **EXECUTION** | Implement only what's planned, stay in scope | Modify unplanned files |
| **VERIFICATION** | Test, prove it works, check for drift | Assume it works |
| **HISTORIAN** | Write structured lesson, capture patterns | Skip documentation |

## The Three Rules

1. **Plan First** — No code without approved plan
2. **Verify Always** — Prove it works with evidence
3. **Learn Forever** — Structured lesson after every task

## File Organization Rules

| Forbidden | Required |
|-----------|----------|
| `_v1`, `_v2`, `_final`, `_old` suffixes | Clear, purpose-driven names |
| `utils.ts`, `helpers.ts` | Import, don't copy |
| Create file in wrong place | Right location from start |

---

# PART 2: PROJECT CONTEXT

## Project Goal

Intelligent message routing system that intercepts user messages in ChatGPT, classifies them via a persistent Codex session, and routes to appropriate executors (web, CLI, hybrid).

```
USER MESSAGE (ChatGPT input)
     │
     ├── SEND INTERCEPTOR
     │   Captures messages before ChatGPT receives them
     │
     ├── TIER 0: FAST-PATH (<50ms, no LLM)
     │   Trivial messages → direct to ChatGPT
     │
     ├── TIER 1: CONDUCTOR (persistent Codex session)
     │   Complex messages → JSON DAG execution plan
     │
     └── TIER 3: EXECUTORS
         WebExecutor │ CLIExecutor │ ServiceExecutor
```

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Core Architecture | ✅ Complete |
| 2 | Fast-Path (Tier 0) | ✅ Complete |
| 3 | Conductor (Tier 1) | ✅ Complete |
| 4 | Executors (Tier 3) | ✅ Complete |
| 5 | Send Interceptor | ✅ Complete |
| 6 | Tests (238+) | ✅ Complete |
| 7 | Integration Verified | ✅ Complete |

## Known Gaps / Blockers

| ID | Description | Impact | Fix |
|----|-------------|--------|-----|
| GAP-001 | `codex resume --json` flag doesn't exist | Session resumption must parse text output | Monitor Codex CLI updates |
| GAP-002 | Rate limit patterns are estimated | May miss some rate limit responses | Tune patterns based on real usage |

## Key Files

### Conductor System (src/main/)

| File | Purpose |
|------|---------|
| `fast-path.ts` | Tier 0: 50ms regex-based bypass for trivial messages |
| `conductor.ts` | Tier 1: Persistent Codex session for classification |
| `step-scheduler.ts` | DAG executor with circuit breaker (MAX_RETRIES=3) |
| `rate-limit-recovery.ts` | Rate limit detection, deferral, auto-resume |
| `send-interceptor.ts` | DOM-level message interception in ChatGPT |

### Executors (src/main/executors/)

| File | Purpose |
|------|---------|
| `cli-executor.ts` | Spawns `codex --full-auto` for CLI tasks |
| `web-executor.ts` | ChatGPT DOM injection + DALL-E image extraction |
| `service-executor.ts` | Service guides + connection waiting |
| `index.ts` | Executor exports |

### Modified Files

| File | Changes |
|------|---------|
| `index.ts` | Conductor imports, IPC handlers, interceptor installation |
| `preload.ts` | routeMessage API, step progress events |

### Tests (tests/)

| File | Tests | Purpose |
|------|-------|---------|
| `fast-path.test.ts` | 92 | Tier 0 bypass logic |
| `conductor.test.ts` | 63 | Tier 1 routing |
| `step-scheduler.test.ts` | 83 | DAG execution |
| `integration-check.ts` | - | Comprehensive system verification |

## Key Types / Interfaces

```typescript
// Fast-path result
type FastPathResult = 'bypass_to_chatgpt' | 'send_to_tier1';

// Execution plan from conductor
interface ExecutionPlan {
  route: 'web' | 'cli' | 'hybrid';
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  estimated_minutes: number;
  plan: Step[];
}

// Step in execution DAG
interface Step {
  id: string;
  type: 'web' | 'cli' | 'service';
  description: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'done' | 'failed' | 'needs_user';
  retryCount: number;
}

// Send interceptor result
interface InterceptionResult {
  intercepted: boolean;
  text: string;
  route?: 'web' | 'cli' | 'hybrid';
  plan?: ExecutionPlan;
  error?: string;
}
```

---

# PART 3: GUARDRAILS (Non-Negotiable)

1. **No shell injection** — All user input must use `escapeForShell()` before CLI commands
2. **No innerHTML** — Use textContent/DOM manipulation for security
3. **Session persistence** — Conductor session ID stored in StateManager
4. **Circuit breaker** — MAX_RETRIES = 3 before asking user
5. **Fresh context per executor** — Each step spawns new process

---

# PART 4: LESSONS REFERENCE

**Project lessons:** `tasks/lessons.md`

Read this file before starting any task. Add lessons after completing tasks.

Key lessons for this project:
- `codex resume --json` flag doesn't exist (use text parsing)
- macOS doesn't have `timeout` command (use background process + kill)
- innerHTML triggers security warnings (use textContent + DOM API)
- execSync is vulnerable to injection (use execFileSync with args array)

---

# PART 5: LOCAL DEVELOPMENT

## Run Development Server

```bash
cd /Users/celeste7/Documents/unified-terminal
npm run dev
```

## Run Tests

```bash
# Fast-path tests (92 tests)
npx ts-node tests/fast-path.test.ts

# Conductor tests (63 tests)
npx ts-node tests/conductor.test.ts

# Step scheduler tests (83 tests)
npx ts-node tests/step-scheduler.test.ts

# Comprehensive system check
npx ts-node tests/integration-check.ts

# Build TypeScript
npm run build:main
```

## Verify Conductor Working

```bash
# Start app
npm run dev

# Watch logs for:
# [SendInterceptor] IPC handlers registered
# [SendInterceptor] Interceptor installed successfully
# [SendInterceptor] Routing message: ...
# [Conductor] Session created: ...
```

---

# PART 6: COMMANDS

## Testing

```bash
npx ts-node tests/integration-check.ts   # Full system verification
npm run build:main                        # Compile TypeScript
npm run dev                               # Run in development
```

## Git

```bash
git status                                # Check what's changed
git diff                                  # Review changes
git add -A && git commit -m "..."         # Commit
```

---

# PART 7: TASK TEMPLATE

## Task: [DESCRIBE TASK]

**Context:**
- Project: unified-terminal CONDUCTOR system
- Current state: [what exists now]
- Goal: [end state you want]

**Constraints:**
- Scope: [specific files only]
- Tech: TypeScript, Electron, Codex CLI
- Priority: [Low/Medium/High/Critical]

**Start in PLANNER MODE:**
1. Read relevant documentation in `docs/ONGOING_WORK/CONDUCTOR /`
2. List all files that will change
3. Define acceptance criteria
4. Write plan to tasks/todo.md
5. Wait for my approval

**Do not write code until plan is approved.**

**After completion:**
1. Run `npx ts-node tests/integration-check.ts`
2. Write structured lesson to tasks/lessons.md
3. Update project documentation

---

# EXAMPLE TASKS

## Example 1: Add New Executor Type

```markdown
## Task: Add a "research" executor for web search tasks

**Context:**
- Project: unified-terminal CONDUCTOR system
- Current state: 3 executors exist (cli, web, service)
- Goal: Add 4th executor for research/web search tasks

**Constraints:**
- Scope: src/main/executors/research-executor.ts (new), executors/index.ts
- Tech: TypeScript
- Priority: Medium

**Start in PLANNER MODE:**
1. Review existing executor patterns in cli-executor.ts
2. Define research executor interface
3. List files to modify
4. Wait for approval
```

## Example 2: Fix Rate Limit Detection

```markdown
## Task: Improve rate limit detection patterns

**Context:**
- Project: unified-terminal CONDUCTOR system
- Current state: Basic regex patterns in rate-limit-recovery.ts
- Goal: Better detection of ChatGPT rate limit responses

**Constraints:**
- Scope: src/main/rate-limit-recovery.ts only
- Tech: TypeScript
- Priority: Medium

**Start in PLANNER MODE:**
1. Research ChatGPT rate limit message formats
2. Update PATTERNS constant
3. Add unit tests
4. Wait for approval
```

---

# CONFIRMATION

Before starting, confirm:

1. [x] I understand the 4-mode methodology
2. [x] I know the current phase status (ALL COMPLETE)
3. [x] I know the key files to modify
4. [x] I will run integration-check.ts after changes
5. [x] I will write lessons after completing tasks

**State which mode you are starting in.**
