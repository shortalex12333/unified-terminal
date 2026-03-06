// Source: HARDCODED-ENFORCEMENT-VALUES.md section 16-17

export const RATE_LIMIT_PATTERNS: RegExp[] = [
  /you['']ve reached (the|your) (message |usage )?limit/i,
  /too many (messages|requests)/i,
  /please try again (in |after )/i,
  /limit (reached|exceeded|hit)/i,
];

export const RATE_LIMIT_DEFAULT_WAIT_MS = 3_600_000; // 1 hour default if wait time not parseable
export const RATE_LIMIT_RETRY_AFTER_RESUME_MS = 300_000; // 5 minutes between resume attempts after initial recovery

// DOM polling intervals (ChatGPT Web Adapter)
export const DOM_POLLING = {
  // Response capture: how often to check for new content
  CAPTURE_POLL_MS: 150, // 150ms

  // Rate limit detection: how often to scan page for limit messages
  RATE_LIMIT_SCAN_MS: 5_000, // 5 seconds

  // Auth state detection: how often to check if user is logged in
  AUTH_STATE_POLL_MS: 200, // 200ms (main process polls BrowserView)

  // Message injection: delay after pasting before clicking send
  POST_PASTE_DELAY_MS: 300, // 300ms for React state to update

  // Completion detection: delay after stop button disappears
  COMPLETION_DETECT_MS: 500, // 500ms buffer after generation ends
};
