# Kenoki Project Structure & Agent Sandboxing

**Status:** Design
**Principle:** Working directory = permission boundary

---

## Core Insight

```bash
# Sub-agent can ONLY see their sandbox
cd ~/.kenoki/projects/project1/backend/subagents/agent_abc123 && claude --dangerously-skip-permissions
# Agent sees: ./tasklist.md, ./sub_spine.md — NOTHING ELSE ✅

# If launched from root — agent sees EVERYTHING
cd ~/.kenoki/projects && claude --dangerously-skip-permissions
# Agent sees: ALL projects, ALL agents — DANGEROUS ❌
```

**The launch directory IS the sandbox.**

---

## Directory Structure

```
~/.kenoki/
├── config.json                    # Global Kenoki settings
├── templates/                     # Pre-built scaffolding
│   ├── project/                   # New project template
│   ├── agent/                     # New agent template
│   └── foundation/                # Foundation files (CLAUDE.md, etc.)
│
├── monkey/                        # Curious-Monkey workspace (READ by PA)
│   ├── detections.jsonl           # Slop detections (Monkey writes, PA reads)
│   ├── patterns.jsonl             # Learned patterns (Monkey writes/reads)
│   └── config.json                # Monkey configuration
│
└── projects/
    ├── project1/                  # User's first project
    │   ├── PROJECT.md             # Project brief, goals
    │   ├── agent_registry.json    # All agents in this project
    │   ├── spine_master.md        # Written ONLY by orchestrator
    │   │
    │   ├── storekeeper/           # Tool inventory for this project
    │   │   ├── skills/            # Available skills
    │   │   ├── mcps/              # MCP connections
    │   │   └── plugins/           # Plugin configs
    │   │
    │   ├── status_agent/          # Status Agent state
    │   │   └── corrections/       # User corrections queue
    │   │
    │   ├── pa/                    # PA decision state
    │   │   ├── decisions.log
    │   │   └── skill_flags/
    │   │
    │   ├── frontend/              # Frontend domain
    │   │   ├── agent_registry.json   # Agents in this domain
    │   │   ├── tasklist.md           # Domain-level tasks
    │   │   └── subagents/
    │   │       ├── abc123_header/    # Agent by session ID
    │   │       │   ├── CLAUDE.md     # Agent-specific instructions
    │   │       │   ├── mandate.md    # What this agent must do
    │   │       │   ├── sub_spine.md  # This agent's checkpoint
    │   │       │   ├── tasklist.md   # This agent's tasks
    │   │       │   └── workspace/    # Working files
    │   │       │
    │   │       └── def456_nav/       # Another agent
    │   │           ├── CLAUDE.md
    │   │           ├── mandate.md
    │   │           ├── sub_spine.md
    │   │           └── workspace/
    │   │
    │   ├── backend/               # Backend domain
    │   │   ├── agent_registry.json
    │   │   ├── tasklist.md
    │   │   └── subagents/
    │   │       └── ghi789_api/
    │   │           └── ...
    │   │
    │   └── shared/                # Cross-domain resources
    │       ├── types/
    │       └── contracts/
    │
    ├── project2/
    │   └── ...
    │
    └── project3/
        └── ...
```

---

## Registry Files

### Project-Level Registry: `agent_registry.json`

```json
{
  "version": 1,
  "project": "project1",
  "orchestrator": {
    "sessionId": "orch_xyz789",
    "runtime": "claude-code",
    "status": "ALIVE",
    "spawnedAt": "2026-03-06T10:00:00Z"
  },
  "domains": {
    "frontend": {
      "path": "./frontend",
      "activeAgents": 2,
      "registryPath": "./frontend/agent_registry.json"
    },
    "backend": {
      "path": "./backend",
      "activeAgents": 1,
      "registryPath": "./backend/agent_registry.json"
    }
  },
  "totalAgents": {
    "alive": 3,
    "dead": 1,
    "paused": 0
  }
}
```

