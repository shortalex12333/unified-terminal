/**
 * Injector Module — Inject approved tools into worker execution context
 *
 * After the approval engine processes a request, the injector:
 * 1. Reads skill content from markdown files
 * 2. Extracts relevant sections based on execution mode
 * 3. Builds the assembled prompt for the worker
 * 4. Sets up MCP connections and plugin bindings
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ToolResponse,
  Inventory,
  ExecutionContext,
  STOREKEEPER_CONSTANTS,
} from './types';
import { findSkill, findMcp, findPlugin } from './inventory';

// =============================================================================
// SKILL CONTENT READING
// =============================================================================

/**
 * Read the raw content of a skill markdown file.
 *
 * @param skillPath Relative path to skill (from resources/skills/)
 * @param skillsDir Base directory for skills
 * @returns Skill content or empty string if not found
 */
export function readSkillContent(skillPath: string, skillsDir?: string): string {
  const baseDir = skillsDir || path.join(process.cwd(), 'resources', 'skills');
  const fullPath = path.join(baseDir, skillPath);

  if (!fs.existsSync(fullPath)) {
    console.warn('[Injector] Skill file not found:', fullPath);
    return '';
  }

  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    console.error('[Injector] Failed to read skill:', error);
    return '';
  }
}

// =============================================================================
// SECTION EXTRACTION
// =============================================================================

/**
 * Execution mode determines which sections to extract from skills.
 *
 * - 'full': All sections (for documentation/review)
 * - 'execute': Sections [1], [4], [5] (for execution)
 * - 'plan': Sections [1], [2], [3] (for planning)
 * - 'verify': Sections [1], [5] (for verification)
 */
export type ExecutionMode = 'full' | 'execute' | 'plan' | 'verify';

/**
 * Section definitions for skill markdown files.
 *
 * Expected structure:
 * [1] Overview/Introduction
 * [2] Planning/Requirements
 * [3] Design/Architecture
 * [4] Implementation/Execution
 * [5] Verification/Testing
 */
interface SectionConfig {
  marker: RegExp;
  name: string;
}

