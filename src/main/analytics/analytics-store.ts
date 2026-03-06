/**
 * Analytics Store
 *
 * Local storage for anonymous analytics events.
 * Stores events in a JSON file in the user's home directory.
 * Auto-aggregates for summary statistics.
 *
 * Storage location: ~/.kenoki/analytics.json
 * Max events: 1000 (FIFO when full)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AnalyticsEvent,
  AnalyticsData,
  AnalyticsSummary,
  TierUsage,
  AnalyticsStoreConfig,
  BuildStartedProperties,
  BuildCompletedProperties,
  BuildCancelledProperties,
  DEFAULT_ANALYTICS_CONFIG,
  ANALYTICS_DATA_VERSION,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const KENOKI_DIR = path.join(os.homedir(), '.kenoki');
const ANALYTICS_FILE = path.join(KENOKI_DIR, 'analytics.json');
const MAX_EVENTS = 1000;

// ============================================================================
// ANALYTICS STORE CLASS
// ============================================================================

/**
 * AnalyticsStore - Local storage for analytics events.
 *
 * Features:
 * - Stores events in local JSON file
 * - Auto-aggregates for summary statistics
 * - FIFO eviction when max events reached
 * - Export and clear capabilities
 */
export class AnalyticsStore {
  private config: AnalyticsStoreConfig;
  private data: AnalyticsData;
  private saveTimeout: NodeJS.Timeout | null = null;
  private dirty: boolean = false;

  constructor(config?: Partial<AnalyticsStoreConfig>) {
    this.config = {
      ...DEFAULT_ANALYTICS_CONFIG,
      storagePath: ANALYTICS_FILE,
      ...config,
    };

    this.data = {
      version: ANALYTICS_DATA_VERSION,
      events: [],
      updatedAt: Date.now(),
    };

    this.ensureDirectory();
    this.load();
  }

  // ==========================================================================
  // STORAGE MANAGEMENT
  // ==========================================================================

