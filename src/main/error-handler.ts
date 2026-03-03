/**
 * Error Handler - Comprehensive Error Management and Recovery
 *
 * Gate 13: Error Recovery
 *
 * Handles error detection, categorization, recovery orchestration,
 * and lifecycle management for all application errors.
 *
 * Features:
 * - Automatic error categorization from error messages
 * - Configurable recovery strategies per category
 * - Exponential backoff for retries
 * - Event emission for UI updates
 * - Error history with TTL cleanup
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ErrorCategory,
  AppError,
  RecoveryAction,
  RecoveryType,
  ErrorHandlerConfig,
  ErrorOccurredEvent,
  ErrorRecoveredEvent,
  RecoveryFailedEvent,
  ERROR_PATTERNS,
  DEFAULT_RECOVERY,
  USER_MESSAGES,
  isAutoRecoverable,
} from './error-types';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  maxAutoRetries: 3,
  baseRetryDelay: 1000, // 1 second
  maxRetryDelay: 60000, // 1 minute
  errorHistoryTTL: 3600000, // 1 hour
  logToConsole: true,
};

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

/**
 * Error Handler - Central error management for the application.
 *
 * Events:
 * - 'error': (ErrorOccurredEvent) - An error has occurred
 * - 'recovered': (ErrorRecoveredEvent) - An error was recovered
 * - 'recovery-failed': (RecoveryFailedEvent) - Recovery attempt failed
 * - 'dismissed': (string) - An error was dismissed (error ID)
 */
export class ErrorHandler extends EventEmitter {
  /** Active errors by ID */
  private errors: Map<string, AppError> = new Map();

  /** Pending retry timers */
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Custom recovery handlers by error category */
  private recoveryHandlers: Map<ErrorCategory, () => Promise<boolean>> = new Map();

  /** Configuration */
  private config: ErrorHandlerConfig;

