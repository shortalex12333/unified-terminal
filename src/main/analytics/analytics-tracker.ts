/**
 * Analytics Tracker
 *
 * Singleton for tracking anonymous analytics events.
 * Provides typed methods for each event type.
 *
 * All events are anonymous - NO user ID, NO IP address.
 * Data stays local on the user's device.
 */

import { EventEmitter } from 'events';
import { getAnalyticsStore, AnalyticsStore } from './analytics-store';
import {
  AnalyticsEventType,
  BuildStartedProperties,
  BuildCompletedProperties,
  BuildCancelledProperties,
  IntakeQuestionSkippedProperties,
  TreeToggleProperties,
  TemplateSelectedProperties,
  ErrorOccurredProperties,
  AnalyticsSummary,
} from './types';

// ============================================================================
// ANALYTICS TRACKER CLASS
// ============================================================================

/**
 * AnalyticsTracker - Type-safe analytics event tracking.
 *
 * Usage:
 *   const tracker = getAnalyticsTracker();
 *   tracker.trackBuildStarted({ template: 'react-app', tier: 1 });
 *
 * Events:
 * - 'event': (eventType, properties) - Emitted when any event is tracked
 */
export class AnalyticsTracker extends EventEmitter {
  private store: AnalyticsStore;
  private enabled: boolean = true;

  constructor() {
    super();
    this.store = getAnalyticsStore();
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Enable analytics tracking.
   */
  enable(): void {
    this.enabled = true;
    this.store.setEnabled(true);
    console.log('[AnalyticsTracker] Tracking enabled');
  }

  /**
   * Disable analytics tracking.
   */
  disable(): void {
    this.enabled = false;
    this.store.setEnabled(false);
    console.log('[AnalyticsTracker] Tracking disabled');
  }

  /**
   * Check if tracking is enabled.
   */
  isEnabled(): boolean {
    return this.enabled && this.store.isEnabled();
  }

  // ==========================================================================
  // BUILD EVENTS
  // ==========================================================================

  /**
   * Track when a build starts.
   */
  trackBuildStarted(properties: BuildStartedProperties): void {
    this.track('build_started', properties);
  }

  /**
   * Track when a build completes.
   */
  trackBuildCompleted(properties: BuildCompletedProperties): void {
    this.track('build_completed', properties);
  }

  /**
   * Track when a build is cancelled.
   */
  trackBuildCancelled(properties: BuildCancelledProperties): void {
    this.track('build_cancelled', properties);
  }

  // ==========================================================================
  // INTAKE EVENTS
  // ==========================================================================

  /**
   * Track when a user skips an intake question.
   */
  trackIntakeQuestionSkipped(properties: IntakeQuestionSkippedProperties): void {
    this.track('intake_question_skipped', properties);
  }

  // ==========================================================================
  // UI EVENTS
  // ==========================================================================

  /**
   * Track when the progress tree is expanded.
   */
  trackTreeExpanded(properties: TreeToggleProperties): void {
    this.track('tree_expanded', properties);
  }

  /**
   * Track when the progress tree is collapsed.
   */
  trackTreeCollapsed(properties: TreeToggleProperties): void {
    this.track('tree_collapsed', properties);
  }

  /**
   * Track when a template is selected.
   */
  trackTemplateSelected(properties: TemplateSelectedProperties): void {
    this.track('template_selected', properties);
  }

  // ==========================================================================
  // ERROR EVENTS
  // ==========================================================================

  /**
   * Track when an error occurs.
   */
  trackErrorOccurred(properties: ErrorOccurredProperties): void {
    this.track('error_occurred', properties);
  }

  // ==========================================================================
  // GENERIC TRACKING
  // ==========================================================================

  /**
   * Track a generic event.
   */
  track(event: AnalyticsEventType | string, properties: object): void {
    if (!this.enabled) {
      return;
    }

    this.store.recordEvent({ event, properties: properties as Record<string, unknown> });
    this.emit('event', event, properties);
  }

  // ==========================================================================
  // DATA ACCESS
  // ==========================================================================

  /**
   * Get analytics summary.
   */
  getSummary(): AnalyticsSummary {
    return this.store.getSummary();
  }

  /**
   * Export all analytics data as JSON string.
   */
  exportData(): string {
    return this.store.exportData();
  }

  /**
   * Clear all analytics data.
   */
  clearAll(): void {
    this.store.clearAll();
  }

  /**
   * Get total event count.
   */
  getEventCount(): number {
    return this.store.getEventCount();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let trackerInstance: AnalyticsTracker | null = null;

/**
 * Get the singleton AnalyticsTracker instance.
 */
export function getAnalyticsTracker(): AnalyticsTracker {
  if (!trackerInstance) {
    trackerInstance = new AnalyticsTracker();
  }
  return trackerInstance;
}

/**
 * Cleanup the analytics tracker.
 */
export function cleanupAnalyticsTracker(): void {
  if (trackerInstance) {
    trackerInstance.removeAllListeners();
    trackerInstance = null;
  }
}

