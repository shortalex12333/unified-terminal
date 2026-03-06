/**
 * PA Sub-Spine Reader Module
 *
 * This module is responsible for reading and parsing sub-spine markdown files
 * that agents write to communicate their progress, blockers, and context usage.
 *
 * Sub-spine files follow a standardized markdown format:
 *
 * ```markdown
 * ## Checkpoint N | X% context used
 *
 * **Completed:**
 * - Item 1
 * - Item 2
 *
 * **In Progress:**
 * - Current work item
 *
 * **Blocked:**
 * - Blocker description
 *
 * **Files:**
 * - path/to/file.ts
 *
 * **Next:**
 * - Next step to take
 * ```
 *
 * The PA reads these files periodically to:
 * 1. Monitor agent health (context usage)
 * 2. Detect stuck patterns (no progress)
 * 3. Identify blockers requiring intervention
 * 4. Trigger handovers when agents hit RED status
 *
 * KEY PRINCIPLE: This module only READS files. It never modifies agent sub-spines.
 *
 * @module pa/spine-reader
 */

import {
  type SubSpineCheckpoint,
  type PAAgentView,
  type PAConfig,
  type PAThresholds,
  CheckpointStatus,
} from './types';

// =============================================================================
// PLACEHOLDER PATHS
// =============================================================================

/**
 * Path template for sub-spine files.
 * Will be resolved at runtime by replacing placeholders.
 *
 * @placeholder PROJECT_ROOT - Root directory of the current project
 * @placeholder DOMAIN - Domain the agent operates in (frontend, backend, etc.)
 * @placeholder AGENT_ID - The agent's unique session ID
 */
export const SUB_SPINE_PATH_TEMPLATE = '{{ PROJECT_ROOT }}/{{ DOMAIN }}/subagents/{{ AGENT_ID }}/sub_spine.md';

// =============================================================================
// STATUS THRESHOLDS
// =============================================================================

/**
 * Default thresholds for context usage status calculation.
 * These can be overridden via PAConfig.thresholds.
 *
 * Maps to PAThresholds interface:
 * - tokenWarningPercent: Threshold for AMBER status
 * - tokenCriticalPercent: Threshold for RED status
 */
export const DEFAULT_THRESHOLDS: Pick<PAThresholds, 'tokenWarningPercent' | 'tokenCriticalPercent'> = {
  /** At this percentage, agent enters AMBER (warning) status */
  tokenWarningPercent: 70,
  /** At this percentage, agent enters RED (critical) status */
  tokenCriticalPercent: 85,
};

// =============================================================================
// PARSING FUNCTIONS
// =============================================================================

/**
 * Parse a sub-spine markdown file into a structured checkpoint object.
 *
 * This function extracts:
 * - Checkpoint number and context percentage from the header
 * - Status (GREEN/AMBER/RED) based on context percentage
 * - Completed, In Progress, Blocked, Files, and Next sections
 *
 * The parser is lenient and will:
 * - Return partial results if some sections are missing
 * - Record parse errors without throwing exceptions
 * - Handle various bullet point formats (-, *, +)
 *
 * @param agentId - The agent's session ID (used for tracking, not parsed from content)
 * @param content - Raw markdown content of the sub-spine file
 * @param config - Optional PA configuration for custom thresholds
 *
 * @returns Parsed SubSpineCheckpoint with extracted data and any parse errors
 *
 * @example
 * ```typescript
 * const content = `## Checkpoint 5 | 45% context used
 *
 * **Completed:**
 * - Built authentication module
 * - Added unit tests
 *
 * **In Progress:**
 * - Integrating with API
 *
 * **Blocked:**
 * (none)
 *
 * **Files:**
 * - src/auth/login.ts
 * - src/auth/logout.ts
 *
 * **Next:**
 * - Add error handling
 * `;
 *
 * const checkpoint = parseSubSpineMarkdown('agent-123', content);
 * // checkpoint.status === 'GREEN' (45% < 60%)
 * // checkpoint.completed === ['Built authentication module', 'Added unit tests']
 * ```
 */
