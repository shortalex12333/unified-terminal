/**
 * Adapter Factory
 *
 * Single entry point for getting runtime adapters.
 * Handles lazy initialization and singleton caching.
 *
 * Codex and Claude are active. Gemini is shelved.
 *
 * Target: ES2022 CommonJS strict
 */

import type { Adapter, AgentConfig, Runtime } from './types';
import { CodexAdapter } from './codex/adapter';
import { ClaudeAdapter } from './claude/adapter';

// =============================================================================
// ADAPTER CACHE
// =============================================================================

/** Singleton cache — one adapter instance per runtime */
const adapterCache: Map<Runtime, Adapter> = new Map();

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Get adapter for a runtime.
 * Adapters are cached — same instance returned on subsequent calls.
 *
 * @throws Error if runtime is unknown
 */
export function getAdapter(runtime: Runtime): Adapter {
  let adapter = adapterCache.get(runtime);

  if (!adapter) {
    switch (runtime) {
      case 'codex':
        adapter = new CodexAdapter();
        break;
      case 'claude':
        adapter = new ClaudeAdapter();
        break;
      default: {
        // Exhaustive check — TypeScript will error if Runtime union grows
        const _exhaustive: never = runtime;
        throw new Error(`Unknown runtime: ${_exhaustive}`);
      }
    }
    adapterCache.set(runtime, adapter);
  }

  return adapter;
}

/**
 * Get all available runtimes.
 * Checks each registered runtime for CLI availability.
 */
export async function getAvailableRuntimes(): Promise<Runtime[]> {
  const runtimes: Runtime[] = ['codex', 'claude'];
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
 * Select the best runtime for a given agent config.
 *
 * Current behavior: defaults to 'codex'.
 * Claude is available but Codex remains the default. Gemini is shelved.
 *
 * This function exists so callers don't hardcode runtime selection.
 * When new runtimes are added, this logic grows — callers stay unchanged.
 */
export function selectRuntime(_config?: AgentConfig): Runtime {
  return 'codex';
}

/**
 * Clear the adapter cache.
 * Only useful for testing — production should keep singletons alive.
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { CodexAdapter } from './codex/adapter';
export { ClaudeAdapter } from './claude/adapter';
export * from './types';
export * from './permissions';
