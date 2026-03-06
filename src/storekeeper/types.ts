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

/** Tool request from an agent to the storekeeper */
export interface ToolRequest {
  readonly agentId: string;
  readonly taskContext: string;
  readonly requestedTools: readonly string[];
  readonly timestamp: string;
}

/** Storekeeper's response to a tool request */
export interface ToolResponse {
  readonly agentId: string;
  readonly approved: readonly string[];
  readonly denied: readonly string[];
  readonly reason: string;
  readonly timestamp: string;
}

/** Storekeeper approval decision */
export type ApprovalDecision = 'approved' | 'denied' | 'deferred';

/** Single item in the tool inventory */
export interface InventoryItem {
  readonly name: string;
  readonly type: 'skill' | 'mcp' | 'plugin';
  readonly path: string;
  readonly tokenCost: number;
  readonly tags: readonly string[];
}
