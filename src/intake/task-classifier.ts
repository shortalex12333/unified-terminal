/**
 * Unified Terminal - Task Classifier
 *
 * Analyzes user messages to detect task type and required capabilities.
 * Uses pattern matching to classify requests into execution paths.
 */

import {
  TaskType,
  ExecutionPath,
  PluginName,
  TaskSignals,
  TaskClassification,
} from './types';

// ============================================================================
// SIGNAL DETECTION PATTERNS
// ============================================================================

/**
 * Patterns that indicate code/product building needs.
 */
const CODE_PATTERNS = [
  /\b(build|create|develop|make)\b.*\b(website|site|app|application|page|landing\s*page|store|shop|platform|dashboard|portal)\b/i,
  /\b(website|app|landing\s*page|web\s*app|mobile\s*app|store|ecommerce|e-commerce)\b/i,
  /\b(code|programming|software|development)\b/i,
  /\b(frontend|backend|fullstack|full-stack|api)\b/i,
  /\b(react|vue|angular|next|nuxt|svelte|node|python|typescript)\b/i,
];

/**
 * Patterns that indicate research needs.
 */
const RESEARCH_PATTERNS = [
  /\b(research|analyze|find|compare|investigate|study|explore)\b/i,
  /\b(market|competitor|competition|industry|trend|data)\b.*\b(research|analysis)\b/i,
  /\b(what|how|why|when|where)\b.*\b(best|top|popular|trending)\b/i,
  /\b(find\s+out|look\s+into|dig\s+into)\b/i,
  /\b(report|summary|overview|breakdown)\b/i,
];

/**
 * Patterns that indicate content creation needs.
 */
const CONTENT_PATTERNS = [
  /\b(write|draft|compose|create)\b.*\b(blog|post|article|copy|email|newsletter|script|content)\b/i,
  /\b(blog\s*post|article|copy|copywriting|email|newsletter)\b/i,
  /\b(content|writing|text|documentation|docs|readme)\b/i,
  /\b(social\s*media|instagram|twitter|linkedin|facebook)\s*(post|content|copy)?\b/i,
  /\b(marketing|ad|advertisement|promo)\s*(copy|content|text)?\b/i,
];

/**
 * Patterns that indicate image/design needs.
 */
const IMAGE_PATTERNS = [
  /\b(design|image|logo|brand|visual|graphic|icon|illustration)\b/i,
  /\b(create|make|generate)\b.*\b(image|logo|graphic|icon)\b/i,
  /\b(ui|ux|interface|mockup|wireframe|prototype)\b/i,
  /\b(branding|identity|style\s*guide)\b/i,
  /\b(dall-?e|midjourney|stable\s*diffusion|ai\s*image)\b/i,
];

/**
 * Patterns that indicate automation needs.
 */
const AUTOMATION_PATTERNS = [
  /\b(automate|automation|scrape|scraping|crawl|crawler|bot)\b/i,
  /\b(fill|submit)\b.*\b(form|forms)\b/i,
  /\b(book|schedule|reserve)\b.*\b(appointment|meeting|slot)\b/i,
  /\b(extract|pull|get)\b.*\b(data|info|information)\b.*\b(from|off)\b/i,
  /\b(monitor|track|watch)\b.*\b(price|stock|availability|changes)\b/i,
  /\b(bulk|batch|mass)\b.*\b(download|upload|process)\b/i,
];

/**
 * Patterns that indicate deployment needs.
 */
const DEPLOYMENT_PATTERNS = [
  /\b(deploy|publish|launch|host|go\s*live)\b/i,
  /\b(vercel|netlify|heroku|aws|azure|gcp|digitalocean)\b/i,
  /\b(production|live|public)\b/i,
  /\b(domain|dns|ssl|https)\b/i,
];

// ============================================================================
// SIGNAL DETECTION
// ============================================================================

/**
 * Detect all signals present in a user message.
 */
export function detectSignals(message: string): TaskSignals {
  return {
    needsCode: CODE_PATTERNS.some(p => p.test(message)),
    needsResearch: RESEARCH_PATTERNS.some(p => p.test(message)),
    needsContent: CONTENT_PATTERNS.some(p => p.test(message)),
    needsImages: IMAGE_PATTERNS.some(p => p.test(message)),
    needsAutomation: AUTOMATION_PATTERNS.some(p => p.test(message)),
    needsDeployment: DEPLOYMENT_PATTERNS.some(p => p.test(message)),
  };
}

// ============================================================================
// TASK TYPE DETERMINATION
// ============================================================================

