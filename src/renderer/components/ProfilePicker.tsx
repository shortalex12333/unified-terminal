/**
 * ProfilePicker Component
 *
 * Provider selection screen.
 * Matches prototype: docs/BRAND/MEDIA/PROTOTYPES/select_provider.png
 */

import React, { useState } from 'react';
import { ProviderState } from './App';

export type Provider = 'chatgpt' | 'claude';

interface ProviderProfile {
  id: Provider;
  name: string;
  color: string;
  icon: string;
}

const PROVIDERS: ProviderProfile[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    color: '#10a37f',
    icon: '⟡',
  },
  {
    id: 'claude',
    name: 'Claude',
    color: '#cc785c',
    icon: '✦',
  },
];

interface Props {
  onSelectProvider: (state: ProviderState) => void;
  initialPrompt?: string | null;
}

export default function ProfilePicker({ onSelectProvider, initialPrompt }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (provider: Provider) => {
    setSelectedProvider(provider);
    setIsLoading(true);

    try {
      const result = await window.electronAPI?.providerView?.show?.(provider);
      if (result?.success) {
        onSelectProvider({
          provider,
          providerType: 'browserview',
        });
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
    <div
      className="theme-light"
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--kenoki-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--kenoki-font)',
      }}
    >
      {/* Header */}
      <p
        style={{
          fontSize: 24,
          color: 'var(--kenoki-text)',
          margin: 0,
          marginBottom: initialPrompt ? 16 : 48,
        }}
      >
        Select your app, and{' '}
        <span style={{ color: 'var(--kenoki-accent)' }}>login</span>
      </p>

      {/* Show selected prompt if available */}
      {initialPrompt && (
        <div
          style={{
            maxWidth: 480,
            padding: '12px 20px',
            marginBottom: 32,
            background: 'var(--kenoki-surface)',
            borderRadius: 'var(--kenoki-radius-md)',
            border: '1px solid var(--kenoki-border)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text-muted)',
              margin: 0,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Your project
          </p>
          <p
            style={{
              fontSize: 14,
              fontWeight: 400,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text)',
              margin: 0,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {initialPrompt}
          </p>
        </div>
      )}

      {/* Provider cards */}
      <div style={{ display: 'flex', gap: 48 }}>
        {PROVIDERS.map((provider) => {
          const isSelected = selectedProvider === provider.id;

          return (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              disabled={isLoading}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading && !isSelected ? 0.5 : 1,
                transition: 'transform 0.15s, opacity 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Large icon card */}
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 'var(--kenoki-radius-lg)',
                  background: provider.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 64, color: 'white' }}>
                  {provider.icon}
                </span>

                {/* Loading spinner */}
                {isSelected && isLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 'var(--kenoki-radius-lg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Provider name */}
              <span
                style={{
                  fontSize: 18,
                  color: 'var(--kenoki-text)',
                }}
              >
                {provider.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
