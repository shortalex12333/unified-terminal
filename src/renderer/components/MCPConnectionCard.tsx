import React, { useState } from 'react';

interface MCPConnectionCardProps {
  serverId: string;
  serverName: string;
  description: string;
  reason: string;
  onConnect: () => Promise<boolean>;
  onSkip: () => void;
}

const ICONS: Record<string, string> = {
  stripe: '💳',
  github: '🐙',
  vercel: '▲',
  supabase: '⚡',
  notion: '📝',
};

export default function MCPConnectionCard({
  serverId,
  serverName,
  description,
  reason,
  onConnect,
  onSkip,
}: MCPConnectionCardProps): React.ReactElement {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const success = await onConnect();
      if (!success) setError('Connection failed. Please try again.');
    } catch (e) {
      setError('An error occurred. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div style={{
      background: 'var(--kenoki-surface, #fff)',
      borderRadius: 'var(--kenoki-radius-lg, 16px)',
      padding: 24,
      boxShadow: 'var(--kenoki-shadow-md, 0 4px 12px rgba(0,0,0,0.1))',
      maxWidth: 400,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 32 }}>{ICONS[serverId] || '🔗'}</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--kenoki-text, #1d1d1f)' }}>
            Connect {serverName}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--kenoki-text-secondary, #666)' }}>
            {description}
          </p>
        </div>
      </div>

      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--kenoki-text, #1d1d1f)' }}>
        {reason}
      </p>

      {error && (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--kenoki-error, #ff3b30)' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            flex: 1,
            padding: '12px 20px',
            background: 'var(--kenoki-primary, #007aff)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--kenoki-radius-pill, 999px)',
            fontSize: 15,
            fontWeight: 500,
            cursor: connecting ? 'wait' : 'pointer',
            opacity: connecting ? 0.7 : 1,
          }}
        >
          {connecting ? 'Connecting...' : 'Connect ' + serverName}
        </button>
        <button
          onClick={onSkip}
          disabled={connecting}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            color: 'var(--kenoki-text-secondary, #666)',
            border: '1px solid var(--kenoki-border, #e5e5e5)',
            borderRadius: 'var(--kenoki-radius-pill, 999px)',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
