/**
 * Adapter Factory
 *
 * Single entry point for getting runtime adapters.
 * Handles lazy initialization and caching.
 */

import type { Adapter, Runtime } from './types';
import { CodexAdapter } from './codex/adapter';
import { GeminiAdapter } from './gemini/adapter';

// =============================================================================
// ADAPTER CACHE
// =============================================================================

const adapters: Map<Runtime, Adapter> = new Map();

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Get adapter for a runtime.
 * Adapters are cached - same instance returned on subsequent calls.
 */
export function getAdapter(runtime: Runtime): Adapter {
  let adapter = adapters.get(runtime);

  if (!adapter) {
    switch (runtime) {
      case 'codex':
        adapter = new CodexAdapter();
        break;
      case 'gemini':
        adapter = new GeminiAdapter();
        break;
      default:
        throw new Error(`Unknown runtime: ${runtime}`);
    }
    adapters.set(runtime, adapter);
  }

  return adapter;
}

/**
 * Get all available runtimes.
 * Checks each runtime for availability.
 */
export async function getAvailableRuntimes(): Promise<Runtime[]> {
  const runtimes: Runtime[] = ['codex', 'gemini'];
  const available: Runtime[] = [];

  for (const runtime of runtimes) {
    const adapter = getAdapter(runtime);
    if (await adapter.isAvailable()) {
      available.push(runtime);
    }
  }

  return available;
}

/**
 * Select best runtime for a given requirement.
 *
 * @param needsSessionResume - If true, excludes Gemini
 * @param preferredRuntime - Optional preference
 */
export async function selectRuntime(
  needsSessionResume: boolean,
  preferredRuntime?: Runtime
): Promise<Runtime | null> {
  const available = await getAvailableRuntimes();

  if (available.length === 0) {
    return null;
  }

  // Filter by session resume requirement
  const eligible = needsSessionResume
    ? available.filter((r) => getAdapter(r).capabilities().sessionResume)
    : available;

  if (eligible.length === 0) {
    return null;
  }

  // Return preferred if available, otherwise first eligible
  if (preferredRuntime && eligible.includes(preferredRuntime)) {
    return preferredRuntime;
  }

  return eligible[0];
}

// =============================================================================
// EXPORTS
// =============================================================================

export { CodexAdapter } from './codex/adapter';
export { GeminiAdapter } from './gemini/adapter';
export * from './types';
export * from './permissions';
