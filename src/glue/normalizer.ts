/**
 * Result Normalizer — AgentResult -> GateCheckInput
 *
 * Takes output from any runtime adapter and flattens it into the
 * shape that bodyguard gate-checks expect. Bridges the adapter layer
 * to the enforcement layer.
 *
 * Target: ES2022, CommonJS, strict mode
 */

import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

/**
 * What bodyguard gate-checks expect as input.
 */
export interface GateCheckInput {
  step: {
    id: number;
    action: string;
    detail: string;
    declaredFiles: string[];
    tier: 0 | 1 | 2 | 3;
    isFrontend: boolean;
    modifiedCodeFiles: boolean;
  };
  result: {
    status: string;
    output: string;
    filesCreated: string[];
    filesModified: string[];
    tokensUsed: { input: number; output: number };
    exitCode: number | null;
    error?: string;
  };
  projectDir: string;
}

/**
 * Minimal step shape from the step-scheduler.
 * Kept inline to avoid circular dependency on main/step-scheduler.
 */
export interface SchedulerStep {
  id: number;
  target: 'web' | 'cli' | 'service';
  action: string;
  detail: string;
  waitFor: number[];
  parallel: boolean;
}

/**
 * Adapter result shape. Mirrors AgentResult from adapters/types.ts
 * without importing it directly (avoids coupling glue -> adapters).
 */
export interface AdapterResult {
  id: string;
  status: 'completed' | 'failed' | 'timeout' | 'killed' | 'cancelled';
  output: string;
  filesCreated: string[];
  filesModified: string[];
  tokensUsed: { input: number; output: number };
  duration: number;
  exitCode: number | null;
  runtime: string;
  toolCalls?: string[];
  error?: string;
}

// =============================================================================
// EXTENSION SETS
// =============================================================================

/** File extensions that indicate frontend code */
const FRONTEND_EXTENSIONS = new Set([
  '.tsx', '.jsx', '.css', '.html', '.vue', '.svelte',
]);

/** File extensions that indicate source code (any language) */
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
]);

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Check if any file in the list matches a given set of extensions.
 */
function hasExtension(files: string[], extensions: Set<string>): boolean {
  return files.some((f) => extensions.has(path.extname(f).toLowerCase()));
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Normalize a scheduler step + adapter result into GateCheckInput.
 *
 * @param schedulerStep - The step definition from the DAG scheduler
 * @param adapterResult - The result returned by the runtime adapter
 * @param projectDir    - Absolute path to the project root
 * @param declaredFiles - Files the step declared it would touch (optional)
 */
export function normalize(
  schedulerStep: SchedulerStep,
  adapterResult: AdapterResult,
  projectDir: string,
  declaredFiles?: string[]
): GateCheckInput {
  const resolvedDeclared = declaredFiles ?? [];

  // All files that were touched (created + modified) by the adapter
  const allTouched = [
    ...adapterResult.filesCreated,
    ...adapterResult.filesModified,
  ];

  // Combine declared files with actually touched files for frontend/code checks
  const allRelevant = [...resolvedDeclared, ...allTouched];

  const isFrontend = hasExtension(allRelevant, FRONTEND_EXTENSIONS);
  const modifiedCodeFiles = hasExtension(adapterResult.filesModified, CODE_EXTENSIONS);

  // Default tier is 1. Service steps are tier 0 (informational).
  // CLI steps that modify code are tier 2. Override via caller if needed.
  let tier: 0 | 1 | 2 | 3 = 1;
  if (schedulerStep.target === 'service') {
    tier = 0;
  } else if (schedulerStep.target === 'cli' && modifiedCodeFiles) {
    tier = 2;
  }

  // Build the error field only if present
  const resultError: { error?: string } = {};
  if (adapterResult.error !== undefined) {
    resultError.error = adapterResult.error;
  }

  return {
    step: {
      id: schedulerStep.id,
      action: schedulerStep.action,
      detail: schedulerStep.detail,
      declaredFiles: resolvedDeclared,
      tier,
      isFrontend,
      modifiedCodeFiles,
    },
    result: {
      status: adapterResult.status,
      output: adapterResult.output,
      filesCreated: adapterResult.filesCreated,
      filesModified: adapterResult.filesModified,
      tokensUsed: {
        input: adapterResult.tokensUsed.input,
        output: adapterResult.tokensUsed.output,
      },
      exitCode: adapterResult.exitCode,
      ...resultError,
    },
    projectDir,
  };
}
