/**
 * BuildPanel Component
 *
 * Container component for ProgressTree + FuelGauge.
 * Handles minimize/expand transitions and shows build outputs when complete.
 *
 * This is a self-contained panel that can be mounted anywhere and will
 * automatically subscribe to status agent events.
 */

import React, { useState, useEffect, useCallback } from 'react';
import ProgressTree from './ProgressTree';
import FuelGauge from './FuelGauge';
import { useStatusAgent, RenderTreeNode } from '../hooks/useStatusAgent';

// =============================================================================
// TYPES
// =============================================================================

export type PanelState = 'hidden' | 'expanded' | 'minimised' | 'complete';

export interface BuildOutput {
  type: 'url' | 'file' | 'artifact';
  label: string;
  value: string;
}

export interface BuildPanelProps {
  /** Initial panel state */
  initialState?: PanelState;
  /** Callback when panel state changes */
  onStateChange?: (state: PanelState) => void;
  /** Custom outputs to display on completion */
  outputs?: BuildOutput[];
  /** Whether to show as overlay (default) or inline */
  inline?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg)',
  overlay: 'var(--kenoki-glass)',
  surface: 'var(--kenoki-surface)',
  border: 'var(--kenoki-accent-border)',
  accent: 'var(--kenoki-accent)',
  accentSoft: 'var(--kenoki-accent-soft)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  success: 'var(--kenoki-success)',
};

// =============================================================================
// CSS ANIMATIONS
// =============================================================================

const globalStyles = `
  @keyframes buildPanelFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes buildPanelSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes buildPanelSlideDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// =============================================================================
// COMPLETE BANNER SUB-COMPONENT
// =============================================================================

interface CompleteBannerProps {
  projectName: string;
  outputs: BuildOutput[];
  onDismiss: () => void;
}

function CompleteBanner({ projectName, outputs, onDismiss }: CompleteBannerProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '20px 28px',
        background: C.surface,
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 400,
        minWidth: 280,
        animation: 'buildPanelSlideUp 0.3s ease-out',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(126, 217, 181, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 20 20"
            style={{ width: 16, height: 16 }}
            fill="none"
            stroke={C.success}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 10.5 L8 14.5 L16 5.5" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
            {projectName || 'Project'} Complete
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>Your build finished successfully</div>
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
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = C.accentSoft)}
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
          background: C.surface,
          fontSize: 13,
          color: C.textSub,
          cursor: 'pointer',
          transition: 'all 0.15s',
          alignSelf: 'flex-end',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.bg)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.surface)}
      >
        Dismiss
      </button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BuildPanel({
  initialState = 'hidden',
  onStateChange,
  outputs: propOutputs,
  inline = false,
  className,
}: BuildPanelProps): React.ReactElement | null {
  // Panel state
  const [panelState, setPanelState] = useState<PanelState>(initialState);
  const [outputs, setOutputs] = useState<BuildOutput[]>(propOutputs ?? []);

  // Get status agent state
  const {
    tree,
    query,
    fuel,
    buildState,
    projectName,
    overallProgress,
    interruptFeedback,
    queryTimer,
    sendQueryResponse,
    sendCorrection,
    sendStopStep,
    sendStopAll,
    sendPause,
  } = useStatusAgent();

  // Sync panel state with build state
  useEffect(() => {
    if (buildState === 'idle') {
      setPanelState('hidden');
    } else if (buildState === 'building') {
      setPanelState('expanded');
    } else if (buildState === 'complete') {
      setPanelState('complete');
    }
  }, [buildState]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(panelState);
  }, [panelState, onStateChange]);

  // Subscribe to build complete for outputs
  useEffect(() => {
    const cleanup = window.electronAPI?.statusAgent?.onBuildComplete?.((data) => {
      if (data.outputs) {
        setOutputs(
          data.outputs.map((o) => ({
            type: o.type as 'url' | 'file' | 'artifact',
            label: o.label,
            value: o.value,
          }))
        );
      }
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Handlers
  const handleMinimize = useCallback(() => {
    setPanelState('minimised');
    window.electronAPI?.statusAgent?.hideTree?.();
    sendPause();
  }, [sendPause]);

  const handleExpand = useCallback(() => {
    setPanelState('expanded');
    window.electronAPI?.statusAgent?.expandTree?.();
  }, []);

  const handleDismiss = useCallback(() => {
    setPanelState('hidden');
    window.electronAPI?.statusAgent?.dismissTree?.();
  }, []);

  const handleStopAll = useCallback(() => {
    sendStopAll();
    handleDismiss();
  }, [sendStopAll, handleDismiss]);

  // Don't render if hidden
  if (panelState === 'hidden') {
    return null;
  }

  // Complete state - show banner
  if (panelState === 'complete') {
    return (
      <>
        <style>{globalStyles}</style>
        <CompleteBanner
          projectName={projectName || 'Project'}
          outputs={outputs}
          onDismiss={handleDismiss}
        />
      </>
    );
  }

  // Minimised state - handled by TopBarPill separately
  if (panelState === 'minimised') {
    return null;
  }

  // Expanded state - show full progress tree
  const containerStyle: React.CSSProperties = inline
    ? {
        width: '100%',
        height: '100%',
        background: C.bg,
        overflow: 'auto',
      }
    : {
        position: 'fixed',
        inset: 0,
        background: C.overlay,
        backdropFilter: 'blur(4px)',
        zIndex: 40,
        animation: 'buildPanelFadeIn 0.2s ease-out',
      };

  return (
    <div className={`build-panel theme-dark ${className ?? ''}`} style={containerStyle}>
      <style>{globalStyles}</style>

      {/* Minimize button (only for overlay mode) */}
      {!inline && (
        <button
          onClick={handleMinimize}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.surface,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: C.textSub,
            transition: 'all 0.15s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.bg)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.surface)}
          title="Minimize"
        >
          {'\u2193'}
        </button>
      )}

      {/* Fuel gauge in corner (only for overlay mode) */}
      {!inline && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
          <FuelGauge
            percent={fuel.percent}
            label={fuel.label}
            detail={fuel.detail}
            warning={fuel.warning}
            warningText={fuel.warningText}
          />
        </div>
      )}

      {/* Progress tree */}
      <ProgressTree
        tree={tree}
        query={
          query
            ? {
                id: query.id,
                question: query.question,
                options: query.options,
                defaultChoice: query.defaultChoice,
              }
            : null
        }
        projectName={projectName || 'Building...'}
        overallProgress={overallProgress}
        queryTimer={queryTimer}
        interruptFeedback={interruptFeedback}
        onQueryResponse={sendQueryResponse}
        onCorrection={sendCorrection}
        onStopStep={sendStopStep}
        onStopAll={handleStopAll}
        onPause={handleMinimize}
      />
    </div>
  );
}

export { BuildPanel };