export function parseSubSpineMarkdown(
  agentId: string,
  content: string,
  config?: Partial<PAConfig>
): SubSpineCheckpoint {
  const parseErrors: string[] = [];

  // ---------------------------------------------------------------------------
  // Extract checkpoint header
  // Expected format: ## Checkpoint N | X% context used
  // Also handles variations like "## Checkpoint 5 | 72% context"
  // ---------------------------------------------------------------------------
  const headerRegex = /##\s*Checkpoint\s+(\d+)\s*\|\s*(\d+)%\s*context/i;
  const headerMatch = content.match(headerRegex);

  let checkpointNumber = 0;
  let contextPercent = 0;

  if (headerMatch) {
    checkpointNumber = parseInt(headerMatch[1], 10);
    contextPercent = parseInt(headerMatch[2], 10);

    // Validate parsed values
    if (isNaN(checkpointNumber) || checkpointNumber < 0) {
      parseErrors.push(`Invalid checkpoint number: ${headerMatch[1]}`);
      checkpointNumber = 0;
    }
    if (isNaN(contextPercent) || contextPercent < 0 || contextPercent > 100) {
      parseErrors.push(`Invalid context percentage: ${headerMatch[2]}`);
      contextPercent = 0;
    }
  } else {
    parseErrors.push('Missing or malformed checkpoint header. Expected: "## Checkpoint N | X% context used"');
  }

  // ---------------------------------------------------------------------------
  // Calculate status from context percentage
  // Uses CheckpointStatus enum from types.ts
  // ---------------------------------------------------------------------------
  const status = calculateStatus(contextPercent, config);

  // ---------------------------------------------------------------------------
  // Extract all sections
  // ---------------------------------------------------------------------------
  const completed = extractListSection(content, 'Completed');
  const inProgress = extractListSection(content, 'In Progress');
  const blocked = extractListSection(content, 'Blocked');
  const filesTouched = extractListSection(content, 'Files');
  const nextSteps = extractListSection(content, 'Next');

  // Track missing required sections
  if (completed.length === 0 && !content.toLowerCase().includes('**completed:**')) {
    parseErrors.push('Missing Completed section');
  }
  if (inProgress.length === 0 && !content.toLowerCase().includes('**in progress:**')) {
    parseErrors.push('Missing In Progress section');
  }

  // ---------------------------------------------------------------------------
  // Extract timestamp if present, otherwise use current time
  // Expected format: **Timestamp:** YYYY-MM-DDTHH:mm:ss.sssZ
  // ---------------------------------------------------------------------------
  let timestamp = new Date();
  const timestampMatch = content.match(/\*\*Timestamp:\*\*\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/i);
  if (timestampMatch) {
    const parsed = new Date(timestampMatch[1]);
    if (!isNaN(parsed.getTime())) {
      timestamp = parsed;
    }
  }

  return {
    agentId,
    checkpointNumber,
    contextPercent,
    status,
    completed,
    inProgress,
    blocked,
    filesTouched,
    nextSteps,
    rawContent: content,
    parseErrors,
    timestamp,
  };
}

/**
 * Extract a bullet list from a named section in markdown content.
 *
 * Handles multiple section header formats:
 * - `**SectionName:**` (bold with colon)
 * - `### SectionName` (h3 header)
 * - `#### SectionName` (h4 header)
 *
 * Handles multiple bullet formats:
 * - `- item`
 * - `* item`
 * - `+ item`
 * - `  - nested item` (indented items are included)
 *
 * Stops extraction when:
 * - A new section header is encountered
 * - End of content is reached
 * - A horizontal rule (---) is found
 *
 * @param content - The full markdown content to search within
 * @param sectionName - Name of the section to extract (case-insensitive)
 *
 * @returns Array of bullet point items (text only, bullet markers stripped)
 *
 * @example
 * ```typescript
 * const content = `**Completed:**
 * - Built login page
 * - Added validation
 *   - Email validation
 *   - Password validation
 *
 * **In Progress:**
 * - API integration
 * `;
 *
 * const completed = extractListSection(content, 'Completed');
 * // ['Built login page', 'Added validation', 'Email validation', 'Password validation']
 * ```
 */
