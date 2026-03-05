/**
 * Interrupt Classifier - Keyword-Based Classification (NOT LLM)
 *
 * Job 3 (Part 1): First-pass classification of user interruptions.
 *
 * When a user types a correction mid-execution, this module determines
 * which running agent(s) should receive the correction.
 *
 * CRITICAL: This is CODE-BASED classification using keywords.
 * We do NOT call an LLM for this - it must be fast and deterministic.
 *
 * The classification flow:
 * 1. User types correction (e.g., "make the logo blue instead")
 * 2. This module scans for keywords → "logo" matches IMAGE_GEN, "blue" matches DESIGN
 * 3. Check which agents are currently running
 * 4. If keywords match a running agent → high confidence
 * 5. If no match → needsLLM: true, route to conductor for resolution
 */

// =============================================================================
// INTERRUPT KEYWORDS BY CATEGORY
// =============================================================================

/**
 * Keywords mapped to agent categories.
 *
 * Each category corresponds to a type of agent that might be running.
 * Keywords are lowercase for case-insensitive matching.
 */
export const INTERRUPT_KEYWORDS: Record<string, string[]> = {
  /**
   * IMAGE_GEN - Image generation agents (DALL-E, etc.)
   */
  IMAGE_GEN: [
    'image', 'images', 'logo', 'photo', 'picture', 'pictures',
    'generate', 'dall-e', 'dalle', 'visual', 'visuals',
    'icon', 'icons', 'illustration', 'artwork', 'graphic',
    'banner', 'thumbnail', 'avatar', 'portrait', 'landscape',
    'png', 'jpg', 'jpeg', 'svg', 'webp',
  ],

  /**
   * DESIGN - Design/styling related
   */
  DESIGN: [
    'color', 'colour', 'colors', 'colours', 'style', 'styles',
    'font', 'fonts', 'typography', 'layout', 'layouts',
    'look', 'feel', 'design', 'theme', 'themes',
    'spacing', 'padding', 'margin', 'border', 'rounded',
    'shadow', 'gradient', 'dark', 'light', 'mode',
    'aesthetic', 'modern', 'minimal', 'clean', 'bold',
    'css', 'tailwind', 'styled', 'styling',
  ],

  /**
   * CONTENT - Text/copy related
   */
  CONTENT: [
    'text', 'copy', 'words', 'wording', 'heading', 'headings',
    'title', 'titles', 'description', 'descriptions', 'about',
    'paragraph', 'paragraphs', 'sentence', 'sentences',
    'label', 'labels', 'placeholder', 'message', 'messages',
    'error', 'success', 'warning', 'info', 'notification',
    'content', 'copywriting', 'tone', 'voice',
  ],

  /**
   * CODE - Code/development related
   */
  CODE: [
    'code', 'function', 'functions', 'component', 'components',
    'page', 'pages', 'route', 'routes', 'routing',
    'button', 'buttons', 'form', 'forms', 'input', 'inputs',
    'api', 'endpoint', 'endpoints', 'handler', 'handlers',
    'hook', 'hooks', 'state', 'props', 'context',
    'import', 'export', 'module', 'class', 'interface',
    'typescript', 'javascript', 'react', 'vue', 'angular',
    'bug', 'fix', 'error', 'broken', 'crash', 'failing',
  ],

  /**
   * DEPLOY - Deployment/publishing related
   */
  DEPLOY: [
    'deploy', 'deployment', 'publish', 'publishing',
    'live', 'launch', 'production', 'prod', 'staging',
    'domain', 'url', 'dns', 'ssl', 'https',
    'vercel', 'netlify', 'heroku', 'aws', 'gcp', 'azure',
    'build', 'release', 'version', 'rollback',
  ],

  /**
   * DATABASE - Database/data related
   */
  DATABASE: [
    'database', 'db', 'data', 'table', 'tables',
    'user', 'users', 'account', 'accounts', 'login', 'auth',
    'authentication', 'authorization', 'permission', 'permissions',
    'query', 'queries', 'schema', 'migration', 'seed',
    'supabase', 'postgres', 'mysql', 'mongodb', 'redis',
    'row', 'column', 'field', 'record', 'entry',
  ],

  /**
   * PAYMENT - Payment/e-commerce related
   */
  PAYMENT: [
    'payment', 'payments', 'stripe', 'paypal', 'checkout',
    'price', 'prices', 'pricing', 'cost', 'costs',
    'buy', 'purchase', 'cart', 'order', 'orders',
    'subscription', 'subscriptions', 'billing', 'invoice',
    'refund', 'discount', 'coupon', 'promo',
  ],

  /**
   * RESEARCH - Research/information gathering
   */
  RESEARCH: [
    'research', 'find', 'search', 'look up', 'lookup',
    'information', 'info', 'details', 'learn', 'understand',
    'compare', 'comparison', 'analyze', 'analysis',
    'documentation', 'docs', 'reference', 'example', 'examples',
  ],

  /**
   * FILE_SYSTEM - File operations
   */
  FILE_SYSTEM: [
    'file', 'files', 'folder', 'folders', 'directory',
    'rename', 'move', 'copy', 'delete', 'create',
    'path', 'paths', 'location', 'save', 'download',
    'upload', 'read', 'write', 'open', 'close',
  ],

  /**
   * GIT - Version control
   */
  GIT: [
    'git', 'commit', 'push', 'pull', 'merge',
    'branch', 'branches', 'checkout', 'rebase', 'stash',
    'diff', 'log', 'history', 'revert', 'reset',
    'github', 'gitlab', 'bitbucket', 'repository', 'repo',
  ],
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Classification result from keyword analysis.
 */
export interface InterruptClassification {
  /** Best guess for target agent, if keywords matched */
  bestGuessTarget: string | null;
  /** All keywords found in the user's text */
  keywords: string[];
  /** Confidence level based on keyword matches */
  confidence: 'high' | 'medium' | 'low';
  /** The original correction text from the user */
  correctionText: string;
  /** If true, keywords didn't match - needs LLM to resolve */
  needsLLM: boolean;
  /** Categories that matched */
  matchedCategories: string[];
}

/**
 * Information about a currently running agent.
 */
export interface RunningAgent {
  /** Unique handle for this agent instance */
  handle: string;
  /** Associated step ID from execution plan */
  stepId: number;
  /** Category of work (matches INTERRUPT_KEYWORDS keys) */
  category: string;
  /** Current status */
  status: 'running' | 'paused';
}

// =============================================================================
// CLASSIFICATION LOGIC
// =============================================================================

/**
 * Extract all matching keywords from user text.
 *
 * @param text - User's correction text
 * @returns Object mapping categories to matched keywords
 */
function extractKeywords(text: string): Record<string, string[]> {
  const lowerText = text.toLowerCase();
  const matches: Record<string, string[]> = {};

  for (const [category, keywords] of Object.entries(INTERRUPT_KEYWORDS)) {
    const found: string[] = [];

    for (const keyword of keywords) {
      // Use word boundary matching for more precise results
      // This prevents "login" from matching in "logging"
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
      if (regex.test(lowerText)) {
        found.push(keyword);
      }
    }

    if (found.length > 0) {
      matches[category] = found;
    }
  }

  return matches;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate confidence based on keyword matches and running agents.
 *
 * @param categoryMatches - Categories with matched keywords
 * @param runningAgents - Currently running agents
 * @returns Confidence level
 */
function calculateConfidence(
  categoryMatches: Record<string, string[]>,
  runningAgents: RunningAgent[]
): 'high' | 'medium' | 'low' {
  const matchedCategories = Object.keys(categoryMatches);
  const runningCategories = new Set(runningAgents.map(a => a.category));

  // High confidence: Single category match AND that category is running
  if (matchedCategories.length === 1 && runningCategories.has(matchedCategories[0])) {
    return 'high';
  }

  // High confidence: Multiple keywords in same category AND category is running
  const strongMatch = matchedCategories.find(cat =>
    categoryMatches[cat].length >= 2 && runningCategories.has(cat)
  );
  if (strongMatch) {
    return 'high';
  }

  // Medium confidence: Category match but agent not running, OR multiple categories
  if (matchedCategories.length > 0) {
    const anyRunning = matchedCategories.some(cat => runningCategories.has(cat));
    return anyRunning ? 'medium' : 'low';
  }

  // Low confidence: No keyword matches
  return 'low';
}

/**
 * Find the best target agent based on keyword matches.
 *
 * @param categoryMatches - Categories with matched keywords
 * @param runningAgents - Currently running agents
 * @returns Best target agent handle, or null if no good match
 */
function findBestTarget(
  categoryMatches: Record<string, string[]>,
  runningAgents: RunningAgent[]
): string | null {
  const matchedCategories = Object.keys(categoryMatches);

  if (matchedCategories.length === 0) {
    return null;
  }

  // Priority 1: Running agent with matching category
  for (const category of matchedCategories) {
    const runningMatch = runningAgents.find(
      agent => agent.category === category && agent.status === 'running'
    );
    if (runningMatch) {
      return runningMatch.handle;
    }
  }

  // Priority 2: Paused agent with matching category
  for (const category of matchedCategories) {
    const pausedMatch = runningAgents.find(
      agent => agent.category === category && agent.status === 'paused'
    );
    if (pausedMatch) {
      return pausedMatch.handle;
    }
  }

  // Priority 3: If only one category matched, return that category as target
  // (The dispatcher can figure out what to do with it)
  if (matchedCategories.length === 1) {
    return `category:${matchedCategories[0]}`;
  }

  return null;
}

/**
 * Classify a user interrupt/correction.
 *
 * This is the main entry point for interrupt classification.
 * Uses keyword matching (NOT LLM) for fast, deterministic results.
 *
 * @param userText - The user's correction/interrupt text
 * @param runningAgents - List of currently running agents
 * @returns Classification result
 */
export function classifyInterrupt(
  userText: string,
  runningAgents: RunningAgent[]
): InterruptClassification {
  // Extract keywords from user text
  const categoryMatches = extractKeywords(userText);
  const allKeywords = Object.values(categoryMatches).flat();
  const matchedCategories = Object.keys(categoryMatches);

  // Calculate confidence
  const confidence = calculateConfidence(categoryMatches, runningAgents);

  // Find best target
  const bestGuessTarget = findBestTarget(categoryMatches, runningAgents);

  // Determine if we need LLM fallback
  // Need LLM if:
  // - No keywords matched (low confidence)
  // - Multiple categories matched with no clear winner
  // - Keywords matched but no running agent in that category
  const needsLLM =
    confidence === 'low' ||
    (matchedCategories.length > 1 && bestGuessTarget === null) ||
    (matchedCategories.length > 0 && bestGuessTarget !== null && bestGuessTarget.startsWith('category:'));

  return {
    bestGuessTarget,
    keywords: allKeywords,
    confidence,
    correctionText: userText,
    needsLLM,
    matchedCategories,
  };
}

/**
 * Check if text contains urgent/stop keywords.
 *
 * These keywords indicate the user wants to halt execution immediately.
 *
 * @param text - User's text
 * @returns true if urgent stop is requested
 */
export function isUrgentStop(text: string): boolean {
  const lowerText = text.toLowerCase();
  const stopKeywords = [
    'stop', 'halt', 'abort', 'cancel', 'quit',
    'pause', 'wait', 'hold', 'freeze',
    'no no no', "don't", 'dont', 'stop it',
    'wrong', 'mistake', 'undo', 'revert',
  ];

  return stopKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Check if text is likely a continuation rather than a correction.
 *
 * @param text - User's text
 * @returns true if this seems like a continuation, not an interrupt
 */
export function isContinuation(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  const continuationPhrases = [
    'and also', 'also add', 'one more thing',
    'additionally', 'furthermore', 'plus',
    'while you', "while you're", 'when done',
    'after that', 'then also', 'can you also',
  ];

  return continuationPhrases.some(phrase => lowerText.includes(phrase));
}

/**
 * Get all running agents in a specific category.
 *
 * @param category - Category to filter by
 * @param runningAgents - All running agents
 * @returns Agents in the specified category
 */
export function getAgentsInCategory(
  category: string,
  runningAgents: RunningAgent[]
): RunningAgent[] {
  return runningAgents.filter(agent => agent.category === category);
}
