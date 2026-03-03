# THE CONDUCTOR — Final Architecture
## Replaces: regex task-router.ts, heuristic classification, static routing
## Status: LOCKED FOR MVP

---

## CONSTRAINTS

1. $0 compute. Users have ChatGPT Plus ($20 flat) + CLI tools authenticated via OAuth (Gate 6). No API keys. No per-token budget.
2. Latency is a metric, not a target. 3s routing overhead is noise against 25s image gen or 30min builds.
3. Sequential for MVP. Everything flows through Tier 1. Parallel execution is future.
4. Users do mega builds. Quick questions go to ChatGPT directly via fast-path bypass.

---

## THREE-TIER ARCHITECTURE

```
APP LAUNCH
     |
     |-- TIER 0: FAST-PATH (local, 50ms, no LLM)
     |   Catches trivial messages, sends direct to ChatGPT
     |
     |-- TIER 1: ROUTER (persistent Codex session, background)
     |   Classifies everything else -> web / cli / hybrid
     |   Returns execution plan as JSON DAG
     |
     |-- TIER 2: PLANNER (fresh session per project, complex only)
     |   Detailed execution planning
     |   Only for complexity: complex
     |
     +-- TIER 3: EXECUTORS (spawned per step)
         ChatGPT BrowserView (web tasks)
         Codex --full-auto (code tasks)
         Service guides (connect accounts)
```

### Visual Flow

```
+---------------------------------------------------------------------------+
| TIER 0: FAST-PATH (no LLM, 50ms)                                         |
|                                                                           |
| User message -> local heuristic:                                          |
|   Short + question mark + no action verbs -> BYPASS to ChatGPT            |
|   Greeting/thanks/yes/no -> BYPASS to ChatGPT                             |
|   Everything else -> Tier 1                                                |
+---------------------------------+-----------------------------------------+
                                  | (non-trivial only)
                                  v
+---------------------------------------------------------------------------+
| TIER 1: ROUTER (persistent Codex session)                                 |
|                                                                           |
| First launch:  codex exec --json "You are the router..." -> save ID      |
| Every launch:  codex resume <session_id> --json                           |
|                                                                           |
| Already knows: tools, MCPs, web-only features                             |
| Classification: ~3 seconds                                                |
|                                                                           |
| Input:  user message + file list + project state                          |
| Output: JSON execution plan (DAG with dependencies)                       |
|                                                                           |
| EVERYTHING non-trivial flows through here.                                |
+---------------------------------+-----------------------------------------+
                                  |
                                  v
+---------------------------------------------------------------------------+
| TIER 2: PLANNER (only for complex tasks)                                  |
|                                                                           |
| codex --full-auto -C /path/to/project --json                              |
| Expands Tier 1 high-level plan into concrete file operations              |
| Skipped for trivial/simple/medium tasks                                    |
+---------------------------------+-----------------------------------------+
                                  |
                                  v
+---------------------------------------------------------------------------+
| TIER 3: EXECUTORS                                                         |
|                                                                           |
| +----------------+  +----------------+  +----------------+                |
| | ChatGPT        |  | Codex Agent    |  | Codex Agent    |                |
| | (BrowserView)  |  | --full-auto    |  | --full-auto    |                |
| |                |  | -C /project    |  | -C /project    |                |
| | Intake quiz    |  | Scaffold       |  | Build pages    |                |
| | DALL-E images  |  | Code gen       |  | Integrate APIs |                |
| | Web search     |  | File creation  |  | Tests          |                |
| | Content        |  | Git ops        |  | Bug fixes      |                |
| +----------------+  +----------------+  +----------------+                |
|                                                                           |
| Each executor reports status back to Tier 1 for re-planning               |
| Failed steps -> Tier 1 decides: retry, skip, or ask user                  |
| Rate-limited web -> defer web steps, continue CLI steps                   |
+---------------------------------------------------------------------------+
```

---

## TIER 0: FAST-PATH

Local heuristic. No network. No AI. Pattern match to catch obvious non-project messages.

