import React, { useState, useEffect, useCallback } from 'react';

interface CircuitBreakerState {
  visible: boolean;
  stepId: number;
  stepDetail: string;
  errorContext: string;
  actions: ('retry' | 'skip' | 'stop')[];
  suggested: 'retry' | 'skip' | 'stop';
}

const ACTION_LABELS: Record<string, string> = {
  retry: 'Retry',
  skip: 'Skip this step',
  stop: 'Stop execution',
};

const ACTION_COLORS: Record<string, string> = {
  retry: '#3b82f6',   // blue
  skip: '#f59e0b',    // amber
  stop: '#ef4444',    // red
};

export default function CircuitBreakerModal() {
  const [state, setState] = useState<CircuitBreakerState | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const cleanup = window.electronAPI?.onStepNeedsUser?.((options) => {
      setState({
        visible: true,
        stepId: (options.step as any).id,
        stepDetail: (options.step as any).detail || (options.step as any).action || 'Unknown step',
        errorContext: options.errorContext,
        actions: options.actions as ('retry' | 'skip' | 'stop')[],
        suggested: options.suggested as 'retry' | 'skip' | 'stop',
      });
    });

    return () => { cleanup?.(); };
  }, []);

  const handleDecision = useCallback(async (decision: 'retry' | 'skip' | 'stop') => {
    if (!state || sending) return;
    setSending(true);
    try {
      await window.electronAPI?.sendStepDecision?.(state.stepId, decision);
    } catch (err) {
      console.error('[CircuitBreakerModal] Failed to send decision:', err);
    }
    setState(null);
    setSending(false);
  }, [state, sending]);

  if (!state) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: '#1e1e1e', borderRadius: 8, padding: 24,
        maxWidth: 480, width: '90%', color: '#e0e0e0',
        border: '1px solid #333',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#ff6b6b' }}>
          Step Failed
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#aaa' }}>
          {state.stepDetail}
        </p>
        <pre style={{
          backgroundColor: '#111', padding: 12, borderRadius: 4,
          fontSize: 12, color: '#ff8a8a', overflow: 'auto',
          maxHeight: 120, margin: '0 0 16px', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {state.errorContext}
        </pre>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {state.actions.map((action) => (
            <button
              key={action}
              onClick={() => handleDecision(action)}
              disabled={sending}
              style={{
                padding: '8px 16px', borderRadius: 4, border: 'none',
                backgroundColor: action === state.suggested ? ACTION_COLORS[action] : '#333',
                color: '#fff', cursor: sending ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: action === state.suggested ? 600 : 400,
                opacity: sending ? 0.5 : 1,
              }}
            >
              {ACTION_LABELS[action] || action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
