/**
 * State Manager - Task Persistence and Application State
 *
 * Gate 11: Task Persistence + Background Execution
 *
 * Handles:
 * - Application state persistence across restarts
 * - Task state tracking with process IDs
 * - Auto-save on task updates
 * - Save all on app quit
 *
 * State is stored in Electron's userData directory as JSON files:
 * - state.json: Main app state
 * - tasks/*.json: Individual task states
 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ProjectBrief } from '../intake/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * State for a single task/execution.
 */
export interface TaskState {
  /** Unique task identifier */
  id: string;
  /** Associated project ID */
  projectId: string;
  /** Project brief that initiated this task */
  brief: ProjectBrief;
  /** Current execution status */
  status: TaskStatus;
  /** Human-readable description of current step */
  currentStep: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** When the task was started */
  startedAt: Date;
  /** Last activity timestamp */
  lastUpdatedAt: Date;
  /** IDs of running CLI processes for this task */
  processIds: string[];
  /** Plugin being executed */
  plugin?: string;
  /** Execution ID from plugin executor */
  executionId?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Output accumulated from the task */
  output?: string[];
}

/**
 * Application settings.
 */
export interface AppSettings {
  /** Whether to minimize to tray instead of closing */
  minimizeToTray: boolean;
  /** Whether to show tray icon */
  showTrayIcon: boolean;
  /** Whether to show notifications */
  showNotifications: boolean;
  /** Auto-resume interrupted tasks on startup */
  autoResumeOnStartup: boolean;
  /** Theme preference */
  theme: 'system' | 'light' | 'dark';
}

/**
 * Full application state.
 */
export interface AppState {
  /** State schema version for migrations */
  version: string;
  /** When state was last saved */
  lastSaved: Date;
  /** Currently active tasks */
  activeTasks: TaskState[];
  /** Application settings */
  settings: AppSettings;
  /** Recently accessed project paths */
  recentProjects: string[];
}

/**
 * Event emitted when a task is updated.
 */
export interface TaskUpdateEvent {
  taskId: string;
  task: TaskState;
  type: 'created' | 'updated' | 'completed' | 'failed' | 'removed';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATE_VERSION = '1.0.0';
const STATE_FILE = 'state.json';
const TASKS_DIR = 'tasks';
const MAX_RECENT_PROJECTS = 10;
const AUTO_SAVE_DEBOUNCE_MS = 1000;

const DEFAULT_SETTINGS: AppSettings = {
  minimizeToTray: true,
  showTrayIcon: true,
  showNotifications: true,
  autoResumeOnStartup: true,
  theme: 'system',
};

// ============================================================================
// STATE MANAGER CLASS
// ============================================================================

/**
 * StateManager - Handles persistence of application and task state.
 *
 * Events:
 * - 'task-update': (TaskUpdateEvent) - Task was created, updated, or removed
 * - 'state-loaded': (AppState) - State was loaded from disk
 * - 'state-saved': () - State was saved to disk
 * - 'error': (Error) - Error during state operations
 */
export class StateManager extends EventEmitter {
  private state: AppState;
  private stateDir: string;
  private statePath: string;
  private tasksDir: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;

  constructor() {
    super();

    // Initialize paths
    this.stateDir = app.getPath('userData');
    this.statePath = path.join(this.stateDir, STATE_FILE);
    this.tasksDir = path.join(this.stateDir, TASKS_DIR);

    // Ensure directories exist
    this.ensureDirectories();

    // Initialize with default state
    this.state = this.createDefaultState();

    // Load existing state if available
    this.loadSync();

    console.log('[StateManager] Initialized with state dir:', this.stateDir);
  }

  // ==========================================================================
  // DIRECTORY MANAGEMENT
  // ==========================================================================

