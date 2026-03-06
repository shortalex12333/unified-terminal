/**
 * Local Analytics Types
 *
 * Anonymous, local-first telemetry types for understanding product usage.
 * All data stays on the user's device - NO cloud, NO tracking.
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Base analytics event structure.
 * All events are anonymous (no user ID, no IP).
 */
export interface AnalyticsEvent {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Event name (e.g., 'build_started', 'template_selected') */
  event: string;
  /** Event-specific properties */
  properties: Record<string, unknown>;
}

/**
 * Event types for type-safe tracking.
 */
export type AnalyticsEventType =
  | 'build_started'
  | 'build_completed'
  | 'build_cancelled'
  | 'intake_question_skipped'
  | 'tree_expanded'
  | 'tree_collapsed'
  | 'template_selected'
  | 'error_occurred';

// ============================================================================
// EVENT PROPERTIES
// ============================================================================

/**
 * Properties for build_started event.
 */
export interface BuildStartedProperties {
  /** Template or project type used */
  template: string;
  /** Execution tier (0-3) */
  tier: number;
  /** Number of planned steps */
  plannedSteps?: number;
}

/**
 * Properties for build_completed event.
 */
export interface BuildCompletedProperties {
  /** Template or project type */
  template: string;
  /** Execution tier used */
  tier: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Total steps executed */
  stepsCompleted: number;
  /** Steps that failed */
  stepsFailed: number;
  /** Steps that were skipped */
  stepsSkipped: number;
  /** Whether build was successful */
  success: boolean;
}

/**
 * Properties for build_cancelled event.
 */
export interface BuildCancelledProperties {
  /** Current step when cancelled */
  currentStep: string;
  /** Reason for cancellation */
  reason: 'user_stop' | 'circuit_breaker' | 'timeout' | 'error';
  /** Step number at cancellation */
  stepNumber: number;
  /** Total planned steps */
  totalSteps: number;
  /** Progress percentage at cancellation */
  progressPercent: number;
}

/**
 * Properties for intake_question_skipped event.
 */
export interface IntakeQuestionSkippedProperties {
  /** Question that was skipped */
  question: string;
  /** Position in the intake flow */
  questionIndex: number;
}

/**
 * Properties for tree_expanded/collapsed events.
 */
export interface TreeToggleProperties {
  /** Node ID that was toggled */
  nodeId: string;
  /** Depth in the tree */
  depth: number;
}

/**
 * Properties for template_selected event.
 */
export interface TemplateSelectedProperties {
  /** Template identifier */
  templateId: string;
  /** Category of template */
  category?: string;
}

/**
 * Properties for error_occurred event.
 */
export interface ErrorOccurredProperties {
  /** Type of error */
  errorType: string;
  /** Whether error was recoverable */
  recoverable: boolean;
  /** Related step ID if applicable */
  stepId?: number;
}

// ============================================================================
// SUMMARY TYPES
// ============================================================================

/**
 * Tier usage statistics.
 */
export interface TierUsage {
  /** Tier 0: Fast-path (local bypass) */
  tier0: number;
  /** Tier 1: Router (persistent Codex session) */
  tier1: number;
  /** Tier 2: CLI executor */
  tier2: number;
  /** Tier 3: Hybrid execution */
  tier3: number;
}

/**
 * Aggregated analytics summary.
 * This is what users see in the AnalyticsPanel.
 */
export interface AnalyticsSummary {
  /** Total number of builds started */
  totalBuilds: number;
  /** Number of builds that completed successfully */
  completedBuilds: number;
  /** Number of builds that were cancelled */
  cancelledBuilds: number;
  /** Average build time in milliseconds */
  averageBuildTime: number;
  /** Usage count per tier */
  tierUsage: TierUsage;
  /** Most frequently used templates (top 5) */
  topTemplates: string[];
  /** Most common cancellation points (step names) */
  commonCancelPoints: string[];
  /** Success rate as a percentage */
  successRate: number;
  /** Total time spent building in milliseconds */
  totalBuildTime: number;
  /** First event timestamp */
  firstEventAt: number | null;
  /** Most recent event timestamp */
  lastEventAt: number | null;
}

// ============================================================================
// STORE TYPES
// ============================================================================

/**
 * Persisted analytics data structure.
 */
export interface AnalyticsData {
  /** Version for migration support */
  version: number;
  /** List of events (capped at MAX_EVENTS) */
  events: AnalyticsEvent[];
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Analytics store configuration.
 */
export interface AnalyticsStoreConfig {
  /** Path to store analytics data */
  storagePath: string;
  /** Maximum number of events to keep */
  maxEvents: number;
  /** Whether analytics is enabled */
  enabled: boolean;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsStoreConfig = {
  storagePath: '', // Set at runtime
  maxEvents: 1000,
  enabled: true,
};

export const ANALYTICS_DATA_VERSION = 1;
