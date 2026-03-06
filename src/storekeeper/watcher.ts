/**
 * Watcher Module — Monitor .kenoki/requests/ for new tool requests
 *
 * The StorekeeperWatcher watches for new request files and triggers
 * the processing pipeline when workers submit tool requests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  ToolRequest,
  ToolResponse,
  Inventory,
  ExecutionContext,
  STOREKEEPER_CONSTANTS,
} from './types';
import { parseRequest, validateSignature } from './request-parser';
import { processApproval } from './approval-engine';
import { injectTools } from './injector';
import { registerContext, cleanupStep, cleanupRequestFiles } from './cleanup';
import { writeCheckoutLog, logRequest, logResponse } from './audit';
import { loadInventory } from './inventory';

// =============================================================================
// WATCHER EVENTS
// =============================================================================

export interface WatcherEvents {
  /** New request file detected */
  requestDetected: (stepId: string, filePath: string) => void;

  /** Request successfully processed */
  requestProcessed: (stepId: string, response: ToolResponse) => void;

  /** Tools injected and context ready */
  contextReady: (stepId: string, context: ExecutionContext) => void;

  /** Processing error occurred */
  error: (stepId: string, error: Error) => void;

  /** Watcher started */
  started: (watchDir: string) => void;

  /** Watcher stopped */
  stopped: () => void;
}

// =============================================================================
// STOREKEEPER WATCHER CLASS
// =============================================================================

/**
 * StorekeeperWatcher — Monitors the requests directory and processes tool requests.
 */
export class StorekeeperWatcher extends EventEmitter {
  private watching: boolean = false;
  private watchDir: string = '';
  private projectDir: string = '';
  private watcher: fs.FSWatcher | null = null;
  private inventory: Inventory | null = null;
  private processingQueue: Set<string> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly debounceMs: number = 100;
  private readonly pollIntervalMs: number = 1000;
  private pendingFiles: Map<string, NodeJS.Timeout> = new Map();

  constructor(options?: {
    debounceMs?: number;
    pollIntervalMs?: number;
  }) {
    super();
    if (options?.debounceMs) {
      this.debounceMs = options.debounceMs;
    }
    if (options?.pollIntervalMs) {
      this.pollIntervalMs = options.pollIntervalMs;
    }
  }

