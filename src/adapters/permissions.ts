/**
 * Tool Permissions & Plugin Compatibility
 *
 * Central authority for:
 * - Sandbox mode mapping (Codex read-only vs workspace-write)
 * - Plugin tool requirements (what each plugin needs)
 * - Read-only enforcement for auditing plugins
 * - Runtime compatibility matrix
 *
 * Target: ES2022 CommonJS strict
 */

import type { Tool, Runtime } from './types';

// =============================================================================
// PERMISSION CONSTANTS
// =============================================================================

/** Tools that grant write access to the filesystem */
const WRITE_TOOLS: ReadonlyArray<Tool> = ['write', 'edit'] as const;

/** Tools that can execute arbitrary commands */
const EXEC_TOOLS: ReadonlyArray<Tool> = ['bash'] as const;

// =============================================================================
// PERMISSION CHECKS
// =============================================================================

/** Check if a tool set grants write permissions */
export function hasWritePermission(tools: Tool[]): boolean {
  return tools.some((t) => (WRITE_TOOLS as ReadonlyArray<string>).includes(t));
}

/** Check if a tool set can execute commands */
export function hasExecPermission(tools: Tool[]): boolean {
  return tools.some((t) => (EXEC_TOOLS as ReadonlyArray<string>).includes(t));
}

/** Check if a tool set is read-only (no write, no bash) */
export function isReadOnly(tools: Tool[]): boolean {
  return !hasWritePermission(tools) && !hasExecPermission(tools);
}

// =============================================================================
// CODEX SANDBOX MODES
// =============================================================================

export type CodexSandbox = 'read-only' | 'workspace-write';

/**
 * Determine the Codex sandbox mode from a set of tools.
 *
 * - If tools include 'write', 'edit', or 'bash': workspace-write
 * - Otherwise: read-only
 */
export function getCodexSandbox(tools: Tool[]): CodexSandbox {
  if (hasWritePermission(tools) || hasExecPermission(tools)) {
    return 'workspace-write';
  }
  return 'read-only';
}

// =============================================================================
// PLUGIN REQUIREMENTS
// =============================================================================

export interface PluginRequirements {
  /** Tools this plugin needs */
  tools: Tool[];

  /** If true, MUST NOT be given write tools — security enforcement */
  readOnly: boolean;

  /** Human-readable description of the plugin's purpose */
  description: string;
}

/**
 * Canonical tool requirements per skill.
 * Single source of truth — 29 skill definitions (28 from DISSECTION + architecture-reviewer).
 *
 * Source: docs/ONGOING_WORK/DISSECTION/INDEX.md
 *
 * Naming convention:
 *   gsd-{name}            GSD orchestration workers
 *   code-{name}           Code quality workers
 *   security-{name}       Security audit workers
 *   worker-{name}         Task execution workers
 *   skill-{name}          Design and specialty workers
 *   discuss|plan|execute|verify|unify  Lifecycle phases
 *   verification-{name}   Quality assurance agents
 *   conductor-{name}      Orchestration agents
 *   intake                User-facing orchestration
 *   pa-{name}             Internal handoff agents
 */
