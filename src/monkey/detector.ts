/**
 * Curious-Monkey Detector
 *
 * Detects slop, generic output, and silent assumptions in sub_spines.
 * This is READ-ONLY on sub_spines - it only observes, never modifies.
 *
 * Detection results are written ONE-WAY to PA via detections.jsonl.
 * Monkey never receives direct replies - it learns by observing outcomes.
 */

import * as crypto from 'crypto';
import type {
  MonkeyDetection,
  SlopPattern,
  DetectionSeverity,
  ObservedCheckpoint,
  ObservedOutput,
  MonkeyConfig,
} from './types';
import { CURIOUS_MONKEY } from '../enforcement/constants';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_MONKEY_CONFIG: MonkeyConfig = {
  observationIntervalMs: CURIOUS_MONKEY.OBSERVATION_INTERVAL_MS,
  minDetectionConfidence: CURIOUS_MONKEY.MIN_DETECTION_CONFIDENCE,
  buzzwordDensityThreshold: CURIOUS_MONKEY.BUZZWORD_DENSITY_THRESHOLD,
  genericPatterns: CURIOUS_MONKEY.SLOP_PATTERNS.GENERIC_LANGUAGE,
  meaninglessModifiers: CURIOUS_MONKEY.SLOP_PATTERNS.MEANINGLESS_MODIFIERS,
  learningEnabled: true,
};

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Generate unique detection ID
 */
