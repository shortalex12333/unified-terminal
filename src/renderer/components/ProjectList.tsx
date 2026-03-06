/**
 * ProjectList Component
 *
 * Displays a grid of project cards showing recently built projects.
 * Users can search/filter projects and open them for continuation work.
 *
 * Features:
 * - Grid of project cards with thumbnails
 * - Search/filter by name
 * - "New Project" card at the end
 * - Opens ProjectActions when clicking on a project
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

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

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface ProjectListProps {
  /** Callback when user clicks "New Project" */
  onNewProject: () => void;
  /** Callback when user selects a project to open */
  onOpenProject: (project: StoredProject) => void;
}

/**
 * Format a date string to a relative time (e.g., "2 days ago", "Just now")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

/**
 * Get template icon based on template type
 */
function getTemplateIcon(template?: string): string {
  switch (template) {
    case 'website':
      return 'globe';
    case 'api':
      return 'server';
    case 'app':
      return 'smartphone';
    case 'cli':
      return 'terminal';
    default:
      return 'folder';
  }
}

/**
 * ProjectCard - Individual project card in the grid
 */
function ProjectCard({
  project,
  onClick,
}: {
  project: StoredProject;
  onClick: () => void;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col bg-white/5 hover:bg-white/10
                 border border-white/10 hover:border-white/20 rounded-xl
                 overflow-hidden transition-all duration-200 text-left
                 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Thumbnail / Placeholder */}
      <div className="relative flex-1 bg-gradient-to-br from-white/5 to-white/0 overflow-hidden">
        {project.thumbnail && !imageError ? (
          <img
            src={`file://${project.thumbnail}`}
            alt={project.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white/20 text-4xl">
              {getTemplateIcon(project.template) === 'globe' && (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              )}
              {getTemplateIcon(project.template) === 'folder' && (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              )}
              {getTemplateIcon(project.template) === 'server' && (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              )}
              {getTemplateIcon(project.template) === 'smartphone' && (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              {getTemplateIcon(project.template) === 'terminal' && (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                        transition-opacity duration-200 flex items-center justify-center">
          <span className="text-white text-sm font-medium px-4 py-2 bg-white/20 rounded-full">
            Open Project
          </span>
        </div>
      </div>

      {/* Project Info */}
      <div className="p-3 border-t border-white/10">
        <h3 className="text-white font-medium text-sm truncate mb-1">
          {project.name}
        </h3>
        <p className="text-white/50 text-xs truncate">
          {formatRelativeTime(project.lastModifiedAt)}
        </p>
      </div>
    </button>
  );
}

/**
 * NewProjectCard - Card for creating a new project
 */
function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center
                 bg-white/5 hover:bg-white/10
                 border-2 border-dashed border-white/20 hover:border-white/40
                 rounded-xl transition-all duration-200
                 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Plus Icon */}
      <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20
                      flex items-center justify-center transition-colors duration-200 mb-3">
        <svg className="w-6 h-6 text-white/60 group-hover:text-white/80"
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-white/60 group-hover:text-white/80 text-sm font-medium
                       transition-colors duration-200">
        New Project
      </span>
    </button>
  );
}

/**
 * ProjectList - Main component
 */
export default function ProjectList({ onNewProject, onOpenProject }: ProjectListProps) {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        setIsLoading(true);
        setError(null);
        const result = await window.electronAPI?.projects?.list?.('active');
        setProjects(result || []);
      } catch (err) {
        console.error('[ProjectList] Failed to load projects:', err);
        setError('Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, []);

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.template?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Handle project click
  const handleProjectClick = useCallback(
    (project: StoredProject) => {
      onOpenProject(project);
    },
    [onOpenProject]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="theme-dark h-screen w-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-white/60 text-sm">Loading projects...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="theme-dark h-screen w-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="theme-dark h-screen w-screen flex flex-col bg-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-8 pb-4" style={{ paddingTop: 'calc(32px + env(safe-area-inset-top))' }}>
        <h1 className="text-white text-2xl font-semibold mb-2">Your Projects</h1>
        <p className="text-white/60 text-sm mb-4">
          {projects.length === 0
            ? 'Start a new project to get going'
            : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        </p>

        {/* Search Input */}
        {projects.length > 0 && (
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10
                       rounded-lg text-white text-sm placeholder:text-white/40
                       focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20
                       transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* New Project Card - Always first */}
          <NewProjectCard onClick={onNewProject} />

          {/* Project Cards */}
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project)}
            />
          ))}
        </div>

        {/* Empty state when no search results */}
        {searchQuery && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <svg
              className="w-12 h-12 text-white/20 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-white/40 text-sm">No projects match "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Bottom safe area padding for macOS */}
      <div className="flex-none h-4" />
    </div>
  );
}
