# Agent Registry Specification

**Status:** Design
**Problem:** Agent identity must be concrete, not descriptive

---

## The Problem

```
❌ BAD: "FRONTEND-SUB-AGENT-1"

What if that agent got killed for token breach?
Agent-1 is dead. Agent-4 replaced it.
But Agent-4 is doing Agent-1's WORK.

Which is which? PA doesn't know.
```

**Descriptive names cause:**
- Hallucination about who's alive
- Confusion when agents are replaced
- No audit trail of agent lifecycles

---

## The Solution: Session ID = Agent Handle

Codex and Claude Code both return a `conversation_id` or `session_id`:

```json
// Codex session
{ "session_id": "019cb484-9325-73e3-be57-d379cf90cb12" }

// Claude Code session
{ "conversation_id": "conv_abc123xyz789" }
```

**This ID is the agent's handle. Period.**

No descriptive names. No "frontend agent 1". Just the session ID.

---

## Agent Registry File

**Location:** `.kenoki/registry/agents.json`

```json
{
  "version": 1,
  "agents": {
    "019cb484-9325-73e3-be57-d379cf90cb12": {
      "runtime": "codex",
      "role": "FRONTEND",
      "mandate": "Header, Footer, Nav components",
      "status": "DEAD",
      "spawnedAt": "2026-03-06T10:15:00Z",
      "killedAt": "2026-03-06T10:45:32Z",
      "killReason": "TOKEN_BREACH",
      "replacedBy": "019cb484-9325-73e3-be57-e8a1bc456def",
      "subSpine": "sub_spine_019cb484-9325-73e3-be57-d379cf90cb12.md",
      "filesOwned": ["src/components/Header.tsx", "src/components/Footer.tsx"],
      "tokenUsage": {
        "final": 87500,
        "limit": 100000,
        "percent": 87.5
      }
    },
    "019cb484-9325-73e3-be57-e8a1bc456def": {
      "runtime": "codex",
      "role": "FRONTEND",
      "mandate": "Continue Header, Footer, Nav — finish Nav styling",
      "status": "ALIVE",
      "spawnedAt": "2026-03-06T10:45:45Z",
      "killedAt": null,
      "killReason": null,
      "replacedBy": null,
      "replacedAgent": "019cb484-9325-73e3-be57-d379cf90cb12",
      "subSpine": "sub_spine_019cb484-9325-73e3-be57-e8a1bc456def.md",
      "filesOwned": ["src/components/Header.tsx", "src/components/Footer.tsx", "src/components/Nav.tsx"],
      "handoverFrom": ".kenoki/handovers/019cb484-9325-73e3-be57-d379cf90cb12_handover.md",
      "tokenUsage": {
        "current": 12000,
        "limit": 100000,
        "percent": 12.0
      }
    },
    "conv_abc123xyz789": {
      "runtime": "claude-code",
      "role": "BACKEND",
      "mandate": "API endpoints for contact form",
      "status": "ALIVE",
      "spawnedAt": "2026-03-06T10:20:00Z",
      "killedAt": null,
      "subSpine": "sub_spine_conv_abc123xyz789.md",
      "filesOwned": ["src/api/contact.ts", "src/api/validation.ts"],
      "tokenUsage": {
        "current": 45000,
        "limit": 200000,
        "percent": 22.5
      }
    }
  },
  "roles": {
    "FRONTEND": {
      "currentAgent": "019cb484-9325-73e3-be57-e8a1bc456def",
      "history": [
        "019cb484-9325-73e3-be57-d379cf90cb12"
      ]
    },
    "BACKEND": {
      "currentAgent": "conv_abc123xyz789",
      "history": []
    }
  }
}
```

---

## Key Principles

### 1. Session ID = Identity

```typescript
// When spawning agent
const sessionId = await codexAdapter.spawn(mandate);

// Register immediately
registry.register({
  id: sessionId,           // "019cb484-9325-73e3-be57-d379cf90cb12"
  runtime: 'codex',
  role: 'FRONTEND',
  mandate: 'Header, Footer, Nav components',
  status: 'ALIVE',
});
```

### 2. Role is a Slot, Not a Name

A **role** is a logical slot (FRONTEND, BACKEND, STYLING).
An **agent** fills that slot temporarily.

```
FRONTEND slot:
  └── Agent-019cb484... (DEAD, replaced)
      └── Agent-e8a1bc456... (ALIVE, current)
```

### 3. Handover Chain is Traceable

```json
{
  "019cb484-9325-73e3-be57-d379cf90cb12": {
    "status": "DEAD",
    "replacedBy": "e8a1bc456def..."
  },
  "019cb484-9325-73e3-be57-e8a1bc456def": {
    "status": "ALIVE",
    "replacedAgent": "d379cf90cb12..."
  }
}
```

PA can always trace: "Who's currently in the FRONTEND slot? Follow the chain."

### 4. Sub-Spine Named After Session ID

```
.kenoki/sub_spines/
├── sub_spine_019cb484-9325-73e3-be57-d379cf90cb12.md  (archived)
├── sub_spine_019cb484-9325-73e3-be57-e8a1bc456def.md  (active)
└── sub_spine_conv_abc123xyz789.md                     (active)
```

No ambiguity. The filename IS the agent's identity.

---

## Registry Operations

### Register Agent