  /**
   * Ensure required directories exist.
   */
  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
      if (!fs.existsSync(this.tasksDir)) {
        fs.mkdirSync(this.tasksDir, { recursive: true });
      }
    } catch (error) {
      console.error('[StateManager] Failed to create directories:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get the state directory path.
   */
  getStateDirectory(): string {
    return this.stateDir;
  }

  // ==========================================================================
  // STATE CREATION
  // ==========================================================================

  /**
   * Create default state object.
   */
  private createDefaultState(): AppState {
    return {
      version: STATE_VERSION,
      lastSaved: new Date(),
      activeTasks: [],
      settings: { ...DEFAULT_SETTINGS },
      recentProjects: [],
    };
  }

  // ==========================================================================
  // SAVE/LOAD OPERATIONS
  // ==========================================================================

  /**
   * Save current state to disk.
   */
  save(): void {
    try {
      this.state.lastSaved = new Date();

      // Save main state file
      const stateJson = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.statePath, stateJson, 'utf-8');

      // Save individual task files
      for (const task of this.state.activeTasks) {
        this.saveTaskFile(task);
      }

      this.isDirty = false;
      console.log('[StateManager] State saved');
      this.emit('state-saved');
    } catch (error) {
      console.error('[StateManager] Failed to save state:', error);
      this.emit('error', error);
    }
  }

  /**
   * Save a single task to its own file.
   */
  private saveTaskFile(task: TaskState): void {
    try {
      const taskPath = path.join(this.tasksDir, `${task.id}.json`);
      const taskJson = JSON.stringify(task, null, 2);
      fs.writeFileSync(taskPath, taskJson, 'utf-8');
    } catch (error) {
      console.error(`[StateManager] Failed to save task ${task.id}:`, error);
    }
  }

  /**
   * Delete a task file.
   */
  private deleteTaskFile(taskId: string): void {
    try {
      const taskPath = path.join(this.tasksDir, `${taskId}.json`);
      if (fs.existsSync(taskPath)) {
        fs.unlinkSync(taskPath);
      }
    } catch (error) {
      console.error(`[StateManager] Failed to delete task file ${taskId}:`, error);
    }
  }

  /**
   * Schedule an auto-save (debounced).
   */
  private scheduleSave(): void {
    this.isDirty = true;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save();
      this.saveTimeout = null;
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  /**
   * Load state from disk (synchronous).
   */
  private loadSync(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const stateJson = fs.readFileSync(this.statePath, 'utf-8');
        const loadedState = JSON.parse(stateJson) as AppState;

        // Migrate if needed
        this.state = this.migrateState(loadedState);

        // Load individual task files that might be more up-to-date
        this.loadTaskFiles();

        console.log(`[StateManager] Loaded state with ${this.state.activeTasks.length} active tasks`);
        this.emit('state-loaded', this.state);
      } else {
        console.log('[StateManager] No existing state found, using defaults');
      }
    } catch (error) {
      console.error('[StateManager] Failed to load state:', error);
      this.state = this.createDefaultState();
    }
  }

  /**
   * Load state from disk (async version).
   */
  load(): AppState {
    this.loadSync();
    return this.state;
  }

