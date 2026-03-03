import React, { useState, useEffect } from 'react';

interface ToolAuth {
  tool: string;
  name: string;
  icon: string;
  status: 'checking' | 'authenticated' | 'needs-auth' | 'authenticating' | 'failed';
  error?: string;
}

const TOOLS: ToolAuth[] = [
  { tool: 'codex', name: 'OpenAI Codex', icon: '🤖', status: 'checking' },
  { tool: 'claude-code', name: 'Claude Code', icon: '🧠', status: 'checking' },
  { tool: 'gemini', name: 'Google Gemini', icon: '💎', status: 'checking' },
];

interface AuthScreenProps {
  onComplete: () => void;
}

export default function AuthScreen({ onComplete }: AuthScreenProps) {
  const [tools, setTools] = useState<ToolAuth[]>(TOOLS);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuthStatus();

    // Listen for auth progress events
    const cleanup = window.electronAPI?.auth?.onProgress?.((data: any) => {
      setTools(prev => prev.map(t =>
        t.tool === data.tool
          ? {
              ...t,
              status: data.status === 'authenticated' ? 'authenticated' :
                      data.status === 'authenticating' ? 'authenticating' :
                      data.status === 'failed' ? 'failed' : t.status,
              error: data.error
            }
          : t
      ));
    });

    return () => {
      // Cleanup listener if needed
    };
  }, []);

  const checkAuthStatus = async () => {
    setIsChecking(true);
    try {
      const statuses = await window.electronAPI?.auth?.checkAll?.() || [];

      setTools(prev => prev.map(t => {
        const status = statuses.find((s: any) => s.tool === t.tool);
        return {
          ...t,
          status: status?.isAuthenticated ? 'authenticated' : 'needs-auth',
        };
      }));

      // If all authenticated, move on
      if (statuses.length > 0 && statuses.every((s: any) => s.isAuthenticated)) {
        setTimeout(onComplete, 1000);
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleAuth = async (tool: string) => {
    setTools(prev => prev.map(t =>
      t.tool === tool ? { ...t, status: 'authenticating' as const } : t
    ));

    try {
      const result = await window.electronAPI?.auth?.authenticate?.(tool);
      const success = result?.success ?? false;

      setTools(prev => prev.map(t =>
        t.tool === tool
          ? { ...t, status: success ? 'authenticated' as const : 'failed' as const }
          : t
      ));

      // Recheck all statuses
      await checkAuthStatus();
    } catch (err) {
      setTools(prev => prev.map(t =>
        t.tool === tool
          ? { ...t, status: 'failed' as const, error: String(err) }
          : t
      ));
    }
  };

  const handleSkip = () => {
    const anyAuth = tools.some(t => t.status === 'authenticated');
    if (anyAuth) {
      onComplete();
    }
  };

  const authCount = tools.filter(t => t.status === 'authenticated').length;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Title bar area */}
      <div className="titlebar-drag h-12 flex items-center px-20 shrink-0 border-b border-white/5">
        <span className="text-sm font-semibold text-white/60 select-none">
          Sign In
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2 text-white">Connect Your Accounts</h2>
          <p className="text-sm text-white/50">
            Sign in to enable AI coding tools. You need at least one to continue.
          </p>
        </div>

        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.tool}
              className="flex items-center gap-4 px-4 py-4 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors"
            >
              {/* Icon */}
              <span className="text-2xl">{tool.icon}</span>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-white/90">{tool.name}</span>
                {tool.status === 'authenticated' && (
                  <span className="text-xs text-success">Connected</span>
                )}
                {tool.status === 'authenticating' && (
                  <span className="text-xs text-accent">Opening browser...</span>
                )}
                {tool.status === 'failed' && tool.error && (
                  <span className="text-xs text-danger truncate">{tool.error}</span>
                )}
              </div>

              {/* Status indicator */}
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                tool.status === 'authenticated' ? 'bg-success' :
                tool.status === 'authenticating' ? 'bg-accent animate-pulse' :
                tool.status === 'failed' ? 'bg-danger' :
                tool.status === 'checking' ? 'bg-white/20 animate-pulse' :
                'bg-white/10'
              }`} />

              {/* Action button */}
              {tool.status === 'authenticated' ? (
                <span className="text-xs font-medium text-success px-3 py-1.5 rounded-lg bg-success/10">
                  ✓
                </span>
              ) : tool.status === 'authenticating' || tool.status === 'checking' ? (
                <span className="text-xs text-white/30 px-3 py-1.5">...</span>
              ) : (
                <button
                  onClick={() => handleAuth(tool.tool)}
                  className="text-xs font-medium text-accent px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-6 pt-4 border-t border-white/5">
        {/* Progress bar */}
        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-accent to-success transition-all duration-500"
            style={{ width: `${(authCount / tools.length) * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-xs text-white/40">
            {authCount} of {tools.length} accounts connected
          </p>

          {authCount > 0 && (
            <button
              onClick={handleSkip}
              className="text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
