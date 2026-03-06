/**
 * InstallerReassurance Component
 *
 * Shows during auto-installer flow with friendly, reassuring information.
 * Helps non-technical users understand what's being installed and why.
 * Expandable details show more info about each tool.
 *
 * Design: Calm, informative, emphasizes reversibility.
 */

import React, { useState, useEffect, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface InstallerStep {
  name: string;
  key: string;
  status: 'pending' | 'installing' | 'complete' | 'failed' | 'skipped';
  message?: string;
  error?: string;
}

export interface InstallerReassuranceProps {
  /** Current installation step info */
  currentStep: InstallerStep;
  /** Step index (0-based) */
  stepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Overall percent complete */
  percentComplete: number;
  /** All steps for expandable view */
  allSteps?: InstallerStep[];
  /** Callback when user wants to cancel */
  onCancel?: () => void;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg, #1D1D1F)',
  surface: 'var(--kenoki-surface, #2B2B30)',
  border: 'var(--kenoki-border, #3A3A40)',
  text: 'var(--kenoki-text, #F4F4F4)',
  textSecondary: 'var(--kenoki-text-secondary, #CFCFD6)',
  textMuted: 'var(--kenoki-text-muted, #9A9AA3)',
  accent: 'var(--kenoki-accent, #ACCBEE)',
  accentSoft: 'rgba(172, 203, 238, 0.12)',
  success: 'var(--kenoki-success, #7ED9B5)',
  successBg: 'rgba(126, 217, 181, 0.12)',
  warning: 'var(--kenoki-warning, #F6C177)',
  warningBg: 'rgba(246, 193, 119, 0.12)',
  error: 'var(--kenoki-error, #F08A8A)',
  errorBg: 'rgba(240, 138, 138, 0.12)',
};

// =============================================================================
// TOOL DESCRIPTIONS (Friendly explanations for non-technical users)
// =============================================================================

const TOOL_DESCRIPTIONS: Record<string, { friendly: string; detail: string; usedBy: string }> = {
  xcodeClt: {
    friendly: 'Mac Developer Tools',
    detail: 'Essential tools from Apple that let your Mac build and run software',
    usedBy: 'Required for all developer tools',
  },
  homebrew: {
    friendly: 'Package Manager',
    detail: 'A trusted tool used by millions to easily install and manage software on Mac',
    usedBy: 'Used to install Node.js, Python, and Git',
  },
  node: {
    friendly: 'JavaScript Runtime',
    detail: 'Powers modern web applications. Used by companies like Netflix, PayPal, and LinkedIn',
    usedBy: 'Required by Codex, Claude Code, and GSD',
  },
  python: {
    friendly: 'Python Language',
    detail: 'Popular programming language used for AI and automation. Trusted by Google, NASA, and Instagram',
    usedBy: 'Required for AI browser automation',
  },
  git: {
    friendly: 'Version Control',
    detail: 'Tracks changes to your files so you can always go back. Used by every major tech company',
    usedBy: 'Enables undo history for your projects',
  },
  codex: {
    friendly: 'OpenAI Codex CLI',
    detail: 'OpenAI\'s coding assistant that helps build and run projects',
    usedBy: 'Primary tool for building your projects',
  },
  claudeCode: {
    friendly: 'Claude Code',
    detail: 'Anthropic\'s coding assistant for intelligent code generation',
    usedBy: 'Alternative AI coding assistant',
  },
  gsd: {
    friendly: 'Task Orchestration',
    detail: 'Coordinates complex tasks by breaking them into manageable steps',
    usedBy: 'Plans and executes multi-step projects',
  },
  mcpServers: {
    friendly: 'Model Context Protocol',
    detail: 'Helps AI tools understand and work with your files safely',
    usedBy: 'Enhanced file handling for AI tools',
  },
  browserUse: {
    friendly: 'Browser Automation',
    detail: 'Lets AI interact with websites on your behalf',
    usedBy: 'Used for web research and testing',
  },
  playwright: {
    friendly: 'Web Testing',
    detail: 'Microsoft\'s tool for automated browser testing',
    usedBy: 'Verifies web projects work correctly',
  },
};

// =============================================================================
// CSS ANIMATIONS
// =============================================================================

const installerStyles = `
  @keyframes installerPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
  @keyframes installerSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes installerSlideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes installerProgress {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
`;

// =============================================================================
// ICONS
// =============================================================================

const LoaderIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: 'installerSpin 1s linear infinite' }}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronDownIcon = ({ size = 16, rotated = false }: { size?: number; rotated?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transition: 'transform 0.2s',
      transform: rotated ? 'rotate(180deg)' : 'rotate(0deg)',
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ShieldCheckIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

// =============================================================================
// STATUS INDICATOR
// =============================================================================

interface StatusIndicatorProps {
  status: InstallerStep['status'];
  size?: number;
}

function StatusIndicator({ status, size = 20 }: StatusIndicatorProps): React.ReactElement {
  switch (status) {
    case 'installing':
      return (
        <div style={{ color: C.accent }}>
          <LoaderIcon size={size} />
        </div>
      );
    case 'complete':
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: C.success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1D1D1F',
          }}
        >
          <CheckIcon size={size * 0.6} />
        </div>
      );
    case 'failed':
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: C.error,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1D1D1F',
          }}
        >
          <XIcon size={size * 0.6} />
        </div>
      );
    case 'skipped':
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: C.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.5,
            color: C.bg,
          }}
        >
          -
        </div>
      );
    default:
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: C.border,
          }}
        />
      );
  }
}

