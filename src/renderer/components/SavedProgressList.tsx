/**
 * SavedProgressList Component
 *
 * Displays a list of saved build progress entries that can be resumed.
 * Shows in project list or settings, with Resume/Download/Delete actions.
 *
 * Features:
 * - Cards for each saved progress
 * - Shows failure reason and saved date
 * - Resume, Download, Delete actions
 * - Empty state when no saved progress
 */

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SavedProgressListProps {
  /** Callback when a progress is resumed */
  onResume?: (progressId: string) => void;
  /** Callback when a progress is deleted */
  onDelete?: (progressId: string) => void;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Maximum items to show (0 = unlimited) */
  maxItems?: number;
}

interface SavedProgressItem {
  id: string;
  planId: string;
  projectName: string;
  projectPath: string;
  failureReason: string;
  savedAt: Date;
  canResume: boolean;
  completedSteps: number;
  totalSteps: number;
  partialOutputCount: number;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: '#0a0a0b',
  surface: '#1a1a1c',
  surfaceHover: '#222224',
  border: '#2a2a2c',
  accent: '#7ed9b5',
  accentSoft: 'rgba(126, 217, 181, 0.15)',
  text: '#f0f0f0',
  textSub: '#a0a0a0',
  textFaint: '#666666',
  error: '#ff6b6b',
  errorSoft: 'rgba(255, 107, 107, 0.15)',
  warning: '#ffa94d',
  warningSoft: 'rgba(255, 169, 77, 0.15)',
  success: '#7ed9b5',
  successSoft: 'rgba(126, 217, 181, 0.15)',
};

// =============================================================================
// FAILURE REASON LABELS
// =============================================================================

const FAILURE_LABELS: Record<string, string> = {
  api_unavailable: 'Service Unavailable',
  rate_limited: 'Rate Limited',
  subscription_expired: 'Subscription Expired',
  network_error: 'Network Error',
  timeout: 'Timeout',
  auth_expired: 'Auth Expired',
  quota_exceeded: 'Quota Exceeded',
  service_error: 'Service Error',
  permission_denied: 'Permission Denied',
  disk_full: 'Disk Full',
  unknown: 'Unknown Error',
};

const FAILURE_COLORS: Record<string, string> = {
  api_unavailable: C.warning,
  rate_limited: C.warning,
  subscription_expired: C.error,
  network_error: C.warning,
  timeout: C.warning,
  auth_expired: C.error,
  quota_exceeded: C.error,
  service_error: C.warning,
  permission_denied: C.error,
  disk_full: C.error,
  unknown: C.textFaint,
};

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  resume: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  empty: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 15h8"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
};

// =============================================================================
// HELPERS
// =============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString();
}

// =============================================================================
// PROGRESS CARD
// =============================================================================

interface ProgressCardProps {
  item: SavedProgressItem;
  compact: boolean;
  onResume: () => void;
  onDownload: () => void;
  onDelete: () => void;
  isResuming: boolean;
  isDownloading: boolean;
  isDeleting: boolean;
}

