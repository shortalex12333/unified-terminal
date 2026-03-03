/**
 * Fast-Path Bypass for Trivial Messages
 *
 * Tier 0: Local heuristic routing with no network or AI calls.
 * Pattern matches to catch trivial messages and route them directly
 * to ChatGPT without touching the Codex conductor.
 *
 * Performance: ~0.01ms per check (pure regex/string operations)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Action verbs that indicate a task requiring CLI tools.
 * If present in a short question, it's not trivial.
 */
const ACTION_VERBS = [
  'build', 'create', 'make', 'generate', 'write', 'code', 'develop',
  'deploy', 'launch', 'setup', 'install', 'automate', 'scrape',
  'design', 'scaffold', 'implement', 'fix', 'debug', 'refactor',
  'configure', 'migrate', 'convert', 'compile', 'test', 'run',
  'execute', 'start', 'init', 'bootstrap', 'clone', 'push', 'pull',
  'commit', 'merge', 'rebase', 'checkout', 'branch', 'delete', 'remove',
] as const;

/**
 * CLI tool keywords that suggest local execution is needed.
 */
const CLI_KEYWORDS = [
  'codex', 'claude', 'gsd', 'npm', 'yarn', 'pnpm', 'git', 'docker',
  'terminal', 'shell', 'bash', 'command', 'script', 'file', 'folder',
  'directory', 'project', 'repo', 'repository', 'codebase',
] as const;

/**
 * Greeting patterns that are definitely trivial.
 */
const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|sup|hiya|howdy|greetings)\b/i,
  /^good\s+(morning|afternoon|evening|day)\b/i,
] as const;

/**
 * Confirmation/acknowledgment patterns.
 */
const CONFIRMATION_PATTERNS = [
  /^(thanks|thank\s+you|thx|ty|cheers)\b/i,
  /^(ok|okay|k|sure|yes|yeah|yep|yup|no|nope|nah)\b/i,
  /^(got\s+it|understood|copy\s+that|roger)\b/i,
  /^(cool|nice|great|awesome|perfect|excellent|good)\b/i,
] as const;

/**
 * Continuation patterns - user asking to continue previous conversation.
 */
const CONTINUATION_PATTERNS = [
  /^(continue|go\s+on|keep\s+going|proceed)\b/i,
  /^(what\s+about|and\s+also|one\s+more|another)\b/i,
  /^(tell\s+me\s+more|explain\s+(more|further)|elaborate)\b/i,
  /^(can\s+you\s+expand|more\s+details?|more\s+info)\b/i,
] as const;

/**
 * Image generation keywords.
 */
const IMAGE_KEYWORDS = [
  'image', 'picture', 'photo', 'draw', 'sketch', 'illustration',
  'render', 'visualize', 'design', 'logo', 'icon', 'banner',
  'dall-e', 'dalle', 'midjourney', 'stable diffusion',
] as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of fast-path classification.
 */
export type FastPathResult =
  | 'bypass_to_chatgpt'  // Trivial: route directly to ChatGPT web
  | 'send_to_tier1';      // Non-trivial: send to Codex conductor for classification

/**
 * Extended result with reasoning (for debugging/logging).
 */
