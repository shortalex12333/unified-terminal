import React, { useState, useRef, useEffect } from 'react';

type Provider = 'codex' | 'claude-code' | 'gemini';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Props {
  provider: Provider;
  onBack: () => void;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  'codex': 'Codex',
  'claude-code': 'Claude',
  'gemini': 'Gemini',
};

export default function ChatInterface({ provider, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Listen for CLI output
    const cleanup = window.electronAPI?.cli?.onOutput?.((data: any) => {
      if (data.provider === provider) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && !data.done) {
            // Append to existing message
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + data.chunk }
            ];
          } else if (data.done) {
            setIsLoading(false);
            return prev;
          } else {
            // New assistant message
            return [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.chunk,
              timestamp: Date.now(),
            }];
          }
        });
      }
    });
    return cleanup;
  }, [provider]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      await window.electronAPI?.cli?.send?.(provider, userMessage.content);
    } catch (err) {
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${err}`,
        timestamp: Date.now(),
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#212121] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg"
        >
          ←
        </button>
        <span className="font-medium">{PROVIDER_NAMES[provider]}</span>
        {isLoading && <span className="text-white/40 text-sm">typing...</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-white/30 mt-20">
            Start a conversation with {PROVIDER_NAMES[provider]}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-[#10a37f] text-white'
                  : 'bg-[#2f2f2f] text-white/90'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2 bg-[#2f2f2f] rounded-xl p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="flex-1 bg-transparent resize-none outline-none px-2 py-1 text-sm max-h-32"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-[#10a37f] hover:bg-[#0d8a6a] disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
