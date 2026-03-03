/**
 * Rate Limit Recovery - ChatGPT Rate Limit Detection and Recovery
 *
 * Detects when ChatGPT rate limits are hit and implements recovery strategies:
 * - Defers web-based steps until rate limit clears
 * - Polls periodically to check if limits have lifted
 * - Persists deferred steps across app restarts
 * - Automatically resumes deferred work when limits clear
 */

import { EventEmitter } from 'events';
import { getStateManager, StateManager, TaskState } from './state-manager';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A step that has been deferred due to rate limiting.
 */
export interface DeferredStep {
  /** Unique step identifier */
  id: string;
  /** Task this step belongs to */
  taskId: string;
  /** Step action type */
  action: string;
  /** Step description */
  description: string;
  /** When the step was deferred */
  deferredAt: Date;
  /** Original step data for resumption */
  stepData: Record<string, unknown>;
}

/**
 * Rate limit status information.
 */
export interface RateLimitStatus {
  /** Whether currently rate limited */
  isLimited: boolean;
  /** When the limit was first detected */
  detectedAt?: Date;
  /** Number of deferred steps */
  deferredCount: number;
  /** Last poll attempt time */
  lastPollAt?: Date;
  /** Next scheduled poll time */
  nextPollAt?: Date;
}

/**
 * Scheduler interface for coordinating step execution.
 */
export interface StepScheduler {
  /** Defer all pending web-based steps */
  deferWebSteps(): DeferredStep[];
  /** Resume deferred steps */
  resumeDeferredSteps(steps: DeferredStep[]): void;
  /** Get current deferred steps */
  getDeferredSteps(): DeferredStep[];
  /** Check if there are pending web steps */
  hasPendingWebSteps(): boolean;
  /** Probe ChatGPT with a simple message to test rate limits */
  probeChatGPT(): Promise<ProbeResult>;
}

/**
 * Result from probing ChatGPT.
 */
export interface ProbeResult {
  /** Whether the probe was successful */
  success: boolean;
  /** Response text if successful */
  response?: string;
  /** Whether rate limit was detected */
  rateLimited: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Polling interval in milliseconds (60 seconds) */
const POLL_INTERVAL_MS = 60 * 1000;

/** Maximum number of poll attempts before giving up */
const MAX_POLL_ATTEMPTS = 60;

/** State key for persisting deferred steps */
const DEFERRED_STEPS_KEY = 'rate_limit_deferred_steps';

// ============================================================================
// RATE LIMIT RECOVERY CLASS
// ============================================================================

/**
 * RateLimitRecovery - Handles ChatGPT rate limit detection and recovery.
 *
 * When a rate limit is detected:
 * 1. Defers all pending web-based steps
 * 2. Persists deferred steps to StateManager
 * 3. Starts polling to detect when limits clear
 * 4. Automatically resumes work when limits are lifted
 *
 * Events:
 * - 'rate-limited': () - Rate limit was detected
 * - 'rate-cleared': () - Rate limit has been lifted
 * - 'steps-deferred': (steps: DeferredStep[]) - Steps were deferred
 * - 'steps-resumed': (steps: DeferredStep[]) - Steps are being resumed
 * - 'poll-attempt': (attempt: number) - Polling attempt made
 * - 'poll-failed': (error: string) - Poll attempt failed
 */
export class RateLimitRecovery extends EventEmitter {
  /**
   * Regex patterns for detecting rate limit messages.
   * These patterns match various ways ChatGPT communicates rate limits.
   */
  private PATTERNS: RegExp[] = [
    /you['']ve reached (the|your) (message |usage )?limit/i,
    /too many (messages|requests)/i,
    /please try again (in |after )/i,
    /limit (reached|exceeded|hit)/i,
    /rate limit/i,
    /slow down/i,
    /temporarily unavailable/i,
    /usage cap/i,
    /hourly limit/i,
    /daily limit/i,
    /message limit/i,
    /quota exceeded/i,
  ];

  /** Whether currently rate limited */
  private isCurrentlyLimited: boolean = false;

  /** When the rate limit was detected */
  private limitDetectedAt: Date | null = null;

  /** Polling interval reference */
  private pollInterval: NodeJS.Timeout | null = null;

  /** Number of poll attempts made */
  private pollAttempts: number = 0;

  /** Reference to state manager for persistence */
  private stateManager: StateManager;

  /** Deferred steps awaiting resumption */
  private deferredSteps: DeferredStep[] = [];

  constructor() {
    super();
    this.stateManager = getStateManager();
  }

  // ==========================================================================
  // RATE LIMIT DETECTION
  // ==========================================================================

  /**
   * Check if text contains rate limit indicators.
   *
   * @param text - Text to analyze (ChatGPT response)
   * @returns True if rate limit detected
   */
  isRateLimited(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const normalizedText = text.toLowerCase();

    for (const pattern of this.PATTERNS) {
      if (pattern.test(normalizedText)) {
        console.log(`[RateLimitRecovery] Rate limit detected: "${text.substring(0, 100)}..."`);
        return true;
      }
    }

    return false;
  }

