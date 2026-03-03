/**
 * Unified Terminal - Task Router (Gate 8)
 *
 * Decides execution path (browser/local/hybrid) based on project brief.
 * Routes tasks to appropriate tools and plugins based on detected signals.
 */

import {
  ProjectBrief,
  ExecutionPath,
  PluginName,
  TaskSignals,
  TaskClassification,
} from '../intake/types';
import { classifyTask, detectSignals } from '../intake/task-classifier';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Detailed routing decision with reasoning.
 */
export interface RoutingDecision {
  /** Primary execution path: browser, local, or hybrid */
  path: ExecutionPath;

  /** Primary tool recommended for this task */
  primaryTool: string;

  /** List of suggested plugins for execution */
  suggestedPlugins: string[];

  /** Whether task requires CLI tools */
  requiresCLI: boolean;

  /** Whether task requires web search or browsing */
  requiresWebSearch: boolean;

  /** Whether task requires image generation */
  requiresImageGen: boolean;

  /** Confidence in routing decision (0-1) */
  confidence: number;

  /** Human-readable explanation of routing decision */
  reasoning: string;
}

// ============================================================================
// ROUTING SIGNAL PATTERNS
// ============================================================================

/**
 * Signals that indicate LOCAL execution path (needs CLI tools).
 */
const LOCAL_SIGNALS = {
  // Code/development signals
  needsCode: /\b(build|create|develop|scaffold|implement|code|program)\b.*\b(website|site|web\s*site|app|application|landing\s*page|store|api|backend|frontend|database|server|microservice)\b/i,

  // Script creation (Python, bash, etc.)
  needsScript: /\b(create|write|build|make)\b.*\b(script|program|tool|utility|automation)\b.*\b(python|bash|node|javascript|ruby|perl)\b|\b(python|bash|node)\b.*\b(script|program)\b/i,

  // File operations (but not "write blog post" type content)
  needsFiles: /\b(generate|export|download|save)\b.*\b(file|document|pdf|csv|json|xml|report|spreadsheet)\b/i,

  // Direct product mentions
  needsProduct: /\b(website|landing\s*page|web\s*app|mobile\s*app|saas|platform|dashboard|portal|ecommerce|e-commerce|store|shop|blog\s*site)\b/i,

  // Tech stack mentions
  needsTech: /\b(react|vue|angular|next\.?js|nuxt|svelte|node\.?js|express|python|django|flask|fastapi|typescript|javascript|go|rust|rails|laravel|php)\b/i,

  // CLI/terminal operations
  needsCLI: /\b(npm|yarn|pip|git|docker|kubernetes|k8s|terraform|aws\s*cli|gcloud|azure\s*cli|brew|homebrew)\b/i,

  // Database operations
  needsDatabase: /\b(database|postgres|postgresql|mysql|mongodb|redis|sqlite|supabase|firebase|prisma|sequelize|typeorm)\b/i,
};

/**
 * Signals that indicate BROWSER execution path (ChatGPT is sufficient).
 */
const BROWSER_SIGNALS = {
  // Research and analysis (standalone - not combined with build words)
  needsResearch: /^(?!.*(build|create|develop|implement)).*\b(research|analyze|find|compare|investigate|study|explore|look\s*up|search\s*for)\b.*\b(market|competitor|industry|trend|option|alternative|solution|tool|service|best|top)\b/i,

  // Content creation (no code) - exclude "create...script" if it's a code script
  needsContent: /\b(write|draft|compose|edit)\b.*\b(blog|post|article|copy|email|newsletter|outline|summary|pitch|proposal|letter|message)\b/i,

  // Image generation
  needsImages: /\b(design|create|generate|make)\b.*\b(image|logo|brand|visual|graphic|icon|illustration|mockup|artwork|banner|poster)\b/i,

  // General conversation/advice
  needsConversation: /\b(help|advice|suggest|recommend|explain|what\s*(should|would|could)|how\s*(do|should|would|could)|tell\s*me|give\s*me)\b/i,

  // Summarization
  needsSummarize: /\b(summarize|summarise|synopsis|overview|breakdown|tl;?dr|key\s*points|main\s*ideas)\b/i,

  // Brainstorming
  needsBrainstorm: /\b(brainstorm|ideas?\s*for|come\s*up\s*with|think\s*of|creative|alternatives|options|possibilities)\b/i,
};

