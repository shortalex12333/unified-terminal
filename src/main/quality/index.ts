/**
 * Quality Module
 *
 * Exports quality scoring utilities for validating built website output.
 * This is the most important differentiator - we judge OUTPUT quality,
 * not just that the pipeline runs.
 */

export {
  QualityScorer,
  getQualityScorer,
  resetQualityScorer,
  registerQualityScorerIPC,
} from './quality-scorer';

export type {
  QualityReport,
  QualityScorerConfig,
  LighthouseScores,
  ViewportCheck,
  AssetCheck,
  LinkCheck,
  AccessibilityIssue,
  QualityScorerIPC,
} from './quality-scorer';
