/**
 * UndoButton Component
 *
 * Prominent "Undo Everything" button for completed builds.
 * Shows in BuildPanel when build is complete.
 * Clicking shows confirmation before running cleanup.
 *
 * Design: Reassuring, non-threatening, clear about what it does.
 */

import React, { useState, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface UndoButtonProps {
  /** Project directory path to undo */
  projectPath: string;
  /** Project name for display */
  projectName: string;
  /** Callback after successful undo */
  onUndoComplete?: () => void;
  /** Callback if undo fails */
  onUndoError?: (error: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

type UndoState = 'idle' | 'confirming' | 'undoing' | 'complete' | 'error';

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-surface, #2B2B30)',
  bgHover: 'var(--kenoki-bg-secondary, #232327)',
  border: 'var(--kenoki-border, #3A3A40)',
  text: 'var(--kenoki-text, #F4F4F4)',
  textSecondary: 'var(--kenoki-text-secondary, #CFCFD6)',
  textMuted: 'var(--kenoki-text-muted, #9A9AA3)',
  warning: 'var(--kenoki-warning, #F6C177)',
  warningBg: 'rgba(246, 193, 119, 0.12)',
  warningBorder: 'rgba(246, 193, 119, 0.25)',
  error: 'var(--kenoki-error, #F08A8A)',
  errorBg: 'rgba(240, 138, 138, 0.12)',
  success: 'var(--kenoki-success, #7ED9B5)',
  successBg: 'rgba(126, 217, 181, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

// =============================================================================
// SIZE CONFIG
// =============================================================================

const SIZE_CONFIG = {
  sm: { padding: '8px 16px', fontSize: 12, iconSize: 14, gap: 6 },
  md: { padding: '12px 24px', fontSize: 14, iconSize: 18, gap: 8 },
  lg: { padding: '14px 32px', fontSize: 16, iconSize: 20, gap: 10 },
};

// =============================================================================
// CSS ANIMATIONS
// =============================================================================

const undoStyles = `
  @keyframes undoSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }
  @keyframes undoModalIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes undoOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

// =============================================================================
// ICONS
// =============================================================================

const RotateCcwIcon = ({ size, spinning }: { size: number; spinning?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      animation: spinning ? 'undoSpin 1s linear infinite' : 'none',
    }}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const AlertTriangleIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" x2="12" y1="9" y2="13" />
    <line x1="12" x2="12.01" y1="17" y2="17" />
  </svg>
);

const CheckIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// =============================================================================
// CONFIRMATION MODAL
// =============================================================================

interface ConfirmModalProps {
  projectName: string;
  projectPath: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ projectName, projectPath, onConfirm, onCancel }: ConfirmModalProps): React.ReactElement {
  return (
    <>
      <style>{undoStyles}</style>

      {/* Overlay */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: C.overlay,
          backdropFilter: 'blur(4px)',
          zIndex: 200,
          animation: 'undoOverlayIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 400,
          background: C.bg,
          borderRadius: 'var(--kenoki-radius-lg, 22px)',
          boxShadow: 'var(--kenoki-shadow-dark, 0px 10px 30px rgba(0, 0, 0, 0.35))',
          padding: 24,
          zIndex: 201,
          animation: 'undoModalIn 0.25s ease-out',
          fontFamily: 'var(--kenoki-font)',
        }}
        role="alertdialog"
        aria-labelledby="undo-confirm-title"
        aria-describedby="undo-confirm-desc"
      >
        {/* Warning icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.warningBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.warning,
            margin: '0 auto 16px',
          }}
        >
          <AlertTriangleIcon size={28} />
        </div>

        {/* Title */}
        <h3
          id="undo-confirm-title"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: C.text,
            textAlign: 'center',
            margin: '0 0 8px',
          }}
        >
          Undo this build?
        </h3>

        {/* Description */}
        <p
          id="undo-confirm-desc"
          style={{
            fontSize: 14,
            color: C.textSecondary,
            textAlign: 'center',
            margin: '0 0 8px',
            lineHeight: 1.5,
          }}
        >
          This will delete all files created for{' '}
          <span style={{ fontWeight: 600, color: C.text }}>{projectName}</span>
        </p>

        {/* Path info */}
        <div
          style={{
            padding: '10px 14px',
            background: C.warningBg,
            border: `1px solid ${C.warningBorder}`,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: C.textMuted,
              margin: 0,
              wordBreak: 'break-all',
            }}
          >
            {projectPath}
          </p>
        </div>

        {/* Buttons */}
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
              padding: '12px 20px',
              fontSize: 14,
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
              (e.currentTarget as HTMLButtonElement).style.background = C.bgHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Keep files
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 500,
              color: '#1D1D1F',
              background: C.warning,
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
            Delete everything
          </button>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function UndoButton({
  projectPath,
  projectName,
  onUndoComplete,
  onUndoError,
  size = 'md',
}: UndoButtonProps): React.ReactElement {
  const [state, setState] = useState<UndoState>('idle');
  const [isHovered, setIsHovered] = useState(false);

  const config = SIZE_CONFIG[size];

  const handleClick = useCallback(() => {
    setState('confirming');
  }, []);

  const handleCancel = useCallback(() => {
    setState('idle');
  }, []);

  const handleConfirm = useCallback(async () => {
    setState('undoing');

    try {
      // Check if project is a git repository first
      const isGitRepo = await checkGitRepo(projectPath);

      if (isGitRepo) {
        // Use git reset --hard and git clean
        await runUndoCommand(`cd "${projectPath}" && git reset --hard HEAD~1 && git clean -fd`);
      } else {
        // Remove the entire project directory
        await runUndoCommand(`rm -rf "${projectPath}"`);
      }

      setState('complete');
      onUndoComplete?.();

      // Reset after showing success
      setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err) {
      setState('error');
      onUndoError?.(err instanceof Error ? err.message : 'Undo failed');

      // Reset after showing error
      setTimeout(() => {
        setState('idle');
      }, 3000);
    }
  }, [projectPath, onUndoComplete, onUndoError]);

  // Render based on state
  const renderButtonContent = () => {
    switch (state) {
      case 'undoing':
        return (
          <>
            <RotateCcwIcon size={config.iconSize} spinning />
            <span>Undoing...</span>
          </>
        );
      case 'complete':
        return (
          <>
            <CheckIcon size={config.iconSize} />
            <span>Undone</span>
          </>
        );
      case 'error':
        return (
          <>
            <AlertTriangleIcon size={config.iconSize} />
            <span>Failed</span>
          </>
        );
      default:
        return (
          <>
            <RotateCcwIcon size={config.iconSize} />
            <span>Undo Everything</span>
          </>
        );
    }
  };

  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: config.gap,
      padding: config.padding,
      fontSize: config.fontSize,
      fontWeight: 500,
      border: 'none',
      borderRadius: 'var(--kenoki-radius-md, 14px)',
      cursor: state === 'undoing' ? 'wait' : 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'var(--kenoki-font)',
    };

    switch (state) {
      case 'complete':
        return {
          ...baseStyles,
          background: C.successBg,
          color: C.success,
        };
      case 'error':
        return {
          ...baseStyles,
          background: C.errorBg,
          color: C.error,
        };
      case 'undoing':
        return {
          ...baseStyles,
          background: C.warningBg,
          color: C.warning,
        };
      default:
        return {
          ...baseStyles,
          background: isHovered ? C.bgHover : C.bg,
          color: C.textSecondary,
          border: `1px solid ${C.border}`,
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        };
    }
  };

  return (
    <>
      <style>{undoStyles}</style>

      <button
        onClick={handleClick}
        disabled={state === 'undoing' || state === 'complete'}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={getButtonStyles()}
        aria-label="Undo all changes from this build"
      >
        {renderButtonContent()}
      </button>

      {/* Confirmation Modal */}
      {state === 'confirming' && (
        <ConfirmModal
          projectName={projectName}
          projectPath={projectPath}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function checkGitRepo(path: string): Promise<boolean> {
  try {
    // This would use the Electron IPC to check if .git exists
    // For now, we'll assume the IPC bridge exists
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Placeholder: actual implementation would use IPC
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

async function runUndoCommand(command: string): Promise<void> {
  // This would use Electron IPC to run the command
  // For now, we'll simulate with a promise
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Placeholder: actual implementation would use IPC
      // window.electronAPI.shell.exec(command)
      setTimeout(resolve, 1000); // Simulate command execution
    } else {
      reject(new Error('Electron API not available'));
    }
  });
}

export { UndoButton };
