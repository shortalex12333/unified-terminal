/**
 * ShowcaseCard Component
 *
 * A tappable card that displays a template preview.
 * Shows title, description, estimated build time, and a gradient thumbnail.
 *
 * Design Specs:
 * - Card: White surface with subtle shadow
 * - Thumbnail: 64px icon area with gradient background
 * - Typography: Poppins for body, system font for labels
 * - Hover: Scale up slightly with enhanced shadow
 */

import React, { useState } from 'react';
import { Template, getCategoryLabel, getCategoryColor } from '../data/templates';

interface ShowcaseCardProps {
  template: Template;
  onSelect: (prompt: string) => void;
}

// SVG icons for each template type
const Icons: Record<string, React.ReactNode> = {
  cart: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  user: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  utensils: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  ),
  rocket: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  chart: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  palette: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
};

export default function ShowcaseCard({ template, onSelect }: ShowcaseCardProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    onSelect(template.starterPrompt);
  };

  const icon = Icons[template.thumbnail.icon] || Icons.rocket;

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: 0,
        background: 'var(--kenoki-surface)',
        border: 'none',
        borderRadius: 'var(--kenoki-radius-md)',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: isHovered
          ? '0px 12px 28px rgba(0, 0, 0, 0.12)'
          : 'var(--kenoki-shadow-light)',
        transform: isPressed ? 'scale(0.98)' : isHovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.15s ease-out, box-shadow 0.2s ease-out',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Thumbnail area with gradient and icon */}
      <div
        style={{
          width: '100%',
          height: 120,
          background: template.thumbnail.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          position: 'relative',
        }}
      >
        {icon}

        {/* Category badge */}
        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "'Poppins', sans-serif",
            color: 'white',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            padding: '4px 10px',
            borderRadius: 'var(--kenoki-radius-pill)',
          }}
        >
          {getCategoryLabel(template.category)}
        </span>
      </div>

      {/* Content area */}
      <div
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Title */}
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text)',
            lineHeight: 1.3,
          }}
        >
          {template.title}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text-secondary)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {template.description}
        </p>

        {/* Estimated time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--kenoki-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text-muted)',
            }}
          >
            {template.estimatedTime}
          </span>
        </div>
      </div>
    </button>
  );
}