export interface FastPathResultWithReason {
  result: FastPathResult;
  reason: string;
  matchedPattern?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if message contains any of the action verbs.
 */
function containsActionVerb(message: string): boolean {
  const lower = message.toLowerCase();
  return ACTION_VERBS.some(verb => {
    // Match whole word only
    const regex = new RegExp(`\\b${verb}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Check if message contains CLI-related keywords.
 */
function containsCLIKeyword(message: string): boolean {
  const lower = message.toLowerCase();
  return CLI_KEYWORDS.some(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lower);
  });
}

/**
 * Check if message matches any pattern in a list.
 */
function matchesAnyPattern(message: string, patterns: readonly RegExp[]): RegExp | null {
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Check if message looks like an image generation request.
 */
function isImageRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return IMAGE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Count words in a message.
 */
function wordCount(message: string): number {
  return message.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// MAIN FAST-PATH CHECK
// ============================================================================

/**
 * Quick classification to determine if a message can bypass the conductor.
 *
 * This is Tier 0 routing - pure heuristics, no AI, no network.
 * The goal is to quickly filter out trivial messages that don't need
 * expensive Codex classification.
 *
 * @param message - The user's input message
 * @returns 'bypass_to_chatgpt' for trivial messages, 'send_to_tier1' otherwise
 */
export function fastPathCheck(message: string): FastPathResult {
  return fastPathCheckWithReason(message).result;
}

/**
 * Fast-path check with detailed reasoning.
 * Useful for debugging and logging.
 *
 * @param message - The user's input message
 * @returns Result with reasoning
 */
export function fastPathCheckWithReason(message: string): FastPathResultWithReason {
  const m = message.trim();

  // Empty or very short messages
  if (m.length === 0) {
    return {
      result: 'bypass_to_chatgpt',
      reason: 'empty_message',
    };
  }

  // Single character or emoji
  if (m.length <= 2) {
    return {
      result: 'bypass_to_chatgpt',
      reason: 'single_char_or_emoji',
    };
  }

  // Check greeting patterns
  const greetingMatch = matchesAnyPattern(m, GREETING_PATTERNS);
  if (greetingMatch) {
    return {
      result: 'bypass_to_chatgpt',
      reason: 'greeting',
      matchedPattern: greetingMatch.source,
    };
  }

  // Check confirmation/acknowledgment patterns
  const confirmMatch = matchesAnyPattern(m, CONFIRMATION_PATTERNS);
  if (confirmMatch) {
    return {
      result: 'bypass_to_chatgpt',
      reason: 'confirmation',
      matchedPattern: confirmMatch.source,
    };
  }

  // Check continuation patterns
  const continuationMatch = matchesAnyPattern(m, CONTINUATION_PATTERNS);
  if (continuationMatch) {
    return {
      result: 'bypass_to_chatgpt',
      reason: 'continuation',
      matchedPattern: continuationMatch.source,
    };
  }

  // Short questions without action verbs (< 120 chars, ends with ?, no action verbs)
  if (m.length < 120 && m.endsWith('?')) {
    if (!containsActionVerb(m) && !containsCLIKeyword(m)) {
      return {
        result: 'bypass_to_chatgpt',
        reason: 'short_question_no_action',
      };
    }
  }

  // Very short statements (< 50 chars, < 10 words, no action verbs)
  if (m.length < 50 && wordCount(m) < 10) {
    if (!containsActionVerb(m) && !containsCLIKeyword(m)) {
      return {
        result: 'bypass_to_chatgpt',
        reason: 'short_statement',
      };
    }
  }

  // Image generation requests - these go to ChatGPT (DALL-E)
  if (isImageRequest(m) && !containsCLIKeyword(m)) {
    // Only bypass if it's clearly an image request, not "create an image processing script"
    const hasCodeContext = /script|code|program|function|api|service/i.test(m);
    if (!hasCodeContext) {
      return {
        result: 'bypass_to_chatgpt',
        reason: 'image_generation_request',
      };
    }
  }

  // Default: needs classification by Tier 1
  return {
    result: 'send_to_tier1',
    reason: 'requires_classification',
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process multiple messages and return results.
 * Useful for testing or bulk classification.
 *
 * @param messages - Array of messages to classify
 * @returns Array of results with original messages
 */
export function fastPathCheckBatch(
  messages: string[]
): Array<{ message: string; result: FastPathResultWithReason }> {
  return messages.map(message => ({
    message,
    result: fastPathCheckWithReason(message),
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ACTION_VERBS,
  CLI_KEYWORDS,
  containsActionVerb,
  containsCLIKeyword,
  isImageRequest,
};