  /**
   * Load individual task files from tasks directory.
   */
  private loadTaskFiles(): void {
    try {
      if (!fs.existsSync(this.tasksDir)) {
        return;
      }

      const files = fs.readdirSync(this.tasksDir);
      const loadedTaskIds = new Set(this.state.activeTasks.map(t => t.id));

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const taskPath = path.join(this.tasksDir, file);
        try {
          const taskJson = fs.readFileSync(taskPath, 'utf-8');
          const task = JSON.parse(taskJson) as TaskState;

          // Convert date strings back to Date objects
          task.startedAt = new Date(task.startedAt);
          task.lastUpdatedAt = new Date(task.lastUpdatedAt);

          // Update or add task
          const existingIndex = this.state.activeTasks.findIndex(t => t.id === task.id);
          if (existingIndex >= 0) {
            // Use file version if it's newer
            if (task.lastUpdatedAt > this.state.activeTasks[existingIndex].lastUpdatedAt) {
              this.state.activeTasks[existingIndex] = task;
            }
          } else if (!loadedTaskIds.has(task.id)) {
            this.state.activeTasks.push(task);
          }
        } catch (error) {
          console.error(`[StateManager] Failed to load task file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('[StateManager] Failed to load task files:', error);
    }
  }

  /**
   * Migrate state from older versions.
   */
  private migrateState(oldState: AppState): AppState {
    // Currently no migrations needed
    // Add version-specific migrations here as needed

    // Ensure all required fields exist
    return {
      version: STATE_VERSION,
      lastSaved: oldState.lastSaved ? new Date(oldState.lastSaved) : new Date(),
      activeTasks: (oldState.activeTasks || []).map(task => ({
        ...task,
        startedAt: new Date(task.startedAt),
        lastUpdatedAt: new Date(task.lastUpdatedAt),
      })),
      settings: { ...DEFAULT_SETTINGS, ...oldState.settings },
      recentProjects: oldState.recentProjects || [],
    };
  }

  // ==========================================================================
  // TASK MANAGEMENT
  // ==========================================================================

  /**
   * Create a new task from a project brief.
   */
  createTask(projectId: string, brief: ProjectBrief): TaskState {
    const task: TaskState = {
      id: uuidv4(),
      projectId,
      brief,
      status: 'pending',
      currentStep: 'Initializing...',
      progress: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      processIds: [],
      output: [],
    };

    this.state.activeTasks.push(task);
    this.scheduleSave();

    this.emit('task-update', {
      taskId: task.id,
      task,
      type: 'created',
    } as TaskUpdateEvent);

    console.log(`[StateManager] Created task ${task.id} for project ${projectId}`);
    return task;
  }

  /**
   * Save/update a task.
   */
  saveTask(task: TaskState): void {
    task.lastUpdatedAt = new Date();

    const index = this.state.activeTasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
      this.state.activeTasks[index] = task;
    } else {
      this.state.activeTasks.push(task);
    }

    this.scheduleSave();

    this.emit('task-update', {
      taskId: task.id,
      task,
      type: 'updated',
    } as TaskUpdateEvent);
  }

  /**
   * Get a task by ID.
   */
  getTask(id: string): TaskState | null {
    return this.state.activeTasks.find(t => t.id === id) || null;
  }

  /**
   * Get all active tasks (not completed/failed).
   */
  getActiveTasks(): TaskState[] {
    return this.state.activeTasks.filter(
      t => t.status === 'pending' || t.status === 'running' || t.status === 'paused'
    );
  }

  /**
   * Get all tasks.
   */
  getAllTasks(): TaskState[] {
    return [...this.state.activeTasks];
  }

  /**
   * Get interrupted tasks (were running when app closed).
   */
  getInterruptedTasks(): TaskState[] {
    return this.state.activeTasks.filter(t => t.status === 'running');
  }

  /**
   * Remove a task.
   */
  removeTask(id: string): void {
    const index = this.state.activeTasks.findIndex(t => t.id === id);
    if (index >= 0) {
      const task = this.state.activeTasks[index];
      this.state.activeTasks.splice(index, 1);
      this.deleteTaskFile(id);
      this.scheduleSave();

      this.emit('task-update', {
        taskId: id,
        task,
        type: 'removed',
      } as TaskUpdateEvent);

      console.log(`[StateManager] Removed task ${id}`);
    }
  }

  /**
   * Update task progress.
   */
  updateTaskProgress(id: string, step: string, progress: number): void {
    const task = this.getTask(id);
    if (task) {
      task.currentStep = step;
      task.progress = Math.max(0, Math.min(100, progress));
      task.lastUpdatedAt = new Date();

      this.scheduleSave();

      this.emit('task-update', {
        taskId: id,
        task,
        type: 'updated',
      } as TaskUpdateEvent);
    }
  }

  /**
   * Update task status.
   */
  updateTaskStatus(id: string, status: TaskStatus, errorMessage?: string): void {
    const task = this.getTask(id);
    if (task) {
      task.status = status;
      task.lastUpdatedAt = new Date();

      if (errorMessage) {
        task.errorMessage = errorMessage;
      }

      if (status === 'completed') {
        task.progress = 100;
      }

      this.scheduleSave();

      const eventType = status === 'completed' ? 'completed' :
                       status === 'failed' ? 'failed' : 'updated';

      this.emit('task-update', {
        taskId: id,
        task,
        type: eventType,
      } as TaskUpdateEvent);

      console.log(`[StateManager] Task ${id} status: ${status}`);
    }
  }

  /**
   * Add a process ID to a task.
   */
  addProcessToTask(taskId: string, processId: string): void {
    const task = this.getTask(taskId);
    if (task && !task.processIds.includes(processId)) {
      task.processIds.push(processId);
      task.lastUpdatedAt = new Date();
      this.scheduleSave();
    }
  }

  /**
   * Remove a process ID from a task.
   */
  removeProcessFromTask(taskId: string, processId: string): void {
    const task = this.getTask(taskId);
    if (task) {
      const index = task.processIds.indexOf(processId);
      if (index >= 0) {
        task.processIds.splice(index, 1);
        task.lastUpdatedAt = new Date();
        this.scheduleSave();
      }
    }
  }

  /**
   * Add output to a task.
   */
  addTaskOutput(taskId: string, output: string): void {
    const task = this.getTask(taskId);
    if (task) {
      if (!task.output) {
        task.output = [];
      }
      task.output.push(output);
      task.lastUpdatedAt = new Date();
      // Don't auto-save on every output line to avoid excessive writes
    }
  }

  // ==========================================================================
  // SETTINGS MANAGEMENT
  // ==========================================================================

  /**
   * Get current settings.
   */
  getSettings(): AppSettings {
    return { ...this.state.settings };
  }

  /**
   * Update settings.
   */
  updateSettings(settings: Partial<AppSettings>): void {
    this.state.settings = { ...this.state.settings, ...settings };
    this.scheduleSave();
  }

  // ==========================================================================
  // RECENT PROJECTS
  // ==========================================================================

  /**
   * Add a project to recent projects list.
   */
  addRecentProject(projectPath: string): void {
    // Remove if already exists
    const index = this.state.recentProjects.indexOf(projectPath);
    if (index >= 0) {
      this.state.recentProjects.splice(index, 1);
    }

    // Add to front
    this.state.recentProjects.unshift(projectPath);

    // Trim to max size
    if (this.state.recentProjects.length > MAX_RECENT_PROJECTS) {
      this.state.recentProjects = this.state.recentProjects.slice(0, MAX_RECENT_PROJECTS);
    }

    this.scheduleSave();
  }

  /**
   * Get recent projects.
   */
  getRecentProjects(): string[] {
    return [...this.state.recentProjects];
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up completed/failed tasks older than specified age.
   */
  cleanupOldTasks(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const initialCount = this.state.activeTasks.length;

    this.state.activeTasks = this.state.activeTasks.filter(task => {
      if (task.status === 'completed' || task.status === 'failed') {
        const age = now - new Date(task.lastUpdatedAt).getTime();
        if (age > maxAgeMs) {
          this.deleteTaskFile(task.id);
          return false;
        }
      }
      return true;
    });

    const removedCount = initialCount - this.state.activeTasks.length;
    if (removedCount > 0) {
      this.scheduleSave();
      console.log(`[StateManager] Cleaned up ${removedCount} old tasks`);
    }

    return removedCount;
  }

  /**
   * Mark all running tasks as interrupted (for app restart).
   */
  markRunningAsInterrupted(): void {
    for (const task of this.state.activeTasks) {
      if (task.status === 'running') {
        task.status = 'paused';
        task.currentStep = 'Interrupted - Resume available';
        task.lastUpdatedAt = new Date();
      }
    }
    this.save(); // Immediate save before quit
  }

  /**
   * Force immediate save (for app quit).
   */
  saveImmediate(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.markRunningAsInterrupted();
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Set up IPC handlers for state management.
 * Called during app initialization.
 */
export function setupStateIPC(): void {
  const manager = getStateManager();

  // Get all active tasks
  ipcMain.handle('state:get-tasks', async (): Promise<TaskState[]> => {
    return manager.getAllTasks();
  });

  // Get a specific task
  ipcMain.handle('state:get-task', async (_event, taskId: string): Promise<TaskState | null> => {
    return manager.getTask(taskId);
  });

  // Get interrupted tasks (for resume on startup)
  ipcMain.handle('state:get-interrupted', async (): Promise<TaskState[]> => {
    return manager.getInterruptedTasks();
  });

  // Update task status
  ipcMain.handle('state:update-status', async (
    _event,
    taskId: string,
    status: TaskStatus,
    errorMessage?: string
  ): Promise<void> => {
    manager.updateTaskStatus(taskId, status, errorMessage);
  });

  // Update task progress
  ipcMain.handle('state:update-progress', async (
    _event,
    taskId: string,
    step: string,
    progress: number
  ): Promise<void> => {
    manager.updateTaskProgress(taskId, step, progress);
  });

  // Remove a task
  ipcMain.handle('state:remove-task', async (_event, taskId: string): Promise<void> => {
    manager.removeTask(taskId);
  });

  // Get settings
  ipcMain.handle('state:get-settings', async (): Promise<AppSettings> => {
    return manager.getSettings();
  });

  // Update settings
  ipcMain.handle('state:update-settings', async (
    _event,
    settings: Partial<AppSettings>
  ): Promise<void> => {
    manager.updateSettings(settings);
  });

  // Get recent projects
  ipcMain.handle('state:get-recent', async (): Promise<string[]> => {
    return manager.getRecentProjects();
  });

  // Clean up old tasks
  ipcMain.handle('state:cleanup', async (_event, maxAgeMs?: number): Promise<number> => {
    return manager.cleanupOldTasks(maxAgeMs);
  });

  console.log('[StateManager] IPC handlers registered');
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let stateManagerInstance: StateManager | null = null;

/**
 * Get the singleton StateManager instance.
 */
export function getStateManager(): StateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager();
  }
  return stateManagerInstance;
}

/**
 * Cleanup function to be called on app quit.
 */
export function cleanupStateManager(): void {
  if (stateManagerInstance) {
    stateManagerInstance.saveImmediate();
    stateManagerInstance.removeAllListeners();
    stateManagerInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// StateManager is already exported at class declaration
