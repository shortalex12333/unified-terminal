/**
 * KenokiChat - Primary input interface for Kenoki
 *
 * Users type here. Messages go to Conductor → CLI tools.
 * No BrowserView, no ChatGPT DOM - this IS the interface.
 */

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'processing' | 'done' | 'error';
}

interface Props {
  initialPrompt?: string | null;
  onBack?: () => void;
}

export default function KenokiChat({ initialPrompt, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitial = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle initial prompt from template selection
  useEffect(() => {
    if (initialPrompt && !hasSentInitial.current) {
      hasSentInitial.current = true;
      handleSend(initialPrompt);
    }
  }, [initialPrompt]);

  // Subscribe to CLI output streams
  useEffect(() => {
    const api = (window as any).electronAPI;

    // Listen for conductor responses
    const unsubOutput = api?.conductor?.onOutput?.((data: {
      type: 'chunk' | 'complete' | 'error';
      content: string;
      stepId?: number;
    }) => {
      if (data.type === 'chunk') {
        // Append to last assistant message or create new one
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.status === 'processing') {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: m.content + data.content }
                : m
            );
          }
          return prev;
        });
      } else if (data.type === 'complete') {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, status: 'done' } : m
        ));
        setIsProcessing(false);
      } else if (data.type === 'error') {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: m.content + `\n\nError: ${data.content}`, status: 'error' }
            : m
        ));
        setIsProcessing(false);
      }
    });

    return () => {
      unsubOutput?.();
    };
  }, []);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isProcessing) return;

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      status: 'done',
    };

    // Add placeholder assistant message
    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'processing',
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // Send to conductor for classification and execution
      await (window as any).electronAPI?.conductor?.send?.(messageText);
    } catch (err) {
      console.error('[KenokiChat] Error sending to conductor:', err);
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, content: `Error: ${err}`, status: 'error' }
          : m
      ));
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1a1a1a',
      color: '#fff',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        background: '#222',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ←
            </button>
          )}
          <span style={{ fontWeight: 600, fontSize: 16 }}>Kenoki</span>
        </div>
        {isProcessing && (
          <span style={{ color: '#10b981', fontSize: 12 }}>
            Processing...
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>K</div>
            <div style={{ fontSize: 14 }}>What do you want to build?</div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: msg.role === 'user' ? '#2a2a2a' : '#1f1f1f',
                borderLeft: msg.role === 'user'
                  ? '3px solid #3b82f6'
                  : msg.status === 'error'
                    ? '3px solid #ef4444'
                    : '3px solid #10b981',
              }}
            >
              <div style={{
                fontSize: 11,
                color: '#666',
                marginBottom: 6,
              }}>
                {msg.role === 'user' ? 'You' : 'Kenoki'}
                {msg.status === 'processing' && ' (thinking...)'}
              </div>
              <div style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                fontFamily: msg.role === 'assistant'
                  ? 'ui-monospace, monospace'
                  : 'inherit',
                fontSize: 14,
              }}>
                {msg.content || (msg.status === 'processing' ? '...' : '')}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #333',
        background: '#222',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #444',
              background: '#1a1a1a',
              color: '#fff',
              fontSize: 14,
              resize: 'none',
              minHeight: 44,
              maxHeight: 120,
              fontFamily: 'inherit',
            }}
            rows={1}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isProcessing}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: input.trim() && !isProcessing ? '#3b82f6' : '#444',
              color: '#fff',
              cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