/**
 * Signals that indicate HYBRID execution path (needs both).
 */
const HYBRID_SIGNALS = {
  // Website with content
  needsCodeAndContent: /\b(website|landing\s*page|app)\b.*\b(content|copy|text|writing)\b|\b(content|copy)\b.*\b(website|landing\s*page|app)\b/i,

  // Research then build
  needsResearchAndBuild: /\b(research|analyze|find)\b.*\b(build|create|develop|implement)\b|\b(build|create)\b.*\b(based\s*on|using)\b.*\b(research|analysis)\b/i,

  // Design then implement
  needsDesignAndCode: /\b(design|mockup|prototype)\b.*\b(build|develop|implement|code)\b/i,

  // Scraping with processing
  needsScrapeAndProcess: /\b(scrape|extract|crawl|pull)\b.*\b(data|info)\b.*\b(analyze|process|transform|store)\b/i,

  // Multi-step workflows
  needsMultiStep: /\b(then|after\s*that|next|finally|first|second|third)\b.*\b(and\s*then|build|create|deploy|analyze)\b/i,
};

/**
 * Signals for automation/browser automation tasks.
 */
const AUTOMATION_SIGNALS = {
  // Scraping
  needsScrape: /\b(scrape|scraping|crawler|crawl|extract\s*data|pull\s*data|web\s*scrape)\b/i,

  // Form automation
  needsFormFill: /\b(fill|submit|automate)\b.*\b(form|forms|application|signup|registration)\b/i,

  // Booking/scheduling
  needsBooking: /\b(book|schedule|reserve|appointment)\b.*\b(slot|time|meeting|reservation)\b/i,

  // Monitoring
  needsMonitor: /\b(monitor|track|watch|alert)\b.*\b(price|stock|availability|change|update)\b/i,

  // Bulk operations
  needsBulk: /\b(bulk|batch|mass|multiple)\b.*\b(download|upload|process|submit|send)\b/i,
};

// ============================================================================
// PLUGIN MAPPING
// ============================================================================

/**
 * Plugin recommendations for each execution path.
 */
const PLUGIN_MAP: Record<ExecutionPath, Record<string, string[]>> = {
  local: {
    code: ['gsd', 'claude-code', 'codex'],
    automation: ['playwright', 'browser-use'],
    files: ['fs', 'archiver'],
    database: ['prisma', 'supabase-cli'],
    deployment: ['vercel', 'github'],
  },
  browser: {
    research: ['web-search', 'chatgpt'],
    content: ['chatgpt', 'claude'],
    images: ['dall-e', 'midjourney'],
    conversation: ['chatgpt'],
  },
  hybrid: {
    fullProject: ['gsd', 'claude-code', 'codex', 'chatgpt', 'dall-e'],
    researchAndBuild: ['web-search', 'gsd', 'claude-code'],
    scrapeAndProcess: ['playwright', 'scraper', 'gsd'],
  },
};

// ============================================================================
// SIGNAL COUNTING HELPERS
// ============================================================================

/**
 * Count how many patterns from a signal set match the message.
 */
function countSignalMatches(
  message: string,
  signals: Record<string, RegExp>
): number {
  return Object.values(signals).filter((pattern) => pattern.test(message)).length;
}

/**
 * Get all matched signal keys from a signal set.
 */
function getMatchedSignals(
  message: string,
  signals: Record<string, RegExp>
): string[] {
  return Object.entries(signals)
    .filter(([_, pattern]) => pattern.test(message))
    .map(([key, _]) => key);
}

// ============================================================================
// ROUTING LOGIC
// ============================================================================

/**
 * Determine execution path from signal analysis.
 */
