/**
 * Status Agent Voice Rules
 *
 * Brand voice enforcement for user-facing status messages.
 * Ensures all output is human-friendly and avoids technical jargon.
 */

// =============================================================================
// BANNED WORDS - Never expose these to users
// =============================================================================

/**
 * Technical terms that should never appear in user-facing status.
 * These get replaced with friendlier alternatives or removed.
 */
export const BANNED_WORDS: readonly string[] = [
  // Execution terms
  'executing', 'spawning', 'instantiating', 'initializing', 'bootstrapping',
  'terminating', 'killing', 'forking', 'threading', 'polling',

  // System components
  'agent', 'process', 'thread', 'runtime', 'daemon', 'worker', 'handler',
  'listener', 'emitter', 'subscriber', 'dispatcher', 'scheduler', 'queue',

  // Technical interfaces
  'CLI', 'API', 'JSON', 'XML', 'YAML', 'HTTP', 'REST', 'GraphQL', 'WebSocket',
  'RPC', 'gRPC', 'SDK', 'IPC', 'stdin', 'stdout', 'stderr', 'REPL',

  // AI/ML terms
  'token', 'tokens', 'model', 'LLM', 'inference', 'embedding', 'vector',
  'context window', 'prompt', 'completion', 'fine-tune', 'training',
  'neural', 'transformer', 'attention', 'parameter', 'weights',

  // Product names to avoid
  'Codex', 'GSD', 'Claude Code', 'Gemini', 'MCP', 'DAG', 'GPT',
  'OpenAI', 'Anthropic', 'Vertex', 'Bedrock', 'Hugging Face',

  // Infrastructure
  'container', 'Docker', 'Kubernetes', 'pod', 'node', 'cluster', 'VM',
  'instance', 'lambda', 'serverless', 'microservice', 'orchestrator',

  // Database/storage
  'database', 'schema', 'migration', 'query', 'transaction', 'commit',
  'rollback', 'index', 'shard', 'replica', 'cache', 'redis', 'postgres',

  // Network
  'request', 'response', 'endpoint', 'route', 'middleware', 'proxy',
  'load balancer', 'firewall', 'SSL', 'TLS', 'certificate', 'DNS',

  // Code terms
  'function', 'method', 'class', 'interface', 'type', 'variable',
  'constant', 'module', 'import', 'export', 'dependency', 'package',
  'callback', 'promise', 'async', 'await', 'mutex', 'semaphore',

  // Error terms (should be humanized)
  'exception', 'stack trace', 'segfault', 'panic', 'fatal', 'null pointer',
  'undefined', 'NaN', 'heap', 'memory leak', 'buffer overflow',

  // Misc technical
  'regex', 'regexp', 'hash', 'encrypt', 'decrypt', 'serialize', 'deserialize',
  'parse', 'stringify', 'encode', 'decode', 'compress', 'decompress',
  'validate', 'sanitize', 'normalize', 'payload', 'metadata', 'config',

  // CLI / dev environment
  'exit code', 'session ID', 'node_modules', 'npm', 'git',
] as const;

/**
 * Set for O(1) lookup of banned words
 */
const BANNED_WORDS_SET = new Set(
  BANNED_WORDS.map(word => word.toLowerCase())
);

// =============================================================================
// PREFERRED TERMS - Use these instead
// =============================================================================

/**
 * Mapping from technical terms to user-friendly alternatives.
 * Key: lowercase technical term, Value: friendly replacement
 */
export const PREFERRED_TERMS: Readonly<Record<string, string>> = {
  // Execution
  'executing': 'running',
  'spawning': 'starting',
  'instantiating': 'creating',
  'initializing': 'preparing',
  'bootstrapping': 'setting up',
  'terminating': 'stopping',
  'killing': 'stopping',

  // Components
  'agent': 'assistant',
  'process': 'task',
  'thread': 'task',
  'worker': 'helper',
  'handler': 'helper',

  // Data
  'token': 'word',
  'tokens': 'words',
  'parsing': 'reading',
  'parse': 'read',
  'query': 'search',
  'querying': 'searching',

  // Files
  'file system': 'files',
  'filesystem': 'files',
  'directory': 'folder',
  'path': 'location',

  // Network
  'request': 'call',
  'requesting': 'asking for',
  'fetching': 'getting',
  'downloading': 'getting',
  'uploading': 'sending',

  // Operations
  'validating': 'checking',
  'validate': 'check',
  'sanitizing': 'cleaning',
  'sanitize': 'clean',
  'transforming': 'changing',
  'transform': 'change',
  'processing': 'working on',

  // Errors
  'exception': 'problem',
  'error': 'issue',
  'failure': 'problem',
  'failed': 'had a problem',

  // AI
  'inference': 'thinking',
  'model': 'brain',
  'embedding': 'understanding',
  'context': 'memory',

  // Status
  'pending': 'waiting',
  'queued': 'in line',
  'completed': 'done',
  'succeeded': 'finished',
} as const;

// =============================================================================
// VOICE RULES
// =============================================================================

