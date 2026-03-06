/**
 * Agent Registry — Session ID = Agent Identity
 *
 * Every CLI agent (Codex, Claude Code) returns a session_id when spawned.
 * That session_id IS the agent's identity. No descriptive names.
 *
 * The registry maps:
 * - Session IDs → Agent metadata
 * - Roles (FRONTEND, BACKEND) → Current agent filling that slot
 * - Replacement chains → Which agent replaced which
 *
 * This prevents hallucination about agent identities.
 */

import * as fs from 'fs';
import * as path from 'path';
import { STOREKEEPER_CONSTANTS } from '../storekeeper/types';

// =============================================================================
// TYPES
// =============================================================================

export type AgentRuntime = 'codex' | 'claude-code' | 'chatgpt-web';
export type AgentStatus = 'ALIVE' | 'DEAD' | 'PAUSED' | 'SPAWNING';
export type KillReason =
  | 'TOKEN_BREACH'
  | 'TIMEOUT'
  | 'ERROR'
  | 'USER_STOP'
  | 'REPLACED'
  | 'PLAN_COMPLETE';

export interface TokenUsage {
  /** Current tokens used */
  current: number;
  /** Context window limit for this runtime */
  limit: number;
  /** Percentage used (current / limit * 100) */
  percent: number;
}

export interface AgentEntry {
  /** Session ID from CLI — THIS IS THE AGENT'S IDENTITY */
  id: string;

  /** Runtime that spawned this agent */
  runtime: AgentRuntime;

  /** Role slot this agent fills (FRONTEND, BACKEND, etc.) */
  role: string;

  /** What this agent is supposed to do */
  mandate: string;

  /** Current status */
  status: AgentStatus;

  /** When spawned (ISO string) */
  spawnedAt: string;

  /** When killed (ISO string), null if alive */
  killedAt: string | null;

  /** Reason for kill, null if alive */
  killReason: KillReason | null;

  /** Session ID of agent that replaced this one, null if not replaced */
  replacedBy: string | null;

  /** Session ID of agent this one replaced, null if first in role */
  replacedAgent: string | null;

  /** Path to this agent's sub-spine file */
  subSpine: string;

  /** Files this agent owns/created */
  filesOwned: string[];

  /** Path to handover file received from predecessor */
  handoverFrom: string | null;

  /** Current token usage */
  tokenUsage: TokenUsage;
}

export interface RoleSlot {
  /** Session ID of current agent filling this role */
  currentAgent: string | null;

  /** History of previous agents in this role (session IDs) */
  history: string[];
}

export interface AgentRegistry {
  /** Schema version for migrations */
  version: number;

  /** All agents by session ID */
  agents: Record<string, AgentEntry>;

  /** Role slots mapping role name → current/history */
  roles: Record<string, RoleSlot>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REGISTRY_VERSION = 1;

function getRegistryPath(projectDir: string): string {
  return path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    'registry',
    'agents.json'
  );
}

function getSubSpinePath(projectDir: string, sessionId: string): string {
  return path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    'sub_spines',
    `sub_spine_${sessionId}.md`
  );
}

// =============================================================================
// REGISTRY OPERATIONS
// =============================================================================

/**
 * Load the agent registry from disk.
 * Creates empty registry if none exists.
 */
export function loadRegistry(projectDir: string): AgentRegistry {
  const registryPath = getRegistryPath(projectDir);

  if (!fs.existsSync(registryPath)) {
    return {
      version: REGISTRY_VERSION,
      agents: {},
      roles: {},
    };
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    return JSON.parse(content) as AgentRegistry;
  } catch {
    console.error('[Registry] Failed to parse registry, returning empty');
    return {
      version: REGISTRY_VERSION,
      agents: {},
      roles: {},
    };
  }
}

/**
 * Save the agent registry to disk.
 */
