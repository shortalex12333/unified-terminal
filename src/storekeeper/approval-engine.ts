/**
 * Approval Engine Module — Apply approval rules to tool requests
 *
 * The Storekeeper uses this engine to validate requests against:
 * - Inventory availability (skill exists, MCP connected, plugin available)
 * - Token budgets (skills don't exceed limit)
 * - Tier limits (number of skills per tier)
 */

import * as crypto from 'crypto';
import {
  ToolRequest,
  ToolResponse,
  Inventory,
  ApprovedSkill,
  DeniedSkill,
  ApprovedMcp,
  DeniedMcp,
  ApprovedPlugin,
  ApprovalRule,
  ApprovalResult,
  STOREKEEPER_CONSTANTS,
} from './types';
import { findSkill, findMcp, findPlugin, getTotalTokens } from './inventory';

// =============================================================================
// INVENTORY CHECKS
// =============================================================================

/**
 * Check if a skill exists in the inventory.
 *
 * @param skillPath Skill path to check
 * @param inventory Loaded inventory
 * @returns True if skill exists
 */
export function skillExists(skillPath: string, inventory: Inventory): boolean {
  return findSkill(inventory, skillPath) !== undefined;
}

/**
 * Check if an MCP server is connected.
 *
 * @param mcpId MCP server ID to check
 * @param inventory Loaded inventory
 * @returns True if MCP is connected
 */
export function mcpConnected(mcpId: string, inventory: Inventory): boolean {
  const mcp = findMcp(inventory, mcpId);
  return mcp !== undefined && mcp.status === 'connected';
}

/**
 * Check if an MCP server exists (may not be connected).
 *
 * @param mcpId MCP server ID to check
 * @param inventory Loaded inventory
 * @returns True if MCP exists in catalog
 */
export function mcpExists(mcpId: string, inventory: Inventory): boolean {
  return findMcp(inventory, mcpId) !== undefined;
}

/**
 * Check if a plugin is available.
 *
 * @param pluginId Plugin ID to check
 * @param inventory Loaded inventory
 * @returns True if plugin is available
 */
export function pluginAvailable(pluginId: string, inventory: Inventory): boolean {
  return findPlugin(inventory, pluginId) !== undefined;
}

// =============================================================================
// BUDGET CHECKS
// =============================================================================

/**
 * Check if skills are within token budget.
 *
 * @param skillPaths Array of skill paths
 * @param maxTokens Maximum allowed tokens
 * @param inventory Loaded inventory
 * @returns Object with passed status and details
 */
export function checkTokenBudget(
  skillPaths: string[],
  maxTokens: number,
  inventory: Inventory
): { passed: boolean; totalTokens: number; exceededBy: number } {
  const totalTokens = getTotalTokens(inventory, skillPaths);
  const exceededBy = Math.max(0, totalTokens - maxTokens);

  return {
    passed: totalTokens <= maxTokens,
    totalTokens,
    exceededBy,
  };
}

/**
 * Tier configuration for skill limits.
 */
export type Tier = 'basic' | 'standard' | 'premium' | 'unlimited';

const TIER_LIMITS: Record<Tier, number> = {
  basic: 2,
  standard: 3,
  premium: 5,
  unlimited: STOREKEEPER_CONSTANTS.MAX_SKILLS_ABSOLUTE,
};

/**
 * Check if the number of skills is within tier limit.
 *
 * @param skillPaths Array of skill paths (excluding foundation skills)
 * @param tier User's tier
 * @returns Object with passed status and details
 */
export function checkTierLimit(
  skillPaths: string[],
  tier: Tier
): { passed: boolean; limit: number; requested: number } {
  const limit = TIER_LIMITS[tier];
  const foundationSkills: readonly string[] = STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS;
  const requested = skillPaths.filter(
    (p) => !foundationSkills.includes(p)
  ).length;

  return {
    passed: requested <= limit,
    limit,
    requested,
  };
}

// =============================================================================
// APPROVAL RULES
// =============================================================================

/**
 * Built-in approval rules.
 */
