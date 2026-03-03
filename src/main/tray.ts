/**
 * Tray Manager - System Tray Icon and Background Execution
 *
 * Gate 11: Task Persistence + Background Execution
 *
 * Handles:
 * - System tray icon with status updates
 * - Context menu for quick actions
 * - Notifications for task completion
 * - Preventing macOS App Nap when tasks are running
 */

import {
  app,
  Tray,
  Menu,
  nativeImage,
  Notification,
  BrowserWindow,
  powerSaveBlocker,
} from 'electron';
import * as path from 'path';
import { EventEmitter } from 'events';
import { getStateManager, TaskState, TaskStatus } from './state-manager';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TrayStatus {
  /** Whether any tasks are currently running */
  hasRunningTasks: boolean;
  /** Number of active tasks */
  activeTaskCount: number;
  /** Current status message */
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Status messages for different states
const STATUS_MESSAGES = {
  idle: 'Unified Terminal - Ready',
  running: (count: number) => `Running ${count} task${count > 1 ? 's' : ''}`,
  paused: (count: number) => `${count} task${count > 1 ? 's' : ''} paused`,
  completed: 'Task completed',
  failed: 'Task failed',
};

// ============================================================================
// TRAY MANAGER CLASS
// ============================================================================

/**
 * TrayManager - Manages system tray icon, notifications, and App Nap prevention.
 *
 * Events:
 * - 'show-window': () - User clicked show window
 * - 'quit-app': () - User clicked quit
 * - 'toggle-auto-resume': (enabled: boolean) - Auto-resume setting toggled
 */
export class TrayManager extends EventEmitter {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private powerSaveBlockerId: number | null = null;
  private currentStatus: TrayStatus = {
    hasRunningTasks: false,
    activeTaskCount: 0,
    message: STATUS_MESSAGES.idle,
  };

  constructor() {
    super();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Create and configure the system tray icon.
   */
  create(mainWindow?: BrowserWindow): void {
    if (this.tray) {
      console.log('[TrayManager] Tray already exists');
      return;
    }

    if (mainWindow) {
      this.mainWindow = mainWindow;
    }

    // Create tray icon
    const icon = this.createTrayIcon('idle');
    this.tray = new Tray(icon);

    // Set tooltip
    this.tray.setToolTip(STATUS_MESSAGES.idle);

    // Build initial context menu
    this.updateContextMenu();

    // Handle click events (macOS: show app on click)
    this.tray.on('click', () => {
      this.showMainWindow();
    });

    // Handle double-click (Windows)
    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    // Subscribe to state manager events
    this.subscribeToStateEvents();

    console.log('[TrayManager] Tray icon created');
  }

  /**
   * Set the main window reference.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Create a tray icon image.
   */
  private createTrayIcon(status: 'idle' | 'running' | 'error'): Electron.NativeImage {
    // For production, use proper icon assets
    // For now, create a simple programmatic icon
    const size = 16;

    // Try to load from assets first
    const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        return icon.resize({ width: size, height: size });
      }
    } catch {
      // Fall through to generated icon
    }

    // Generate a simple icon programmatically
    // This is a placeholder - in production use proper assets
    const canvas = this.generateIconCanvas(size, status);
    return nativeImage.createFromDataURL(canvas);
  }

  /**
   * Generate a simple icon canvas (placeholder).
   */
  private generateIconCanvas(size: number, status: 'idle' | 'running' | 'error'): string {
    // Create a simple SVG-based icon
    const colors = {
      idle: '#4a90d9',     // Blue
      running: '#4caf50',   // Green
      error: '#f44336',     // Red
    };

    const color = colors[status];

    // Create a simple circle icon as SVG
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}"/>
        ${status === 'running' ? `
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="white"/>
        ` : ''}
        ${status === 'error' ? `
          <line x1="${size * 0.3}" y1="${size * 0.3}" x2="${size * 0.7}" y2="${size * 0.7}" stroke="white" stroke-width="2"/>
          <line x1="${size * 0.7}" y1="${size * 0.3}" x2="${size * 0.3}" y2="${size * 0.7}" stroke="white" stroke-width="2"/>
        ` : ''}
      </svg>
    `;

    // Convert SVG to data URL
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  // ==========================================================================
  // STATUS UPDATES
  // ==========================================================================

  /**
   * Update tray status based on current tasks.
   */
  updateStatus(status: string): void {
    if (!this.tray) return;

    this.tray.setToolTip(status);
    this.currentStatus.message = status;
  }

  /**
   * Update tray based on task state.
   */
  private updateFromTasks(): void {
    const stateManager = getStateManager();
    const activeTasks = stateManager.getActiveTasks();

    const runningCount = activeTasks.filter(t => t.status === 'running').length;
    const pausedCount = activeTasks.filter(t => t.status === 'paused').length;

    this.currentStatus = {
      hasRunningTasks: runningCount > 0,
      activeTaskCount: activeTasks.length,
      message: runningCount > 0
        ? STATUS_MESSAGES.running(runningCount)
        : pausedCount > 0
          ? STATUS_MESSAGES.paused(pausedCount)
          : STATUS_MESSAGES.idle,
    };

    // Update tray
    if (this.tray) {
      this.tray.setToolTip(this.currentStatus.message);

      // Update icon based on status
      const iconStatus = runningCount > 0 ? 'running' : 'idle';
      this.tray.setImage(this.createTrayIcon(iconStatus));
    }

    // Update context menu
    this.updateContextMenu();

    // Manage App Nap
    if (runningCount > 0) {
      this.preventAppNap();
    } else {
      this.allowAppNap();
    }
  }

  /**
   * Subscribe to state manager task events.
   */
  private subscribeToStateEvents(): void {
    const stateManager = getStateManager();

    stateManager.on('task-update', (event) => {
      this.updateFromTasks();

      // Show notification for completed/failed tasks
      if (event.type === 'completed') {
        this.showNotification(
          'Task Completed',
          `${event.task.brief.category || 'Task'} completed successfully`
        );
      } else if (event.type === 'failed') {
        this.showNotification(
          'Task Failed',
          event.task.errorMessage || 'An error occurred'
        );
      }
    });
  }

  // ==========================================================================
  // CONTEXT MENU
  // ==========================================================================

  /**
   * Update the context menu.
   */
  private updateContextMenu(): void {
    if (!this.tray) return;

    const stateManager = getStateManager();
    const activeTasks = stateManager.getActiveTasks();
    const settings = stateManager.getSettings();

    const menuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: this.currentStatus.message,
        enabled: false,
      },
      { type: 'separator' },
    ];

    // Add task items
    if (activeTasks.length > 0) {
      menuItems.push({
        label: 'Active Tasks',
        enabled: false,
      });

      for (const task of activeTasks.slice(0, 5)) {
        const statusIcon = this.getStatusIcon(task.status);
        menuItems.push({
          label: `${statusIcon} ${task.brief.category || task.id} - ${task.currentStep}`,
          click: () => this.showMainWindow(),
        });
      }

      if (activeTasks.length > 5) {
        menuItems.push({
          label: `... and ${activeTasks.length - 5} more`,
          enabled: false,
        });
      }

      menuItems.push({ type: 'separator' });
    }

    // Settings submenu
    menuItems.push({
      label: 'Settings',
      submenu: [
        {
          label: 'Auto-resume on startup',
          type: 'checkbox',
          checked: settings.autoResumeOnStartup,
          click: (menuItem) => {
            stateManager.updateSettings({ autoResumeOnStartup: menuItem.checked });
            this.emit('toggle-auto-resume', menuItem.checked);
          },
        },
        {
          label: 'Show notifications',
          type: 'checkbox',
          checked: settings.showNotifications,
          click: (menuItem) => {
            stateManager.updateSettings({ showNotifications: menuItem.checked });
          },
        },
        {
          label: 'Minimize to tray',
          type: 'checkbox',
          checked: settings.minimizeToTray,
          click: (menuItem) => {
            stateManager.updateSettings({ minimizeToTray: menuItem.checked });
          },
        },
      ],
    });

    menuItems.push({ type: 'separator' });

    // Window controls
    menuItems.push({
      label: 'Show Window',
      click: () => this.showMainWindow(),
    });

    menuItems.push({ type: 'separator' });

    // Quit
    menuItems.push({
      label: 'Quit',
      click: () => {
        this.emit('quit-app');
        app.quit();
      },
    });

    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Get a status icon for a task status.
   */
  private getStatusIcon(status: TaskStatus): string {
    switch (status) {
      case 'running':
        return '>';  // Running indicator
      case 'paused':
        return '||'; // Pause indicator
      case 'completed':
        return '+';  // Check indicator
      case 'failed':
        return 'X';  // Error indicator
      case 'pending':
      default:
        return '-';  // Pending indicator
    }
  }

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================

  /**
   * Show a system notification.
   */
  showNotification(title: string, body: string): void {
    const stateManager = getStateManager();
    const settings = stateManager.getSettings();

    if (!settings.showNotifications) {
      return;
    }

    // Check if notifications are supported
    if (!Notification.isSupported()) {
      console.log('[TrayManager] Notifications not supported');
      return;
    }

    const notification = new Notification({
      title,
      body,
      silent: false,
    });

    notification.on('click', () => {
      this.showMainWindow();
    });

    notification.show();
  }

  // ==========================================================================
  // APP NAP PREVENTION
  // ==========================================================================

  /**
   * Prevent macOS App Nap (keeps tasks running in background).
   */
  preventAppNap(): void {
    if (this.powerSaveBlockerId !== null) {
      // Already blocking
      return;
    }

    try {
      this.powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      console.log('[TrayManager] App Nap prevention started');
    } catch (error) {
      console.error('[TrayManager] Failed to start power save blocker:', error);
    }
  }

  /**
   * Allow macOS App Nap (when no tasks are running).
   */
  allowAppNap(): void {
    if (this.powerSaveBlockerId === null) {
      // Not blocking
      return;
    }

    try {
      powerSaveBlocker.stop(this.powerSaveBlockerId);
      this.powerSaveBlockerId = null;
      console.log('[TrayManager] App Nap prevention stopped');
    } catch (error) {
      console.error('[TrayManager] Failed to stop power save blocker:', error);
    }
  }

  /**
   * Check if App Nap is being prevented.
   */
  isPreventingAppNap(): boolean {
    return this.powerSaveBlockerId !== null;
  }

  // ==========================================================================
  // WINDOW MANAGEMENT
  // ==========================================================================

  /**
   * Show and focus the main window.
   */
  private showMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.focus();
    }
    this.emit('show-window');
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Destroy the tray icon.
   */
  destroy(): void {
    this.allowAppNap();

    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    this.removeAllListeners();
    console.log('[TrayManager] Tray destroyed');
  }

  /**
   * Check if tray is created.
   */
  isCreated(): boolean {
    return this.tray !== null;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let trayManagerInstance: TrayManager | null = null;

/**
 * Get the singleton TrayManager instance.
 */
export function getTrayManager(): TrayManager {
  if (!trayManagerInstance) {
    trayManagerInstance = new TrayManager();
  }
  return trayManagerInstance;
}

/**
 * Cleanup function to be called on app quit.
 */
export function cleanupTrayManager(): void {
  if (trayManagerInstance) {
    trayManagerInstance.destroy();
    trayManagerInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Note: TrayManager is already exported from its class declaration
