/**
 * ProjectActions Component
 *
 * Shows when opening an existing project.
 * Provides quick actions for common continuation tasks and a custom prompt input.
 *
 * Features:
 * - Quick action buttons (Update content, Change design, Add feature, View files)
 * - Each action pre-fills appropriate prompt with project context
 * - Custom prompt input for describing changes
 * - Back button to return to project list
 */

import React, { useState, useCallback, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

type ProjectStatus = 'active' | 'archived';

interface StoredProject {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastModifiedAt: string;
  template?: string;
  description: string;
  thumbnail?: string;
  status: ProjectStatus;
}

type QuickActionType = 'update-content' | 'change-design' | 'add-feature' | 'view-files' | 'deploy' | 'custom';

interface QuickAction {
  type: QuickActionType;
  label: string;
  icon: string;
  promptTemplate: string;
  description: string;
}

interface ProjectContext {
  project: StoredProject;
  quickAction?: QuickAction;
  customPrompt?: string;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface ProjectActionsProps {
  /** The project being worked on */
  project: StoredProject;
  /** Available quick actions from the backend */
  quickActions: QuickAction[];
  /** Callback when user selects an action or submits custom prompt */
  onSubmit: (context: ProjectContext) => void;
  /** Callback to go back to project list */
  onBack: () => void;
}

/**
 * Icon component for quick actions
 */
function ActionIcon({ icon, className = '' }: { icon: string; className?: string }) {
  const baseClass = `w-5 h-5 ${className}`;

  switch (icon) {
    case 'pencil':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'palette':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      );
    case 'plus-circle':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'folder':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
      );
    case 'rocket':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    default:
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

/**
 * QuickActionButton - Individual quick action button
 */
function QuickActionButton({
  action,
  onClick,
}: {
  action: QuickAction;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 w-full p-4 bg-white/5 hover:bg-white/10
                 border border-white/10 hover:border-white/20 rounded-xl
                 transition-all duration-200 text-left
                 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <div className="flex-none w-10 h-10 rounded-lg bg-white/10 group-hover:bg-white/20
                      flex items-center justify-center transition-colors duration-200">
        <ActionIcon icon={action.icon} className="text-white/70 group-hover:text-white/90" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium text-sm">{action.label}</h3>
        <p className="text-white/50 text-xs truncate">{action.description}</p>
      </div>
      <svg
        className="flex-none w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * ProjectActions - Main component
 */
export default function ProjectActions({
  project,
  quickActions,
  onSubmit,
  onBack,
}: ProjectActionsProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle quick action click
  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      // Special case: "View files" opens folder directly
      if (action.type === 'view-files') {
        try {
          await window.electronAPI?.projects?.openFolder?.(project.id);
        } catch (err) {
          console.error('[ProjectActions] Failed to open folder:', err);
        }
        return;
      }

      // Submit with quick action context
      onSubmit({
        project,
        quickAction: action,
      });
    },
    [project, onSubmit]
  );

  // Handle custom prompt submission
  const handleCustomSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!customPrompt.trim() || isSubmitting) return;

      setIsSubmitting(true);
      onSubmit({
        project,
        customPrompt: customPrompt.trim(),
      });
    },
    [project, customPrompt, isSubmitting, onSubmit]
  );

  // Handle Enter key in textarea
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCustomSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleCustomSubmit]
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="theme-dark h-screen w-screen flex flex-col bg-[#1a1a1a] overflow-hidden">
      {/* Header with back button */}
      <div
        className="flex-none px-6 pt-6"
        style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/60 hover:text-white/90
                     transition-colors duration-200 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Back to Projects</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Project Info Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-4">
            {/* Thumbnail or Placeholder */}
            <div className="flex-none w-16 h-16 rounded-lg bg-white/10 overflow-hidden">
              {project.thumbnail ? (
                <img
                  src={`file://${project.thumbnail}`}
                  alt={project.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white/20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Project Details */}
            <div className="flex-1 min-w-0">
              <h1 className="text-white text-lg font-semibold truncate mb-1">
                {project.name}
              </h1>
              <p className="text-white/50 text-sm mb-2 line-clamp-2">
                {project.description || 'No description'}
              </p>
              <div className="flex items-center gap-3 text-xs text-white/40">
                <span>Created {formatDate(project.createdAt)}</span>
                {project.template && (
                  <>
                    <span className="text-white/20">|</span>
                    <span className="capitalize">{project.template}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <QuickActionButton
                key={action.type}
                action={action}
                onClick={() => handleQuickAction(action)}
              />
            ))}
          </div>
        </div>

        {/* Custom Prompt Input */}
        <div>
          <h2 className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">
            Or describe what you want to change
          </h2>
          <form onSubmit={handleCustomSubmit}>
            <div className="relative">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Add a contact form to the homepage..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10
                         rounded-xl text-white text-sm placeholder:text-white/40
                         focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20
                         resize-none transition-all duration-200"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className="text-white/30 text-xs">
                  {customPrompt.length > 0 && 'Press Enter to send'}
                </span>
                <button
                  type="submit"
                  disabled={!customPrompt.trim() || isSubmitting}
                  className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500
                           disabled:bg-white/10 disabled:cursor-not-allowed
                           flex items-center justify-center transition-colors duration-200"
                >
                  <svg
                    className={`w-4 h-4 ${
                      customPrompt.trim() ? 'text-white' : 'text-white/30'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom safe area padding */}
      <div className="flex-none h-4" />
    </div>
  );
}
