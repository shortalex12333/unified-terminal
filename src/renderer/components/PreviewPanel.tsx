/**
 * PreviewPanel Component
 *
 * Live preview panel for dev servers.
 * Shows real-time preview of websites being built.
 * Supports auto-detection of running dev servers and hot-reload.
 */

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type PreviewState = 'idle' | 'detecting' | 'loading' | 'ready' | 'error';

export interface PreviewConfig {
  url: string;
  port: number;
  visible: boolean;
  autoRefresh: boolean;
  refreshDebounce: number;
}

export interface PreviewPanelProps {
  /** Initial URL to preview */
  initialUrl?: string;
  /** Callback when preview state changes */
  onStateChange?: (state: PreviewState) => void;
  /** Callback when preview URL changes */
  onUrlChange?: (url: string) => void;
  /** Custom class name */
  className?: string;
  /** Whether panel is active (visible in tab) */
  isActive?: boolean;
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'var(--kenoki-bg)',
  surface: 'var(--kenoki-surface)',
  border: 'var(--kenoki-accent-border)',
  accent: 'var(--kenoki-accent)',
  accentSoft: 'var(--kenoki-accent-soft)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  success: 'var(--kenoki-success)',
  error: 'var(--kenoki-error)',
  errorSoft: 'var(--kenoki-error-soft)',
};

// =============================================================================
// CSS ANIMATIONS
// =============================================================================