```typescript
// src/main/fast-path.ts

const ACTION_VERBS = [
  'build', 'create', 'make', 'generate', 'write', 'code', 'develop',
  'deploy', 'launch', 'setup', 'install', 'automate', 'scrape',
  'design', 'scaffold', 'implement', 'fix', 'debug', 'refactor',
];

function fastPathCheck(message: string): 'bypass_to_chatgpt' | 'send_to_tier1' {
  const m = message.trim();

  // Greetings, confirmations
  if (/^(hi|hello|hey|thanks|thank you|ok|sure|yes|no|got it|cool|nice|great)/i.test(m)) {
    return 'bypass_to_chatgpt';
  }

  // Short questions without action verbs
  if (m.length < 120 && m.endsWith('?') && !ACTION_VERBS.some(v => m.toLowerCase().includes(v))) {
    return 'bypass_to_chatgpt';
  }

  // Continuations
  if (/^(continue|go on|what about|and also|one more|tell me more|explain)/i.test(m)) {
    return 'bypass_to_chatgpt';
  }

  return 'send_to_tier1';
}
```

"What is the capital of France?" -> bypass. 50ms. Never touches Codex.
"generate me an image of Eiffel Tower" -> Tier 1. 3s routing + 25s DALL-E = 28s. Nobody notices.
"build me a candle store with payments" -> Tier 1 -> complex -> Tier 2 -> full DAG. 3s is 0.01% of 30min.

---

## TIER 1: ROUTER

### Session Lifecycle

```typescript
// src/main/conductor.ts

class Conductor {
  private sessionId: string | null = null;

  async initialize(): Promise<void> {
    const result = await exec(
      `codex exec --json "${ROUTER_SYSTEM_PROMPT}"`,
      { env: this.buildEnv() }
    );
    this.sessionId = result.sessionId;
    StateManager.save('conductor-session-id', this.sessionId);
  }

  async resume(): Promise<void> {
    this.sessionId = StateManager.load('conductor-session-id');
    if (this.sessionId) {
      await exec(`codex resume ${this.sessionId} --json "READY"`, {
        env: this.buildEnv(),
      });
    } else {
      await this.initialize();
    }
  }

  async classify(message: string, context?: ProjectContext): Promise<ExecutionPlan> {
    const input = this.buildClassificationInput(message, context);
    const result = await exec(
      `codex resume ${this.sessionId} --json "${escapeForShell(input)}"`,
      { env: this.buildEnv(), timeout: 15000 }
    );
    return this.parsePlan(result.stdout);
  }

  async reportStatus(stepId: number, status: string, detail: string): Promise<ExecutionPlan | null> {
    const update = `STEP_STATUS: id=${stepId} status=${status} detail="${detail}"`;
    const result = await exec(
      `codex resume ${this.sessionId} --json "${escapeForShell(update)}"`,
      { env: this.buildEnv(), timeout: 15000 }
    );
    if (result.stdout.includes('NO_CHANGE')) return null;
    return this.parsePlan(result.stdout);
  }
}
```

### Router System Prompt (~600 tokens, persists via session)

```
You are the routing brain for an AI orchestration app.

AVAILABLE TARGETS:

WEB (ChatGPT in browser, user's $20/mo subscription):
  direct_answer, intake_quiz, web_search, dall_e, canvas, content

CLI (Local tools, authenticated via OAuth):
  codex_scaffold, codex_build, codex_test, codex_git

SERVICE (External accounts, user connects when needed):
  connect_github, connect_supabase, connect_stripe, deploy_vercel

RULES:
1. Trivial questions never reach you (fast-path catches them). If something trivial still arrives, route to web/direct_answer.
2. Image requests -> web/dall_e. CLI cannot generate images.
3. "Build X" -> multi-step DAG. Include intake_quiz as step 1.
4. Independent steps -> mark parallel: true
5. Code projects end with: test -> deploy (if user wants it live)
6. complexity: trivial (1 step), simple (2-3), medium (4-7), complex (8+)

OUTPUT JSON ONLY:
{
  "route": "web|cli|hybrid",
  "complexity": "trivial|simple|medium|complex",
  "plan": [
    {"id": 1, "target": "web|cli|service", "action": "name", "detail": "what", "waitFor": [], "parallel": false}
  ],
  "estimated_minutes": number
}

ON STATUS UPDATES: Re-evaluate plan. Insert fix steps if failed. Respond NO_CHANGE if plan is fine.
```