/**
 * Maximum words allowed in a status line
 */
export const MAX_WORDS_PER_STATUS = 8;

/**
 * Tense to use for status messages
 * "Building..." not "Built"
 */
export const TENSE = 'present-progressive' as const;

/**
 * Suffixes that indicate present progressive tense
 */
const PROGRESSIVE_SUFFIXES = ['ing', 'ing...', 'ing…'] as const;

// =============================================================================
// SANITIZATION FUNCTIONS
// =============================================================================

/**
 * Checks if a word is banned (case-insensitive)
 */
export function isBanned(word: string): boolean {
  return BANNED_WORDS_SET.has(word.toLowerCase());
}

/**
 * Gets the preferred replacement for a banned word.
 * Returns the original word if no replacement exists.
 */
export function getPreferred(word: string): string {
  const lower = word.toLowerCase();
  const preferred = PREFERRED_TERMS[lower];

  if (preferred) {
    // Preserve original casing style
    if (word[0] === word[0].toUpperCase()) {
      return preferred.charAt(0).toUpperCase() + preferred.slice(1);
    }
    return preferred;
  }

  return word;
}

/**
 * Replaces banned words with preferred alternatives.
 * Preserves punctuation and spacing.
 */
/**
 * Compound banned terms that span multiple words.
 * Must be checked before per-word splitting.
 */
const COMPOUND_BANNED = ['exit code', 'session id', 'context window', 'node_modules', 'stack trace',
  'null pointer', 'memory leak', 'buffer overflow', 'load balancer', 'Claude Code'] as const;

