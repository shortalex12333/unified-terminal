/**
 * PA Ledger Integration
 *
 * Wires the PA to the ledger system for communication with:
 * - Monkey (reads detections, never replies directly)
 * - Orchestrator (writes decisions, reads assignments)
 * - Bodyguard (reads verdicts)
 * - Spine (reads diffs)
 *
 * The PA is the central decision point that:
 * 1. READS: Monkey detections, Bodyguard verdicts, Spine diffs, Worker checkpoints
 * 2. WRITES: Decisions, Queries, Handovers
 * 3. COORDINATES: With Orchestrator for task assignment changes
 */

import { EventEmitter } from 'events';
import { getLedgerWriter, getLedgerReader, generateLedgerId } from '../ledger';
import type {
  LedgerWriter,
  LedgerReader,
  MonkeyLedgerEntry,
  PADecisionLedgerEntry,
  PAQueryLedgerEntry,
  BodyguardLedgerEntry,
  WorkerCheckpointLedgerEntry,
  SpineLedgerEntry,
  SpineReviewPayload,
  RemainingWorkItem,
} from '../ledger';
import type { PAConfig, DetectedPattern, SubSpineCheckpoint } from './types';
import { CURIOUS_MONKEY } from '../enforcement/constants';

// =============================================================================
// PA LEDGER INTEGRATION CLASS
// =============================================================================

/**
 * PALedgerIntegration handles all ledger-based communication for the PA.
 */
export class PALedgerIntegration extends EventEmitter {
  private writer: LedgerWriter;
  private reader: LedgerReader;
  private projectRoot: string;
  private pollTimer: NodeJS.Timeout | null = null;
  private config: PAConfig | null = null;

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    this.writer = getLedgerWriter(projectRoot);
    this.reader = getLedgerReader(projectRoot);
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize ledger integration with PA config.
   */
  initialize(config: PAConfig): void {
    this.config = config;

    // Start watching ledgers
    this.reader.watch('ledgers/monkey_detections.jsonl');
    this.reader.watch('ledgers/bodyguard.jsonl');
    this.reader.watch('ledgers/worker_checkpoints.jsonl');
    this.reader.watch('ledgers/spine.jsonl');

    // Subscribe to new entries
    this.reader.on('entry:monkey:DETECTION', (entry: MonkeyLedgerEntry) => {
      this.handleMonkeyDetection(entry);
    });

    this.reader.on('entry:bodyguard:GATE_VERDICT', (entry: BodyguardLedgerEntry) => {
      this.handleBodyguardVerdict(entry);
    });

    this.reader.on('entry:worker:CHECKPOINT', (entry: WorkerCheckpointLedgerEntry) => {
      this.handleWorkerCheckpoint(entry);
    });

    // Subscribe to Spine reviews
    this.reader.on('entry:spine:REVIEW', (entry: SpineLedgerEntry) => {
      if (entry.type === 'REVIEW') {
        this.handleSpineReview(entry as SpineLedgerEntry & { payload: SpineReviewPayload });
      }
    });

    console.log('[PA-Ledger] Initialized and watching ledgers');
  }

  // ===========================================================================
  // MONKEY DETECTION HANDLING (ONE-WAY)
  // ===========================================================================