### Classification Examples

"generate me an image of the Eiffel Tower":
```json
{
  "route": "web",
  "complexity": "trivial",
  "plan": [
    {"id": 1, "target": "web", "action": "dall_e", "detail": "Generate image of the Eiffel Tower", "waitFor": [], "parallel": false}
  ],
  "estimated_minutes": 1
}
```

"build me a candle store with payments":
```json
{
  "route": "hybrid",
  "complexity": "complex",
  "plan": [
    {"id": 1, "target": "web", "action": "intake_quiz", "detail": "Ask about audience, candle types, aesthetic, price range", "waitFor": [], "parallel": false},
    {"id": 2, "target": "cli", "action": "codex_scaffold", "detail": "Next.js ecommerce with Tailwind", "waitFor": [1], "parallel": false},
    {"id": 3, "target": "web", "action": "dall_e", "detail": "Hero image: artisanal candles, warm lighting", "waitFor": [1], "parallel": true},
    {"id": 4, "target": "web", "action": "dall_e", "detail": "Logo for candle brand", "waitFor": [1], "parallel": true},
    {"id": 5, "target": "cli", "action": "codex_build", "detail": "Build pages with images from steps 3,4", "waitFor": [2, 3, 4], "parallel": false},
    {"id": 6, "target": "service", "action": "connect_stripe", "detail": "Setup payments", "waitFor": [5], "parallel": false},
    {"id": 7, "target": "service", "action": "connect_supabase", "detail": "Setup user accounts", "waitFor": [5], "parallel": true},
    {"id": 8, "target": "cli", "action": "codex_build", "detail": "Integrate Stripe and Supabase", "waitFor": [5, 6, 7], "parallel": false},
    {"id": 9, "target": "cli", "action": "codex_test", "detail": "Run build, test payment flow", "waitFor": [8], "parallel": false},
    {"id": 10, "target": "service", "action": "deploy_vercel", "detail": "Deploy, provide live URL", "waitFor": [9], "parallel": false}
  ],
  "estimated_minutes": 45
}
```

---

## STEP SCHEDULER (DAG Executor)

```typescript
// src/main/step-scheduler.ts

class StepScheduler {
  private steps: Step[] = [];

  async execute(plan: ExecutionPlan): Promise<void> {
    this.steps = plan.plan.map(s => ({ ...s, status: 'pending', retryCount: 0 }));

    while (this.hasIncompleteSteps()) {
      const ready = this.steps.filter(s =>
        s.status === 'pending' &&
        s.waitFor.every(dep =>
          this.getStep(dep).status === 'done' ||
          this.getStep(dep).status === 'skipped'
        )
      );

      if (ready.length === 0) {
        if (this.hasRunningSteps()) { await this.waitForAnyCompletion(); continue; }
        break; // Deadlock
      }

      // MVP: sequential execution
      for (const step of ready) {
        await this.executeStep(step);
        await this.reportAndReplan(step);
      }
    }
  }

  private async executeStep(step: Step): Promise<void> {
    step.status = 'running';
    this.emitProgress(step);

    try {
      switch (step.target) {
        case 'web': step.result = await this.webExecutor.execute(step); break;
        case 'cli': step.result = await this.cliExecutor.execute(step); break;
        case 'service': step.result = await this.serviceExecutor.execute(step); break;
      }
      step.status = 'done';
    } catch (err: any) {
      step.retryCount++;
      if (step.retryCount < 3) {
        step.status = 'pending';
        step.error = err.message;
      } else {
        // Circuit breaker: 3 failures -> ask user
        step.status = 'needs_user';
        const choice = await this.askUser(step, ['Retry', 'Skip', 'Stop']);
        switch (choice) {
          case 'Retry': step.status = 'pending'; step.retryCount = 0; break;
          case 'Skip': step.status = 'skipped'; break;
          case 'Stop': throw new Error('User cancelled');
        }
      }
    }
    this.emitProgress(step);
  }
}
```

