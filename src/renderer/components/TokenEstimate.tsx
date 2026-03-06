/**
 * TokenEstimate Component
 *
 * Pre-build estimate showing token/message usage for non-technical users.
 * Shows before build starts in plan review step.
 * Helps users understand cost/usage implications.
 *
 * Design: Friendly, non-alarming, with clear continue/cancel options.
 */

import React, { useState, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface TokenEstimateProps {
  /** Estimated number of steps in the build */
  estimatedSteps: number;
  /** Complexity level (affects token estimate) */
  complexity?: 'low' | 'medium' | 'high';
  /** User's plan type (affects messaging) */
  planType?: 'free' | 'plus' | 'pro' | 'team';
  /** Callback when user confirms */
  onContinue: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Whether the component is in a modal or inline */
  variant?: 'modal' | 'inline';
}

type UsageLevel = 'low' | 'moderate' | 'high' | 'very-high';

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-surface, #2B2B30)',
  bgSecondary: 'var(--kenoki-bg-secondary, #232327)',
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
  primary: 'var(--kenoki-primary, #1b70db)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// =============================================================================
// USAGE CALCULATION
// =============================================================================

interface UsageEstimate {
  percentOfDaily: number;
  messagesUsed: number;
  level: UsageLevel;
  color: string;
  bgColor: string;
  description: string;
}

function calculateUsage(
  steps: number,
  complexity: 'low' | 'medium' | 'high',
  planType: 'free' | 'plus' | 'pro' | 'team'
): UsageEstimate {
  // Base messages per step based on complexity
  const messagesPerStep = {
    low: 2,
    medium: 4,
    high: 7,
  };

  // Daily message limits by plan (approximate for ChatGPT)
  const dailyLimits = {
    free: 10,    // Very limited
    plus: 40,    // ~40 messages with GPT-4
    pro: 100,    // More generous
    team: 150,   // Team plans
  };

  const estimatedMessages = steps * messagesPerStep[complexity];
  const dailyLimit = dailyLimits[planType];
  const percentOfDaily = Math.min(100, Math.round((estimatedMessages / dailyLimit) * 100));

  let level: UsageLevel;
  let color: string;
  let bgColor: string;
  let description: string;

  if (percentOfDaily <= 25) {
    level = 'low';
    color = C.success;
    bgColor = C.successBg;
    description = 'A small portion of your daily messages';
  } else if (percentOfDaily <= 50) {
    level = 'moderate';
    color = C.accent;
    bgColor = C.accentSoft;
    description = 'A moderate portion of your daily messages';
  } else if (percentOfDaily <= 80) {
    level = 'high';
    color = C.warning;
    bgColor = C.warningBg;
    description = 'A significant portion of your daily messages';
  } else {
    level = 'very-high';
    color = C.error;
    bgColor = C.errorBg;
    description = 'Most of your daily messages';
  }

  return {
    percentOfDaily,
    messagesUsed: estimatedMessages,
    level,
    color,
    bgColor,
    description,
  };
}

// =============================================================================
// CSS ANIMATIONS
// =============================================================================

const tokenStyles = `
  @keyframes tokenModalIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes tokenOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes tokenGaugeIn {
    from { width: 0; }
  }
`;

// =============================================================================
// ICONS
// =============================================================================

const ZapIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const InfoIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="16" y2="12" />
    <line x1="12" x2="12.01" y1="8" y2="8" />
  </svg>
);

// =============================================================================
// GAUGE COMPONENT
// =============================================================================

interface GaugeProps {
  percent: number;
  color: string;
  bgColor: string;
}

