/**
 * Preview Manager - Live Preview BrowserView for Dev Servers
 *
 * Manages a second BrowserView that shows live preview of websites being built.
 * Integrates with file-watcher for hot-reload functionality.
 * Auto-detects running dev servers on common ports.
 */

import { BrowserWindow, BrowserView } from 'electron';
import { EventEmitter } from 'events';
import * as net from 'net';
import { getFileWatcher, FileChange } from './file-watcher';

// ============================================================================
// TYPES
// ============================================================================

export interface PreviewConfig {
  /** URL to display in preview */
  url: string;
  /** Port number (extracted from URL or set manually) */
  port: number;
  /** Whether preview is currently visible */
  visible: boolean;
  /** Auto-refresh on file changes */
  autoRefresh: boolean;
  /** Debounce delay for refresh (ms) */
  refreshDebounce: number;
}

export interface ServerDetectionResult {
  /** Whether a server was detected */
  found: boolean;
  /** The port where server was found */
  port?: number;
  /** Full URL to the server */
  url?: string;
  /** All ports that were checked */
  checkedPorts: number[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Common dev server ports to check */
const COMMON_PORTS = [3000, 5173, 8080, 4000, 8000, 5000, 3001, 4200, 8888];

/** Default preview configuration */
const DEFAULT_CONFIG: PreviewConfig = {
  url: '',
  port: 0,
  visible: false,
  autoRefresh: true,
  refreshDebounce: 500,
};

/** Preview panel width as percentage of window */
const PREVIEW_WIDTH_PERCENT = 0.4;

/** Minimum preview width in pixels */
const MIN_PREVIEW_WIDTH = 320;

/** Maximum preview width in pixels */
const MAX_PREVIEW_WIDTH = 800;

// ============================================================================
// PREVIEW MANAGER CLASS
// ============================================================================

/**
 * PreviewManager handles the live preview BrowserView.
 * Singleton pattern - use getPreviewManager() to get instance.
 */
export class PreviewManager extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private previewView: BrowserView | null = null;
  private config: PreviewConfig = { ...DEFAULT_CONFIG };
  private refreshTimer: NodeJS.Timeout | null = null;
  private fileWatcherCleanup: (() => void) | null = null;

  constructor() {
    super();
  }

  /**
   * Set the main window reference.
   * Must be called before using show/hide methods.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;

    // Update preview bounds when window resizes
    window.on('resize', () => {
      if (this.previewView && this.config.visible) {
        this.updateBounds();
      }
    });

    console.log('[PreviewManager] Main window set');
  }

  /**
   * Show preview panel with the given URL.
   * Creates BrowserView if needed, loads URL, and positions panel.
   */
  async show(url: string): Promise<{ success: boolean; error?: string }> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return { success: false, error: 'Main window not available' };
    }

    try {
      // Parse URL to extract port
      const urlObj = new URL(url);
      const port = parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80);

      // Update config
      this.config.url = url;
      this.config.port = port;
      this.config.visible = true;