function ProgressCard({
  item,
  compact,
  onResume,
  onDownload,
  onDelete,
  isResuming,
  isDownloading,
  isDeleting,
}: ProgressCardProps): React.ReactElement {
  const progressPercent = item.totalSteps > 0
    ? Math.round((item.completedSteps / item.totalSteps) * 100)
    : 0;

  const reasonLabel = FAILURE_LABELS[item.failureReason] || item.failureReason;
  const reasonColor = FAILURE_COLORS[item.failureReason] || C.textFaint;

  const isLoading = isResuming || isDownloading || isDeleting;

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        padding: compact ? 12 : 16,
        border: `1px solid ${C.border}`,
        transition: 'all 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: compact ? 8 : 12 }}>
        {/* Icon */}
        <div
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: 8,
            background: C.warningSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.warning,
            flexShrink: 0,
          }}
        >
          {Icons.warning}
        </div>

        {/* Title + Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: compact ? 13 : 14,
              fontWeight: 600,
              color: C.text,
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.projectName}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Failure reason badge */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: reasonColor,
                background: `${reasonColor}20`,
                padding: '2px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              {reasonLabel}
            </span>

            {/* Time */}
            <span style={{ fontSize: 11, color: C.textFaint }}>
              {formatRelativeTime(item.savedAt)}
            </span>
          </div>
        </div>

        {/* Can resume indicator */}
        {item.canResume && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: C.success,
              flexShrink: 0,
            }}
            title="Can be resumed"
          />
        )}
      </div>

      {/* Progress bar (if not compact) */}
      {!compact && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: C.textFaint,
              marginBottom: 4,
            }}
          >
            <span>{item.completedSteps} of {item.totalSteps} steps completed</span>
            <span>{progressPercent}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: C.surfaceHover,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: C.success,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Resume button */}
        <button
          onClick={onResume}
          disabled={!item.canResume || isLoading}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: compact ? '6px 10px' : '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: item.canResume ? C.accent : C.surfaceHover,
            color: item.canResume ? '#000' : C.textFaint,
            fontSize: compact ? 11 : 12,
            fontWeight: 600,
            cursor: item.canResume && !isLoading ? 'pointer' : 'not-allowed',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.15s',
          }}
        >
          {Icons.resume}
          {isResuming ? 'Resuming...' : 'Resume'}
        </button>

        {/* Download button */}
        {item.partialOutputCount > 0 && (
          <button
            onClick={onDownload}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: compact ? '6px 10px' : '8px 12px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surfaceHover,
              color: C.text,
              fontSize: compact ? 11 : 12,
              fontWeight: 500,
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
            title={`Download ${item.partialOutputCount} files`}
          >
            {Icons.download}
            {!compact && (isDownloading ? 'Downloading...' : 'Download')}
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={onDelete}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: compact ? '6px 10px' : '8px 12px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.surfaceHover,
            color: C.textFaint,
            fontSize: compact ? 11 : 12,
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.15s',
          }}
          title="Delete saved progress"
        >
          {Icons.trash}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      {Icons.empty}
      <p
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: C.textFaint,
        }}
      >
        {message}
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SavedProgressList({
  onResume,
  onDelete,
  emptyMessage = 'No saved progress',
  compact = false,
  maxItems = 0,
}: SavedProgressListProps): React.ReactElement {
  const [items, setItems] = useState<SavedProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  // Load saved progress
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI?.failure?.listSaved();
      if (list) {
        const sorted = list.sort((a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        setItems(maxItems > 0 ? sorted.slice(0, maxItems) : sorted);
      }
    } catch (err) {
      console.error('[SavedProgressList] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadItems();

    // Subscribe to events
    const cleanupSaved = window.electronAPI?.failure?.onProgressSaved(() => {
      loadItems();
    });
    const cleanupDeleted = window.electronAPI?.failure?.onProgressDeleted(() => {
      loadItems();
    });

    return () => {
      cleanupSaved?.();
      cleanupDeleted?.();
    };
  }, [loadItems]);

  // Handlers
  const handleResume = useCallback(async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'resume' }));

    try {
      const result = await window.electronAPI?.failure?.resume(id, {
        fromFailedStep: true,
      });

      if (result?.success) {
        onResume?.(id);
        loadItems();
      } else {
        console.error('[SavedProgressList] Resume failed:', result?.error);
      }
    } catch (err) {
      console.error('[SavedProgressList] Resume error:', err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [onResume, loadItems]);

  const handleDownload = useCallback(async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'download' }));

    try {
      const result = await window.electronAPI?.failure?.downloadPartial(id);

      if (result?.success) {
        await window.electronAPI?.failure?.openDownloads();
      } else {
        console.error('[SavedProgressList] Download failed:', result?.error);
      }
    } catch (err) {
      console.error('[SavedProgressList] Download error:', err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: 'delete' }));

    try {
      const success = await window.electronAPI?.failure?.delete(id);

      if (success) {
        onDelete?.(id);
        loadItems();
      }
    } catch (err) {
      console.error('[SavedProgressList] Delete error:', err);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [onDelete, loadItems]);

  // Render
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: C.textSub }}>
        Loading...
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {items.map((item) => (
        <ProgressCard
          key={item.id}
          item={item}
          compact={compact}
          onResume={() => handleResume(item.id)}
          onDownload={() => handleDownload(item.id)}
          onDelete={() => handleDelete(item.id)}
          isResuming={actionLoading[item.id] === 'resume'}
          isDownloading={actionLoading[item.id] === 'download'}
          isDeleting={actionLoading[item.id] === 'delete'}
        />
      ))}
    </div>
  );
}

export { SavedProgressList };