function determinePathFromSignals(
  message: string
): { path: ExecutionPath; confidence: number; matchedSignals: string[] } {
  const localMatches = countSignalMatches(message, LOCAL_SIGNALS);
  const browserMatches = countSignalMatches(message, BROWSER_SIGNALS);
  const hybridMatches = countSignalMatches(message, HYBRID_SIGNALS);
  const automationMatches = countSignalMatches(message, AUTOMATION_SIGNALS);

  // Collect all matched signals for reasoning
  const allMatched = [
    ...getMatchedSignals(message, LOCAL_SIGNALS).map((s) => `local:${s}`),
    ...getMatchedSignals(message, BROWSER_SIGNALS).map((s) => `browser:${s}`),
    ...getMatchedSignals(message, HYBRID_SIGNALS).map((s) => `hybrid:${s}`),
    ...getMatchedSignals(message, AUTOMATION_SIGNALS).map((s) => `automation:${s}`),
  ];

  // Automation tasks typically need local CLI (playwright) but browser interaction
  if (automationMatches > 0) {
    // Pure scraping/automation → local (playwright runs locally)
    if (localMatches === 0 && browserMatches === 0) {
      return { path: 'local', confidence: 0.8, matchedSignals: allMatched };
    }
    // Automation with analysis → hybrid
    return { path: 'hybrid', confidence: 0.75, matchedSignals: allMatched };
  }

  // Strong hybrid signals override other signals
  if (hybridMatches > 0) {
    return { path: 'hybrid', confidence: 0.85, matchedSignals: allMatched };
  }

  // Clear local signals without browser signals
  if (localMatches > 0 && browserMatches === 0) {
    const confidence = Math.min(0.5 + localMatches * 0.15, 0.95);
    return { path: 'local', confidence, matchedSignals: allMatched };
  }

  // Clear browser signals without local signals
  if (browserMatches > 0 && localMatches === 0) {
    const confidence = Math.min(0.5 + browserMatches * 0.15, 0.95);
    return { path: 'browser', confidence, matchedSignals: allMatched };
  }

  // Both local and browser signals present
  if (localMatches > 0 && browserMatches > 0) {
    // If local signals significantly outweigh browser → local
    // This handles cases like "Create a Python script to process files"
    // where "script" matches a content pattern but it's clearly a code task
    if (localMatches >= browserMatches * 2) {
      const confidence = Math.min(0.6 + localMatches * 0.1, 0.9);
      return { path: 'local', confidence, matchedSignals: allMatched };
    }
    // If browser signals significantly outweigh local → browser
    if (browserMatches >= localMatches * 2) {
      const confidence = Math.min(0.6 + browserMatches * 0.1, 0.9);
      return { path: 'browser', confidence, matchedSignals: allMatched };
    }
    // Otherwise → hybrid
    const totalMatches = localMatches + browserMatches;
    const confidence = Math.min(0.6 + totalMatches * 0.1, 0.9);
    return { path: 'hybrid', confidence, matchedSignals: allMatched };
  }

  // No clear signals → default to hybrid (safer) with low confidence
  return { path: 'hybrid', confidence: 0.4, matchedSignals: [] };
}

/**
 * Determine primary tool based on execution path and signals.
 */
function determinePrimaryTool(path: ExecutionPath, message: string): string {
  const lowerMessage = message.toLowerCase();

  if (path === 'local') {
    // Code-heavy tasks → claude-code or codex
    if (/\b(build|create|develop|scaffold)\b/.test(lowerMessage)) {
      return 'claude-code';
    }
    // Automation tasks → playwright
    if (/\b(scrape|automate|fill|book)\b/.test(lowerMessage)) {
      return 'playwright';
    }
    // Project management → gsd
    return 'gsd';
  }

  if (path === 'browser') {
    // Image generation → dall-e
    if (/\b(image|logo|visual|graphic|illustration)\b/.test(lowerMessage)) {
      return 'dall-e';
    }
    // Everything else → chatgpt
    return 'chatgpt';
  }

  // Hybrid → gsd for orchestration
  return 'gsd';
}

/**
 * Suggest plugins based on path and detected needs.
 */
