/**
 * FuelGauge Component
 *
 * Displays a fuel/resource gauge that shows remaining capacity.
 * Changes color based on percentage:
 * - Green (>50%): Healthy
 * - Yellow (20-50%): Caution
 * - Red (<20%): Warning
 */

import React, { useState, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface FuelGaugeProps {
  /** Current percentage (0-100) - if not provided, subscribes to statusAgent */
  percent?: number;
  /** Display label */
  label?: string;
  /** Detail text shown on hover */
  detail?: string;
  /** Whether in warning state */
  warning?: boolean;
  /** Warning text to display when in warning state */
  warningText?: string | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the label */
  showLabel?: boolean;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg)',
  border: 'var(--kenoki-accent-border)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  success: 'var(--kenoki-success)',
  warning: 'var(--kenoki-warning)',
  error: 'var(--kenoki-error)',
  errorSoft: 'var(--kenoki-error-soft)',
  accentSoft: 'rgba(75, 142, 232, 0.06)',
};

// =============================================================================
// SIZE CONFIG
// =============================================================================

const SIZE_CONFIG = {
  sm: { barWidth: 40, barHeight: 4, fontSize: 10, padding: '4px 8px', gap: 6 },
  md: { barWidth: 60, barHeight: 6, fontSize: 11, padding: '6px 12px', gap: 8 },
  lg: { barWidth: 80, barHeight: 8, fontSize: 13, padding: '8px 16px', gap: 10 },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FuelGauge({
  percent: propPercent,
  label: propLabel,
  detail: propDetail,
  warning: propWarning,
  warningText: propWarningText,
  size = 'md',
  showLabel = true,
}: FuelGaugeProps): React.ReactElement {
  // Internal state for subscribing to statusAgent
  const [internalFuel, setInternalFuel] = useState({
    percent: propPercent ?? 100,
    label: propLabel ?? 'Ready',
    detail: propDetail ?? '',
    warning: propWarning ?? false,
    warningText: propWarningText ?? null,
  });

  // Subscribe to fuel updates if no props provided
  useEffect(() => {
    if (propPercent !== undefined) return;

    const cleanup = window.electronAPI?.statusAgent?.onFuelUpdate?.((fuel) => {
      setInternalFuel({
        percent: fuel.percent,
        label: fuel.label,
        detail: fuel.detail,
        warning: fuel.warning,
        warningText: fuel.warningText,
      });
    });

    return () => {
      cleanup?.();
    };
  }, [propPercent]);

  // Use props if provided, otherwise use internal state
  const percent = propPercent ?? internalFuel.percent;
  const label = propLabel ?? internalFuel.label;
  const detail = propDetail ?? internalFuel.detail;
  const warning = propWarning ?? internalFuel.warning;
  const warningText = propWarningText ?? internalFuel.warningText;

  // Get color based on percentage
  const getColor = () => {
    if (percent > 50) return C.success;
    if (percent > 20) return C.warning;
    return C.error;
  };

  const config = SIZE_CONFIG[size];

  return (
    <div
      className="fuel-gauge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: config.gap,
        padding: config.padding,
        background: warning ? C.errorSoft : C.accentSoft,
        borderRadius: 12,
        transition: 'background 0.2s',
      }}
      title={detail || warningText || undefined}
    >
      {/* Fuel bar */}
      <div
        style={{
          width: config.barWidth,
          height: config.barHeight,
          borderRadius: config.barHeight / 2,
          background: C.border,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`,
            height: '100%',
            background: getColor(),
            borderRadius: config.barHeight / 2,
            transition: 'width 0.5s ease-out, background 0.3s',
          }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span
          style={{
            fontSize: config.fontSize,
            color: warning ? '#C45050' : C.textSub,
            whiteSpace: 'nowrap',
            transition: 'color 0.2s',
          }}
        >
          {label}
        </span>
      )}

      {/* Warning indicator */}
      {warning && (
        <span
          style={{
            fontSize: config.fontSize - 1,
            color: '#C45050',
            animation: 'fuelPulse 1.5s ease-in-out infinite',
          }}
        >
          !
        </span>
      )}

      <style>{`
        @keyframes fuelPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export { FuelGauge };
