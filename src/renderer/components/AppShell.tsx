/**
 * AppShell Component
 *
 * Root layout container that manages the three visual states:
 * - IDLE: Just the BrowserView, minimal chrome
 * - BUILDING: Expanded overlay with ProgressTree + controls
 * - MINIMISED: Compact pill in top bar, BrowserView visible
 *
 * The shell never blocks the BrowserView - it overlays or minimizes.
 */

import React, { useState, useCallback } from 'react';
import ProgressTree from './ProgressTree';
import { useStatusAgent, RenderTreeNode } from '../hooks/useStatusAgent';
import { useAppShell } from '../hooks/useAppShell';

// Shell state type
type ShellState = 'idle' | 'building' | 'minimised' | 'complete';

// =============================================================================
// TYPES
// =============================================================================

export interface AppShellProps {
  /** Initial shell state */
  initialState?: ShellState;
  /** Children (the BrowserView wrapper) */
  children: React.ReactNode;
}

// =============================================================================
// COLORS & CONSTANTS
// =============================================================================

// Colors from CSS variables (tokens.css)
const C = {
  bg: 'var(--kenoki-bg)',
  overlay: 'var(--kenoki-glass)',
  pillBg: 'var(--kenoki-accent-soft)',
  pillBgHover: 'rgba(172, 203, 238, 0.15)',
  accent: 'var(--kenoki-accent)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  border: 'var(--kenoki-accent-border)',
  white: 'var(--kenoki-surface)',
  fuelGreen: 'var(--kenoki-success)',
  fuelYellow: 'var(--kenoki-warning)',
  fuelRed: 'var(--kenoki-error)',
};

// =============================================================================
// TOP BAR PILL (Minimised State)
// =============================================================================

interface TopBarPillProps {
  projectName: string;
  progress: number;
  onExpand: () => void;
  onStop: () => void;
  elapsed?: string;  // e.g., "2m 15s"
}