  /**
   * Get the current rate limit status.
   */
  getStatus(): RateLimitStatus {
    return {
      isLimited: this.isCurrentlyLimited,
      detectedAt: this.limitDetectedAt || undefined,
      deferredCount: this.deferredSteps.length,
      lastPollAt: this.pollAttempts > 0 ? new Date() : undefined,
      nextPollAt: this.pollInterval
        ? new Date(Date.now() + POLL_INTERVAL_MS)
        : undefined,
    };
  }

  // ==========================================================================
  // RATE LIMIT HANDLING
  // ==========================================================================

  /**
   * Handle rate limit detection.
   * Defers web steps, persists state, and starts polling.
   *
   * @param scheduler - Step scheduler for coordinating execution
   */
  onRateLimited(scheduler: StepScheduler): void {
    if (this.isCurrentlyLimited) {
      console.log('[RateLimitRecovery] Already handling rate limit');
      return;
    }

    console.log('[RateLimitRecovery] Rate limit detected, deferring web steps');

    this.isCurrentlyLimited = true;
    this.limitDetectedAt = new Date();
    this.pollAttempts = 0;

    // Defer all pending web-based steps
    const deferred = scheduler.deferWebSteps();
    this.deferredSteps = deferred;

    // Persist deferred steps to state manager
    this.saveDeferredSteps();

    // Emit events
    this.emit('rate-limited');
    this.emit('steps-deferred', deferred);

    // Notify user via console (renderer will handle UI)
    console.log(
      `[RateLimitRecovery] Deferred ${deferred.length} steps. ` +
      `Will poll every ${POLL_INTERVAL_MS / 1000}s to check when limits clear.`
    );

    // Start polling to detect when limits clear
    this.startPolling(scheduler);
  }

  // ==========================================================================
  // POLLING
  // ==========================================================================

  /**
   * Start polling ChatGPT to detect when rate limits clear.
   *
   * @param scheduler - Step scheduler for probing and resumption
   */
  startPolling(scheduler: StepScheduler): void {
    // Don't start if already polling
    if (this.pollInterval) {
      console.log('[RateLimitRecovery] Already polling');
      return;
    }

    console.log(`[RateLimitRecovery] Starting poll every ${POLL_INTERVAL_MS / 1000}s`);

    this.pollInterval = setInterval(async () => {
      await this.pollOnce(scheduler);
    }, POLL_INTERVAL_MS);

    // Also do an immediate first poll after a short delay
    setTimeout(() => {
      this.pollOnce(scheduler);
    }, 5000);
  }

