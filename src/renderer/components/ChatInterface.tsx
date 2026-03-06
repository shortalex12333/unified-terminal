import React, { useEffect, useRef } from 'react';

export type Provider = 'chatgpt' | 'gemini' | 'claude';

interface Props {
  provider: Provider;
  onLogout: () => void;
  initialPrompt?: string | null;
}

interface ProviderConfig {
  name: string;
  color: string;
  icon: string;
}

const PROVIDER_CONFIG: Record<Provider, ProviderConfig> = {
  chatgpt: {
    name: 'ChatGPT',
    color: '#10a37f',
    icon: 'C',
  },
  gemini: {
    name: 'Gemini',
    color: '#4285f4',
    icon: 'G',
  },
  claude: {
    name: 'Claude',
    color: '#cc785c',
    icon: 'C',
  },
};

/**
 * ChatInterface - Bottom navigation bar for BrowserView providers
 *
 * ALL providers (ChatGPT, Gemini, Claude) use BrowserView to load their official websites.
 * This component just shows a bottom nav bar with "Switch AI" button.
 * The BrowserView is sized to leave 56px at bottom for this bar.
 */
export default function ChatInterface({ provider, onLogout, initialPrompt }: Props) {
  const config = PROVIDER_CONFIG[provider];
  const hasSentInitialPrompt = useRef(false);

  console.log('[ChatInterface] Rendering nav bar for provider:', provider);

  // Auto-send initial prompt when chat loads
  useEffect(() => {
    if (initialPrompt && !hasSentInitialPrompt.current) {
      hasSentInitialPrompt.current = true;
      console.log('[ChatInterface] Auto-sending initial prompt:', initialPrompt.substring(0, 50) + '...');

      // Small delay to ensure BrowserView is ready, then inject and send
      const timer = setTimeout(async () => {
        try {
          // Wait for page to be ready
          const isReady = await window.electronAPI?.waitForPageReady?.(10000);
          if (isReady) {
            // Inject the prompt and trigger send
            const result = await window.electronAPI?.injectAndSend?.(initialPrompt);
            console.log('[ChatInterface] Inject and send result:', result);
          } else {
            console.warn('[ChatInterface] Page not ready after 10s, skipping auto-send');
          }
        } catch (err) {
          console.error('[ChatInterface] Error auto-sending prompt:', err);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [initialPrompt]);

  const handleSwitchAI = async () => {
    // Hide BrowserView before switching
    await window.electronAPI?.providerView?.hide?.();
    onLogout();
  };

  // Bottom navigation bar - BrowserView fills space above this
  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 bg-[#2a2a2a] border-t-2 border-blue-500 flex items-center justify-between px-4 z-[9999]">
      {/* Left: Current provider indicator */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: config.color }}
        >
          {config.icon}
        </div>
        <span className="text-white/70 text-sm">{config.name}</span>
      </div>

      {/* Center: Switch AI button */}
      <button
        onClick={handleSwitchAI}
        className="flex items-center gap-2 px-5 py-2 bg-white/10 hover:bg-white/20
                   rounded-full transition-all duration-200"
      >
        <svg
          className="w-4 h-4 text-white/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        <span className="text-sm font-medium text-white/90">Switch AI</span>
      </button>

      {/* Right: Empty space for balance */}
      <div className="w-24" />
    </div>
  );
}
