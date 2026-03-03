/**
 * DOM Selectors for ChatGPT Interface
 *
 * These selectors target ChatGPT's input field and send button.
 * ChatGPT uses a React-based interface with ProseMirror for the editor.
 * Multiple selectors are provided as fallbacks since ChatGPT's DOM
 * structure can change with updates.
 */

export const CHATGPT_SELECTORS = {
  /**
   * Input field selectors (try in order)
   * - #prompt-textarea: Main textarea ID
   * - textarea[data-id]: Generic data-id textarea
   * - [contenteditable="true"][data-placeholder]: ProseMirror editor
   * - div.ProseMirror: Direct ProseMirror class
   * - [role="textbox"]: ARIA textbox role
   */
  textarea: [
    '#prompt-textarea',
    'textarea[data-id]',
    '[contenteditable="true"][data-placeholder]',
    'div.ProseMirror',
    '[role="textbox"]',
    'textarea[placeholder*="Message"]',
    'form textarea',
  ],

  /**
   * Send button selectors (try in order)
   * - button[data-testid="send-button"]: Test ID selector
   * - button[aria-label="Send prompt"]: ARIA label selector
   * - button[aria-label*="Send"]: Partial ARIA label match
   * - form button[type="submit"]: Form submit button
   * - button svg[viewBox*="0 0 32 32"]: Button with specific SVG icon
   */
  sendButton: [
    'button[data-testid="send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
    'form button[type="submit"]',
    'form button:last-child',
    'button:has(svg)',
  ],

  /**
   * Form container selectors
   */
  form: [
    'form[class*="stretch"]',
    'form:has(textarea)',
    'form:has([contenteditable])',
    'main form',
  ],

  /**
   * Chat container for detecting loaded state
   */
  chatContainer: [
    'main',
    '[class*="conversation"]',
    '[role="presentation"]',
  ],

  // ============================================================================
  // RESPONSE SELECTORS (Gate 3: DOM Capture)
  // ============================================================================

  /**
   * Container for assistant (ChatGPT) response messages
   * These selectors target the actual response content
   */
  responseContainer: [
    '[data-message-author-role="assistant"]',
    '.agent-turn',
    '.markdown.prose',
    'div[data-testid^="conversation-turn-"] .agent-turn',
    '.text-base .prose',
    '.group.w-full .prose',
    '.min-h-\\[20px\\].flex.flex-col',
  ],

  /**
   * The innermost markdown content container
   * Used to extract clean HTML without wrapper elements
   */
  markdownContent: [
    '[data-message-author-role="assistant"] .markdown',
    '.agent-turn .markdown',
    '.prose.w-full',
    '.markdown-body',
  ],

  /**
   * Code blocks within responses
   */
  codeBlocks: [
    'pre code',
    '.code-block__code',
    'div[class*="language-"]',
    '.hljs',
  ],

  // ============================================================================
  // GENERATION STATE SELECTORS
  // ============================================================================

  /**
   * Stop generating button - visible while response is streaming
   */
  stopButton: [
    'button[aria-label="Stop generating"]',
    'button[data-testid="stop-button"]',
    'button.btn-neutral:has(rect)',
    'button:has(svg rect[x="7"])',
  ],

  /**
   * Regenerate button - appears after generation completes
   */
  regenerateButton: [
    'button[data-testid="regenerate-button"]',
    'button[aria-label*="Regenerate"]',
    '.flex.gap-1 button:first-child',
  ],

  /**
   * Copy button - appears on hover or after generation
   */
  copyButton: [
    'button[data-testid="copy-button"]',
    'button[aria-label*="Copy"]',
  ],

  // ============================================================================
  // ERROR STATE SELECTORS
  // ============================================================================

  /**
   * Rate limit or error messages
   */
  errorMessage: [
    '.text-red-500',
    '[data-testid="rate-limit-error"]',
    '.error-message',
    'div[class*="error"]',
  ],
};

/**
 * Injection strategies configuration
 */
export const INJECTION_CONFIG = {
  /**
   * Delay between paste and send (ms)
   * Allows React state to update before triggering send
   */
  pasteToSendDelay: 300,

  /**
   * Delay between character keystrokes in fallback mode (ms)
   */
  keystrokeDelay: 10,

  /**
   * Maximum wait time for input element to appear (ms)
   */
  inputWaitTimeout: 5000,

  /**
   * Interval for polling input element (ms)
   */
  inputPollInterval: 100,
};

/**
 * Response capture configuration (Gate 3)
 */
export const CAPTURE_CONFIG = {
  /**
   * Polling interval for checking response state (ms)
   * Balance between responsiveness and CPU usage
   */
  pollInterval: 150,

  /**
   * Maximum time to wait for response to start (ms)
   */
  responseStartTimeout: 30000,

  /**
   * Time to wait after stop button disappears to confirm completion (ms)
   */
  completionConfirmDelay: 500,

  /**
   * Debounce time for chunk emissions (ms)
   * Prevents flooding IPC with too many updates
   */
  chunkDebounce: 100,

  /**
   * Minimum characters changed to trigger a chunk emission
   */
  minChunkDelta: 10,
};

/**
 * Helper to build a selector string from array of fallbacks
 */
export function buildSelectorString(selectors: string[]): string {
  return selectors.join(', ');
}

/**
 * Type for selector keys in CHATGPT_SELECTORS
 */
export type SelectorKey = keyof typeof CHATGPT_SELECTORS;
