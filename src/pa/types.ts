/**
 * PA (Parallel Agent) Core Types
 *
 * Defines the type system for the PA orchestration layer that monitors,
 * coordinates, and intervenes with parallel agent execution.
 */

// Import shared types from canonical sources
import type { AgentStatus } from '../enforcement/registry';

// Re-export for convenience (single source: enforcement/registry.ts)
export type { AgentStatus };

// =============================================================================
// Enums
// =============================================================================

/**
 * Status levels for sub-spine checkpoints
 */
export enum CheckpointStatus {
  GREEN = 'GREEN',   // Agent proceeding normally
  AMBER = 'AMBER',   // Agent needs attention but not blocked
  RED = 'RED'        // Agent blocked or failing
}

/**
 * Types of patterns the PA can detect across agent execution
 */
export enum PatternType {
  REPEATED_ERROR = 'REPEATED_ERROR',   // Same error appearing multiple times
  STUCK = 'STUCK',                     // Agent making no progress
  SCOPE_DRIFT = 'SCOPE_DRIFT',         // Agent working outside mandate
  TOKEN_CRITICAL = 'TOKEN_CRITICAL',   // Agent approaching context limit
  BLOCKED = 'BLOCKED'                  // Agent cannot proceed
}

/**
 * Actions the PA can suggest or take in response to detected patterns
 */
export enum SuggestedAction {
  INJECT_SKILL = 'INJECT_SKILL',         // Inject a skill into agent context
  SEND_CORRECTION = 'SEND_CORRECTION',   // Send corrective guidance
  FORCE_CHECKPOINT = 'FORCE_CHECKPOINT', // Force agent to write checkpoint
  REASSIGN_TASK = 'REASSIGN_TASK',       // Move task to different agent
  ESCALATE_TO_USER = 'ESCALATE_TO_USER', // Escalate to human operator
  TERMINATE_AGENT = 'TERMINATE_AGENT',   // Stop the agent
  INCREASE_TOKENS = 'INCREASE_TOKENS',   // Allow more context if possible
  NO_ACTION = 'NO_ACTION'                // Monitor only
}

/**
 * Types of decisions the PA can make
 */
