/**
 * Research Plugin Configuration
 *
 * Web research and information gathering plugin.
 * Uses browser automation for comprehensive research.
 */

import { PluginConfig } from '../plugin-schema';

export const RESEARCH_PLUGIN: PluginConfig = {
  name: 'research',
  version: '1.0.0',
  description: 'Web research and information gathering',
  type: 'browser',
  dependencies: [],
  capabilities: [
    'web-research',
    'information-gathering',
    'market-analysis',
    'competitor-research',
    'documentation-lookup',
    'api-exploration',
  ],
  triggers: [
    'research',
    'find',
    'search',
    'look up',
    'investigate',
    'analyze',
    'compare',
    'market',
    'competitor',
    'alternatives',
    'options',
    'documentation',
    'docs',
  ],
  requiresAuth: false,
  timeout: 600000, // 10 minute timeout for research tasks
};

/**
 * Research task types.
 */
export const RESEARCH_TYPES = {
  /** General web research */
  GENERAL: 'general',
  /** Market research */
  MARKET: 'market',
  /** Competitor analysis */
  COMPETITOR: 'competitor',
  /** Technical documentation */
  DOCUMENTATION: 'documentation',
  /** API exploration */
  API: 'api',
} as const;

export type ResearchType = typeof RESEARCH_TYPES[keyof typeof RESEARCH_TYPES];
