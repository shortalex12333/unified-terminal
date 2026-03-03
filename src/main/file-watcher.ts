/**
 * File Watcher - Real-time file system monitoring
 *
 * Uses chokidar to watch directories for changes and provides
 * a file tree structure with depth control.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

// ============================================================================
// TYPES
// ============================================================================

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
}

export interface FileChange {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default patterns to ignore when watching */
const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.next/**',
  '**/build/**',
  '**/*.log',
  '**/.DS_Store',
  '**/coverage/**',
  '**/.cache/**',
  '**/tmp/**',
  '**/.temp/**',
];

/** Maximum number of changes to keep in history */
const MAX_CHANGES_HISTORY = 1000;

/** Maximum depth for file tree generation */
const MAX_TREE_DEPTH = 10;

// ============================================================================
// FILE WATCHER CLASS
// ============================================================================

/**
 * FileWatcher provides real-time file system monitoring and file tree generation.
 * Emits 'change' events when files are modified.
 */
export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private changes: FileChange[] = [];
  private ignorePatterns: string[];

  constructor(ignorePatterns: string[] = DEFAULT_IGNORES) {
    super();
    this.ignorePatterns = ignorePatterns;
  }

  /**
   * Start watching a directory for changes.
   * @param directory - Absolute path to the directory to watch
   */
  watch(directory: string): void {
    // Check if already watching this directory
    if (this.watchers.has(directory)) {
      console.log(`[FileWatcher] Already watching: ${directory}`);
      return;
    }

    // Verify directory exists
    if (!fs.existsSync(directory)) {
      console.error(`[FileWatcher] Directory does not exist: ${directory}`);
      return;
    }

    console.log(`[FileWatcher] Starting to watch: ${directory}`);

    const watcher = chokidar.watch(directory, {
      ignored: this.ignorePatterns,
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    // Set up event handlers
    watcher.on('add', (filePath) => this.handleChange('add', filePath));
    watcher.on('change', (filePath) => this.handleChange('change', filePath));
    watcher.on('unlink', (filePath) => this.handleChange('unlink', filePath));
    watcher.on('addDir', (dirPath) => this.handleChange('addDir', dirPath));
    watcher.on('unlinkDir', (dirPath) => this.handleChange('unlinkDir', dirPath));

    watcher.on('error', (error) => {
      console.error(`[FileWatcher] Error watching ${directory}:`, error);
      this.emit('error', { directory, error });
    });

    watcher.on('ready', () => {
      console.log(`[FileWatcher] Ready and watching: ${directory}`);
      this.emit('ready', directory);
    });

    this.watchers.set(directory, watcher);
  }

  /**
   * Stop watching a directory.
   * @param directory - Absolute path to the directory to stop watching
   */
  async unwatch(directory: string): Promise<void> {
    const watcher = this.watchers.get(directory);
    if (!watcher) {
      console.log(`[FileWatcher] Not watching: ${directory}`);
      return;
    }

    console.log(`[FileWatcher] Stopping watch on: ${directory}`);
    await watcher.close();
    this.watchers.delete(directory);
  }

  /**
   * Stop watching all directories.
   */
  async unwatchAll(): Promise<void> {
    console.log('[FileWatcher] Stopping all watchers...');
    const closePromises = Array.from(this.watchers.values()).map((w) => w.close());
    await Promise.all(closePromises);
    this.watchers.clear();
    console.log('[FileWatcher] All watchers stopped');
  }

  /**
   * Get the list of directories currently being watched.
   */
  getWatchedDirectories(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Handle a file system change event.
   */
  private handleChange(
    type: FileChange['type'],
    filePath: string
  ): void {
    const change: FileChange = {
      type,
      path: filePath,
      timestamp: new Date(),
    };

    // Add to changes history (limit size)
    this.changes.push(change);
    if (this.changes.length > MAX_CHANGES_HISTORY) {
      this.changes.shift();
    }

    // Emit the change event
    this.emit('change', change);
  }

  /**
   * Get recent file changes.
   * @param since - Optional date to filter changes since
   * @returns Array of FileChange objects
   */
  getChanges(since?: Date): FileChange[] {
    if (!since) {
      return [...this.changes];
    }

    return this.changes.filter((c) => c.timestamp >= since);
  }

  /**
   * Clear the changes history.
   */
  clearChanges(): void {
    this.changes = [];
  }

  /**
   * Generate a file tree structure for a directory.
   * @param directory - Absolute path to the directory
   * @param depth - Maximum depth to traverse (default: 3)
   * @returns FileNode representing the directory tree
   */
  getTree(directory: string, depth: number = 3): FileNode {
    const effectiveDepth = Math.min(depth, MAX_TREE_DEPTH);
    return this.buildTree(directory, effectiveDepth);
  }

  /**
   * Recursively build the file tree.
   */
  private buildTree(itemPath: string, remainingDepth: number): FileNode {
    const stats = fs.statSync(itemPath);
    const name = path.basename(itemPath);
    const isDirectory = stats.isDirectory();

    const node: FileNode = {
      name,
      path: itemPath,
      type: isDirectory ? 'directory' : 'file',
      modified: stats.mtime,
    };

    if (!isDirectory) {
      node.size = stats.size;
      return node;
    }

    // Don't recurse if we've reached max depth
    if (remainingDepth <= 0) {
      return node;
    }

    // Get children
    try {
      const entries = fs.readdirSync(itemPath);
      const children: FileNode[] = [];

      for (const entry of entries) {
        // Skip ignored patterns (simple check)
        if (this.shouldIgnore(entry)) {
          continue;
        }

        const childPath = path.join(itemPath, entry);

        try {
          const childNode = this.buildTree(childPath, remainingDepth - 1);
          children.push(childNode);
        } catch {
          // Skip files we can't access
          continue;
        }
      }

      // Sort: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      node.children = children;
    } catch (error) {
      console.warn(`[FileWatcher] Could not read directory: ${itemPath}`);
    }

    return node;
  }

  /**
   * Simple check if a file/directory name should be ignored.
   */
  private shouldIgnore(name: string): boolean {
    // Common ignores
    const ignoreNames = [
      'node_modules',
      '.git',
      'dist',
      '.next',
      'build',
      '.DS_Store',
      'coverage',
      '.cache',
      'tmp',
      '.temp',
    ];

    return ignoreNames.includes(name) || name.endsWith('.log');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let fileWatcherInstance: FileWatcher | null = null;

/**
 * Get the singleton FileWatcher instance.
 */
export function getFileWatcher(): FileWatcher {
  if (!fileWatcherInstance) {
    fileWatcherInstance = new FileWatcher();
  }
  return fileWatcherInstance;
}

/**
 * Clean up the FileWatcher instance.
 */
export async function cleanupFileWatcher(): Promise<void> {
  if (fileWatcherInstance) {
    await fileWatcherInstance.unwatchAll();
    fileWatcherInstance.removeAllListeners();
    fileWatcherInstance = null;
  }
}
