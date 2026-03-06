/**
 * Work Output System
 *
 * Workers write structured output showing their reasoning and work.
 * Bodyguard reads these files to validate work quality.
 *
 * Location: .kenoki/work_outputs/{stepId}.md
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkOutput {
  // Identification
  stepId: string;
  workerId: string;
  completedAt: string;

  // Task context
  task: string;
  phase: string;
  tier: 1 | 2 | 3;

  // Show your work
  reasoning: string;
  approach: string;

  // What was done
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];

  // Verification
  testsAdded: string[];
  testsRun: boolean;
  testsPassed: boolean;
  testOutput?: string;

  // Open items
  assumptions: string[];
  openQuestions: string[];
  blockers: string[];

  // Token usage (for CARL tracking)
  tokensUsed: number;

  // Timing
  startedAt: string;
  durationMs: number;
}

// ============================================================================
// PATHS
// ============================================================================

function getWorkOutputDir(projectRoot: string): string {
  return path.join(projectRoot, '.kenoki', 'work_outputs');
}

function getWorkOutputPath(projectRoot: string, stepId: string): string {
  return path.join(getWorkOutputDir(projectRoot), `${stepId}.md`);
}

// ============================================================================
// ENSURE DIRECTORY
// ============================================================================

function ensureWorkOutputDir(projectRoot: string): void {
  const dir = getWorkOutputDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// FORMAT AS MARKDOWN
// ============================================================================

function formatWorkOutputAsMarkdown(output: WorkOutput): string {
  return `# Work Output: ${output.stepId}

## Metadata
- **Worker ID:** ${output.workerId}
- **Phase:** ${output.phase}
- **Tier:** ${output.tier}
- **Started:** ${output.startedAt}
- **Completed:** ${output.completedAt}
- **Duration:** ${output.durationMs}ms
- **Tokens Used:** ${output.tokensUsed}

## Task
${output.task}

## Reasoning
${output.reasoning}

## Approach
${output.approach}

## Files Created
${output.filesCreated.length > 0 ? output.filesCreated.map(f => `- ${f}`).join('\n') : '_None_'}

## Files Modified
${output.filesModified.length > 0 ? output.filesModified.map(f => `- ${f}`).join('\n') : '_None_'}

## Files Deleted
${output.filesDeleted.length > 0 ? output.filesDeleted.map(f => `- ${f}`).join('\n') : '_None_'}

## Tests
- **Tests Added:** ${output.testsAdded.length > 0 ? output.testsAdded.join(', ') : 'None'}
- **Tests Run:** ${output.testsRun ? 'Yes' : 'No'}
- **Tests Passed:** ${output.testsPassed ? 'Yes' : 'No'}

${output.testOutput ? `### Test Output\n\`\`\`\n${output.testOutput}\n\`\`\`` : ''}

## Assumptions
${output.assumptions.length > 0 ? output.assumptions.map(a => `- ASSUMED: ${a}`).join('\n') : '_None_'}

## Open Questions
${output.openQuestions.length > 0 ? output.openQuestions.map(q => `- ${q}`).join('\n') : '_None_'}

## Blockers
${output.blockers.length > 0 ? output.blockers.map(b => `- ${b}`).join('\n') : '_None_'}
`;
}

// ============================================================================
// PARSE FROM MARKDOWN
// ============================================================================

function parseWorkOutputFromMarkdown(content: string, stepId: string): WorkOutput | null {
  try {
    // Extract metadata
    const workerIdMatch = content.match(/\*\*Worker ID:\*\* (.+)/);
    const phaseMatch = content.match(/\*\*Phase:\*\* (.+)/);
    const tierMatch = content.match(/\*\*Tier:\*\* (\d)/);
    const startedMatch = content.match(/\*\*Started:\*\* (.+)/);
    const completedMatch = content.match(/\*\*Completed:\*\* (.+)/);
    const durationMatch = content.match(/\*\*Duration:\*\* (\d+)ms/);
    const tokensMatch = content.match(/\*\*Tokens Used:\*\* (\d+)/);

    // Extract sections
    const extractSection = (sectionName: string): string[] => {
      const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
      const match = content.match(regex);
      if (!match) return [];

      return match[1]
        .split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.replace(/^- (ASSUMED: )?/, '').trim());
    };

    const extractText = (sectionName: string): string => {
      const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : '';
    };

    // Extract test status
    const testsRunMatch = content.match(/\*\*Tests Run:\*\* (Yes|No)/);
    const testsPassedMatch = content.match(/\*\*Tests Passed:\*\* (Yes|No)/);

    return {
      stepId,
      workerId: workerIdMatch?.[1] || 'unknown',
      phase: phaseMatch?.[1] || 'unknown',
      tier: (parseInt(tierMatch?.[1] || '1', 10) as 1 | 2 | 3),
      startedAt: startedMatch?.[1] || '',
      completedAt: completedMatch?.[1] || '',
      durationMs: parseInt(durationMatch?.[1] || '0', 10),
      tokensUsed: parseInt(tokensMatch?.[1] || '0', 10),
      task: extractText('Task'),
      reasoning: extractText('Reasoning'),
      approach: extractText('Approach'),
      filesCreated: extractSection('Files Created'),
      filesModified: extractSection('Files Modified'),
      filesDeleted: extractSection('Files Deleted'),
      testsAdded: [],  // Would need more complex parsing
      testsRun: testsRunMatch?.[1] === 'Yes',
      testsPassed: testsPassedMatch?.[1] === 'Yes',
      assumptions: extractSection('Assumptions'),
      openQuestions: extractSection('Open Questions'),
      blockers: extractSection('Blockers'),
    };
  } catch (error) {
    console.error(`[WorkOutput] Failed to parse: ${error}`);
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Write a work output file.
 */
