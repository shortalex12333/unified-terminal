/**
 * Inventory Module — Load and manage skill, MCP, and plugin catalogs
 *
 * This module loads catalogs from various sources and combines them
 * into a unified Inventory for the Storekeeper to use when processing requests.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Inventory,
  SkillCatalogEntry,
  McpCatalogEntry,
  PluginCatalogEntry,
  STOREKEEPER_CONSTANTS,
} from './types';

// =============================================================================
// SKILL CATALOG
// =============================================================================

interface TriggerMapEntry {
  path: string;
  name: string;
  triggers: string[];
  estimatedTokens?: number;
  type?: 'foundation' | 'worker' | 'verification' | 'orchestration';
}

/**
 * Load skills catalog from trigger-map.json and skill markdown files.
 *
 * @param skillsPath Path to resources/skills directory
 * @returns Array of SkillCatalogEntry
 */
export function loadSkillsCatalog(skillsPath: string): SkillCatalogEntry[] {
  const triggerMapPath = path.join(skillsPath, 'trigger-map.json');
  const catalog: SkillCatalogEntry[] = [];

  // Load trigger map if it exists
  if (fs.existsSync(triggerMapPath)) {
    try {
      const triggerMap: TriggerMapEntry[] = JSON.parse(
        fs.readFileSync(triggerMapPath, 'utf-8')
      );

      for (const entry of triggerMap) {
        catalog.push({
          path: entry.path,
          name: entry.name,
          triggers: entry.triggers,
          estimatedTokens: entry.estimatedTokens || estimateTokensFromFile(skillsPath, entry.path),
          type: entry.type || inferSkillType(entry.path),
        });
      }
    } catch (error) {
      console.error('[Inventory] Failed to load trigger-map.json:', error);
    }
  }

  // Scan for markdown files not in trigger map
  const scannedSkills = scanSkillsDirectory(skillsPath);
  const existingPaths = new Set(catalog.map((s) => s.path));

  for (const skill of scannedSkills) {
    if (!existingPaths.has(skill.path)) {
      catalog.push(skill);
    }
  }

  return catalog;
}

/**
 * Scan skills directory for markdown files.
 */
function scanSkillsDirectory(skillsPath: string): SkillCatalogEntry[] {
  const skills: SkillCatalogEntry[] = [];

  if (!fs.existsSync(skillsPath)) {
    return skills;
  }

  function scanDir(dir: string, relativePath: string = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (entry.name.endsWith('.md')) {
        skills.push({
          path: relPath,
          name: extractSkillName(fullPath, entry.name),
          triggers: extractTriggersFromFile(fullPath),
          estimatedTokens: estimateTokensFromFile(skillsPath, relPath),
          type: inferSkillType(relPath),
        });
      }
    }
  }

  scanDir(skillsPath);
  return skills;
}

/**
 * Extract skill name from file content or filename.
 */
function extractSkillName(filePath: string, filename: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^#\s+(.+)/m);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // Fallback to filename
  }

  return filename
    .replace(/\.md$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract triggers from skill file front matter or content.
 */
function extractTriggersFromFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for YAML front matter with triggers
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      const triggersMatch = frontMatter.match(/triggers:\s*\[(.*?)\]/);
      if (triggersMatch) {
        return triggersMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/['"]/g, ''));
      }
    }

    // Fallback: extract keywords from title and headers
    const triggers: Set<string> = new Set();
    const titleMatch = content.match(/^#\s+(.+)/m);
    if (titleMatch) {
      const words = titleMatch[1].toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) {
          triggers.add(word);
        }
      }
    }

    return Array.from(triggers);
  } catch {
    return [];
  }
}

/**
 * Estimate tokens from file size (rough approximation: 1 token ~ 4 chars).
 */
function estimateTokensFromFile(skillsPath: string, relativePath: string): number {
  try {
    const fullPath = path.join(skillsPath, relativePath);
    const stats = fs.statSync(fullPath);
    return Math.ceil(stats.size / 4);
  } catch {
    return 500; // Default estimate
  }
}

/**
 * Infer skill type from path.
 */
function inferSkillType(
  skillPath: string
): 'foundation' | 'worker' | 'verification' | 'orchestration' {
  const normalizedPath = skillPath.toLowerCase();

  if (
    normalizedPath.includes('phase') ||
    normalizedPath.includes('foundation') ||
    STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS.some((f) => normalizedPath.includes(f))
  ) {
    return 'foundation';
  }

  if (normalizedPath.includes('verify') || normalizedPath.includes('test')) {
    return 'verification';
  }

  if (
    normalizedPath.includes('orchestrat') ||
    normalizedPath.includes('conductor')
  ) {
    return 'orchestration';
  }

  return 'worker';
}

// =============================================================================
// MCP CATALOG
// =============================================================================

/**
 * Load MCP catalog from MCP documentation or config files.
 *
 * @param mcpConfigPath Path to MCP configuration directory
 * @returns Array of McpCatalogEntry
 */
