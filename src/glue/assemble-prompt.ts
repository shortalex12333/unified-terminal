/**
 * Targeted Prompt Assembly
 *
 * Reads skill markdown files, extracts relevant sections based on mode,
 * and assembles a final prompt with spine context for agent execution.
 *
 * Target: ES2022, CommonJS, strict mode
 */

import * as fs from 'fs';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptParts {
  /** Injected skill content (targeted or full sections) */
  skillSections: string;
  /** Spine context wrapped in XML tags */
  spineContext: string;
  /** The actual task/instruction */
  userInput: string;
  /** Estimated total tokens (chars / 4) */
  totalTokens: number;
}

export interface AssembleOptions {
  /** Absolute paths to skill markdown files */
  skills: string[];
  /** step.detail or user message */
  userInput: string;
  /** Subset of SpineState for context injection */
  spineContext: {
    projectDir: string;
    recentChanges: string[];
    tokenBudget: { used: number; limit: number };
  };
  /** 'full' injects all sections; 'targeted' (default) injects only essential ones */
  mode?: 'full' | 'targeted';
  /** Include [6] Failure Modes section when true */
  highRisk?: boolean;
  /** Include [7] Success Criteria section when true */
  multiStep?: boolean;
}

// =============================================================================
// SECTION HEADER MAPPING
// =============================================================================

/**
 * Maps logical section names to markdown H2 headers found in skill files.
 * Sections are numbered [1]-[7] in the architecture spec.
 */
const SECTION_HEADERS: Record<string, string> = {
  youAre: '## You Are',           // [1]
  context: '## Context',          // [2]
  process: '## Process',          // [3]
  hardBoundaries: '## Hard Boundaries', // [4]
  outputFormat: '## Output Format',     // [5]
  failureModes: '## Failure Modes',     // [6] - only if highRisk
  success: '## Success',               // [7] - only if multiStep
  metadata: '## Metadata',             // [8] - full mode only
};

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Parse a markdown file into a map of section header -> content.
 * Each section runs from its H2 header to the next H2 header (or EOF).
 */
function parseSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split('\n');
  let currentHeader: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentHeader !== null) {
        sections.set(currentHeader, currentLines.join('\n').trim());
      }
      currentHeader = line.trim();
      currentLines = [];
    } else if (currentHeader !== null) {
      currentLines.push(line);
    }
  }

  // Save final section
  if (currentHeader !== null) {
    sections.set(currentHeader, currentLines.join('\n').trim());
  }

  return sections;
}

/**
 * Determine which section headers to include based on mode and flags.
 */
function getRequiredHeaders(
  mode: 'full' | 'targeted',
  highRisk: boolean,
  multiStep: boolean
): string[] {
  if (mode === 'full') {
    return Object.values(SECTION_HEADERS);
  }

  // Targeted mode: always include [1] You Are, [4] Hard Boundaries, [5] Output Format
  const headers: string[] = [
    SECTION_HEADERS.youAre,
    SECTION_HEADERS.hardBoundaries,
    SECTION_HEADERS.outputFormat,
  ];

  if (highRisk) {
    headers.push(SECTION_HEADERS.failureModes);
  }

  if (multiStep) {
    headers.push(SECTION_HEADERS.success);
  }

  return headers;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Assemble a prompt from skill files, spine context, and user input.
 *
 * Reads each skill markdown file, extracts the relevant sections based on
 * mode/flags, wraps spine context in XML tags, and concatenates everything
 * into a final prompt with a token estimate.
 */
export function assemblePrompt(options: AssembleOptions): PromptParts {
  const {
    skills,
    userInput,
    spineContext,
    mode = 'targeted',
    highRisk = false,
    multiStep = false,
  } = options;

  const requiredHeaders = getRequiredHeaders(mode, highRisk, multiStep);
  const skillParts: string[] = [];

  for (const skillPath of skills) {
    let content: string;
    try {
      content = fs.readFileSync(skillPath, 'utf-8');
    } catch {
      // Skill file unreadable — skip silently
      continue;
    }

    const sections = parseSections(content);
    const extracted: string[] = [];

    for (const header of requiredHeaders) {
      const body = sections.get(header);
      if (body !== undefined && body.length > 0) {
        extracted.push(`${header}\n${body}`);
      }
      // Section header not found in this skill — skip silently
    }

    if (extracted.length > 0) {
      skillParts.push(extracted.join('\n\n'));
    }
  }

  const skillSections = skillParts.join('\n\n---\n\n');

  const spineContextStr = [
    '<spine_context>',
    JSON.stringify(spineContext, null, 2),
    '</spine_context>',
  ].join('\n');

  const TOKEN_BUDGET = 80_000;

  let finalSkillSections = skillSections;
  let totalString = finalSkillSections + '\n\n' + spineContextStr + '\n\n' + userInput;
  let totalTokens = Math.ceil(totalString.length / 4);

  // Enforce token budget by truncating skill sections
  if (totalTokens > TOKEN_BUDGET) {
    const overageChars = (totalTokens - TOKEN_BUDGET) * 4;
    const maxSkillChars = Math.max(0, finalSkillSections.length - overageChars);
    finalSkillSections = finalSkillSections.slice(0, maxSkillChars);
    console.warn(
      `[assemblePrompt] Token budget exceeded (${totalTokens} > ${TOKEN_BUDGET}). ` +
      `Truncated skill sections by ${overageChars} chars.`,
    );
    totalString = finalSkillSections + '\n\n' + spineContextStr + '\n\n' + userInput;
    totalTokens = Math.ceil(totalString.length / 4);
  }

  return {
    skillSections: finalSkillSections,
    spineContext: spineContextStr,
    userInput,
    totalTokens,
  };
}
