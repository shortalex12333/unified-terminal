/**
 * Runtime Adapters - Public API
 *
 * Entry point for the adapter system.
 */

// Core factory functions
export { getAdapter, getAvailableRuntimes, selectRuntime } from './factory';

// Adapter classes
export { CodexAdapter } from './codex/adapter';
export { GeminiAdapter } from './gemini/adapter';

// Types
export type {
  Tool,
  Runtime,
  Status,
  AgentConfig,
  AgentResult,
  Capabilities,
  AgentHandle,
  Adapter,
} from './types';

// Permissions
export {
  isReadOnly,
  hasWritePermission,
  getCodexSandbox,
  buildCodexSandboxFlag,
  getGeminiApproval,
  buildGeminiApprovalFlag,
  PLUGINS,
  getPluginRequirements,
  validatePluginTools,
  COMPATIBILITY,
  isCompatible,
  getCompatiblePlugins,
} from './permissions';