  /** Cleanup interval for old errors */
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start periodic cleanup
    this.cleanupInterval = setInterval(
      () => this.cleanupOldErrors(),
      this.config.errorHistoryTTL / 4
    );
  }

  // ==========================================================================
  // MAIN API
  // ==========================================================================

  /**
   * Handle an error, categorizing it and initiating recovery.
   *
   * @param error - The error to handle
   * @param context - Additional context for the error
   * @returns The created AppError
   */
  handle(error: Error | string, context?: Record<string, unknown>): AppError {
    const errorMessage = error instanceof Error ? error.message : error;
    const originalError = error instanceof Error ? error : undefined;

    // Categorize the error
    const category = this.categorize(errorMessage);

    // Get recovery action
    const recovery = this.getRecovery(category);

    // Generate unique ID
    const id = uuidv4();

    // Create AppError
    const appError: AppError = {
      id,
      category,
      message: errorMessage,
      userMessage: USER_MESSAGES[category] || USER_MESSAGES[ErrorCategory.UNKNOWN],
      recoverable: recovery.type !== 'manual' && recovery.type !== 'ignore',
      recovery,
      timestamp: new Date(),
      retryCount: 0,
      context,
      originalError,
      source: context?.source as string | undefined,
      processId: context?.processId as string | undefined,
      isHandling: false,
      resolved: false,
    };

    // Store the error
    this.errors.set(id, appError);

    // Log if configured
    if (this.config.logToConsole) {
      console.error(`[ErrorHandler] ${category}: ${errorMessage}`, context);
    }

    // Emit error event
    const event: ErrorOccurredEvent = {
      error: appError,
      timestamp: new Date(),
    };
    this.emit('error', event);

    // Initiate auto-recovery if applicable
    if (appError.recoverable && isAutoRecoverable(category)) {
      this.initiateAutoRecovery(id);
    }

    return appError;
  }

  /**
   * Categorize an error message into an ErrorCategory.
   *
   * @param error - Error or error message
   * @returns The detected ErrorCategory
   */
  categorize(error: Error | string): ErrorCategory {
    const message = error instanceof Error ? error.message : error;

    // Check patterns in priority order (most specific first)
    const priorityOrder: ErrorCategory[] = [
      ErrorCategory.RATE_LIMIT,
      ErrorCategory.AUTH,
      ErrorCategory.NETWORK,
      ErrorCategory.DISK,
      ErrorCategory.PERMISSION,
      ErrorCategory.TIMEOUT,
      ErrorCategory.CHATGPT,
      ErrorCategory.CLI_CRASH,
      ErrorCategory.PLUGIN,
      ErrorCategory.PROCESS,
      ErrorCategory.CONFIG,
      // UNKNOWN is the fallback
    ];

    for (const category of priorityOrder) {
      if (ERROR_PATTERNS[category].test(message)) {
        return category;
      }
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get the recovery action for an error category.
   *
   * @param category - The error category
   * @returns RecoveryAction for the category
   */
  getRecovery(category: ErrorCategory): RecoveryAction {
    const recovery = { ...DEFAULT_RECOVERY[category] };

    // Attach custom handler if registered
    const customHandler = this.recoveryHandlers.get(category);
    if (customHandler) {
      recovery.handler = customHandler;
    }

    return recovery;
  }

  /**
   * Manually trigger recovery for an error.
   *
   * @param errorId - The error ID to recover
   * @returns True if recovery was successful
   */
  async retry(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error) {
      console.warn(`[ErrorHandler] Error ${errorId} not found`);
      return false;
    }

    if (error.resolved) {
      console.log(`[ErrorHandler] Error ${errorId} already resolved`);
      return true;
    }

    if (error.isHandling) {
      console.log(`[ErrorHandler] Error ${errorId} recovery already in progress`);
      return false;
    }

    return this.executeRecovery(errorId);
  }

  /**
   * Dismiss an error, removing it from active errors.
   *
   * @param errorId - The error ID to dismiss
   */
  dismiss(errorId: string): void {
    const error = this.errors.get(errorId);
    if (!error) {
      return;
    }

    // Clear any pending retry timer
    const timer = this.retryTimers.get(errorId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(errorId);
    }

    // Mark as resolved
    error.resolved = true;
    error.resolvedAt = new Date();

    this.emit('dismissed', errorId);

    if (this.config.logToConsole) {
      console.log(`[ErrorHandler] Dismissed error: ${errorId}`);
    }
  }

  /**
   * Get all active (unresolved) errors.
   *
   * @returns Array of active AppErrors
   */
  getActiveErrors(): AppError[] {
    return Array.from(this.errors.values())
      .filter((e) => !e.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get a specific error by ID.
   *
   * @param errorId - The error ID
   * @returns The AppError or null
   */
  getError(errorId: string): AppError | null {
    return this.errors.get(errorId) || null;
  }

  /**
   * Get all errors (including resolved).
   *
   * @returns Array of all AppErrors
   */
  getAllErrors(): AppError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get errors by category.
   *
   * @param category - The error category to filter by
   * @returns Array of matching AppErrors
   */
  getErrorsByCategory(category: ErrorCategory): AppError[] {
    return Array.from(this.errors.values())
      .filter((e) => e.category === category && !e.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Check if there are any active errors.
   *
   * @returns True if there are unresolved errors
   */
  hasActiveErrors(): boolean {
    return this.getActiveErrors().length > 0;
  }

  /**
   * Clear all errors (both active and resolved).
   */
  clearAll(): void {
    // Clear all retry timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    this.errors.clear();

    if (this.config.logToConsole) {
      console.log('[ErrorHandler] Cleared all errors');
    }
  }

  // ==========================================================================
  // RECOVERY HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register a custom recovery handler for an error category.
   *
   * @param category - The error category
   * @param handler - Async function that returns true on success
   */
  registerRecoveryHandler(
    category: ErrorCategory,
    handler: () => Promise<boolean>
  ): void {
    this.recoveryHandlers.set(category, handler);

    if (this.config.logToConsole) {
      console.log(`[ErrorHandler] Registered recovery handler for: ${category}`);
    }
  }

  /**
   * Unregister a custom recovery handler.
   *
   * @param category - The error category
   */
  unregisterRecoveryHandler(category: ErrorCategory): void {
    this.recoveryHandlers.delete(category);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Initiate automatic recovery with appropriate delay.
   */
  private initiateAutoRecovery(errorId: string): void {
    const error = this.errors.get(errorId);
    if (!error || !error.recovery) {
      return;
    }

    const maxRetries = error.recovery.maxRetries ?? this.config.maxAutoRetries;
    if (error.retryCount >= maxRetries) {
      // Max retries exceeded, stop auto-recovery
      if (this.config.logToConsole) {
        console.log(`[ErrorHandler] Max retries (${maxRetries}) exceeded for: ${errorId}`);
      }
      return;
    }

    // Calculate delay with exponential backoff
    const baseDelay = error.recovery.autoRetryDelay ?? this.config.baseRetryDelay;
    const delay = Math.min(
      baseDelay * Math.pow(2, error.retryCount),
      this.config.maxRetryDelay
    );

    if (this.config.logToConsole) {
      console.log(`[ErrorHandler] Scheduling auto-recovery in ${delay}ms for: ${errorId}`);
    }

    // Clear any existing timer
    const existingTimer = this.retryTimers.get(errorId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule recovery
    const timer = setTimeout(async () => {
      this.retryTimers.delete(errorId);
      await this.executeRecovery(errorId);
    }, delay);

    this.retryTimers.set(errorId, timer);
  }

  /**
   * Execute recovery for an error.
   */
  private async executeRecovery(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error || error.resolved || error.isHandling) {
      return false;
    }

    error.isHandling = true;
    error.retryCount++;

    if (this.config.logToConsole) {
      console.log(`[ErrorHandler] Executing recovery attempt ${error.retryCount} for: ${errorId}`);
    }

    try {
      let success = false;

      // Try custom handler first
      const customHandler = this.recoveryHandlers.get(error.category);
      if (customHandler) {
        success = await customHandler();
      } else if (error.recovery?.handler) {
        success = await error.recovery.handler();
      } else {
        // No handler, consider it a success (error acknowledged)
        success = true;
      }

      if (success) {
        // Recovery successful
        error.resolved = true;
        error.resolvedAt = new Date();
        error.isHandling = false;

        const event: ErrorRecoveredEvent = {
          errorId,
          recoveryType: error.recovery?.type ?? 'ignore',
          success: true,
          timestamp: new Date(),
        };
        this.emit('recovered', event);

        if (this.config.logToConsole) {
          console.log(`[ErrorHandler] Recovery successful for: ${errorId}`);
        }

        return true;
      } else {
        // Recovery failed
        error.isHandling = false;

        const maxRetries = error.recovery?.maxRetries ?? this.config.maxAutoRetries;
        const willRetry = error.retryCount < maxRetries && isAutoRecoverable(error.category);

        const event: RecoveryFailedEvent = {
          errorId,
          attemptNumber: error.retryCount,
          willRetry,
          nextRetryDelay: willRetry
            ? Math.min(
                (error.recovery?.autoRetryDelay ?? this.config.baseRetryDelay) *
                  Math.pow(2, error.retryCount),
                this.config.maxRetryDelay
              )
            : undefined,
          timestamp: new Date(),
        };
        this.emit('recovery-failed', event);

        if (this.config.logToConsole) {
          console.log(`[ErrorHandler] Recovery failed for: ${errorId} (attempt ${error.retryCount})`);
        }

        // Schedule another attempt if applicable
        if (willRetry) {
          this.initiateAutoRecovery(errorId);
        }

        return false;
      }
    } catch (err) {
      // Recovery threw an error
      error.isHandling = false;

      if (this.config.logToConsole) {
        console.error(`[ErrorHandler] Recovery threw error for: ${errorId}`, err);
      }

      // Emit failure event
      const event: RecoveryFailedEvent = {
        errorId,
        attemptNumber: error.retryCount,
        willRetry: false,
        timestamp: new Date(),
      };
      this.emit('recovery-failed', event);

      return false;
    }
  }

  /**
   * Clean up old resolved errors.
   */
  private cleanupOldErrors(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, error] of this.errors) {
      if (error.resolved && error.resolvedAt) {
        const age = now - error.resolvedAt.getTime();
        if (age > this.config.errorHistoryTTL) {
          this.errors.delete(id);
          cleaned++;
        }
      }
    }

    if (cleaned > 0 && this.config.logToConsole) {
      console.log(`[ErrorHandler] Cleaned up ${cleaned} old errors`);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all retry timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // Clear errors
    this.errors.clear();

    // Remove all listeners
    this.removeAllListeners();

    if (this.config.logToConsole) {
      console.log('[ErrorHandler] Destroyed');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Singleton error handler instance */
let errorHandlerInstance: ErrorHandler | null = null;

/**
 * Get the singleton error handler instance.
 */
export function getErrorHandler(): ErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler();
  }
  return errorHandlerInstance;
}

/**
 * Clean up the error handler (call on app quit).
 */
export function cleanupErrorHandler(): void {
  if (errorHandlerInstance) {
    errorHandlerInstance.destroy();
    errorHandlerInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Handle an error using the singleton error handler.
 */
export function handleError(
  error: Error | string,
  context?: Record<string, unknown>
): AppError {
  return getErrorHandler().handle(error, context);
}

/**
 * Get active errors from the singleton handler.
 */
export function getActiveErrors(): AppError[] {
  return getErrorHandler().getActiveErrors();
}

/**
 * Dismiss an error from the singleton handler.
 */
export function dismissError(errorId: string): void {
  getErrorHandler().dismiss(errorId);
}

/**
 * Retry error recovery using the singleton handler.
 */
export async function retryError(errorId: string): Promise<boolean> {
  return getErrorHandler().retry(errorId);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Note: ErrorHandler is already exported from its class declaration
// Re-export DEFAULT_CONFIG for convenience
export { DEFAULT_CONFIG };
