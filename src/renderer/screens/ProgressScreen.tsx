/**
 * ProgressScreen Component
 *
 * Shows build progress with:
 * - Phase tree (done/active/pending states)
 * - Files created list with Open/Preview buttons
 * - Progress bar with percentage
 * - Status message
 * - Pause/Cancel buttons
 *
 * Subscribes to IPC channels:
 * - project:update (status messages)
 * - project:progress (phase updates)
 * - project:file (new files)
 */

import React, { useState, useEffect } from 'react';

interface Phase {
  name: string;
  status: 'done' | 'active' | 'pending';
}

interface FileItem {
  name: string;
  path: string;
  canPreview: boolean;
  canOpen: boolean;
}

interface ProgressScreenProps {
  projectName: string;
  onPause?: () => void;
  onCancel?: () => void;
}

export default function ProgressScreen({
  projectName,
  onPause,
  onCancel,
}: ProgressScreenProps): React.ReactElement {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [statusMessage, setStatusMessage] = useState('Starting...');
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // Subscribe to IPC channels
    const unsubUpdate = window.electronAPI?.project?.onUpdate?.((data) => {
      setStatusMessage(data.message);
    });

    const unsubProgress = window.electronAPI?.project?.onProgress?.((data) => {
      setPhases(data.phases);
      // Calculate percentage
      const done = data.phases.filter((p) => p.status === 'done').length;
      setPercentage(Math.round((done / data.phases.length) * 100));
    });

    const unsubFile = window.electronAPI?.project?.onFile?.((data) => {
      setFiles((prev) => [...prev, data]);
    });

    return () => {
      unsubUpdate?.();
      unsubProgress?.();
      unsubFile?.();
    };
  }, []);

  const handleOpenFile = (path: string) => {
    window.electronAPI?.project?.openFile?.(path);
  };

  const handlePreviewFile = (path: string) => {
    // TODO: Open preview panel
    console.log('Preview:', path);
  };

  return (
    <div
      className="theme-dark"
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--kenoki-surface)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px',
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 32,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text)',
            margin: 0,
            marginBottom: 8,
          }}
        >
          Building: {projectName}
        </h1>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: 8,
            background: 'var(--kenoki-border)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              background: 'var(--kenoki-primary)',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>

        <span
          style={{
            fontSize: 14,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text-secondary)',
          }}
        >
          {percentage}%
        </span>
      </div>

      {/* Phase tree */}
      {phases.length > 0 && (
        <div
          style={{
            marginBottom: 32,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 16,
            }}
          >
            Phases
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {phases.map((phase, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    color:
                      phase.status === 'done'
                        ? 'var(--kenoki-success)'
                        : phase.status === 'active'
                          ? 'var(--kenoki-primary)'
                          : 'var(--kenoki-text-muted)',
                  }}
                >
                  {phase.status === 'done' ? '✓' : phase.status === 'active' ? '●' : '○'}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                    color:
                      phase.status === 'pending' ? 'var(--kenoki-text-muted)' : 'var(--kenoki-text)',
                    fontWeight: phase.status === 'active' ? 600 : 400,
                  }}
                >
                  {phase.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status message */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--kenoki-surface-hover)',
          border: '1px solid var(--kenoki-border)',
          borderRadius: 'var(--kenoki-radius-md)',
          marginBottom: 32,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text-secondary)',
            fontStyle: 'italic',
          }}
        >
          {statusMessage}
        </span>
      </div>

      {/* Files created */}
      {files.length > 0 && (
        <div
          style={{
            marginBottom: 32,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 16,
            }}
          >
            Files created
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {files.map((file, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--kenoki-surface-hover)',
                  border: '1px solid var(--kenoki-border)',
                  borderRadius: 'var(--kenoki-radius-md)',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                    color: 'var(--kenoki-text)',
                  }}
                >
                  {file.name}
                </span>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => handleOpenFile(file.path)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: "'Poppins', sans-serif",
                      color: 'var(--kenoki-primary)',
                      background: 'transparent',
                      border: '1px solid var(--kenoki-primary)',
                      borderRadius: 'var(--kenoki-radius-sm)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--kenoki-primary)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--kenoki-primary)';
                    }}
                  >
                    Open
                  </button>

                  {file.canPreview && (
                    <button
                      onClick={() => handlePreviewFile(file.path)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: "'Poppins', sans-serif",
                        color: 'var(--kenoki-text-secondary)',
                        background: 'transparent',
                        border: '1px solid var(--kenoki-border)',
                        borderRadius: 'var(--kenoki-radius-sm)',
                        cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kenoki-text-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kenoki-border)';
                      }}
                    >
                      Preview
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
        }}
      >
        {onPause && (
          <button
            onClick={onPause}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text)',
              background: 'transparent',
              border: '1px solid var(--kenoki-border)',
              borderRadius: 'var(--kenoki-radius-md)',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--kenoki-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--kenoki-border)';
            }}
          >
            Pause
          </button>
        )}

        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif",
              color: '#ffffff',
              background: 'var(--kenoki-error)',
              border: 'none',
              borderRadius: 'var(--kenoki-radius-md)',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
