/**
 * AnalyticsPanel Component
 *
 * Displays local analytics to the user - their own build stats.
 * All data is anonymous and stored locally on their device.
 *
 * Features:
 * - Build statistics overview
 * - Success rate metrics
 * - Template usage insights
 * - Export and clear data options
 */

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface AnalyticsSummary {
  totalBuilds: number;
  completedBuilds: number;
  cancelledBuilds: number;
  averageBuildTime: number;
  tierUsage: { tier0: number; tier1: number; tier2: number; tier3: number };
  topTemplates: string[];
  commonCancelPoints: string[];
  successRate: number;
  totalBuildTime: number;
  firstEventAt: number | null;
  lastEventAt: number | null;
}

export interface AnalyticsPanelProps {
  /** Called when panel should close */
  onClose?: () => void;
  /** Whether to show as overlay or inline */
  inline?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg)',
  surface: 'var(--kenoki-surface)',
  border: 'var(--kenoki-accent-border)',
  accent: 'var(--kenoki-accent)',
  accentSoft: 'var(--kenoki-accent-soft)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textMuted: 'var(--kenoki-text-muted)',
  success: 'var(--kenoki-success)',
  warning: 'var(--kenoki-warning, #f5a623)',
  error: 'var(--kenoki-error, #ff6b6b)',
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format milliseconds to human-readable time.
 */