  /**
   * Handle a new detection from Monkey.
   *
   * KEY CONSTRAINT: We NEVER reply directly to Monkey.
   * We act on the detection, and Monkey learns by observing
   * the subsequent changes in sub_spines.
   */
  private async handleMonkeyDetection(entry: MonkeyLedgerEntry): Promise<void> {
    const { payload } = entry;

    console.log(`[PA-Ledger] Monkey detection: ${payload.detectionType} for ${payload.agentId}`);

    // Decide action based on severity
    switch (payload.severity) {
      case 'escalate':
        // High priority: Surface question to user immediately
        if (payload.suggestedQuestion) {
          await this.surfaceQuestion(
            payload.suggestedQuestion,
            'high',
            'monkey',
            payload.agentId,
            entry.id // Use detection ID as correlation
          );
        }
        break;

      case 'flag':
        // Medium priority: Log decision, may surface question
        this.writer.writePADecision({
          decisionType: 'OBSERVATION',
          targetAgent: payload.agentId,
          trigger: {
            source: 'monkey',
            description: `${payload.detectionType}: ${payload.evidence}`,
          },
          action: 'logged_for_review',
        }, entry.id);

        // Surface question if confidence is high enough
        if (payload.confidence >= 0.8 && payload.suggestedQuestion) {
          await this.surfaceQuestion(
            payload.suggestedQuestion,
            'medium',
            'monkey',
            payload.agentId,
            entry.id
          );
        }
        break;

      case 'nudge':
        // Low priority: Log only, don't surface
        this.writer.writePADecision({
          decisionType: 'OBSERVATION',
          targetAgent: payload.agentId,
          trigger: {
            source: 'monkey',
            description: `${payload.detectionType}: ${payload.evidence}`,
          },
          action: 'nudge_logged',
        }, entry.id);
        break;
    }

    this.emit('monkey-detection-processed', entry);
  }

  // ===========================================================================
  // BODYGUARD VERDICT HANDLING
  // ===========================================================================

  /**
   * Handle a gate verdict from Bodyguard.
   */
  private handleBodyguardVerdict(entry: BodyguardLedgerEntry): void {
    const { payload } = entry;

    console.log(`[PA-Ledger] Bodyguard verdict: ${payload.verdict} for step ${payload.stepId}`);

    if (payload.verdict === 'HARD_FAIL') {
      // Hard fail: Need to notify Orchestrator
      this.writer.writePADecision({
        decisionType: 'ESCALATION',
        targetAgent: null,
        trigger: {
          source: 'pattern',
          description: `Step ${payload.stepId} hard failed: ${payload.reasons.join(', ')}`,
        },
        action: 'orchestrator_notified',
      }, entry.id);

      this.emit('hard-fail', { stepId: payload.stepId, reasons: payload.reasons });
    } else if (payload.verdict === 'SOFT_FAIL') {
      // Soft fail: User can skip
      this.writer.writePADecision({
        decisionType: 'OBSERVATION',
        targetAgent: null,
        trigger: {
          source: 'pattern',
          description: `Step ${payload.stepId} soft failed: ${payload.reasons.join(', ')}`,
        },
        action: 'user_can_skip',
      }, entry.id);
    }
  }

  // ===========================================================================
  // WORKER CHECKPOINT HANDLING
  // ===========================================================================

  /**
   * Handle a new checkpoint from a Worker.
   */
  private handleWorkerCheckpoint(entry: WorkerCheckpointLedgerEntry): void {
    const { payload } = entry;

    console.log(`[PA-Ledger] Worker checkpoint: ${payload.agentId} at ${payload.contextPercent}%`);

    // Check for RED status (needs handover)
    if (payload.status === 'RED') {
      this.initiateHandover(payload.agentId, entry);
    }

    // Check for blocked status
    if (payload.blocked.length > 0) {
      this.writer.writePADecision({
        decisionType: 'OBSERVATION',
        targetAgent: payload.agentId,
        trigger: {
          source: 'threshold',
          description: `Agent blocked: ${payload.blocked.join(', ')}`,
        },
        action: 'blocker_detected',
      }, entry.id);

      this.emit('agent-blocked', { agentId: payload.agentId, blockers: payload.blocked });
    }

    // Check for assumptions without questions (pattern detection)
    if (payload.assumptions.length > 0 && payload.questions.length === 0) {
      this.writer.writePADecision({
        decisionType: 'OBSERVATION',
        targetAgent: payload.agentId,
        trigger: {
          source: 'pattern',
          description: 'Agent made assumptions without asking questions',
        },
        action: 'assumption_flagged',
      }, entry.id);
    }
  }

  // ===========================================================================
  // SPINE REVIEW HANDLING
  // ===========================================================================