export function loadMcpCatalog(mcpConfigPath?: string): McpCatalogEntry[] {
  const catalog: McpCatalogEntry[] = [];

  // Default MCP servers (from mcp/types.ts)
  const defaultServers: McpCatalogEntry[] = [
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Accept payments and manage subscriptions',
      category: 'payments',
      requiredScopes: ['read_write'],
      status: 'disconnected',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Code repositories and collaboration',
      category: 'development',
      requiredScopes: ['repo'],
      status: 'disconnected',
    },
    {
      id: 'vercel',
      name: 'Vercel',
      description: 'Deploy websites and applications',
      category: 'deployment',
      requiredScopes: ['deploy'],
      status: 'disconnected',
    },
    {
      id: 'supabase',
      name: 'Supabase',
      description: 'Database and authentication',
      category: 'database',
      requiredScopes: ['database'],
      status: 'disconnected',
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Notes and documentation',
      category: 'documentation',
      requiredScopes: ['read_content'],
      status: 'disconnected',
    },
    {
      id: 'context7',
      name: 'Context7',
      description: 'Documentation search and retrieval',
      category: 'documentation',
      requiredScopes: ['read'],
      status: 'disconnected',
    },
    {
      id: 'playwright',
      name: 'Playwright',
      description: 'Browser automation and testing',
      category: 'testing',
      requiredScopes: ['browser'],
      status: 'disconnected',
    },
  ];

  catalog.push(...defaultServers);

  // Load additional MCP servers from config file if provided
  if (mcpConfigPath && fs.existsSync(mcpConfigPath)) {
    try {
      const mcpConfigFile = path.join(mcpConfigPath, 'mcp-servers.json');
      if (fs.existsSync(mcpConfigFile)) {
        const customServers: McpCatalogEntry[] = JSON.parse(
          fs.readFileSync(mcpConfigFile, 'utf-8')
        );
        const existingIds = new Set(catalog.map((s) => s.id));

        for (const server of customServers) {
          if (!existingIds.has(server.id)) {
            catalog.push({
              ...server,
              status: server.status || 'disconnected',
            });
          }
        }
      }
    } catch (error) {
      console.error('[Inventory] Failed to load custom MCP config:', error);
    }
  }

  return catalog;
}

// =============================================================================
// PLUGIN CATALOG
// =============================================================================

/**
 * Load plugin catalog from plugin configurations.
 *
 * @returns Array of PluginCatalogEntry
 */
export function loadPluginCatalog(): PluginCatalogEntry[] {
  // Default plugins (from plugins/configs/)
  const plugins: PluginCatalogEntry[] = [
    {
      id: 'gsd',
      name: 'GSD',
      type: 'cli',
      command: 'gsd',
      capabilities: [
        'project-planning',
        'phased-execution',
        'verification',
        'research',
        'milestone-tracking',
        'context-management',
        'code-review',
        'debugging',
      ],
      requiresAuth: false,
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      type: 'cli',
      command: 'codex',
      capabilities: [
        'code-generation',
        'code-review',
        'code-completion',
        'task-execution',
        'full-auto',
      ],
      requiresAuth: true,
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      type: 'cli',
      command: 'claude',
      capabilities: [
        'code-generation',
        'code-review',
        'refactoring',
        'debugging',
        'documentation',
      ],
      requiresAuth: true,
    },
    {
      id: 'research',
      name: 'Research Plugin',
      type: 'hybrid',
      command: 'research',
      capabilities: [
        'web-search',
        'documentation-lookup',
        'api-reference',
        'best-practices',
      ],
      requiresAuth: false,
    },
    {
      id: 'browser-use',
      name: 'Browser Use',
      type: 'browser',
      command: 'python -m browser_use',
      capabilities: [
        'web-automation',
        'form-filling',
        'data-extraction',
        'screenshot',
      ],
      requiresAuth: false,
    },
    {
      id: 'playwright',
      name: 'Playwright',
      type: 'browser',
      command: 'npx playwright',
      capabilities: [
        'browser-testing',
        'e2e-testing',
        'screenshot',
        'pdf-generation',
      ],
      requiresAuth: false,
    },
  ];

  return plugins;
}

// =============================================================================
// COMBINED INVENTORY
// =============================================================================

/**
 * Load complete inventory from all sources.
 *
 * @param options Configuration options
 * @returns Combined Inventory
 */
export function loadInventory(options?: {
  skillsPath?: string;
  mcpConfigPath?: string;
}): Inventory {
  const skillsPath = options?.skillsPath || path.join(process.cwd(), 'resources', 'skills');
  const mcpConfigPath = options?.mcpConfigPath;

  return {
    skills: loadSkillsCatalog(skillsPath),
    mcp: loadMcpCatalog(mcpConfigPath),
    plugins: loadPluginCatalog(),
  };
}

/**
 * Find a skill by path.
 */
export function findSkill(
  inventory: Inventory,
  skillPath: string
): SkillCatalogEntry | undefined {
  return inventory.skills.find((s) => s.path === skillPath);
}

/**
 * Find an MCP server by ID.
 */
export function findMcp(
  inventory: Inventory,
  mcpId: string
): McpCatalogEntry | undefined {
  return inventory.mcp.find((m) => m.id === mcpId);
}

/**
 * Find a plugin by ID.
 */
export function findPlugin(
  inventory: Inventory,
  pluginId: string
): PluginCatalogEntry | undefined {
  return inventory.plugins.find((p) => p.id === pluginId);
}

/**
 * Get total token estimate for a list of skills.
 */
export function getTotalTokens(
  inventory: Inventory,
  skillPaths: string[]
): number {
  let total = 0;

  for (const skillPath of skillPaths) {
    const skill = findSkill(inventory, skillPath);
    if (skill) {
      total += skill.estimatedTokens;
    }
  }

  return total;
}
