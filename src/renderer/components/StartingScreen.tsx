/**
 * StartingScreen Component
 *
 * First screen user sees on app launch.
 * Shows Kenoki branding and "Begin" button.
 * Matches prototype: docs/BRAND/MEDIA/PROTOTYPES/starting_screen.png
 */

import React from 'react';

interface StartingScreenProps {
  onBegin: () => void;
}

export default function StartingScreen({ onBegin }: StartingScreenProps): React.ReactElement {
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
      {/* Kenoki Logo - Script font with gradient */}
      <h1
        style={{
          fontSize: 96,
          fontWeight: 400,
          fontStyle: 'italic',
          fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
          background: 'var(--kenoki-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
          marginBottom: 8,
        }}
      >
        Kenoki
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 20,
          color: 'var(--kenoki-text)',
          margin: 0,
          marginBottom: 40,
        }}
      >
        Do more, with Kenoki.
      </p>

      {/* Begin Button */}
      <button
        onClick={onBegin}
        style={{
          padding: '14px 48px',
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--kenoki-text)',
          background: 'var(--kenoki-accent)',
          border: 'none',
          borderRadius: 'var(--kenoki-radius-pill)',
          cursor: 'pointer',
          transition: 'background 0.15s, transform 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--kenoki-accent-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--kenoki-accent)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.98)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Begin
      </button>
    </div>
  );
}
