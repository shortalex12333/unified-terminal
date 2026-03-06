# CARL + Task Spine + Project Sandbox Architecture

> **F1-Quality Specification Document** — Defines the Context-Aware Resource Limiter (CARL), the two-tier Task Spine checkpoint hierarchy, and the Project Sandbox folder topology. This document extends the Hardcoded Enforcement Engine (Instance 3 + 4) with runtime token enforcement, agent state tracking, and filesystem-level scope isolation. It is the gospel reference for future implementation.

---

## Implementation Status

| Component | Status | Details |
|-----------|--------|---------|
| CARL constants (`AMBER_THRESHOLD`, `CARL_*`) | **IMPLEMENTED** | Added to `src/enforcement/constants.ts` |
| TOKEN_THRESHOLDS (per-model) | **IMPLEMENTED** | Existing in `constants.ts:12-46` |
| GRACE_THRESHOLD | **IMPLEMENTED** | Existing at `constants.ts:49` |
| Context-warden translator events | **IMPLEMENTED** | 4 translations in `translator.ts:365-388` |
| CARL runtime counter (`carl.ts`) | **PROPOSED** | Not yet built — requires streaming hook |
| Task Spine checkpoint files | **PROPOSED** | Folder structure defined, not yet scaffolded |
| Project Sandbox dual topology | **PROPOSED** | Agent workspace + human-friendly output |
| `contextWardenEvents` emitter | **PROPOSED** | Needs adding to `events.ts` |
| `bodyguard.ts` CARL probe | **PROPOSED** | Replace `isDoctorAvailable` TODO at line 144 |
| `MAX_PARALLEL_CLI` update (3→5) | **PROPOSED** | Value change pending approval |

---

## 1. Executive Summary

CARL is a hard hat, not an agent. It is a mathematical counter strapped to each CLI process — zero AI, zero reasoning, zero hallucination risk. It counts tokens via streaming character estimation, compares against hardcoded thresholds, and injects hardcoded prompt templates on state transitions. Every operation is deterministic.

The Task Spine is a two-tier checkpoint system — master spine plus per-agent sub-spines — that tracks what agents accomplished, not what files changed on disk. It is complementary to the existing file spine (`spine.ts`), not a replacement. Write isolation is enforced as a hard rail: each agent writes only to its own sub-spine, verified by the existing `check_scope.py` gate.

The Project Sandbox uses a **dual topology**: a hidden agent workspace (`.kenoki/` inside the project directory, like `.git/`) for orchestration internals (spines, registries, checkpoints, CARL status, tool provisioning) and a human-friendly output folder (`~/Documents/{Project Name}/`) with a personal ReadMe and the built product. Agents read `.md` and `.json`. Humans read the deployed output. Non-technical users never see agent internals — they see "Read Me Paula.docx" and a link to their live site. Agent scope is enforced via `cd` isolation into the project workspace.

The **Storekeeper** is the tool provisioning clerk — agents request skills/MCPs/plugins, the storekeeper reads the task context, provisions the right tools, and removes them when no longer needed. File-based IPC via `.kenoki/requests/` and `.kenoki/responses/`. See `src/storekeeper/types.ts`.

**Design philosophy:** Hardcoded for deterministic tasks (counting, comparing, injecting, scoping). AI for creative tasks (building, coding, designing). No AI in the safety-critical path.

---

## 2. CARL — Context-Aware Resource Limiter

### 2.1 What CARL Is

One CARL instance per active CLI process (Codex or Claude Code). CARL is not an agent. CARL is a counter.

```
CLI Process (Codex / Claude Code)
│
├── Streaming output arrives via AgentHandle.onOutput
│
├── HARD HAT (CARL) ← pure math, no AI
│   ├── Counts: characters received × ratio ≈ tokens
│   ├── Running total: 0... 14,000... 87,000... 156,000...
│   ├── Compares against: model.killAt × model.window
│   └── Outputs: GREEN | AMBER | RED (binary, definitive)
│
└── On state change:
    ├── GREEN → do nothing
    ├── AMBER → inject checkpoint prompt into CLI stdin
    └── RED   → inject final-state prompt into CLI stdin
```

No decision-making. No "should I intervene?" The threshold is a number, the count is a number, the comparison is `>` or `<`. Definitive. Binary.

### 2.2 Token Estimation: Two Sources

CARL uses two token sources for different purposes:

| Source | When | Purpose | Accuracy |
|--------|------|---------|----------|
| `AgentHandle.onOutput` streaming chunks | **During execution** (real-time) | Kill decisions, checkpoint triggers | Approximate (~±15%) |
| `AgentResult.tokensUsed` | **After completion** | Reconciliation, ratio calibration, audit | Exact (from runtime) |

**Primary source (real-time):** Characters received from the streaming output callback, multiplied by a calibration ratio (initial value: `0.25`). This is what CARL checks every 30 seconds (`CRON_INTERVALS.CONTEXT_CHECK_MS = 30_000` from `constants.ts`). The Context Warden's job is to KILL agents before they exhaust their window — it cannot wait for post-completion numbers.

