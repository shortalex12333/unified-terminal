/**
 * StartingScreen Component
 *
 * First screen user sees on app launch.
 * Shows Kenoki branding and "Begin" button.
 *
 * Design Specs:
 * - Logo: Bumbbled Regular, gradient #e6c3df → #fcc5cb @135°
 * - Subheader: Eloquia Display Light, #1d1d1f
 * - Background: #e7f0fd
 * - Button: Poppins Regular, bg #1b70db, text #ffffff, pill radius
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
      }}
    >
      {/* Kenoki Logo - Bumbbled font with gradient */}
      <h1
        style={{
          fontSize: 96,
          fontWeight: 400,
          fontFamily: "'Bumbbled', cursive",
          background: 'var(--kenoki-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
          marginBottom: 16,
          paddingRight: 20,
        }}
      >
        Kenoki
      </h1>

      {/* Tagline - Eloquia Display Light */}
      <p
        style={{
          fontSize: 20,
          fontFamily: "'Eloquia Display', sans-serif",
          fontWeight: 300,
          color: '#1d1d1f',
          margin: 0,
          marginBottom: 40,
        }}
      >
        Do more, with Kenoki.
      </p>

      {/* Begin Button - Poppins Regular */}
      <button
        onClick={onBegin}
        style={{
          padding: '14px 48px',
          fontSize: 16,
          fontWeight: 400,
          fontFamily: "'Poppins', sans-serif",
          color: '#ffffff',
          background: 'var(--kenoki-primary)',
          border: 'none',
          borderRadius: 'var(--kenoki-radius-pill)',
          cursor: 'pointer',
          transition: 'background 0.15s, transform 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--kenoki-primary-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--kenoki-primary)';
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