export function sanitize(text: string): string {
  if (!text) return text;

  // Check compound banned terms first (before splitting into words)
  let compoundCleaned = text;
  for (const compound of COMPOUND_BANNED) {
    const regex = new RegExp(compound, 'gi');
    compoundCleaned = compoundCleaned.replace(regex, '');
  }

  // Split preserving punctuation
  const tokens = compoundCleaned.split(/(\s+|[.,!?;:'"()\[\]{}])/);

  const sanitized = tokens.map(token => {
    // Skip whitespace and punctuation
    if (/^\s*$/.test(token) || /^[.,!?;:'"()\[\]{}]$/.test(token)) {
      return token;
    }

    // Check if word (without trailing punctuation) is banned
    const cleanWord = token.replace(/[.,!?;:'"()\[\]{}]+$/, '');
    const trailingPunct = token.slice(cleanWord.length);

    if (isBanned(cleanWord)) {
      const replacement = getPreferred(cleanWord);
      // If no good replacement, remove the word entirely
      if (replacement === cleanWord) {
        return '';
      }
      return replacement + trailingPunct;
    }

    return token;
  });

  // Clean up extra spaces from removed words
  return sanitized
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Truncates text to a maximum word count.
 * Adds ellipsis if truncated.
 */
export function truncate(text: string, maxWords: number = MAX_WORDS_PER_STATUS): string {
  if (!text) return text;

  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length <= maxWords) {
    return text;
  }

  const truncated = words.slice(0, maxWords).join(' ');

  // Don't double-up ellipsis
  if (truncated.endsWith('...') || truncated.endsWith('…')) {
    return truncated;
  }

  return truncated + '...';
}

/**
 * Ensures text is in present progressive tense.
 * "Build" → "Building", "Created" → "Creating"
 */
export function toProgressive(text: string): string {
  if (!text) return text;

  // Already progressive
  if (PROGRESSIVE_SUFFIXES.some(suffix => text.toLowerCase().endsWith(suffix))) {
    return text;
  }

  const words = text.split(/\s+/);
  if (words.length === 0) return text;

  // Transform first word to progressive
  const firstWord = words[0];
  const rest = words.slice(1).join(' ');

  const progressive = verbToProgressive(firstWord);

  return rest ? `${progressive} ${rest}` : progressive;
}

/**
 * Converts a single verb to progressive tense
 */
function verbToProgressive(verb: string): string {
  const lower = verb.toLowerCase();

  // Already progressive
  if (lower.endsWith('ing')) {
    return verb;
  }

  // Past tense → progressive
  if (lower.endsWith('ed')) {
    const base = lower.slice(0, -2);
    // Double consonant cases: "stopped" → "stopping"
    if (/[bcdfghjklmnpqrstvwxz]{2}$/.test(base)) {
      return capitalize(base + 'ing', verb);
    }
    // "created" → "creating"
    return capitalize(base.replace(/[aeiou]$/, '') + 'ing', verb);
  }

  // Base form → progressive
  // "write" → "writing" (drop silent e)
  if (lower.endsWith('e') && !lower.endsWith('ee')) {
    return capitalize(lower.slice(0, -1) + 'ing', verb);
  }

  // "run" → "running" (double final consonant)
  if (/^[a-z]+[aeiou][bcdfghjklmnpqrstvwxz]$/.test(lower)) {
    return capitalize(lower + lower.slice(-1) + 'ing', verb);
  }

  // Default: just add "ing"
  return capitalize(lower + 'ing', verb);
}

/**
 * Applies original capitalization style to new word
 */
function capitalize(newWord: string, original: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return newWord.charAt(0).toUpperCase() + newWord.slice(1);
  }
  return newWord;
}

// =============================================================================
// COMBINED VOICE PROCESSING
// =============================================================================

/**
 * Full voice processing pipeline:
 * 1. Sanitize (remove banned words)
 * 2. Convert to progressive tense
 * 3. Truncate to max words
 */
export function processVoice(text: string): string {
  if (!text) return text;

  let result = text;

  // Step 1: Remove banned words
  result = sanitize(result);

  // Step 2: Ensure progressive tense
  result = toProgressive(result);

  // Step 3: Truncate
  result = truncate(result);

  return result;
}

/**
 * Validates that text follows voice rules.
 * Returns array of violations found.
 */
export function validateVoice(text: string): string[] {
  const violations: string[] = [];

  if (!text) return violations;

  const words = text.split(/\s+/).filter(w => w.length > 0);

  // Check word count
  if (words.length > MAX_WORDS_PER_STATUS) {
    violations.push(`Too many words: ${words.length} > ${MAX_WORDS_PER_STATUS}`);
  }

  // Check for banned words
  for (const word of words) {
    const cleanWord = word.replace(/[.,!?;:'"()\[\]{}]+/g, '');
    if (isBanned(cleanWord)) {
      violations.push(`Banned word: "${cleanWord}"`);
    }
  }

  // Check tense (first word should be progressive)
  if (words.length > 0) {
    const firstWord = words[0].replace(/[.,!?;:'"()\[\]{}]+/g, '').toLowerCase();
    if (!PROGRESSIVE_SUFFIXES.some(s => firstWord.endsWith(s.replace('...', '').replace('…', '')))) {
      // Allow certain non-progressive starters
      const allowedStarters = ['ready', 'done', 'complete', 'waiting', 'paused'];
      if (!allowedStarters.includes(firstWord)) {
        violations.push(`Not progressive tense: "${words[0]}"`);
      }
    }
  }

  return violations;
}

// =============================================================================
// HUMANIZATION HELPERS
// =============================================================================

/**
 * Converts a file path to a friendly name
 * "/Users/foo/bar/MyComponent.tsx" → "MyComponent"
 */
export function humanizeFileName(filePath: string): string {
  if (!filePath) return 'file';

  // Get just the filename
  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1] || 'file';

  // Remove extension
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

  // Convert camelCase/PascalCase to spaces
  const spaced = nameWithoutExt
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Convert snake_case/kebab-case to spaces
  const cleaned = spaced.replace(/[-_]/g, ' ');

  return cleaned.toLowerCase();
}

/**
 * Converts a technical task description to friendly text
 */
export function humanizeTask(task: string): string {
  if (!task) return 'working';

  // Common task patterns
  const taskMappings: Record<string, string> = {
    'create_file': 'Creating a file',
    'edit_file': 'Editing',
    'delete_file': 'Removing',
    'read_file': 'Reading',
    'write_file': 'Writing',
    'run_command': 'Running',
    'install_deps': 'Installing dependencies',
    'install_dependencies': 'Installing dependencies',
    'run_tests': 'Running tests',
    'build': 'Building',
    'deploy': 'Deploying',
    'search': 'Searching',
    'analyze': 'Analyzing',
    'generate': 'Generating',
    'refactor': 'Improving',
    'fix_bug': 'Fixing',
    'add_feature': 'Adding',
    'update': 'Updating',
    'review': 'Reviewing',
  };

  const lower = task.toLowerCase().replace(/[-_]/g, '_');

  for (const [pattern, friendly] of Object.entries(taskMappings)) {
    if (lower.includes(pattern)) {
      return friendly;
    }
  }

  // Fallback: sanitize and return
  return sanitize(task);
}

/**
 * Simplifies a technical reason/error to user-friendly text
 */
export function simplifyReason(reason: string): string {
  if (!reason) return 'an issue occurred';

  // Common error patterns
  const errorMappings: Record<string, string> = {
    'enoent': 'file not found',
    'eacces': 'permission needed',
    'econnrefused': 'could not connect',
    'etimedout': 'took too long',
    'timeout': 'took too long',
    'rate_limit': 'too many requests',
    'rate limit': 'too many requests',
    '429': 'too many requests',
    '401': 'authentication needed',
    '403': 'not allowed',
    '404': 'not found',
    '500': 'service problem',
    '502': 'service unavailable',
    '503': 'service unavailable',
    'syntax error': 'code needs fixing',
    'type error': 'code needs fixing',
    'reference error': 'code needs fixing',
    'out of memory': 'ran out of space',
    'disk full': 'ran out of space',
  };

  const lower = reason.toLowerCase();

  for (const [pattern, friendly] of Object.entries(errorMappings)) {
    if (lower.includes(pattern)) {
      return friendly;
    }
  }

  // Fallback: sanitize and truncate
  return truncate(sanitize(reason), 5);
}