**Secondary source (reconciliation):** When the agent completes, `AgentResult.tokensUsed: { input: number, output: number }` (from `src/adapters/types.ts:95-98`) provides exact token counts from the runtime. CARL compares the estimate against the actual, and adjusts the calibration ratio for future runs. If Codex consistently reports 20% more tokens than estimated, the multiplier shifts from `0.25` to `0.30`.

**Fuel Gauge:** During execution, the user sees an approximate session budget ("~65% used"). After completion, the exact number replaces the estimate silently. The user never sees the correction.

### 2.3 Traffic Light States

Three states. Binary transitions. No grey area.

| State | Condition | Action |
|-------|-----------|--------|
| **GREEN** | `utilization < AMBER_THRESHOLD` | Do nothing |
| **AMBER** | `utilization >= AMBER_THRESHOLD AND < killAt` | Inject checkpoint prompt |
| **RED** | `utilization >= killAt` | Inject final-state prompt, terminate |

Where `utilization = estimated_tokens / (model.window × model.killAt)`.

**GRACE rule:** If `taskProgress > GRACE_THRESHOLD` (0.85 from `constants.ts:49`), RED becomes AMBER. The agent is 85%+ done — let it finish the current atomic unit before killing.

### 2.4 Per-Model Thresholds

All values sourced from `TOKEN_THRESHOLDS` in `src/enforcement/constants.ts:12-46`. The `AMBER_THRESHOLD` is a new constant (proposed value: `0.50`).

| Model | Window | Amber At (50%) | Kill At | Effective Budget | Max Output |
|-------|--------|----------------|---------|-----------------|------------|
| `gpt-5-codex` | 400,000 | 200,000 | 240,000 (60%) | 240,000 | 128,000 |
| `gpt-5` | 400,000 | 200,000 | 240,000 (60%) | 240,000 | 128,000 |
| `claude-sonnet-4` | 200,000 | 100,000 | 110,000 (55%) | 110,000 | 64,000 |
| `claude-opus-4` | 200,000 | 100,000 | 130,000 (65%) | 130,000 | 64,000 |
| `default` | 400,000 | 200,000 | 220,000 (55%) | 220,000 | 128,000 |

**New constant to add to `constants.ts`:**

```typescript
export const AMBER_THRESHOLD = 0.50; // CARL transitions GREEN → AMBER at 50% of effective budget
```

### 2.5 State Transition Actions (All Hardcoded, Zero AI)

**GREEN → AMBER:** Inject hardcoded checkpoint prompt into CLI stdin.

```
SYSTEM: Context usage at {percent}%. Write current progress summary
to ~/.kenoki/{uuid}/{domain}/subagents/{session_id}_{role}/token_hit_summary.md
using this format:

## Checkpoint | {percent}% context | {timestamp}
**Status:** AMBER
**Completed:** [bullet list of completed work]
**In Progress:** [current task with % estimate]
**Files Touched:** [list of file paths modified]
**Blockers:** [list or "None"]
**Next Steps:** [prioritised list of remaining work]
```

CARL fills `{percent}`, `{project_dir}`, `{domain}`, `{session_id}`, `{role}`, and `{timestamp}` from its own state. The agent fills the content fields. CARL does not care about the content — that is the agent's job (AI). CARL only verifies the file was written (file-existence check — already a hard rail in `bodyguard.ts`).

**AMBER → RED:** Inject hardcoded final-state prompt into CLI stdin.

```
SYSTEM: Context limit reached at {percent}%. Write FINAL state to
~/.kenoki/{uuid}/{domain}/subagents/{session_id}_{role}/token_hit_summary.md
and conclude your work. Do not start new tasks. Finish current atomic
unit and stop.

## Final Checkpoint | {percent}% context | {timestamp}
**Status:** RED
**Completed:** [bullet list of ALL completed work]
**In Progress:** [current task - INCOMPLETE, describe remaining work]
**Files Touched:** [list of ALL file paths modified this session]
**Blockers:** [list or "None"]
**Handoff Notes:** [what the replacement agent needs to know]
```

Agent finishes its current atomic unit, writes the checkpoint, terminates.

**RED → Orchestrator Notification:** CARL writes `status/agent_{id}.json` with final state. Orchestrator reads and decides on replacement agents.

### 2.6 Why This Kills Hallucination Risk

The failure mode of agent-monitoring-agent: the monitor hallucinates everything is fine when it isn't, or panics when there is no problem. CARL eliminates this entirely by being a counter, not a thinker.

The only things CARL does:

1. **Count** — tokens in, tokens out, running total (math)
2. **Compare** — total vs threshold (math)
3. **Inject** — hardcoded string into CLI stdin (template)
4. **Report** — write state change to known file path (IO)

Every operation is deterministic. There is zero probability of CARL getting confused about whether an agent is at 70% or 30%.

### 2.7 RAM Pressure Relief