  /**
   * Start watching a directory for request files.
   *
   * @param dir Directory to watch (typically .kenoki/requests/)
   * @param options Watch options
   */
  watch(
    dir: string,
    options?: {
      projectDir?: string;
      skillsPath?: string;
      mcpConfigPath?: string;
    }
  ): void {
    if (this.watching) {
      console.warn('[Watcher] Already watching:', this.watchDir);
      return;
    }

    this.watchDir = dir;
    this.projectDir = options?.projectDir || path.dirname(path.dirname(dir));

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load inventory
    this.inventory = loadInventory({
      skillsPath: options?.skillsPath,
      mcpConfigPath: options?.mcpConfigPath,
    });

    console.log('[Watcher] Loaded inventory:');
    console.log('[Watcher]   Skills:', this.inventory.skills.length);
    console.log('[Watcher]   MCP:', this.inventory.mcp.length);
    console.log('[Watcher]   Plugins:', this.inventory.plugins.length);

    // Start fs.watch
    try {
      this.watcher = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
          this.handleFileChange(eventType, filename);
        }
      });

      this.watcher.on('error', (error) => {
        console.error('[Watcher] Watch error:', error);
        this.emit('error', '', error);
      });
    } catch (error) {
      console.error('[Watcher] Failed to start fs.watch:', error);
    }

    // Start polling as fallback (some systems don't fire watch events reliably)
    this.pollInterval = setInterval(() => {
      this.pollDirectory();
    }, this.pollIntervalMs);

    this.watching = true;

    // Process any existing files
    this.pollDirectory();

    console.log('[Watcher] Started watching:', dir);
    this.emit('started', dir);
  }

  /**
   * Stop watching.
   */
  stop(): void {
    if (!this.watching) {
      return;
    }

    // Stop fs.watch
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Clear pending debounce timers
    for (const timeout of this.pendingFiles.values()) {
      clearTimeout(timeout);
    }
    this.pendingFiles.clear();

    this.watching = false;
    console.log('[Watcher] Stopped watching:', this.watchDir);
    this.emit('stopped');
  }

  /**
   * Check if currently watching.
   */
  isWatching(): boolean {
    return this.watching;
  }

  /**
   * Get the current inventory.
   */
  getInventory(): Inventory | null {
    return this.inventory;
  }

  /**
   * Reload the inventory.
   */
  reloadInventory(options?: {
    skillsPath?: string;
    mcpConfigPath?: string;
  }): void {
    this.inventory = loadInventory({
      skillsPath: options?.skillsPath,
      mcpConfigPath: options?.mcpConfigPath,
    });
    console.log('[Watcher] Reloaded inventory');
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Handle file change event from fs.watch.
   */
  private handleFileChange(eventType: string, filename: string): void {
    // Debounce: wait for file to be fully written
    const existing = this.pendingFiles.get(filename);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      this.pendingFiles.delete(filename);
      const filePath = path.join(this.watchDir, filename);
      if (fs.existsSync(filePath)) {
        this.processFile(filePath);
      }
    }, this.debounceMs);

    this.pendingFiles.set(filename, timeout);
  }

  /**
   * Poll directory for new files (fallback).
   */
  private pollDirectory(): void {
    if (!fs.existsSync(this.watchDir)) {
      return;
    }

    const files = fs.readdirSync(this.watchDir);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(this.watchDir, file);
        const stepId = file.replace(/\.(yaml|yml)$/, '');

        // Skip if already processing
        if (!this.processingQueue.has(stepId)) {
          this.processFile(filePath);
        }
      }
    }
  }

  /**
   * Process a request file.
   */
  private async processFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const stepId = filename.replace(/\.(yaml|yml)$/, '');

    // Skip if already processing
    if (this.processingQueue.has(stepId)) {
      return;
    }

    this.processingQueue.add(stepId);
    console.log('[Watcher] Processing request:', stepId);

    try {
      // Parse request
      const request = parseRequest(filePath);
      if (!request) {
        throw new Error('Failed to parse request file');
      }

      this.emit('requestDetected', stepId, filePath);

      // Validate signature
      if (!validateSignature(request)) {
        throw new Error('Invalid request signature');
      }

      // Log request to audit
      logRequest(request, this.projectDir);

      // Process through approval engine
      if (!this.inventory) {
        throw new Error('Inventory not loaded');
      }

      const response = processApproval(request, this.inventory);
      this.emit('requestProcessed', stepId, response);

      // Log response to audit
      logResponse(response, this.projectDir);

      // Write response file
      const responseDir = path.join(
        this.projectDir,
        STOREKEEPER_CONSTANTS.KENOKI_DIR,
        STOREKEEPER_CONSTANTS.RESPONSES_DIR
      );
      if (!fs.existsSync(responseDir)) {
        fs.mkdirSync(responseDir, { recursive: true });
      }

      const responsePath = path.join(responseDir, `${stepId}.yaml`);
      const yaml = await import('yaml');
      fs.writeFileSync(responsePath, yaml.stringify(response), 'utf-8');

      // If not denied, inject tools
      if (response.status !== 'DENIED') {
        const context = injectTools(response, this.inventory);
        registerContext(stepId, context);
        this.emit('contextReady', stepId, context);
      }

      // Remove request file (processed)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.log('[Watcher] Request processed:', stepId, 'Status:', response.status);
    } catch (error) {
      console.error('[Watcher] Error processing request:', stepId, error);
      this.emit('error', stepId, error as Error);
    } finally {
      this.processingQueue.delete(stepId);
    }
  }

  // ===========================================================================
  // CALLBACK REGISTRATION (for compatibility)
  // ===========================================================================

  /**
   * Register a callback for when requests are received.
   *
   * @param callback Function to call when request is detected
   */
  onRequest(callback: (stepId: string, filePath: string) => void): void {
    this.on('requestDetected', callback);
  }

  /**
   * Register a callback for when context is ready.
   *
   * @param callback Function to call when context is ready
   */
  onContextReady(callback: (stepId: string, context: ExecutionContext) => void): void {
    this.on('contextReady', callback);
  }

  /**
   * Register a callback for errors.
   *
   * @param callback Function to call on error
   */
  onError(callback: (stepId: string, error: Error) => void): void {
    this.on('error', callback);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let watcherInstance: StorekeeperWatcher | null = null;

/**
 * Get the singleton watcher instance.
 */
export function getStorekeeperWatcher(): StorekeeperWatcher {
  if (!watcherInstance) {
    watcherInstance = new StorekeeperWatcher();
  }
  return watcherInstance;
}

/**
 * Stop and reset the watcher instance.
 */
export function resetStorekeeperWatcher(): void {
  if (watcherInstance) {
    watcherInstance.stop();
    watcherInstance = null;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Start watching for requests in a project directory.
 *
 * @param projectDir Project root directory
 * @param options Watch options
 * @returns The watcher instance
 */
export function watchRequests(
  projectDir: string,
  options?: {
    skillsPath?: string;
    mcpConfigPath?: string;
  }
): StorekeeperWatcher {
  const requestsDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.REQUESTS_DIR
  );

  const watcher = getStorekeeperWatcher();
  watcher.watch(requestsDir, {
    projectDir,
    ...options,
  });

  return watcher;
}

/**
 * Stop watching for requests.
 */
export function stopWatching(): void {
  if (watcherInstance) {
    watcherInstance.stop();
  }
}
