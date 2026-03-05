/**
 * Critical Checks Registry — Code backstop for essential skill checks.
 *
 * Instance 3/4: Hardcoded Enforcement Engine — Skill System
 *
 * These checks ALWAYS run for their respective skills, even if the
 * skill file's `## verify` block is missing or corrupted.
 * The registry wins on name conflicts (deduplication by check name).
 */

import * as path from 'path';

import type { SkillVerifyCheck } from './verify-parser';
import { parseVerifyBlock } from './verify-parser';

// ============================================================================
// CRITICAL CHECKS REGISTRY
// ============================================================================

export const CRITICAL_SKILL_CHECKS: Record<string, SkillVerifyCheck[]> = {
  'tdd-guide.md': [
    {
      name: 'tests-exist',
      check: "find . -name '*.test.*' -o -name '*.spec.*' | wc -l",
      pass: 'parseInt(output) > 0',
      confidence: 'definitive',
      rail: 'HARD',
    },
  ],
  'security-reviewer.md': [
    {
      name: 'no-secrets-committed',
      check: 'git diff --cached --name-only | grep -E "\\.(env|key|pem|secret)" | wc -l',
      pass: 'parseInt(output) === 0',
      confidence: 'definitive',
      rail: 'HARD',
    },
  ],
  'docker-local-first.md': [
    {
      name: 'docker-built',
      check: 'docker images --format "{{.Repository}}" | wc -l',
      pass: 'parseInt(output) > 0',
      confidence: 'heuristic',
      rail: 'SOFT',
    },
  ],
  'deploy.md': [
    {
      name: 'build-exists',
      check: 'test -d dist || test -d build || test -d .next && echo "1" || echo "0"',
      pass: 'output.trim() === "1"',
      confidence: 'definitive',
      rail: 'HARD',
    },
  ],
};

// ============================================================================
// MERGED CHECK RETRIEVAL
// ============================================================================

/**
 * Get the full set of verify checks for a skill.
 *
 * Merges checks from:
 * 1. The skill file's `## verify` block (parsed from content)
 * 2. The critical checks registry (hardcoded above)
 *
 * Deduplication: if both sources define a check with the same `name`,
 * the registry entry wins.
 *
 * @param skillPath - Path to the skill file (basename used for registry lookup)
 * @param skillContent - Full markdown content of the skill file
 */
export function getChecksForSkill(
  skillPath: string,
  skillContent: string,
): SkillVerifyCheck[] {
  const fromMetadata = parseVerifyBlock(skillContent);
  const basename = path.basename(skillPath);
  const fromRegistry = CRITICAL_SKILL_CHECKS[basename] ?? [];

  // Build name→check map. Start with metadata, then overlay registry (wins).
  const merged = new Map<string, SkillVerifyCheck>();

  for (const check of fromMetadata) {
    merged.set(check.name, check);
  }

  for (const check of fromRegistry) {
    merged.set(check.name, check);
  }

  return Array.from(merged.values());
}