// =============================================================================
// STEP DETAIL ROW
// =============================================================================

interface StepRowProps {
  step: InstallerStep;
  isExpanded: boolean;
  onToggle: () => void;
}

function StepRow({ step, isExpanded, onToggle }: StepRowProps): React.ReactElement {
  const toolInfo = TOOL_DESCRIPTIONS[step.key] || {
    friendly: step.name,
    detail: 'Developer tool',
    usedBy: 'Used for building projects',
  };

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--kenoki-font)',
          textAlign: 'left',
        }}
      >
        <StatusIndicator status={step.status} size={18} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: step.status === 'pending' ? C.textMuted : C.text,
            }}
          >
            {toolInfo.friendly}
          </div>
          {step.status === 'installing' && step.message && (
            <div
              style={{
                fontSize: 12,
                color: C.accent,
                marginTop: 2,
              }}
            >
              {step.message}
            </div>
          )}
        </div>

        <ChevronDownIcon size={16} rotated={isExpanded} />
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: '0 16px 14px',
            animation: 'installerSlideIn 0.2s ease-out',
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: C.textSecondary,
              margin: '0 0 8px',
              lineHeight: 1.5,
            }}
          >
            {toolInfo.detail}
          </p>
          <p
            style={{
              fontSize: 12,
              color: C.textMuted,
              margin: 0,
            }}
          >
            {toolInfo.usedBy}
          </p>
          {step.error && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                background: C.errorBg,
                borderRadius: 8,
                fontSize: 12,
                color: C.error,
              }}
            >
              {step.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function InstallerReassurance({
  currentStep,
  stepIndex,
  totalSteps,
  percentComplete,
  allSteps = [],
  onCancel,
}: InstallerReassuranceProps): React.ReactElement {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Auto-expand current step
  useEffect(() => {
    setExpandedSteps((prev) => new Set([...prev, currentStep.key]));
  }, [currentStep.key]);

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const currentToolInfo = TOOL_DESCRIPTIONS[currentStep.key] || {
    friendly: currentStep.name,
    detail: 'Developer tool',
    usedBy: '',
  };

  return (
    <div
      className="theme-dark"
      style={{
        height: '100vh',
        width: '100vw',
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'var(--kenoki-font)',
      }}
    >
      <style>{installerStyles}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 480,
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: C.accentSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: C.accent,
            }}
          >
            <ShieldCheckIcon size={32} />
          </div>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: C.text,
              margin: '0 0 8px',
            }}
          >
            Installing developer tools safely...
          </h1>

          <p
            style={{
              fontSize: 14,
              color: C.textMuted,
              margin: 0,
            }}
          >
            These tools can be uninstalled anytime
          </p>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: C.textSecondary,
              }}
            >
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.accent,
              }}
            >
              {percentComplete}%
            </span>
          </div>

          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: C.border,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percentComplete}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${C.accent}, ${C.success})`,
                transition: 'width 0.5s ease-out',
              }}
            />
          </div>
        </div>

        {/* Current step info */}
        <div
          style={{
            padding: '20px',
            background: C.surface,
            borderRadius: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 12,
            }}
          >
            <StatusIndicator status={currentStep.status} size={24} />
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: C.text,
                }}
              >
                {currentToolInfo.friendly}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: C.accent,
                  marginTop: 2,
                }}
              >
                {currentStep.message || `Installing ${currentStep.name}...`}
              </div>
            </div>
          </div>

          <p
            style={{
              fontSize: 13,
              color: C.textSecondary,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {currentToolInfo.detail}
          </p>
        </div>

        {/* Expand/collapse details */}
        {allSteps.length > 0 && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 13,
                color: C.textSecondary,
                fontFamily: 'var(--kenoki-font)',
                marginBottom: 16,
              }}
            >
              <span>{showDetails ? 'Hide all steps' : 'Show all steps'}</span>
              <ChevronDownIcon size={14} rotated={showDetails} />
            </button>

            {/* All steps list */}
            {showDetails && (
              <div
                style={{
                  marginBottom: 20,
                  animation: 'installerSlideIn 0.2s ease-out',
                }}
              >
                {allSteps.map((step) => (
                  <StepRow
                    key={step.key}
                    step={step}
                    isExpanded={expandedSteps.has(step.key)}
                    onToggle={() => toggleStep(step.key)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Reassurance message */}
        <div
          style={{
            padding: '14px 18px',
            background: C.successBg,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ color: C.success, marginTop: 2 }}>
            <ShieldCheckIcon size={18} />
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.success,
                marginBottom: 4,
              }}
            >
              Safe & Removable
            </div>
            <p
              style={{
                fontSize: 12,
                color: C.textSecondary,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              All tools are installed to standard locations and can be completely removed from System Preferences or with a simple terminal command.
            </p>
          </div>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 500,
              color: C.textMuted,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 'var(--kenoki-radius-md, 14px)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'var(--kenoki-font)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = C.surface;
              (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = C.textMuted;
            }}
          >
            Cancel installation
          </button>
        )}
      </div>
    </div>
  );
}

export { InstallerReassurance };