Without CARL, agents run until the context window is full — 400K tokens of conversation buffered locally. CLI process RAM grows unbounded, risking OOM or degraded performance.

With CARL, agents get checkpointed at AMBER (~200K tokens for a 400K window). At RED they terminate. The replacement agent starts fresh with just the checkpoint summary as initial context. Local RAM resets to baseline.

CARL is a memory pressure relief valve for each CLI process.

### 2.8 What CARL Does NOT Do

- Does NOT reason about task quality
- Does NOT decide which agent to kill (thresholds decide)
- Does NOT write to any spine file (agents write their own checkpoints)
- Does NOT communicate with other CARLs
- Does NOT evaluate checkpoint content
- Has zero dependencies on AI/LLM

### 2.9 Integration Points

| Direction | Target | Description |
|-----------|--------|-------------|
| **Reads from** | `AgentHandle.onOutput` | Streaming character count for real-time estimation |
| **Reads from** | `AgentResult.tokensUsed` | Post-completion exact tokens for reconciliation |
| **Writes to** | `~/.kenoki/{uuid}/status/agent_{id}.json` | Agent status file on state transitions |
| **Injects into** | CLI stdin | Hardcoded checkpoint/final-state templates |
| **Checked by** | Bodyguard gate | File-existence check on checkpoint files |
| **Displayed by** | Status Agent translator | `context-warden:checkpoint` and `context-warden:kill` events (already defined at `translator.ts:366-388`) |
| **Cron trigger** | `CHECK_ACTIVATION.cron_30s` | `"token-threshold"` check runs every 30s (`constants.ts:134`) |

---

## 3. Task Spine Hierarchy

### 3.1 Two Spines, Different Concerns

| Spine | Module | Tracks | Answers |
|-------|--------|--------|---------|
| **File Spine** | `spine.ts` (existing) | Filesystem snapshots, git diff | "What changed on disk?" |
| **Task Spine** | New (per-agent markdown) | Agent checkpoints, progress summaries | "What was accomplished?" |

These are complementary systems. The file spine tells the bodyguard what files were modified. The task spine tells the orchestrator what work was completed, what remains, and what the agent was doing when it hit a token limit. They are never merged.

### 3.2 Write Isolation (Hard Rail)

Each writer has exactly ONE location it can write to. Violations are caught by `check_scope.py` (existing hard rail in bodyguard). Hard fail. No skip.

| Writer | Writes To | Never Writes To |
|--------|-----------|-----------------|
| Master Orchestrator | `spine_master.md` | Any sub-spine, any token_hit_summary |
| Domain Orchestrator | `{domain}/sub_agent_spine.md` | spine_master, other domain spines |
| Sub-agent | `{domain}/subagents/{id}/token_hit_summary.md` | Any spine file, any other agent's folder |
| PA | `pa/observations.md` | Everything else |
| CARL | `status/agent_{id}.json` | Everything else |

Enforcement is scope-level, not convention-level:

```
Agent-1 scope whitelist: {domain}/subagents/{id_1}/  (write)
Agent-1 scope whitelist: spine_master.md              (read-only)
Agent-1 scope whitelist: {domain}/sub_agent_spine.md  (read-only)
Agent-1 scope whitelist: {domain}/subagents/{id_2}/   (read-only)
```

If Agent-1 tries to write to Agent-2's folder, `check_scope.py` catches it. Hard fail. This is not a convention — it is a gate.

### 3.3 Checkpoint Format (Hardcoded Template)

Agents fill the variables. PA and orchestrator parse the headings. No free-form prose in structured fields.

```markdown
## Checkpoint | {percent}% context | {timestamp}
**Status:** {GREEN|AMBER|RED}
**Completed:** {bullet list}
**In Progress:** {description with % estimate}
**Files Touched:** {list of paths}
**Blockers:** {list or "None"}
**Next Steps:** {prioritised list}
```

Multiple checkpoints accumulate in the same file (append-only). The latest checkpoint is always at the bottom.

### 3.4 Flow: Agent Hits Token Limit

```
  1. CARL detects AMBER
     └── Injects hardcoded checkpoint prompt into CLI stdin

  2. Agent writes checkpoint
     └── token_hit_summary.md in its own folder (write-isolated)

  3. CARL detects RED
     └── Injects hardcoded final-state prompt into CLI stdin

  4. Agent writes final checkpoint, terminates
     └── Appends final checkpoint to token_hit_summary.md

  5. CARL writes status file
     └── status/agent_{id}.json with RED state + metadata

  6. Domain orchestrator reads token_hit_summary
     └── Updates {domain}/sub_agent_spine.md with agent's results

  7. Domain orchestrator decomposes remaining work
     └── Splits unfinished tasks into narrower-scope chunks

  8. Domain orchestrator spawns replacement agents
     └── Fresh token budgets, one per remaining chunk

  9. Replacement agents receive checkpoint summary as initial context
     └── NOT full conversation history — just the structured checkpoint

 10. Master orchestrator reads domain spine
     └── Updates spine_master.md with cross-domain status
```

