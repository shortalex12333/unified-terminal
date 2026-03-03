// Source: HARDCODED-ENFORCEMENT-VALUES.md section 5

export const FILE_THRESHOLDS = {
  // Minimum file size to NOT be considered a stub
  MIN_MEANINGFUL_BYTES: 50, // < 50 bytes = suspicious. Source: check_files_nonempty.py

  // Minimum screenshot size to be valid
  MIN_SCREENSHOT_BYTES: 1_000, // < 1KB screenshot = blank/broken. Source: check_responsive.py

  // Minimum archive size
  MIN_ARCHIVE_BYTES: 500, // PROJECT-ARCHIVE.md must be > 500 bytes

  // Maximum prompt size before stdin pipe (not CLI arg)
  MAX_CLI_ARG_CHARS: 2_000, // > 2000 chars = use stdin pipe. Source: ADAPTERS.md

  // Maximum skill prompt tokens
  MAX_SKILL_TOKENS: 2_000, // Any skill file > 2000 tokens should be split
};
