// Source: HARDCODED-ENFORCEMENT-VALUES.md section 20

export const LESSON_VALIDATION = {
  REQUIRED_FIELDS: [
    /what broke/i,
    /root cause/i,
    /fix applied/i,
    /prevention rule/i,
  ],
  FORBIDDEN_PLACEHOLDERS: [
    /one sentence/i,
    /\bTODO\b/,
    /\bTBD\b/,
    /fill in/i,
    /\[placeholder\]/i,
    /\[.*?\]/, // any [bracketed placeholder]
  ],
  // All 4 fields must match. Zero forbidden patterns must match. Binary.
};
