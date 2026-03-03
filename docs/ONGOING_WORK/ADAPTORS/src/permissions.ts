/**
 * Tool Permissions & Plugin Requirements
 *
 * Central authority for:
 * - What tools each plugin needs
 * - Which plugins are read-only
 * - Sandbox/approval mode mapping per runtime
 */

import type { Tool } from './types';

// =============================================================================
// PERMISSION CHECKS
// =============================================================================

const WRITE_TOOLS: Tool[] = ['write', 'edit'];

/** Check if a tool set grants write permissions */
export function hasWritePermission(tools: Tool[]): boolean {
  return tools.some((t) => WRITE_TOOLS.includes(t));
}

/** Check if a tool set is read-only */
export function isReadOnly(tools: Tool[]): boolean {
  return !hasWritePermission(tools);
}

// =============================================================================
// CODEX SANDBOX MODES
// =============================================================================

export type CodexSandbox = 'read-only' | 'workspace-write';

/** Get Codex sandbox mode from tools */
export function getCodexSandbox(tools: Tool[]): CodexSandbox {
  return hasWritePermission(tools) ? 'workspace-write' : 'read-only';
}

/** Build Codex --sandbox flag */
export function buildCodexSandboxFlag(tools: Tool[]): string[] {
  return ['--sandbox', getCodexSandbox(tools)];
}

// =============================================================================
// GEMINI APPROVAL MODES
// =============================================================================

export type GeminiApproval = 'plan' | 'yolo';

/** Get Gemini approval mode from tools */
export function getGeminiApproval(tools: Tool[]): GeminiApproval {
  return isReadOnly(tools) ? 'plan' : 'yolo';
}

/** Build Gemini --approval-mode flag */
export function buildGeminiApprovalFlag(tools: Tool[]): string[] {
  const mode = getGeminiApproval(tools);
  const flags = ['--approval-mode', mode];
  if (mode === 'plan') {
    flags.push('--sandbox');
  }
  return flags;
}

// =============================================================================
// PLUGIN REQUIREMENTS
// =============================================================================

interface PluginRequirements {
  tools: Tool[];
  readOnly: boolean;
  description: string;
}

/**
 * Canonical tool requirements per plugin.
 * Single source of truth.
 */
export const PLUGINS: Record<string, PluginRequirements> = {
  // GSD Workers
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

  // Code Quality Workers
  'code-reviewer': {
    tools: ['read'],
    readOnly: true, // MUST be read-only - audits only
    description: 'Reviews code without making changes',
  },
  'security-reviewer': {
    tools: ['read'],
    readOnly: true, // MUST be read-only - audits only
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

  // Deployment Workers
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

  // Design Workers
  'skill-frontend-design': {
    tools: ['read', 'write', 'bash'],
    readOnly: false,
    description: 'Frontend component design',
  },
};

/** Get requirements for a plugin */
export function getPluginRequirements(name: string): PluginRequirements | undefined {
  return PLUGINS[name];
}

/** Validate tools match plugin requirements */
export function validatePluginTools(name: string, tools: Tool[]): void {
  const req = PLUGINS[name];
  if (!req) {
    console.warn(`[permissions] Unknown plugin: ${name}`);
    return;
  }

  if (req.readOnly && hasWritePermission(tools)) {
    throw new Error(
      `SECURITY: ${name} must be read-only but was given write permissions. ` +
        `Remove 'write' and 'edit' from tools.`
    );
  }

  const missing = req.tools.filter((t) => !tools.includes(t));
  if (missing.length > 0) {
    console.warn(`[permissions] ${name} missing recommended tools: [${missing.join(', ')}]`);
  }
}

// =============================================================================
// RUNTIME COMPATIBILITY
// =============================================================================

interface CompatibilityEntry {
  codex: boolean;
  gemini: boolean;
  reason?: string;
}

/**
 * Plugin compatibility per runtime.
 * Gemini cannot do session resume, so Conductor phases don't work.
 */
export const COMPATIBILITY: Record<string, CompatibilityEntry> = {
  // GSD Workers - Both work
  'gsd-executor': { codex: true, gemini: true },
  'gsd-planner': { codex: true, gemini: true },
  'gsd-researcher': { codex: true, gemini: true },
  'gsd-debugger': { codex: true, gemini: true },
  'gsd-verifier': { codex: true, gemini: true },
  'gsd-codebase-mapper': { codex: true, gemini: true },

  // Code Quality - Both work
  'code-reviewer': { codex: true, gemini: true },
  'security-reviewer': { codex: true, gemini: true },
  'tdd-guide': { codex: true, gemini: true },
  'build-error-resolver': { codex: true, gemini: true },
  'doc-updater': { codex: true, gemini: true },

  // Deployment - Both work
  'worker-deploy': { codex: true, gemini: true },
  'worker-scaffold': { codex: true, gemini: true },

  // Design - Both work
  'skill-frontend-design': { codex: true, gemini: true },

  // Web-only (ChatGPT Web)
  'worker-image-gen': {
    codex: false,
    gemini: false,
    reason: 'Requires DALL-E (ChatGPT Web only)',
  },
  'worker-web-research': {
    codex: true,
    gemini: false,
    reason: 'Gemini has limited browsing',
  },
};

/** Check if plugin is compatible with runtime */
export function isCompatible(plugin: string, runtime: 'codex' | 'gemini'): boolean {
  const entry = COMPATIBILITY[plugin];
  return entry ? entry[runtime] : false;
}

/** Get compatible plugins for a runtime */
export function getCompatiblePlugins(runtime: 'codex' | 'gemini'): string[] {
  return Object.entries(COMPATIBILITY)
    .filter(([, entry]) => entry[runtime])
    .map(([name]) => name);
}
