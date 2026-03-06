/**
 * Curious-Monkey-Agent Types
 *
 * The Monkey is a READ-ONLY observer of sub_spines that writes ONE-WAY
 * detections to PA. It never communicates directly with Status Agent,
 * Frontend, or agents. It learns by observing outcomes in sub_spines.
 *
 * Key constraints:
 * - READ: sub_spines, agent outputs
 * - WRITE: detections.jsonl, patterns.jsonl (one-way to PA)
 * - NEVER: write to queries/, status agent, or sub_spines
 * - NEVER: receive direct replies (observes transcribed answers only)
 */

// =============================================================================
// DETECTION TYPES
// =============================================================================

/**
 * Types of patterns the Monkey can detect
 */
export type SlopPattern =
  | 'GENERIC_LANGUAGE'      // "professional", "modern", "user-friendly"
  | 'SILENT_ASSUMPTION'     // Made decision without ASSUMED: marker
  | 'NO_QUESTIONS'          // Agent has assumptions but asked nothing
  | 'TECHNICAL_QUESTION'    // Asked "REST or GraphQL?" to non-technical user
  | 'BUZZWORD_DENSITY'      // Too many meaningless words per paragraph
  | 'COPY_PASTE_SMELL';     // Output looks templated/boilerplate

/**
 * Severity of detection (determines PA's action)
 */
export type DetectionSeverity = 'nudge' | 'flag' | 'escalate';

/**
 * A detection written by Monkey to PA
 * This is ONE-WAY: Monkey writes, PA reads, Monkey never hears reply
 */
export interface MonkeyDetection {
  /** Unique detection ID */
  id: string;
  /** When detected */
  timestamp: Date;
  /** Type of pattern detected */
  type: SlopPattern;
  /** Agent exhibiting this pattern */
  agentId: string;
  /** The actual text that triggered detection */
  evidence: string;
  /** Monkey suggests question, PA decides whether to use it */
  suggestedQuestion?: string;
  /** Confidence level 0-1 */
  confidence: number;
  /** Detection severity */
  severity: DetectionSeverity;
  /** Line/section in sub_spine where detected */
  location?: {
    file: string;
    section: string;
    lineNumber?: number;
  };
}

// =============================================================================
// LEARNING/PATTERN TYPES
// =============================================================================

/**
 * Outcome of a detection (observed by Monkey in sub_spines after PA acts)
 * Monkey never receives direct replies - it reads the transcribed outcome
 */
export interface DetectionOutcome {
  /** Original detection ID */
  detectionId: string;
  /** Did PA act on this detection? (Monkey observes via query files) */
  paActed: boolean;
  /** Did user answer? (Monkey observes via sub_spine update) */
  userAnswered: boolean;
  /** Did user skip? (Monkey observes via skip marker) */
  userSkipped: boolean;
  /** Did work change after answer? (Monkey diffs agent output) */
  workChanged: boolean;
  /** Quality assessment of change */
  changeQuality: 'improved' | 'same' | 'degraded' | 'unknown';
  /** When outcome was observed */
  observedAt: Date;
}

/**
 * Learned pattern stored for future detection tuning
 */
export interface LearnedPattern {
  /** Detection type this pattern applies to */
  detectionType: SlopPattern;
  /** The suggested question that was used */
  suggestedQuestion: string;
  /** Observed outcome */
  outcome: DetectionOutcome;
  /** What Monkey learned from this */
  learned: string;
  /** Confidence adjustment for future detections */
  confidenceAdjustment: number;
  /** When pattern was learned */
  learnedAt: Date;
}

// =============================================================================
// OBSERVATION TYPES
// =============================================================================

/**
 * A sub_spine checkpoint as read by Monkey (read-only)
 */
export interface ObservedCheckpoint {
  agentId: string;
  checkpointNumber: number;
  contextPercent: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  completed: string[];
  inProgress: string[];
  blocked: string[];
  filesTouched: string[];
  assumptions: string[];       // Lines starting with "ASSUMED:"
  questions: string[];         // Lines in "Questions for User" section
  rawContent: string;
  observedAt: Date;
}

/**
 * Agent output observed by Monkey for slop detection
 */
export interface ObservedOutput {
  agentId: string;
  outputType: 'code' | 'text' | 'markdown' | 'mixed';
  content: string;
  filePath?: string;
  observedAt: Date;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Monkey configuration (can be tuned over time)
 */
export interface MonkeyConfig {
  /** How often to observe sub_spines (ms) */
  observationIntervalMs: number;
  /** Minimum confidence to report detection */
  minDetectionConfidence: number;
  /** Buzzword density threshold (per 100 words) */
  buzzwordDensityThreshold: number;
  /** Generic language patterns to detect */
  genericPatterns: string[];
  /** Meaningless modifier words */
  meaninglessModifiers: string[];
  /** Whether learning is enabled */
  learningEnabled: boolean;
}

// =============================================================================
// INTEGRATION TYPES
// =============================================================================

/**
 * What Monkey writes to .kenoki/monkey/detections.jsonl
 * PA reads this file to decide on action
 */
export interface DetectionLogEntry {
  detection: MonkeyDetection;
  /** Whether PA has processed this detection */
  processed: boolean;
  /** PA's decision (written by PA, read by Monkey for learning) */
  paDecision?: 'acted' | 'ignored' | 'deferred';
}

/**
 * What Monkey writes to .kenoki/monkey/patterns.jsonl
 * Used for learning and tuning future detections
 */
export interface PatternLogEntry {
  pattern: LearnedPattern;
  /** How many times this pattern has been observed */
  occurrences: number;
  /** Running success rate (user answered and work improved) */
  successRate: number;
}

// =============================================================================
// MONKEY STATE
// =============================================================================

/**
 * Internal state of the Monkey observer
 */
export interface MonkeyState {
  /** When Monkey started observing */
  startedAt: Date;
  /** Current observation cycle number */
  observationCycle: number;
  /** Agents currently being observed */
  observedAgents: string[];
  /** Recent detections (last N) */
  recentDetections: MonkeyDetection[];
  /** Pending detections not yet processed by PA */
  pendingDetections: MonkeyDetection[];
  /** Learned patterns for tuning */
  learnedPatterns: LearnedPattern[];
  /** Configuration in use */
  config: MonkeyConfig;
}