Key invariant: replacement agents start with checkpoint context only. They never inherit the dead agent's full conversation. This is what keeps RAM bounded and context windows fresh.

---

## 4. Project Sandbox — Dual Topology

The project sandbox has **two** directory structures per project: a hidden agent workspace and a human-friendly output folder. Agents read/write the hidden workspace. Users see a clean output folder with a personal ReadMe.

**The difference is who reads it:** agents read `.md`, `.json`, `.yaml`, `.txt`. Humans read the *output* — the built product. Non-technical users don't know what `/src` means and shouldn't have to.

### 4.1 Hidden Agent Workspace

This is the agent-only workspace, stored as `.kenoki/` inside the project directory — same pattern as `.git/`. Users never need to open this. Hidden by dot-prefix convention. The constant `STOREKEEPER_CONSTANTS.KENOKI_DIR` (from `src/storekeeper/types.ts`) defines this name.

```
{project_dir}/
├── .kenoki/                                   ← hidden workspace (like .git/)
│   ├── agent_registry.json                    ← project-level: all agents, roles, status
│   ├── spine_master.md                        ← master orchestrator writes ONLY
│   ├── project_brief.md                       ← intake output, immutable after creation
│   │
│   ├── status/                                ← CARL writes here (one file per agent)
│   │   ├── agent_{id_1}.json
│   │   ├── agent_{id_2}.json
│   │   └── ...
│   │
│   ├── requests/                              ← storekeeper IPC: tool requests from agents
│   ├── responses/                             ← storekeeper IPC: provisioning decisions
│   ├── audit/                                 ← storekeeper: decision audit trail
│   ├── inventory/                             ← storekeeper: available tools/skills/MCPs
│   │
│   ├── registry/                              ← agent registry (used by enforcement/registry.ts)
│   │   └── agents.json
│   │
│   ├── skills/
│   │   ├── active_mcps.json
│   │   ├── active_skills.json
│   │   └── active_plugins.json
│   │
│   ├── pa/
│   │   └── observations.md
│   │
│   ├── {domain}/                              ← e.g., frontend/, backend/, database/
│   │   ├── agent_registry.json                ← domain-level: detailed agent state
│   │   ├── sub_agent_spine.md                 ← domain orchestrator writes ONLY
│   │   └── subagents/
│   │       ├── {session_id}_{role}/           ← sub-agent scope boundary
│   │       │   ├── mandate.md                 ← task assignment, immutable
│   │       │   ├── token_hit_summary.md       ← CARL-triggered checkpoints
│   │       │   ├── tasklist.md                ← agent's own task tracking
│   │       │   └── workspace/                 ← agent's working files
│   │       └── ...
│   │
│   └── {domain}/                              ← repeat per domain
│
├── src/                                       ← actual project source code
├── package.json
└── ...
```

### 4.2 Human-Friendly Output Folder

This is what the user sees. Named after THEIR project name, not a UUID. Contains a personal ReadMe and the built output — nothing else at the top level.

```
~/Documents/
└── {Project Name}/                            ← e.g., "Candle Store/"
    ├── Read Me {UserName}.docx                ← e.g., "Read Me Paula.docx"
    └── Files/                                 ← all project source files
        ├── src/
        ├── apps/
        │   ├── api/
        │   └── web/
        ├── package.json
        └── ...
```

**The ReadMe is the ONLY thing at the top level besides `/Files`.** Paula opens the folder, sees "Read Me Paula.docx" immediately. Nothing scary.

**ReadMe content (generated, hardcoded template):**

```
Hey Paula,

I built you a candle store website. Here's what you need to know:

Everything inside the /Files folder is used by website hosting providers
like Vercel and Shopify. These are critical files — please don't modify
them. You can look inside if you're curious, but it's all code (like
Python, JavaScript — different languages used on the web, just like how
some people speak English, French, or Spanish).

Your project is now built. To see it live, go here:
→ {deployment_url}

To request changes, just tell me what you'd like different.
```

The `{deployment_url}` links to the live deployed output — Vercel preview, Shopify admin, or whatever hosting the project uses. The user inspects the PRODUCT, not the code.

### 4.3 Two Structures, One Truth

| Concern | Agent Workspace (`.kenoki/`) | Human Output (`~/Documents/{Name}/`) |
|---------|----------------------------------------|--------------------------------------|
| **Audience** | Agents, orchestrator, CARL, PA, storekeeper | The user (non-technical) |
| **Contents** | Spine files, registries, checkpoints, status JSON, tool requests/responses | ReadMe + project source files |
| **Location** | `{project_dir}/.kenoki/` (hidden, like `.git/`) | `~/Documents/{Project Name}/` |
| **Hidden?** | Yes (dot-prefix inside project dir) | No (in Documents) |
| **Who writes?** | Agents (write-isolated per scope), storekeeper (tool provisioning) | Agents (via build pipeline) |
| **Who reads?** | Orchestrator, PA, CARL, bodyguard, storekeeper | The user |
| **Format** | `.md`, `.json`, `.txt` | `.docx` (ReadMe), source code (in /Files) |

