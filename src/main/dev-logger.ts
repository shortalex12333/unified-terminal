/**
 * Development Logger - Streams backend events to renderer's Developer Console
 *
 * This module captures:
 * - CLI process spawns and output
 * - Conductor classification and DAG decisions
 * - Step scheduler events
 * - MCP connection status
 *
 * Only active when DEV_MODE is enabled.
 */

import { BrowserWindow } from 'electron';

type LogSource = 'cli' | 'conductor' | 'scheduler' | 'mcp' | 'system';
type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface DevLogEntry {
  source: LogSource;
  level: LogLevel;
  message: string;
  details?: string;
}

interface CLIProcessEvent {
  action: 'start' | 'end';
  id: string;
  command: string;
  pid?: number;
  success?: boolean;
}

class DevLogger {
  private static instance: DevLogger | null = null;
  private mainWindow: BrowserWindow | null = null;
  private enabled = true; // Always enabled for now; can be toggled

  private constructor() {}

  static getInstance(): DevLogger {
    if (!DevLogger.instance) {
      DevLogger.instance = new DevLogger();
    }
    return DevLogger.instance;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Send a log entry to the Developer Console
   */
  log(source: LogSource, level: LogLevel, message: string, details?: string): void {
    if (!this.enabled || !this.mainWindow) return;

    const entry: DevLogEntry = { source, level, message, details };

    try {
      this.mainWindow.webContents.send('dev-log', entry);
    } catch (err) {
      // Window might be closed, ignore
    }

    // Also log to terminal for debugging
    const prefix = `[DEV:${source.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }
  }

  /**
   * Track CLI process lifecycle
   */
  cliProcess(event: CLIProcessEvent): void {
    if (!this.enabled || !this.mainWindow) return;

    try {
      this.mainWindow.webContents.send('cli-process', event);
    } catch (err) {
      // Window might be closed, ignore
    }
  }

  // Convenience methods for each source
  cli(level: LogLevel, message: string, details?: string): void {
    this.log('cli', level, message, details);
  }

  conductor(level: LogLevel, message: string, details?: string): void {
    this.log('conductor', level, message, details);
  }

  scheduler(level: LogLevel, message: string, details?: string): void {
    this.log('scheduler', level, message, details);
  }

  mcp(level: LogLevel, message: string, details?: string): void {
    this.log('mcp', level, message, details);
  }

  system(level: LogLevel, message: string, details?: string): void {
    this.log('system', level, message, details);
  }
}

// Export singleton instance
export const devLog = DevLogger.getInstance();
export function getDevLogger(): DevLogger {
  return DevLogger.getInstance();
}