### Domain-Level Registry: `frontend/agent_registry.json`

```json
{
  "version": 1,
  "domain": "frontend",
  "agents": {
    "abc123_header": {
      "sessionId": "conv_abc123",
      "runtime": "claude-code",
      "role": "HEADER_COMPONENT",
      "mandate": "Build responsive header with navigation",
      "status": "ALIVE",
      "spawnedAt": "2026-03-06T10:15:00Z",
      "workingDir": "./subagents/abc123_header",
      "tokenUsage": { "current": 45000, "limit": 200000, "percent": 22.5 }
    },
    "def456_nav": {
      "sessionId": "conv_def456",
      "runtime": "codex",
      "role": "NAV_COMPONENT",
      "mandate": "Build navigation menu with dropdowns",
      "status": "DEAD",
      "spawnedAt": "2026-03-06T10:20:00Z",
      "killedAt": "2026-03-06T10:50:00Z",
      "killReason": "TOKEN_BREACH",
      "replacedBy": "jkl012_nav",
      "workingDir": "./subagents/def456_nav"
    },
    "jkl012_nav": {
      "sessionId": "conv_jkl012",
      "runtime": "codex",
      "role": "NAV_COMPONENT",
      "mandate": "Continue navigation — finish dropdowns",
      "status": "ALIVE",
      "spawnedAt": "2026-03-06T10:51:00Z",
      "replacedAgent": "def456_nav",
      "handoverFrom": "./subagents/def456_nav/handover.md",
      "workingDir": "./subagents/jkl012_nav",
      "tokenUsage": { "current": 12000, "limit": 100000, "percent": 12.0 }
    }
  }
}
```

---

## Curious-Monkey Integration

The `.kenoki/monkey/` directory enables the Curious-Monkey slop detection system to communicate with PA.

### Data Flow

```
┌─────────────────────┐          ┌─────────────────────┐
│   Curious-Monkey    │          │         PA          │
│   (Detection Agent) │          │  (Decision Engine)  │
└─────────┬───────────┘          └───────────┬─────────┘
          │                                  │
          │ WRITES                     READS │
          ▼                                  ▼
   ┌──────────────────────────────────────────────┐
   │           detections.jsonl                   │
   │  { "type": "slop", "pattern": "...", ... }   │
   └──────────────────────────────────────────────┘
                         │
                         ▼
              PA processes detection
              PA writes decision back
                         │
                         ▼
   ┌──────────────────────────────────────────────┐
   │            patterns.jsonl                    │
   │  { "detection": "...", "outcome": "...", }   │
   └──────────────────────────────────────────────┘
                         │
                         │ Monkey OBSERVES
                         ▼
              Monkey learns correlations
              between detections and outcomes
```

### File Descriptions

| File | Writer | Reader | Purpose |
|------|--------|--------|---------|
| `detections.jsonl` | Monkey | PA | New slop/pattern detections for PA to evaluate |
| `patterns.jsonl` | Both | Both | Learned correlations between detections and PA outcomes |
| `config.json` | User | Monkey | Monkey configuration (sensitivity, enabled patterns) |

### Detection Format

```json
{
  "id": "det_abc123",
  "timestamp": "2026-03-06T10:00:00Z",
  "type": "slop",
  "pattern": "repeated_apology",
  "agent": "abc123_header",
  "context": "Agent apologized 3 times in last 5 checkpoints",
  "confidence": 0.85,
  "suggestion": "Issue correction to reduce apologetic language"
}
```

### Pattern Learning Format

```json
{
  "detection_type": "repeated_apology",
  "pa_decision": "CORRECTION_ISSUED",
  "outcome": "RESOLVED",
  "correlation_strength": 0.92,
  "sample_size": 47,
  "last_updated": "2026-03-06T10:05:00Z"
}
```

### Learning Loop