```typescript
// src/enforcement/registry.ts

interface AgentEntry {
  id: string;           // Session ID from CLI
  runtime: 'codex' | 'claude-code';
  role: string;         // FRONTEND, BACKEND, etc.
  mandate: string;      // What this agent is supposed to do
  status: 'ALIVE' | 'DEAD' | 'PAUSED';
  spawnedAt: string;
  killedAt: string | null;
  killReason: string | null;
  replacedBy: string | null;
  replacedAgent: string | null;
  subSpine: string;
  filesOwned: string[];
  handoverFrom: string | null;
  tokenUsage: {
    current: number;
    limit: number;
    percent: number;
  };
}

function registerAgent(entry: AgentEntry): void {
  const registry = loadRegistry();

  // Add agent to agents map
  registry.agents[entry.id] = entry;

  // Update role slot
  const role = registry.roles[entry.role] || { currentAgent: null, history: [] };

  if (role.currentAgent && role.currentAgent !== entry.id) {
    // Previous agent in this slot — mark as replaced
    role.history.push(role.currentAgent);
    registry.agents[role.currentAgent].status = 'DEAD';
    registry.agents[role.currentAgent].replacedBy = entry.id;
    entry.replacedAgent = role.currentAgent;
  }

  role.currentAgent = entry.id;
  registry.roles[entry.role] = role;

  saveRegistry(registry);
}
```

### Kill Agent

```typescript
function killAgent(id: string, reason: string): void {
  const registry = loadRegistry();
  const agent = registry.agents[id];

  if (!agent) throw new Error(`Agent not found: ${id}`);

  agent.status = 'DEAD';
  agent.killedAt = new Date().toISOString();
  agent.killReason = reason;

  saveRegistry(registry);
}
```

### Get Current Agent for Role

```typescript
function getCurrentAgent(role: string): AgentEntry | null {
  const registry = loadRegistry();
  const roleSlot = registry.roles[role];

  if (!roleSlot || !roleSlot.currentAgent) return null;

  const agent = registry.agents[roleSlot.currentAgent];
  if (agent.status !== 'ALIVE') return null;

  return agent;
}
```

### Get All Alive Agents

```typescript
function getAliveAgents(): AgentEntry[] {
  const registry = loadRegistry();
  return Object.values(registry.agents).filter(a => a.status === 'ALIVE');
}
```

---

## PA Queries Registry, Not Descriptions

**Before (hallucination-prone):**
```typescript
// ❌ BAD: PA guesses based on descriptions
const frontendAgent = agents.find(a => a.name.includes('frontend'));
```

**After (concrete):**
```typescript
// ✅ GOOD: PA queries registry
const frontendAgent = registry.getCurrentAgent('FRONTEND');
// Returns: { id: "019cb484...", status: "ALIVE", ... }

// Or get by session ID directly
const agent = registry.getAgent("019cb484-9325-73e3-be57-e8a1bc456def");
```

---

## Corrections Route to Session ID

```
User: "Actually make the button blue"
        │
        ▼
Status Agent classifies: DESIGN/STYLING
        │
        ▼
PA queries: registry.getCurrentAgent('FRONTEND')
        │
        ▼
Returns: { id: "019cb484-9325-73e3-be57-e8a1bc456def", ... }
        │
        ▼
PA writes: .kenoki/corrections/019cb484-9325-73e3-be57-e8a1bc456def.md
        │
        ▼
Hard rail injects into agent "019cb484-9325-73e3-be57-e8a1bc456def"
```

No guessing. No "frontend agent". Just the session ID.

---

## Agent Spawn Flow

```
1. Conductor determines: need FRONTEND agent
        │
        ▼
2. Storekeeper approves tools for mandate
        │
        ▼
3. CLI adapter spawns Codex/Claude
        │
        ├── Returns: session_id = "019cb484..."
        │
        ▼
4. Registry.registerAgent({
     id: "019cb484...",
     runtime: "codex",
     role: "FRONTEND",
     mandate: "Header, Footer, Nav",
     status: "ALIVE",
     spawnedAt: now(),
     subSpine: "sub_spine_019cb484....md"
   })
        │
        ▼
5. Agent starts executing
        │
        ├── Writes to: sub_spine_019cb484....md
        │
        ▼
6. CARL monitors token usage
        │
        ├── Updates: registry.agents["019cb484..."].tokenUsage
        │
        ▼
7. If RED:
     - killAgent("019cb484...", "TOKEN_BREACH")
     - Spawn replacement → new session ID
     - Link: replacedBy / replacedAgent
```

---

## Role Slots vs Agent Count

**Roles are fixed slots. Agents are temporary occupants.**

```
Roles (slots):
├── FRONTEND     ← always exists
├── BACKEND      ← always exists
├── STYLING      ← optional
└── INTEGRATION  ← optional

Agents (occupants):
├── 019cb484... fills FRONTEND (ALIVE)
├── conv_abc... fills BACKEND (ALIVE)
├── d379cf90... was FRONTEND (DEAD, replaced by 019cb484...)
└── (no agent in STYLING or INTEGRATION currently)
```

---

## Preventing Hallucination

| Risk | Mitigation |
|------|------------|
| PA invents agent IDs | Registry is read-only source of truth |
| PA addresses dead agents | Query by role → registry returns only ALIVE |
| PA confuses which agent does what | Mandate field is explicit, but routing uses role slot |
| Agent claims wrong files | Bodyguard validates filesOwned against sub-spine |
| Session ID collision | Codex/Claude generate UUIDs — collision probability negligible |

---

## Summary

| Before | After |
|--------|-------|
| "frontend-sub-agent-1" | "019cb484-9325-73e3-be57-d379cf90cb12" |
| Descriptive names | Session IDs |
| PA guesses | PA queries registry |
| Dead agents haunt | Dead agents marked, chain traced |
| Sub-spine naming confusion | sub_spine_{session_id}.md |

**The session ID IS the agent. The registry IS the truth. Everything else references these.**
