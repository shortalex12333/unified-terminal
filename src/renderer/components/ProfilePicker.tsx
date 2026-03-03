import React, { useState } from 'react';

export type Provider = 'chatgpt' | 'gemini' | 'claude';

interface ProviderProfile {
  id: Provider;
  name: string;
  description: string;
  color: string;
  logoUrl: string;
}

const PROVIDERS: ProviderProfile[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'OpenAI',
    color: '#10a37f',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google',
    color: '#4285f4',
    logoUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic',
    color: '#cc785c',
    logoUrl: 'https://anthropic.com/images/icons/apple-touch-icon.png',
  },
];

interface Props {
  onSelectProvider: (provider: Provider) => void;
}

export default function ProfilePicker({ onSelectProvider }: Props) {
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoError = (providerId: string) => {
    setLogoErrors(prev => ({ ...prev, [providerId]: true }));
  };

  const handleSelect = async (provider: Provider) => {
    setSelectedProvider(provider);
    setIsLoading(true);

    try {
      // All providers use BrowserView - just tell main process to load the provider
      const result = await window.electronAPI?.providerView?.show?.(provider);
      if (result?.success) {
        onSelectProvider(provider);
      } else {
        console.error('[ProfilePicker] Failed to show provider:', result?.error);
        setSelectedProvider(null);
      }
    } catch (err) {
      console.error('[ProfilePicker] Error:', err);
      setSelectedProvider(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">
          Choose your AI
        </h1>
        <p className="text-slate-500">
          Select a provider to get started
        </p>
      </div>

      {/* Provider cards */}
      <div className="flex gap-8">
        {PROVIDERS.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          const logoFailed = logoErrors[provider.id];

          return (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              disabled={isLoading}
              className={`
                group relative flex flex-col items-center p-8 bg-white rounded-2xl
                transition-all duration-300 cursor-pointer
                border-2 min-w-[180px]
                ${isSelected ? 'border-blue-500 shadow-xl scale-105' : 'border-transparent shadow-lg hover:shadow-xl hover:scale-105'}
                ${isLoading ? 'opacity-70' : ''}
                disabled:cursor-wait
              `}
            >
              {/* Logo */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 p-4"
                style={{ backgroundColor: `${provider.color}15` }}
              >
                {logoFailed ? (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                    style={{ backgroundColor: provider.color }}
                  >
                    {provider.name[0]}
                  </div>
                ) : (
                  <img
                    src={provider.logoUrl}
                    alt={provider.name}
                    className="w-12 h-12 object-contain"
                    onError={() => handleLogoError(provider.id)}
                  />
                )}
              </div>

              {/* Name */}
              <span className="text-lg font-medium text-slate-800 mb-1">
                {provider.name}
              </span>

              {/* Company */}
              <span className="text-sm text-slate-400">
                {provider.description}
              </span>

              {/* Loading spinner */}
              {isSelected && isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                  <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="mt-12 text-xs text-slate-400 max-w-md text-center">
        Each provider has its own login. Your conversations are kept separate.
      </p>
    </div>
  );
}
