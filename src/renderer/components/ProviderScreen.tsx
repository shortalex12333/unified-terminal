import React, { useState, useEffect } from 'react';

type Provider = 'codex' | 'claude-code' | 'gemini';

interface ProviderInfo {
  id: Provider;
  name: string;
  icon: string;
  description: string;
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'codex', name: 'OpenAI Codex', icon: '🤖', description: 'GPT-4 powered coding' },
  { id: 'claude-code', name: 'Claude Code', icon: '🧠', description: 'Anthropic Claude' },
  { id: 'gemini', name: 'Google Gemini', icon: '💎', description: 'Google AI' },
];

interface Props {
  onSelectProvider: (provider: Provider) => void;
}

export default function ProviderScreen({ onSelectProvider }: Props) {
  const [authStatus, setAuthStatus] = useState<Record<Provider, boolean>>({
    'codex': false,
    'claude-code': false,
    'gemini': false,
  });
  const [loading, setLoading] = useState<Provider | null>(null);

  useEffect(() => {
    checkAllAuth();
  }, []);

  const checkAllAuth = async () => {
    try {
      const statuses = await window.electronAPI?.auth?.checkAll?.() || [];
      const statusMap: Record<Provider, boolean> = {
        'codex': false,
        'claude-code': false,
        'gemini': false,
      };
      statuses.forEach((s: any) => {
        if (s.tool in statusMap) {
          statusMap[s.tool as Provider] = s.isAuthenticated;
        }
      });
      setAuthStatus(statusMap);
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const handleSignIn = async (provider: Provider) => {
    setLoading(provider);
    try {
      await window.electronAPI?.auth?.authenticate?.(provider);
      await checkAllAuth();
    } finally {
      setLoading(null);
    }
  };

  const handleSignOut = async (provider: Provider) => {
    setLoading(provider);
    try {
      await window.electronAPI?.auth?.signOut?.(provider);
      await checkAllAuth();
    } finally {
      setLoading(null);
    }
  };

  const handleSelect = (provider: Provider) => {
    if (authStatus[provider]) {
      onSelectProvider(provider);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#212121] text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-semibold mb-2">Choose Your AI</h1>
        <p className="text-white/50 mb-8">Sign in to get started</p>

        <div className="space-y-4 w-full max-w-sm">
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              className="bg-[#2f2f2f] rounded-xl p-4 flex items-center gap-4"
            >
              <span className="text-3xl">{p.icon}</span>

              <div className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-white/40">{p.description}</div>
              </div>

              <div className="flex gap-2">
                {authStatus[p.id] ? (
                  <>
                    <button
                      onClick={() => handleSignOut(p.id)}
                      className="px-3 py-1.5 text-sm text-white/50 hover:text-white"
                      disabled={loading === p.id}
                    >
                      Sign Out
                    </button>
                    <button
                      onClick={() => handleSelect(p.id)}
                      className="px-4 py-1.5 text-sm bg-[#10a37f] hover:bg-[#0d8a6a] rounded-lg font-medium"
                    >
                      Use
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSignIn(p.id)}
                    className="px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg"
                    disabled={loading === p.id}
                  >
                    {loading === p.id ? '...' : 'Sign In'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