const SECTION_PATTERNS: SectionConfig[] = [
  { marker: /^\[1\]|^##?\s*overview|^##?\s*introduction/im, name: 'overview' },
  { marker: /^\[2\]|^##?\s*planning|^##?\s*requirements/im, name: 'planning' },
  { marker: /^\[3\]|^##?\s*design|^##?\s*architecture/im, name: 'design' },
  { marker: /^\[4\]|^##?\s*implementation|^##?\s*execution/im, name: 'implementation' },
  { marker: /^\[5\]|^##?\s*verification|^##?\s*testing/im, name: 'verification' },
];

const MODE_SECTIONS: Record<ExecutionMode, string[]> = {
  full: ['overview', 'planning', 'design', 'implementation', 'verification'],
  execute: ['overview', 'implementation', 'verification'],
  plan: ['overview', 'planning', 'design'],
  verify: ['overview', 'verification'],
};

/**
 * Extract specific sections from skill content based on mode.
 *
 * @param content Skill markdown content
 * @param mode Execution mode
 * @returns Extracted sections joined
 */
export function extractSections(content: string, mode: ExecutionMode): string {
  const desiredSections = MODE_SECTIONS[mode];
  const lines = content.split('\n');
  const sections: Map<string, string[]> = new Map();

  let currentSection: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    // Check if line starts a new section
    let foundSection: string | null = null;
    for (const pattern of SECTION_PATTERNS) {
      if (pattern.marker.test(line)) {
        foundSection = pattern.name;
        break;
      }
    }

    if (foundSection) {
      // Save previous section
      if (currentSection) {
        sections.set(currentSection, currentLines);
      }
      currentSection = foundSection;
      currentLines = [line];
    } else if (currentSection) {
      currentLines.push(line);
    } else {
      // Content before any section marker - treat as overview
      if (!sections.has('overview')) {
        sections.set('overview', []);
      }
      sections.get('overview')!.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections.set(currentSection, currentLines);
  }

  // If no sections were detected, return full content for the mode
  if (sections.size === 0) {
    return content;
  }

  // Build result from desired sections
  const result: string[] = [];
  for (const sectionName of desiredSections) {
    const sectionContent = sections.get(sectionName);
    if (sectionContent && sectionContent.length > 0) {
      result.push(sectionContent.join('\n'));
    }
  }

  return result.join('\n\n---\n\n');
}

/**
 * Strip YAML front matter from content.
 */
function stripFrontMatter(content: string): string {
  const frontMatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  if (frontMatterMatch) {
    return content.slice(frontMatterMatch[0].length);
  }
  return content;
}

// =============================================================================
// EXECUTION CONTEXT BUILDING
// =============================================================================

/**
 * Build an execution context from an approved tool response.
 *
 * @param response Approved tool response
 * @param inventory Loaded inventory
 * @param options Additional options
 * @returns ExecutionContext ready for worker
 */
export function buildExecutionContext(
  response: ToolResponse,
  inventory: Inventory,
  options?: {
    skillsDir?: string;
    mode?: ExecutionMode;
    timeout?: number;
    sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
    model?: string;
  }
): ExecutionContext {
  const mode = options?.mode || 'execute';
  const skillsDir = options?.skillsDir || path.join(process.cwd(), 'resources', 'skills');

  // Build assembled prompt from approved skills
  const promptParts: string[] = [];

  // Add header
  promptParts.push('# Injected Skills Context');
  promptParts.push('');
  promptParts.push(`> Generated: ${new Date().toISOString()}`);
  promptParts.push(`> Request ID: ${response.requestId}`);
  promptParts.push(`> Mode: ${mode}`);
  promptParts.push('');

  // Foundation skills first
  const foundationSkillPaths: readonly string[] = STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS;
  const foundationSkills = response.approvedSkills.filter((s) =>
    foundationSkillPaths.includes(s.path)
  );
  const workerSkills = response.approvedSkills.filter(
    (s) => !foundationSkillPaths.includes(s.path)
  );

  // Add foundation skills
  if (foundationSkills.length > 0) {
    promptParts.push('## Foundation Skills');
    promptParts.push('');
    for (const skill of foundationSkills) {
      const content = readSkillContent(skill.path, skillsDir);
      if (content) {
        const extracted = extractSections(stripFrontMatter(content), mode);
        promptParts.push(`### ${skill.path}`);
        promptParts.push('');
        promptParts.push(extracted);
        promptParts.push('');
      }
    }
  }

  // Add worker skills
  if (workerSkills.length > 0) {
    promptParts.push('## Task Skills');
    promptParts.push('');
    for (const skill of workerSkills) {
      const content = readSkillContent(skill.path, skillsDir);
      if (content) {
        const extracted = extractSections(stripFrontMatter(content), mode);
        promptParts.push(`### ${skill.path}`);
        promptParts.push('');
        promptParts.push(extracted);
        promptParts.push('');
      }
    }
  }

  // Build MCP connection map
  const mcpConnections: Record<string, 'connected' | 'pending'> = {};
  for (const mcp of response.approvedMcp) {
    mcpConnections[mcp.id] = mcp.status;
  }

  // Get selected plugin
  const selectedPlugin = response.injectionSummary.pluginSelected || '';

  return {
    assembledPrompt: promptParts.join('\n'),
    mcp: mcpConnections,
    plugin: selectedPlugin,
    config: {
      timeout: options?.timeout || 60000,
      sandbox: options?.sandbox || 'workspace-write',
      model: options?.model,
    },
    meta: {
      requestId: response.requestId,
      skillsInjected: response.approvedSkills.map((s) => s.path),
      mcpConnected: response.approvedMcp
        .filter((m) => m.status === 'connected')
        .map((m) => m.id),
      checkoutTime: new Date().toISOString(),
    },
  };
}

// =============================================================================
// FULL INJECTION FLOW
// =============================================================================

/**
 * Full injection flow: reads skills, builds context, returns ready-to-use context.
 *
 * @param response Approved tool response
 * @param inventory Loaded inventory
 * @param options Additional options
 * @returns Complete ExecutionContext
 */
export function injectTools(
  response: ToolResponse,
  inventory: Inventory,
  options?: {
    skillsDir?: string;
    mode?: ExecutionMode;
    timeout?: number;
    sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
    model?: string;
  }
): ExecutionContext {
  // Validate response status
  if (response.status === 'DENIED') {
    throw new Error(
      `Cannot inject tools: request was denied. Denied skills: ${response.deniedSkills
        .map((s) => s.path)
        .join(', ')}`
    );
  }

  // Log injection start
  console.log('[Injector] Starting tool injection for request:', response.requestId);
  console.log('[Injector] Skills to inject:', response.approvedSkills.length);
  console.log('[Injector] MCP connections:', response.approvedMcp.length);
  console.log('[Injector] Plugin:', response.injectionSummary.pluginSelected || 'none');

  // Build the execution context
  const context = buildExecutionContext(response, inventory, options);

  // Log injection complete
  console.log('[Injector] Injection complete');
  console.log('[Injector] Assembled prompt size:', context.assembledPrompt.length, 'chars');

  return context;
}

/**
 * Validate that a context is still valid (skills haven't changed, MCP still connected).
 *
 * @param context Execution context to validate
 * @param inventory Current inventory
 * @returns True if context is still valid
 */
export function validateContext(
  context: ExecutionContext,
  inventory: Inventory
): boolean {
  // Check all skills still exist
  for (const skillPath of context.meta.skillsInjected) {
    const skill = inventory.skills.find((s) => s.path === skillPath);
    if (!skill) {
      console.warn('[Injector] Skill no longer exists:', skillPath);
      return false;
    }
  }

  // Check MCP connections
  for (const [mcpId, expectedStatus] of Object.entries(context.mcp)) {
    const mcp = inventory.mcp.find((m) => m.id === mcpId);
    if (!mcp) {
      console.warn('[Injector] MCP server no longer exists:', mcpId);
      return false;
    }
    if (expectedStatus === 'connected' && mcp.status !== 'connected') {
      console.warn('[Injector] MCP server no longer connected:', mcpId);
      return false;
    }
  }

  // Check plugin
  if (context.plugin) {
    const plugin = inventory.plugins.find((p) => p.id === context.plugin);
    if (!plugin) {
      console.warn('[Injector] Plugin no longer available:', context.plugin);
      return false;
    }
  }

  return true;
}

/**
 * Get a summary of what's in an execution context.
 */
export function getContextSummary(context: ExecutionContext): string {
  const lines: string[] = [
    `Request ID: ${context.meta.requestId}`,
    `Checkout Time: ${context.meta.checkoutTime}`,
    `Skills: ${context.meta.skillsInjected.length}`,
    `  - ${context.meta.skillsInjected.join('\n  - ')}`,
    `MCP Connections: ${Object.keys(context.mcp).length}`,
    `  - ${Object.entries(context.mcp)
      .map(([id, status]) => `${id}: ${status}`)
      .join('\n  - ')}`,
    `Plugin: ${context.plugin || 'none'}`,
    `Sandbox: ${context.config.sandbox}`,
    `Timeout: ${context.config.timeout}ms`,
    `Prompt Size: ${context.assembledPrompt.length} chars`,
  ];

  return lines.join('\n');
}