function formatDuration(ms: number): string {
  if (ms === 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format a timestamp to relative time.
 */
function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.round(diff / 86400000)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

// =============================================================================
// STAT CARD SUB-COMPONENT
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
}

function StatCard({ label, value, sublabel, color, icon }: StatCardProps): React.ReactElement {
  return (
    <div
      style={{
        padding: '16px 20px',
        background: C.surface,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 140,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 16, opacity: 0.7 }}>{icon}</span>}
        <span style={{ fontSize: 12, color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || C.text }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TIER CHART SUB-COMPONENT
// =============================================================================

interface TierChartProps {
  tierUsage: { tier0: number; tier1: number; tier2: number; tier3: number };
}

function TierChart({ tierUsage }: TierChartProps): React.ReactElement {
  const total = tierUsage.tier0 + tierUsage.tier1 + tierUsage.tier2 + tierUsage.tier3;

  const tiers = [
    { name: 'Fast-path', value: tierUsage.tier0, color: '#7ed9b5' },
    { name: 'Router', value: tierUsage.tier1, color: '#6ecfdc' },
    { name: 'CLI', value: tierUsage.tier2, color: '#9b8cff' },
    { name: 'Hybrid', value: tierUsage.tier3, color: '#ffb86c' },
  ];

  return (
    <div
      style={{
        padding: '16px 20px',
        background: C.surface,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
      }}
    >
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Tier Usage
      </div>

      {total === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
          No builds yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tiers.map((tier) => {
            const percent = total > 0 ? (tier.value / total) * 100 : 0;
            return (
              <div key={tier.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 70, fontSize: 12, color: C.textSub }}>{tier.name}</div>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: C.bg,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${percent}%`,
                      background: tier.color,
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div style={{ width: 35, fontSize: 12, color: C.textMuted, textAlign: 'right' }}>
                  {tier.value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TEMPLATES LIST SUB-COMPONENT
// =============================================================================

interface TemplatesListProps {
  templates: string[];
  title: string;
}

function TemplatesList({ templates, title }: TemplatesListProps): React.ReactElement {
  return (
    <div
      style={{
        padding: '16px 20px',
        background: C.surface,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
      }}
    >
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>

      {templates.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
          No data yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {templates.slice(0, 5).map((template, i) => (
            <div
              key={template}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: C.bg,
                borderRadius: 6,
                fontSize: 13,
                color: C.text,
              }}
            >
              <span style={{ color: C.textMuted, width: 16 }}>{i + 1}.</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {template}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AnalyticsPanel({
  onClose,
  inline = false,
  className,
}: AnalyticsPanelProps): React.ReactElement {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Load analytics data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryData, isEnabled] = await Promise.all([
        window.electronAPI?.analytics?.getSummary(),
        window.electronAPI?.analytics?.isEnabled(),
      ]);
      if (summaryData) {
        setSummary(summaryData);
      }
      setEnabled(isEnabled ?? true);
    } catch (error) {
      console.error('[AnalyticsPanel] Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const data = await window.electronAPI?.analytics?.export();
      if (data) {
        // Create and trigger download
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kenoki-analytics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('[AnalyticsPanel] Export failed:', error);
    } finally {
      setExporting(false);
    }
  }, []);

  // Handle clear
  const handleClear = useCallback(async () => {
    try {
      setClearing(true);
      await window.electronAPI?.analytics?.clear();
      setShowConfirmClear(false);
      await loadData();
    } catch (error) {
      console.error('[AnalyticsPanel] Clear failed:', error);
    } finally {
      setClearing(false);
    }
  }, [loadData]);

  // Handle toggle enabled
  const handleToggleEnabled = useCallback(async () => {
    try {
      const newValue = !enabled;
      await window.electronAPI?.analytics?.setEnabled(newValue);
      setEnabled(newValue);
    } catch (error) {
      console.error('[AnalyticsPanel] Toggle failed:', error);
    }
  }, [enabled]);

  // Container styles
  const containerStyle: React.CSSProperties = inline
    ? {
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: C.bg,
      }
    : {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      };

  const panelStyle: React.CSSProperties = inline
    ? { padding: 24 }
    : {
        width: '90%',
        maxWidth: 640,
        maxHeight: '85vh',
        overflow: 'auto',
        background: C.bg,
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      };

  return (
    <div className={`analytics-panel theme-dark ${className ?? ''}`} style={containerStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>
              Your Build Stats
            </h2>
            <p style={{ fontSize: 13, color: C.textSub, margin: '4px 0 0' }}>
              Anonymous, local-only analytics
            </p>
          </div>

          {!inline && onClose && (
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.surface,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: C.textSub,
              }}
            >
              x
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
            Loading analytics...
          </div>
        ) : summary ? (
          <>
            {/* Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <StatCard
                label="Total Builds"
                value={summary.totalBuilds}
                sublabel={`Since ${formatRelativeTime(summary.firstEventAt)}`}
              />
              <StatCard
                label="Success Rate"
                value={`${summary.successRate.toFixed(0)}%`}
                sublabel={`${summary.completedBuilds} completed`}
                color={summary.successRate >= 80 ? C.success : summary.successRate >= 50 ? C.warning : C.error}
              />
              <StatCard
                label="Avg Build Time"
                value={formatDuration(summary.averageBuildTime)}
                sublabel={`${formatDuration(summary.totalBuildTime)} total`}
              />
              <StatCard
                label="Cancelled"
                value={summary.cancelledBuilds}
                sublabel={summary.cancelledBuilds > 0 ? 'See cancel points below' : 'None cancelled'}
              />
            </div>

            {/* Tier and Templates */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <TierChart tierUsage={summary.tierUsage} />
              <TemplatesList templates={summary.topTemplates} title="Most Used Templates" />
            </div>

            {/* Cancel Points */}
            {summary.commonCancelPoints.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <TemplatesList templates={summary.commonCancelPoints} title="Common Cancel Points" />
              </div>
            )}

            {/* Footer - Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 16,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: C.textSub,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={handleToggleEnabled}
                    style={{ cursor: 'pointer' }}
                  />
                  Track analytics
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleExport}
                  disabled={exporting || summary.totalBuilds === 0}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    fontSize: 13,
                    color: C.textSub,
                    cursor: exporting || summary.totalBuilds === 0 ? 'not-allowed' : 'pointer',
                    opacity: exporting || summary.totalBuilds === 0 ? 0.5 : 1,
                  }}
                >
                  {exporting ? 'Exporting...' : 'Export Data'}
                </button>

                {showConfirmClear ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={handleClear}
                      disabled={clearing}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: C.error,
                        fontSize: 13,
                        color: '#fff',
                        cursor: clearing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {clearing ? 'Clearing...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        fontSize: 13,
                        color: C.textSub,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    disabled={summary.totalBuilds === 0}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      fontSize: 13,
                      color: summary.totalBuilds === 0 ? C.textMuted : C.error,
                      cursor: summary.totalBuilds === 0 ? 'not-allowed' : 'pointer',
                      opacity: summary.totalBuilds === 0 ? 0.5 : 1,
                    }}
                  >
                    Clear Data
                  </button>
                )}
              </div>
            </div>

            {/* Privacy notice */}
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: C.surface,
                borderRadius: 8,
                fontSize: 11,
                color: C.textMuted,
                textAlign: 'center',
              }}
            >
              All analytics data is stored locally on your device. Nothing is sent to any server.
              You can export or delete your data at any time.
            </div>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
            No analytics data available
          </div>
        )}
      </div>
    </div>
  );
}

export { AnalyticsPanel };
