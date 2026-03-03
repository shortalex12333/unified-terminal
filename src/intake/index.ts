/**
 * Unified Terminal - Intake Layer
 *
 * Meta-prompt intake system that transforms vague user requests
 * into structured project briefs through non-technical questioning.
 *
 * @module intake
 */

// Types
export {
  TaskType,
  ExecutionPath,
  PluginName,
  TaskSignals,
  TaskClassification,
  ProjectRequirements,
  ProjectBrief,
  IntakePhase,
  IntakeMessage,
  IntakeState,
  IntakeConfig,
  DEFAULT_INTAKE_CONFIG,
} from './types';

// Meta-prompts
export {
  buildIntakePrompt,
  buildBriefBuilderPrompt,
  buildSkipFlowPrompt,
  detectSkipIntent,
  detectIntakeComplete,
  INTAKE_COMPLETE_PATTERN,
  SKIP_PATTERNS,
  RECOVERY_PROMPT,
} from './meta-prompts';

// Task classifier
export {
  classifyTask,
  detectSignals,
  describeTaskType,
  describeExecutionPath,
} from './task-classifier';

// Brief builder
export {
  parseBriefFromJSON,
  createFallbackBrief,
  validateBrief,
  isBriefComplete,
  formatBriefForDisplay,
  extractJSON,
} from './brief-builder';

// Intake flow controller
export {
  IntakeFlowController,
  ProcessResult,
  createIntakeSession,
  quickIntake,
  shouldTriggerIntake,
} from './intake-flow';
