import { spawn } from 'child_process';
import { ClassificationResult, ProjectType, CONFIDENCE_THRESHOLD } from './types';

/**
 * Classifier prompt - kept minimal for speed (~200 tokens)
 */
const CLASSIFIER_PROMPT = `Classify this project request into exactly one PRIMARY type and any ADDON types.

PRIMARY types (pick exactly one):
- site: static website, landing page, portfolio, blog
- app: web application with backend, database, user auth
- ecom: online store, payments, inventory, shopping cart
- existing: working on existing codebase, optimization, bug fix, refactoring
- chat: general question, not a build request
- quick: tiny task, single file change, simple fix

ADDON types (pick zero or more, only if the request clearly needs multiple):
- If ecom needs custom app backend, add "app"
- If site needs payment, add "ecom"
- etc.

Respond ONLY with JSON:
{
  "primary": "site|app|ecom|existing|chat|quick",
  "addons": [],
  "confidence": 0.0-1.0,
  "extractedGoal": "what they want to build in 10 words or less",
  "suggestedName": "kebab-case-project-name"
}

Request: {{INPUT}}`;

/**
 * Classify a user's project request using a cheap Codex call
 */
export async function classifyProject(input: string): Promise<ClassificationResult> {
  const prompt = CLASSIFIER_PROMPT.replace('{{INPUT}}', input);

  return new Promise((resolve, reject) => {
    const codex = spawn('codex', [
      '--quiet',
      '--approval-mode', 'full-auto',
      prompt
    ]);

    let output = '';
    let error = '';

    codex.stdout.on('data', (data) => {
      output += data.toString();
    });

    codex.stderr.on('data', (data) => {
      error += data.toString();
    });

    codex.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Classifier failed: ${error}`));
        return;
      }

      try {
        // Extract JSON from output (may have surrounding text)
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in classifier output');
        }

        const result = JSON.parse(jsonMatch[0]) as ClassificationResult;

        // Validate required fields
        if (!result.primary || typeof result.confidence !== 'number') {
          throw new Error('Invalid classification result');
        }

        // Ensure addons is an array
        result.addons = result.addons || [];

        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse classification: ${e}`));
      }
    });

    // Timeout after 10 seconds (this should be fast)
    setTimeout(() => {
      codex.kill();
      reject(new Error('Classification timed out'));
    }, 10000);
  });
}

/**
 * Check if classification needs user confirmation
 */
export function needsConfirmation(result: ClassificationResult): boolean {
  return result.confidence < CONFIDENCE_THRESHOLD;
}

/**
 * Get human-readable description of classification
 */
export function describeClassification(result: ClassificationResult): string {
  const typeDescriptions: Record<ProjectType, string> = {
    site: 'a static website',
    app: 'a web application',
    ecom: 'an online store',
    existing: 'work on existing code',
    chat: 'a general question',
    quick: 'a quick task',
  };

  let description = `I think you want to build ${typeDescriptions[result.primary]}`;

  if (result.addons.length > 0) {
    const addonDescriptions = result.addons.map(a => typeDescriptions[a]);
    description += ` with ${addonDescriptions.join(' and ')}`;
  }

  description += ` (${Math.round(result.confidence * 100)}% confident)`;

  return description;
}
