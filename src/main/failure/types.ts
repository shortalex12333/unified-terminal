/**
 * Graceful Failure Types
 * Types for save progress and resume functionality
 */

export type FailureReason =
  | 'api_unavailable'
  | 'rate_limited'
  | 'subscription_expired'
  | 'network_error'
  | 'timeout'
  | 'permission_denied'
  | 'disk_full'
  | 'unknown';

export interface SavedProgress {
  id: string;
  planId: string;
  planName: string;
  projectPath: string;
  completedSteps: number[];
  totalSteps: number;
  failedStep: number;
  failureReason: FailureReason;
  failureMessage: string;
  savedAt: Date;
  canResume: boolean;
  partialOutputs: PartialOutput[];
}

export interface PartialOutput {
  stepId: number;
  type: 'file' | 'directory' | 'asset';
  path: string;
  size: number;
}

export interface SerializedSavedProgress extends Omit<SavedProgress, 'savedAt'> {
  savedAt: string;
}

export function serializeSavedProgress(progress: SavedProgress): SerializedSavedProgress {
  return {
    ...progress,
    savedAt: progress.savedAt.toISOString(),
  };
}

export function deserializeSavedProgress(data: SerializedSavedProgress): SavedProgress {
  return {
    ...data,
    savedAt: new Date(data.savedAt),
  };
}

export function getFailureReasonLabel(reason: FailureReason): string {
  const labels: Record<FailureReason, string> = {
    api_unavailable: 'Service temporarily unavailable',
    rate_limited: 'Too many requests - please wait',
    subscription_expired: 'Subscription needs renewal',
    network_error: 'Network connection lost',
    timeout: 'Request timed out',
    permission_denied: 'Permission denied',
    disk_full: 'Not enough disk space',
    unknown: 'An unexpected error occurred',
  };
  return labels[reason];
}
