/**
 * Claude Code Agent File Frontmatter Generator
 *
 * Generates YAML frontmatter for temporary agent files.
 * When prompts exceed CLI arg limits (~2000 chars), we write a
 * temp .md file with frontmatter that Claude Code can consume directly.
 *
 * Target: ES2022 CommonJS strict
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { AgentConfig } from '../types';

// =============================================================================
// TOOL NAME MAPPING
// =============================================================================

/** Maps generic tool names to Claude Code PascalCase equivalents */
const TOOL_MAP: Record<string, string> = {
  read: 'Read',
  write: 'Write',
  bash: 'Bash',
  edit: 'Edit',
  web_search: 'WebSearch',
  grep: 'Grep',
  glob: 'Glob',
};

/**
 * Maps a generic tool name to the Claude Code PascalCase name.
 * Returns input unchanged if no mapping exists (forward-compatible).
 */
export function mapToolName(generic: string): string {
  return TOOL_MAP[generic] ?? generic;
}

// =============================================================================
// FRONTMATTER GENERATION
// =============================================================================

/** Default maxTurns when no explicit value can be derived */
const DEFAULT_MAX_TURNS = 10;

/** Rough tokens-per-turn estimate for deriving maxTurns from maxTokens */
const TOKENS_PER_TURN = 4000;

/**
 * Generates the full agent file content: YAML frontmatter + prompt body.
 *
 * The frontmatter includes model, allowedTools, and maxTurns.
 * maxTurns is derived from maxTokens (tokens / 4000, clamped 1-100)
 * or defaults to 10 if maxTokens is 0 or unset.
 */
export function generateFrontmatter(config: AgentConfig): string {
  const allowedTools = config.tools.map(mapToolName);
  const maxTurns = config.maxTokens > 0
    ? Math.max(1, Math.min(100, Math.floor(config.maxTokens / TOKENS_PER_TURN)))
    : DEFAULT_MAX_TURNS;

  const toolLines = allowedTools.map((t) => `  - ${t}`).join('\n');

  const frontmatter = [
    '---',
    `model: ${config.model}`,
    'allowedTools:',
    toolLines,
    `maxTurns: ${maxTurns}`,
    '---',
  ].join('\n');

  return `${frontmatter}\n\n# Task\n\n${config.prompt}\n`;
}

// =============================================================================
// TEMP FILE MANAGEMENT
// =============================================================================

/**
 * Writes content to a uniquely-named temp file in os.tmpdir().
 * Returns the absolute path to the created file.
 */
export async function writeTempAgentFile(content: string): Promise<string> {
  const suffix = crypto.randomBytes(4).toString('hex');
  const filename = `claude-agent-${Date.now()}-${suffix}.md`;
  const filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Deletes a temp agent file.
 * Silently ignores if the file does not exist.
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}