const globalStyles = `
  @keyframes previewPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
  @keyframes previewSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes previewFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// =============================================================================
// ICONS
// =============================================================================

function RefreshIcon({ size = 16, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
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
        animation: spinning ? 'previewSpin 1s linear infinite' : undefined,
      }}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ServerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function AlertCircleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckCircleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PreviewPanel({
  initialUrl,
  onStateChange,
  onUrlChange,
  className,
  isActive = true,
}: PreviewPanelProps): React.ReactElement {
  // State
  const [state, setState] = useState<PreviewState>('idle');
  const [url, setUrl] = useState(initialUrl || '');
  const [port, setPort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [config, setConfig] = useState<PreviewConfig | null>(null);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Notify parent of URL changes
  useEffect(() => {
    if (url) {
      onUrlChange?.(url);
    }
  }, [url, onUrlChange]);

  // Subscribe to preview events
  useEffect(() => {
    if (!window.electronAPI?.preview) return;

    const cleanupShown = window.electronAPI.preview.onShown?.((data) => {
      setUrl(data.url);
      setPort(data.port);
      setState('ready');
      setError(null);
    });

    const cleanupHidden = window.electronAPI.preview.onHidden?.(() => {
      setState('idle');
    });

    const cleanupLoaded = window.electronAPI.preview.onLoaded?.((data) => {
      setState('ready');
      setIsRefreshing(false);
    });

    const cleanupError = window.electronAPI.preview.onLoadError?.((data) => {
      setState('error');
      setError(`Failed to load: ${data.errorDescription}`);
      setIsRefreshing(false);
    });

    const cleanupRefreshed = window.electronAPI.preview.onRefreshed?.(() => {
      setIsRefreshing(false);
    });

    return () => {
      cleanupShown?.();
      cleanupHidden?.();
      cleanupLoaded?.();
      cleanupError?.();
      cleanupRefreshed?.();
    };
  }, []);

  // Load initial config
  useEffect(() => {
    const loadConfig = async () => {
      if (!window.electronAPI?.preview) return;
      const cfg = await window.electronAPI.preview.getConfig();
      setConfig(cfg);
      setAutoRefresh(cfg.autoRefresh);
      if (cfg.visible && cfg.url) {
        setUrl(cfg.url);
        setPort(cfg.port);
        setState('ready');
      }
    };
    loadConfig();
  }, []);

  // Auto-detect server when panel becomes active and no URL set
  useEffect(() => {
    if (isActive && !url && state === 'idle') {
      handleDetectServer();
    }
  }, [isActive]);

  // Handlers
  const handleDetectServer = useCallback(async () => {
    if (!window.electronAPI?.preview) return;

    setState('detecting');
    setError(null);

    try {
      const result = await window.electronAPI.preview.detectServer();

      if (result.found && result.url) {
        setUrl(result.url);
        setPort(result.port || null);
        setState('loading');

        // Show the preview
        const showResult = await window.electronAPI.preview.show(result.url);
        if (!showResult.success) {
          setState('error');
          setError(showResult.error || 'Failed to show preview');
        }
      } else {
        setState('idle');
        setError(`No dev server found. Checked ports: ${result.checkedPorts.join(', ')}`);
      }
    } catch (err) {
      setState('error');
      setError(String(err));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!window.electronAPI?.preview || state !== 'ready') return;

    setIsRefreshing(true);
    await window.electronAPI.preview.refresh();
  }, [state]);

  const handleShowPreview = useCallback(async (previewUrl: string) => {
    if (!window.electronAPI?.preview) return;

    setState('loading');
    setError(null);
    setUrl(previewUrl);

    const result = await window.electronAPI.preview.show(previewUrl);
    if (!result.success) {
      setState('error');
      setError(result.error || 'Failed to show preview');
    }
  }, []);

  const handleHidePreview = useCallback(async () => {
    if (!window.electronAPI?.preview) return;
    await window.electronAPI.preview.hide();
    setState('idle');
    setUrl('');
    setPort(null);
  }, []);

  const handleToggleAutoRefresh = useCallback(async () => {
    if (!window.electronAPI?.preview) return;
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    await window.electronAPI.preview.setAutoRefresh(newValue);
  }, [autoRefresh]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('previewUrl') as HTMLInputElement;
    if (input.value) {
      handleShowPreview(input.value);
    }
  }, [handleShowPreview]);

  // Render idle state
  if (state === 'idle' && !error) {
    return (
      <div
        className={`preview-panel theme-dark ${className ?? ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 32,
          background: C.bg,
          animation: 'previewFadeIn 0.3s ease-out',
        }}
      >
        <style>{globalStyles}</style>

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: C.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            color: C.accent,
          }}
        >
          <ServerIcon size={28} />
        </div>

        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Live Preview
        </h3>

        <p style={{ margin: 0, fontSize: 14, color: C.textSub, textAlign: 'center', marginBottom: 24, maxWidth: 280 }}>
          Preview your website as it builds. Auto-detects dev servers on common ports.
        </p>

        <button
          onClick={handleDetectServer}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderRadius: 10,
            border: 'none',
            background: C.accent,
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: 16,
          }}
        >
          <SearchIcon size={16} />
          Detect Dev Server
        </button>

        <form onSubmit={handleUrlSubmit} style={{ width: '100%', maxWidth: 300 }}>
          <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 8, textAlign: 'center' }}>
            Or enter URL manually:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              name="previewUrl"
              placeholder="http://localhost:3000"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Go
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Render detecting state
  if (state === 'detecting') {
    return (
      <div
        className={`preview-panel theme-dark ${className ?? ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 32,
          background: C.bg,
        }}
      >
        <style>{globalStyles}</style>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            color: C.accent,
            animation: 'previewPulse 1.5s ease-in-out infinite',
          }}
        >
          <SearchIcon size={24} />
        </div>

        <p style={{ margin: 0, fontSize: 14, color: C.textSub }}>
          Detecting dev server...
        </p>

        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.textFaint }}>
          Checking ports 3000, 5173, 8080, 4000...
        </p>
      </div>
    );
  }

  // Render loading state
  if (state === 'loading') {
    return (
      <div
        className={`preview-panel theme-dark ${className ?? ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 32,
          background: C.bg,
        }}
      >
        <style>{globalStyles}</style>

        <div
          style={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            color: C.accent,
          }}
        >
          <RefreshIcon size={28} spinning />
        </div>

        <p style={{ margin: 0, fontSize: 14, color: C.textSub }}>
          Loading preview...
        </p>

        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.textFaint, fontFamily: 'monospace' }}>
          {url}
        </p>
      </div>
    );
  }

  // Render error state
  if (state === 'error' || error) {
    return (
      <div
        className={`preview-panel theme-dark ${className ?? ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 32,
          background: C.bg,
        }}
      >
        <style>{globalStyles}</style>

        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.errorSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            color: C.error,
          }}
        >
          <AlertCircleIcon size={28} />
        </div>

        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Preview Error
        </h4>

        <p style={{ margin: 0, fontSize: 13, color: C.textSub, textAlign: 'center', maxWidth: 300, marginBottom: 20 }}>
          {error || 'Failed to load preview'}
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleDetectServer}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: C.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Try Again
          </button>

          <button
            onClick={() => {
              setState('idle');
              setError(null);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.textSub,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Render ready state (preview is showing)
  return (
    <div
      className={`preview-panel theme-dark ${className ?? ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: C.bg,
      }}
    >
      <style>{globalStyles}</style>

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        {/* Status indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: state === 'ready' ? C.success : C.accent,
          }}
        />

        {/* URL display */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: C.textFaint,
              marginBottom: 2,
            }}
          >
            {port ? `Port ${port}` : 'Preview'}
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.text,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {url}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Auto-refresh toggle */}
          <button
            onClick={handleToggleAutoRefresh}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${autoRefresh ? C.accent : C.border}`,
              background: autoRefresh ? C.accentSoft : 'transparent',
              color: autoRefresh ? C.accent : C.textFaint,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              fontSize: 14,
            }}
          >
            A
          </button>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh preview"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.textSub,
              cursor: isRefreshing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              opacity: isRefreshing ? 0.5 : 1,
            }}
          >
            <RefreshIcon size={14} spinning={isRefreshing} />
          </button>

          {/* Open in browser */}
          <button
            onClick={() => window.electronAPI?.shell?.openExternal(url)}
            title="Open in browser"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.textSub,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <ExternalLinkIcon />
          </button>

          {/* Close preview */}
          <button
            onClick={handleHidePreview}
            title="Close preview"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.textSub,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              fontSize: 16,
            }}
          >
            x
          </button>
        </div>
      </div>

      {/* Preview info area (BrowserView shows preview, this is just metadata) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(126, 217, 181, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            color: C.success,
          }}
        >
          <CheckCircleIcon size={24} />
        </div>

        <p style={{ margin: 0, fontSize: 14, color: C.textSub, textAlign: 'center' }}>
          Preview is showing in the right panel
        </p>

        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.textFaint, textAlign: 'center' }}>
          {autoRefresh ? 'Auto-refresh is enabled - changes will reload automatically' : 'Auto-refresh is disabled'}
        </p>
      </div>
    </div>
  );
}

export { PreviewPanel };
