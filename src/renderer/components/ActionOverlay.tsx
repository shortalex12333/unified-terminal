import React, { useState, useEffect } from 'react';

interface ActionData {
  type: 'mcp' | 'circuit';
  title: string;
  message: string;
  actions: Array<{
    label: string;
    action: string;
    primary?: boolean;
  }>;
  canSkip?: boolean;  // Only for HEURISTIC checks, not DEFINITIVE
}

interface ActionOverlayProps {
  onAction: (action: string) => void;
}

export default function ActionOverlay({ onAction }: ActionOverlayProps) {
  const [actionData, setActionData] = useState<ActionData | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.project?.onAction?.((data) => {
      setActionData(data);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  if (!actionData) return null;

  const handleAction = (action: string) => {
    onAction(action);
    setActionData(null);
  };

  return (
    <div className="action-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="action-modal" style={{
        background: 'var(--kenoki-surface)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 400,
        width: '90%',
      }}>
        {/* Icon based on type */}
        <div className="action-icon" style={{ fontSize: 32, marginBottom: 16 }}>
          {actionData.type === 'mcp' ? '🔌' : '⚠️'}
        </div>

        <h2 style={{ margin: '0 0 8px 0' }}>{actionData.title}</h2>
        <p style={{ margin: '0 0 24px 0', color: 'var(--kenoki-text-muted)' }}>
          {actionData.message}
        </p>

        <div className="action-buttons" style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
        }}>
          {actionData.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleAction(action.action)}
              className={action.primary ? 'primary' : 'secondary'}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: action.primary ? 'var(--kenoki-accent)' : 'var(--kenoki-surface-alt)',
                color: action.primary ? 'white' : 'inherit',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Note for skip option */}
        {actionData.canSkip && (
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--kenoki-text-muted)' }}>
            Skipping will continue without this feature.
          </p>
        )}
      </div>
    </div>
  );
}
