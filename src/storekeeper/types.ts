/**
 * Storekeeper Types — Tool/Skill/Plugin provisioning layer
 *
 * The Storekeeper is the "clerk" — agents request tools, the clerk reads
 * the task, provisions the right skills/MCPs/plugins, and removes them
 * when no longer needed. File-based IPC via requests/responses directories.
 *
 * See: CARL-TASK-SPINE-ARCHITECTURE.md Section 4
 */

export const STOREKEEPER_CONSTANTS = {
  /** Hidden project workspace root (like .git/ inside a project) */
  KENOKI_DIR: '.kenoki',

  /** File-based IPC directories */
  REQUESTS_DIR: 'requests',
  RESPONSES_DIR: 'responses',

  /** Audit trail for tool provisioning decisions */
  AUDIT_DIR: 'audit',

  /** Available tools/skills/MCPs/plugins inventory */
  INVENTORY_DIR: 'inventory',

  /** Request processing timeout */
  PROCESSING_TIMEOUT_MS: 10_000,

  /** Hard ceiling on simultaneous active skills per agent */
  MAX_SKILLS_ABSOLUTE: 5,

  /** Token budget per injected skill */
  MAX_SKILL_TOKENS: 4_000,

  /** Skills always loaded regardless of task (phase lifecycle) */
  FOUNDATION_SKILLS: [
    'phases/discuss.md',
    'phases/plan.md',
    'phases/implement.md',
    'phases/verify.md',
    'checkpoint.md',
  ],
} as const;

// ============================================================================
// TOOL REQUEST / RESPONSE (runtime-level, used by engineer's modules)
// ============================================================================

/** Tool request from a worker to the storekeeper */
export interface ToolRequest {
  /** Unique request identifier */
  requestId: string;
  /** Worker that submitted the request */
  workerId: string;
  /** Step ID from the scheduler */
  stepId: string;
  /** ISO timestamp */
  timestamp: string;
  /** SHA256 signature for validation */
  signature: string;
  /** Task context */
  task: {
    action: string;
    detail: string;
    projectDir: string;
  };
  /** Requested skill paths */
  requestedSkills: string[];
  /** Requested MCP server IDs */
  requestedMcp: string[];
  /** Requested plugin IDs */
  requestedPlugins: string[];
  /** Why the worker needs these tools */
  justification: string;

  // Legacy fields (backward compat with plan-level provision code)
  /** @deprecated Use workerId */
  readonly agentId?: string;
  /** @deprecated Use task.detail */
  readonly taskContext?: string;
  /** @deprecated Use requestedSkills */
  readonly requestedTools?: readonly string[];
}

/** Storekeeper's response to a tool request */
export interface ToolResponse {
  /** Echoed request ID */
  requestId: string;
  /** ISO timestamp */
  timestamp: string;
  /** SHA256 signature from storekeeper */
  storekeeperSignature: string;
  /** Approved skills with token counts */
  approvedSkills: ApprovedSkill[];
  /** Denied skills with reasons */
  deniedSkills: DeniedSkill[];
  /** Approved MCP servers */
  approvedMcp: ApprovedMcp[];
  /** Denied MCP servers */
  deniedMcp: DeniedMcp[];
  /** Approved plugins */
  approvedPlugins: ApprovedPlugin[];
  /** Summary of what was injected */
  injectionSummary: InjectionSummary;
  /** Overall request status */
  status: 'READY' | 'PARTIAL' | 'DENIED';

  // Legacy fields (backward compat)
  /** @deprecated Use approvedSkills */
  readonly agentId?: string;
  /** @deprecated Use approvedSkills.map(s => s.path) */
  readonly approved?: readonly string[];
  /** @deprecated Use deniedSkills.map(s => s.path) */
  readonly denied?: readonly string[];
  /** @deprecated Use injectionSummary */
  readonly reason?: string;
}

// ============================================================================
// APPROVAL ENGINE TYPES
// ============================================================================

/** A skill that was approved for injection */
export interface ApprovedSkill {
  path: string;
  tokens: number;
  reason: string;
}

/** A skill that was denied */
export interface DeniedSkill {
  path: string;
  reason: string;
}

/** An MCP server that was approved */
export interface ApprovedMcp {
  id: string;
  status: 'connected' | 'pending';
  reason: string;
}

/** An MCP server that was denied */
export interface DeniedMcp {
  id: string;
  reason: string;
}