export const APPROVAL_RULES: ApprovalRule[] = [
  {
    name: 'skill-exists',
    type: 'HARD',
    check: (request: ToolRequest, inventory: Inventory): ApprovalResult => {
      const missing: string[] = [];
      for (const skillPath of request.requestedSkills) {
        if (!skillExists(skillPath, inventory)) {
          missing.push(skillPath);
        }
      }
      return {
        passed: missing.length === 0,
        reason: missing.length === 0
          ? 'All requested skills exist'
          : `Skills not found: ${missing.join(', ')}`,
        affected: missing,
      };
    },
  },
  {
    name: 'mcp-exists',
    type: 'HARD',
    check: (request: ToolRequest, inventory: Inventory): ApprovalResult => {
      const missing: string[] = [];
      for (const mcpId of request.requestedMcp) {
        if (!mcpExists(mcpId, inventory)) {
          missing.push(mcpId);
        }
      }
      return {
        passed: missing.length === 0,
        reason: missing.length === 0
          ? 'All requested MCP servers exist'
          : `MCP servers not found: ${missing.join(', ')}`,
        affected: missing,
      };
    },
  },
  {
    name: 'mcp-connected',
    type: 'SOFT',
    check: (request: ToolRequest, inventory: Inventory): ApprovalResult => {
      const disconnected: string[] = [];
      for (const mcpId of request.requestedMcp) {
        if (mcpExists(mcpId, inventory) && !mcpConnected(mcpId, inventory)) {
          disconnected.push(mcpId);
        }
      }
      return {
        passed: disconnected.length === 0,
        reason: disconnected.length === 0
          ? 'All requested MCP servers are connected'
          : `MCP servers not connected: ${disconnected.join(', ')}`,
        affected: disconnected,
      };
    },
  },
  {
    name: 'plugin-available',
    type: 'HARD',
    check: (request: ToolRequest, inventory: Inventory): ApprovalResult => {
      const missing: string[] = [];
      for (const pluginId of request.requestedPlugins) {
        if (!pluginAvailable(pluginId, inventory)) {
          missing.push(pluginId);
        }
      }
      return {
        passed: missing.length === 0,
        reason: missing.length === 0
          ? 'All requested plugins are available'
          : `Plugins not available: ${missing.join(', ')}`,
        affected: missing,
      };
    },
  },
  {
    name: 'token-budget',
    type: 'HARD',
    check: (request: ToolRequest, inventory: Inventory): ApprovalResult => {
      const result = checkTokenBudget(
        request.requestedSkills,
        STOREKEEPER_CONSTANTS.MAX_SKILL_TOKENS,
        inventory
      );
      return {
        passed: result.passed,
        reason: result.passed
          ? `Token budget OK: ${result.totalTokens}/${STOREKEEPER_CONSTANTS.MAX_SKILL_TOKENS}`
          : `Token budget exceeded by ${result.exceededBy} tokens`,
        affected: result.passed ? [] : request.requestedSkills,
      };
    },
  },
  {
    name: 'max-skills-absolute',
    type: 'HARD',
    check: (request: ToolRequest, _inventory: Inventory): ApprovalResult => {
      const foundationSkills: readonly string[] = STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS;
      const nonFoundation = request.requestedSkills.filter(
        (p) => !foundationSkills.includes(p)
      );
      const passed = nonFoundation.length <= STOREKEEPER_CONSTANTS.MAX_SKILLS_ABSOLUTE;
      return {
        passed,
        reason: passed
          ? `Skill count OK: ${nonFoundation.length}/${STOREKEEPER_CONSTANTS.MAX_SKILLS_ABSOLUTE}`
          : `Too many skills requested: ${nonFoundation.length} (max: ${STOREKEEPER_CONSTANTS.MAX_SKILLS_ABSOLUTE})`,
        affected: passed ? [] : nonFoundation.slice(STOREKEEPER_CONSTANTS.MAX_SKILLS_ABSOLUTE),
      };
    },
  },
];

// =============================================================================
// APPROVAL PROCESSING
// =============================================================================

/**
 * Process a tool request through the approval engine.
 *
 * @param request Tool request to process
 * @param inventory Loaded inventory
 * @param options Additional options
 * @returns Tool response with approvals/denials
 */
