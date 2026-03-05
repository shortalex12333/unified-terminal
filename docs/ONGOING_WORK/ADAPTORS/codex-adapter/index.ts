/**
 * Codex Adapter - Public API
 *
 * Entry point for the Codex adapter module.
 *
 * Usage:
 *   import { spawnCodexAgent, isCodexAvailable } from './codex-adapter';
 */

export { spawnCodexAgent, isCodexAvailable, getSandboxMode } from './adapter';

export type {
  AgentConfig,
  AgentHandle,
  AgentResult,
  SandboxMode,
  Tool,
  Status,
} from './types';