/**
 * Determine primary task type from detected signals.
 */
function determineTaskType(signals: TaskSignals): TaskType {
  // Priority order: automation > code > content > research > general
  // Automation is highest because it's very specific
  if (signals.needsAutomation) {
    return 'automate';
  }

  // Code/product building is next priority
  if (signals.needsCode) {
    return 'build_product';
  }

  // Content creation
  if (signals.needsContent) {
    return 'build_content';
  }

  // Research
  if (signals.needsResearch) {
    return 'research';
  }

  // Images alone might be build_content or build_product
  if (signals.needsImages) {
    return 'build_content';
  }

  // Default to general
  return 'general';
}

// ============================================================================
// EXECUTION PATH DETERMINATION
// ============================================================================

/**
 * Determine execution path based on task type and signals.
 */
function determineExecutionPath(
  taskType: TaskType,
  signals: TaskSignals
): ExecutionPath {
  // Automation always needs browser
  if (signals.needsAutomation) {
    return 'browser';
  }

  // Research might need both (scraping + analysis)
  if (signals.needsResearch) {
    return 'hybrid';
  }

  // Code building is primarily local
  if (taskType === 'build_product') {
    // Unless it also needs deployment
    if (signals.needsDeployment) {
      return 'hybrid';
    }
    return 'local';
  }

  // Content creation is local
  if (taskType === 'build_content') {
    return 'local';
  }

  // Default to hybrid for flexibility
  return 'hybrid';
}

// ============================================================================
// PLUGIN SUGGESTION
// ============================================================================

/**
 * Suggest plugins based on task type and signals.
 */
function suggestPlugins(
  taskType: TaskType,
  signals: TaskSignals
): PluginName[] {
  const plugins: PluginName[] = [];

  // Always include GSD for project management on complex tasks
  if (taskType !== 'general') {
    plugins.push('gsd');
  }

  // Code/product building
  if (signals.needsCode || taskType === 'build_product') {
    plugins.push('claude', 'codex');
    if (signals.needsDeployment) {
      plugins.push('vercel', 'github');
    }
  }

  // Automation
  if (signals.needsAutomation) {
    plugins.push('playwright', 'scraper');
  }

  // Research
  if (signals.needsResearch) {
    plugins.push('scraper', 'claude');
  }

  // Content
  if (signals.needsContent) {
    plugins.push('claude');
  }

  // Images
  if (signals.needsImages) {
    plugins.push('dall-e');
  }

  // Deduplicate
  return [...new Set(plugins)];
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate confidence score based on signal strength.
 */
function calculateConfidence(signals: TaskSignals): number {
  const signalCount = Object.values(signals).filter(Boolean).length;

  // No signals = low confidence
  if (signalCount === 0) {
    return 0.3;
  }

  // Single strong signal = good confidence
  if (signalCount === 1) {
    return 0.7;
  }

  // Multiple signals might indicate complexity
  // but also clear intent
  if (signalCount === 2) {
    return 0.8;
  }

  // Many signals = might be unclear request
  return 0.6;
}

// ============================================================================
// MAIN CLASSIFIER
// ============================================================================

/**
 * Classify a user message into task type, execution path, and plugins.
 *
 * @param message - User's initial request
 * @returns Full classification result
 */
export function classifyTask(message: string): TaskClassification {
  // Detect all signals
  const signals = detectSignals(message);

  // Determine task type
  const taskType = determineTaskType(signals);

  // Determine execution path
  const suggestedPath = determineExecutionPath(taskType, signals);

  // Suggest plugins
  const suggestedPlugins = suggestPlugins(taskType, signals);

  // Calculate confidence
  const confidence = calculateConfidence(signals);

  return {
    taskType,
    signals,
    confidence,
    suggestedPlugins,
    suggestedPath,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get a human-readable description of task type.
 */
export function describeTaskType(taskType: TaskType): string {
  const descriptions: Record<TaskType, string> = {
    build_product: 'Building a website, app, or digital product',
    build_content: 'Creating written content or documentation',
    research: 'Researching and analyzing information',
    automate: 'Automating tasks or processes',
    general: 'General assistance',
  };
  return descriptions[taskType];
}

/**
 * Get a human-readable description of execution path.
 */
export function describeExecutionPath(path: ExecutionPath): string {
  const descriptions: Record<ExecutionPath, string> = {
    browser: 'Browser-based (web scraping, automation)',
    local: 'Local tools (code generation, file operations)',
    hybrid: 'Combination of browser and local tools',
  };
  return descriptions[path];
}
