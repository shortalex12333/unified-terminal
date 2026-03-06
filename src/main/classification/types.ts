/**
 * Project types that Kenoki can handle
 */
export type ProjectType = 'site' | 'app' | 'ecom' | 'existing' | 'chat' | 'quick';

/**
 * Capabilities associated with each project type
 */
export interface Capabilities {
  /** Skills required for this project type */
  skills: string[];
  /** MCP servers that may be needed */
  mcps: string[];
  /** Brief template ID to use */
  template: string;
  /** Estimated step count range [min, max] */
  estimatedSteps: [number, number];
  /** What to do first: analyze existing code or scaffold new */
  firstPhase: 'analysis' | 'scaffold';
  /** How to route this project */
  route: 'chatgpt-direct' | 'codex-single' | 'full-orchestration';
}

/**
 * Result from the project classifier
 */
export interface ClassificationResult {
  /** Primary detected project type */
  primary: ProjectType;
  /** Secondary capabilities that may be needed (blended types) */
  addons: ProjectType[];
  /** Confidence score 0-1 */
  confidence: number;
  /** Extracted goal from user input */
  extractedGoal: string;
  /** Suggested project name */
  suggestedName: string;
}

/**
 * Threshold below which we ask user to clarify
 */
export const CONFIDENCE_THRESHOLD = 0.7;
