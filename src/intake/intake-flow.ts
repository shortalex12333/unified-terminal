/**
 * Unified Terminal - Intake Flow Controller
 *
 * Orchestrates the full intake conversation flow:
 * 1. Intercept user's first message
 * 2. Inject INTAKE_PROMPT to ChatGPT
 * 3. Capture ChatGPT questions and user answers
 * 4. Detect INTAKE_COMPLETE signal
 * 5. Inject BRIEF_BUILDER_PROMPT
 * 6. Parse JSON response into ProjectBrief
 * 7. Route to execution
 */

import {
  IntakeState,
  IntakePhase,
  IntakeMessage,
  IntakeConfig,
  ProjectBrief,
  DEFAULT_INTAKE_CONFIG,
} from './types';
import {
  buildIntakePrompt,
  buildBriefBuilderPrompt,
  buildSkipFlowPrompt,
  detectSkipIntent,
  detectIntakeComplete,
  RECOVERY_PROMPT,
} from './meta-prompts';
import {
  parseBriefFromJSON,
  createFallbackBrief,
  isBriefComplete,
} from './brief-builder';
import { classifyTask } from './task-classifier';
import { getAnalyticsTracker } from '../main/analytics';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `intake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new intake session.
 */
export function createIntakeSession(originalRequest: string): IntakeState {
  const now = Date.now();
  return {
    sessionId: generateSessionId(),
    phase: 'initial',
    originalRequest,
    messages: [],
    classification: classifyTask(originalRequest),
    brief: null,
    startTime: now,
    lastActivity: now,
  };
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Add a message to the intake session.
 */
function addMessage(
  state: IntakeState,
  role: IntakeMessage['role'],
  content: string
): IntakeState {
  return {
    ...state,
    messages: [
      ...state.messages,
      { role, content, timestamp: Date.now() },
    ],
    lastActivity: Date.now(),
  };
}

// ============================================================================
// PHASE TRANSITIONS
// ============================================================================

/**
 * Result of processing a message.
 */
export interface ProcessResult {
  /** Updated state */
  state: IntakeState;
  /** Message to inject into ChatGPT (if any) */
  inject: string | null;
  /** Whether intake is complete */
  complete: boolean;
  /** Final brief (if complete) */
  brief: ProjectBrief | null;
  /** Error message (if any) */
  error: string | null;
}

/**
 * Handle the initial phase - first user message.
 */
function handleInitialPhase(
  state: IntakeState,
  config: IntakeConfig
): ProcessResult {
  // Check for skip intent in original request
  if (config.allowSkip && detectSkipIntent(state.originalRequest)) {
    return handleSkipFlow(state);
  }

  // Build the intake prompt
  const intakePrompt = buildIntakePrompt(state.originalRequest);

  // Add system message to history
  const newState: IntakeState = {
    ...addMessage(state, 'system', intakePrompt),
    phase: 'questioning',
  };

  return {
    state: newState,
    inject: intakePrompt,
    complete: false,
    brief: null,
    error: null,
  };
}

/**
 * Handle skip flow - user wants to skip intake.
 */
function handleSkipFlow(state: IntakeState, questionIndex?: number): ProcessResult {
  // Track the skipped question for analytics
  const tracker = getAnalyticsTracker();
  const questionCount = state.messages.filter(m => m.role === 'assistant').length;
  tracker.trackIntakeQuestionSkipped({
    question: state.messages[state.messages.length - 1]?.content || 'intake_flow',
    questionIndex: questionIndex ?? questionCount,
  });

  const skipPrompt = buildSkipFlowPrompt(state.originalRequest);

  const newState: IntakeState = {
    ...addMessage(state, 'system', skipPrompt),
    phase: 'building_brief',
  };

  return {
    state: newState,
    inject: skipPrompt,
    complete: false,
    brief: null,
    error: null,
  };
}

/**
 * Handle ChatGPT response during questioning phase.
 */
function handleAssistantMessage(
  state: IntakeState,
  content: string,
  _config: IntakeConfig
): ProcessResult {
  // Add assistant message
  let newState = addMessage(state, 'assistant', content);

  // Check if intake is complete
  if (detectIntakeComplete(content)) {
    // Transition to building brief
    newState = { ...newState, phase: 'building_brief' };

    // Inject brief builder prompt
    const briefPrompt = buildBriefBuilderPrompt();
    newState = addMessage(newState, 'system', briefPrompt);

    return {
      state: newState,
      inject: briefPrompt,
      complete: false,
      brief: null,
      error: null,
    };
  }

  // Still questioning, wait for user answer
  newState = { ...newState, phase: 'answering' };

  return {
    state: newState,
    inject: null,
    complete: false,
    brief: null,
    error: null,
  };
}

/**
 * Handle user answer during answering phase.
 */
function handleUserAnswer(
  state: IntakeState,
  content: string,
  config: IntakeConfig
): ProcessResult {
  // Check for skip intent
  if (config.allowSkip && detectSkipIntent(content)) {
    return handleSkipFlow(state);
  }

  // Add user message
  const newState: IntakeState = {
    ...addMessage(state, 'user', content),
    phase: 'questioning', // Back to questioning, waiting for ChatGPT response
  };

  return {
    state: newState,
    inject: null, // No injection, let conversation continue naturally
    complete: false,
    brief: null,
    error: null,
  };
}

/**
 * Handle ChatGPT response during brief building phase.
 */
function handleBriefResponse(
  state: IntakeState,
  content: string,
  retryCount: number = 0
): ProcessResult {
  // Try to parse the JSON
  const brief = parseBriefFromJSON(content, state.originalRequest);

  if (brief && isBriefComplete(brief)) {
    // Success! Mark as complete
    const newState: IntakeState = {
      ...addMessage(state, 'assistant', content),
      phase: 'complete',
      brief,
    };

    return {
      state: newState,
      inject: null,
      complete: true,
      brief,
      error: null,
    };
  }

  // JSON parsing failed
  if (retryCount < 2) {
    // Inject recovery prompt
    const newState = addMessage(state, 'system', RECOVERY_PROMPT);

    return {
      state: newState,
      inject: RECOVERY_PROMPT,
      complete: false,
      brief: null,
      error: null,
    };
  }

  // Max retries reached, use fallback
  const fallbackBrief = createFallbackBrief(state.originalRequest);
  const newState: IntakeState = {
    ...state,
    phase: 'complete',
    brief: fallbackBrief,
  };

  return {
    state: newState,
    inject: null,
    complete: true,
    brief: fallbackBrief,
    error: 'Could not parse brief from ChatGPT, using fallback',
  };
}

// ============================================================================
// MAIN FLOW CONTROLLER
// ============================================================================

/**
 * Intake flow controller class.
 * Manages the full intake conversation lifecycle.
 */
export class IntakeFlowController {
  private state: IntakeState;
  private config: IntakeConfig;
  private retryCount: number = 0;

  constructor(
    originalRequest: string,
    config: Partial<IntakeConfig> = {}
  ) {
    this.state = createIntakeSession(originalRequest);
    this.config = { ...DEFAULT_INTAKE_CONFIG, ...config };
  }

  /**
   * Get current state.
   */
  getState(): IntakeState {
    return this.state;
  }

  /**
   * Get current phase.
   */
  getPhase(): IntakePhase {
    return this.state.phase;
  }

  /**
   * Check if intake is complete.
   */
  isComplete(): boolean {
    return this.state.phase === 'complete';
  }

  /**
   * Get the final brief (only valid if complete).
   */
  getBrief(): ProjectBrief | null {
    return this.state.brief;
  }

  /**
   * Start the intake flow.
   * Returns the prompt to inject into ChatGPT.
   */
  start(): ProcessResult {
    const result = handleInitialPhase(this.state, this.config);
    this.state = result.state;
    return result;
  }

  /**
   * Process a message from ChatGPT.
   */
  processAssistantMessage(content: string): ProcessResult {
    let result: ProcessResult;

    if (this.state.phase === 'building_brief') {
      result = handleBriefResponse(this.state, content, this.retryCount);
      if (!result.complete && result.inject === RECOVERY_PROMPT) {
        this.retryCount++;
      }
    } else {
      result = handleAssistantMessage(this.state, content, this.config);
    }

    this.state = result.state;
    return result;
  }

  /**
   * Process a message from the user.
   */
  processUserMessage(content: string): ProcessResult {
    const result = handleUserAnswer(this.state, content, this.config);
    this.state = result.state;
    return result;
  }

  /**
   * Force skip the intake process.
   */
  forceSkip(): ProcessResult {
    const result = handleSkipFlow(this.state);
    this.state = result.state;
    return result;
  }

  /**
   * Get conversation history for context.
   */
  getConversationHistory(): IntakeMessage[] {
    return [...this.state.messages];
  }

  /**
   * Check if session has timed out.
   */
  hasTimedOut(): boolean {
    return Date.now() - this.state.lastActivity > this.config.timeoutMs;
  }

  /**
   * Handle timeout by creating fallback brief.
   */
  handleTimeout(): ProcessResult {
    const fallbackBrief = createFallbackBrief(this.state.originalRequest);
    this.state = {
      ...this.state,
      phase: 'complete',
      brief: fallbackBrief,
    };

    return {
      state: this.state,
      inject: null,
      complete: true,
      brief: fallbackBrief,
      error: 'Intake timed out, using fallback brief',
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick intake for simple requests.
 * Skips questioning and creates brief directly from message.
 */
export function quickIntake(message: string): ProjectBrief {
  return createFallbackBrief(message);
}

/**
 * Check if a message should trigger intake flow.
 * Returns false for very short or simple messages.
 */
export function shouldTriggerIntake(message: string): boolean {
  // Too short for meaningful intake
  if (message.length < 10) {
    return false;
  }

  // Simple commands don't need intake
  const simpleCommands = [
    /^help$/i,
    /^quit$/i,
    /^exit$/i,
    /^clear$/i,
    /^reset$/i,
    /^version$/i,
    /^status$/i,
  ];

  if (simpleCommands.some(p => p.test(message.trim()))) {
    return false;
  }

  // Everything else might benefit from intake
  return true;
}
