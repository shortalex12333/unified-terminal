/**
 * Claude Code Plugin Configuration
 *
 * Anthropic's Claude Code CLI for development tasks.
 * Provides AI-assisted coding with file system access.
 */

import { PluginConfig } from '../plugin-schema';

export const CLAUDE_CODE_PLUGIN: PluginConfig = {
  name: 'claude-code',
  version: '1.0.0',
  description: 'Claude Code CLI for AI-assisted development',
  type: 'cli',
  command: 'claude',
  defaultArgs: [],
  dependencies: [],
  capabilities: [
    'code-generation',
    'code-review',
    'debugging',
    'refactoring',
    'file-editing',
    'testing',
    'documentation',
    'architecture',
  ],
  triggers: [
    'claude',
    'ai',
    'develop',
    'fix',
    'debug',
    'review',
    'implement',
    'feature',
    'bug',
    'test',
    'refactor',
    'document',
  ],
  requiresAuth: true,
  timeout: 0, // Claude Code sessions can run indefinitely
};

/**
 * Claude Code interaction modes.
 */
export const CLAUDE_CODE_MODES = {
  /** Interactive chat mode */
  CHAT: 'chat',
  /** Execute a single command */
  EXECUTE: 'execute',
  /** Review code */
  REVIEW: 'review',
  /** Debug issue */
  DEBUG: 'debug',
} as const;

export type ClaudeCodeMode = typeof CLAUDE_CODE_MODES[keyof typeof CLAUDE_CODE_MODES];
