/**
 * BuildPanel Component
 *
 * Container component for ProgressTree + FuelGauge + PreviewPanel.
 * Handles minimize/expand transitions and shows build outputs when complete.
 * Features tabbed interface to switch between Tree view and Preview.
 *
 * This is a self-contained panel that can be mounted anywhere and will
 * automatically subscribe to status agent events.
 */

import React, { useState, useEffect, useCallback } from 'react';
import ProgressTree from './ProgressTree';
import FuelGauge from './FuelGauge';
import PreviewPanel from './PreviewPanel';
import UndoButton from './UndoButton';
import { useStatusAgent, RenderTreeNode } from '../hooks/useStatusAgent';

// =============================================================================
// TYPES
// =============================================================================

export type PanelState = 'hidden' | 'expanded' | 'minimised' | 'complete';
export type ActiveTab = 'tree' | 'preview';

export interface BuildOutput {
  type: 'url' | 'file' | 'artifact';
  label: string;
  value: string;
}

export interface BuildPanelProps {
  /** Initial panel state */
  initialState?: PanelState;
  /** Initial active tab */
  initialTab?: ActiveTab;
  /** Callback when panel state changes */
  onStateChange?: (state: PanelState) => void;
  /** Callback when active tab changes */
  onTabChange?: (tab: ActiveTab) => void;
  /** Custom outputs to display on completion */
  outputs?: BuildOutput[];
  /** Whether to show as overlay (default) or inline */
  inline?: boolean;
  /** Custom class name */
  className?: string;
  /** Show preview tab */
  showPreviewTab?: boolean;
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
  @keyframes buildPanelTabSlide {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;

// =============================================================================
// TAB BAR SUB-COMPONENT
// =============================================================================

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  showPreview: boolean;
  hasPreviewUrl: boolean;
}

function TabBar({ activeTab, onTabChange, showPreview, hasPreviewUrl }: TabBarProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}
    >
      {/* Tree tab */}
      <button
        onClick={() => onTabChange('tree')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 8,
          border: 'none',
          background: activeTab === 'tree' ? C.accentSoft : 'transparent',
          color: activeTab === 'tree' ? C.accent : C.textSub,
          fontSize: 13,
          fontWeight: activeTab === 'tree' ? 600 : 400,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        Progress
      </button>

      {/* Preview tab */}
      {showPreview && (
        <button
          onClick={() => onTabChange('preview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'preview' ? C.accentSoft : 'transparent',
            color: activeTab === 'preview' ? C.accent : C.textSub,
            fontSize: 13,
            fontWeight: activeTab === 'preview' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
          {hasPreviewUrl && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: C.success,
                marginLeft: 2,
              }}
            />
          )}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// COMPLETE BANNER SUB-COMPONENT
// =============================================================================

interface CompleteBannerProps {
  projectName: string;
  projectPath?: string;
  outputs: BuildOutput[];
  onDismiss: () => void;
  onUndoComplete?: () => void;
}

function CompleteBanner({ projectName, projectPath, outputs, onDismiss, onUndoComplete }: CompleteBannerProps): React.ReactElement {
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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* Undo button */}
        {projectPath && (
          <UndoButton
            projectPath={projectPath}
            projectName={projectName}
            onUndoComplete={() => {
              onUndoComplete?.();
              onDismiss();
            }}
            size="sm"
          />
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
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.bg)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.surface)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BuildPanel({
  initialState = 'hidden',
  initialTab = 'tree',
  onStateChange,
  onTabChange,
  outputs: propOutputs,
  inline = false,
  className,
  showPreviewTab = true,
}: BuildPanelProps): React.ReactElement | null {
  // Panel state
  const [panelState, setPanelState] = useState<PanelState>(initialState);
  const [outputs, setOutputs] = useState<BuildOutput[]>(propOutputs ?? []);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [projectPath, setProjectPath] = useState<string>('');

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

  // Notify parent of tab changes
  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  // Handle tab change
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
  }, []);

  // Handle preview URL change (from PreviewPanel)
  const handlePreviewUrlChange = useCallback((url: string) => {
    setPreviewUrl(url);
  }, []);

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
        // Extract project path from file outputs if available
        const fileOutput = data.outputs.find((o) => o.type === 'file');
        if (fileOutput) {
          setProjectPath(fileOutput.value);
        }
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
          projectPath={projectPath}
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

  // Expanded state - show full progress tree with tabs
  const containerStyle: React.CSSProperties = inline
    ? {
        width: '100%',
        height: '100%',
        background: C.bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        position: 'fixed',
        inset: 0,
        background: C.overlay,
        backdropFilter: 'blur(4px)',
        zIndex: 40,
        animation: 'buildPanelFadeIn 0.2s ease-out',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div className={`build-panel theme-dark ${className ?? ''}`} style={containerStyle}>
      <style>{globalStyles}</style>

      {/* Header with minimize button and fuel gauge (only for overlay mode) */}
      {!inline && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {/* Fuel gauge */}
          <FuelGauge
            percent={fuel.percent}
            label={fuel.label}
            detail={fuel.detail}
            warning={fuel.warning}
            warningText={fuel.warningText}
          />

          {/* Minimize button */}
          <button
            onClick={handleMinimize}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.bg,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: C.textSub,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.surface)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.bg)}
            title="Minimize"
          >
            {'\u2193'}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        showPreview={showPreviewTab}
        hasPreviewUrl={!!previewUrl}
      />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'tree' && (
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
        )}

        {activeTab === 'preview' && (
          <PreviewPanel
            isActive={activeTab === 'preview'}
            onUrlChange={handlePreviewUrlChange}
          />
        )}
      </div>
    </div>
  );
}

export { BuildPanel, TabBar };
