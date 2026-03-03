/**
 * Built-in Plugin Configurations Index
 *
 * Exports all built-in plugin configurations and a function
 * to register them all at once.
 */

import { PluginConfig } from '../plugin-schema';
import { PluginRegistry } from '../plugin-registry';

// Plugin configurations
export { GSD_PLUGIN, GSD_COMMANDS } from './gsd';
export { CODEX_PLUGIN, CODEX_MODES } from './codex';
export { CLAUDE_CODE_PLUGIN, CLAUDE_CODE_MODES } from './claude-code';
export { RESEARCH_PLUGIN, RESEARCH_TYPES } from './research';

// Re-export types
export type { GSDCommand } from './gsd';
export type { CodexMode } from './codex';
export type { ClaudeCodeMode } from './claude-code';
export type { ResearchType } from './research';

// Import for bundling
import { GSD_PLUGIN } from './gsd';
import { CODEX_PLUGIN } from './codex';
import { CLAUDE_CODE_PLUGIN } from './claude-code';
import { RESEARCH_PLUGIN } from './research';

/**
 * All built-in plugin configurations.
 */
export const BUILTIN_PLUGINS: PluginConfig[] = [
  GSD_PLUGIN,
  CODEX_PLUGIN,
  CLAUDE_CODE_PLUGIN,
  RESEARCH_PLUGIN,
];

/**
 * Register all built-in plugins with a registry.
 * @param registry - Plugin registry to register with
 */
export function registerBuiltinPlugins(registry: PluginRegistry): void {
  console.log('[Plugins] Registering built-in plugins...');

  for (const plugin of BUILTIN_PLUGINS) {
    try {
      registry.register(plugin);
    } catch (error) {
      console.error(`[Plugins] Failed to register ${plugin.name}:`, error);
    }
  }

  console.log(`[Plugins] Registered ${registry.count} plugins`);
}

/**
 * Get a plugin config by name from the built-in list.
 * @param name - Plugin name
 * @returns Plugin config or undefined
 */
export function getBuiltinPlugin(name: string): PluginConfig | undefined {
  return BUILTIN_PLUGINS.find((p) => p.name === name);
}
