/**
 * Plugin System - Main Entry Point
 *
 * Gate 10: GSD + Plugin Orchestration
 *
 * Exports all plugin-related functionality and provides
 * initialization helpers.
 */

// ============================================================================
// SCHEMA EXPORTS
// ============================================================================

export {
  // Types
  PluginType,
  PluginConfig,
  PluginStatus,
  PluginInstance,
  PluginStatusEvent,
  PluginOutputEvent,
  PluginExecuteOptions,
  // Validation
  validatePluginConfig,
  isValidPluginConfig,
} from './plugin-schema';

// ============================================================================
// REGISTRY EXPORTS
// ============================================================================

export {
  PluginRegistry,
  getPluginRegistry,
  resetPluginRegistry,
} from './plugin-registry';

// ============================================================================
// EXECUTOR EXPORTS
// ============================================================================

export {
  PluginExecutor,
  getPluginExecutor,
  cleanupPluginExecutor,
} from './plugin-executor';

// ============================================================================
// GSD INTEGRATION EXPORTS
// ============================================================================

export {
  // Types
  GSDPhaseStatus,
  GSDPhase,
  GSDProjectState,
  GSDPhaseEvent,
  // Class and singleton
  GSDIntegration,
  getGSDIntegration,
  resetGSDIntegration,
} from './gsd-integration';

// ============================================================================
// BUILT-IN PLUGIN CONFIGS
// ============================================================================

export {
  // Plugin configs
  GSD_PLUGIN,
  CODEX_PLUGIN,
  CLAUDE_CODE_PLUGIN,
  RESEARCH_PLUGIN,
  // Constants
  GSD_COMMANDS,
  CODEX_MODES,
  CLAUDE_CODE_MODES,
  RESEARCH_TYPES,
  // Types
  GSDCommand,
  CodexMode,
  ClaudeCodeMode,
  ResearchType,
  // Utilities
  BUILTIN_PLUGINS,
  registerBuiltinPlugins,
  getBuiltinPlugin,
} from './configs';

// ============================================================================
// INITIALIZATION
// ============================================================================

import { getPluginRegistry } from './plugin-registry';
import { registerBuiltinPlugins } from './configs';

/**
 * Initialize the plugin system.
 * Registers all built-in plugins with the registry.
 */
export function initializePluginSystem(): void {
  console.log('[Plugins] Initializing plugin system...');

  const registry = getPluginRegistry();

  // Register built-in plugins
  registerBuiltinPlugins(registry);

  console.log('[Plugins] Plugin system initialized');
}

/**
 * Cleanup the plugin system.
 * Cancels all running plugins and clears state.
 */
export function cleanupPluginSystem(): void {
  console.log('[Plugins] Cleaning up plugin system...');

  // Import cleanup functions
  const { cleanupPluginExecutor } = require('./plugin-executor');
  const { resetPluginRegistry } = require('./plugin-registry');
  const { resetGSDIntegration } = require('./gsd-integration');

  cleanupPluginExecutor();
  resetPluginRegistry();
  resetGSDIntegration();

  console.log('[Plugins] Plugin system cleaned up');
}
