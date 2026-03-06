/**
 * Project Types - Type definitions for post-build project continuation
 *
 * These types support the project persistence and continuation workflow
 * where users can return to previously built projects and iterate on them.
 */

// ============================================================================
// PROJECT TYPES
// ============================================================================

/**
 * Project status indicating whether the project is actively being worked on or archived.
 */
export type ProjectStatus = 'active' | 'archived';

/**
 * Core project interface representing a built/managed project.
 * Projects are stored in ~/.kenoki/projects.json and can be reopened
 * for continuation work.
 */
export interface Project {
  /** Unique project identifier (UUID) */
  id: string;

  /** Human-readable project name */
  name: string;

  /** Absolute path to the project directory */
  path: string;

  /** When the project was created */
  createdAt: Date;

  /** When the project was last modified/accessed */
  lastModifiedAt: Date;

  /** Template used to create the project (e.g., 'website', 'api', 'app') */
  template?: string;

  /** Brief description of the project */
  description: string;

  /** Path to project thumbnail image (auto-generated screenshot) */
  thumbnail?: string;

  /** Current project status */
  status: ProjectStatus;
}

/**
 * Serialized version of Project for JSON storage.
 * Dates are stored as ISO strings.
 */
export interface SerializedProject {
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

/**
 * Data required to create a new project.
 */
export interface CreateProjectData {
  /** Human-readable project name */
  name: string;

  /** Absolute path to the project directory */
  path: string;

  /** Template used to create the project */
  template?: string;

  /** Brief description of the project */
  description: string;
}

/**
 * Partial update data for modifying a project.
 */
export interface UpdateProjectData {
  /** Update the project name */
  name?: string;

  /** Update the project description */
  description?: string;

  /** Update the template designation */
  template?: string;

  /** Update the thumbnail path */
  thumbnail?: string;

  /** Update the project status */
  status?: ProjectStatus;
}

// ============================================================================
// PROJECT CONTEXT TYPES
// ============================================================================

/**
 * Quick action types for project continuation.
 * These are pre-defined actions that users can take when reopening a project.
 */
export type QuickActionType =
  | 'update-content'
  | 'change-design'
  | 'add-feature'
  | 'view-files'
  | 'deploy'
  | 'custom';

/**
 * Quick action configuration for the ProjectActions component.
 */
export interface QuickAction {
  /** Action type identifier */
  type: QuickActionType;

  /** Display label */
  label: string;

  /** Icon identifier (could be emoji or icon name) */
  icon: string;

  /** Pre-filled prompt template for this action */
  promptTemplate: string;

  /** Description shown on hover */
  description: string;
}

/**
 * Context passed to ChatInterface when opening an existing project.
 * Contains project information and any selected quick action.
 */
export interface ProjectContext {
  /** The project being worked on */
  project: Project;

  /** Selected quick action (if any) */
  quickAction?: QuickAction;

  /** Custom prompt from "describe what you want" input */
  customPrompt?: string;
}

// ============================================================================
// PROJECT STORE TYPES
// ============================================================================

/**
 * The projects.json file structure.
 */
export interface ProjectsFileData {
  /** Schema version for future migrations */
  version: string;

  /** Array of serialized projects */
  projects: SerializedProject[];

  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Result of a project operation.
 */
export interface ProjectOperationResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Error message if operation failed */
  error?: string;

  /** The affected project (if applicable) */
  project?: Project;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Serialize a Project to JSON-safe format.
 */
export function serializeProject(project: Project): SerializedProject {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    createdAt: project.createdAt.toISOString(),
    lastModifiedAt: project.lastModifiedAt.toISOString(),
    template: project.template,
    description: project.description,
    thumbnail: project.thumbnail,
    status: project.status,
  };
}

/**
 * Deserialize a Project from JSON format.
 */
export function deserializeProject(data: SerializedProject): Project {
  return {
    id: data.id,
    name: data.name,
    path: data.path,
    createdAt: new Date(data.createdAt),
    lastModifiedAt: new Date(data.lastModifiedAt),
    template: data.template,
    description: data.description,
    thumbnail: data.thumbnail,
    status: data.status,
  };
}

// ============================================================================
// DEFAULT QUICK ACTIONS
// ============================================================================

/**
 * Default quick actions available for all projects.
 */
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    type: 'update-content',
    label: 'Update content',
    icon: 'pencil',
    promptTemplate: 'Update the content of my project. I want to change:',
    description: 'Modify text, images, or other content',
  },
  {
    type: 'change-design',
    label: 'Change design',
    icon: 'palette',
    promptTemplate: 'Update the design of my project. Specifically, I want to:',
    description: 'Adjust colors, layout, or styling',
  },
  {
    type: 'add-feature',
    label: 'Add feature',
    icon: 'plus-circle',
    promptTemplate: 'Add a new feature to my project:',
    description: 'Add new functionality or sections',
  },
  {
    type: 'view-files',
    label: 'View files',
    icon: 'folder',
    promptTemplate: '',
    description: 'Open the project folder',
  },
];
