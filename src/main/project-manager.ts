/**
 * Project Manager - Create and manage unified-terminal projects
 *
 * Projects are stored in ~/Documents/unified-terminal-projects/
 * Each project has its own directory with metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectDescription {
  description?: string;
  goals?: string[];
  tags?: string[];
  createdBy?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  lastAccessedAt: Date;
  brief?: ProjectDescription;
}

interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  lastAccessedAt: string;
  brief?: ProjectDescription;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Root directory for all projects */
export const PROJECT_ROOT = path.join(
  os.homedir(),
  'Documents',
  'unified-terminal-projects'
);

/** Metadata file name stored in each project directory */
const METADATA_FILE = '.project.json';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure the project root directory exists.
 */
function ensureProjectRoot(): void {
  if (!fs.existsSync(PROJECT_ROOT)) {
    console.log(`[ProjectManager] Creating project root: ${PROJECT_ROOT}`);
    fs.mkdirSync(PROJECT_ROOT, { recursive: true });
  }
}

/**
 * Sanitize a project name for use as a directory name.
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Generate a unique ID.
 * Uses UUID v4 if available, falls back to timestamp-based ID.
 */
function generateId(): string {
  try {
    return uuidv4();
  } catch {
    // Fallback if uuid is not available
    return `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Read project metadata from disk.
 */
function readMetadata(projectPath: string): ProjectMetadata | null {
  const metadataPath = path.join(projectPath, METADATA_FILE);

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content) as ProjectMetadata;
  } catch (error) {
    console.error(`[ProjectManager] Failed to read metadata: ${metadataPath}`, error);
    return null;
  }
}

/**
 * Write project metadata to disk.
 */
function writeMetadata(projectPath: string, metadata: ProjectMetadata): boolean {
  const metadataPath = path.join(projectPath, METADATA_FILE);

  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`[ProjectManager] Failed to write metadata: ${metadataPath}`, error);
    return false;
  }
}

/**
 * Convert metadata to Project object.
 */
function metadataToProject(metadata: ProjectMetadata, projectPath: string): Project {
  return {
    id: metadata.id,
    name: metadata.name,
    path: projectPath,
    createdAt: new Date(metadata.createdAt),
    lastAccessedAt: new Date(metadata.lastAccessedAt),
    brief: metadata.brief,
  };
}

// ============================================================================
// PROJECT MANAGER CLASS
// ============================================================================

/**
 * ProjectManager handles creation, listing, and management of projects.
 */
export class ProjectManager {
  constructor() {
    ensureProjectRoot();
  }

  /**
   * Create a new project.
   * @param name - Human-readable project name
   * @param brief - Optional project brief/description
   * @returns The created Project object
   */
  createProject(name: string, brief?: ProjectDescription): Project {
    const id = generateId();
    const sanitizedName = sanitizeName(name);
    const directoryName = `${sanitizedName}-${id.substring(0, 8)}`;
    const projectPath = path.join(PROJECT_ROOT, directoryName);

    console.log(`[ProjectManager] Creating project: ${name} at ${projectPath}`);

    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Create metadata
    const now = new Date();
    const metadata: ProjectMetadata = {
      id,
      name,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      brief,
    };

    writeMetadata(projectPath, metadata);

    // Create basic project structure
    const subdirs = ['src', 'docs', 'output'];
    for (const subdir of subdirs) {
      fs.mkdirSync(path.join(projectPath, subdir), { recursive: true });
    }

    // Create a README
    const readmeContent = `# ${name}

Created: ${now.toLocaleDateString()}

${brief?.description || 'A unified-terminal project.'}

## Goals

${brief?.goals?.map((g) => `- ${g}`).join('\n') || '- Define project goals'}

## Structure

- \`src/\` - Source files
- \`docs/\` - Documentation
- \`output/\` - Generated output
`;

    fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf-8');

    console.log(`[ProjectManager] Project created: ${id}`);

    return metadataToProject(metadata, projectPath);
  }

  /**
   * Get a project by ID.
   * @param id - Project ID
   * @returns Project object or null if not found
   */
  getProject(id: string): Project | null {
    const projects = this.listProjects();
    return projects.find((p) => p.id === id) || null;
  }

  /**
   * Get a project by path.
   * @param projectPath - Absolute path to project directory
   * @returns Project object or null if not found
   */
  getProjectByPath(projectPath: string): Project | null {
    const metadata = readMetadata(projectPath);
    if (!metadata) {
      return null;
    }
    return metadataToProject(metadata, projectPath);
  }

  /**
   * List all projects.
   * @returns Array of Project objects sorted by lastAccessedAt (most recent first)
   */
  listProjects(): Project[] {
    ensureProjectRoot();

    const projects: Project[] = [];

    try {
      const entries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const projectPath = path.join(PROJECT_ROOT, entry.name);
        const metadata = readMetadata(projectPath);

        if (metadata) {
          projects.push(metadataToProject(metadata, projectPath));
        }
      }
    } catch (error) {
      console.error('[ProjectManager] Failed to list projects:', error);
    }

    // Sort by last accessed (most recent first)
    projects.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());

    return projects;
  }

  /**
   * Delete a project.
   * @param id - Project ID
   * @returns True if deleted successfully
   */
  deleteProject(id: string): boolean {
    const project = this.getProject(id);
    if (!project) {
      console.error(`[ProjectManager] Project not found: ${id}`);
      return false;
    }

    console.log(`[ProjectManager] Deleting project: ${id} at ${project.path}`);

    try {
      // Move to trash instead of permanent delete (safer)
      shell.trashItem(project.path);
      console.log(`[ProjectManager] Project moved to trash: ${id}`);
      return true;
    } catch (error) {
      console.error(`[ProjectManager] Failed to delete project: ${id}`, error);

      // Fallback to fs.rm if trash fails
      try {
        fs.rmSync(project.path, { recursive: true, force: true });
        console.log(`[ProjectManager] Project deleted (fs.rm): ${id}`);
        return true;
      } catch (rmError) {
        console.error(`[ProjectManager] fs.rm also failed:`, rmError);
        return false;
      }
    }
  }

  /**
   * Get the path for a project by ID.
   * @param id - Project ID
   * @returns Project path or empty string if not found
   */
  getProjectPath(id: string): string {
    const project = this.getProject(id);
    return project?.path || '';
  }

  /**
   * Update the last accessed time for a project.
   * @param id - Project ID
   */
  touchProject(id: string): void {
    const project = this.getProject(id);
    if (!project) {
      return;
    }

    const metadataPath = path.join(project.path, METADATA_FILE);
    const metadata = readMetadata(project.path);

    if (metadata) {
      metadata.lastAccessedAt = new Date().toISOString();
      writeMetadata(project.path, metadata);
    }
  }

  /**
   * Update project brief.
   * @param id - Project ID
   * @param brief - New brief data (merged with existing)
   */
  updateBrief(id: string, brief: Partial<ProjectDescription>): boolean {
    const project = this.getProject(id);
    if (!project) {
      return false;
    }

    const metadata = readMetadata(project.path);
    if (!metadata) {
      return false;
    }

    metadata.brief = { ...metadata.brief, ...brief };
    metadata.lastAccessedAt = new Date().toISOString();

    return writeMetadata(project.path, metadata);
  }

  /**
   * Open project in Finder (macOS).
   * @param id - Project ID
   * @returns True if opened successfully
   */
  openInFinder(id: string): boolean {
    const project = this.getProject(id);
    if (!project) {
      console.error(`[ProjectManager] Project not found: ${id}`);
      return false;
    }

    console.log(`[ProjectManager] Opening in Finder: ${project.path}`);
    shell.showItemInFolder(project.path);
    this.touchProject(id);
    return true;
  }

  /**
   * Open project in VS Code.
   * @param id - Project ID
   * @returns True if command was issued (doesn't guarantee VS Code opened)
   */
  async openInEditor(id: string): Promise<boolean> {
    const project = this.getProject(id);
    if (!project) {
      console.error(`[ProjectManager] Project not found: ${id}`);
      return false;
    }

    console.log(`[ProjectManager] Opening in VS Code: ${project.path}`);

    try {
      // Try 'code' command first
      await execAsync(`code "${project.path}"`, {
        timeout: 5000,
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`,
        },
      });
      this.touchProject(id);
      return true;
    } catch {
      console.warn('[ProjectManager] VS Code command failed, trying open -a');

      try {
        // Fallback to 'open -a' on macOS
        await execAsync(`open -a "Visual Studio Code" "${project.path}"`, {
          timeout: 5000,
        });
        this.touchProject(id);
        return true;
      } catch (error) {
        console.error('[ProjectManager] Failed to open in editor:', error);
        return false;
      }
    }
  }

  /**
   * Open project root directory in Finder.
   */
  openProjectRoot(): void {
    ensureProjectRoot();
    shell.showItemInFolder(PROJECT_ROOT);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let projectManagerInstance: ProjectManager | null = null;

/**
 * Get the singleton ProjectManager instance.
 */
export function getProjectManager(): ProjectManager {
  if (!projectManagerInstance) {
    projectManagerInstance = new ProjectManager();
  }
  return projectManagerInstance;
}
