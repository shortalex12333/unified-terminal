/**
 * ShowcaseScreen Component
 *
 * Displays a grid of template cards after the user clicks "Begin" on StartingScreen.
 * User can tap a card to pre-fill a prompt, or type their own custom prompt.
 *
 * Design Specs:
 * - Background: Kenoki light theme (#e7f0fd)
 * - Header: "What would you like to build?" in Eloquia Display
 * - Grid: 2 columns on mobile, 3 on larger screens
 * - Input: Bottom-aligned with pill radius
 */

import React, { useState, useRef, useEffect } from 'react';
import ShowcaseCard from './ShowcaseCard';
import { templates } from '../data/templates';

interface ShowcaseScreenProps {
  onSelectTemplate: (prompt: string) => void;
}

export default function ShowcaseScreen({ onSelectTemplate }: ShowcaseScreenProps): React.ReactElement {
  const [customPrompt, setCustomPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle card selection
  const handleCardSelect = (prompt: string) => {
    onSelectTemplate(prompt);
  };

  // Handle custom prompt submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onSelectTemplate(customPrompt.trim());
    }
  };

  // Handle keyboard shortcut (Cmd/Ctrl + Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div
      className="theme-light"
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'var(--kenoki-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 48,
        paddingBottom: 140,
        boxSizing: 'border-box',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 40,
          padding: '0 24px',
        }}
      >
        {/* Kenoki Logo - smaller version */}
        <h1
          style={{
            fontSize: 48,
            fontWeight: 400,
            fontFamily: "'Bumbbled', cursive",
            background: 'var(--kenoki-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            marginBottom: 24,
          }}
        >
          Kenoki
        </h1>

        {/* Main heading */}
        <h2
          style={{
            fontSize: 28,
            fontWeight: 300,
            fontFamily: "'Eloquia Display', sans-serif",
            color: 'var(--kenoki-text)',
            margin: 0,
            marginBottom: 12,
          }}
        >
          What would you like to build?
        </h2>

        {/* Subheading */}
        <p
          style={{
            fontSize: 15,
            fontWeight: 400,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text-secondary)',
            margin: 0,
          }}
        >
          Tap a card to get started, or type your own idea
        </p>
      </div>

      {/* Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          width: '100%',
          maxWidth: 960,
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        {/* CSS for responsive grid */}
        <style>{`
          @media (min-width: 768px) {
            .showcase-grid {
              grid-template-columns: repeat(3, 1fr) !important;
            }
          }
          @media (max-width: 767px) {
            .showcase-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 480px) {
            .showcase-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {templates.map((template) => (
          <ShowcaseCard
            key={template.id}
            template={template}
            onSelect={handleCardSelect}
          />
        ))}
      </div>

      {/* Bottom Input Area - Fixed at bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 24px',
          background: 'linear-gradient(to top, var(--kenoki-bg) 60%, transparent)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: 640,
            position: 'relative',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Or describe what you want to create..."
            style={{
              width: '100%',
              padding: '16px 56px 16px 20px',
              fontSize: 15,
              fontWeight: 400,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text)',
              background: 'var(--kenoki-surface)',
              border: `2px solid ${isFocused ? 'var(--kenoki-primary)' : 'var(--kenoki-border)'}`,
              borderRadius: 'var(--kenoki-radius-pill)',
              outline: 'none',
              boxShadow: isFocused
                ? '0px 4px 16px rgba(27, 112, 219, 0.15)'
                : 'var(--kenoki-shadow-light)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxSizing: 'border-box',
            }}
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={!customPrompt.trim()}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: customPrompt.trim() ? 'var(--kenoki-primary)' : 'var(--kenoki-border)',
              cursor: customPrompt.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              if (customPrompt.trim()) {
                e.currentTarget.style.background = 'var(--kenoki-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = customPrompt.trim()
                ? 'var(--kenoki-primary)'
                : 'var(--kenoki-border)';
            }}
            onMouseDown={(e) => {
              if (customPrompt.trim()) {
                e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={customPrompt.trim() ? 'white' : 'var(--kenoki-text-muted)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22,2 15,22 11,13 2,9" />
            </svg>
          </button>
        </form>
      </div>

      {/* Keyboard hint */}
      <div
        style={{
          position: 'fixed',
          bottom: 88,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 12,
          fontFamily: "'Poppins', sans-serif",
          color: 'var(--kenoki-text-muted)',
          opacity: customPrompt.trim() && isFocused ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        Press <kbd style={{
          padding: '2px 6px',
          background: 'var(--kenoki-surface)',
          borderRadius: 4,
          border: '1px solid var(--kenoki-border)',
          fontFamily: 'monospace',
        }}>Cmd</kbd> + <kbd style={{
          padding: '2px 6px',
          background: 'var(--kenoki-surface)',
          borderRadius: 4,
          border: '1px solid var(--kenoki-border)',
          fontFamily: 'monospace',
        }}>Enter</kbd> to submit
      </div>
    </div>
  );
}
