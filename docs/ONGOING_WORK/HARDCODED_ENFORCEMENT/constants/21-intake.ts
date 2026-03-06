// Source: HARDCODED-ENFORCEMENT-VALUES.md section 23

export const INTAKE = {
  MAX_QUESTIONS: 5, // never ask more than 5 clarifying questions
  MIN_QUESTIONS: 3, // aim for at least 3
  SKIP_BEHAVIOR: "proceed_with_defaults", // if user says "just build it"
  BRIEF_MARKER_START: "===BRIEF_START===",
  BRIEF_MARKER_END: "===BRIEF_END===",
  ALLOWED_TASK_TYPES: ["build_product", "build_content", "research", "automate", "general"],
  ALLOWED_DESIGN_PREFS: ["minimal", "playful", "corporate", "no_preference"],
};
