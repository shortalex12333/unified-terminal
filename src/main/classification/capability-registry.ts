import { ProjectType, Capabilities } from './types';

/**
 * HARDCODED mapping from project type to capabilities.
 * This is the source of truth for what each project type needs.
 *
 * DO NOT make this dynamic. The whole point is predictable, deterministic routing.
 */
export const CAPABILITY_REGISTRY: Record<ProjectType, Capabilities> = {
  site: {
    skills: ['scaffold', 'frontend-design', 'deploy'],
    mcps: [],
    template: 'site',
    estimatedSteps: [5, 8],
    firstPhase: 'scaffold',
    route: 'full-orchestration',
  },

  app: {
    skills: ['scaffold', 'auth-setup', 'db-setup', 'api-design', 'deploy'],
    mcps: ['supabase'],
    template: 'app',
    estimatedSteps: [8, 12],
    firstPhase: 'scaffold',
    route: 'full-orchestration',
  },

  ecom: {
    skills: ['scaffold', 'payment-flow', 'inventory', 'frontend-design', 'deploy'],
    mcps: ['stripe'],
    template: 'ecom',
    estimatedSteps: [12, 20],
    firstPhase: 'scaffold',
    route: 'full-orchestration',
  },

  existing: {
    skills: ['codebase-mapper', 'code-reviewer'],
    mcps: [],
    template: 'existing',
    estimatedSteps: [3, 7],
    firstPhase: 'analysis',
    route: 'full-orchestration',
  },

  chat: {
    skills: [],
    mcps: [],
    template: '',
    estimatedSteps: [0, 0],
    firstPhase: 'scaffold', // not used
    route: 'chatgpt-direct',
  },

  quick: {
    skills: [],
    mcps: [],
    template: '',
    estimatedSteps: [1, 2],
    firstPhase: 'scaffold', // not used
    route: 'codex-single',
  },
};

/**
 * Get capabilities for a project type
 */
export function getCapabilities(type: ProjectType): Capabilities {
  return CAPABILITY_REGISTRY[type];
}

/**
 * Get all project types
 */
export function getProjectTypes(): ProjectType[] {
  return Object.keys(CAPABILITY_REGISTRY) as ProjectType[];
}

/**
 * Check if a project type requires MCPs
 */
export function requiresMCPs(type: ProjectType): boolean {
  return CAPABILITY_REGISTRY[type].mcps.length > 0;
}