export function writeWorkOutput(projectRoot: string, output: WorkOutput): string {
  ensureWorkOutputDir(projectRoot);

  const filePath = getWorkOutputPath(projectRoot, output.stepId);
  const content = formatWorkOutputAsMarkdown(output);

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`[WorkOutput] Wrote ${filePath}`);

  return filePath;
}

/**
 * Read a work output file.
 */
export function readWorkOutput(projectRoot: string, stepId: string): WorkOutput | null {
  const filePath = getWorkOutputPath(projectRoot, stepId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseWorkOutputFromMarkdown(content, stepId);
}

/**
 * Check if work output exists.
 */
export function workOutputExists(projectRoot: string, stepId: string): boolean {
  return fs.existsSync(getWorkOutputPath(projectRoot, stepId));
}

/**
 * List all work outputs.
 */
export function listWorkOutputs(projectRoot: string): string[] {
  const dir = getWorkOutputDir(projectRoot);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

/**
 * Delete a work output (cleanup).
 */
export function deleteWorkOutput(projectRoot: string, stepId: string): boolean {
  const filePath = getWorkOutputPath(projectRoot, stepId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }

  return false;
}

/**
 * Create a work output builder for easier construction.
 */
export function createWorkOutputBuilder(stepId: string, workerId: string): WorkOutputBuilder {
  return new WorkOutputBuilder(stepId, workerId);
}

// ============================================================================
// BUILDER CLASS
// ============================================================================

export class WorkOutputBuilder {
  private output: Partial<WorkOutput>;
  private startTime: number;

  constructor(stepId: string, workerId: string) {
    this.startTime = Date.now();
    this.output = {
      stepId,
      workerId,
      startedAt: new Date().toISOString(),
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      testsAdded: [],
      testsRun: false,
      testsPassed: false,
      assumptions: [],
      openQuestions: [],
      blockers: [],
      tokensUsed: 0,
    };
  }

  setTask(task: string, phase: string, tier: 1 | 2 | 3): this {
    this.output.task = task;
    this.output.phase = phase;
    this.output.tier = tier;
    return this;
  }

  setReasoning(reasoning: string, approach: string): this {
    this.output.reasoning = reasoning;
    this.output.approach = approach;
    return this;
  }

  addFileCreated(file: string): this {
    this.output.filesCreated!.push(file);
    return this;
  }

  addFileModified(file: string): this {
    this.output.filesModified!.push(file);
    return this;
  }

  addFileDeleted(file: string): this {
    this.output.filesDeleted!.push(file);
    return this;
  }

  addTestAdded(test: string): this {
    this.output.testsAdded!.push(test);
    return this;
  }

  setTestResults(run: boolean, passed: boolean, output?: string): this {
    this.output.testsRun = run;
    this.output.testsPassed = passed;
    this.output.testOutput = output;
    return this;
  }

  addAssumption(assumption: string): this {
    this.output.assumptions!.push(assumption);
    return this;
  }

  addQuestion(question: string): this {
    this.output.openQuestions!.push(question);
    return this;
  }

  addBlocker(blocker: string): this {
    this.output.blockers!.push(blocker);
    return this;
  }

  setTokensUsed(tokens: number): this {
    this.output.tokensUsed = tokens;
    return this;
  }

  build(): WorkOutput {
    this.output.completedAt = new Date().toISOString();
    this.output.durationMs = Date.now() - this.startTime;
    return this.output as WorkOutput;
  }
}