export function extractListSection(content: string, sectionName: string): string[] {
  // ---------------------------------------------------------------------------
  // Try multiple header patterns
  // Pattern 1: **SectionName:** (bold with colon)
  // Pattern 2: ### SectionName or #### SectionName (markdown headers)
  // ---------------------------------------------------------------------------

  // Escape special regex characters in section name
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Pattern for bold section: **Name:**
  const boldPattern = new RegExp(`\\*\\*${escapedName}:?\\*\\*`, 'i');
  // Pattern for markdown header: ### Name or #### Name
  const headerPattern = new RegExp(`^#{2,4}\\s*${escapedName}:?\\s*$`, 'im');

  let sectionStart = -1;
  let matchLength = 0;

  // Try bold pattern first (most common)
  const boldMatch = content.match(boldPattern);
  if (boldMatch && boldMatch.index !== undefined) {
    sectionStart = boldMatch.index + boldMatch[0].length;
    matchLength = boldMatch[0].length;
  }

  // Try header pattern if bold didn't match
  if (sectionStart === -1) {
    const headerMatch = content.match(headerPattern);
    if (headerMatch && headerMatch.index !== undefined) {
      sectionStart = headerMatch.index + headerMatch[0].length;
      matchLength = headerMatch[0].length;
    }
  }

  // Section not found
  if (sectionStart === -1) {
    return [];
  }

  // ---------------------------------------------------------------------------
  // Find section end (next section header or end of content)
  // ---------------------------------------------------------------------------

  // Look for next section marker
  const nextSectionPatterns = [
    /\n\*\*[A-Z][^*]+:\*\*/i,  // **NextSection:**
    /\n#{2,4}\s+[A-Z]/,        // ## NextSection or ### NextSection
    /\n---+\n/,                // Horizontal rule
    /\n===+\n/,                // Alternate horizontal rule
  ];

  let sectionEnd = content.length;
  for (const pattern of nextSectionPatterns) {
    const match = content.slice(sectionStart).match(pattern);
    if (match && match.index !== undefined) {
      const potentialEnd = sectionStart + match.index;
      if (potentialEnd < sectionEnd) {
        sectionEnd = potentialEnd;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Extract content between section start and end
  // ---------------------------------------------------------------------------

  const sectionContent = content.slice(sectionStart, sectionEnd);

  // ---------------------------------------------------------------------------
  // Parse bullet points
  // Handle: -, *, + with optional indentation
  // Skip empty lines and "(none)" markers
  // ---------------------------------------------------------------------------

  const lines = sectionContent.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Skip "(none)" or "None" markers
    if (/^\(?none\)?$/i.test(trimmedLine)) continue;

    // Skip N/A markers
    if (/^n\/?a$/i.test(trimmedLine)) continue;

    // Check if line is a bullet point
    const bulletMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[1].trim();
      if (itemText) {
        items.push(itemText);
      }
    }
  }

  return items;
}

/**
 * Read a sub-spine file from the filesystem and parse it.
 *
 * This function:
 * 1. Reads the file at the given path
 * 2. Parses the markdown content
 * 3. Returns the structured checkpoint
 *
 * File reading is implemented as a placeholder that will be wired
 * to the actual filesystem after topology configuration.
 *
 * @param filePath - Absolute path to the sub-spine markdown file
 * @param agentId - The agent's session ID
 * @param config - Optional PA configuration for parsing
 *
 * @returns Promise resolving to parsed checkpoint, or null if read fails
 *
 * @example
 * ```typescript
 * const checkpoint = await readSubSpineFile(
 *   '/home/user/project/frontend/subagents/agent-123/sub_spine.md',
 *   'agent-123'
 * );
 *
 * if (checkpoint) {
 *   console.log(`Agent at ${checkpoint.contextPercent}% context`);
 * }
 * ```
 *
 * @placeholder This function uses a placeholder for fs.readFile.
 * Will be wired to actual filesystem operations after topology is finalized.
 */
export async function readSubSpineFile(
  filePath: string,
  agentId: string,
  config?: Partial<PAConfig>
): Promise<SubSpineCheckpoint | null> {
  try {
    // -------------------------------------------------------------------------
    // @placeholder - File system read operation
    // Will be replaced with actual implementation after topology setup
    // -------------------------------------------------------------------------
    // const fs = await import('fs/promises');
    // const content = await fs.readFile(filePath, 'utf-8');

    // For now, log the operation and return null
    console.log(`[spine-reader] Would read file: ${filePath}`);

    // @placeholder - Uncomment when fs is wired:
    // return parseSubSpineMarkdown(agentId, content, config);

    return null;
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        console.warn(`[spine-reader] Sub-spine file not found: ${filePath}`);
      } else if (nodeError.code === 'EACCES') {
        console.error(`[spine-reader] Permission denied reading: ${filePath}`);
      } else {
        console.error(`[spine-reader] Error reading ${filePath}:`, error.message);
      }
    } else {
      console.error(`[spine-reader] Unknown error reading ${filePath}:`, error);
    }

    return null;
  }
}

