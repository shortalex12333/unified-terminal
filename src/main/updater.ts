/**
 * Unified Terminal - Auto Updater Module
 *
 * Handles automatic updates via electron-updater and GitHub Releases.
 * Provides user-controlled update flow: check -> download -> install on restart.
 */

import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

export interface UpdateEvents {
  'checking': () => void;
  'available': (info: UpdateInfo) => void;
  'not-available': (info: UpdateInfo) => void;
  'progress': (progress: ProgressInfo) => void;
  'downloaded': (info: UpdateDownloadedEvent) => void;
  'error': (error: Error) => void;
}

// ============================================================================
// APP UPDATER CLASS
// ============================================================================

class AppUpdater extends EventEmitter {
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
  };

  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
    this.configureAutoUpdater();
    this.setupEventHandlers();
  }

  /**
   * Configure electron-updater settings
   */
  private configureAutoUpdater(): void {
    // Don't auto-download - let user control when to download
    autoUpdater.autoDownload = false;

    // Auto-install on quit if update is downloaded
    autoUpdater.autoInstallOnAppQuit = true;

    // Allow pre-release versions if current version is pre-release
    autoUpdater.allowPrerelease = false;

    // Allow downgrade (useful for testing)
    autoUpdater.allowDowngrade = false;

    // Disable update checking if not packaged (dev mode)
    // In dev, autoUpdater.checkForUpdates() will throw
    autoUpdater.forceDevUpdateConfig = false;

    // Log for debugging
    autoUpdater.logger = console;
  }

  /**
   * Set up event handlers for autoUpdater events
   */
  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('[Updater] Checking for updates...');
      this.status = {
        ...this.status,
        checking: true,
        error: undefined,
      };
      this.emit('checking');
      this.sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('[Updater] Update available:', info.version);
      this.status = {
        ...this.status,
        checking: false,
        available: true,
        version: info.version,
        releaseNotes: this.formatReleaseNotes(info.releaseNotes),
      };
      this.emit('available', info);
      this.sendToRenderer('updater:available', {
        version: info.version,
        releaseNotes: this.status.releaseNotes,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('[Updater] No update available. Current version:', info.version);
      this.status = {
        ...this.status,
        checking: false,
        available: false,
        version: info.version,
      };
      this.emit('not-available', info);
      this.sendToRenderer('updater:not-available', {
        version: info.version,
      });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const percent = Math.round(progress.percent);
      console.log(`[Updater] Download progress: ${percent}%`);
      this.status = {
        ...this.status,
        downloading: true,
        progress: percent,
      };
      this.emit('progress', progress);
      this.sendToRenderer('updater:progress', {
        percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
      console.log('[Updater] Update downloaded:', info.version);
      this.status = {
        ...this.status,
        downloading: false,
        downloaded: true,
        progress: 100,
        version: info.version,
        releaseNotes: this.formatReleaseNotes(info.releaseNotes),
      };
      this.emit('downloaded', info);
      this.sendToRenderer('updater:ready', {
        version: info.version,
        releaseNotes: this.status.releaseNotes,
      });
    });

    autoUpdater.on('error', (error: Error) => {
      console.error('[Updater] Error:', error.message);
      this.status = {
        ...this.status,
        checking: false,
        downloading: false,
        error: error.message,
      };
      this.emit('error', error);
      this.sendToRenderer('updater:error', {
        message: error.message,
      });
    });
  }

  /**
   * Format release notes from various formats to a string
   */
  private formatReleaseNotes(notes: string | ReleaseNoteInfo[] | null | undefined): string | undefined {
    if (!notes) return undefined;

    if (typeof notes === 'string') {
      return notes;
    }

    // Array of release notes objects
    if (Array.isArray(notes)) {
      return notes
        .map(note => `${note.version}:\n${note.note}`)
        .join('\n\n');
    }

    return undefined;
  }

  /**
   * Send event to renderer process
   */
  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Set the main window reference for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Check for available updates
   * @returns UpdateInfo if update is available, null otherwise
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      console.log('[Updater] Starting update check...');
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo ?? null;
    } catch (error) {
      console.error('[Updater] Check failed:', error);
      // In development mode, this is expected to fail
      if ((error as Error).message?.includes('dev-app-update.yml')) {
        console.log('[Updater] Running in development mode - updates disabled');
        return null;
      }
      throw error;
    }
  }

  /**
   * Download the available update
   */
  async downloadUpdate(): Promise<void> {
    if (!this.status.available) {
      throw new Error('No update available to download');
    }

    console.log('[Updater] Starting download...');
    this.status.downloading = true;
    await autoUpdater.downloadUpdate();
  }

  /**
   * Install the downloaded update and restart the app
   * Note: This will quit the app and install the update
   */
  installUpdate(): void {
    if (!this.status.downloaded) {
      throw new Error('No update downloaded to install');
    }

    console.log('[Updater] Installing update and restarting...');
    // This will quit the app, install the update, and restart
    autoUpdater.quitAndInstall(
      true,  // isSilent: whether to run installer silently
      true   // isForceRunAfter: whether to run the app after install
    );
  }

  /**
   * Get current update status
   */
  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  /**
   * Reset the updater status (useful after dismissing an update)
   */
  resetStatus(): void {
    this.status = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
    };
  }
}