**Linking:** The agent workspace stores a `human_output_path` field in `project_brief.md` pointing to the human folder. The human ReadMe does NOT link back to the agent workspace — users never need to see it.

### 4.4 Notification: Agent-Done vs User-Ready

When a task completes, there are two distinct notifications:

| Event | Audience | What Happens |
|-------|----------|-------------|
| **Agent checkpoint written** | Orchestrator | Reads `token_hit_summary.md`, updates domain spine, may spawn replacement |
| **Build output ready** | User | Files copied/built into `~/Documents/{Name}/Files/`, ReadMe updated with deployment URL |

The orchestrator emits `worker:complete` (agent-facing) and the PA emits `pa:handoff` (user-facing) as separate events. The status agent translates `pa:handoff` into "Here's what I built for you" — never "sub_spine_agent_3.md written successfully."

### 4.5 Spawn Command Template

```bash
cd {{ project_dir }}/.kenoki/{{ domain }}/subagents/{{ session_id }}_{{ role }} && {{ runtime }}
```

- Sub-agent sees ONLY its folder (sandbox = working directory)
- Domain orchestrator launches from `.kenoki/{domain}/` (sees all subagents in its domain)
- Master orchestrator launches from `.kenoki/` (sees all domains)
- Project source code lives alongside `.kenoki/` in the project directory

### 4.6 Scaffold Creation (Three-Phase, Hardcoded)

**Phase 1 — Intake:** Create both structures.

```bash
# Agent workspace (project-local .kenoki/)
mkdir -p {project_dir}/.kenoki/{status,skills,pa,requests,responses,audit,inventory,registry}
# Write: .kenoki/agent_registry.json (empty schema)
# Write: .kenoki/project_brief.md (from intake, includes human_output_path)
# Write: .kenoki/spine_master.md (header only)
# Write: .kenoki/registry/agents.json (empty agent list)

# Human output
mkdir -p ~/Documents/{project_name}/Files
# Write: "Read Me {UserName}.docx" (template with user's name)
```

**Phase 2 — Conductor classification:** Add domain folders to agent workspace.

```bash
mkdir -p {project_dir}/.kenoki/{domain}/subagents
# Write: .kenoki/{domain}/agent_registry.json (empty schema)
# Write: .kenoki/{domain}/sub_agent_spine.md (header only)
```

**Phase 3 — Build complete:** Copy/build output to human folder.

```bash
# Build pipeline writes to ~/Documents/{project_name}/Files/
# Update ReadMe with deployment URL
# Emit pa:handoff event → user notification
```

Template function with variable insertion. No AI decides structure. Pre-populated with framework files.

### 4.7 Agent Registry Schema

**Project-level** (`agent_registry.json`):

```json
{
  "project_name": "Candle Store",
  "project_uuid": "a1b2c3d4-...",
  "human_output_path": "~/Documents/Candle Store/",
  "user_name": "Paula",
  "agents": [
    {
      "id": "abc123",
      "domain": "frontend",
      "role": "header-component",
      "runtime": "claude",
      "convo_id": "sess_abc123...",
      "status": "active",
      "spawned_at": "2026-03-06T14:30:00Z",
      "terminated_at": null,
      "token_usage_percent": 32,
      "replaced_by": null
    }
  ]
}
```

Valid `status` values: `active` | `amber` | `retired` | `killed`

- **PA** reads registries to know who is where (no guessing, no hallucination)
- **Orchestrator** updates on spawn/kill/replace events
- **CARL** updates `token_usage_percent` on every check cycle (every 30s)
- **Orchestrator** sets `replaced_by` when spawning a replacement agent

### 4.8 Status File Schema

**Per-agent** (`status/agent_{id}.json`) — written by CARL only:

```json
{
  "id": "abc123",
  "state": "RED",
  "estimated_tokens": 243500,
  "actual_tokens": null,
  "model": "gpt-5-codex",
  "calibration_ratio": 0.25,
  "checkpoint_file": "frontend/subagents/abc123_header/token_hit_summary.md",
  "checkpoint_exists": true,
  "last_check_at": "2026-03-06T14:45:30Z",
  "transitions": [
    { "from": "GREEN", "to": "AMBER", "at": "2026-03-06T14:40:00Z", "tokens": 198000 },
    { "from": "AMBER", "to": "RED", "at": "2026-03-06T14:45:30Z", "tokens": 243500 }
  ]
}
```

After agent completion, `actual_tokens` is filled from `AgentResult.tokensUsed` and the `calibration_ratio` is adjusted for the next agent using that model.

---

## 5. RAM and Parallel Agent Constraints

### 5.1 Revised RAM Model

CLI agents are thin clients — inference runs in the cloud, the local process is ~50–80MB each.

