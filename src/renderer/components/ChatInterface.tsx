import React, { useState, useRef, useEffect } from 'react';

export type Provider = 'chatgpt' | 'gemini' | 'claude';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  provider: Provider;
  onLogout: () => void;
}

const PROVIDER_CONFIG: Record<Provider, { name: string; color: string; icon: string; cliTool: string }> = {
  chatgpt: { name: 'ChatGPT', color: '#10a37f', icon: '⬡', cliTool: 'codex' },
  gemini: { name: 'Gemini', color: '#4285f4', icon: '✦', cliTool: 'gemini' },
  claude: { name: 'Claude', color: '#cc785c', icon: '◉', cliTool: 'claude-code' },
};

export default function ChatInterface({ provider, onLogout }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const config = PROVIDER_CONFIG[provider];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Listen for CLI output
    const cleanup = window.electronAPI?.cli?.onOutput?.((data) => {
      if (data.done) {
        setIsLoading(false);
        return;
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data.chunk }
          ];
        }
        return [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.chunk,
        }];
      });
    });
    return cleanup;
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      await window.electronAPI?.cli?.send?.(config.cliTool, userMsg.content);
    } catch (err) {
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${err}`,
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSignOut = async () => {
    try {
      await window.electronAPI?.auth?.signOut?.(config.cliTool);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
    onLogout();
  };

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: '#212121' }}>
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
            style={{ backgroundColor: config.color }}
          >
            {config.icon}
          </div>
          <span className="text-white font-medium">{config.name}</span>
          {isLoading && (
            <span className="text-white/40 text-sm animate-pulse">typing...</span>
          )}
        </div>

        {/* Profile menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-80"
            style={{ backgroundColor: config.color }}
          >
            {config.icon}
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 bg-[#2f2f2f] rounded-lg shadow-xl border border-white/10 py-2 min-w-[160px] z-50">
                <div className="px-4 py-2 border-b border-white/10">
                  <div className="text-sm text-white">{config.name}</div>
                  <div className="text-xs text-white/40">Connected</div>
                </div>
                <button
                  onClick={() => { setShowMenu(false); onLogout(); }}
                  className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Switch AI
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4"
              style={{ backgroundColor: config.color + '20', color: config.color }}
            >
              {config.icon}
            </div>
            <p className="text-lg mb-1">How can I help you today?</p>
            <p className="text-sm text-white/20">Start a conversation with {config.name}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-8 px-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 mb-6 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shrink-0"
                    style={{ backgroundColor: config.color }}
                  >
                    {config.icon}
                  </div>
                )}

                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-[#2f2f2f] text-white ml-auto'
                      : 'bg-transparent text-white/90'
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {msg.content}
                  </pre>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#5c5c5c] flex items-center justify-center text-white text-sm shrink-0">
                    U
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-[#2f2f2f] rounded-2xl p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${config.name}...`}
              className="flex-1 bg-transparent resize-none outline-none text-white text-sm max-h-32 min-h-[24px]"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 transition-opacity"
              style={{ backgroundColor: input.trim() ? config.color : 'transparent' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-white/20 text-center mt-2">
            {config.name} may produce inaccurate information.
          </p>
        </div>
      </div>
    </div>
  );
}