  /**
   * Handle a Spine review with "what's next" recommendations.
   *
   * PA acts as the decision maker:
   * 1. Reads Spine's analysis of remaining work
   * 2. Decides priority and sequencing
   * 3. Dispatches to Orchestrator for assignment
   */
  private handleSpineReview(entry: SpineLedgerEntry & { payload: SpineReviewPayload }): void {
    const { payload } = entry;

    console.log(`[PA-Ledger] Spine review received for step ${payload.stepId}`);
    console.log(`[PA-Ledger] ${payload.remainingWork.length} remaining work items`);

    // If no remaining work, we're done
    if (payload.remainingWork.length === 0) {
      this.writer.writePADecision({
        decisionType: 'OBSERVATION',
        targetAgent: payload.workerId,
        trigger: {
          source: 'threshold',
          description: `Step ${payload.stepId} complete with no remaining work`,
        },
        action: 'step_complete',
      }, entry.id);

      this.emit('step-complete', { stepId: payload.stepId });
      return;
    }

    // Process remaining work items
    for (const work of payload.remainingWork) {
      this.dispatchRemainingWork(work, entry.id, payload.stepId);
    }
  }

  /**
   * Dispatch a remaining work item to the Orchestrator.
   */
  private dispatchRemainingWork(
    work: RemainingWorkItem,
    correlationId: string,
    parentStepId: string
  ): void {
    console.log(`[PA-Ledger] Dispatching: ${work.description} (${work.agentType}, ${work.priority})`);

    // Write PA decision
    this.writer.writePADecision({
      decisionType: 'DISPATCH',
      targetAgent: null,  // Orchestrator will assign
      trigger: {
        source: 'threshold',  // Spine review is a threshold-based decision
        description: work.description,
      },
      action: `dispatch_${work.agentType}`,
      metadata: {
        priority: work.priority,
        agentType: work.agentType,
        dependencies: work.dependencies,
        source: work.source,
        parentStep: parentStepId,
      },
    }, correlationId);

    // Write Orchestrator assignment
    this.writer.writeOrchestratorAssignment({
      type: 'ASSIGNMENT',
      stepId: generateLedgerId(),
      planId: 'current',
      task: work.description,
      priority: work.priority,
      agentType: work.agentType,
      dependencies: work.dependencies,
      parentStep: parentStepId,
    }, correlationId);

    this.emit('work-dispatched', {
      description: work.description,
      agentType: work.agentType,
      priority: work.priority,
    });
  }

  // ===========================================================================
  // QUESTION SURFACING
  // ===========================================================================

  /**
   * Surface a question to the user via the query ledger.
   */
  async surfaceQuestion(
    question: string,
    priority: 'low' | 'medium' | 'high' | 'critical',
    triggeredBy: 'monkey' | 'pattern' | 'checkpoint' | 'agent',
    targetAgent?: string,
    correlationId?: string
  ): Promise<PAQueryLedgerEntry> {
    const queryId = generateLedgerId();

    const entry = this.writer.writePAQuery({
      queryId,
      question,
      priority,
      triggeredBy,
      targetAgent,
      autoSkipMs: CURIOUS_MONKEY.QUESTION_AUTO_SKIP_MS,
    }, correlationId);

    console.log(`[PA-Ledger] Surfaced question: ${question.substring(0, 50)}...`);

    // Set up auto-skip timer
    setTimeout(() => {
      this.handleQueryTimeout(queryId, correlationId);
    }, CURIOUS_MONKEY.QUESTION_AUTO_SKIP_MS);

    this.emit('question-surfaced', { queryId, question, priority });

    return entry;
  }

  /**
   * Handle query timeout (auto-skip).
   */
  private handleQueryTimeout(queryId: string, correlationId?: string): void {
    // Check if query was already answered
    const pendingQueries = this.reader.readPendingQueries();
    const stillPending = pendingQueries.find(q => q.payload.queryId === queryId);

    if (stillPending) {
      // Auto-skip
      this.writer.updatePAQuery(queryId, { status: 'timeout' }, correlationId);
      console.log(`[PA-Ledger] Query ${queryId} timed out, auto-skipped`);
      this.emit('question-timeout', { queryId });
    }
  }

