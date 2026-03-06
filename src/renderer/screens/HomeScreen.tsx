/**
 * HomeScreen Component
 *
 * Initial screen for starting a new project.
 * User types project description and clicks Build.
 * Shows recent projects list (if any exist).
 *
 * Design: Simple centered input with large Build button
 */

import React, { useState, useEffect } from 'react';

interface RecentProject {
  id: string;
  name: string;
  status: 'in-progress' | 'completed';
  lastModified: string;
}

interface HomeScreenProps {
  onBuild: (prompt: string) => void;
  onOpenProject: (projectId: string) => void;
}

export default function HomeScreen({ onBuild, onOpenProject }: HomeScreenProps): React.ReactElement {
  const [prompt, setPrompt] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Scan for recent projects on mount
  useEffect(() => {
    // TODO: Wire to IPC to scan project folder
    // For now, empty list
    setRecentProjects([]);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onBuild(prompt.trim());
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
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Kenoki Logo */}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 400,
          fontFamily: "'Bumbbled', cursive",
          background: 'var(--kenoki-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
          marginBottom: 40,
        }}
      >
        KENOKI
      </h1>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <label
          style={{
            fontSize: 18,
            fontFamily: "'Eloquia Display', sans-serif",
            fontWeight: 300,
            color: 'var(--kenoki-text)',
            textAlign: 'center',
          }}
        >
          What do you want to build?
        </label>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., ecom store for street clothes"
          autoFocus
          style={{
            width: '100%',
            height: 48,
            padding: '0 20px',
            fontSize: 15,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text)',
            background: 'var(--kenoki-surface)',
            border: '2px solid var(--kenoki-border)',
            borderRadius: 'var(--kenoki-radius-pill)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--kenoki-primary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--kenoki-border)';
          }}
        />

        <button
          type="submit"
          disabled={!prompt.trim()}
          style={{
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 400,
            fontFamily: "'Poppins', sans-serif",
            color: '#ffffff',
            background: prompt.trim() ? 'var(--kenoki-primary)' : 'var(--kenoki-border)',
            border: 'none',
            borderRadius: 'var(--kenoki-radius-pill)',
            cursor: prompt.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, transform 0.1s',
          }}
          onMouseEnter={(e) => {
            if (prompt.trim()) {
              e.currentTarget.style.background = 'var(--kenoki-primary-hover)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = prompt.trim()
              ? 'var(--kenoki-primary)'
              : 'var(--kenoki-border)';
          }}
          onMouseDown={(e) => {
            if (prompt.trim()) {
              e.currentTarget.style.transform = 'scale(0.98)';
            }
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Build
        </button>
      </form>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div
          style={{
            marginTop: 48,
            width: '100%',
            maxWidth: 560,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              color: 'var(--kenoki-text-secondary)',
              marginBottom: 16,
            }}
          >
            Recent:
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {recentProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => onOpenProject(project.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--kenoki-surface)',
                  border: '1px solid var(--kenoki-border)',
                  borderRadius: 'var(--kenoki-radius-md)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kenoki-primary)';
                  e.currentTarget.style.background = 'var(--kenoki-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--kenoki-border)';
                  e.currentTarget.style.background = 'var(--kenoki-surface)';
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    color: project.status === 'in-progress' ? 'var(--kenoki-primary)' : 'var(--kenoki-success)',
                  }}
                >
                  {project.status === 'in-progress' ? '●' : '✓'}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                    color: 'var(--kenoki-text)',
                  }}
                >
                  {project.name}
                </span>
                {project.status === 'in-progress' && (
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "'Poppins', sans-serif",
                      color: 'var(--kenoki-text-muted)',
                    }}
                  >
                    (in progress)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
