/**
 * Unified Terminal - Brief Builder
 *
 * Parses ChatGPT's JSON responses into typed ProjectBrief objects.
 * Handles malformed JSON, missing fields, and type coercion.
 */

import {
  TaskType,
  ExecutionPath,
  PluginName,
  ProjectBrief,
  ProjectRequirements,
} from './types';
import { classifyTask } from './task-classifier';

// ============================================================================
// TYPE VALIDATION
// ============================================================================

/**
 * Valid task types that can appear in JSON.
 */
const VALID_TASK_TYPES: TaskType[] = [
  'build_product',
  'build_content',
  'research',
  'automate',
  'general',
];

/**
 * Valid execution paths that can appear in JSON.
 */
const VALID_EXECUTION_PATHS: ExecutionPath[] = ['browser', 'local', 'hybrid'];

/**
 * Valid plugin names that can appear in JSON.
 */
const VALID_PLUGINS: PluginName[] = [
  'gsd',
  'codex',
  'claude',
  'playwright',
  'scraper',
  'dall-e',
  'whisper',
  'vercel',
  'github',
];

/**
 * Check if a value is a valid task type.
 */
function isValidTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && VALID_TASK_TYPES.includes(value as TaskType);
}

/**
 * Check if a value is a valid execution path.
 */
function isValidExecutionPath(value: unknown): value is ExecutionPath {
  return typeof value === 'string' && VALID_EXECUTION_PATHS.includes(value as ExecutionPath);
}

/**
 * Check if a value is a valid plugin name.
 */
function isValidPlugin(value: unknown): value is PluginName {
  return typeof value === 'string' && VALID_PLUGINS.includes(value as PluginName);
}

// ============================================================================
// JSON EXTRACTION
// ============================================================================

/**
 * Extract JSON from a string that might contain markdown or extra text.
 * Handles common ChatGPT response patterns.
 */
export function extractJSON(text: string): string | null {
  // Try to find JSON object in the text
  const patterns = [
    // Exact JSON (starts and ends with braces)
    /^\s*(\{[\s\S]*\})\s*$/,
    // JSON in markdown code block
    /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    // JSON anywhere in text (greedy)
    /(\{[\s\S]*\})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Clean JSON string of common issues.
 */
function cleanJSON(jsonStr: string): string {
  return jsonStr
    // Remove trailing commas before closing braces/brackets
    .replace(/,\s*([}\]])/g, '$1')
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .trim();
}

// ============================================================================
// REQUIREMENT PARSING
// ============================================================================

/**
 * Parse requirements object from JSON, handling snake_case to camelCase.
 */
function parseRequirements(raw: unknown): ProjectRequirements {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const requirements: ProjectRequirements = {};

  // Map snake_case keys to camelCase
  const keyMap: Record<string, keyof ProjectRequirements> = {
    target_audience: 'targetAudience',
    targetAudience: 'targetAudience',
    existing_assets: 'existingAssets',
    existingAssets: 'existingAssets',
    success_metric: 'successMetric',
    successMetric: 'successMetric',
    constraints: 'constraints',
    style: 'style',
    timeline: 'timeline',
    budget: 'budget',
  };

  for (const [rawKey, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.trim()) {
      const mappedKey = keyMap[rawKey] || rawKey;
      requirements[mappedKey] = value.trim();
    }
  }

  return requirements;
}

/**
 * Parse plugins array, filtering to valid plugins only.
 */
