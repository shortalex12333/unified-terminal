/**
 * Storekeeper — Plan-Level Tool Provisioning
 *
 * Pure function that reads the full execution plan and returns a ToolManifest
 * with skills/MCPs/plugins for the orchestrator and every sub-agent.
 * One call, before DAG execution starts.
 *
 * See: docs/ONGOING_WORK/STOREKEEPER/STOREKEEPER-ARCHITECTURE.md
 */

import * as fs from 'fs';
import * as path from 'path';

import { STOREKEEPER_CONSTANTS } from './types';
import type { ProvisionInput, ToolManifest, ProvisionAuditEntry } from './types';
import type { PluginConfig } from '../plugins/plugin-schema';
import { getPluginRegistry } from '../plugins/plugin-registry';

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface TriggerEntry {
  skill: string;
  keywords: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Rough bytes-per-token estimate (conservative, matches validator.ts) */
const BYTES_PER_TOKEN = 4;

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Provision tools for an entire execution plan.
 *
 * @param input - Plan, catalog path, skills base path, tier
 * @returns ToolManifest with foundation skills, per-step skills, plugins, MCPs, audit
 */
export function provision(input: ProvisionInput): ToolManifest {
  const { plan, catalogPath, skillsBasePath, planTier } = input;
  const audit: ProvisionAuditEntry[] = [];

  // 1. Load catalog
  const catalog = loadCatalog(catalogPath);

  // 2. Resolve foundation skills
  const foundation = resolveFoundation(skillsBasePath);
  audit.push({
    timestamp: Date.now(),
    action: 'foundation',
    stepId: null,
    skills: foundation,
    reasoning: `Resolved ${foundation.length}/${STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS.length} foundation skills`,
  });

  // 3. Per-step skill selection
  const perStep = new Map<number, string[]>();
  for (const step of plan.steps) {
    const stepTier = step.target === 'service' ? 0 : step.target === 'web' ? 1 : 2;
    const maxByTier = stepTier <= 1 ? 1 : stepTier === 2 ? 2 : 3;

    if (!catalog || catalog.length === 0) {
      perStep.set(step.id, []);
      audit.push({
        timestamp: Date.now(),
        action: 'select',
        stepId: step.id,
        skills: [],
        reasoning: 'No catalog available',
        tier: stepTier,
      });
      continue;
    }

    const matched = matchByKeywords(step.action, step.detail, catalog, maxByTier);
    const { accepted, rejected, totalTokens } = validatePaths(matched, skillsBasePath, maxByTier);

    perStep.set(step.id, accepted);
    audit.push({
      timestamp: Date.now(),
      action: 'select',
      stepId: step.id,
      skills: accepted,
      rejected: rejected.length > 0 ? rejected : undefined,
      reasoning: accepted.length > 0
        ? `Matched ${accepted.length} skill(s) for [${step.action}] ${step.detail}`
        : `No keyword matches for [${step.action}]`,
      tier: stepTier,
      tokenEstimate: totalTokens,
    });
  }

  // 4. Resolve plugins
  const plugins = resolvePlugins(plan);
  audit.push({
    timestamp: Date.now(),
    action: 'plugins',
    stepId: null,
    plugins: plugins.map(p => p.name),
    reasoning: plugins.length > 0
      ? `Matched ${plugins.length} plugin(s) by keyword`
      : 'No plugins matched',
  });

  // 5. MCPs: empty for now
  const mcps: string[] = [];
  audit.push({
    timestamp: Date.now(),
    action: 'mcps',
    stepId: null,
    reasoning: 'MCP provisioning not yet implemented',
  });

  return { foundation, perStep, plugins, mcps, audit };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Load and validate trigger-map.json.
 * Adapted from selector.ts:239-282 — supports both JSON formats.
 */
function loadCatalog(catalogPath: string): TriggerEntry[] | null {
  if (!fs.existsSync(catalogPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(catalogPath, 'utf-8');
    const data = JSON.parse(raw);

    // Format 1: Flat TriggerEntry[] array
    if (Array.isArray(data)) {
      return data.length > 0 ? (data as TriggerEntry[]) : null;
    }

    // Format 2: Nested { skills: { name: { path, triggers } } }
    if (data && typeof data === 'object' && data.skills) {
      const entries: TriggerEntry[] = Object.entries(data.skills).map(
        ([name, entry]: [string, any]) => ({
          skill: entry.path || name,
          keywords: entry.triggers || [],
        }),
      );
      return entries.length > 0 ? entries : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Match skills by keyword overlap scoring.
 * Adapted from selector.ts:202-229.
 * Returns skill paths (relative to skillsBasePath) sorted by score.
 */
function matchByKeywords(
  action: string,
  detail: string,
  catalog: TriggerEntry[],
  max: number,
): string[] {
  const inputTokens = tokenize(`${action} ${detail}`);

  const scored = catalog
    .map(entry => {
      const matched = entry.keywords.filter(kw => inputTokens.has(kw.toLowerCase()));
      return { skill: entry.skill, score: matched.length };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map(s => s.skill);
}

/**
 * Validate skill paths: existence + token budget.
 * Adapted from validator.ts:63-114.
 */
function validatePaths(
  skills: string[],
  basePath: string,
  max: number,
): { accepted: string[]; rejected: string[]; totalTokens: number } {
  const accepted: string[] = [];
  const rejected: string[] = [];
  let totalTokens = 0;

  for (const skillRelPath of skills) {
    const fullPath = path.join(basePath, skillRelPath);

    // Check file exists
    if (!fs.existsSync(fullPath)) {
      rejected.push(skillRelPath);
      continue;
    }

    // Check count limit
    if (accepted.length >= max) {
      rejected.push(skillRelPath);
      continue;
    }

    // Check token budget
    const stat = fs.statSync(fullPath);
    const estimatedTokens = Math.ceil(stat.size / BYTES_PER_TOKEN);

    if (totalTokens + estimatedTokens > STOREKEEPER_CONSTANTS.MAX_SKILL_TOKENS) {
      rejected.push(skillRelPath);
      continue;
    }

    // Convert to absolute path for the manifest
    accepted.push(fullPath);
    totalTokens += estimatedTokens;
  }

  return { accepted, rejected, totalTokens };
}

/**
 * Resolve foundation skills to absolute paths.
 * Filters out missing files gracefully.
 */
function resolveFoundation(basePath: string): string[] {
  return STOREKEEPER_CONSTANTS.FOUNDATION_SKILLS
    .map(rel => path.join(basePath, rel))
    .filter(abs => fs.existsSync(abs));
}

/**
 * Resolve plugins by matching step keywords against plugin registry triggers.
 * Deduplicates across steps.
 */
function resolvePlugins(plan: { steps: Array<{ action: string; detail: string }> }): PluginConfig[] {
  try {
    const registry = getPluginRegistry();
    const seen = new Set<string>();
    const result: PluginConfig[] = [];

    for (const step of plan.steps) {
      const text = `${step.action} ${step.detail}`;
      const matches = registry.findByText(text);

      for (const { config } of matches) {
        if (!seen.has(config.name)) {
          seen.add(config.name);
          result.push(config);
        }
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Tokenize a string into a lowercase Set of words.
 * Matches selector.ts tokenizer.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s_\-.,;:!?/\\|]+/)
      .filter(t => t.length > 0),
  );
}
