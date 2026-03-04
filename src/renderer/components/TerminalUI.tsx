import React, { useState, useEffect, useRef } from 'react';

interface Props {
  provider: 'gemini';
  processId: string;
  onSwitchAI: () => void;
}

export default function TerminalUI({ provider, processId, onSwitchAI }: Props) {
  const [output, setOutput] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Listen for CLI output chunks
  useEffect(() => {
    const cleanup = window.electronAPI?.cli?.onOutputChunk?.((data: { processId: string; chunk: string }) => {
      if (data.processId === processId) {
        setOutput(prev => prev + data.chunk);
        // Auto-scroll to bottom
        setTimeout(() => {
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }
        }, 0);
      }
    });

    return () => {
      cleanup?.();
    };
  }, [processId]);

  // Listen for CLI process exit
  useEffect(() => {
    const cleanup = window.electronAPI?.cli?.onProcessExit?.((data: { processId: string; exitCode: number }) => {
      if (data.processId === processId) {
        setIsLoading(false);
        if (data.exitCode !== 0) {
          setError(`Process exited with code ${data.exitCode}`);
        }
      }
    });

    return () => {
      cleanup?.();
    };
  }, [processId]);

  const handleSendInput = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await window.electronAPI?.cli?.send?.(provider, input);
      setInput('');
    } catch (err) {
      setError(`Failed to send input: ${String(err)}`);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0d1117] flex flex-col">
      {/* Terminal output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm text-green-400 whitespace-pre-wrap break-words"
        style={{ fontFamily: 'Menlo, Monaco, Courier New, monospace' }}
      >
        {output || (
          <div className="text-green-400/50">
            {provider.toUpperCase()} CLI initialized. Type a message to start...
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="px-4 py-3 bg-red-900/30 border-t border-red-700/50">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-white/10 bg-[#0d1117] p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 bg-[#161b22] text-green-400 placeholder-green-400/30 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-green-400/50 disabled:opacity-50"
          />
          <button
            onClick={handleSendInput}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Bottom navigation bar (56px) */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-[#1a1a1a] border-t border-white/10 flex items-center justify-between px-4 z-50">
        {/* Left: Current provider indicator */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-blue-600">
            G
          </div>
          <span className="text-white/70 text-sm">Gemini CLI</span>
        </div>

        {/* Center: Switch AI button */}
        <button
          onClick={onSwitchAI}
          className="flex items-center gap-2 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200"
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
    </div>
  );
}
