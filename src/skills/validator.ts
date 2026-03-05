/**
 * Skill Selection Validator — Hard rails for skill injection.
 *
 * Instance 3/4: Hardcoded Enforcement Engine — Skill System
 *
 * Enforces:
 * - Skills per worker: max 3 (tier-dependent)
 * - Total injection tokens: max 4,000 (estimated as fileSize / 4)
 * - File existence: every selected skill path must resolve
 */

import * as fs from 'fs';
import * as path from 'path';

import type { SkillSelection } from './selector';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Absolute maximum skills injected into any single worker prompt. */
export const MAX_SKILLS_PER_WORKER = 3;

/** Token budget for all skill content injected into a worker prompt. */
export const MAX_SKILL_INJECTION_TOKENS = 4_000;

/** Rough bytes-per-token estimate (conservative). */
const BYTES_PER_TOKEN = 4;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidationResult {
  /** Whether the selection passed all checks */
  valid: boolean;
  /** Validated paths (existing files only, within budget) */
  skills: string[];
  /** Paths that failed validation */
  rejected: string[];
  /** Human-readable rejection reason (set when valid === false) */
  reason?: string;
  /** Estimated total injection tokens for accepted skills */
  totalTokens: number;
}

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validate a skill selection against hard rails.
 *
 * Rules (in evaluation order):
 * 1. Each skill path must exist under skillsBasePath.
 * 2. Tier-based count limit: tier 0-1 → 1, tier 2 → 2, tier 3 → 3.
 * 3. Cumulative token estimate must stay below MAX_SKILL_INJECTION_TOKENS.
 *
 * @param selection - Output from selectSkills()
 * @param skillsBasePath - Absolute path to resources/skills/
 * @param tier - Conductor tier (0-3). Defaults to 3 (no tier restriction).
 */
export function validateSelection(
  selection: SkillSelection,
  skillsBasePath: string,
  tier: number = 3,
): ValidationResult {
  const accepted: string[] = [];
  const rejected: string[] = [];
  let totalTokens = 0;

  // Tier-based skill count limit
  const maxByTier = tier <= 1 ? 1 : tier === 2 ? 2 : MAX_SKILLS_PER_WORKER;

  for (const skillRelPath of selection.skills) {
    const fullPath = path.join(skillsBasePath, skillRelPath);

    // Check 1: file exists
    if (!fs.existsSync(fullPath)) {
      rejected.push(skillRelPath);
      continue;
    }

    // Check 2: count limit
    if (accepted.length >= maxByTier) {
      rejected.push(skillRelPath);
      continue;
    }

    // Check 3: token budget
    const stat = fs.statSync(fullPath);
    const estimatedTokens = Math.ceil(stat.size / BYTES_PER_TOKEN);

    if (totalTokens + estimatedTokens > MAX_SKILL_INJECTION_TOKENS) {
      rejected.push(skillRelPath);
      continue;
    }

    accepted.push(skillRelPath);
    totalTokens += estimatedTokens;
  }

  const valid = rejected.length === 0 && accepted.length <= maxByTier;

  return {
    valid,
    skills: accepted,
    rejected,
    reason: rejected.length > 0
      ? `Rejected ${rejected.length} skill(s): ${rejected.join(', ')}`
      : undefined,
    totalTokens,
  };
}