/** An approved plugin */
export interface ApprovedPlugin {
  id: string;
  reason: string;
}

/** Summary of what was injected into a worker's context */
export interface InjectionSummary {
  totalSkillTokens: number;
  tokenBudgetRemaining: number;
  skillsInjected: number;
  mcpConnected: number;
  pluginSelected: string | null;
}

/** Approval rule definition */
export interface ApprovalRule {
  name: string;
  type: 'HARD' | 'SOFT';
  check: (request: ToolRequest, inventory: Inventory) => ApprovalResult;
}

/** Result of an approval rule check */
export interface ApprovalResult {
  passed: boolean;
  reason: string;
  affected: string[];
}

/** Storekeeper approval decision */
export type ApprovalDecision = 'approved' | 'denied' | 'deferred';

// ============================================================================
// INVENTORY / CATALOG TYPES
// ============================================================================

/** Combined inventory of all available tools */
export interface Inventory {
  skills: SkillCatalogEntry[];
  mcp: McpCatalogEntry[];
  plugins: PluginCatalogEntry[];
}

/** Entry in the skill catalog (loaded from trigger-map.json + scanning) */
export interface SkillCatalogEntry {
  path: string;
  name: string;
  triggers: string[];
  estimatedTokens: number;
  type: 'foundation' | 'worker' | 'verification' | 'orchestration';
}

/** Entry in the MCP server catalog */
export interface McpCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredScopes: string[];
  status: string;
}

/** Entry in the plugin catalog */
export interface PluginCatalogEntry {
  id: string;
  name: string;
  type: string;
  command: string;
  capabilities: string[];
  requiresAuth: boolean;
}

/** Single item in the tool inventory (legacy) */
export interface InventoryItem {
  readonly name: string;
  readonly type: 'skill' | 'mcp' | 'plugin';
  readonly path: string;
  readonly tokenCost: number;
  readonly tags: readonly string[];
}

// ============================================================================
// EXECUTION CONTEXT (built by injector, consumed by worker)
// ============================================================================

/** Complete execution context for a worker */
export interface ExecutionContext {
  /** Assembled prompt with skill content */
  assembledPrompt: string;
  /** MCP connection statuses */
  mcp: Record<string, 'connected' | 'pending'>;
  /** Selected plugin ID */
  plugin: string;
  /** Execution configuration */
  config: {
    timeout: number;
    sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
    model?: string;
  };
  /** Metadata about the injection */
  meta: {
    requestId: string;
    skillsInjected: string[];
    mcpConnected: string[];
    checkoutTime: string;
  };
}

// ============================================================================
// CHECKOUT / AUDIT TYPES
// ============================================================================

/** Log entry for a tool checkout/return cycle */
export interface CheckoutLog {
  stepId: string;
  workerId: string;
  checkoutTime: string;
  returnTime: string;
  durationMs: number;
  toolsUsed: {
    skills: string[];
    mcp: string[];
    plugin: string | null;
  };
  outcome: 'success' | 'failure' | 'timeout' | 'cancelled';
  filesCreated: number;
  filesModified: number;
}

// ============================================================================
// PLAN-LEVEL PROVISIONING TYPES (used by provision.ts)
// ============================================================================

import type { ExecutionPlan } from '../main/step-scheduler';
import type { PluginConfig } from '../plugins/plugin-schema';

/** Input to the provision() function */
export interface ProvisionInput {
  /** Execution plan from the conductor */
  plan: ExecutionPlan;
  /** Path to trigger-map.json */
  catalogPath: string;
  /** Absolute path to resources/skills/ */
  skillsBasePath: string;
  /** Conductor tier: 0-3 */
  planTier: number;
}

/** Output manifest from provision() — tools selected for the entire plan */
export interface ToolManifest {
  /** Always-on skill paths (absolute) */
  foundation: string[];
  /** stepId → skill paths (absolute) */
  perStep: Map<number, string[]>;
  /** Active plugins for this plan */
  plugins: PluginConfig[];
  /** Active MCP servers (future, [] for now) */
  mcps: string[];
  /** Append-only decision log */
  audit: ProvisionAuditEntry[];
}

/** Single entry in the provisioning audit trail */
export interface ProvisionAuditEntry {
  timestamp: number;
  action: 'foundation' | 'select' | 'plugins' | 'mcps';
  stepId: number | null;
  skills?: string[];
  rejected?: string[];
  plugins?: string[];
  reasoning: string;
  tier?: number;
  tokenEstimate?: number;
}
