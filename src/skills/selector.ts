/**
 * Skill Selector — Picks markdown skill files for worker agents.
 *
 * Instance 3/4: Hardcoded Enforcement Engine — Skill System
 *
 * PRIMARY: Spawns a ~400-token Codex agent that makes semantic judgment
 * about which skills match a given task. Agent selects, code enforces.
 *
 * FALLBACK: Keyword lookup from trigger-map.json when Codex is unavailable
 * or agent spawn fails. Same interface, degraded accuracy.
 */

import * as fs from 'fs';
import { getAdapter } from '../adapters/factory';
import type { AgentConfig } from '../adapters/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SkillSelection {
  /** Paths relative to resources/skills/ */
  skills: string[];
  /** Why these skills were chosen */
  reasoning: string;
}

export interface SelectorInput {
  /** e.g. "codex_build" */
  stepAction: string;
  /** Human-readable task description */
  stepDetail: string;
  /** 2-sentence project context */
  spineSummary: string;
  /** Conductor tier: 0-3 */
  tier: number;
}

interface TriggerEntry {
  /** Skill path relative to resources/skills/ */
  skill: string;
  /** Keywords that trigger this skill */
  keywords: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum time for skill selector agent spawn (ms) */
const SELECTOR_TIMEOUT_MS = 15_000;

/** Maximum output tokens for the selector agent */
const SELECTOR_MAX_TOKENS = 400;

// ============================================================================
// SKILL SELECTOR AGENT PROMPT (~150 system tokens)
// ============================================================================

const SELECTOR_SYSTEM_PROMPT = `You are a Skill Selector. Given a task description and a skill catalog, pick 0-3 skills that help the worker agent complete the task correctly.

Rules:
- Pick ONLY skills whose guidance directly applies to the task
- Pick FEWER skills for simple tasks (0-1), more for complex tasks (2-3)
- Return valid JSON only: { "skills": ["path/to/skill.md"], "reasoning": "why" }
- Paths must match exactly from the catalog
- If no skills apply, return { "skills": [], "reasoning": "No applicable skills" }`;

// ============================================================================
// PRIMARY: AGENT-BASED SELECTION
// ============================================================================

/**
 * Select skills using a Codex agent (~400 tokens, 1-2s).
 * The agent reads the task context and skill catalog, then makes a
 * semantic judgment about which skills are relevant.
 *
 * Falls back to keyword matching if:
 * - Codex adapter is unavailable
 * - Agent spawn fails
 * - Agent output is unparseable
 */
export async function selectSkills(
  input: SelectorInput,
  catalogPath: string,
): Promise<SkillSelection> {
  // Load trigger map (needed for both agent and fallback paths)
  const catalog = loadCatalog(catalogPath);
  if (!catalog) {
    return { skills: [], reasoning: 'Trigger map unavailable' };
  }

  // Tier-based limit
  const maxSkills = input.tier <= 1 ? 1 : input.tier === 2 ? 2 : 3;

  // Try agent-based selection first
  try {
    const adapter = getAdapter('codex');
    const isAvailable = await adapter.isAvailable();

    if (isAvailable) {
      // Build catalog summary for the agent (~200 tokens)
      const catalogSummary = catalog
        .map((entry) => `- ${entry.skill}: ${entry.keywords.slice(0, 5).join(', ')}`)
        .join('\n');

      const userPrompt = [
        `Task: [${input.stepAction}] ${input.stepDetail}`,
        input.spineSummary ? `Context: ${input.spineSummary}` : '',
        `Tier: ${input.tier} (max ${maxSkills} skills)`,
        '',
        'Available skills:',
        catalogSummary,
      ].filter(Boolean).join('\n');

      const config: AgentConfig = {
        id: `skill-selector-${Date.now()}`,
        name: 'skill-selector',
        role: SELECTOR_SYSTEM_PROMPT,
        model: 'gpt-5-codex',
        tools: [],
        maxTokens: SELECTOR_MAX_TOKENS,
        prompt: userPrompt,
        declaredFiles: [],
        workingDir: process.cwd(),
        timeout: SELECTOR_TIMEOUT_MS,
      };

      const handle = await adapter.spawn(config);
      const result = await handle.onComplete();

      if (result.status === 'completed' && result.output) {
        const parsed = parseAgentResponse(result.output, catalog);
        if (parsed) {
          console.log(`[SkillSelector] Agent selected ${parsed.skills.length} skills: ${parsed.reasoning}`);
          return {
            skills: parsed.skills.slice(0, maxSkills),
            reasoning: `[agent] ${parsed.reasoning}`,
          };
        }
      }

      console.warn('[SkillSelector] Agent returned unparseable output, falling back to keyword matching');
    }
  } catch (err) {
    console.warn(
      '[SkillSelector] Agent selection failed, falling back to keyword matching:',
      err instanceof Error ? err.message : err,
    );
  }

  // Fallback: keyword matching
  return selectSkillsByKeyword(input, catalog, maxSkills);
}

// ============================================================================
// AGENT RESPONSE PARSER
// ============================================================================

/**
 * Parse the agent's JSON response. Validates that skill paths exist in catalog.
 * Returns null if the response is unparseable or invalid.
 */
function parseAgentResponse(
  output: string,
  catalog: TriggerEntry[],
): SkillSelection | null {
  // Extract JSON from output (agent may wrap in markdown code blocks)
  const jsonMatch = output.match(/\{[\s\S]*"skills"[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { skills?: string[]; reasoning?: string };
    if (!Array.isArray(parsed.skills)) return null;

    // Validate: every skill path must exist in catalog
    const validPaths = new Set(catalog.map((e) => e.skill));
    const validSkills = parsed.skills.filter((s) => validPaths.has(s));

    if (validSkills.length === 0 && parsed.skills.length > 0) {
      // Agent returned paths not in catalog — reject entirely
      return null;
    }

    return {
      skills: validSkills,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Agent selection',
    };
  } catch {
    return null;
  }
}

// ============================================================================
// FALLBACK: KEYWORD MATCHING
// ============================================================================

/**
 * Fallback skill selection via keyword overlap scoring.
 * Used when Codex agent is unavailable or fails.
 */
function selectSkillsByKeyword(
  input: SelectorInput,
  catalog: TriggerEntry[],
  maxSkills: number,
): SkillSelection {
  const inputTokens = tokenize(`${input.stepAction} ${input.stepDetail}`);

  const scored = catalog
    .map((entry) => {
      const matched = entry.keywords.filter((kw) =>
        inputTokens.has(kw.toLowerCase()),
      );
      return { skill: entry.skill, matched, score: matched.length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, maxSkills);
  const matchedKeywords = top.flatMap((s) => s.matched);

  return {
    skills: top.map((s) => s.skill),
    reasoning:
      top.length > 0
        ? `[keyword-fallback] Matched: [${matchedKeywords.join(', ')}]`
        : '[keyword-fallback] No keyword matches found',
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Load and validate trigger-map.json.
 * Returns null if file is missing or malformed.
 */
function loadCatalog(catalogPath: string): TriggerEntry[] | null {
  if (!fs.existsSync(catalogPath)) {
    console.warn(`[SkillSelector] trigger-map.json not found at ${catalogPath} — no skills will be loaded`);
    return null;
  }

  try {
    const raw = fs.readFileSync(catalogPath, 'utf-8');
    const data = JSON.parse(raw);

    // Format 1: Flat TriggerEntry[] array
    if (Array.isArray(data)) {
      if (data.length === 0) {
        console.warn('[SkillSelector] trigger-map.json is empty');
        return null;
      }
      return data as TriggerEntry[];
    }

    // Format 2: Nested { skills: { name: { path, triggers } } } object
    if (data && typeof data === 'object' && data.skills) {
      const entries: TriggerEntry[] = Object.entries(data.skills).map(
        ([name, entry]: [string, any]) => ({
          skill: entry.path || name,
          keywords: entry.triggers || [],
        }),
      );
      if (entries.length === 0) {
        console.warn('[SkillSelector] trigger-map.json has no skills');
        return null;
      }
      return entries;
    }

    console.warn('[SkillSelector] trigger-map.json has unrecognized format');
    return null;
  } catch (err) {
    console.warn(
      '[SkillSelector] Failed to parse trigger-map.json:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Tokenize a string into a lowercase Set of words.
 * Splits on whitespace, underscores, hyphens, and common punctuation.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s_\-.,;:!?/\\|]+/)
      .filter((t) => t.length > 0),
  );
}
