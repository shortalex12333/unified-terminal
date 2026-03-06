/**
 * Local Classifier - No API needed
 *
 * Simple keyword-based classification for MVP.
 * Routes user messages to appropriate execution path without external calls.
 */

export type ProjectType = 'site' | 'app' | 'ecom' | 'existing' | 'chat' | 'quick';
export type RouteType = 'cli' | 'web' | 'hybrid';

export interface LocalClassification {
  projectType: ProjectType;
  route: RouteType;
  confidence: number;
  extractedGoal: string;
  suggestedName: string;
  skills: string[];
}

// Keywords for each project type
const KEYWORDS: Record<ProjectType, string[]> = {
  site: [
    'website', 'landing page', 'portfolio', 'blog', 'static', 'html',
    'homepage', 'personal site', 'company site', 'brochure'
  ],
  app: [
    'app', 'application', 'dashboard', 'admin', 'login', 'auth',
    'database', 'backend', 'api', 'crud', 'user management', 'saas'
  ],
  ecom: [
    'ecommerce', 'e-commerce', 'shop', 'store', 'cart', 'checkout',
    'payment', 'stripe', 'product', 'inventory', 'sell', 'buy'
  ],
  existing: [
    'fix', 'bug', 'error', 'refactor', 'optimize', 'update', 'modify',
    'existing', 'current', 'improve', 'change', 'add to'
  ],
  chat: [
    'what is', 'how do', 'explain', 'help me understand', 'question',
    'tell me', 'why', 'can you'
  ],
  quick: [
    'simple', 'quick', 'small', 'just', 'only', 'single file',
    'one thing', 'tiny'
  ],
};

// Skills for each project type
const SKILLS: Record<ProjectType, string[]> = {
  site: ['scaffold', 'frontend-design'],
  app: ['scaffold', 'auth-setup', 'db-setup', 'api-design'],
  ecom: ['scaffold', 'payment-flow', 'product-catalog'],
  existing: ['codebase-analysis', 'refactor'],
  chat: [],
  quick: ['quick-edit'],
};

/**
 * Extract a project name from the input
 */
function extractProjectName(input: string): string {
  const lower = input.toLowerCase();

  // Try to find "for [something]" or "called [something]"
  const forMatch = lower.match(/(?:for|called|named)\s+([a-z0-9\s]+?)(?:\.|,|$)/);
  if (forMatch) {
    return forMatch[1].trim().replace(/\s+/g, '-').substring(0, 30);
  }

  // Try to extract key nouns
  const words = lower
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['build', 'create', 'make', 'want', 'need', 'with', 'that', 'have', 'from'].includes(w));

  if (words.length > 0) {
    return words.slice(0, 3).join('-');
  }

  return 'my-project';
}

/**
 * Extract a short goal description
 */
function extractGoal(input: string): string {
  const sentences = input.split(/[.!?]/);
  const first = sentences[0]?.trim() || input;
  return first.length > 50 ? first.substring(0, 47) + '...' : first;
}

/**
 * Classify a user message locally without API calls
 */
export function classifyLocally(input: string): LocalClassification {
  const lower = input.toLowerCase();

  // Score each project type
  const scores: Record<ProjectType, number> = {
    site: 0,
    app: 0,
    ecom: 0,
    existing: 0,
    chat: 0,
    quick: 0,
  };

  for (const [type, keywords] of Object.entries(KEYWORDS) as [ProjectType, string[]][]) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        scores[type] += 1;
      }
    }
  }

  // Find highest scoring type
  let maxScore = 0;
  let projectType: ProjectType = 'app'; // default

  for (const [type, score] of Object.entries(scores) as [ProjectType, number][]) {
    if (score > maxScore) {
      maxScore = score;
      projectType = type;
    }
  }

  // Calculate confidence (rough estimate)
  const totalMatches = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalMatches > 0 ? Math.min(0.9, maxScore / Math.max(totalMatches, 3)) : 0.5;

  // Determine route
  let route: RouteType;
  if (projectType === 'chat') {
    route = 'web'; // Could use web LLM for chat
  } else if (projectType === 'quick') {
    route = 'cli';
  } else {
    route = 'cli'; // Most builds go to CLI
  }

  return {
    projectType,
    route,
    confidence,
    extractedGoal: extractGoal(input),
    suggestedName: extractProjectName(input),
    skills: SKILLS[projectType] || [],
  };
}
