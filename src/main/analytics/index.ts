/**
 * Analytics Module
 *
 * Local-first, anonymous analytics for the Unified Terminal.
 * All data stays on the user's device.
 *
 * Usage:
 *   import { getAnalyticsTracker } from '../analytics';
 *   const tracker = getAnalyticsTracker();
 *   tracker.trackBuildStarted({ template: 'react-app', tier: 1 });
 */

// Types
export * from './types';

// Store
export {
  AnalyticsStore,
  getAnalyticsStore,
  cleanupAnalyticsStore,
  KENOKI_DIR,
  ANALYTICS_FILE,
  MAX_EVENTS,
} from './analytics-store';

// Tracker
export {
  AnalyticsTracker,
  getAnalyticsTracker,
  cleanupAnalyticsTracker,
} from './analytics-tracker';