  /**
   * Stop polling.
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[RateLimitRecovery] Stopped polling');
    }
  }

  /**
   * Perform a single poll attempt.
   *
   * @param scheduler - Step scheduler for probing
   */
  private async pollOnce(scheduler: StepScheduler): Promise<void> {
    this.pollAttempts++;

    console.log(`[RateLimitRecovery] Poll attempt ${this.pollAttempts}/${MAX_POLL_ATTEMPTS}`);

    this.emit('poll-attempt', this.pollAttempts);

    // Check if we've exceeded max attempts
    if (this.pollAttempts >= MAX_POLL_ATTEMPTS) {
      console.log('[RateLimitRecovery] Max poll attempts reached, giving up');
      this.stopPolling();
      this.emit('poll-failed', 'Maximum poll attempts reached');
      return;
    }

    try {
      // Probe ChatGPT with a simple message
      const result = await scheduler.probeChatGPT();

      if (result.success && !result.rateLimited) {
        // Rate limit has cleared!
        console.log('[RateLimitRecovery] Rate limit cleared!');
        await this.onRateCleared(scheduler);
      } else if (result.rateLimited) {
        console.log('[RateLimitRecovery] Still rate limited, will retry');
      } else if (result.error) {
        console.log(`[RateLimitRecovery] Probe error: ${result.error}`);
        this.emit('poll-failed', result.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[RateLimitRecovery] Poll error:', errorMessage);
      this.emit('poll-failed', errorMessage);
    }
  }

  /**
   * Handle rate limit clearing.
   *
   * @param scheduler - Step scheduler for resuming steps
   */
  private async onRateCleared(scheduler: StepScheduler): Promise<void> {
    console.log('[RateLimitRecovery] Rate limit cleared, resuming deferred steps');

    this.stopPolling();
    this.isCurrentlyLimited = false;

    // Load deferred steps (may have more from persistence)
    const steps = this.loadDeferredSteps();

    if (steps.length > 0) {
      // Resume deferred steps
      scheduler.resumeDeferredSteps(steps);

      this.emit('steps-resumed', steps);

      console.log(`[RateLimitRecovery] Resumed ${steps.length} deferred steps`);
    }

    // Clear persisted steps
    this.clearDeferredSteps();

    this.emit('rate-cleared');

    // Reset state
    this.limitDetectedAt = null;
    this.pollAttempts = 0;
    this.deferredSteps = [];
  }

  // ==========================================================================
  // APP LIFECYCLE
  // ==========================================================================

  /**
   * Handle app launch - check for deferred steps from previous session.
   *
   * @param scheduler - Step scheduler for resumption
   */
  onAppLaunch(scheduler: StepScheduler): void {
    console.log('[RateLimitRecovery] Checking for deferred steps from previous session');

    // Load any deferred steps from previous session
    const steps = this.loadDeferredSteps();

    if (steps.length > 0) {
      console.log(`[RateLimitRecovery] Found ${steps.length} deferred steps from previous session`);

      this.deferredSteps = steps;
      this.isCurrentlyLimited = true;
      this.limitDetectedAt = steps[0]?.deferredAt || new Date();

      // Start polling to check if limits have cleared
      this.startPolling(scheduler);

      this.emit('steps-deferred', steps);
    } else {
      console.log('[RateLimitRecovery] No deferred steps found');
    }
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save deferred steps to state manager.
   */
  private saveDeferredSteps(): void {
    try {
      const stateDir = this.stateManager.getStateDirectory();
      const fs = require('fs');
      const path = require('path');

      const filePath = path.join(stateDir, `${DEFERRED_STEPS_KEY}.json`);
      const data = JSON.stringify({
        steps: this.deferredSteps,
        savedAt: new Date().toISOString(),
        limitDetectedAt: this.limitDetectedAt?.toISOString(),
      }, null, 2);

      fs.writeFileSync(filePath, data, 'utf-8');

      console.log(`[RateLimitRecovery] Saved ${this.deferredSteps.length} deferred steps`);
    } catch (error) {
      console.error('[RateLimitRecovery] Failed to save deferred steps:', error);
    }
  }

  /**
   * Load deferred steps from state manager.
   */
  private loadDeferredSteps(): DeferredStep[] {
    try {
      const stateDir = this.stateManager.getStateDirectory();
      const fs = require('fs');
      const path = require('path');

      const filePath = path.join(stateDir, `${DEFERRED_STEPS_KEY}.json`);

      if (!fs.existsSync(filePath)) {
        return [];
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Convert date strings back to Date objects
      const steps = (data.steps || []).map((step: DeferredStep) => ({
        ...step,
        deferredAt: new Date(step.deferredAt),
      }));

      console.log(`[RateLimitRecovery] Loaded ${steps.length} deferred steps`);

      return steps;
    } catch (error) {
      console.error('[RateLimitRecovery] Failed to load deferred steps:', error);
      return [];
    }
  }

  /**
   * Clear persisted deferred steps.
   */
  private clearDeferredSteps(): void {
    try {
      const stateDir = this.stateManager.getStateDirectory();
      const fs = require('fs');
      const path = require('path');

      const filePath = path.join(stateDir, `${DEFERRED_STEPS_KEY}.json`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[RateLimitRecovery] Cleared deferred steps file');
      }
    } catch (error) {
      console.error('[RateLimitRecovery] Failed to clear deferred steps:', error);
    }
  }

  // ==========================================================================
  // MANUAL CONTROLS
  // ==========================================================================

  /**
   * Manually clear rate limit state (for testing or user override).
   */
  clearRateLimitState(): void {
    console.log('[RateLimitRecovery] Manually clearing rate limit state');

    this.stopPolling();
    this.isCurrentlyLimited = false;
    this.limitDetectedAt = null;
    this.pollAttempts = 0;
    this.deferredSteps = [];
    this.clearDeferredSteps();

    this.emit('rate-cleared');
  }

  /**
   * Get all currently deferred steps.
   */
  getDeferredSteps(): DeferredStep[] {
    return [...this.deferredSteps];
  }

  /**
   * Check if any steps are deferred.
   */
  hasDeferredSteps(): boolean {
    return this.deferredSteps.length > 0;
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up resources.
   */
  cleanup(): void {
    this.stopPolling();
    this.removeAllListeners();
    console.log('[RateLimitRecovery] Cleaned up');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rateLimitRecoveryInstance: RateLimitRecovery | null = null;

/**
 * Get the singleton RateLimitRecovery instance.
 */
export function getRateLimitRecovery(): RateLimitRecovery {
  if (!rateLimitRecoveryInstance) {
    rateLimitRecoveryInstance = new RateLimitRecovery();
  }
  return rateLimitRecoveryInstance;
}

/**
 * Cleanup function to be called on app quit.
 */
export function cleanupRateLimitRecovery(): void {
  if (rateLimitRecoveryInstance) {
    rateLimitRecoveryInstance.cleanup();
    rateLimitRecoveryInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
};