      // Create or reuse BrowserView
      if (!this.previewView) {
        this.previewView = new BrowserView({
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });

        // Set up error handling
        this.previewView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
          console.error(`[PreviewManager] Failed to load: ${errorCode} ${errorDescription}`);
          this.emit('load-error', { errorCode, errorDescription, url: this.config.url });
        });

        this.previewView.webContents.on('did-finish-load', () => {
          console.log(`[PreviewManager] Loaded: ${this.config.url}`);
          this.emit('loaded', { url: this.config.url });
        });

        // Handle console messages for debugging
        this.previewView.webContents.on('console-message', (event, level, message) => {
          if (level >= 2) { // Warning or error
            console.log(`[Preview Console] ${message}`);
          }
        });
      }

      // Attach to window and position
      this.mainWindow.addBrowserView(this.previewView);
      this.updateBounds();

      // Load the URL
      await this.previewView.webContents.loadURL(url);

      // Set up file watcher integration for auto-refresh
      if (this.config.autoRefresh) {
        this.setupFileWatcher();
      }

      this.emit('shown', { url, port });
      console.log(`[PreviewManager] Showing preview: ${url}`);

      return { success: true };
    } catch (error) {
      console.error('[PreviewManager] Error showing preview:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Hide the preview panel.
   * Removes BrowserView from window but keeps it in memory.
   */
  hide(): { success: boolean } {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return { success: false };
    }

    if (this.previewView) {
      this.mainWindow.removeBrowserView(this.previewView);
      this.config.visible = false;
      this.cleanupFileWatcher();
      this.emit('hidden');
      console.log('[PreviewManager] Preview hidden');
    }

    return { success: true };
  }

  /**
   * Refresh the preview by reloading the current URL.
   */
  async refresh(): Promise<{ success: boolean; error?: string }> {
    if (!this.previewView || !this.config.visible) {
      return { success: false, error: 'Preview not visible' };
    }

    try {
      await this.previewView.webContents.reload();
      this.emit('refreshed', { url: this.config.url });
      console.log('[PreviewManager] Preview refreshed');
      return { success: true };
    } catch (error) {
      console.error('[PreviewManager] Error refreshing:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Set the port and construct localhost URL.
   * Convenience method when you know the port but not full URL.
   */
  async setPort(port: number): Promise<{ success: boolean; error?: string }> {
    const url = `http://localhost:${port}`;
    return this.show(url);
  }

  /**
   * Auto-detect running dev server on common ports.
   * Returns the first port that responds.
   */
  async detectServer(): Promise<ServerDetectionResult> {
    const checkedPorts: number[] = [];

    for (const port of COMMON_PORTS) {
      checkedPorts.push(port);
      const isOpen = await this.checkPort(port);

      if (isOpen) {
        const url = `http://localhost:${port}`;
        console.log(`[PreviewManager] Detected server on port ${port}`);
        return {
          found: true,
          port,
          url,
          checkedPorts,
        };
      }
    }

    console.log('[PreviewManager] No server detected on common ports');
    return {
      found: false,
      checkedPorts,
    };
  }

  /**
   * Check if a port is open (has a server listening).
   */
  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 200; // 200ms timeout per port

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Update BrowserView bounds to position as right panel.
   */
  private updateBounds(): void {
    if (!this.mainWindow || !this.previewView) return;

    const [windowWidth, windowHeight] = this.mainWindow.getContentSize();

    // Calculate preview width
    let previewWidth = Math.floor(windowWidth * PREVIEW_WIDTH_PERCENT);
    previewWidth = Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, previewWidth));

    // Position on right side
    const x = windowWidth - previewWidth;
    const y = 0;
    const height = windowHeight;

    this.previewView.setBounds({
      x,
      y,
      width: previewWidth,
      height,
    });

    console.log(`[PreviewManager] Bounds set: ${previewWidth}x${height} at (${x}, ${y})`);
  }

  /**
   * Set up file watcher integration for auto-refresh.
   */
  private setupFileWatcher(): void {
    this.cleanupFileWatcher();

    const fileWatcher = getFileWatcher();

    const handleChange = (change: FileChange) => {
      // Debounce refresh
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }

      this.refreshTimer = setTimeout(() => {
        if (this.config.visible && this.config.autoRefresh) {
          console.log(`[PreviewManager] File changed: ${change.path}, refreshing...`);
          this.refresh();
        }
      }, this.config.refreshDebounce);
    };

    fileWatcher.on('change', handleChange);

    this.fileWatcherCleanup = () => {
      fileWatcher.off('change', handleChange);
    };

    console.log('[PreviewManager] File watcher integration enabled');
  }

  /**
   * Clean up file watcher listener.
   */
  private cleanupFileWatcher(): void {
    if (this.fileWatcherCleanup) {
      this.fileWatcherCleanup();
      this.fileWatcherCleanup = null;
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Get current preview configuration.
   */
  getConfig(): PreviewConfig {
    return { ...this.config };
  }

  /**
   * Set auto-refresh enabled/disabled.
   */
  setAutoRefresh(enabled: boolean): void {
    this.config.autoRefresh = enabled;

    if (enabled && this.config.visible) {
      this.setupFileWatcher();
    } else {
      this.cleanupFileWatcher();
    }

    console.log(`[PreviewManager] Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set refresh debounce delay.
   */
  setRefreshDebounce(ms: number): void {
    this.config.refreshDebounce = Math.max(100, Math.min(5000, ms));
    console.log(`[PreviewManager] Refresh debounce set to ${this.config.refreshDebounce}ms`);
  }

  /**
   * Check if preview is currently visible.
   */
  isVisible(): boolean {
    return this.config.visible;
  }

  /**
   * Get current URL being previewed.
   */
  getCurrentUrl(): string {
    return this.config.url;
  }

  /**
   * Navigate to a new URL within the preview.
   */
  async navigate(url: string): Promise<{ success: boolean; error?: string }> {
    if (!this.previewView || !this.config.visible) {
      return { success: false, error: 'Preview not visible' };
    }

    try {
      this.config.url = url;
      await this.previewView.webContents.loadURL(url);
      this.emit('navigated', { url });
      console.log(`[PreviewManager] Navigated to: ${url}`);
      return { success: true };
    } catch (error) {
      console.error('[PreviewManager] Navigation error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Open DevTools for the preview (for debugging).
   */
  openDevTools(): void {
    if (this.previewView) {
      this.previewView.webContents.openDevTools({ mode: 'detach' });
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.cleanupFileWatcher();

    if (this.previewView && this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.removeBrowserView(this.previewView);
    }

    if (this.previewView && !this.previewView.webContents.isDestroyed()) {
      this.previewView.webContents.close();
    }

    this.previewView = null;
    this.mainWindow = null;
    this.removeAllListeners();

    console.log('[PreviewManager] Destroyed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let previewManagerInstance: PreviewManager | null = null;

/**
 * Get the singleton PreviewManager instance.
 */
export function getPreviewManager(): PreviewManager {
  if (!previewManagerInstance) {
    previewManagerInstance = new PreviewManager();
  }
  return previewManagerInstance;
}

/**
 * Clean up the PreviewManager instance.
 */
export function cleanupPreviewManager(): void {
  if (previewManagerInstance) {
    previewManagerInstance.destroy();
    previewManagerInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  COMMON_PORTS,
  DEFAULT_CONFIG,
  PREVIEW_WIDTH_PERCENT,
  MIN_PREVIEW_WIDTH,
  MAX_PREVIEW_WIDTH,
};