function generateDetectionId(): string {
  return `det_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Detect generic language patterns in text
 */
export function detectGenericLanguage(
  text: string,
  config: MonkeyConfig = DEFAULT_MONKEY_CONFIG
): Array<{ pattern: string; position: number }> {
  const matches: Array<{ pattern: string; position: number }> = [];
  const lowerText = text.toLowerCase();

  for (const pattern of config.genericPatterns) {
    const lowerPattern = pattern.toLowerCase();
    let pos = 0;
    while ((pos = lowerText.indexOf(lowerPattern, pos)) !== -1) {
      matches.push({ pattern, position: pos });
      pos += lowerPattern.length;
    }
  }

  return matches;
}

/**
 * Calculate buzzword density (meaningless modifiers per 100 words)
 */
export function calculateBuzzwordDensity(
  text: string,
  config: MonkeyConfig = DEFAULT_MONKEY_CONFIG
): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;

  let buzzwordCount = 0;
  for (const word of words) {
    if (config.meaninglessModifiers.includes(word)) {
      buzzwordCount++;
    }
  }

  return (buzzwordCount / words.length) * 100;
}

/**
 * Check if checkpoint has assumptions without ASSUMED: markers
 */
export function detectSilentAssumptions(checkpoint: ObservedCheckpoint): boolean {
  // Has completed work but no explicit assumptions
  const hasDecisions = checkpoint.completed.length > 0 || checkpoint.inProgress.length > 0;
  const hasAssumptions = checkpoint.assumptions.length > 0;

  return hasDecisions && !hasAssumptions;
}

/**
 * Check if checkpoint has assumptions but no questions
 */
export function detectNoQuestions(checkpoint: ObservedCheckpoint): boolean {
  return checkpoint.assumptions.length > 0 && checkpoint.questions.length === 0;
}

/**
 * Check if a question is too technical for non-technical users
 */
export function detectTechnicalQuestion(question: string): boolean {
  const technicalPatterns = [
    /\bREST\b/i,
    /\bGraphQL\b/i,
    /\bAPI\b/i,
    /\bCSS\s*(Grid|Flexbox)\b/i,
    /\bdatabase\s*schema\b/i,
    /\bORM\b/i,
    /\bSQL\b/i,
    /\bTypeScript\b/i,
    /\bWebpack\b/i,
    /\bVite\b/i,
    /\bmonorepo\b/i,
    /\bmicroservices?\b/i,
    /\bcontaineriz/i,
    /\bKubernetes\b/i,
    /\bDocker\b/i,
    /\bCI\/CD\b/i,
  ];

  return technicalPatterns.some(pattern => pattern.test(question));
}

/**
 * Detect copy-paste/template smell in output
 */
export function detectCopyPasteSmell(text: string): boolean {
  const templateIndicators = [
    /Lorem ipsum/i,
    /\[Your.*here\]/i,
    /\[Insert.*here\]/i,
    /TODO:/i,
    /FIXME:/i,
    /placeholder/i,
    /example\.com/i,
    /john\.?doe/i,
    /jane\.?doe/i,
    /sample\s+(text|content|data)/i,
  ];

  return templateIndicators.some(pattern => pattern.test(text));
}

// =============================================================================
// MAIN DETECTION PIPELINE
// =============================================================================

/**
 * Analyze a checkpoint and return all detections
 */
export function analyzeCheckpoint(
  checkpoint: ObservedCheckpoint,
  config: MonkeyConfig = DEFAULT_MONKEY_CONFIG
): MonkeyDetection[] {
  const detections: MonkeyDetection[] = [];
  const now = new Date();

  // Check for generic language in raw content
  const genericMatches = detectGenericLanguage(checkpoint.rawContent, config);
  if (genericMatches.length > 0) {
    const confidence = Math.min(0.5 + (genericMatches.length * 0.1), 0.95);
    if (confidence >= config.minDetectionConfidence) {
      detections.push({
        id: generateDetectionId(),
        timestamp: now,
        type: 'GENERIC_LANGUAGE',
        agentId: checkpoint.agentId,
        evidence: genericMatches.map(m => m.pattern).join(', '),
        suggestedQuestion: generateQuestionForGenericLanguage(genericMatches[0].pattern),
        confidence,
        severity: determineSeverity(confidence),
        location: {
          file: `sub_spine_${checkpoint.agentId}.md`,
          section: 'content',
        },
      });
    }
  }

  // Check for silent assumptions
  if (detectSilentAssumptions(checkpoint)) {
    detections.push({
      id: generateDetectionId(),
      timestamp: now,
      type: 'SILENT_ASSUMPTION',
      agentId: checkpoint.agentId,
      evidence: `Agent has ${checkpoint.completed.length} completed tasks but no ASSUMED: markers`,
      suggestedQuestion: undefined, // No question - this is an injection to agent
      confidence: 0.8,
      severity: 'flag',
      location: {
        file: `sub_spine_${checkpoint.agentId}.md`,
        section: 'assumptions',
      },
    });
  }

  // Check for assumptions without questions
  if (detectNoQuestions(checkpoint)) {
    detections.push({
      id: generateDetectionId(),
      timestamp: now,
      type: 'NO_QUESTIONS',
      agentId: checkpoint.agentId,
      evidence: `Agent made ${checkpoint.assumptions.length} assumptions but asked 0 questions`,
      suggestedQuestion: 'What would you like clarified about this approach?',
      confidence: 0.7,
      severity: 'nudge',
      location: {
        file: `sub_spine_${checkpoint.agentId}.md`,
        section: 'questions',
      },
    });
  }

  // Check for technical questions (if agent has questions)
  for (const question of checkpoint.questions) {
    if (detectTechnicalQuestion(question)) {
      detections.push({
        id: generateDetectionId(),
        timestamp: now,
        type: 'TECHNICAL_QUESTION',
        agentId: checkpoint.agentId,
        evidence: question,
        suggestedQuestion: simplifyTechnicalQuestion(question),
        confidence: 0.85,
        severity: 'flag',
        location: {
          file: `sub_spine_${checkpoint.agentId}.md`,
          section: 'questions',
        },
      });
    }
  }

  // Check buzzword density
  const density = calculateBuzzwordDensity(checkpoint.rawContent, config);
  if (density > config.buzzwordDensityThreshold) {
    detections.push({
      id: generateDetectionId(),
      timestamp: now,
      type: 'BUZZWORD_DENSITY',
      agentId: checkpoint.agentId,
      evidence: `Buzzword density: ${density.toFixed(1)} per 100 words (threshold: ${config.buzzwordDensityThreshold})`,
      suggestedQuestion: 'Can you be more specific about what you mean?',
      confidence: Math.min(0.5 + (density / 10), 0.9),
      severity: 'nudge',
      location: {
        file: `sub_spine_${checkpoint.agentId}.md`,
        section: 'content',
      },
    });
  }

  return detections;
}

/**
 * Analyze agent output for slop
 */
export function analyzeOutput(
  output: ObservedOutput,
  config: MonkeyConfig = DEFAULT_MONKEY_CONFIG
): MonkeyDetection[] {
  const detections: MonkeyDetection[] = [];
  const now = new Date();

  // Check for copy-paste smell
  if (detectCopyPasteSmell(output.content)) {
    detections.push({
      id: generateDetectionId(),
      timestamp: now,
      type: 'COPY_PASTE_SMELL',
      agentId: output.agentId,
      evidence: 'Template/placeholder text detected in output',
      suggestedQuestion: undefined, // This needs agent injection, not user question
      confidence: 0.9,
      severity: 'flag',
      location: output.filePath ? {
        file: output.filePath,
        section: 'content',
      } : undefined,
    });
  }

  // Check for generic language in output
  const genericMatches = detectGenericLanguage(output.content, config);
  if (genericMatches.length >= 2) { // Need multiple matches in output
    const confidence = Math.min(0.4 + (genericMatches.length * 0.1), 0.9);
    if (confidence >= config.minDetectionConfidence) {
      detections.push({
        id: generateDetectionId(),
        timestamp: now,
        type: 'GENERIC_LANGUAGE',
        agentId: output.agentId,
        evidence: genericMatches.map(m => m.pattern).join(', '),
        suggestedQuestion: generateQuestionForGenericLanguage(genericMatches[0].pattern),
        confidence,
        severity: determineSeverity(confidence),
        location: output.filePath ? {
          file: output.filePath,
          section: 'content',
        } : undefined,
      });
    }
  }

  return detections;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine severity based on confidence
 */
function determineSeverity(confidence: number): DetectionSeverity {
  if (confidence >= 0.85) return 'escalate';
  if (confidence >= 0.7) return 'flag';
  return 'nudge';
}

/**
 * Generate a user-friendly question for generic language detection
 */
function generateQuestionForGenericLanguage(pattern: string): string {
  const questionMap: Record<string, string> = {
    'professional website': 'What feeling should visitors get from your site? Trustworthy? Innovative? Approachable?',
    'user-friendly interface': 'Who will use this most? What\'s their comfort level with technology?',
    'modern design': 'Any websites you love the look of? I can check them out for inspiration.',
    'clean design': 'What does "clean" mean to you? Minimal? Spacious? Organized?',
    'cutting-edge': 'What specific features would make this feel current?',
    'best practices': 'What matters most - speed, maintainability, or something else?',
    'seamless experience': 'Walk me through the ideal flow - what happens step by step?',
    'intuitive interface': 'What should someone be able to do without any instructions?',
    'robust solution': 'What would break this? What are you most worried about?',
  };

  const lowerPattern = pattern.toLowerCase();
  return questionMap[lowerPattern] || 'Can you tell me more about what you\'re looking for?';
}

/**
 * Simplify a technical question for non-technical users
 */
function simplifyTechnicalQuestion(technicalQuestion: string): string {
  // This is a basic implementation - could be made smarter
  if (/REST.*GraphQL/i.test(technicalQuestion)) {
    return 'How will your data be accessed - mainly from a website, a mobile app, or both?';
  }
  if (/CSS\s*(Grid|Flexbox)/i.test(technicalQuestion)) {
    return 'Should the layout be more like a grid (like Pinterest) or more like stacked sections?';
  }
  if (/database/i.test(technicalQuestion)) {
    return 'How much data do you expect to store? A little, a lot, or you\'re not sure?';
  }
  if (/Docker|Kubernetes|container/i.test(technicalQuestion)) {
    return 'Do you have a hosting preference, or should I pick what works best?';
  }

  // Generic fallback
  return 'I\'ll make the technical decision on this - is there anything you\'d like to know about the tradeoffs?';
}