export function processApproval(
  request: ToolRequest,
  inventory: Inventory,
  options?: {
    tier?: Tier;
    customRules?: ApprovalRule[];
  }
): ToolResponse {
  const tier = options?.tier || 'standard';
  const rules = [...APPROVAL_RULES, ...(options?.customRules || [])];
  const foundationSkills: readonly string[] = STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS;

  // Track approvals and denials
  const approvedSkills: ApprovedSkill[] = [];
  const deniedSkills: DeniedSkill[] = [];
  const approvedMcp: ApprovedMcp[] = [];
  const deniedMcp: DeniedMcp[] = [];
  const approvedPlugins: ApprovedPlugin[] = [];

  // Collect all rule results
  const ruleResults: Map<string, ApprovalResult> = new Map();
  const hardFailures: string[] = [];

  for (const rule of rules) {
    const result = rule.check(request, inventory);
    ruleResults.set(rule.name, result);

    if (!result.passed && rule.type === 'HARD') {
      hardFailures.push(rule.name);
    }
  }

  // Process skills
  const skillExistsResult = ruleResults.get('skill-exists');
  const tokenBudgetResult = ruleResults.get('token-budget');
  const maxSkillsResult = ruleResults.get('max-skills-absolute');
  const tierLimitCheck = checkTierLimit(request.requestedSkills, tier);

  for (const skillPath of request.requestedSkills) {
    const skill = findSkill(inventory, skillPath);

    if (!skill) {
      deniedSkills.push({
        path: skillPath,
        reason: 'Skill not found in inventory',
      });
    } else if (
      maxSkillsResult &&
      !maxSkillsResult.passed &&
      maxSkillsResult.affected.includes(skillPath)
    ) {
      deniedSkills.push({
        path: skillPath,
        reason: 'Exceeds maximum skill limit',
      });
    } else if (!tierLimitCheck.passed && !foundationSkills.includes(skillPath)) {
      // Check if this skill would exceed tier limit
      const alreadyApproved = approvedSkills.filter(
        (s) => !foundationSkills.includes(s.path)
      ).length;
      if (alreadyApproved >= tierLimitCheck.limit) {
        deniedSkills.push({
          path: skillPath,
          reason: `Exceeds tier limit (${tier}: ${tierLimitCheck.limit} skills)`,
        });
        continue;
      }
      approvedSkills.push({
        path: skillPath,
        tokens: skill.estimatedTokens,
        reason: 'Skill available and within limits',
      });
    } else {
      approvedSkills.push({
        path: skillPath,
        tokens: skill.estimatedTokens,
        reason: foundationSkills.includes(skillPath)
          ? 'Foundation skill (always approved)'
          : 'Skill available and within limits',
      });
    }
  }

  // Process MCP
  const mcpExistsResult = ruleResults.get('mcp-exists');
  const mcpConnectedResult = ruleResults.get('mcp-connected');

  for (const mcpId of request.requestedMcp) {
    const mcp = findMcp(inventory, mcpId);

    if (!mcp) {
      deniedMcp.push({
        id: mcpId,
        reason: 'MCP server not found in catalog',
      });
    } else if (mcp.status !== 'connected') {
      // Soft failure - approve with pending status
      approvedMcp.push({
        id: mcpId,
        status: 'pending',
        reason: 'MCP server exists but not connected (will attempt connection)',
      });
    } else {
      approvedMcp.push({
        id: mcpId,
        status: 'connected',
        reason: 'MCP server connected',
      });
    }
  }

  // Process plugins (only one plugin per request typically)
  for (const pluginId of request.requestedPlugins) {
    const plugin = findPlugin(inventory, pluginId);

    if (!plugin) {
      // Plugin not found - not a hard failure, just skip
      continue;
    }

    approvedPlugins.push({
      id: pluginId,
      reason: 'Plugin available',
    });
  }

  // Calculate totals
  const totalSkillTokens = approvedSkills.reduce((sum, s) => sum + s.tokens, 0);
  const tokenBudgetRemaining = STOREKEEPER_CONSTANTS.MAX_SKILL_TOKENS - totalSkillTokens;

  // Determine overall status
  let status: 'READY' | 'PARTIAL' | 'DENIED';
  if (hardFailures.length > 0 && approvedSkills.length === 0) {
    status = 'DENIED';
  } else if (
    deniedSkills.length > 0 ||
    deniedMcp.length > 0 ||
    approvedMcp.some((m) => m.status === 'pending')
  ) {
    status = 'PARTIAL';
  } else {
    status = 'READY';
  }

  // Generate storekeeper signature
  const responseData = {
    requestId: request.requestId,
    approvedSkills: approvedSkills.map((s) => s.path),
    approvedMcp: approvedMcp.map((m) => m.id),
    approvedPlugins: approvedPlugins.map((p) => p.id),
    timestamp: new Date().toISOString(),
  };
  const storekeeperSignature = crypto
    .createHash('sha256')
    .update(JSON.stringify(responseData))
    .digest('hex');

  return {
    requestId: request.requestId,
    timestamp: new Date().toISOString(),
    storekeeperSignature,
    approvedSkills,
    deniedSkills,
    approvedMcp,
    deniedMcp,
    approvedPlugins,
    injectionSummary: {
      totalSkillTokens,
      tokenBudgetRemaining,
      skillsInjected: approvedSkills.length,
      mcpConnected: approvedMcp.filter((m) => m.status === 'connected').length,
      pluginSelected: approvedPlugins.length > 0 ? approvedPlugins[0].id : null,
    },
    status,
  };
}

/**
 * Quick check if a request would be fully approved.
 *
 * @param request Tool request
 * @param inventory Loaded inventory
 * @returns True if all items would be approved
 */
export function wouldBeFullyApproved(
  request: ToolRequest,
  inventory: Inventory
): boolean {
  const response = processApproval(request, inventory);
  return response.status === 'READY';
}
