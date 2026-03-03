// Source: HARDCODED-ENFORCEMENT-VALUES.md section 19

export const SKILL_INJECTOR = {
  // Minimum match score to inject a skill (0-1 scale)
  MIN_MATCH_SCORE: 0.2, // Below this, no skill loaded (generic worker)

  // Frontend design default query (hardcoded Apple-like fallback)
  FRONTEND_DEFAULT_QUERY: "SaaS premium minimal clean apple whitespace",

  // Max results from BM25 CSV search to append to prompt
  BM25_MAX_RESULTS: 5,
};