export const PLUGIN_REQUIREMENTS: Readonly<Record<string, PluginRequirements>> = Object.freeze({
  // =========================================================================
  // GSD Workers
  // =========================================================================
  'gsd-executor': {
    tools: ['read', 'write', 'bash'],
    readOnly: false,
    description: 'Executes plans with atomic commits',
  },
  'gsd-planner': {
    tools: ['read', 'write', 'bash', 'grep', 'glob'],
    readOnly: false, // Writes PLAN.md
    description: 'Creates phase plans with task breakdown',
  },
  'gsd-researcher': {
    tools: ['web_search'],
    readOnly: true,
    description: 'Researches domain ecosystem',
  },
  'gsd-debugger': {
    tools: ['read', 'write', 'bash'],
    readOnly: false,
    description: 'Systematic debugging with state management',
  },
  'gsd-verifier': {
    tools: ['read', 'write', 'bash', 'grep', 'glob'],
    readOnly: false, // Writes VERIFICATION.md
    description: 'Verifies phase goal achievement',
  },
  'gsd-codebase-mapper': {
    tools: ['read', 'bash', 'grep', 'glob'],
    readOnly: true,
    description: 'Explores codebase structure',
  },

  // =========================================================================
  // Code Quality Workers
  // =========================================================================
  'code-reviewer': {
    tools: ['read'],
    readOnly: true, // MUST be read-only — audits only
    description: 'Reviews code without making changes',
  },
  'security-reviewer': {
    tools: ['read'],
    readOnly: true, // MUST be read-only — audits only
    description: 'Security audit without fixes',
  },
  'tdd-guide': {
    tools: ['read', 'write', 'bash'],
    readOnly: false,
    description: 'Test-driven development guidance',
  },
  'build-error-resolver': {
    tools: ['read', 'write', 'bash'],
    readOnly: false,
    description: 'Fixes build errors',
  },
  'doc-updater': {
    tools: ['read', 'write'],
    readOnly: false,
    description: 'Updates documentation',
  },

  // =========================================================================
  // Deployment Workers
  // =========================================================================
  'worker-deploy': {
    tools: ['read', 'bash', 'write'],
    readOnly: false,
    description: 'Deployment automation',
  },
  'worker-scaffold': {
    tools: ['write', 'bash'],
    readOnly: false,
    description: 'Project scaffolding',
  },
  'worker-image-gen': {
    tools: ['web_search'],
    readOnly: true,
    description: 'Image generation via DALL-E (ChatGPT Web only)',
  },
  'worker-web-research': {
    tools: ['web_search'],
    readOnly: true,
    description: 'Web research and browsing',
  },

  // =========================================================================
  // Design Workers
  // =========================================================================
  'skill-frontend-design': {
    tools: ['read', 'write', 'bash'],
    readOnly: false,
    description: 'Frontend component design',
  },

  // =========================================================================
  // Backend Workers
  // =========================================================================
  'worker-backend': {
    tools: ['read', 'write', 'bash', 'grep', 'glob'],
    readOnly: false,
    description: 'API, database, auth, route, and migration patterns',
  },
  'archivist': {
    tools: ['read', 'write'],
    readOnly: false,
    description: 'Project closure and archival',
  },

  // =========================================================================
  // Architecture Workers
  // =========================================================================
  'architecture-reviewer': {
    tools: ['read', 'grep', 'glob'],
    readOnly: true, // Audits only
    description: 'Architecture review and dependency analysis',
  },

  // =========================================================================
  // Lifecycle Phases (orchestrated — dispatch workers, manage state)
  // =========================================================================
  'discuss': {
    tools: ['read'],
    readOnly: true, // Gathers requirements only
    description: 'Gather requirements through questioning',
  },
  'plan': {
    tools: ['read', 'write'],
    readOnly: false, // Writes PLAN.md
    description: 'Produce implementation DAG',
  },
  'execute': {
    tools: ['read', 'write', 'bash'],
    readOnly: false, // Dispatches workers, writes state
    description: 'Run worker agents per plan',
  },
  'verify': {
    tools: ['read', 'write', 'bash', 'grep', 'glob'],
    readOnly: false, // Writes VERIFICATION.md
    description: 'Validate completeness against plan',
  },
  'unify': {
    tools: ['read', 'write'],
    readOnly: false, // Writes reconciliation
    description: 'Reconcile plan vs actual outcome',
  },

  // =========================================================================
  // Verification Agents
  // =========================================================================
  'verification-integrity': {
    tools: ['read', 'bash'],
    readOnly: true, // Validates tests, doesn't modify code
    description: 'Test validity and integrity check',
  },
  'docker-local-first': {
    tools: ['bash'],
    readOnly: true, // Runs docker commands, doesn't modify project files
    description: 'Container build and verification before push',
  },

  // =========================================================================
  // Orchestration Agents
  // =========================================================================
  'conductor-system': {
    tools: ['read', 'bash'],
    readOnly: true, // Classifies and routes, doesn't modify files
    description: 'Tier classification, DAG production, re-planning',
  },
  'intake': {
    tools: ['read'],
    readOnly: true, // User-facing quiz, produces structured brief
    description: 'User-facing quiz and structured brief generation',
  },

  // =========================================================================
  // Internal Handoff
  // =========================================================================
  'pa-comparison': {
    tools: ['read'],
    readOnly: true, // Semantic comparison, read-only
    description: 'Semantic validation between steps',
  },
});

// =============================================================================
// PLUGIN VALIDATION
// =============================================================================

/** Get requirements for a plugin by name */
export function getPluginRequirements(name: string): PluginRequirements | undefined {
  return PLUGIN_REQUIREMENTS[name];
}

/**
 * Validate that a tool set is compatible with a plugin's requirements.
 *
 * Throws if:
 * - A read-only plugin is given write permissions (security violation)
 *
 * Warns (returns true but logs) if:
 * - Plugin is missing recommended tools
 *
 * @returns true if valid, false if plugin is unknown
 * @throws Error if read-only plugin is given write tools
 */
