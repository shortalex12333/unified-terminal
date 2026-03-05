/**
 * TopBarPill Component
 *
 * Small status indicator for the top bar that shows current build state.
 * Clickable to expand/minimize the progress tree.
 *
 * States:
 * - idle: Hidden or minimal
 * - building: Shows progress ring + project name + elapsed time
 * - complete: Shows completion checkmark
 */

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type BuildState = 'idle' | 'building' | 'complete';

export interface TopBarPillProps {
  /** Project name being built */
  projectName?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current build state */
  buildState?: BuildState;
  /** Elapsed time string (e.g., "2m 15s") */
  elapsed?: string;
  /** Handler for expand action */
  onExpand?: () => void;
  /** Handler for stop/cancel action */
  onStop?: () => void;
  /** Whether to show the stop button */
  showStopButton?: boolean;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg)',
  pillBg: 'var(--kenoki-accent-soft)',
  pillBgHover: 'rgba(172, 203, 238, 0.15)',
  accent: 'var(--kenoki-accent)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  border: 'var(--kenoki-accent-border)',
  white: 'var(--kenoki-surface)',
  success: 'var(--kenoki-success)',
  error: 'var(--kenoki-error)',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TopBarPill({
  projectName: propProjectName,
  progress: propProgress,
  buildState: propBuildState,
  elapsed: propElapsed,
  onExpand,
  onStop,
  showStopButton = true,
}: TopBarPillProps): React.ReactElement | null {
  const [isHovered, setIsHovered] = useState(false);

  // Internal state for subscribing to statusAgent
  const [internalState, setInternalState] = useState({
    projectName: propProjectName ?? '',
    progress: propProgress ?? 0,
    buildState: propBuildState ?? ('idle' as BuildState),
  });

  // Subscribe to status updates if no props provided
  useEffect(() => {
    if (propBuildState !== undefined) return;

    const cleanups: Array<() => void> = [];

    if (window.electronAPI?.statusAgent) {
      const api = window.electronAPI.statusAgent;

      cleanups.push(
        api.onBuildStarted?.((data) => {
          setInternalState((prev) => ({
            ...prev,
            projectName: data.projectName,
            buildState: 'building',
            progress: 0,
          }));
        }) ?? (() => {})
      );

      cleanups.push(
        api.onBuildComplete?.(() => {
          setInternalState((prev) => ({
            ...prev,
            buildState: 'complete',
            progress: 100,
          }));
        }) ?? (() => {})
      );

      cleanups.push(
        api.onShellState?.((state) => {
          if (state === 'idle') {
            setInternalState((prev) => ({
              ...prev,
              buildState: 'idle',
              progress: 0,
            }));
          }
        }) ?? (() => {})
      );
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [propBuildState]);

  // Use props if provided, otherwise use internal state
  const projectName = propProjectName ?? internalState.projectName;
  const progress = propProgress ?? internalState.progress;
  const buildState = propBuildState ?? internalState.buildState;
  const elapsed = propElapsed;

  // Handle expand click
  const handleExpand = useCallback(() => {
    onExpand?.();
    window.electronAPI?.statusAgent?.expandTree?.();
  }, [onExpand]);

  // Handle stop click
  const handleStop = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStop?.();
      window.electronAPI?.statusAgent?.sendStopAll?.();
    },
    [onStop]
  );

  // Don't render if idle
  if (buildState === 'idle') {
    return null;
  }

  return (
    <div
      className="top-bar-pill"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: isHovered ? C.pillBgHover : C.pillBg,
        borderRadius: 20,
        cursor: 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleExpand}
    >
      {/* Progress indicator */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background:
            buildState === 'complete'
              ? C.success
              : `conic-gradient(${C.accent} ${progress * 3.6}deg, ${C.border} 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.3s',
        }}
      >
        {buildState === 'complete' ? (
          <svg
            viewBox="0 0 16 16"
            style={{ width: 12, height: 12 }}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8.5 L6.5 12 L13 4" />
          </svg>
        ) : (
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: C.white,
            }}
          />
        )}
      </div>

      {/* Project name */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: C.text,
          maxWidth: 150,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {buildState === 'complete' ? 'Complete' : projectName || 'Building...'}
      </span>

      {/* Progress percentage (only when building) */}
      {buildState === 'building' && (
        <span style={{ fontSize: 12, color: C.textSub }}>{progress}%</span>
      )}

      {/* Elapsed time */}
      {elapsed && buildState === 'building' && (
        <span style={{ fontSize: 11, color: C.textFaint }}>{elapsed}</span>
      )}

      {/* Stop button (only when building) */}
      {showStopButton && buildState === 'building' && (
        <button
          onClick={handleStop}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: 'none',
            background: 'rgba(232, 91, 91, 0.1)',
            color: '#C45050',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(232, 91, 91, 0.2)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(232, 91, 91, 0.1)')
          }
        >
          {'\u2715'}
        </button>
      )}
    </div>
  );
}

export { TopBarPill };