export function saveRegistry(projectDir: string, registry: AgentRegistry): void {
  const registryPath = getRegistryPath(projectDir);
  const registryDir = path.dirname(registryPath);

  // Ensure directory exists
  if (!fs.existsSync(registryDir)) {
    fs.mkdirSync(registryDir, { recursive: true });
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Register a new agent.
 * Automatically handles:
 * - Adding to agents map
 * - Updating role slot
 * - Marking previous agent as replaced
 */
export function registerAgent(
  projectDir: string,
  entry: Omit<AgentEntry, 'subSpine' | 'status' | 'killedAt' | 'killReason' | 'replacedBy' | 'replacedAgent'>
): AgentEntry {
  const registry = loadRegistry(projectDir);

  // Build full entry
  const fullEntry: AgentEntry = {
    ...entry,
    status: 'ALIVE',
    subSpine: getSubSpinePath(projectDir, entry.id),
    killedAt: null,
    killReason: null,
    replacedBy: null,
    replacedAgent: null,
  };

  // Get or create role slot
  const role = registry.roles[entry.role] || { currentAgent: null, history: [] };

  // If there's a previous agent in this role, mark it as replaced
  if (role.currentAgent && role.currentAgent !== entry.id) {
    const previousAgent = registry.agents[role.currentAgent];

    if (previousAgent && previousAgent.status === 'ALIVE') {
      // Mark previous agent as dead/replaced
      previousAgent.status = 'DEAD';
      previousAgent.killedAt = new Date().toISOString();
      previousAgent.killReason = 'REPLACED';
      previousAgent.replacedBy = entry.id;

      // Link new agent to previous
      fullEntry.replacedAgent = role.currentAgent;
    }

    // Add to history
    role.history.push(role.currentAgent);
  }

  // Update current agent in role
  role.currentAgent = entry.id;
  registry.roles[entry.role] = role;

  // Add to agents map
  registry.agents[entry.id] = fullEntry;

  saveRegistry(projectDir, registry);

  return fullEntry;
}

/**
 * Kill an agent with a reason.
 */
export function killAgent(
  projectDir: string,
  sessionId: string,
  reason: KillReason
): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  const agent = registry.agents[sessionId];

  if (!agent) {
    console.error(`[Registry] Agent not found: ${sessionId}`);
    return null;
  }

  agent.status = 'DEAD';
  agent.killedAt = new Date().toISOString();
  agent.killReason = reason;

  saveRegistry(projectDir, registry);

  return agent;
}

/**
 * Pause an agent (waiting for user input, rate limited, etc.)
 */
export function pauseAgent(projectDir: string, sessionId: string): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  const agent = registry.agents[sessionId];

  if (!agent) {
    console.error(`[Registry] Agent not found: ${sessionId}`);
    return null;
  }

  agent.status = 'PAUSED';

  saveRegistry(projectDir, registry);

  return agent;
}

/**
 * Resume a paused agent.
 */
export function resumeAgent(projectDir: string, sessionId: string): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  const agent = registry.agents[sessionId];

  if (!agent) {
    console.error(`[Registry] Agent not found: ${sessionId}`);
    return null;
  }

  if (agent.status !== 'PAUSED') {
    console.warn(`[Registry] Agent ${sessionId} is not paused, current status: ${agent.status}`);
    return agent;
  }

  agent.status = 'ALIVE';

  saveRegistry(projectDir, registry);

  return agent;
}

/**
 * Update token usage for an agent.
 */
export function updateTokenUsage(
  projectDir: string,
  sessionId: string,
  usage: TokenUsage
): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  const agent = registry.agents[sessionId];

  if (!agent) {
    console.error(`[Registry] Agent not found: ${sessionId}`);
    return null;
  }

  agent.tokenUsage = usage;

  saveRegistry(projectDir, registry);

  return agent;
}

/**
 * Add files to agent's owned files list.
 */
export function addOwnedFiles(
  projectDir: string,
  sessionId: string,
  files: string[]
): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  const agent = registry.agents[sessionId];

  if (!agent) {
    console.error(`[Registry] Agent not found: ${sessionId}`);
    return null;
  }

  // Add new files, avoiding duplicates
  for (const file of files) {
    if (!agent.filesOwned.includes(file)) {
      agent.filesOwned.push(file);
    }
  }

  saveRegistry(projectDir, registry);

  return agent;
}

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get an agent by session ID.
 */
export function getAgent(projectDir: string, sessionId: string): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  return registry.agents[sessionId] || null;
}

/**
 * Get the current agent filling a role slot.
 * Returns null if no agent is in that role.
 */
