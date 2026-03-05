/**
 * Skill System — Main Entry Point
 *
 * Instance 3/4: Hardcoded Enforcement Engine — Skill System
 *
 * Selects, validates, and verifies markdown skill files for worker agents.
 * Skills live at resources/skills/ as bundled markdown files.
 *
 * Flow:
 *   1. Selector picks 0-3 skills (keyword match or future LLM agent)
 *   2. Validator enforces budget limits (count + tokens + tier)
 *   3. Skill content is injected into worker prompt
 *   4. After execution, verify-parser + critical-checks produce checks
 *   5. verify-sandbox runs those checks safely
 */

// ============================================================================
// SELECTOR EXPORTS
// ============================================================================

export {
  selectSkills,
  type SkillSelection,
  type SelectorInput,
} from './selector';

// ============================================================================
// VALIDATOR EXPORTS
// ============================================================================

export {
  validateSelection,
  MAX_SKILLS_PER_WORKER,
  MAX_SKILL_INJECTION_TOKENS,
  type ValidationResult,
} from './validator';

// ============================================================================
// VERIFY PARSER EXPORTS
// ============================================================================

export {
  parseVerifyBlock,
  type SkillVerifyCheck,
} from './verify-parser';

// ============================================================================
// CRITICAL CHECKS EXPORTS
// ============================================================================

export {
  CRITICAL_SKILL_CHECKS,
  getChecksForSkill,
} from './critical-checks';

// ============================================================================
// VERIFY SANDBOX EXPORTS
// ============================================================================

export {
  isCommandAllowed,
  executeVerifyCommand,
  type SandboxResult,
  type CommandResult,
} from './verify-sandbox';