---

## RATE LIMIT HANDLING

```typescript
// src/main/rate-limit-recovery.ts

class RateLimitRecovery {
  // Regex is CORRECT here — matching literal UI strings, not classifying intent
  private PATTERNS = [
    /you['']ve reached (the|your) (message |usage )?limit/i,
    /too many (messages|requests)/i,
    /please try again (in |after )/i,
    /limit (reached|exceeded|hit)/i,
  ];

  onRateLimited(scheduler: StepScheduler): void {
    scheduler.deferWebSteps();
    StateManager.save('deferred-web-steps', scheduler.getDeferredSteps());
    this.startPolling(scheduler);
    this.emitStatus('ChatGPT needs a breather. Code tasks continue. Web tasks resume automatically.');
  }

  private startPolling(scheduler: StepScheduler): void {
    const interval = setInterval(async () => {
      if (!await this.stillLimited()) {
        clearInterval(interval);
        scheduler.resumeDeferredSteps();
        StateManager.save('deferred-web-steps', null);
      }
    }, 60000);
  }

  onAppLaunch(scheduler: StepScheduler): void {
    const deferred = StateManager.load('deferred-web-steps');
    if (deferred?.length) this.startPolling(scheduler);
  }
}
```

---

## USER SEES:

```
Building your candle store

 * Understood your requirements
 o Setting up your project...        <-- running
 o Creating images for your site
 o Building your pages
 o Setting up payments
 o Testing everything
 o Publishing your site

~45 minutes remaining

[Pause]  [Cancel]
```

Never sees: Codex, GSD, MCP, DAG, JSON, session IDs, API calls.

---

## LATENCY BUDGET

| Phase | Time | User sees |
|-------|------|-----------|
| Fast-path check | 50ms | Nothing |
| Tier 1 classify | 3s | "Understanding what you need..." |
| Intake quiz | 30-120s | Natural conversation |
| Tier 2 (complex only) | 5-10s | "Planning your project..." |
| Step execution | Varies | Steps ticking off |

Total routing overhead: 6 seconds. On 45min build: 0.2%. On 25s image: +12%.

---

## OVERNIGHT BUILD FILE LIST

```
CREATE:
  src/main/fast-path.ts              -- Tier 0: 50ms bypass
  src/main/conductor.ts              -- Tier 1: persistent Codex router
  src/main/planner.ts                -- Tier 2: detailed planning (complex only)
  src/main/step-scheduler.ts         -- DAG executor + circuit breaker
  src/main/executors/web-executor.ts -- ChatGPT inject, capture, images
  src/main/executors/cli-executor.ts -- Codex --full-auto spawner
  src/main/executors/service-executor.ts -- Service guides + waiting
  src/main/rate-limit-recovery.ts    -- Defer web, continue CLI, resume
  src/plugins/status-translator.ts   -- Technical -> friendly messages

DELETE:
  task-router.ts regex classify()    -- Replace with conductor.classify()

MODIFY:
  src/main/index.ts                  -- Wire conductor.resume() on launch
  src/renderer/components/App.tsx    -- Step progress list
  src/main/preload.ts                -- Step progress IPC
  src/main/global.d.ts               -- Step progress types

TESTS:
  tests/fast-path.test.ts            -- Trivials bypass, tasks route
  tests/conductor.test.ts            -- Plan gen, re-planning, status
  tests/step-scheduler.test.ts       -- DAG exec, circuit breaker
  tests/rate-limit.test.ts           -- Deferral, resume, persistence
```
