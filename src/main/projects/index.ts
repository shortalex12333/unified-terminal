/**
 * Projects Module - Post-build project continuation system
 *
 * Provides persistent storage and management for projects that users
 * can return to and iterate on.
 */

// Type exports
export {
  Project,
  ProjectStatus,
  SerializedProject,
  ProjectsFileData,
  CreateProjectData,
  UpdateProjectData,
  ProjectOperationResult,
  QuickActionType,
  QuickAction,
  ProjectContext,
  serializeProject,
  deserializeProject,
  DEFAULT_QUICK_ACTIONS,
} from './types';

// Store exports
export {
  ProjectStore,
  getProjectStore,
  cleanupProjectStore,
  KENOKI_DIR,
  PROJECTS_FILE,
  THUMBNAILS_DIR,
} from './project-store';