/**
 * Read all sub-spine files for a list of agents.
 *
 * This function reads sub-spines in parallel for efficiency, then
 * filters out any that failed to parse.
 *
 * Use this for periodic polling of all alive agents.
 *
 * @param agents - Array of agent views containing subSpinePath
 * @param config - Optional PA configuration for parsing
 *
 * @returns Promise resolving to array of successfully parsed checkpoints
 *
 * @example
 * ```typescript
 * const agents: PAAgentView[] = [
 *   { sessionId: 'agent-1', subSpinePath: '/path/to/agent1/sub_spine.md', ... },
 *   { sessionId: 'agent-2', subSpinePath: '/path/to/agent2/sub_spine.md', ... },
 * ];
 *
 * const checkpoints = await readAllSubSpines(agents);
 * console.log(`Read ${checkpoints.length} checkpoints from ${agents.length} agents`);
 *
 * // Check for RED agents
 * const redAgents = checkpoints.filter(cp => cp.status === 'RED');
 * if (redAgents.length > 0) {
 *   console.warn(`${redAgents.length} agents need handover!`);
 * }
 * ```
 */
export async function readAllSubSpines(
  agents: PAAgentView[],
  config?: Partial<PAConfig>
): Promise<SubSpineCheckpoint[]> {
  // ---------------------------------------------------------------------------
  // Read all sub-spines in parallel
  // ---------------------------------------------------------------------------
  const readPromises = agents.map(async (agent) => {
    try {
      return await readSubSpineFile(agent.subSpinePath, agent.sessionId, config);
    } catch (error) {
      console.warn(`[spine-reader] Failed to read sub-spine for ${agent.sessionId}:`, error);
      return null;
    }
  });

  const results = await Promise.all(readPromises);

  // ---------------------------------------------------------------------------
  // Filter out null results (failed reads)
  // ---------------------------------------------------------------------------
  const checkpoints: SubSpineCheckpoint[] = [];
  for (const result of results) {
    if (result !== null) {
      checkpoints.push(result);
    }
  }

  console.log(`[spine-reader] Read ${checkpoints.length}/${agents.length} sub-spines successfully`);

  return checkpoints;
}

