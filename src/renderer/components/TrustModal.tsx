/**
 * TrustModal Component
 *
 * Modal with privacy/safety information for non-technical users.
 * Shows reassuring information about:
 * - Conversations staying in ChatGPT
 * - Local tool installation with easy removal
 * - Full undo history for projects
 * - User control over builds
 *
 * Design: Clean, friendly, icon-driven layout.
 */

import React, { useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface TrustModalProps {
  /** Theme for the modal */
  theme?: 'light' | 'dark';
  /** Callback when modal is closed */
  onClose: () => void;
}

interface TrustItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// =============================================================================
// COLORS
// =============================================================================

const LIGHT_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.4)',
  bg: '#FFFFFF',
  border: '#E4E4E7',
  text: '#1D1D1F',
  textSecondary: '#4A4A4F',
  textMuted: '#8A8A93',
  iconBg: 'rgba(126, 217, 181, 0.12)',
  iconColor: '#5BBB9A',
  buttonBg: 'var(--kenoki-primary, #1b70db)',
  buttonText: '#FFFFFF',
  divider: 'rgba(0, 0, 0, 0.06)',
};

const DARK_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.6)',
  bg: '#2B2B30',
  border: '#3A3A40',
  text: '#F4F4F4',
  textSecondary: '#CFCFD6',
  textMuted: '#9A9AA3',
  iconBg: 'rgba(126, 217, 181, 0.15)',
  iconColor: '#7ED9B5',
  buttonBg: 'var(--kenoki-accent, #ACCBEE)',
  buttonText: '#1D1D1F',
  divider: 'rgba(255, 255, 255, 0.08)',
};

// =============================================================================
// ICONS
// =============================================================================

const ShieldIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const HardDriveIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" x2="2" y1="12" y2="12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    <line x1="6" x2="6.01" y1="16" y2="16" />
    <line x1="10" x2="10.01" y1="16" y2="16" />
  </svg>
);

const RotateCcwIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const CheckCircleIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

// =============================================================================
// CSS ANIMATIONS
// =============================================================================

const modalStyles = `
  @keyframes trustModalOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes trustModalSlideIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
`;

// =============================================================================
// TRUST ITEMS
// =============================================================================

const TRUST_ITEMS: TrustItem[] = [
  {
    icon: <ShieldIcon color="currentColor" />,
    title: 'Your conversations stay in ChatGPT',
    description: 'We never read, store, or transmit your chat messages. Everything you type goes directly to ChatGPT.',
  },
  {
    icon: <HardDriveIcon color="currentColor" />,
    title: 'All tools are installed locally',
    description: 'Developer tools run on your computer and can be completely removed anytime from System Preferences.',
  },
  {
    icon: <RotateCcwIcon color="currentColor" />,
    title: 'Full undo history for every project',
    description: 'Every change is saved with version history. You can always go back to any previous state.',
  },
  {
    icon: <CheckCircleIcon color="currentColor" />,
    title: 'Nothing runs without your approval',
    description: 'You see and approve every step before it happens. No surprises, no unexpected changes.',
  },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TrustModal({
  theme = 'light',
  onClose,
}: TrustModalProps): React.ReactElement {
  const colors = theme === 'light' ? LIGHT_COLORS : DARK_COLORS;

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      <style>{modalStyles}</style>

      {/* Overlay */}
      <div
        onClick={handleOverlayClick}
        style={{
          position: 'fixed',
          inset: 0,
          background: colors.overlay,
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          animation: 'trustModalOverlayIn 0.2s ease-out',
        }}
      >
        {/* Modal */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 480,
            background: colors.bg,
            borderRadius: 'var(--kenoki-radius-lg, 22px)',
            boxShadow: 'var(--kenoki-shadow-dark, 0px 10px 30px rgba(0, 0, 0, 0.25))',
            overflow: 'hidden',
            animation: 'trustModalSlideIn 0.25s ease-out',
            fontFamily: 'var(--kenoki-font)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trust-modal-title"
        >
          {/* Header */}
          <div
            style={{
              padding: '24px 28px 20px',
              borderBottom: `1px solid ${colors.divider}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: colors.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.iconColor,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2
                  id="trust-modal-title"
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: colors.text,
                    margin: 0,
                  }}
                >
                  Your Privacy & Safety
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: colors.textMuted,
                    margin: '4px 0 0',
                  }}
                >
                  Built with trust in mind
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              padding: '20px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {TRUST_ITEMS.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: colors.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.iconColor,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.text,
                      margin: 0,
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      margin: '6px 0 0',
                      lineHeight: 1.5,
                    }}
                  >
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 28px 24px',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '12px 32px',
                fontSize: 15,
                fontWeight: 500,
                color: colors.buttonText,
                background: colors.buttonBg,
                border: 'none',
                borderRadius: 'var(--kenoki-radius-md, 14px)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--kenoki-font)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export { TrustModal };