export function getCurrentAgent(projectDir: string, role: string): AgentEntry | null {
  const registry = loadRegistry(projectDir);
  const roleSlot = registry.roles[role];

  if (!roleSlot || !roleSlot.currentAgent) {
    return null;
  }

  const agent = registry.agents[roleSlot.currentAgent];

  // Only return if agent is alive
  if (agent && agent.status === 'ALIVE') {
    return agent;
  }

  return null;
}

/**
 * Get all currently alive agents.
 */
export function getAliveAgents(projectDir: string): AgentEntry[] {
  const registry = loadRegistry(projectDir);
  return Object.values(registry.agents).filter((a) => a.status === 'ALIVE');
}

/**
 * Get all agents in a specific role (including dead ones).
 */
export function getAgentsByRole(projectDir: string, role: string): AgentEntry[] {
  const registry = loadRegistry(projectDir);
  return Object.values(registry.agents).filter((a) => a.role === role);
}

/**
 * Get agent history for a role (ordered oldest to newest).
 */
export function getRoleHistory(projectDir: string, role: string): AgentEntry[] {
  const registry = loadRegistry(projectDir);
  const roleSlot = registry.roles[role];

  if (!roleSlot) {
    return [];
  }

  const history: AgentEntry[] = [];

  // Add historical agents
  for (const sessionId of roleSlot.history) {
    const agent = registry.agents[sessionId];
    if (agent) {
      history.push(agent);
    }
  }

  // Add current agent
  if (roleSlot.currentAgent) {
    const current = registry.agents[roleSlot.currentAgent];
    if (current) {
      history.push(current);
    }
  }

  return history;
}

/**
 * Find which agent owns a specific file.
 */
export function findOwnerAgent(projectDir: string, filePath: string): AgentEntry | null {
  const registry = loadRegistry(projectDir);

  // First check alive agents
  for (const agent of Object.values(registry.agents)) {
    if (agent.status === 'ALIVE' && agent.filesOwned.includes(filePath)) {
      return agent;
    }
  }

  // Then check all agents (for historical lookup)
  for (const agent of Object.values(registry.agents)) {
    if (agent.filesOwned.includes(filePath)) {
      return agent;
    }
  }

  return null;
}

/**
 * Trace the replacement chain for an agent.
 * Returns ordered list: [original, replacement1, replacement2, current]
 */
export function traceReplacementChain(projectDir: string, sessionId: string): AgentEntry[] {
  const registry = loadRegistry(projectDir);
  const chain: AgentEntry[] = [];
  let currentId: string | null = sessionId;

  // Walk backwards to find origin
  while (currentId) {
    const foundAgent: AgentEntry | undefined = registry.agents[currentId];
    if (!foundAgent) break;

    chain.unshift(foundAgent);
    currentId = foundAgent.replacedAgent;
  }

  // Now walk forwards to find latest
  currentId = registry.agents[sessionId]?.replacedBy || null;
  while (currentId) {
    const nextAgent: AgentEntry | undefined = registry.agents[currentId];
    if (!nextAgent) break;

    chain.push(nextAgent);
    currentId = nextAgent.replacedBy;
  }

  return chain;
}

// =============================================================================
// UTILITY OPERATIONS
// =============================================================================

/**
 * Get all defined roles.
 */
export function getRoles(projectDir: string): string[] {
  const registry = loadRegistry(projectDir);
  return Object.keys(registry.roles);
}

/**
 * Check if a role has an active agent.
 */
export function isRoleFilled(projectDir: string, role: string): boolean {
  return getCurrentAgent(projectDir, role) !== null;
}

/**
 * Get summary stats about the registry.
 */
export function getRegistryStats(projectDir: string): {
  totalAgents: number;
  aliveAgents: number;
  deadAgents: number;
  pausedAgents: number;
  filledRoles: number;
  totalRoles: number;
} {
  const registry = loadRegistry(projectDir);
  const agents = Object.values(registry.agents);

  return {
    totalAgents: agents.length,
    aliveAgents: agents.filter((a) => a.status === 'ALIVE').length,
    deadAgents: agents.filter((a) => a.status === 'DEAD').length,
    pausedAgents: agents.filter((a) => a.status === 'PAUSED').length,
    filledRoles: Object.values(registry.roles).filter((r) => {
      const current = registry.agents[r.currentAgent || ''];
      return current && current.status === 'ALIVE';
    }).length,
    totalRoles: Object.keys(registry.roles).length,
  };
}