1. **Monkey detects** — Writes to `detections.jsonl`
2. **PA reads detection** — Evaluates and decides action
3. **PA writes decision** — Appends outcome to `patterns.jsonl`
4. **Monkey observes outcome** — Updates correlation strength
5. **Monkey improves** — Adjusts detection confidence based on PA feedback

This creates a reinforcement loop where Monkey learns which detections lead to successful PA interventions.

---

## Agent Spawn Command Template

```bash
# Template with variable insertion
cd ~/.kenoki/projects/{{ project_name }}/{{ domain }}/subagents/{{ session_id }}_{{ role_slug }} && \
  {{ runtime }} --dangerously-skip-permissions
```

### Examples

```bash
# Spawn frontend header agent
cd ~/.kenoki/projects/mywebsite/frontend/subagents/abc123_header && \
  claude --dangerously-skip-permissions

# Spawn backend API agent
cd ~/.kenoki/projects/mywebsite/backend/subagents/ghi789_api && \
  codex --full-auto

# Spawn orchestrator (project-level, NOT domain-level)
cd ~/.kenoki/projects/mywebsite && \
  claude --dangerously-skip-permissions
```

---

## Permission Boundaries

| Agent Type | Working Directory | Can See | Cannot See |
|------------|-------------------|---------|------------|
| **Orchestrator** | `~/.kenoki/projects/project1/` | All domains, all registries, spine_master | Other projects |
| **Domain Lead** | `~/.kenoki/projects/project1/frontend/` | All subagents in domain | Backend, other domains |
| **Sub-Agent** | `~/.kenoki/projects/project1/frontend/subagents/abc123/` | Own workspace only | Other subagents |

**The launch directory enforces the sandbox.**

---

## Project Scaffolding

### On "New Project" Command

```typescript
async function createProject(projectName: string): Promise<void> {
  const projectDir = path.join(KENOKI_PROJECTS_DIR, projectName);

  // 1. Create directory structure
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(projectDir, 'storekeeper/skills'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'storekeeper/mcps'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'storekeeper/plugins'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'status_agent/corrections'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'pa/skill_flags'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'frontend/subagents'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'backend/subagents'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'shared'), { recursive: true });

  // 2. Copy foundation templates
  await copyTemplate('foundation/CLAUDE.md', path.join(projectDir, 'CLAUDE.md'));
  await copyTemplate('foundation/PROJECT.md', path.join(projectDir, 'PROJECT.md'));

  // 3. Initialize registries
  await writeJson(path.join(projectDir, 'agent_registry.json'), {
    version: 1,
    project: projectName,
    orchestrator: null,
    domains: {},
    totalAgents: { alive: 0, dead: 0, paused: 0 },
  });

  // 4. Initialize spine
  await fs.writeFile(path.join(projectDir, 'spine_master.md'), `# Spine Master — ${projectName}\n\nNo agents spawned yet.\n`);
}
```

### On "Spawn Agent" Command

```typescript
async function spawnAgent(options: {
  projectName: string;
  domain: string;
  roleSlug: string;
  mandate: string;
  runtime: 'codex' | 'claude-code';
}): Promise<string> {
  const { projectName, domain, roleSlug, mandate, runtime } = options;

  // 1. Generate session ID (will be replaced by actual CLI response)
  const tempId = crypto.randomUUID().split('-')[0];
  const agentDir = path.join(
    KENOKI_PROJECTS_DIR,
    projectName,
    domain,
    'subagents',
    `${tempId}_${roleSlug}`
  );

  // 2. Create agent directory
  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(path.join(agentDir, 'workspace'), { recursive: true });

  // 3. Copy agent templates with variable substitution
  await copyTemplateWithVars('agent/CLAUDE.md', path.join(agentDir, 'CLAUDE.md'), {
    PROJECT_NAME: projectName,
    DOMAIN: domain,
    ROLE: roleSlug,
    MANDATE: mandate,
  });

  await fs.writeFile(path.join(agentDir, 'mandate.md'), `# Mandate\n\n${mandate}\n`);
  await fs.writeFile(path.join(agentDir, 'sub_spine.md'), `# Sub-Spine\n\nNo checkpoints yet.\n`);
  await fs.writeFile(path.join(agentDir, 'tasklist.md'), `# Tasks\n\n- [ ] Initial setup\n`);

  // 4. Spawn the CLI
  const spawnCmd = runtime === 'codex'
    ? `cd "${agentDir}" && codex --full-auto`
    : `cd "${agentDir}" && claude --dangerously-skip-permissions`;

  // Returns actual session ID from CLI
  const sessionId = await spawnCLI(spawnCmd);

  // 5. Rename directory with real session ID
  const finalDir = path.join(
    KENOKI_PROJECTS_DIR,
    projectName,
    domain,
    'subagents',
    `${sessionId}_${roleSlug}`
  );
  await fs.rename(agentDir, finalDir);

  // 6. Register agent
  await registerAgentInDomain(projectName, domain, {
    sessionId,
    runtime,
    role: roleSlug.toUpperCase(),
    mandate,
    status: 'ALIVE',
    workingDir: finalDir,
  });

  return sessionId;
}
```

---

## Foundation Templates

### `templates/foundation/CLAUDE.md`

```markdown
# Project: {{ PROJECT_NAME }}