| Machine | Available RAM | Max Parallel Agents | Rationale |
|---------|---------------|--------------------:|-----------|
| 8GB Mac | ~4GB after OS | 5 | 5 × 80MB = 400MB, well within budget |
| 16GB Mac | ~10GB after OS | 8 | Comfortable headroom |
| 4GB (minimum) | ~2GB after OS | 3 | Current `MAX_PARALLEL_CLI` value |

**Proposed change to `constants.ts`:**

```typescript
// Current:
MAX_PARALLEL_CLI: 3, // user machine RAM constraint

// Proposed:
MAX_PARALLEL_CLI: 5, // revised: CLI agents are thin clients (~80MB each)
```

With dynamic adjustment: if available RAM drops below 2GB, throttle back to 3.

### 5.2 Replacement Strategy on Token Breach

Agents hitting RED are **replaced**, not doubled. The net parallel count stays within `MAX_PARALLEL_CLI`.

1. Agent-1 hits RED → terminates → slot freed
2. Remaining work decomposed into narrower chunks (by domain orchestrator, using AI)
3. Replacement agents spawned into freed slots with fresh token budgets
4. Each replacement starts with checkpoint summary only — not full conversation history

This prevents the "zombie agent" problem where killed agents leave orphaned processes.

---

## 6. Integration With Existing Systems

### 6.1 What Changes

| Existing Component | Change | Severity |
|-------------------|--------|----------|
| `constants.ts` | Add `AMBER_THRESHOLD = 0.50` | Minor (one new constant) |
| `constants.ts` | Update `MAX_PARALLEL_CLI` from 3 to 5 | Minor (one value change) |
| `bodyguard.ts:144` | Wire CARL status check (replace `isDoctorAvailable: false` TODO) | Medium (boolean → CARL probe) |
| `step-scheduler.ts` | Read CARL state between steps (post-step check) | Medium (add hook point) |
| `CHECK_ACTIVATION.cron_30s` | Already includes `"token-threshold"` — CARL replaces check script | No change (existing wiring) |
| Status agent `translator.ts:365-388` | Already has `context-warden:*` translations — CARL emits these events | No change (existing translations) |

### 6.2 What Stays Unchanged

| Component | Reason |
|-----------|--------|
| `spine.ts` | File spine and task spine are separate concerns — no overlap |
| `enforcer.ts` | CARL is additive; check scripts still run via enforcer |
| All 11 check scripts | CARL adds a runtime monitor; gate checks remain |
| Adapter layer (`src/adapters/`) | CARL reads from adapters but does not modify them |
| Conductor (`conductor.ts`) | Conductor routes tasks; CARL monitors agent health |
| Circuit breaker | Handles step-level retries; CARL handles agent-level token limits |

### 6.3 Event Flow

```
CARL detects state change
    │
    ├── Emits context-warden:{event}
    │   └── Status Agent translator picks up (existing translations)
    │       └── User sees: "Saving progress..." or "Saving memory, pausing helper..."
    │
    ├── Writes status/agent_{id}.json
    │   └── Bodyguard can check file-existence on next gate
    │
    └── Injects prompt into CLI stdin
        └── Agent writes checkpoint to its own sub-spine folder
```

All four `context-warden:*` translations are already defined:

| Event | Translation (from `translator.ts`) |
|-------|-----------------------------------|
| `context-warden:kill` | "Saving memory, pausing helper..." |
| `context-warden:respawn` | "Bringing helper back..." |
| `context-warden:compact` | "Tidying up memory..." |
| `context-warden:checkpoint` | "Saving progress..." |

No new translations needed. CARL emits `context-warden:checkpoint` on AMBER and `context-warden:kill` on RED. The orchestrator emits `context-warden:respawn` when spawning replacement agents.

---

## 7. Full Enforcement Stack

```
ENFORCEMENT LAYER (all deterministic, zero AI)
│
├── CARL (hard hat per CLI process)
│   └── Counts tokens → GREEN/AMBER/RED → injects hardcoded prompts
│
├── SCOPE ENFORCER (existing check_scope.py)
│   └── Validates each agent only writes to its own sub-spine
│
├── BODYGUARD (existing bodyguard.ts)
│   └── Verifies checkpoint file exists after CARL trigger (file-existence check)
│
├── FILE SPINE (existing spine.ts)
│   └── Tracks filesystem changes via git diff
│
└── TASK SPINE (new, per-agent markdown files)
    ├── spine_master.md          ← master orchestrator writes only
    ├── {domain}/sub_agent_spine.md  ← domain orchestrator writes only
    └── {domain}/subagents/{id}/token_hit_summary.md  ← agent writes only

PROVISIONING LAYER (deterministic IPC, file-based)
│
└── STOREKEEPER (tool clerk — src/storekeeper/)
    ├── Reads: agent task context from .kenoki/requests/
    ├── Writes: provisioning decisions to .kenoki/responses/
    ├── Manages: skill/MCP/plugin inventory in .kenoki/inventory/
    ├── Audits: all decisions to .kenoki/audit/
    └── Hard limits: MAX_SKILLS_ABSOLUTE=5, MAX_SKILL_TOKENS=4000

INTELLIGENCE LAYER (AI, reads from deterministic sources)
│
├── PA → reads sub-spines → spots patterns → notifies user
├── SKILL SELECTOR → reads task context → requests tools via storekeeper
└── ORCHESTRATOR → reads sub-spines → makes launch/kill/replace decisions
```