  /**
   * Ensure the .kenoki directory exists.
   */
  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(KENOKI_DIR)) {
        fs.mkdirSync(KENOKI_DIR, { recursive: true });
        console.log('[AnalyticsStore] Created .kenoki directory');
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to create directory:', error);
    }
  }

  /**
   * Load analytics data from disk.
   */
  private load(): void {
    try {
      if (fs.existsSync(this.config.storagePath)) {
        const raw = fs.readFileSync(this.config.storagePath, 'utf-8');
        const parsed = JSON.parse(raw) as AnalyticsData;

        // Version check for future migrations
        if (parsed.version === ANALYTICS_DATA_VERSION) {
          this.data = parsed;
          console.log(`[AnalyticsStore] Loaded ${this.data.events.length} events`);
        } else {
          // Handle migration if needed
          console.log('[AnalyticsStore] Version mismatch, starting fresh');
        }
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to load analytics:', error);
    }
  }

  /**
   * Save analytics data to disk.
   * Uses debouncing to avoid excessive writes.
   */
  private save(): void {
    this.dirty = true;

    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.forceSave();
    }, 1000);
  }

  /**
   * Force immediate save.
   */
  private forceSave(): void {
    if (!this.dirty) return;

    try {
      this.data.updatedAt = Date.now();
      fs.writeFileSync(
        this.config.storagePath,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
      this.dirty = false;
      console.log(`[AnalyticsStore] Saved ${this.data.events.length} events`);
    } catch (error) {
      console.error('[AnalyticsStore] Failed to save analytics:', error);
    }
  }

  // ==========================================================================
  // EVENT RECORDING
  // ==========================================================================

  /**
   * Record a new analytics event.
   * If max events reached, removes oldest event (FIFO).
   */
  recordEvent(event: Omit<AnalyticsEvent, 'timestamp'> & { timestamp?: number }): void {
    if (!this.config.enabled) {
      return;
    }

    const fullEvent: AnalyticsEvent = {
      timestamp: event.timestamp ?? Date.now(),
      event: event.event,
      properties: event.properties,
    };

    // FIFO eviction when full
    if (this.data.events.length >= this.config.maxEvents) {
      this.data.events.shift();
    }

    this.data.events.push(fullEvent);
    this.save();

    console.log(`[AnalyticsStore] Recorded event: ${fullEvent.event}`);
  }

  // ==========================================================================
  // SUMMARY GENERATION
  // ==========================================================================

  /**
   * Get aggregated analytics summary.
   * Computes statistics from all stored events.
   */
  getSummary(): AnalyticsSummary {
    const events = this.data.events;

    // Count builds by status
    const buildStarted = events.filter(e => e.event === 'build_started');
    const buildCompleted = events.filter(e => e.event === 'build_completed');
    const buildCancelled = events.filter(e => e.event === 'build_cancelled');

    // Calculate average build time
    const completedTimes = buildCompleted
      .map(e => (e.properties as unknown as BuildCompletedProperties).durationMs)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t));

    const averageBuildTime = completedTimes.length > 0
      ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length
      : 0;

    const totalBuildTime = completedTimes.reduce((a, b) => a + b, 0);

    // Tier usage
    const tierUsage: TierUsage = { tier0: 0, tier1: 0, tier2: 0, tier3: 0 };
    for (const e of buildStarted) {
      const tier = (e.properties as unknown as BuildStartedProperties).tier;
      if (tier === 0) tierUsage.tier0++;
      else if (tier === 1) tierUsage.tier1++;
      else if (tier === 2) tierUsage.tier2++;
      else if (tier === 3) tierUsage.tier3++;
    }

    // Top templates
    const templateCounts = new Map<string, number>();
    for (const e of buildStarted) {
      const template = (e.properties as unknown as BuildStartedProperties).template;
      if (template) {
        templateCounts.set(template, (templateCounts.get(template) || 0) + 1);
      }
    }
    const topTemplates = Array.from(templateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Common cancel points
    const cancelCounts = new Map<string, number>();
    for (const e of buildCancelled) {
      const step = (e.properties as unknown as BuildCancelledProperties).currentStep;
      if (step) {
        cancelCounts.set(step, (cancelCounts.get(step) || 0) + 1);
      }
    }
    const commonCancelPoints = Array.from(cancelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Success rate
    const totalBuilds = buildStarted.length;
    const completedBuilds = buildCompleted.filter(
      e => (e.properties as unknown as BuildCompletedProperties).success
    ).length;
    const successRate = totalBuilds > 0
      ? (completedBuilds / totalBuilds) * 100
      : 0;

    // Timestamps
    const timestamps = events.map(e => e.timestamp);
    const firstEventAt = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const lastEventAt = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      totalBuilds,
      completedBuilds,
      cancelledBuilds: buildCancelled.length,
      averageBuildTime,
      tierUsage,
      topTemplates,
      commonCancelPoints,
      successRate,
      totalBuildTime,
      firstEventAt,
      lastEventAt,
    };
  }

  // ==========================================================================
  // DATA MANAGEMENT
  // ==========================================================================

  /**
   * Clear all analytics data.
   */
  clearAll(): void {
    this.data.events = [];
    this.data.updatedAt = Date.now();
    this.forceSave();
    console.log('[AnalyticsStore] Cleared all analytics data');
  }

  /**
   * Export all analytics data as JSON.
   */
  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Get all events.
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.data.events];
  }

  /**
   * Get event count.
   */
  getEventCount(): number {
    return this.data.events.length;
  }

  /**
   * Check if analytics is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable analytics.
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`[AnalyticsStore] Analytics ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Cleanup resources and force save.
   */
  cleanup(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.forceSave();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let storeInstance: AnalyticsStore | null = null;

/**
 * Get the singleton AnalyticsStore instance.
 */
export function getAnalyticsStore(): AnalyticsStore {
  if (!storeInstance) {
    storeInstance = new AnalyticsStore();
  }
  return storeInstance;
}

/**
 * Cleanup the analytics store.
 */
export function cleanupAnalyticsStore(): void {
  if (storeInstance) {
    storeInstance.cleanup();
    storeInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { KENOKI_DIR, ANALYTICS_FILE, MAX_EVENTS };