// ============================================================================
// TYPE FOR RELEASE NOTES
// ============================================================================

interface ReleaseNoteInfo {
  version: string;
  note: string | null;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let updaterInstance: AppUpdater | null = null;

/**
 * Get or create the AppUpdater singleton
 */
export function getUpdater(): AppUpdater {
  if (!updaterInstance) {
    updaterInstance = new AppUpdater();
  }
  return updaterInstance;
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Set up IPC handlers for updater operations
 * @param getMainWindow - Function to get the current main window reference
 */
export function setupUpdaterIPC(getMainWindow: () => BrowserWindow | null): void {
  const updater = getUpdater();

  // Update main window reference when it changes
  const mainWindow = getMainWindow();
  if (mainWindow) {
    updater.setMainWindow(mainWindow);
  }

  /**
   * IPC: Check for updates
   * @returns Object with available status and update info
   */
  ipcMain.handle('updater:check', async (): Promise<{
    available: boolean;
    version?: string;
    releaseNotes?: string;
    error?: string;
  }> => {
    console.log('[IPC] updater:check called');

    try {
      const info = await updater.checkForUpdates();
      const status = updater.getStatus();

      return {
        available: status.available,
        version: info?.version,
        releaseNotes: status.releaseNotes,
      };
    } catch (error) {
      return {
        available: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * IPC: Download available update
   * @returns Success status
   */
  ipcMain.handle('updater:download', async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    console.log('[IPC] updater:download called');

    try {
      await updater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * IPC: Install downloaded update (quits and restarts app)
   */
  ipcMain.handle('updater:install', async (): Promise<void> => {
    console.log('[IPC] updater:install called');
    updater.installUpdate();
    // Note: App will quit, so this never returns
  });

  /**
   * IPC: Get current update status
   * @returns Current UpdateStatus
   */
  ipcMain.handle('updater:status', async (): Promise<UpdateStatus> => {
    console.log('[IPC] updater:status called');
    return updater.getStatus();
  });

  /**
   * IPC: Reset update status (dismiss update notification)
   */
  ipcMain.handle('updater:reset', async (): Promise<void> => {
    console.log('[IPC] updater:reset called');
    updater.resetStatus();
  });
}

/**
 * Check for updates after a delay (to let the app settle)
 * @param delayMs - Delay in milliseconds before checking (default: 5000)
 */
export function checkForUpdatesAfterDelay(delayMs: number = 5000): void {
  setTimeout(async () => {
    const updater = getUpdater();
    try {
      console.log('[Updater] Running startup update check...');
      await updater.checkForUpdates();
    } catch (error) {
      // Silently handle errors on startup check
      // The error will be logged by the event handler
      console.log('[Updater] Startup check completed (may have failed in dev mode)');
    }
  }, delayMs);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  AppUpdater,
  UpdateInfo,
  ProgressInfo,
};
