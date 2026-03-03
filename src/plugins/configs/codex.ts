/**
 * Codex Plugin Configuration
 *
 * OpenAI Codex CLI for quick code generation tasks.
 * Best suited for single-file or quick code snippets.
 */

import { PluginConfig } from '../plugin-schema';

export const CODEX_PLUGIN: PluginConfig = {
  name: 'codex',
  version: '1.0.0',
  description: 'OpenAI Codex CLI for quick code generation',
  type: 'cli',
  command: 'codex',
  defaultArgs: [],
  dependencies: [],
  capabilities: [
    'code-generation',
    'file-creation',
    'quick-scripts',
    'refactoring',
    'code-completion',
  ],
  triggers: [
    'code',
    'script',
    'function',
    'quick',
    'snippet',
    'generate',
    'write',
    'create file',
    'make function',
    'helper',
    'utility',
  ],
  requiresAuth: true,
  requiredEnv: ['OPENAI_API_KEY'],
  timeout: 300000, // 5 minute timeout for code generation
};

/**
 * Codex operation modes.
 */
export const CODEX_MODES = {
  /** Generate new code */
  GENERATE: 'generate',
  /** Refactor existing code */
  REFACTOR: 'refactor',
  /** Complete partial code */
  COMPLETE: 'complete',
  /** Explain code */
  EXPLAIN: 'explain',
} as const;

export type CodexMode = typeof CODEX_MODES[keyof typeof CODEX_MODES];
