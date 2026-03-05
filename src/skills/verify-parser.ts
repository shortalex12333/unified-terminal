/**
 * Verify Block Parser — Extracts post-step checks from skill markdown.
 *
 * Instance 3/4: Hardcoded Enforcement Engine — Skill System
 *
 * Each skill markdown file may contain a `## verify` section with a
 * JSON code block that declares shell commands used to confirm the
 * worker actually followed the skill.
 *
 * Format example inside a skill .md file:
 *
 * ```
 * ## verify
 *
 * ```json
 * [
 *   {
 *     "name": "tests-exist",
 *     "check": "find . -name '*.test.*' | wc -l",
 *     "pass": "parseInt(output) > 0",
 *     "confidence": "definitive",
 *     "rail": "HARD"
 *   }
 * ]
 * ```
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SkillVerifyCheck {
  /** Human-readable name for the check */
  name: string;
  /** Shell command to run (piped commands allowed) */
  check: string;
  /** Optional second command for comparison */
  compare?: string;
  /** Condition expression evaluated against `output` variable */
  pass: string;
  /** How reliable this check is */
  confidence: 'definitive' | 'heuristic';
  /** HARD = blocks step completion, SOFT = warning only */
  rail: 'HARD' | 'SOFT';
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Parse the `## verify` block from a skill markdown file.
 *
 * Looks for a section starting with `## verify` (case-insensitive),
 * then extracts the first JSON code block within that section.
 *
 * @param skillContent - Full markdown content of the skill file
 * @returns Parsed checks, or empty array if none found / malformed
 */
export function parseVerifyBlock(skillContent: string): SkillVerifyCheck[] {
  // Find the ## verify heading (case-insensitive, allows extra whitespace)
  const verifyHeadingRe = /^#{2}\s+verify\b/im;
  const headingMatch = verifyHeadingRe.exec(skillContent);

  if (!headingMatch) {
    return [];
  }

  // Extract content from the verify heading until the next ## heading or EOF
  const afterHeading = skillContent.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingRe = /^#{1,6}\s+/m;
  const nextHeadingMatch = nextHeadingRe.exec(afterHeading);
  const sectionContent = nextHeadingMatch
    ? afterHeading.slice(0, nextHeadingMatch.index)
    : afterHeading;

  // Find the first JSON code block in the section
  const codeBlockRe = /```(?:json)?\s*\n([\s\S]*?)\n\s*```/;
  const codeBlockMatch = codeBlockRe.exec(sectionContent);

  if (!codeBlockMatch) {
    return [];
  }

  const jsonStr = codeBlockMatch[1].trim();

  // Parse and validate
  try {
    const parsed: unknown = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      console.warn('[VerifyParser] ## verify JSON is not an array');
      return [];
    }

    return parsed.filter((item): item is SkillVerifyCheck => {
      if (typeof item !== 'object' || item === null) return false;
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.name === 'string' &&
        typeof obj.check === 'string' &&
        typeof obj.pass === 'string' &&
        (obj.confidence === 'definitive' || obj.confidence === 'heuristic') &&
        (obj.rail === 'HARD' || obj.rail === 'SOFT')
      );
    });
  } catch (err) {
    console.warn(
      '[VerifyParser] Failed to parse ## verify JSON:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