function suggestPluginsForPath(path: ExecutionPath, message: string): string[] {
  const plugins: Set<string> = new Set();
  const lowerMessage = message.toLowerCase();

  // Add path-specific plugins
  if (path === 'local' || path === 'hybrid') {
    // Code building
    if (/\b(build|create|develop|website|app|landing)/i.test(message)) {
      PLUGIN_MAP.local.code.forEach((p) => plugins.add(p));
    }
    // Automation
    if (/\b(scrape|automate|fill|book|monitor)/i.test(message)) {
      PLUGIN_MAP.local.automation.forEach((p) => plugins.add(p));
    }
    // File operations
    if (/\b(generate|export|download|save|file|pdf|document)/i.test(message)) {
      PLUGIN_MAP.local.files.forEach((p) => plugins.add(p));
    }
    // Database
    if (/\b(database|postgres|mysql|mongodb|supabase)/i.test(message)) {
      PLUGIN_MAP.local.database.forEach((p) => plugins.add(p));
    }
    // Deployment
    if (/\b(deploy|publish|launch|vercel|netlify)/i.test(message)) {
      PLUGIN_MAP.local.deployment.forEach((p) => plugins.add(p));
    }
  }

  if (path === 'browser' || path === 'hybrid') {
    // Research
    if (/\b(research|analyze|find|compare|search)/i.test(message)) {
      PLUGIN_MAP.browser.research.forEach((p) => plugins.add(p));
    }
    // Content
    if (/\b(write|draft|compose|create|blog|email|copy)/i.test(message)) {
      PLUGIN_MAP.browser.content.forEach((p) => plugins.add(p));
    }
    // Images
    if (/\b(image|logo|design|visual|graphic|illustration)/i.test(message)) {
      PLUGIN_MAP.browser.images.forEach((p) => plugins.add(p));
    }
  }

  // If no specific plugins detected, use defaults for path
  if (plugins.size === 0) {
    if (path === 'local') {
      plugins.add('gsd');
      plugins.add('claude-code');
    } else if (path === 'browser') {
      plugins.add('chatgpt');
    } else {
      PLUGIN_MAP.hybrid.fullProject.forEach((p) => plugins.add(p));
    }
  }

  return Array.from(plugins);
}

/**
 * Generate human-readable reasoning for the routing decision.
 */
function generateReasoning(
  path: ExecutionPath,
  matchedSignals: string[],
  primaryTool: string,
  requiresCLI: boolean,
  requiresWebSearch: boolean,
  requiresImageGen: boolean
): string {
  const parts: string[] = [];

  // Path explanation
  switch (path) {
    case 'local':
      parts.push('Routed to LOCAL execution because task requires code generation or CLI tools.');
      break;
    case 'browser':
      parts.push('Routed to BROWSER execution because task can be handled by ChatGPT without local tools.');
      break;
    case 'hybrid':
      parts.push('Routed to HYBRID execution because task requires both browser and local capabilities.');
      break;
  }

  // Signal details
  if (matchedSignals.length > 0) {
    const signalsSummary = matchedSignals.slice(0, 3).join(', ');
    parts.push(`Detected signals: ${signalsSummary}${matchedSignals.length > 3 ? '...' : ''}.`);
  }

  // Tool explanation
  parts.push(`Primary tool: ${primaryTool}.`);

  // Requirements
  const reqs: string[] = [];
  if (requiresCLI) reqs.push('CLI tools');
  if (requiresWebSearch) reqs.push('web search');
  if (requiresImageGen) reqs.push('image generation');

  if (reqs.length > 0) {
    parts.push(`Requires: ${reqs.join(', ')}.`);
  }

  return parts.join(' ');
}

// ============================================================================
// TASK ROUTER CLASS
// ============================================================================

/**
 * Task Router - decides execution path based on project brief or raw message.
 */