function UsageGauge({ percent, color, bgColor }: GaugeProps): React.ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        borderRadius: 4,
        background: C.bgSecondary,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background gradient markers */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg,
            ${C.successBg} 0%, ${C.successBg} 25%,
            ${C.accentSoft} 25%, ${C.accentSoft} 50%,
            ${C.warningBg} 50%, ${C.warningBg} 80%,
            ${C.errorBg} 80%, ${C.errorBg} 100%)`,
          opacity: 0.5,
        }}
      />
      {/* Active fill */}
      <div
        style={{
          height: '100%',
          width: `${percent}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.8s ease-out',
          animation: 'tokenGaugeIn 0.8s ease-out',
        }}
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TokenEstimate({
  estimatedSteps,
  complexity = 'medium',
  planType = 'plus',
  onContinue,
  onCancel,
  variant = 'modal',
}: TokenEstimateProps): React.ReactElement {
  const [showDetails, setShowDetails] = useState(false);

  const usage = useMemo(
    () => calculateUsage(estimatedSteps, complexity, planType),
    [estimatedSteps, complexity, planType]
  );

  const content = (
    <div
      style={{
        background: variant === 'modal' ? C.bg : 'transparent',
        borderRadius: variant === 'modal' ? 'var(--kenoki-radius-lg, 22px)' : 0,
        padding: variant === 'modal' ? 24 : 0,
        maxWidth: 420,
        width: '100%',
        fontFamily: 'var(--kenoki-font)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: usage.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZapIcon size={22} color={usage.color} />
        </div>
        <div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: C.text,
              margin: 0,
            }}
          >
            Usage Estimate
          </h3>
          <p
            style={{
              fontSize: 13,
              color: C.textMuted,
              margin: '4px 0 0',
            }}
          >
            {estimatedSteps} steps in this build
          </p>
        </div>
      </div>

      {/* Main estimate display */}
      <div
        style={{
          padding: '20px',
          background: usage.bgColor,
          borderRadius: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: usage.color,
            }}
          >
            ~{usage.percentOfDaily}%
          </span>
          <span
            style={{
              fontSize: 14,
              color: C.textSecondary,
            }}
          >
            of your daily messages
          </span>
        </div>

        <UsageGauge
          percent={usage.percentOfDaily}
          color={usage.color}
          bgColor={usage.bgColor}
        />

        <p
          style={{
            fontSize: 14,
            color: C.textSecondary,
            margin: '12px 0 0',
            lineHeight: 1.5,
          }}
        >
          {usage.description}
        </p>
      </div>

      {/* Details toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          color: C.accent,
          fontFamily: 'var(--kenoki-font)',
          marginBottom: 16,
        }}
      >
        <InfoIcon size={14} color={C.accent} />
        <span>{showDetails ? 'Hide details' : 'How is this calculated?'}</span>
      </button>

      {/* Details section */}
      {showDetails && (
        <div
          style={{
            padding: '14px 16px',
            background: C.bgSecondary,
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 13,
            color: C.textSecondary,
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: '0 0 8px' }}>
            Each build step requires multiple AI messages to plan, execute, and verify.
          </p>
          <p style={{ margin: 0 }}>
            This build has <strong style={{ color: C.text }}>{estimatedSteps} steps</strong> at{' '}
            <strong style={{ color: C.text }}>{complexity}</strong> complexity, using approximately{' '}
            <strong style={{ color: C.text }}>{usage.messagesUsed} messages</strong>.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 12,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 500,
            color: C.textSecondary,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 'var(--kenoki-radius-md, 14px)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--kenoki-font)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = C.bgSecondary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          Cancel
        </button>
        <button
          onClick={onContinue}
          style={{
            flex: 1,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 500,
            color: '#FFFFFF',
            background: C.primary,
            border: 'none',
            borderRadius: 'var(--kenoki-radius-md, 14px)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--kenoki-font)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );

  // Return inline or modal based on variant
  if (variant === 'inline') {
    return (
      <>
        <style>{tokenStyles}</style>
        {content}
      </>
    );
  }

  // Modal variant
  return (
    <>
      <style>{tokenStyles}</style>

      {/* Overlay */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: C.overlay,
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          animation: 'tokenOverlayIn 0.2s ease-out',
        }}
      />

      {/* Modal container */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          animation: 'tokenModalIn 0.25s ease-out',
          width: '90%',
          maxWidth: 420,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-estimate-title"
      >
        {content}
      </div>
    </>
  );
}

export { TokenEstimate };