The enforcement layer is all math and file IO. The intelligence layer reads from the enforcement layer's outputs. No AI in the safety-critical path. The hard rails protect the soft reasoning.

---

## 8. Hard Coded vs AI Boundary

| Task | Handled By | Why |
|------|-----------|-----|
| Token counting | CARL (math) | Definitive, binary, no interpretation needed |
| Threshold comparison | CARL (math) | Number > number, no reasoning |
| Prompt injection on AMBER/RED | CARL (template) | Hardcoded string with variable slots only |
| Scope enforcement | Filesystem + `check_scope.py` | `cd` scoping is OS-level |
| Registry updates | Orchestrator (structured JSON) | Schema-defined, no free text |
| Write isolation verification | Bodyguard gate check | Hard fail on scope violation |
| File-existence after checkpoint | Bodyguard gate check | Binary: file exists or it doesn't |
| Ratio calibration | CARL (math) | `actual / estimated` — division, not reasoning |
| Project scaffolding | Template function (code) | `mkdir` + write, no AI |
| Checkpoint content | Agent (AI) | Summarisation requires understanding |
| Task decomposition | Orchestrator (AI) | Splitting remaining work requires reasoning |
| Pattern detection | PA (AI) | Spotting recurring failures requires interpretation |
| Skill injection | Skill Selector (AI) | Matching struggles to skills requires understanding |
| Code generation | Sub-agents (AI) | The actual creative work |

**Design principle:** If a task can be reduced to math, comparison, template insertion, or filesystem operations — it is hardcoded. If it requires understanding, interpretation, or creative output — it uses AI. The boundary is never blurred.

---

## 9. Constants Reference

All values in this document are sourced from or proposed for `src/enforcement/constants.ts`. This section serves as the cross-reference index.

### 9.1 Existing Constants (No Changes)

| Constant | Value | Location |
|----------|-------|----------|
| `TOKEN_THRESHOLDS["gpt-5-codex"].window` | 400,000 | `constants.ts:29` |
| `TOKEN_THRESHOLDS["gpt-5-codex"].killAt` | 0.60 | `constants.ts:30` |
| `TOKEN_THRESHOLDS["gpt-5-codex"].effective` | 240,000 | `constants.ts:31` |
| `TOKEN_THRESHOLDS["claude-sonnet-4"].window` | 200,000 | `constants.ts:17` |
| `TOKEN_THRESHOLDS["claude-sonnet-4"].killAt` | 0.55 | `constants.ts:18` |
| `TOKEN_THRESHOLDS["claude-opus-4"].window` | 200,000 | `constants.ts:23` |
| `TOKEN_THRESHOLDS["claude-opus-4"].killAt` | 0.65 | `constants.ts:24` |
| `TOKEN_THRESHOLDS["default"].killAt` | 0.55 | `constants.ts:41` |
| `GRACE_THRESHOLD` | 0.85 | `constants.ts:49` |
| `CRON_INTERVALS.CONTEXT_CHECK_MS` | 30,000 | `constants.ts:165` |
| `MEMORY_CONSTRAINTS.MAX_PARALLEL_CLI` | 3 (proposed → 5) | `constants.ts:517` |
| `CHECK_ACTIVATION.cron_30s` | `["token-threshold"]` | `constants.ts:134` |

### 9.2 New Constants (To Be Added)

| Constant | Proposed Value | Purpose |
|----------|---------------|---------|
| `AMBER_THRESHOLD` | 0.50 | CARL transitions GREEN → AMBER at 50% of effective budget |
| `CARL_INITIAL_RATIO` | 0.25 | Characters-to-tokens estimation ratio (calibrated over time) |
| `CARL_RATIO_MIN` | 0.15 | Lower bound for calibration ratio |
| `CARL_RATIO_MAX` | 0.50 | Upper bound for calibration ratio |
| `CARL_RECONCILIATION_WEIGHT` | 0.20 | Exponential moving average weight for ratio updates |

### 9.3 Adapter Types (Read-Only Reference)

From `src/adapters/types.ts`:

| Type/Field | Line | Used By CARL |
|------------|------|-------------|
| `AgentHandle.onOutput` | `:159` | Real-time streaming token estimation |
| `AgentResult.tokensUsed.input` | `:96` | Post-completion reconciliation |
| `AgentResult.tokensUsed.output` | `:97` | Post-completion reconciliation |
| `AgentResult.duration` | `:101` | Audit trail |
| `AgentResult.runtime` | `:107` | Model-specific threshold selection |
| `AgentConfig.id` | `:35` | Agent identification for status files |
| `AgentConfig.model` | `:44` | Threshold lookup key |

