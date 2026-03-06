/**
 * QualityReport Component
 *
 * Displays quality assessment results after a build completes.
 * Shows automated scores (Lighthouse, accessibility) and provides
 * a form for manual design review by human evaluators.
 *
 * This is the most important differentiator - we judge OUTPUT quality,
 * not just that the pipeline runs.
 */

import React, { useState, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa: number | null;
}

interface ViewportCheck {
  viewport: string;
  width: number;
  height: number;
  hasHorizontalScroll: boolean;
  screenshotPath: string | null;
}

interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  selector: string;
  helpUrl: string;
}

interface ManualScores {
  design: number | null;
  functionality: number | null;
  wouldPay: boolean | null;
  notes: string;
}

interface QualityReportData {
  id: string;
  timestamp: string;
  buildName: string;
  url: string;
  lighthouse: LighthouseScores | null;
  lighthouseError: string | null;
  viewports: ViewportCheck[];
  totalAssetSizeKB: number;
  oversizedAssets: number;
  brokenLinks: number;
  accessibilityIssues: AccessibilityIssue[];
  accessibilityScore: number;
  consoleErrors: string[];
  manualScores: ManualScores;
  automatedScore: number;
  passesQualityGate: boolean;
  issues: string[];
}

interface QualityReportProps {
  /** Report data from quality scorer */
  report: QualityReportData;
  /** Callback when report is submitted */
  onSubmit?: (report: QualityReportData) => void;
  /** Callback to close/dismiss the report */
  onClose?: () => void;
  /** Whether the form is in read-only mode */
  readOnly?: boolean;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg, #0a0a0a)',
  surface: 'var(--kenoki-surface, #171717)',
  surfaceElevated: 'var(--kenoki-surface-elevated, #262626)',
  border: 'var(--kenoki-accent-border, #404040)',
  accent: 'var(--kenoki-accent, #3b82f6)',
  accentSoft: 'var(--kenoki-accent-soft, rgba(59, 130, 246, 0.1))',
  text: 'var(--kenoki-text, #fafafa)',
  textSub: 'var(--kenoki-text-secondary, #a3a3a3)',
  textMuted: 'var(--kenoki-text-muted, #737373)',
  success: 'var(--kenoki-success, #22c55e)',
  warning: 'var(--kenoki-warning, #eab308)',
  error: 'var(--kenoki-error, #ef4444)',
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface ScoreCircleProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

function ScoreCircle({ score, label, size = 'md' }: ScoreCircleProps): React.ReactElement {
  const getColor = (s: number) => {
    if (s >= 80) return C.success;
    if (s >= 60) return C.warning;
    return C.error;
  };

  const dimensions = {
    sm: { size: 60, stroke: 4, fontSize: 14, labelSize: 10 },
    md: { size: 80, stroke: 5, fontSize: 18, labelSize: 11 },
    lg: { size: 100, stroke: 6, fontSize: 24, labelSize: 12 },
  };

  const d = dimensions[size];
  const radius = (d.size - d.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getColor(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={d.size} height={d.size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={d.size / 2}
          cy={d.size / 2}
          r={radius}
          fill="none"
          stroke={C.surfaceElevated}
          strokeWidth={d.stroke}
        />
        {/* Progress circle */}
        <circle
          cx={d.size / 2}
          cy={d.size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={d.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
        {/* Score text */}
        <text
          x={d.size / 2}
          y={d.size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={C.text}
          fontSize={d.fontSize}
          fontWeight="600"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {score}
        </text>
      </svg>
      <span style={{ fontSize: d.labelSize, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
    </div>
  );
}

interface IssueCardProps {
  issue: string;
  type?: 'error' | 'warning' | 'info';
}

function IssueCard({ issue, type = 'error' }: IssueCardProps): React.ReactElement {
  const colors = {
    error: { bg: 'rgba(239, 68, 68, 0.1)', icon: C.error },
    warning: { bg: 'rgba(234, 179, 8, 0.1)', icon: C.warning },
    info: { bg: 'rgba(59, 130, 246, 0.1)', icon: C.accent },
  };

  const c = colors[type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: c.bg,
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: c.icon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: 'white', fontWeight: 700 }}>!</span>
      </div>
      <span style={{ fontSize: 13, color: C.text }}>{issue}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function QualityReport({
  report,
  onSubmit,
  onClose,
  readOnly = false,
}: QualityReportProps): React.ReactElement {
  // Local state for manual scores form
  const [designScore, setDesignScore] = useState<string>(
    report.manualScores.design?.toString() ?? ''
  );
  const [functionalityScore, setFunctionalityScore] = useState<string>(
    report.manualScores.functionality?.toString() ?? ''
  );
  const [wouldPay, setWouldPay] = useState<string>(
    report.manualScores.wouldPay === true
      ? 'yes'
      : report.manualScores.wouldPay === false
        ? 'no'
        : ''
  );
  const [notes, setNotes] = useState(report.manualScores.notes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (readOnly) return;

    setIsSaving(true);
    setSaveSuccess(false);

    const updatedReport: QualityReportData = {
      ...report,
      manualScores: {
        design: designScore ? parseInt(designScore, 10) : null,
        functionality: functionalityScore ? parseInt(functionalityScore, 10) : null,
        wouldPay: wouldPay === 'yes' ? true : wouldPay === 'no' ? false : null,
        notes,
      },
    };

    try {
      // Call IPC to save if available
      const api = (window as Window & { electronAPI?: { quality?: { updateManualScores?: (id: string, scores: ManualScores) => Promise<void> } } }).electronAPI;
      if (api?.quality?.updateManualScores) {
        await api.quality.updateManualScores(
          report.id,
          updatedReport.manualScores
        );
      }

      onSubmit?.(updatedReport);
      setSaveSuccess(true);

      // Reset success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save quality report:', error);
    } finally {
      setIsSaving(false);
    }
  }, [report, designScore, functionalityScore, wouldPay, notes, readOnly, onSubmit]);

  // Calculate combined score
  const combinedScore = (() => {
    const design = parseInt(designScore, 10);
    const func = parseInt(functionalityScore, 10);
    if (isNaN(design) && isNaN(func)) return null;
    if (isNaN(design)) return func * 10;
    if (isNaN(func)) return design * 10;
    return Math.round(((design + func) / 2) * 10);
  })();

  return (
    <div
      className="quality-report theme-dark"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          maxHeight: '90vh',
          background: C.surface,
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>
              Quality Report
            </h2>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              {report.buildName} - {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Quality gate badge */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                background: report.passesQualityGate
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                color: report.passesQualityGate ? C.success : C.error,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {report.passesQualityGate ? 'PASSED' : 'FAILED'}
            </div>

            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceElevated,
                  color: C.textSub,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                x
              </button>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* Automated Scores Section */}
          <section style={{ marginBottom: 32 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.textSub,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 16,
              }}
            >
              Automated Scores
            </h3>

            {/* Lighthouse Scores */}
            {report.lighthouse ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  flexWrap: 'wrap',
                  gap: 20,
                  padding: 24,
                  background: C.bg,
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              >
                <ScoreCircle score={report.lighthouse.performance} label="Performance" />
                <ScoreCircle score={report.lighthouse.accessibility} label="Accessibility" />
                <ScoreCircle score={report.lighthouse.bestPractices} label="Best Practices" />
                <ScoreCircle score={report.lighthouse.seo} label="SEO" />
              </div>
            ) : (
              <div
                style={{
                  padding: 20,
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 12,
                  color: C.error,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                Lighthouse audit failed: {report.lighthouseError || 'Unknown error'}
              </div>
            )}

            {/* Quick Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: C.bg,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>
                  {report.automatedScore}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  AUTOMATED SCORE
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: C.bg,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: report.brokenLinks > 0 ? C.error : C.success,
                  }}
                >
                  {report.brokenLinks}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>BROKEN LINKS</div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: C.bg,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: report.consoleErrors.length > 0 ? C.error : C.success,
                  }}
                >
                  {report.consoleErrors.length}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>CONSOLE ERRORS</div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: C.bg,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>
                  {Math.round(report.totalAssetSizeKB / 1024 * 10) / 10}MB
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>TOTAL ASSETS</div>
              </div>
            </div>
          </section>

          {/* Issues Section */}
          {report.issues.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.textSub,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 16,
                }}
              >
                Issues Found ({report.issues.length})
              </h3>
              <div>
                {report.issues.map((issue, i) => (
                  <IssueCard key={i} issue={issue} />
                ))}
              </div>
            </section>
          )}

          {/* Viewport Checks */}
          <section style={{ marginBottom: 32 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.textSub,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 16,
              }}
            >
              Responsive Checks
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {report.viewports.map((vp) => (
                <div
                  key={vp.viewport}
                  style={{
                    padding: 16,
                    background: C.bg,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: vp.hasHorizontalScroll
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: vp.hasHorizontalScroll ? C.error : C.success,
                      fontSize: 14,
                    }}
                  >
                    {vp.hasHorizontalScroll ? 'x' : '\u2713'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                      {vp.viewport.charAt(0).toUpperCase() + vp.viewport.slice(1)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      {vp.width} x {vp.height}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Manual Review Section */}
          <section>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.textSub,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 16,
              }}
            >
              Manual Design Review
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* Design Score */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    color: C.textMuted,
                    marginBottom: 8,
                  }}
                >
                  Design Score (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={designScore}
                  onChange={(e) => setDesignScore(e.target.value)}
                  disabled={readOnly}
                  placeholder="Rate 1-10"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Functionality Score */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    color: C.textMuted,
                    marginBottom: 8,
                  }}
                >
                  Functionality Score (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={functionalityScore}
                  onChange={(e) => setFunctionalityScore(e.target.value)}
                  disabled={readOnly}
                  placeholder="Rate 1-10"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Would Pay */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: C.textMuted,
                  marginBottom: 8,
                }}
              >
                Would You Pay For This?
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => !readOnly && setWouldPay('yes')}
                  disabled={readOnly}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: wouldPay === 'yes' ? 'rgba(34, 197, 94, 0.15)' : C.bg,
                    border: `1px solid ${wouldPay === 'yes' ? C.success : C.border}`,
                    borderRadius: 8,
                    color: wouldPay === 'yes' ? C.success : C.textSub,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: readOnly ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Yes - Worth Paying
                </button>
                <button
                  onClick={() => !readOnly && setWouldPay('no')}
                  disabled={readOnly}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: wouldPay === 'no' ? 'rgba(239, 68, 68, 0.15)' : C.bg,
                    border: `1px solid ${wouldPay === 'no' ? C.error : C.border}`,
                    borderRadius: 8,
                    color: wouldPay === 'no' ? C.error : C.textSub,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: readOnly ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  No - Needs Work
                </button>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: C.textMuted,
                  marginBottom: 8,
                }}
              >
                Review Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={readOnly}
                placeholder="Document specific issues, praise, or suggestions..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  color: C.text,
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            {/* Combined Score Display */}
            {combinedScore !== null && (
              <div
                style={{
                  padding: 20,
                  background: C.bg,
                  borderRadius: 12,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color:
                      combinedScore >= 70
                        ? C.success
                        : combinedScore >= 50
                          ? C.warning
                          : C.error,
                  }}
                >
                  {combinedScore}/100
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  COMBINED MANUAL SCORE
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {saveSuccess && (
                <span style={{ color: C.success, fontSize: 13 }}>
                  Report saved successfully!
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {onClose && (
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    background: C.surfaceElevated,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.textSub,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                style={{
                  padding: '10px 24px',
                  background: C.accent,
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isSaving ? 'default' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? 'Saving...' : 'Submit Quality Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EXPORT
// =============================================================================

export { QualityReport };
export type { QualityReportData, QualityReportProps, ManualScores, LighthouseScores };