## You Are
An AI agent working within the Kenoki orchestration system.

## Your Sandbox
You can ONLY read/write files in your working directory.
Do NOT attempt to access parent directories.
Do NOT attempt to access other agents' directories.

## Your Mandate
Read `./mandate.md` for your specific instructions.

## Your Checkpoint
Write your progress to `./sub_spine.md` frequently.
Format:
```
## Checkpoint N | {{ percent }}% context used
**Completed:** List of done items
**In Progress:** Current work
**Blocked:** Any blockers
**Files:** Files you touched
**Next:** What comes next
```

## Your Tasks
Check `./tasklist.md` for assigned work.
Mark items complete as you finish them.

## Corrections
If you receive a correction file, apply it immediately.
```

### `templates/agent/CLAUDE.md`

```markdown
# Agent: {{ ROLE }}
**Project:** {{ PROJECT_NAME }}
**Domain:** {{ DOMAIN }}

## Mandate
{{ MANDATE }}

## Workspace Rules
1. All work happens in `./workspace/`
2. Update `./sub_spine.md` after each significant progress
3. Check `./tasklist.md` for assignments
4. DO NOT access files outside this directory

## Handover
If you receive a handover file, read it first to understand context.

## Completion
When your mandate is complete, write a final checkpoint and signal done.
```

---

## PA File Watchers

PA monitors these files for changes and reacts accordingly:

| File Path | Watcher | Action on Change |
|-----------|---------|------------------|
| `~/.kenoki/projects/*/agent_registry.json` | PA | Update agent tracking, detect new spawns |
| `~/.kenoki/projects/*/*/subagents/*/sub_spine.md` | PA | Analyze progress, detect stuck agents |
| `~/.kenoki/monkey/detections.jsonl` | PA | Process new detections, decide action |
| `~/.kenoki/projects/*/status_agent/corrections/*` | PA | Track correction delivery status |
| `~/.kenoki/projects/*/spine_master.md` | PA | Sync with orchestrator state |

### Monkey Detection Processing

When PA's file watcher detects changes to `.kenoki/monkey/detections.jsonl`:

1. **Read new lines** — Parse JSONL entries since last read position
2. **Evaluate each detection** — Apply PA decision logic
3. **Take action** — Issue correction, flag skill, or ignore
4. **Record outcome** — Write decision to `patterns.jsonl` for Monkey to observe

```typescript
fileWatcher.on('change', '.kenoki/monkey/detections.jsonl', async () => {
  const newDetections = await readNewLines('detections.jsonl');

  for (const detection of newDetections) {
    const decision = await paEvaluate(detection);

    if (decision.action === 'CORRECTION') {
      await writeCorrection(detection.agent, decision.correction);
    }

    // Write outcome for Monkey to learn from
    await appendToPatterns({
      detection_type: detection.type,
      pa_decision: decision.action,
      outcome: 'PENDING', // Updated later when agent responds
    });
  }
});
```

---

## PA Read-Only Access

```typescript
// PA reads from registries but NEVER writes agent data
// PA can only write to: corrections/, skill_flags/, decisions.log