  /**
   * Record user's answer to a question.
   */
  recordAnswer(queryId: string, answer: string, correlationId?: string): void {
    this.writer.updatePAQuery(queryId, {
      status: 'answered',
      answer,
    }, correlationId);

    console.log(`[PA-Ledger] Recorded answer for ${queryId}`);
    this.emit('question-answered', { queryId, answer });
  }

  /**
   * Record user skipping a question.
   */
  recordSkip(queryId: string, correlationId?: string): void {
    this.writer.updatePAQuery(queryId, { status: 'skipped' }, correlationId);

    console.log(`[PA-Ledger] Question ${queryId} skipped by user`);
    this.emit('question-skipped', { queryId });
  }

  // ===========================================================================
  // HANDOVER INITIATION
  // ===========================================================================

  /**
   * Initiate handover when agent hits RED status.
   */
  private initiateHandover(
    agentId: string,
    checkpoint: WorkerCheckpointLedgerEntry
  ): void {
    const correlationId = generateLedgerId();

    // Write handover decision
    this.writer.writePADecision({
      decisionType: 'HANDOVER_INITIATED',
      targetAgent: agentId,
      trigger: {
        source: 'threshold',
        description: `Agent at ${checkpoint.payload.contextPercent}% context (RED status)`,
      },
      action: 'handover_to_orchestrator',
    }, correlationId);

    // Notify orchestrator via event (they watch orchestrator ledger)
    this.writer.writeOrchestratorAssignment({
      type: 'REASSIGNMENT',
      stepId: 'handover',
      planId: 'current',
      previousWorker: agentId,
      reason: `Context exhaustion at ${checkpoint.payload.contextPercent}%`,
    }, correlationId);

    console.log(`[PA-Ledger] Handover initiated for ${agentId}`);
    this.emit('handover-initiated', { agentId, checkpoint });
  }

  // ===========================================================================
  // ORCHESTRATOR COMMUNICATION
  // ===========================================================================

  /**
   * Write a decision for the Orchestrator to act on.
   */
  writeOrchestratorDecision(
    type: 'ASSIGNMENT' | 'REASSIGNMENT' | 'COMPLETION' | 'FAILURE',
    details: {
      stepId: string;
      planId: string;
      workerId?: string;
      task?: string;
      reason?: string;
      error?: string;
    },
    correlationId?: string
  ): void {
    this.writer.writeOrchestratorAssignment({
      type,
      ...details,
    }, correlationId);
  }

  // ===========================================================================
  // POLLING FOR UNPROCESSED DETECTIONS
  // ===========================================================================

  /**
   * Start polling for unprocessed Monkey detections.
   * Called at PA startup to catch any detections from before PA started.
   */
  startPolling(intervalMs: number = 30_000): void {
    if (this.pollTimer) return;

    // Process any existing unprocessed detections
    this.processUnprocessedDetections();

    // Set up periodic poll
    this.pollTimer = setInterval(() => {
      this.processUnprocessedDetections();
    }, intervalMs);

    console.log(`[PA-Ledger] Started polling every ${intervalMs}ms`);
  }

  /**
   * Stop polling.
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('[PA-Ledger] Stopped polling');
    }
  }

  /**
   * Process any unprocessed Monkey detections.
   */
  private processUnprocessedDetections(): void {
    const unprocessed = this.reader.readUnprocessedMonkeyDetections();

    if (unprocessed.length > 0) {
      console.log(`[PA-Ledger] Processing ${unprocessed.length} unprocessed Monkey detections`);

      for (const detection of unprocessed) {
        this.handleMonkeyDetection(detection);
      }
    }
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * Clean up resources.
   */
  cleanup(): void {
    this.stopPolling();
    this.reader.cleanup();
    this.removeAllListeners();
    console.log('[PA-Ledger] Cleaned up');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a PA ledger integration instance.
 */
export function createPALedgerIntegration(projectRoot: string): PALedgerIntegration {
  return new PALedgerIntegration(projectRoot);
}
