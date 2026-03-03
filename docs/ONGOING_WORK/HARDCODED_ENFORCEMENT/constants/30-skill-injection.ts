// Source: ENFORCEMENT-GAPS.md gap 6

export const SKILL_INJECTION = {
  // Max combined skill token size that can be prepended to worker prompt
  MAX_SKILL_INJECTION_TOKENS: 4_000,

  // If combined skills exceed max, strategy:
  OVERFLOW_STRATEGY: "truncate_lowest_score_first",

  // Max number of skills injected per worker
  MAX_SKILLS_PER_WORKER: 3,

  // Skill file format requirement (binary: has sections or doesn't)
  REQUIRED_SKILL_SECTIONS: ["You Are", "Your Process", "Success Looks Like"],

  // If skill file is missing "Success Looks Like" section
  MISSING_SUCCESS_POLICY: "inject_anyway_but_log_warning",
};
