/**
 * Glue Layer — Prompt Assembly + Result Normalization
 *
 * Bridges the gap between:
 *   - Skill files + spine context -> assembled prompts (for adapters)
 *   - Adapter results + scheduler steps -> gate-check inputs (for bodyguard)
 *
 * Target: ES2022, CommonJS, strict mode
 */

export {
  assemblePrompt,
  type PromptParts,
  type AssembleOptions,
} from './assemble-prompt';

export {
  normalize,
  type GateCheckInput,
  type SchedulerStep,
  type AdapterResult,
} from './normalizer';
