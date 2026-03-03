/**
 * Error Types - Comprehensive Error Classification System
 *
 * Gate 13: Error Recovery
 *
 * Defines error categories, recovery strategies, and type definitions
 * for handling failures across the application gracefully.
 */

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

/**
 * Error category classification.
 * Each category maps to specific recovery strategies.
 */
export enum ErrorCategory {
  /** CLI tool crashed or exited unexpectedly */
  CLI_CRASH = 'cli_crash',
  /** Network connectivity issues */
  NETWORK = 'network',
  /** Authentication failures */
  AUTH = 'auth',
  /** Rate limiting from APIs */
  RATE_LIMIT = 'rate_limit',
  /** Disk space or I/O errors */
  DISK = 'disk',
  /** File or directory permission issues */
  PERMISSION = 'permission',
  /** Process management errors */
  PROCESS = 'process',
  /** ChatGPT-specific errors */
  CHATGPT = 'chatgpt',
  /** Plugin execution errors */
  PLUGIN = 'plugin',
  /** Timeout errors */
  TIMEOUT = 'timeout',
  /** Configuration errors */
  CONFIG = 'config',
  /** Unknown or uncategorized errors */
  UNKNOWN = 'unknown',
}

// ============================================================================
// RECOVERY TYPES
// ============================================================================

/**
 * Types of recovery actions that can be taken.
 */
export type RecoveryType =
  | 'retry'      // Retry the operation
  | 'reinstall'  // Reinstall/reset the tool
  | 'reauth'     // Re-authenticate
  | 'wait'       // Wait and retry automatically
  | 'restart'    // Restart the process/app
  | 'manual'     // Requires user intervention
  | 'ignore';    // Can be safely ignored

/**
 * Defines how an error can be recovered from.
 */
export interface RecoveryAction {
  /** Type of recovery to perform */
  type: RecoveryType;
  /** Human-readable description of what will happen */
  description: string;
  /** For 'wait' type: milliseconds to wait before auto-retry */
  autoRetryDelay?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Handler function to execute recovery (set by ErrorHandler) */
  handler?: () => Promise<boolean>;
}

// ============================================================================
// ERROR INTERFACES
// ============================================================================

/**
 * Application error with full context and recovery information.
 */
export interface AppError {
  /** Unique error identifier */
  id: string;
  /** Error classification */
  category: ErrorCategory;
  /** Technical error message (for logging) */
  message: string;
  /** User-friendly message (non-technical) */
  userMessage: string;
  /** Whether this error can be recovered from */
  recoverable: boolean;
  /** Recovery action if applicable */
  recovery?: RecoveryAction;
  /** When the error occurred */
  timestamp: Date;
  /** Number of recovery attempts made */
  retryCount: number;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Original error if available */
  originalError?: Error;
  /** Source of the error (e.g., 'cli-runner', 'chatgpt-adapter') */
  source?: string;
  /** Process ID if related to a CLI process */
  processId?: string;
  /** Whether the error is currently being handled */
  isHandling: boolean;
  /** Whether the error has been resolved */
  resolved: boolean;
  /** When the error was resolved (if applicable) */
  resolvedAt?: Date;
}

/**
 * Configuration for error handling behavior.
 */
export interface ErrorHandlerConfig {
  /** Maximum number of auto-retries for recoverable errors */
  maxAutoRetries: number;
  /** Base delay between retries (exponential backoff applies) */
  baseRetryDelay: number;
  /** Maximum delay between retries */
  maxRetryDelay: number;
  /** How long to keep resolved errors in history (ms) */
  errorHistoryTTL: number;
  /** Whether to log errors to console */
  logToConsole: boolean;
}

/**
 * Event emitted when an error occurs.
 */
export interface ErrorOccurredEvent {
  error: AppError;
  timestamp: Date;
}

/**
 * Event emitted when an error is recovered.
 */
export interface ErrorRecoveredEvent {
  errorId: string;
  recoveryType: RecoveryType;
  success: boolean;
  timestamp: Date;
}

/**
 * Event emitted when recovery fails.
 */
export interface RecoveryFailedEvent {
  errorId: string;
  attemptNumber: number;
  willRetry: boolean;
  nextRetryDelay?: number;
  timestamp: Date;
}

// ============================================================================
// ERROR DETECTION PATTERNS
// ============================================================================

/**
 * Regex patterns for detecting error types from messages.
 */
export const ERROR_PATTERNS: Record<ErrorCategory, RegExp> = {
  [ErrorCategory.RATE_LIMIT]: /rate.?limit|too.?many.?requests|429|throttl/i,
  [ErrorCategory.AUTH]: /unauthorized|401|403|auth.*fail|token.*expired|invalid.?credentials|login.?required|session.*expired/i,
  [ErrorCategory.NETWORK]: /ECONNREFUSED|ETIMEDOUT|ENETUNREACH|ENOTFOUND|network|offline|connection.*refused|dns.*resolution|socket.*hang/i,
  [ErrorCategory.DISK]: /ENOSPC|disk.*full|no.?space|storage.*full|quota.*exceeded/i,
  [ErrorCategory.PERMISSION]: /EACCES|EPERM|permission.*denied|access.*denied|forbidden|not.?permitted/i,
  [ErrorCategory.CHATGPT]: /something.?went.?wrong|error.*occurred|try.?again.*later|service.*unavailable|chatgpt.*error|openai.*error/i,
  [ErrorCategory.CLI_CRASH]: /segmentation.?fault|killed|aborted|core.?dumped|signal.*received|exited.*unexpectedly/i,
  [ErrorCategory.TIMEOUT]: /timeout|timed?.?out|deadline.*exceeded|operation.*cancelled/i,
  [ErrorCategory.PROCESS]: /spawn.*error|child.*process|ENOENT.*command|command.*not.*found/i,
  [ErrorCategory.PLUGIN]: /plugin.*error|plugin.*failed|execution.*failed/i,
  [ErrorCategory.CONFIG]: /config.*error|invalid.*config|missing.*config|configuration.*invalid/i,
  [ErrorCategory.UNKNOWN]: /.*/, // Catch-all (lowest priority)
};

