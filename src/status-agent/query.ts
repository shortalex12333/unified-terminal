/**
 * Query Router - User Decision Points and Response Routing
 *
 * Job 2: When agents need user decisions, render buttons/inputs
 *
 * Handles:
 * - FORCED_CHECKPOINTS: Mandatory pause points (solves "Codex one-shots everything")
 * - Query creation: Build user decision prompts
 * - Response routing: Route user decisions back to specific agents via PA envelope
 *
 * Key insight: Codex will one-shot everything if we don't force pauses.
 * FORCED_CHECKPOINTS are mandatory interruption points where we stop
 * and wait for user confirmation before proceeding.
 */

import { UserQuery, QueryOption, QueryType, QueryPriority, StatusEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default timeout for non-blocking queries (30 seconds) */
export const QUERY_TIMEOUT_MS = 30_000;

/** Timeout for blocking queries (60 seconds) */
export const BLOCKING_TIMEOUT_MS = 60_000;

/** Pre-deploy NEVER times out - requires explicit user approval */
export const DEPLOY_TIMEOUT_MS: null = null;

// =============================================================================
// FORCED CHECKPOINTS - Mandatory pause points
// =============================================================================

/**
 * Checkpoint configuration for mandatory user pauses.
 * These solve the "Codex one-shots everything" problem by forcing
 * explicit user approval at key decision points.
 */
interface CheckpointConfig {
  /** Event that triggers this checkpoint */
  trigger: string;
  /** Query to present to the user */
  query: {
    type: QueryType;
    question: string;
    options: QueryOption[];
    priority: QueryPriority;
    timeout: number | null;
  };
}

/**
 * FORCED_CHECKPOINTS - Mandatory pause points in the execution flow.
 *
 * These checkpoints MUST pause execution and wait for user input.
 * They prevent autonomous agents from making irreversible decisions.
 */
export const FORCED_CHECKPOINTS: Record<string, CheckpointConfig> = {
  /**
   * PLAN_REVIEW - After conductor creates execution plan
   * User must approve before any work begins.
   */
  PLAN_REVIEW: {
    trigger: 'conductor:plan-ready',
    query: {
      type: 'confirm',
      question: "Here's what I'm going to build. Look good?",
      options: [
        { label: "Let's go!", value: 'approve', detail: 'Start executing the plan', icon: '🚀' },
        { label: 'Change something', value: 'modify', detail: 'Edit the plan before starting', icon: '✏️' },
      ],
      priority: 'blocking',
      timeout: 120_000,  // 2 minutes
    },
  },

  /**
   * FIRST_OUTPUT - After first visible output is produced
   * Quick sanity check that work is on the right track.
   */
  FIRST_OUTPUT: {
    trigger: 'worker:first-visible-output',
    query: {
      type: 'confirm',
      question: 'First output ready. Does this look right?',
      options: [
        { label: 'Looks good!', value: 'approve', detail: 'Continue with current approach', icon: '👍' },
        { label: 'Not quite', value: 'modify', detail: 'Adjust the approach', icon: '🔄' },
        { label: 'Start over', value: 'restart', detail: 'Go back to planning', icon: '⏮️' },
      ],
      priority: 'blocking',
      timeout: 60_000,  // 1 minute
    },
  },

  /**
   * PRE_DEPLOY - Before any deployment action
   * CRITICAL: Never auto-deploy. User MUST explicitly approve.
   */
  PRE_DEPLOY: {
    trigger: 'conductor:pre-deploy',
    query: {
      type: 'confirm',
      question: 'Ready to deploy. This will go LIVE. Are you sure?',
      options: [
        { label: 'Deploy now', value: 'approve', detail: 'Push to production', icon: '🚀' },
        { label: 'Review first', value: 'review', detail: 'Open preview/staging', icon: '👀' },
        { label: 'Cancel', value: 'cancel', detail: 'Abort deployment', icon: '❌' },
      ],
      priority: 'blocking',
      timeout: null,  // NEVER auto-deploy
    },
  },

  /**
   * PROGRESS_CHECK - Every 5 steps completed
   * Non-blocking progress update with option to intervene.
   */
  PROGRESS_CHECK: {
    trigger: 'conductor:steps-completed-modulo-5',
    query: {
      type: 'confirm',
      question: 'Progress checkpoint. Everything okay?',
      options: [
        { label: 'Continue', value: 'approve', detail: 'Keep going', icon: '✅' },
        { label: 'Pause', value: 'pause', detail: 'Stop and review', icon: '⏸️' },
        { label: 'Adjust', value: 'modify', detail: 'Make a change', icon: '✏️' },
      ],
      priority: 'normal',  // Non-blocking - auto-continues if no response
      timeout: 30_000,  // 30 seconds
    },
  },

  /**
   * DESTRUCTIVE_ACTION - Before any destructive operation
   * git reset, rm -rf, DROP TABLE, etc.
   */
  DESTRUCTIVE_ACTION: {
    trigger: 'worker:destructive-action',
    query: {
      type: 'confirm',
      question: 'This action is DESTRUCTIVE and cannot be undone. Proceed?',
      options: [
        { label: 'Yes, do it', value: 'approve', detail: 'Execute destructive action', icon: '⚠️' },
        { label: 'Cancel', value: 'cancel', detail: 'Abort this action', icon: '❌' },
      ],
      priority: 'blocking',
      timeout: 60_000,  // 1 minute - requires explicit approval
    },
  },

  /**
   * COST_THRESHOLD - When estimated cost exceeds threshold
   * Pause if task will consume significant resources.
   */
  COST_THRESHOLD: {
    trigger: 'conductor:cost-threshold-exceeded',
    query: {
      type: 'confirm',
      question: 'This task may use significant API credits. Continue?',
      options: [
        { label: 'Continue', value: 'approve', detail: 'Proceed with current approach', icon: '💰' },
        { label: 'Optimize', value: 'optimize', detail: 'Try a cheaper approach', icon: '🔧' },
        { label: 'Cancel', value: 'cancel', detail: 'Abort task', icon: '❌' },
      ],
      priority: 'blocking',
      timeout: 60_000,
    },
  },
};

// =============================================================================
// PA ENVELOPE - Message format for Personal Assistant routing
// =============================================================================

/**
 * PA (Personal Assistant) Envelope - Standard message format for routing
 * responses back to specific agents.
 *
 * The PA acts as a messenger, delivering user responses to the correct
 * agent/step without broadcasting to all agents.
 */
export interface PAEnvelope {
  /** Target agent handle (e.g., 'codex-worker-1', 'image-gen') */
  target: string;
  /** Associated step ID, if part of an execution plan */
  stepId: number | null;
  /** Type of message being routed */
  type: 'query_response' | 'user_correction';
  /** Priority level for handling */
  priority: 'normal' | 'elevated' | 'urgent';
  /** The actual payload data */
  payload: unknown;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

// =============================================================================
// QUERY CREATION
// =============================================================================

/**
 * Create a new user query.
 *
 * @param source - Component requesting the query (e.g., 'conductor', 'worker')
 * @param stepId - Associated step ID, if any
 * @param agentHandle - Human-friendly name for the asking agent
 * @param config - Partial query configuration to override defaults
 * @returns Complete UserQuery object
 */
export function createQuery(
  source: string,
  stepId: number | null,
  agentHandle: string,
  config: Partial<UserQuery>
): UserQuery {
  const id = uuidv4();

  // Determine timeout based on priority
  let timeout = QUERY_TIMEOUT_MS;
  if (config.priority === 'blocking') {
    timeout = BLOCKING_TIMEOUT_MS;
  }
  if (config.timeout !== undefined) {
    timeout = config.timeout;
  }

  return {
    id,
    source,
    stepId,
    agentHandle,
    type: config.type || 'confirm',
    question: config.question || 'Please confirm',
    options: config.options || [],
    placeholder: config.placeholder || null,
    defaultChoice: config.defaultChoice || null,
    timeout,
    priority: config.priority || 'normal',
  };
}

// =============================================================================
// CHECKPOINT DETECTION
// =============================================================================

/**
 * Check if a status event triggers a forced checkpoint.
 *
 * @param event - The status event to check
 * @returns true if this event triggers a checkpoint
 */
export function isCheckpointTrigger(event: StatusEvent): boolean {
  const eventKey = `${event.source}:${event.type}`;

  for (const checkpoint of Object.values(FORCED_CHECKPOINTS)) {
    if (checkpoint.trigger === eventKey) {
      return true;
    }
  }

  return false;
}

/**
 * Get the checkpoint query for a triggering event.
 *
 * @param event - The status event that triggered the checkpoint
 * @returns UserQuery if this is a checkpoint trigger, null otherwise
 */
export function getCheckpointQuery(event: StatusEvent): UserQuery | null {
  const eventKey = `${event.source}:${event.type}`;

  for (const [name, checkpoint] of Object.entries(FORCED_CHECKPOINTS)) {
    if (checkpoint.trigger === eventKey) {
      // Parse event detail for context
      let detail: Record<string, unknown> = {};
      try {
        detail = JSON.parse(event.detail);
      } catch {
        // Ignore parse errors
      }

      // Create the query with checkpoint config
      return createQuery(
        event.source,
        (detail.stepId as number) || null,
        `checkpoint:${name.toLowerCase()}`,
        {
          type: checkpoint.query.type,
          question: checkpoint.query.question,
          options: checkpoint.query.options,
          priority: checkpoint.query.priority,
          timeout: checkpoint.query.timeout ?? undefined,
          defaultChoice: checkpoint.query.priority === 'normal' ? 'approve' : null,
        }
      );
    }
  }

  return null;
}

/**
 * Get checkpoint by name.
 *
 * @param name - Checkpoint name (e.g., 'PLAN_REVIEW', 'PRE_DEPLOY')
 * @returns Checkpoint configuration or undefined
 */
export function getCheckpointByName(name: string): CheckpointConfig | undefined {
  return FORCED_CHECKPOINTS[name];
}

// =============================================================================
// RESPONSE ROUTING
// =============================================================================

/**
 * Route a user's query response to the appropriate agent.
 *
 * Constructs a PA envelope that will be delivered to the specific agent
 * that requested the query, rather than broadcasting to all agents.
 *
 * @param queryId - ID of the query being responded to
 * @param value - User's selected value
 * @param query - The original query object
 * @returns PA envelope for routing
 */
export function routeQueryResponse(
  queryId: string,
  value: string,
  query: UserQuery
): PAEnvelope {
  // Determine priority based on query type and response
  let priority: 'normal' | 'elevated' | 'urgent' = 'normal';

  // Elevated priority for blocking queries
  if (query.priority === 'blocking') {
    priority = 'elevated';
  }

  // Urgent priority for deployment approvals
  if (query.agentHandle.includes('deploy') || query.agentHandle.includes('PRE_DEPLOY')) {
    priority = 'urgent';
  }

  // Construct target from query source and agent handle
  const target = query.agentHandle.startsWith('checkpoint:')
    ? query.source  // Checkpoints route back to their source
    : query.agentHandle;

  return {
    target,
    stepId: query.stepId,
    type: 'query_response',
    priority,
    payload: {
      queryId,
      value,
      question: query.question,
      respondedAt: Date.now(),
    },
    timestamp: Date.now(),
  };
}

/**
 * Create a PA envelope for a user correction.
 *
 * @param target - Target agent handle
 * @param stepId - Associated step ID, if any
 * @param correction - The correction text from the user
 * @returns PA envelope for routing
 */
export function routeUserCorrection(
  target: string,
  stepId: number | null,
  correction: string
): PAEnvelope {
  return {
    target,
    stepId,
    type: 'user_correction',
    priority: 'elevated',  // Corrections always take priority
    payload: {
      correction,
      receivedAt: Date.now(),
    },
    timestamp: Date.now(),
  };
}

// =============================================================================
// QUERY VALIDATION
// =============================================================================

/**
 * Validate a query response value.
 *
 * @param value - The value to validate
 * @param query - The query being responded to
 * @returns true if the value is valid for this query
 */
export function isValidQueryResponse(value: string, query: UserQuery): boolean {
  switch (query.type) {
    case 'choice':
    case 'confirm':
      // Must be one of the defined options
      return query.options.some(opt => opt.value === value);

    case 'text':
      // Any non-empty string is valid
      return value.trim().length > 0;

    case 'upload':
      // Must be a valid file path
      return value.startsWith('/') || value.startsWith('~');

    default:
      return false;
  }
}

/**
 * Check if a query has timed out.
 *
 * @param query - The query to check
 * @param createdAt - When the query was created (Unix timestamp)
 * @returns true if the query has exceeded its timeout
 */
export function isQueryTimedOut(query: UserQuery, createdAt: number): boolean {
  // null timeout means never times out
  if (query.timeout === null || query.timeout === 0) {
    return false;
  }

  return Date.now() - createdAt > query.timeout;
}

/**
 * Get the default response for a timed-out query.
 *
 * @param query - The query that timed out
 * @returns Default value or null if no default
 */
export function getTimeoutDefault(query: UserQuery): string | null {
  // Only non-blocking queries can have timeout defaults
  if (query.priority === 'blocking') {
    return null;
  }

  return query.defaultChoice;
}