export function validatePluginTools(pluginName: string, tools: Tool[]): boolean {
  const req = PLUGIN_REQUIREMENTS[pluginName];
  if (!req) {
    console.warn(`[permissions] Unknown plugin: ${pluginName}`);
    return false;
  }

  // Security enforcement: read-only plugins MUST NOT get write tools
  if (req.readOnly && (hasWritePermission(tools) || hasExecPermission(tools))) {
    throw new Error(
      `SECURITY: Plugin "${pluginName}" must be read-only but was given write/exec permissions. ` +
      `Remove 'write', 'edit', and 'bash' from tools.`,
    );
  }

  // Advisory: warn about missing recommended tools
  const missing = req.tools.filter((t) => !tools.includes(t));
  if (missing.length > 0) {
    console.warn(
      `[permissions] Plugin "${pluginName}" missing recommended tools: [${missing.join(', ')}]`,
    );
  }

  return true;
}

// =============================================================================
// RUNTIME COMPATIBILITY
// =============================================================================

export interface CompatibilityEntry {
  /** Compatible with Codex runtime */
  codex: boolean;

  /** Compatible with Claude Code runtime */
  claude: boolean;

  /** Reason for incompatibility (if applicable) */
  reason?: string;
}

/**
 * Skill compatibility per runtime.
 * 29 entries: 28 from DISSECTION INDEX.md + architecture-reviewer.
 * Codex + Claude Code active. Gemini shelved.
 *
 * Runtime mapping from INDEX.md:
 *   codex       → codex: true, claude: true (both CLIs can execute)
 *   sonnet      → codex: true, claude: true (preferred Claude, Codex capable)
 *   haiku       → codex: true, claude: true (preferred Claude, Codex capable)
 *   any         → codex: true, claude: true
 *   orchestrated → codex: true, claude: true (conductor dispatches to either)
 *   internal    → codex: true, claude: true (enforcement pipeline, runtime-agnostic)
 *   docker      → codex: true, claude: true (Docker is independent of CLI)
 *   chatgpt-web → codex: false, claude: false (ChatGPT BrowserView only)
 */
export const COMPATIBILITY: Readonly<Record<string, CompatibilityEntry>> = Object.freeze({
  // =========================================================================
  // GSD Workers (runtime: codex)
  // =========================================================================
  'gsd-executor': { codex: true, claude: true },
  'gsd-planner': { codex: true, claude: true },
  'gsd-researcher': { codex: true, claude: true },
  'gsd-debugger': { codex: true, claude: true },
  'gsd-verifier': { codex: true, claude: true },
  'gsd-codebase-mapper': { codex: true, claude: true },

  // =========================================================================
  // Code Quality Workers (runtime: sonnet)
  // =========================================================================
  'code-reviewer': { codex: true, claude: true },
  'security-reviewer': { codex: true, claude: true },
  'tdd-guide': { codex: true, claude: true },
  'build-error-resolver': { codex: true, claude: true },
  'doc-updater': { codex: true, claude: true },

  // =========================================================================
  // Deployment & Task Workers
  // =========================================================================
  'worker-deploy': { codex: true, claude: true },
  'worker-scaffold': { codex: true, claude: true },
  'worker-backend': { codex: true, claude: true },
  'worker-web-research': { codex: true, claude: true },
  'archivist': { codex: true, claude: true },

  // =========================================================================
  // Web-Only (ChatGPT BrowserView)
  // =========================================================================
  'worker-image-gen': {
    codex: false,
    claude: false,
    reason: 'Requires DALL-E (ChatGPT Web only)',
  },

  // =========================================================================
  // Design & Architecture
  // =========================================================================
  'skill-frontend-design': { codex: true, claude: true },
  'architecture-reviewer': { codex: true, claude: true },

  // =========================================================================
  // Lifecycle Phases (runtime: orchestrated)
  // =========================================================================
  'discuss': { codex: true, claude: true },
  'plan': { codex: true, claude: true },
  'execute': { codex: true, claude: true },
  'verify': { codex: true, claude: true },
  'unify': { codex: true, claude: true },

  // =========================================================================
  // Verification Agents
  // =========================================================================
  'verification-integrity': { codex: true, claude: true },
  'docker-local-first': { codex: true, claude: true },

  // =========================================================================
  // Orchestration Agents
  // =========================================================================
  'conductor-system': {
    codex: true,
    claude: false,
    reason: 'Requires persistent Codex session for DAG production',
  },
  'intake': {
    codex: false,
    claude: false,
    reason: 'Runs in ChatGPT Web BrowserView only',
  },

  // =========================================================================
  // Internal Handoff
  // =========================================================================
  'pa-comparison': { codex: true, claude: true },
});

/** Check if a plugin is compatible with a runtime */
export function isCompatible(plugin: string, runtime: Runtime): boolean {
  const entry = COMPATIBILITY[plugin];
  if (!entry) {
    return false;
  }
  return entry[runtime];
}

/** Get all compatible plugins for a runtime */
export function getCompatiblePlugins(runtime: Runtime): string[] {
  return Object.entries(COMPATIBILITY)
    .filter(([, entry]) => entry[runtime])
    .map(([name]) => name);
}