// ============================================================================
// DEFAULT RECOVERY MAP
// ============================================================================

/**
 * Default recovery actions for each error category.
 * These provide sensible defaults that can be overridden.
 */
export const DEFAULT_RECOVERY: Record<ErrorCategory, RecoveryAction> = {
  [ErrorCategory.CLI_CRASH]: {
    type: 'retry',
    description: 'Retry the operation',
    maxRetries: 3,
  },
  [ErrorCategory.NETWORK]: {
    type: 'wait',
    description: 'Waiting for connection',
    autoRetryDelay: 5000,
    maxRetries: 5,
  },
  [ErrorCategory.AUTH]: {
    type: 'reauth',
    description: 'Sign in again',
    maxRetries: 1,
  },
  [ErrorCategory.RATE_LIMIT]: {
    type: 'wait',
    description: 'Waiting (rate limited)',
    autoRetryDelay: 60000, // 1 minute
    maxRetries: 3,
  },
  [ErrorCategory.DISK]: {
    type: 'manual',
    description: 'Free up disk space and try again',
  },
  [ErrorCategory.PERMISSION]: {
    type: 'manual',
    description: 'Check file permissions',
  },
  [ErrorCategory.PROCESS]: {
    type: 'retry',
    description: 'Restart the process',
    maxRetries: 2,
  },
  [ErrorCategory.CHATGPT]: {
    type: 'retry',
    description: 'Reconnect to ChatGPT',
    autoRetryDelay: 3000,
    maxRetries: 3,
  },
  [ErrorCategory.PLUGIN]: {
    type: 'retry',
    description: 'Retry plugin execution',
    maxRetries: 2,
  },
  [ErrorCategory.TIMEOUT]: {
    type: 'retry',
    description: 'Retry with longer timeout',
    maxRetries: 2,
  },
  [ErrorCategory.CONFIG]: {
    type: 'manual',
    description: 'Check configuration settings',
  },
  [ErrorCategory.UNKNOWN]: {
    type: 'ignore',
    description: 'Unknown error occurred',
  },
};

// ============================================================================
// USER-FRIENDLY MESSAGE MAP
// ============================================================================

/**
 * Maps error categories to user-friendly messages.
 * These are non-technical and suitable for display to end users.
 */
export const USER_MESSAGES: Record<ErrorCategory, string> = {
  [ErrorCategory.CLI_CRASH]: 'A tool stopped unexpectedly. Retrying...',
  [ErrorCategory.NETWORK]: 'Connection issue. Check your internet.',
  [ErrorCategory.AUTH]: 'Please sign in again.',
  [ErrorCategory.RATE_LIMIT]: 'Too many requests. Waiting a moment...',
  [ErrorCategory.DISK]: 'Disk is full. Free up some space.',
  [ErrorCategory.PERMISSION]: 'Access denied. Check permissions.',
  [ErrorCategory.PROCESS]: 'Process error. Restarting...',
  [ErrorCategory.CHATGPT]: 'ChatGPT had an issue. Reconnecting...',
  [ErrorCategory.PLUGIN]: 'Plugin error. Retrying...',
  [ErrorCategory.TIMEOUT]: 'Operation took too long. Retrying...',
  [ErrorCategory.CONFIG]: 'Configuration issue. Check settings.',
  [ErrorCategory.UNKNOWN]: 'Something went wrong. Please try again.',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an error category is recoverable automatically.
 */
export function isAutoRecoverable(category: ErrorCategory): boolean {
  const recovery = DEFAULT_RECOVERY[category];
  return recovery.type === 'retry' || recovery.type === 'wait';
}

/**
 * Check if an error requires user intervention.
 */
export function requiresUserAction(category: ErrorCategory): boolean {
  const recovery = DEFAULT_RECOVERY[category];
  return recovery.type === 'manual' || recovery.type === 'reauth';
}

/**
 * Get severity level for an error category (1-5, 5 being most severe).
 */
export function getErrorSeverity(category: ErrorCategory): number {
  const severityMap: Record<ErrorCategory, number> = {
    [ErrorCategory.UNKNOWN]: 1,
    [ErrorCategory.TIMEOUT]: 2,
    [ErrorCategory.RATE_LIMIT]: 2,
    [ErrorCategory.NETWORK]: 3,
    [ErrorCategory.CLI_CRASH]: 3,
    [ErrorCategory.CHATGPT]: 3,
    [ErrorCategory.PLUGIN]: 3,
    [ErrorCategory.PROCESS]: 3,
    [ErrorCategory.AUTH]: 4,
    [ErrorCategory.CONFIG]: 4,
    [ErrorCategory.PERMISSION]: 4,
    [ErrorCategory.DISK]: 5,
  };
  return severityMap[category] ?? 1;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  ErrorOccurredEvent as ErrorEvent,
};