async function paRoutineCheck(projectDir: string): Promise<void> {
  // 1. Read project registry (READ ONLY)
  const projectRegistry = await readJson(path.join(projectDir, 'agent_registry.json'));

  // 2. For each domain, read domain registry (READ ONLY)
  for (const [domain, info] of Object.entries(projectRegistry.domains)) {
    const domainRegistry = await readJson(info.registryPath);

    // 3. For each alive agent, read their sub_spine (READ ONLY)
    for (const [agentId, agent] of Object.entries(domainRegistry.agents)) {
      if (agent.status !== 'ALIVE') continue;

      const subSpine = await readFile(path.join(agent.workingDir, 'sub_spine.md'));

      // 4. Detect patterns (repeated errors, stuck, etc.)
      const issues = analyzeSubSpine(subSpine);

      if (issues.repeatedError) {
        // WRITE ONLY to skill_flags/
        await writeSkillFlag(projectDir, agentId, issues.suggestedSkill);
      }

      if (issues.stuck) {
        // WRITE ONLY to corrections/
        await writeCorrection(projectDir, agentId, 'Consider alternative approach...');
      }
    }
  }
}
```

---

## Variable Insertion for Spawn Commands

```typescript
interface SpawnConfig {
  project_name: string;
  domain: string;        // 'frontend' | 'backend' | 'shared'
  agent_role: string;    // 'header' | 'api' | etc.
  sub: string | null;    // session_id or null for domain lead
  runtime: 'codex' | 'claude-code';
}

function buildSpawnCommand(config: SpawnConfig): string {
  const basePath = `~/.kenoki/projects/${config.project_name}/${config.domain}`;

  const workDir = config.sub
    ? `${basePath}/subagents/${config.sub}_${config.agent_role}`
    : basePath;

  const cli = config.runtime === 'codex'
    ? 'codex --full-auto'
    : 'claude --dangerously-skip-permissions';

  return `cd "${workDir}" && ${cli}`;
}

// Examples:
buildSpawnCommand({
  project_name: 'mywebsite',
  domain: 'frontend',
  agent_role: 'header',
  sub: 'abc123',
  runtime: 'claude-code'
});
// → cd "~/.kenoki/projects/mywebsite/frontend/subagents/abc123_header" && claude --dangerously-skip-permissions

buildSpawnCommand({
  project_name: 'mywebsite',
  domain: 'frontend',
  agent_role: 'lead',
  sub: null,
  runtime: 'claude-code'
});
// → cd "~/.kenoki/projects/mywebsite/frontend" && claude --dangerously-skip-permissions
```

---

## Summary

| Concept | Implementation |
|---------|----------------|
| Project isolation | `~/.kenoki/projects/{project}/` |
| Domain isolation | `~/.kenoki/projects/{project}/{domain}/` |
| Agent sandboxing | Launch CLI from agent's directory |
| Session ID = identity | `{session_id}_{role}` folder naming |
| Registry as truth | `agent_registry.json` at project + domain level |
| PA read-only | PA reads registries, writes only to corrections/flags |
| Monkey integration | `~/.kenoki/monkey/` for slop detection + learning |
| Pattern learning | `patterns.jsonl` stores detection → outcome correlations |
| Template scaffolding | Copy from `~/.kenoki/templates/` on create |
| Variable insertion | `{{ project_name }}`, `{{ domain }}`, `{{ sub }}` |

**The filesystem IS the permission system.**
