/**
 * CompleteScreen Component
 *
 * Shows build completion with:
 * - Checkmark + project name
 * - Deployed URL (if available)
 * - Folder path with Open in Finder/VS Code buttons
 * - Summary (pages, components count)
 * - New Project / Modify This buttons
 *
 * Calls IPC methods:
 * - project:openUrl (open deployed site)
 * - project:openFolder (open in Finder)
 * - project:openFile (open folder path, will launch VS Code if available)
 */

import React from 'react';

interface CompleteScreenProps {
  projectName: string;
  humanFolder: string;
  deployedUrl?: string;
  summary: {
    pages: number;
    components: number;
  };
  onNewProject: () => void;
  onModify: () => void;
}

export default function CompleteScreen({
  projectName,
  humanFolder,
  deployedUrl,
  summary,
  onNewProject,
  onModify,
}: CompleteScreenProps): React.ReactElement {
  const handleOpenSite = () => {
    if (deployedUrl) {
      window.electronAPI?.project?.openUrl?.(deployedUrl);
    }
  };

  const handleOpenFinder = () => {
    window.electronAPI?.project?.openFolder?.(humanFolder);
  };

  const handleOpenVSCode = () => {
    // Open folder in default editor (VS Code if set)
    window.electronAPI?.project?.openFile?.(humanFolder);
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
      {/* Success icon + title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 48,
        }}
      >
        <span
          style={{
            fontSize: 48,
            color: 'var(--kenoki-success)',
          }}
        >
          ✓
        </span>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
            color: 'var(--kenoki-text)',
            margin: 0,
          }}
        >
          {projectName} — Built
        </h1>
      </div>

      {/* Content container */}
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        {/* Deployed URL section */}
        {deployedUrl && (
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--kenoki-surface)',
              border: '1px solid var(--kenoki-border)',
              borderRadius: 'var(--kenoki-radius-md)',
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                color: 'var(--kenoki-text-secondary)',
                margin: 0,
                marginBottom: 12,
              }}
            >
              Live at:
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleOpenSite();
              }}
              style={{
                fontSize: 15,
                fontFamily: "'Poppins', sans-serif",
                color: 'var(--kenoki-primary)',
                textDecoration: 'underline',
                marginBottom: 16,
                display: 'block',
                wordBreak: 'break-all',
              }}
            >
              {deployedUrl}
            </a>
            <button
              onClick={handleOpenSite}
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "'Poppins', sans-serif",
                color: '#ffffff',
                background: 'var(--kenoki-primary)',
                border: 'none',
                borderRadius: 'var(--kenoki-radius-md)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--kenoki-primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--kenoki-primary)';
              }}
            >
              Open Site
            </button>
          </div>
        )}

        {/* Folder section */}
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--kenoki-surface)',
            border: '1px solid var(--kenoki-border)',
            borderRadius: 'var(--kenoki-radius-md)',
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text-secondary)',
              margin: 0,
              marginBottom: 12,
            }}
          >
            Project folder:
          </p>
          <code
            style={{
              display: 'block',
              fontSize: 13,
              fontFamily: 'monospace',
              color: 'var(--kenoki-text)',
              background: 'var(--kenoki-surface-hover)',
              padding: '8px 12px',
              borderRadius: 4,
              marginBottom: 16,
              wordBreak: 'break-all',
            }}
          >
            {humanFolder}
          </code>

          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              onClick={handleOpenFinder}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Poppins', sans-serif",
                color: 'var(--kenoki-text)',
                background: 'transparent',
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
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Open in Finder
            </button>

            <button
              onClick={handleOpenVSCode}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Poppins', sans-serif",
                color: 'var(--kenoki-text)',
                background: 'transparent',
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
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Open in VS Code
            </button>
          </div>
        </div>

        {/* Summary section */}
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--kenoki-surface)',
            border: '1px solid var(--kenoki-border)',
            borderRadius: 'var(--kenoki-radius-md)',
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text-secondary)',
              margin: 0,
              marginBottom: 12,
            }}
          >
            What was built:
          </p>
          <p
            style={{
              fontSize: 15,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text)',
              margin: 0,
            }}
          >
            {summary.pages} {summary.pages === 1 ? 'page' : 'pages'},{' '}
            {summary.components} {summary.components === 1 ? 'component' : 'components'}
          </p>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: 12,
          }}
        >
          <button
            onClick={onNewProject}
            style={{
              flex: 1,
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 500,
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
            New Project
          </button>

          <button
            onClick={onModify}
            style={{
              flex: 1,
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif",
              color: 'var(--kenoki-text)',
              background: 'transparent',
              border: '2px solid var(--kenoki-border)',
              borderRadius: 'var(--kenoki-radius-pill)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--kenoki-primary)';
              e.currentTarget.style.background = 'var(--kenoki-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--kenoki-border)';
              e.currentTarget.style.background = 'transparent';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Modify This
          </button>
        </div>
      </div>
    </div>
  );
}