export enum PADecisionType {
  INTERVENTION = 'INTERVENTION',       // Active intervention in agent
  OBSERVATION = 'OBSERVATION',         // Logged observation, no action
  SKILL_INJECTION = 'SKILL_INJECTION', // Injected skill content
  CHECKPOINT_FORCED = 'CHECKPOINT_FORCED', // Forced checkpoint write
  ESCALATION = 'ESCALATION',           // Escalated to user
  TERMINATION = 'TERMINATION'          // Terminated agent
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Threshold configuration for PA monitoring
 */
export interface PAThresholds {
  /** Token percentage at which to warn agent (e.g., 70) */
  tokenWarningPercent: number;
  /** Token percentage at which to force checkpoint (e.g., 85) */
  tokenCriticalPercent: number;
  /** Number of identical errors before flagging REPEATED_ERROR */
  repeatedErrorCount: number;
  /** Seconds without checkpoint before flagging STUCK */
  stuckTimeoutSeconds: number;
  /** Maximum files an agent can touch before scope review */
  maxFilesTouched: number;
}

/**
 * Main configuration for the PA system
 */
export interface PAConfig {
  /** Root directory of the project being worked on */
  projectDir: string;
  /** Domains/areas the PA monitors (e.g., ['frontend', 'backend', 'database']) */
  domains: string[];
  /** How often to poll for sub-spine updates (milliseconds) */
  pollIntervalMs: number;
  /** Monitoring thresholds */
  thresholds: PAThresholds;
  /** Path to sub-spine directory template: {{ PROJECT_DIR }}/.planning/sub-spines/ */
  subSpineDir: string;
  /** Path to PA decision log: {{ PROJECT_DIR }}/.planning/pa/decisions.jsonl */
  decisionLogPath: string;
  /** Path to PA state file: {{ PROJECT_DIR }}/.planning/pa/state.json */
  statePath: string;
}

// =============================================================================
// Agent View
// =============================================================================

/**
 * The PA's view of an individual agent
 */
export interface PAAgentView {
  /** Unique session identifier for this agent instance */
  sessionId: string;
  /** Human-readable role (e.g., 'implementer', 'tester', 'reviewer') */
  role: string;
  /** Domain this agent is responsible for */
  domain: string;
  /** Current execution status */
  status: AgentStatus;
  /** Path to this agent's sub-spine file: {{ SUB_SPINE_DIR }}/{{ SESSION_ID }}.md */
  subSpinePath: string;
  /** Current token usage as percentage of context limit */
  tokenPercent: number;
  /** The specific task/mandate assigned to this agent */
  mandate: string;
  /** Timestamp of last activity */
  lastActivityAt: Date;
  /** Number of checkpoints written */
  checkpointCount: number;
  /** Files this agent has modified */
  filesTouched: string[];
}

// =============================================================================
// Sub-Spine Checkpoint
// =============================================================================

/**
 * Parsed content from an agent's sub-spine checkpoint
 */
export interface SubSpineCheckpoint {
  /** Agent that wrote this checkpoint */
  agentId: string;
  /** Sequential checkpoint number for this agent */
  checkpointNumber: number;
  /** Context/token usage percentage at time of checkpoint */
  contextPercent: number;
  /** Overall status assessment */
  status: CheckpointStatus;
  /** Tasks marked as completed */
  completed: string[];
  /** Tasks currently being worked on */
  inProgress: string[];
  /** Tasks that cannot proceed */
  blocked: string[];
  /** Files modified since last checkpoint */
  filesTouched: string[];
  /** Planned next actions */
  nextSteps: string[];
  /** Raw markdown content of the checkpoint */
  rawContent: string;
  /** Any errors encountered parsing the checkpoint */
  parseErrors: string[];
  /** Timestamp when checkpoint was written */
  timestamp: Date;
}

// =============================================================================
// Pattern Detection
// =============================================================================

/**
 * A pattern detected by the PA across agent execution
 */
export interface DetectedPattern {
  /** Classification of the pattern */
  type: PatternType;
  /** Agent exhibiting this pattern */
  agentId: string;
  /** Human-readable description of what was detected */
  description: string;
  /** PA's recommended action */
  suggestedAction: SuggestedAction;
  /** If INJECT_SKILL, which skill to inject: {{ SKILLS_DIR }}/{{ SKILL_NAME }}.md */
  skillToInject?: string;
  /** If SEND_CORRECTION, the correction text to send */
  correctionText?: string;
  /** Confidence level 0-1 */
  confidence: number;
  /** Supporting evidence for this detection */
  evidence: string[];
  /** When this pattern was detected */
  detectedAt: Date;
}

// =============================================================================
// PA Decisions
// =============================================================================

/**
 * Record of a decision made by the PA
 */
export interface PADecision {
  /** When the decision was made */
  timestamp: Date;
  /** Type of decision */
  type: PADecisionType;
  /** Agent this decision targets (if applicable) */
  targetAgent: string | null;
  /** Input that led to this decision (pattern, checkpoint, etc.) */
  input: {
    patternType?: PatternType;
    checkpointStatus?: CheckpointStatus;
    tokenPercent?: number;
    description: string;
  };
  /** Action taken */
  action: SuggestedAction;
  /** If a file was written as part of this decision */
  fileWritten?: string;
  /** Outcome or result of the decision */
  outcome?: string;
}

// =============================================================================
// PA Internal State
// =============================================================================

/**
 * Internal state maintained by the PA across polling cycles
 */
export interface PAState {
  /** When the PA session started */
  startedAt: Date;
  /** Last time state was persisted */
  lastPersistedAt: Date;
  /** Current polling cycle number */
  pollCycle: number;
  /** All agents currently being monitored */
  agents: Record<string, PAAgentView>;
  /** Recent checkpoints by agent (last N per agent) */
  recentCheckpoints: Record<string, SubSpineCheckpoint[]>;
  /** Currently active patterns that haven't been resolved */
  activePatterns: DetectedPattern[];
  /** Patterns that have been addressed */
  resolvedPatterns: DetectedPattern[];
  /** Decision history (recent N decisions) */
  recentDecisions: PADecision[];
  /** Error counts per agent for REPEATED_ERROR detection */
  errorCounts: Record<string, Record<string, number>>;
  /** Last checkpoint time per agent for STUCK detection */
  lastCheckpointTime: Record<string, Date>;
  /** Configuration in use */
  config: PAConfig;
}

// =============================================================================
// Path Templates
// =============================================================================

/**
 * Path template variables used throughout the PA system.
 * These are resolved at runtime based on configuration.
 *
 * Available variables:
 * - {{ PROJECT_DIR }} - Root project directory
 * - {{ SUB_SPINE_DIR }} - Directory containing sub-spine files
 * - {{ SESSION_ID }} - Unique agent session identifier
 * - {{ SKILLS_DIR }} - Directory containing skill definitions
 * - {{ SKILL_NAME }} - Name of a specific skill
 * - {{ AGENT_ID }} - Identifier for a specific agent
 * - {{ TIMESTAMP }} - ISO timestamp
 */
export interface PathTemplates {
  subSpineFile: '{{ SUB_SPINE_DIR }}/{{ SESSION_ID }}.md';
  skillFile: '{{ SKILLS_DIR }}/{{ SKILL_NAME }}.md';
  decisionLog: '{{ PROJECT_DIR }}/.planning/pa/decisions.jsonl';
  stateFile: '{{ PROJECT_DIR }}/.planning/pa/state.json';
  agentLog: '{{ PROJECT_DIR }}/.planning/pa/agents/{{ AGENT_ID }}.log';
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Result of parsing a sub-spine file
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

/**
 * Event emitted by the PA for external consumption
 */
export interface PAEvent {
  type: 'PATTERN_DETECTED' | 'DECISION_MADE' | 'AGENT_STATUS_CHANGED' | 'CHECKPOINT_RECEIVED';
  timestamp: Date;
  payload: DetectedPattern | PADecision | PAAgentView | SubSpineCheckpoint;
}
