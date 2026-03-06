/**
 * TrustBadge Component
 *
 * Small, clickable badge showing "Your data stays on your device"
 * Clicking opens TrustModal with full privacy info.
 * Positioned in corner of main screens.
 *
 * Design: Subtle, reassuring presence for non-technical users.
 */

import React, { useState } from 'react';
import TrustModal from './TrustModal';

// =============================================================================
// TYPES
// =============================================================================

export interface TrustBadgeProps {
  /** Position of the badge */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Theme for the badge */
  theme?: 'light' | 'dark';
}

// =============================================================================
// COLORS
// =============================================================================

const LIGHT_COLORS = {
  bg: 'rgba(255, 255, 255, 0.9)',
  bgHover: 'rgba(255, 255, 255, 1)',
  border: 'rgba(0, 0, 0, 0.06)',
  text: '#4A4A4F',
  icon: '#7ED9B5',
};

const DARK_COLORS = {
  bg: 'rgba(43, 43, 48, 0.9)',
  bgHover: 'rgba(43, 43, 48, 1)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#CFCFD6',
  icon: '#7ED9B5',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TrustBadge({
  position = 'bottom-left',
  theme = 'light',
}: TrustBadgeProps): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const colors = theme === 'light' ? LIGHT_COLORS : DARK_COLORS;

  // Position mapping
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'bottom-right': { bottom: 16, right: 16 },
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'fixed',
          ...positionStyles[position],
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: isHovered ? colors.bgHover : colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 'var(--kenoki-radius-pill, 999px)',
          boxShadow: 'var(--kenoki-shadow-light, 0px 4px 12px rgba(0, 0, 0, 0.08))',
          cursor: 'pointer',
          transition: 'all 0.2s ease-out',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          fontFamily: 'var(--kenoki-font)',
        }}
        aria-label="View privacy and safety information"
      >
        {/* Lock icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.icon}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>

        {/* Badge text */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: colors.text,
            whiteSpace: 'nowrap',
          }}
        >
          Your data stays on your device
        </span>
      </button>

      {/* Trust Modal */}
      {isModalOpen && (
        <TrustModal
          theme={theme}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

export { TrustBadge };
