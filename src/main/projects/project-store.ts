/**
 * Project Store - Persistent storage for project metadata
 *
 * Stores projects in ~/.kenoki/projects.json
 * Handles CRUD operations and auto-generates thumbnails from project screenshots.
 */

import { app, nativeImage, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

import {
  Project,
  SerializedProject,
  ProjectsFileData,
  CreateProjectData,
  UpdateProjectData,
  ProjectOperationResult,
  ProjectStatus,
  serializeProject,
  deserializeProject,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Directory for Kenoki app data */
const KENOKI_DIR = path.join(os.homedir(), '.kenoki');

/** Path to the projects JSON file */
const PROJECTS_FILE = path.join(KENOKI_DIR, 'projects.json');

/** Directory for project thumbnails */
const THUMBNAILS_DIR = path.join(KENOKI_DIR, 'thumbnails');

/** Current schema version for migrations */
const SCHEMA_VERSION = '1.0.0';

/** Thumbnail dimensions */
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;

// ============================================================================
// PROJECT STORE CLASS
// ============================================================================

/**
 * ProjectStore handles persistent storage and retrieval of projects.
 *
 * Events:
 * - 'project-created': (project: Project) - New project was created
 * - 'project-updated': (project: Project) - Project was updated
 * - 'project-archived': (project: Project) - Project was archived
 * - 'project-deleted': (projectId: string) - Project was deleted
 * - 'error': (error: Error) - Error during storage operations
 */
export class ProjectStore extends EventEmitter {
  private projects: Map<string, Project>;
  private initialized: boolean = false;

  constructor() {
    super();
    this.projects = new Map();
    this.ensureDirectories();
    this.loadSync();
  }

  // ==========================================================================
  // DIRECTORY MANAGEMENT
  // ==========================================================================

  /**
   * Ensure required directories exist.
   */
  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(KENOKI_DIR)) {
        console.log('[ProjectStore] Creating Kenoki directory:', KENOKI_DIR);
        fs.mkdirSync(KENOKI_DIR, { recursive: true });
      }

      if (!fs.existsSync(THUMBNAILS_DIR)) {
        console.log('[ProjectStore] Creating thumbnails directory:', THUMBNAILS_DIR);
        fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('[ProjectStore] Failed to create directories:', error);
      this.emit('error', error);
    }
  }

  // ==========================================================================
  // SAVE/LOAD OPERATIONS
  // ==========================================================================

  /**
   * Load projects from disk synchronously.
   */
  private loadSync(): void {
    try {
      if (!fs.existsSync(PROJECTS_FILE)) {
        console.log('[ProjectStore] No existing projects file, starting fresh');
        this.initialized = true;
        return;
      }

      const fileContent = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      const data = JSON.parse(fileContent) as ProjectsFileData;

      // Migrate if needed (future-proofing)
      if (data.version !== SCHEMA_VERSION) {
        console.log(`[ProjectStore] Migrating from version ${data.version} to ${SCHEMA_VERSION}`);
        // Future: Add migration logic here
      }

      // Load projects into memory
      this.projects.clear();
      for (const serialized of data.projects) {
        const project = deserializeProject(serialized);
        this.projects.set(project.id, project);
      }

      console.log(`[ProjectStore] Loaded ${this.projects.size} projects`);
      this.initialized = true;
    } catch (error) {
      console.error('[ProjectStore] Failed to load projects:', error);
      this.emit('error', error);
      this.initialized = true; // Allow app to continue with empty state
    }
  }

  /**
   * Save all projects to disk.
   */
  private save(): void {
    try {
      const serializedProjects: SerializedProject[] = [];

      for (const project of this.projects.values()) {
        serializedProjects.push(serializeProject(project));
      }

      const data: ProjectsFileData = {
        version: SCHEMA_VERSION,
        projects: serializedProjects,
        lastUpdated: new Date().toISOString(),
      };

      const jsonContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(PROJECTS_FILE, jsonContent, 'utf-8');

      console.log(`[ProjectStore] Saved ${this.projects.size} projects`);
    } catch (error) {
      console.error('[ProjectStore] Failed to save projects:', error);
      this.emit('error', error);
    }
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * List all projects, sorted by lastModifiedAt (most recent first).
   * Optionally filter by status.
   */
  list(status?: ProjectStatus): Project[] {
    const projects = Array.from(this.projects.values());

    // Filter by status if specified
    const filtered = status
      ? projects.filter((p) => p.status === status)
      : projects;

    // Sort by lastModifiedAt descending
    filtered.sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime());

    return filtered;
  }

  /**
   * Get a project by ID.
   */
  get(id: string): Project | null {
    return this.projects.get(id) || null;
  }

  /**
   * Get a project by path.
   */
  getByPath(projectPath: string): Project | null {
    for (const project of this.projects.values()) {
      if (project.path === projectPath) {
        return project;
      }
    }
    return null;
  }

  /**
   * Create a new project.
   */
  create(data: CreateProjectData): ProjectOperationResult {
    try {
      // Validate path exists
      if (!fs.existsSync(data.path)) {
        return {
          success: false,
          error: `Project path does not exist: ${data.path}`,
        };
      }

      // Check for duplicate path
      const existingByPath = this.getByPath(data.path);
      if (existingByPath) {
        // Update the existing project instead
        return this.update(existingByPath.id, {
          name: data.name,
          description: data.description,
          template: data.template,
        });
      }

      const now = new Date();
      const project: Project = {
        id: uuidv4(),
        name: data.name,
        path: data.path,
        createdAt: now,
        lastModifiedAt: now,
        template: data.template,
        description: data.description,
        status: 'active',
      };

      this.projects.set(project.id, project);
      this.save();

      console.log(`[ProjectStore] Created project: ${project.id} - ${project.name}`);
      this.emit('project-created', project);

      // Generate thumbnail asynchronously
      this.generateThumbnail(project.id).catch((err) => {
        console.warn('[ProjectStore] Failed to generate thumbnail:', err);
      });

      return { success: true, project };
    } catch (error) {
      console.error('[ProjectStore] Failed to create project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update a project by ID.
   */
  update(id: string, updates: UpdateProjectData): ProjectOperationResult {
    try {
      const project = this.projects.get(id);
      if (!project) {
        return {
          success: false,
          error: `Project not found: ${id}`,
        };
      }

      // Apply updates
      if (updates.name !== undefined) {
        project.name = updates.name;
      }
      if (updates.description !== undefined) {
        project.description = updates.description;
      }
      if (updates.template !== undefined) {
        project.template = updates.template;
      }
      if (updates.thumbnail !== undefined) {
        project.thumbnail = updates.thumbnail;
      }
      if (updates.status !== undefined) {
        project.status = updates.status;
      }

      // Update lastModifiedAt
      project.lastModifiedAt = new Date();

      this.save();

      console.log(`[ProjectStore] Updated project: ${id}`);
      this.emit('project-updated', project);

      return { success: true, project };
    } catch (error) {
      console.error('[ProjectStore] Failed to update project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Archive a project (soft delete).
   */
  archive(id: string): ProjectOperationResult {
    const result = this.update(id, { status: 'archived' });

    if (result.success && result.project) {
      console.log(`[ProjectStore] Archived project: ${id}`);
      this.emit('project-archived', result.project);
    }

    return result;
  }

  /**
   * Unarchive a project.
   */
  unarchive(id: string): ProjectOperationResult {
    return this.update(id, { status: 'active' });
  }

  /**
   * Permanently delete a project from the store.
   * Note: This does NOT delete the project files, only the metadata.
   */
  delete(id: string): ProjectOperationResult {
    try {
      const project = this.projects.get(id);
      if (!project) {
        return {
          success: false,
          error: `Project not found: ${id}`,
        };
      }

      // Delete thumbnail if it exists
      if (project.thumbnail && fs.existsSync(project.thumbnail)) {
        try {
          fs.unlinkSync(project.thumbnail);
        } catch (err) {
          console.warn('[ProjectStore] Failed to delete thumbnail:', err);
        }
      }

      this.projects.delete(id);
      this.save();

      console.log(`[ProjectStore] Deleted project: ${id}`);
      this.emit('project-deleted', id);

      return { success: true };
    } catch (error) {
      console.error('[ProjectStore] Failed to delete project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Touch a project to update its lastModifiedAt timestamp.
   */
  touch(id: string): ProjectOperationResult {
    const project = this.projects.get(id);
    if (!project) {
      return {
        success: false,
        error: `Project not found: ${id}`,
      };
    }

    project.lastModifiedAt = new Date();
    this.save();

    return { success: true, project };
  }

  // ==========================================================================
  // THUMBNAIL GENERATION
  // ==========================================================================

  /**
   * Generate a thumbnail for a project.
   * Takes a screenshot of the main window or uses a placeholder.
   */
  async generateThumbnail(projectId: string): Promise<string | null> {
    const project = this.projects.get(projectId);
    if (!project) {
      return null;
    }

    const thumbnailPath = path.join(THUMBNAILS_DIR, `${projectId}.png`);

    try {
      // Try to capture a screenshot from the focused window
      const focusedWindow = BrowserWindow.getFocusedWindow();

      if (focusedWindow) {
        const image = await focusedWindow.capturePage();
        const resized = image.resize({
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
        });

        fs.writeFileSync(thumbnailPath, resized.toPNG());
        console.log(`[ProjectStore] Generated thumbnail for project: ${projectId}`);

        // Update project with thumbnail path
        project.thumbnail = thumbnailPath;
        this.save();

        return thumbnailPath;
      }

      return null;
    } catch (error) {
      console.error('[ProjectStore] Failed to generate thumbnail:', error);
      return null;
    }
  }

  /**
   * Update thumbnail from an external source (e.g., pre-rendered image).
   */
  async setThumbnailFromPath(projectId: string, sourcePath: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }

    try {
      const thumbnailPath = path.join(THUMBNAILS_DIR, `${projectId}.png`);

      // Read and resize the source image
      const image = nativeImage.createFromPath(sourcePath);
      if (image.isEmpty()) {
        console.warn('[ProjectStore] Source image is empty:', sourcePath);
        return false;
      }

      const resized = image.resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
      });

      fs.writeFileSync(thumbnailPath, resized.toPNG());

      // Update project with thumbnail path
      project.thumbnail = thumbnailPath;
      this.save();

      console.log(`[ProjectStore] Set thumbnail for project: ${projectId}`);
      return true;
    } catch (error) {
      console.error('[ProjectStore] Failed to set thumbnail:', error);
      return false;
    }
  }

  // ==========================================================================
  // SEARCH & FILTER
  // ==========================================================================

  /**
   * Search projects by name or description.
   */
  search(query: string): Project[] {
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      return this.list('active');
    }

    const results: Project[] = [];

    for (const project of this.projects.values()) {
      const nameMatch = project.name.toLowerCase().includes(normalizedQuery);
      const descMatch = project.description.toLowerCase().includes(normalizedQuery);
      const templateMatch = project.template?.toLowerCase().includes(normalizedQuery);

      if (nameMatch || descMatch || templateMatch) {
        results.push(project);
      }
    }

    // Sort by relevance (name matches first, then by recency)
    results.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(normalizedQuery);
      const bNameMatch = b.name.toLowerCase().includes(normalizedQuery);

      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      return b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime();
    });

    return results;
  }

  /**
   * Get projects by template.
   */
  getByTemplate(template: string): Project[] {
    return Array.from(this.projects.values())
      .filter((p) => p.template === template && p.status === 'active')
      .sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime());
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get the total number of projects.
   */
  count(status?: ProjectStatus): number {
    if (!status) {
      return this.projects.size;
    }

    let count = 0;
    for (const project of this.projects.values()) {
      if (project.status === status) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a project exists by ID.
   */
  exists(id: string): boolean {
    return this.projects.has(id);
  }

  /**
   * Check if a project exists by path.
   */
  existsByPath(projectPath: string): boolean {
    return this.getByPath(projectPath) !== null;
  }

  /**
   * Get recently modified projects (last N).
   */
  getRecent(limit: number = 5): Project[] {
    return this.list('active').slice(0, limit);
  }

  /**
   * Cleanup projects whose directories no longer exist.
   */
  cleanup(): number {
    let removedCount = 0;

    for (const project of this.projects.values()) {
      if (!fs.existsSync(project.path)) {
        console.log(`[ProjectStore] Removing orphaned project: ${project.id} (${project.path})`);
        this.projects.delete(project.id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.save();
      console.log(`[ProjectStore] Cleaned up ${removedCount} orphaned projects`);
    }

    return removedCount;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let projectStoreInstance: ProjectStore | null = null;

/**
 * Get the singleton ProjectStore instance.
 */
export function getProjectStore(): ProjectStore {
  if (!projectStoreInstance) {
    projectStoreInstance = new ProjectStore();
  }
  return projectStoreInstance;
}

/**
 * Cleanup the ProjectStore instance (for app shutdown).
 */
export function cleanupProjectStore(): void {
  if (projectStoreInstance) {
    projectStoreInstance.removeAllListeners();
    projectStoreInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { KENOKI_DIR, PROJECTS_FILE, THUMBNAILS_DIR };
