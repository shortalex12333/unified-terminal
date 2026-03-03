/**
 * GSD Plugin Configuration
 *
 * Get Shit Done - Full project lifecycle management.
 * GSD is the primary orchestrator for complex, multi-phase projects.
 */

import { PluginConfig } from '../plugin-schema';

export const GSD_PLUGIN: PluginConfig = {
  name: 'gsd',
  version: '1.0.0',
  description: 'Get Shit Done - Full project lifecycle management with phased execution',
  type: 'cli',
  command: 'gsd',
  defaultArgs: [],
  dependencies: ['claude-code'],
  capabilities: [
    'project-planning',
    'phased-execution',
    'verification',
    'research',
    'milestone-tracking',
    'context-management',
    'code-review',
    'debugging',
  ],
  triggers: [
    'build',
    'create',
    'project',
    'app',
    'website',
    'full',
    'application',
    'product',
    'startup',
    'mvp',
    'prototype',
    'system',
    'platform',
    'service',
    'api',
    'backend',
    'frontend',
    'fullstack',
  ],
  requiresAuth: false,
  timeout: 0, // GSD projects can run for a long time
};

/**
 * GSD command prefixes for different operations.
 * These are used to route different types of GSD commands.
 */
export const GSD_COMMANDS = {
  /** Initialize a new project */
  NEW_PROJECT: 'gsd:new-project',
  /** Start a new milestone */
  NEW_MILESTONE: 'gsd:new-milestone',
  /** Check project progress */
  PROGRESS: 'gsd:progress',
  /** Plan a phase */
  PLAN_PHASE: 'gsd:plan-phase',
  /** Execute a phase */
  EXECUTE_PHASE: 'gsd:execute-phase',
  /** Verify completed work */
  VERIFY_WORK: 'gsd:verify-work',
  /** Research a topic */
  RESEARCH_PHASE: 'gsd:research-phase',
  /** Pause work */
  PAUSE_WORK: 'gsd:pause-work',
  /** Resume work */
  RESUME_WORK: 'gsd:resume-work',
  /** Quick task */
  QUICK: 'gsd:quick',
} as const;

export type GSDCommand = typeof GSD_COMMANDS[keyof typeof GSD_COMMANDS];