function TopBarPill({ projectName, progress, onExpand, onStop, elapsed }: TopBarPillProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
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
      onClick={onExpand}
    >
      {/* Progress indicator */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: `conic-gradient(${C.accent} ${progress * 3.6}deg, ${C.border} 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: C.white,
          }}
        />
      </div>

      {/* Project name */}
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
        {projectName || 'Building...'}
      </span>

      {/* Progress percentage */}
      <span style={{ fontSize: 12, color: C.textSub }}>
        {progress}%
      </span>

      {/* Elapsed time */}
      {elapsed && (
        <span style={{ fontSize: 11, color: C.textFaint }}>
          {elapsed}
        </span>
      )}

      {/* Stop button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStop();
        }}
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
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(232, 91, 91, 0.2)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(232, 91, 91, 0.1)')}
      >
        {'\u2715'}
      </button>
    </div>
  );
}

// =============================================================================
// FUEL GAUGE COMPONENT
// =============================================================================

interface FuelGaugeProps {
  percent: number;
  label: string;
  warning: boolean;
}

function FuelGauge({ percent, label, warning }: FuelGaugeProps): React.ReactElement {
  const getColor = () => {
    if (percent > 50) return C.fuelGreen;
    if (percent > 20) return C.fuelYellow;
    return C.fuelRed;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: warning ? 'rgba(248, 113, 113, 0.1)' : 'rgba(75, 142, 232, 0.06)',
        borderRadius: 12,
      }}
    >
      {/* Fuel bar */}
      <div
        style={{
          width: 60,
          height: 6,
          borderRadius: 3,
          background: C.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: getColor(),
            borderRadius: 3,
            transition: 'width 0.5s ease-out',
          }}
        />
      </div>

      {/* Label */}
      <span style={{ fontSize: 11, color: warning ? '#C45050' : C.textSub }}>
        {label}
      </span>
    </div>
  );
}

// =============================================================================
// COMPLETE STATE COMPONENT
// =============================================================================

interface CompleteStateProps {
  projectName: string;
  outputs: Array<{ type: string; label: string; value: string }>;
  onDismiss: () => void;
}

function CompleteState({ projectName, outputs, onDismiss }: CompleteStateProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '20px 28px',
        background: C.white,
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 400,
        animation: 'slideUp 0.3s ease-out',
        zIndex: 100,
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(74, 222, 128, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {'\u2705'}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
            {projectName || 'Project'} Complete
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>
            Your build finished successfully
          </div>
        </div>
      </div>

      {/* Outputs */}
      {outputs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {outputs.map((output, i) => (
            <a
              key={i}
              href={output.value}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: C.bg,
                borderRadius: 10,
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = C.pillBg)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = C.bg)}
            >
              <span style={{ fontSize: 14 }}>
                {output.type === 'url' ? '\uD83D\uDD17' : output.type === 'file' ? '\uD83D\uDCC4' : '\uD83D\uDCE6'}
              </span>
              <span style={{ fontSize: 13, color: C.accent }}>{output.label}</span>
            </a>
          ))}
        </div>
      )}

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.white,
          fontSize: 13,
          color: C.textSub,
          cursor: 'pointer',
          transition: 'all 0.15s',
          alignSelf: 'flex-end',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.bg)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.white)}
      >
        Dismiss
      </button>
    </div>
  );
}

// =============================================================================
// MAIN APP SHELL COMPONENT
// =============================================================================

export default function AppShell({ initialState = 'idle', children }: AppShellProps): React.ReactElement {
  // Get shell state from hook
  const {
    state: shellState,
    hideTree,
    expandTree,
    dismissTree,
  } = useAppShell();

  // Get status agent state
  const {
    tree,
    query,
    fuel,
    projectName,
    overallProgress,
    interruptFeedback,
    queryTimer,
    elapsed,
    sendQueryResponse,
    sendCorrection,
    sendStopStep,
    sendStopAll,
    sendPause,
  } = useStatusAgent();

  // Build output (placeholder - would come from build complete event)
  const [outputs, setOutputs] = useState<Array<{ type: string; label: string; value: string }>>([]);

  // Convert tree to format with expandable/expanded properties
  const treeWithExpand: RenderTreeNode[] = tree.map((node) => ({
    ...node,
    expandable: node.children.length > 0,
    expanded: true, // Default expanded
  }));

  // Handle pause
  const handlePause = useCallback(() => {
    hideTree();
    sendPause();
  }, [hideTree, sendPause]);

  // Render based on shell state
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* BrowserView wrapper (always visible) */}
      <div
        style={{
          width: '100%',
          height: '100%',
          // When building, push down slightly for top bar
          paddingTop: shellState === 'minimised' ? 44 : 0,
          transition: 'padding-top 0.2s ease-out',
        }}
      >
        {children}
      </div>

      {/* Top bar (minimised state) */}
      {shellState === 'minimised' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 44,
            background: C.white,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            zIndex: 50,
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { transform: translateY(-100%); }
              to { transform: translateY(0); }
            }
          `}</style>

          <TopBarPill
            projectName={projectName || 'Building...'}
            progress={overallProgress}
            elapsed={elapsed}
            onExpand={() => {
              expandTree();
            }}
            onStop={() => {
              sendStopAll();
              dismissTree();
            }}
          />

          <FuelGauge
            percent={fuel.percent}
            label={fuel.label}
            warning={fuel.warning}
          />
        </div>
      )}

      {/* Expanded overlay (building state) */}
      {shellState === 'building' && (
        <div
          className="theme-dark"
          style={{
            position: 'fixed',
            inset: 0,
            background: C.overlay,
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>

          {/* Minimize button */}
          <button
            onClick={handlePause}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: C.textSub,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.bg)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.white)}
          >
            {'\u2193'}
          </button>

          {/* Fuel gauge in corner */}
          <div style={{ position: 'absolute', top: 16, left: 16 }}>
            <FuelGauge
              percent={fuel.percent}
              label={fuel.label}
              warning={fuel.warning}
            />
          </div>

          {/* Progress tree */}
          <ProgressTree
            tree={treeWithExpand}
            query={query ? {
              id: query.id,
              question: query.question,
              options: query.options,
              defaultChoice: query.defaultChoice,
            } : null}
            projectName={projectName || 'Building...'}
            overallProgress={overallProgress}
            queryTimer={queryTimer}
            interruptFeedback={interruptFeedback}
            onQueryResponse={sendQueryResponse}
            onCorrection={sendCorrection}
            onStopStep={sendStopStep}
            onStopAll={sendStopAll}
            onPause={handlePause}
          />
        </div>
      )}

      {/* Complete state banner */}
      {shellState === 'complete' && (
        <CompleteState
          projectName={projectName || 'Project'}
          outputs={outputs}
          onDismiss={() => {
            dismissTree();
          }}
        />
      )}
    </div>
  );
}