export class TaskRouter {
  /**
   * Route a fully-formed ProjectBrief to an execution path.
   */
  route(brief: ProjectBrief): RoutingDecision {
    // Use the brief's raw request for signal analysis
    const message = brief.rawRequest;

    // Analyze signals
    const { path, confidence, matchedSignals } = determinePathFromSignals(message);

    // Override with brief's executionPath if it differs and brief is complete
    const finalPath = brief.intakeComplete ? brief.executionPath : path;

    // Determine capabilities needed
    const requiresCLI =
      finalPath === 'local' ||
      finalPath === 'hybrid' ||
      /\b(npm|git|docker|cli|terminal|command)/i.test(message);

    const requiresWebSearch =
      finalPath === 'browser' ||
      finalPath === 'hybrid' ||
      /\b(research|search|find|compare|analyze|look\s*up)/i.test(message);

    const requiresImageGen = /\b(image|logo|visual|graphic|illustration|dall-?e|midjourney)/i.test(
      message
    );

    // Determine primary tool
    const primaryTool = determinePrimaryTool(finalPath, message);

    // Suggest plugins
    const suggestedPlugins = brief.intakeComplete
      ? brief.pluginsNeeded.map((p) => p.toString())
      : suggestPluginsForPath(finalPath, message);

    // Generate reasoning
    const reasoning = generateReasoning(
      finalPath,
      matchedSignals,
      primaryTool,
      requiresCLI,
      requiresWebSearch,
      requiresImageGen
    );

    return {
      path: finalPath,
      primaryTool,
      suggestedPlugins,
      requiresCLI,
      requiresWebSearch,
      requiresImageGen,
      confidence: brief.intakeComplete ? 0.95 : confidence,
      reasoning,
    };
  }

  /**
   * Route a raw message string (before full intake).
   */
  routeFromMessage(rawMessage: string): RoutingDecision {
    // Analyze signals directly
    const { path, confidence, matchedSignals } = determinePathFromSignals(rawMessage);

    // Determine capabilities needed
    const requiresCLI =
      path === 'local' ||
      path === 'hybrid' ||
      countSignalMatches(rawMessage, LOCAL_SIGNALS) > 0 ||
      countSignalMatches(rawMessage, AUTOMATION_SIGNALS) > 0;

    const requiresWebSearch =
      path === 'browser' ||
      path === 'hybrid' ||
      /\b(research|search|find|compare|analyze|look\s*up)/i.test(rawMessage);

    const requiresImageGen = /\b(image|logo|visual|graphic|illustration|dall-?e|midjourney)/i.test(
      rawMessage
    );

    // Determine primary tool
    const primaryTool = determinePrimaryTool(path, rawMessage);

    // Suggest plugins
    const suggestedPlugins = suggestPluginsForPath(path, rawMessage);

    // Generate reasoning
    const reasoning = generateReasoning(
      path,
      matchedSignals,
      primaryTool,
      requiresCLI,
      requiresWebSearch,
      requiresImageGen
    );

    return {
      path,
      primaryTool,
      suggestedPlugins,
      requiresCLI,
      requiresWebSearch,
      requiresImageGen,
      confidence,
      reasoning,
    };
  }

  /**
   * Get detailed explanation for a routing decision.
   * Useful for debugging or showing users why a particular path was chosen.
   */
  explain(decision: RoutingDecision): string {
    const lines: string[] = [
      '=== Task Routing Explanation ===',
      '',
      `Execution Path: ${decision.path.toUpperCase()}`,
      `Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
      '',
      `Primary Tool: ${decision.primaryTool}`,
      `Suggested Plugins: ${decision.suggestedPlugins.join(', ') || 'none'}`,
      '',
      'Requirements:',
      `  - CLI Tools: ${decision.requiresCLI ? 'Yes' : 'No'}`,
      `  - Web Search: ${decision.requiresWebSearch ? 'Yes' : 'No'}`,
      `  - Image Generation: ${decision.requiresImageGen ? 'Yes' : 'No'}`,
      '',
      'Reasoning:',
      `  ${decision.reasoning}`,
      '',
      '================================',
    ];

    return lines.join('\n');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let routerInstance: TaskRouter | null = null;

/**
 * Get the singleton TaskRouter instance.
 */
export function getTaskRouter(): TaskRouter {
  if (!routerInstance) {
    routerInstance = new TaskRouter();
  }
  return routerInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick routing from a raw message.
 */
export function routeTask(message: string): RoutingDecision {
  return getTaskRouter().routeFromMessage(message);
}

/**
 * Quick routing from a project brief.
 */
export function routeBrief(brief: ProjectBrief): RoutingDecision {
  return getTaskRouter().route(brief);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  LOCAL_SIGNALS,
  BROWSER_SIGNALS,
  HYBRID_SIGNALS,
  AUTOMATION_SIGNALS,
  PLUGIN_MAP,
};