---

## 10. Sequence Diagrams

### 10.1 Normal Execution (Agent Completes Within Budget)

```
Orchestrator          CARL              Agent              Status Agent
    │                  │                  │                     │
    ├─ spawn ─────────►│                  │                     │
    │                  ├─ attach to ──────►│                     │
    │                  │  onOutput         │                     │
    │                  │                  ├─ streaming output ──►│
    │                  │◄─ chars ──────────┤                     │
    │                  │  count: GREEN     │                     │
    │                  │                  │                     │
    │                  │◄─ chars ──────────┤                     │
    │                  │  count: GREEN     │                     │
    │                  │                  │                     │
    │                  │                  ├─ complete ──────────►│
    │                  │                  │                     │
    │                  ├─ reconcile ───────┤                     │
    │                  │  (adjust ratio)   │                     │
    │◄─ result ────────┤                  │                     │
```

### 10.2 Agent Hits Token Limit (AMBER → RED → Replace)

```
Orchestrator    CARL         Agent         Bodyguard    Status Agent
    │            │             │               │             │
    │            │◄─ chars ────┤               │             │
    │            │ total=200K  │               │             │
    │            │ AMBER!      │               │             │
    │            │             │               │             │
    │            ├─ inject ───►│               │         emit checkpoint
    │            │ checkpoint  │               │             │
    │            │ prompt      │               │             │
    │            │             ├─ writes ──────┤             │
    │            │             │ token_hit_    │             │
    │            │             │ summary.md    │             │
    │            │             │               ├─ verify ───►│
    │            │             │               │ file exists │
    │            │◄─ chars ────┤               │             │
    │            │ total=240K  │               │             │
    │            │ RED!        │               │             │
    │            │             │               │         emit kill
    │            ├─ inject ───►│               │             │
    │            │ final state │               │             │
    │            │ prompt      │               │             │
    │            │             ├─ writes ──────┤             │
    │            │             │ final ckpt    │             │
    │            │             │               │             │
    │            │             X (terminates)  │             │
    │            │                             │             │
    │            ├─ write ────────────────────►│             │
    │            │ status/agent_{id}.json      │             │
    │            │                             │             │
    │◄───────────┤                             │             │
    │ reads checkpoint                         │             │
    │ decomposes remaining work                │             │
    ├─ spawn replacement ─────────────────────►│             │
    │ (fresh budget, checkpoint context only)  │             │
```

---

## 11. Failure Modes and Mitigations

| Failure Mode | Mitigation | Severity |
|-------------|------------|----------|
| Agent ignores CARL's injected prompt | Bodyguard verifies file-existence on next gate check — hard fail if missing | Low (agents follow system prompts) |
| CARL's token estimate diverges from actual | Reconciliation adjusts ratio; bounded by `CARL_RATIO_MIN`/`CARL_RATIO_MAX` | Low (self-correcting) |
| Agent writes to wrong sub-spine | `check_scope.py` catches it — hard fail, no skip | None (existing gate) |
| CARL process crashes | Orchestrator detects via missing heartbeat; agent continues but unmonitored | Medium (add watchdog) |
| Replacement agent can't parse checkpoint | Checkpoint format is hardcoded template — parsing is deterministic | Low (structured format) |
| Multiple CARLs compete for stdin | One CARL per process — no competition by design | None (architecture prevents) |
| Calibration ratio drifts to extreme | Bounded by `CARL_RATIO_MIN` (0.15) and `CARL_RATIO_MAX` (0.50) | None (hard bounds) |

---

## 12. What This Document Does NOT Cover

- **Implementation code** — This is a specification document. Implementation follows approval.
- **UI design for fuel gauge** — Frontend work is deferred per project rules.
- **Multi-machine orchestration** — Single machine only for now.
- **Windows/Linux paths** — macOS only (project-local `.kenoki/`) until cross-platform is needed.
- **Encryption of status files** — Status files contain operational metadata, not secrets.

---

## 13. Relationship to DEFINITIVE-ARCHITECTURE.md

This document **extends** DEFINITIVE-ARCHITECTURE.md. It does not replace or contradict it.

| DEFINITIVE-ARCHITECTURE.md | This Document |
|----------------------------|---------------|
| Defines the 11-check system | Adds CARL as the runtime monitor that triggers checks |
| Defines Context Warden concept | Specifies CARL as the concrete implementation |
| Defines bodyguard gate flow | Specifies where CARL status feeds into gates |
| Defines scope enforcement | Specifies how sub-spine write isolation uses scope enforcement |
| Defines tier classification actors | References `context_warden` actor already listed in Tier 2+ |
| Says "code enforces, not polite requests" | CARL is the embodiment — math enforces, not AI |

The Context Warden referenced in DEFINITIVE-ARCHITECTURE.md's tier classifications and the `context-warden:*` events in the status agent translator — CARL is the concrete implementation of that concept.