/**
 * Calculate agent status based on context usage percentage.
 *
 * Status thresholds determine agent health:
 * - GREEN: Agent is healthy, plenty of context remaining
 * - AMBER: Agent is approaching limit, may need handover soon
 * - RED: Agent is critical, handover required immediately
 *
 * Default thresholds (from PAThresholds):
 * - GREEN: < 70% context used (below tokenWarningPercent)
 * - AMBER: 70% - 85% context used (between warning and critical)
 * - RED: >= 85% context used (at or above tokenCriticalPercent)
 *
 * Custom thresholds can be provided via PAConfig.thresholds:
 * - thresholds.tokenWarningPercent: Percentage where AMBER begins (default 70)
 * - thresholds.tokenCriticalPercent: Percentage where RED begins (default 85)
 *
 * @param contextPercent - Current context usage percentage (0-100)
 * @param config - Optional configuration with custom thresholds
 *
 * @returns CheckpointStatus enum value: GREEN, AMBER, or RED
 *
 * @example
 * ```typescript
 * calculateStatus(45);  // CheckpointStatus.GREEN (below 70%)
 * calculateStatus(72);  // CheckpointStatus.AMBER (between 70% and 85%)
 * calculateStatus(90);  // CheckpointStatus.RED (at or above 85%)
 *
 * // With custom thresholds via config
 * const config: Partial<PAConfig> = {
 *   thresholds: { tokenWarningPercent: 60, tokenCriticalPercent: 80 }
 * };
 * calculateStatus(65, config);  // CheckpointStatus.AMBER
 * ```
 */
export function calculateStatus(
  contextPercent: number,
  config?: Partial<PAConfig>
): CheckpointStatus {
  // Get thresholds from config.thresholds or use defaults
  const amberThreshold = config?.thresholds?.tokenWarningPercent ?? DEFAULT_THRESHOLDS.tokenWarningPercent;
  const redThreshold = config?.thresholds?.tokenCriticalPercent ?? DEFAULT_THRESHOLDS.tokenCriticalPercent;

  // Validate thresholds make sense
  if (amberThreshold >= redThreshold) {
    console.warn(
      `[spine-reader] Invalid thresholds: amber (${amberThreshold}) >= red (${redThreshold}). Using defaults.`
    );
    return contextPercent >= DEFAULT_THRESHOLDS.tokenCriticalPercent
      ? CheckpointStatus.RED
      : contextPercent >= DEFAULT_THRESHOLDS.tokenWarningPercent
        ? CheckpointStatus.AMBER
        : CheckpointStatus.GREEN;
  }

  // Calculate status using CheckpointStatus enum
  if (contextPercent >= redThreshold) {
    return CheckpointStatus.RED;
  } else if (contextPercent >= amberThreshold) {
    return CheckpointStatus.AMBER;
  } else {
    return CheckpointStatus.GREEN;
  }
}

// =============================================================================
// PATH RESOLUTION UTILITIES
// =============================================================================

/**
 * Resolve a sub-spine path from template and agent info.
 *
 * Replaces placeholders in the path template:
 * - {{ PROJECT_ROOT }} -> projectRoot
 * - {{ DOMAIN }} -> agent.domain
 * - {{ AGENT_ID }} -> agent.sessionId
 *
 * @param template - Path template with {{ PLACEHOLDER }} markers
 * @param projectRoot - Root directory of the project
 * @param agent - Agent view containing domain and sessionId
 *
 * @returns Resolved absolute path to sub-spine file
 *
 * @example
 * ```typescript
 * const path = resolveSubSpinePath(
 *   '{{ PROJECT_ROOT }}/{{ DOMAIN }}/subagents/{{ AGENT_ID }}/sub_spine.md',
 *   '/home/user/myproject',
 *   { domain: 'frontend', sessionId: 'agent-abc-123' }
 * );
 * // '/home/user/myproject/frontend/subagents/agent-abc-123/sub_spine.md'
 * ```
 */
export function resolveSubSpinePath(
  template: string,
  projectRoot: string,
  agent: Pick<PAAgentView, 'domain' | 'sessionId'>
): string {
  return template
    .replace(/\{\{\s*PROJECT_ROOT\s*\}\}/g, projectRoot)
    .replace(/\{\{\s*DOMAIN\s*\}\}/g, agent.domain)
    .replace(/\{\{\s*AGENT_ID\s*\}\}/g, agent.sessionId);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  parseSubSpineMarkdown,
  extractListSection,
  readSubSpineFile,
  readAllSubSpines,
  calculateStatus,
  resolveSubSpinePath,
  SUB_SPINE_PATH_TEMPLATE,
  DEFAULT_THRESHOLDS,
};
