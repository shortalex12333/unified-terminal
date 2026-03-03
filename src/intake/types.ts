/**
 * Unified Terminal - Intake Layer Types
 *
 * Type definitions for the meta-prompt intake system that transforms
 * vague user requests into structured project briefs.
 */

// ============================================================================
// TASK CLASSIFICATION TYPES
// ============================================================================

/**
 * High-level task categories that determine execution path.
 */
export type TaskType =
  | 'build_product'   // Websites, apps, landing pages, stores
  | 'build_content'   // Blog posts, copy, emails, documentation
  | 'research'        // Market research, analysis, comparisons
  | 'automate'        // Scraping, form filling, scheduling
  | 'general';        // Catch-all for unclassified tasks

/**
 * Where the task will primarily be executed.
 */
export type ExecutionPath =
  | 'browser'   // Browser-based tools (playwright, scraping)
  | 'local'     // Local CLI tools (GSD, Codex, file operations)
  | 'hybrid';   // Mix of both

/**
 * Available plugins/tools that can be invoked.
 */
export type PluginName =
  | 'gsd'           // GSD workflow for project management
  | 'codex'         // OpenAI Codex for code generation
  | 'claude'        // Claude Code for development
  | 'playwright'    // Browser automation
  | 'scraper'       // Web scraping
  | 'dall-e'        // Image generation
  | 'whisper'       // Audio transcription
  | 'vercel'        // Deployment
  | 'github';       // Git operations

// ============================================================================
// CLASSIFICATION RESULTS
// ============================================================================

/**
 * Signals detected from analyzing user message.
 */
export interface TaskSignals {
  needsCode: boolean;
  needsResearch: boolean;
  needsContent: boolean;
  needsImages: boolean;
  needsAutomation: boolean;
  needsDeployment: boolean;
}

/**
 * Result of classifying a user's initial message.
 */
export interface TaskClassification {
  taskType: TaskType;
  signals: TaskSignals;
  confidence: number;  // 0-1 confidence score
  suggestedPlugins: PluginName[];
  suggestedPath: ExecutionPath;
}

// ============================================================================
// PROJECT BRIEF
// ============================================================================

/**
 * Requirements extracted from intake conversation.
 */
export interface ProjectRequirements {
  targetAudience?: string;
  existingAssets?: string;
  successMetric?: string;
  constraints?: string;
  style?: string;
  timeline?: string;
  budget?: string;
  [key: string]: string | undefined;
}

/**
 * Fully structured project brief ready for execution.
 */
export interface ProjectBrief {
  taskType: TaskType;
  category: string;
  requirements: ProjectRequirements;
  executionPath: ExecutionPath;
  pluginsNeeded: PluginName[];
  rawRequest: string;
  intakeComplete: boolean;
  skipped: boolean;
}

// ============================================================================
// INTAKE FLOW STATE
// ============================================================================

/**
 * Current phase of the intake conversation.
 */
export type IntakePhase =
  | 'initial'         // Just received first message
  | 'questioning'     // ChatGPT is asking clarifying questions
  | 'answering'       // User is answering questions
  | 'building_brief'  // Building final brief from conversation
  | 'complete';       // Brief is ready

/**
 * A single exchange in the intake conversation.
 */
export interface IntakeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Full state of an intake session.
 */
export interface IntakeState {
  sessionId: string;
  phase: IntakePhase;
  originalRequest: string;
  messages: IntakeMessage[];
  classification: TaskClassification | null;
  brief: ProjectBrief | null;
  startTime: number;
  lastActivity: number;
}

// ============================================================================
// INTAKE CONFIGURATION
// ============================================================================

/**
 * Configuration options for the intake flow.
 */
export interface IntakeConfig {
  /** Maximum number of clarifying questions to ask */
  maxQuestions: number;

  /** Timeout in ms before auto-completing with assumptions */
  timeoutMs: number;

  /** Whether to allow skip flow */
  allowSkip: boolean;

  /** Keywords that trigger skip flow */
  skipKeywords: string[];
}

/**
 * Default configuration values.
 */
export const DEFAULT_INTAKE_CONFIG: IntakeConfig = {
  maxQuestions: 5,
  timeoutMs: 300000, // 5 minutes
  allowSkip: true,
  skipKeywords: [
    'just build it',
    'skip questions',
    'skip',
    'just do it',
    'no questions',
    'go ahead',
    'start building',
    'begin',
    'proceed',
  ],
};
