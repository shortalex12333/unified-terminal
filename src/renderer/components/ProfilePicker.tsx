import React, { useState, useEffect } from 'react';

export type Provider = 'chatgpt' | 'gemini' | 'claude';

interface ProviderProfile {
  id: Provider;
  name: string;
  color: string;
  icon: string;
}

const PROVIDERS: ProviderProfile[] = [
  { id: 'chatgpt', name: 'ChatGPT', color: '#10a37f', icon: '⬡' },
  { id: 'gemini', name: 'Gemini', color: '#4285f4', icon: '✦' },
  { id: 'claude', name: 'Claude', color: '#cc785c', icon: '◉' },
];

interface Props {
  onSelectProvider: (provider: Provider) => void;
}

export default function ProfilePicker({ onSelectProvider }: Props) {
  const [authStatus, setAuthStatus] = useState<Record<Provider, boolean>>({
    chatgpt: false,
    gemini: false,
    claude: false,
  });
  const [hoveredId, setHoveredId] = useState<Provider | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const statuses = await window.electronAPI?.auth?.checkAll?.() || [];
      const map: Record<Provider, boolean> = { chatgpt: false, gemini: false, claude: false };

      // Map CLI tools to providers
      statuses.forEach((s: any) => {
        if (s.tool === 'codex') map.chatgpt = s.isAuthenticated;
        if (s.tool === 'gemini') map.gemini = s.isAuthenticated;
        if (s.tool === 'claude-code') map.claude = s.isAuthenticated;
      });

      setAuthStatus(map);
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const handleSelect = async (provider: Provider) => {
    // If not authenticated, trigger auth flow first
    if (!authStatus[provider]) {
      const toolMap: Record<Provider, string> = {
        chatgpt: 'codex',
        gemini: 'gemini',
        claude: 'claude-code',
      };

      try {
        await window.electronAPI?.auth?.authenticate?.(toolMap[provider]);
        await checkAuth();
      } catch (err) {
        console.error('Auth failed:', err);
        return;
      }
    }

    onSelectProvider(provider);
  };

  return (
    <div className="h-screen w-screen bg-[#f8f9fa] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute top-20 left-20 w-12 h-12 border-4 border-[#34a853] rounded-lg rotate-12 opacity-60" />
      <div className="absolute top-32 right-32 w-8 h-8 bg-[#fbbc04] rounded-full opacity-60" />
      <div className="absolute bottom-40 left-32 w-6 h-6 bg-[#ea4335] rounded-full opacity-60" />
      <div className="absolute top-40 left-40 w-4 h-4 bg-[#4285f4] rounded-full opacity-60" />
      <div className="absolute bottom-32 right-40 w-10 h-10 border-4 border-[#4285f4] rotate-45 opacity-40" />
      <div className="absolute top-60 right-20 w-0 h-0 border-l-[20px] border-l-transparent border-b-[35px] border-b-[#34a853] border-r-[20px] border-r-transparent opacity-40" />

      {/* Main content */}
      <div className="z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#4285f4] via-[#34a853] to-[#fbbc04] rounded-2xl flex items-center justify-center mb-6 shadow-lg">
          <span className="text-white text-3xl font-bold">U</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-normal text-[#202124] mb-2">
          Choose your AI
        </h1>
        <p className="text-sm text-[#5f6368] mb-10 text-center max-w-md">
          Select an AI provider to start. Your conversations stay separate.
        </p>

        {/* Provider cards */}
        <div className="flex gap-6">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              onMouseEnter={() => setHoveredId(provider.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                flex flex-col items-center p-6 bg-white rounded-2xl
                transition-all duration-200 cursor-pointer
                ${hoveredId === provider.id ? 'shadow-xl scale-105' : 'shadow-md'}
                border border-gray-100 hover:border-gray-200
                min-w-[140px]
              `}
            >
              {/* Provider icon */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-white text-2xl"
                style={{ backgroundColor: provider.color }}
              >
                {provider.icon}
              </div>

              {/* Provider name */}
              <span className="text-sm font-medium text-[#202124]">
                {provider.name}
              </span>

              {/* Auth status indicator */}
              {authStatus[provider.id] && (
                <span className="text-xs text-[#34a853] mt-1">● Connected</span>
              )}
              {!authStatus[provider.id] && (
                <span className="text-xs text-[#5f6368] mt-1">Sign in</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center">
        <button className="flex items-center gap-2 px-4 py-2 text-sm text-[#1a73e8] hover:bg-[#e8f0fe] rounded-full transition-colors">
          <span className="w-5 h-5 bg-[#5f6368] rounded-full flex items-center justify-center text-white text-xs">?</span>
          Guest mode
        </button>

        <label className="flex items-center gap-2 text-sm text-[#5f6368] cursor-pointer">
          <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#1a73e8]" />
          Show on startup
        </label>
      </div>
    </div>
  );
}