function parsePlugins(raw: unknown): PluginName[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(isValidPlugin)
    .filter((value, index, self) => self.indexOf(value) === index); // Dedupe
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a JSON string (from ChatGPT response) into a ProjectBrief.
 *
 * @param jsonString - Raw JSON string from ChatGPT
 * @param originalRequest - User's original request (for fallback)
 * @returns Parsed ProjectBrief or null if parsing fails
 */
export function parseBriefFromJSON(
  jsonString: string,
  originalRequest: string = ''
): ProjectBrief | null {
  // Extract JSON from potential markdown/text wrapping
  const extracted = extractJSON(jsonString);
  if (!extracted) {
    console.error('[BriefBuilder] Could not extract JSON from response');
    return null;
  }

  // Clean the JSON
  const cleaned = cleanJSON(extracted);

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('[BriefBuilder] JSON parse error:', err);
    return null;
  }

  // Validate structure
  if (!parsed || typeof parsed !== 'object') {
    console.error('[BriefBuilder] Parsed value is not an object');
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Extract and validate task_type
  let taskType: TaskType = 'general';
  if (isValidTaskType(obj.task_type)) {
    taskType = obj.task_type;
  } else if (isValidTaskType(obj.taskType)) {
    taskType = obj.taskType;
  }

  // Extract category
  const category = typeof obj.category === 'string' ? obj.category.trim() : '';

  // Extract and validate execution_path
  let executionPath: ExecutionPath = 'hybrid';
  if (isValidExecutionPath(obj.execution_path)) {
    executionPath = obj.execution_path;
  } else if (isValidExecutionPath(obj.executionPath)) {
    executionPath = obj.executionPath;
  }

  // Extract requirements
  const requirements = parseRequirements(obj.requirements);

  // Extract plugins
  const pluginsNeeded = parsePlugins(obj.plugins_needed || obj.pluginsNeeded);

  // Build the brief
  const brief: ProjectBrief = {
    taskType,
    category,
    requirements,
    executionPath,
    pluginsNeeded,
    rawRequest: originalRequest,
    intakeComplete: true,
    skipped: false,
  };

  return brief;
}

// ============================================================================
// FALLBACK BRIEF
// ============================================================================

/**
 * Create a fallback brief when JSON parsing fails.
 * Uses task classifier to make intelligent assumptions.
 *
 * @param originalRequest - User's original request
 * @returns Fallback ProjectBrief
 */
export function createFallbackBrief(originalRequest: string): ProjectBrief {
  // Use classifier to get best guess
  const classification = classifyTask(originalRequest);

  return {
    taskType: classification.taskType,
    category: `Inferred from: "${originalRequest.substring(0, 50)}..."`,
    requirements: {
      targetAudience: 'Not specified',
      existingAssets: 'Not specified',
      successMetric: 'Completion of request',
      constraints: 'None specified',
    },
    executionPath: classification.suggestedPath,
    pluginsNeeded: classification.suggestedPlugins,
    rawRequest: originalRequest,
    intakeComplete: true,
    skipped: true,
  };
}

// ============================================================================
// BRIEF VALIDATION
// ============================================================================

/**
 * Validate that a brief has minimum required fields.
 */
export function validateBrief(brief: ProjectBrief): string[] {
  const errors: string[] = [];

  if (!brief.taskType) {
    errors.push('Missing task type');
  }

  if (!brief.executionPath) {
    errors.push('Missing execution path');
  }

  if (!brief.rawRequest) {
    errors.push('Missing original request');
  }

  return errors;
}

/**
 * Check if a brief is complete enough to proceed.
 */
export function isBriefComplete(brief: ProjectBrief): boolean {
  return validateBrief(brief).length === 0;
}

// ============================================================================
// BRIEF FORMATTING
// ============================================================================

/**
 * Format a brief as human-readable text for display.
 */
export function formatBriefForDisplay(brief: ProjectBrief): string {
  const lines: string[] = [
    `Task Type: ${brief.taskType}`,
    `Category: ${brief.category || 'Not specified'}`,
    `Execution Path: ${brief.executionPath}`,
    `Plugins: ${brief.pluginsNeeded.length > 0 ? brief.pluginsNeeded.join(', ') : 'None'}`,
    '',
    'Requirements:',
  ];

  for (const [key, value] of Object.entries(brief.requirements)) {
    if (value) {
      // Convert camelCase to Title Case
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      lines.push(`  ${label}: ${value}`);
    }
  }

  if (brief.skipped) {
    lines.push('');
    lines.push('(Brief was auto-generated - intake questions were skipped)');
  }

  return lines.join('\n');
}
