/**
 * Output Translator - Converts raw CLI output to friendly user messages
 *
 * Gate 7: CLI Process Management
 *
 * Transforms verbose, technical CLI output into simple status messages
 * that non-technical users can understand.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TranslationPattern {
  /** Regex pattern to match raw output */
  match: RegExp;
  /** Function to generate friendly display text */
  display: (matches: RegExpMatchArray) => string;
  /** Optional priority (higher = checked first) */
  priority?: number;
  /** Optional category for grouping */
  category?: 'progress' | 'success' | 'error' | 'info';
}

export interface TranslationResult {
  /** The translated friendly message, or null if no match */
  message: string | null;
  /** The pattern category if matched */
  category?: 'progress' | 'success' | 'error' | 'info';
  /** Whether the output was translated */
  translated: boolean;
}

// ============================================================================
// FILE PATH HELPERS
// ============================================================================

/**
 * Extract a friendly filename from a path
 */
function friendlyName(filePath: string): string {
  // Get just the filename from the path
  const parts = filePath.split(/[/\\]/);
  const filename = parts[parts.length - 1] || filePath;

  // Clean up common extensions for display
  return filename
    .replace(/\.(tsx?|jsx?|mjs|cjs)$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
    .replace(/[-_]/g, ' ') // dashes/underscores to spaces
    .toLowerCase();
}

/**
 * Extract port number from a string
 */
function extractPort(text: string): string | null {
  const portMatch = text.match(/(?:port|:)\s*(\d{4,5})/i);
  return portMatch ? portMatch[1] : null;
}

// ============================================================================
// TRANSLATION PATTERNS
// ============================================================================

/**
 * Default output translation patterns.
 * Ordered by priority (higher priority patterns are checked first).
 */
export const OUTPUT_PATTERNS: TranslationPattern[] = [
  // ============================================================================
  // ERROR PATTERNS (high priority)
  // ============================================================================
  {
    match: /error:\s*(.{1,100})/i,
    display: () => 'Issue detected - fixing...',
    priority: 100,
    category: 'error',
  },
  {
    match: /ERR!|Error:|FATAL|failed/i,
    display: () => 'Issue detected - fixing...',
    priority: 100,
    category: 'error',
  },
  {
    match: /warning:\s*(.{1,80})/i,
    display: () => 'Minor issue found - continuing...',
    priority: 90,
    category: 'error',
  },
  {
    match: /WARN|Warning/i,
    display: () => 'Minor issue found - continuing...',
    priority: 90,
    category: 'error',
  },

  // ============================================================================
  // SUCCESS PATTERNS
  // ============================================================================
  {
    match: /\u2713|success|successfully|complete[d]?|done|finished/i,
    display: () => 'Step complete',
    priority: 80,
    category: 'success',
  },
  {
    match: /build succeeded|compiled successfully|built in/i,
    display: () => 'Build complete',
    priority: 80,
    category: 'success',
  },
  {
    match: /all tests? passed|(\d+)\s+passed/i,
    display: (m) => m[1] ? `${m[1]} tests passed` : 'Tests passed',
    priority: 80,
    category: 'success',
  },
  {
    match: /deployed? (?:to|at)\s+(https?:\/\/[^\s]+)/i,
    display: (m) => `Deployed to ${m[1]}`,
    priority: 85,
    category: 'success',
  },

  // ============================================================================
  // FILE OPERATION PATTERNS
  // ============================================================================
  {
    match: /creat(?:ing|ed?)\s+([^\s]+\.(?:tsx?|jsx?|vue|svelte|css|scss|html|json))/i,
    display: (m) => `Creating ${friendlyName(m[1])}`,
    priority: 70,
    category: 'progress',
  },
  {
    match: /writ(?:ing|e|ten)\s+(?:to\s+)?([^\s]+\.[a-z]+)/i,
    display: (m) => `Writing ${friendlyName(m[1])}`,
    priority: 70,
    category: 'progress',
  },
  {
    match: /updat(?:ing|ed?)\s+([^\s]+\.[a-z]+)/i,
    display: (m) => `Updating ${friendlyName(m[1])}`,
    priority: 70,
    category: 'progress',
  },
  {
    match: /delet(?:ing|ed?)\s+([^\s]+)/i,
    display: (m) => `Removing ${friendlyName(m[1])}`,
    priority: 70,
    category: 'progress',
  },
  {
    match: /copy(?:ing)?\s+([^\s]+)/i,
    display: (m) => `Copying ${friendlyName(m[1])}`,
    priority: 70,
    category: 'progress',
  },

  // ============================================================================
  // DEPENDENCY PATTERNS
  // ============================================================================
  {
    match: /install(?:ing)?\s+(?:dependencies|packages|modules)/i,
    display: () => 'Installing dependencies',
    priority: 75,
    category: 'progress',
  },
  {
    match: /npm\s+install|yarn\s+(?:install|add)|pnpm\s+(?:install|add)/i,
    display: () => 'Installing dependencies',
    priority: 75,
    category: 'progress',
  },
  {
    match: /added\s+(\d+)\s+packages?/i,
    display: (m) => `Installed ${m[1]} packages`,
    priority: 75,
    category: 'success',
  },
  {
    match: /resolving\s+dependencies/i,
    display: () => 'Resolving dependencies',
    priority: 70,
    category: 'progress',
  },
  {
    match: /downloading\s+(.+)/i,
    display: () => 'Downloading packages',
    priority: 70,
    category: 'progress',
  },

  // ============================================================================
  // BUILD/COMPILE PATTERNS
  // ============================================================================
  {
    match: /compil(?:ing|e)/i,
    display: () => 'Compiling code',
    priority: 65,
    category: 'progress',
  },
  {
    match: /bundl(?:ing|e)/i,
    display: () => 'Bundling application',
    priority: 65,
    category: 'progress',
  },
  {
    match: /transpil(?:ing|e)/i,
    display: () => 'Processing code',
    priority: 65,
    category: 'progress',
  },
  {
    match: /minify(?:ing)?|uglify(?:ing)?/i,
    display: () => 'Optimizing code',
    priority: 65,
    category: 'progress',
  },
  {
    match: /build(?:ing)?/i,
    display: () => 'Building project',
    priority: 60,
    category: 'progress',
  },

  // ============================================================================
  // SERVER/DEV PATTERNS
  // ============================================================================
  {
    match: /server.*?(?:running|listening|started).*?(\d{4,5})/i,
    display: (m) => `Preview ready on port ${m[1]}`,
    priority: 85,
    category: 'success',
  },
  {
    match: /(?:local|dev|development).*?(?:https?:\/\/)?localhost:(\d{4,5})/i,
    display: (m) => `Preview ready on port ${m[1]}`,
    priority: 85,
    category: 'success',
  },
  {
    match: /ready\s+(?:on|at|in)/i,
    display: () => 'Ready',
    priority: 80,
    category: 'success',
  },
  {
    match: /start(?:ing|ed)?\s+(?:dev|development)\s+server/i,
    display: () => 'Starting development server',
    priority: 70,
    category: 'progress',
  },
  {
    match: /watch(?:ing)?\s+(?:for\s+)?(?:changes|files)/i,
    display: () => 'Watching for changes',
    priority: 65,
    category: 'info',
  },
  {
    match: /hot\s+reload|hmr/i,
    display: () => 'Live reload enabled',
    priority: 60,
    category: 'info',
  },

  // ============================================================================
  // TEST PATTERNS
  // ============================================================================
  {
    match: /run(?:ning)?\s+tests?/i,
    display: () => 'Running tests',
    priority: 70,
    category: 'progress',
  },
  {
    match: /test(?:ing)?\s+([^\s]+)/i,
    display: (m) => `Testing ${friendlyName(m[1])}`,
    priority: 65,
    category: 'progress',
  },
  {
    match: /(\d+)\s+(?:tests?\s+)?failed/i,
    display: (m) => `${m[1]} test${parseInt(m[1]) === 1 ? '' : 's'} failed`,
    priority: 85,
    category: 'error',
  },
  {
    match: /(\d+)\s+(?:tests?\s+)?skipped/i,
    display: (m) => `${m[1]} test${parseInt(m[1]) === 1 ? '' : 's'} skipped`,
    priority: 60,
    category: 'info',
  },

  // ============================================================================
  // GIT PATTERNS
  // ============================================================================
  {
    match: /commit(?:ting|ted)?/i,
    display: () => 'Saving changes',
    priority: 65,
    category: 'progress',
  },
  {
    match: /push(?:ing|ed)?/i,
    display: () => 'Uploading changes',
    priority: 65,
    category: 'progress',
  },
  {
    match: /pull(?:ing|ed)?/i,
    display: () => 'Downloading updates',
    priority: 65,
    category: 'progress',
  },
  {
    match: /clone|cloning/i,
    display: () => 'Downloading project',
    priority: 65,
    category: 'progress',
  },
  {
    match: /merge|merging/i,
    display: () => 'Merging changes',
    priority: 65,
    category: 'progress',
  },
  {
    match: /branch/i,
    display: () => 'Managing branches',
    priority: 60,
    category: 'info',
  },

  // ============================================================================
  // DEPLOYMENT PATTERNS
  // ============================================================================
  {
    match: /deploy(?:ing|ed)?/i,
    display: () => 'Deploying application',
    priority: 70,
    category: 'progress',
  },
  {
    match: /upload(?:ing|ed)?/i,
    display: () => 'Uploading files',
    priority: 65,
    category: 'progress',
  },
  {
    match: /publish(?:ing|ed)?/i,
    display: () => 'Publishing',
    priority: 65,
    category: 'progress',
  },

  // ============================================================================
  // LINTING/FORMATTING PATTERNS
  // ============================================================================
  {
    match: /lint(?:ing)?/i,
    display: () => 'Checking code style',
    priority: 60,
    category: 'progress',
  },
  {
    match: /format(?:ting)?/i,
    display: () => 'Formatting code',
    priority: 60,
    category: 'progress',
  },
  {
    match: /prettier|eslint|tslint/i,
    display: () => 'Checking code style',
    priority: 55,
    category: 'progress',
  },

  // ============================================================================
  // DOCKER PATTERNS
  // ============================================================================
  {
    match: /docker\s+build/i,
    display: () => 'Building container',
    priority: 65,
    category: 'progress',
  },
  {
    match: /docker\s+(?:run|start)/i,
    display: () => 'Starting container',
    priority: 65,
    category: 'progress',
  },
  {
    match: /docker\s+(?:push|pull)/i,
    display: () => 'Syncing container',
    priority: 65,
    category: 'progress',
  },

  // ============================================================================
  // PROGRESS INDICATORS
  // ============================================================================
  {
    match: /(\d{1,3})%/,
    display: (m) => `Progress: ${m[1]}%`,
    priority: 50,
    category: 'progress',
  },
  {
    match: /\[(\d+)\/(\d+)\]/,
    display: (m) => `Step ${m[1]} of ${m[2]}`,
    priority: 50,
    category: 'progress',
  },
  {
    match: /step\s+(\d+)/i,
    display: (m) => `Step ${m[1]}`,
    priority: 45,
    category: 'progress',
  },

  // ============================================================================
  // CLAUDE CODE / AI TOOL PATTERNS
  // ============================================================================
  {
    match: /thinking|analyzing|processing/i,
    display: () => 'Thinking...',
    priority: 60,
    category: 'progress',
  },
  {
    match: /generat(?:ing|ed?)/i,
    display: () => 'Generating code',
    priority: 60,
    category: 'progress',
  },
  {
    match: /edit(?:ing|ed)?\s+([^\s]+)/i,
    display: (m) => `Editing ${friendlyName(m[1])}`,
    priority: 65,
    category: 'progress',
  },
  {
    match: /read(?:ing)?\s+([^\s]+)/i,
    display: (m) => `Reading ${friendlyName(m[1])}`,
    priority: 55,
    category: 'info',
  },
  {
    match: /search(?:ing)?\s+(?:for\s+)?(.{1,30})/i,
    display: (m) => `Searching: ${m[1].trim()}`,
    priority: 55,
    category: 'info',
  },
];

// Sort patterns by priority (highest first)
const sortedPatterns = [...OUTPUT_PATTERNS].sort(
  (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
);

// ============================================================================
// MAIN TRANSLATION FUNCTION
// ============================================================================

/**
 * Translate raw CLI output to a friendly user message.
 *
 * @param raw - The raw CLI output line
 * @param patterns - Optional custom patterns (defaults to OUTPUT_PATTERNS)
 * @returns TranslationResult with the friendly message or null if no match
 */
export function translateOutput(
  raw: string,
  patterns: TranslationPattern[] = sortedPatterns
): TranslationResult {
  // Skip empty lines
  const trimmed = raw.trim();
  if (!trimmed) {
    return { message: null, translated: false };
  }

  // Skip lines that are just whitespace, progress bars, or spinners
  if (/^[\s\-\|\\\/\*\.]+$/.test(trimmed)) {
    return { message: null, translated: false };
  }

  // Skip ANSI escape codes only lines
  if (/^(\x1b\[[0-9;]*m)+$/.test(trimmed)) {
    return { message: null, translated: false };
  }

  // Try each pattern in order
  for (const pattern of patterns) {
    const matches = trimmed.match(pattern.match);
    if (matches) {
      try {
        const message = pattern.display(matches);
        return {
          message,
          category: pattern.category,
          translated: true,
        };
      } catch {
        // Pattern display function failed, continue to next pattern
        continue;
      }
    }
  }

  // No pattern matched
  return { message: null, translated: false };
}

/**
 * Strip ANSI escape codes from a string.
 * Useful for cleaning up raw terminal output before translation.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Translate output with ANSI codes stripped first.
 */
export function translateCleanOutput(raw: string): TranslationResult {
  return translateOutput(stripAnsi(raw));
}

/**
 * Check if output indicates an error condition.
 */
export function isErrorOutput(raw: string): boolean {
  const result = translateOutput(raw);
  return result.category === 'error';
}

/**
 * Check if output indicates success/completion.
 */
export function isSuccessOutput(raw: string): boolean {
  const result = translateOutput(raw);
  return result.category === 'success';
}

/**
 * Get a simple progress status from raw output.
 * Returns a very condensed status suitable for a small UI element.
 */
export function getProgressStatus(raw: string): string | null {
  const result = translateOutput(stripAnsi(raw));
  return result.message;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  friendlyName,
  extractPort,
};
