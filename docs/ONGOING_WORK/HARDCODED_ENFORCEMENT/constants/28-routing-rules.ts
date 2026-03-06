// Source: ENFORCEMENT-GAPS.md gap 4

export const ROUTING_RULES = {
  // Tasks that ALWAYS go to web (ChatGPT BrowserView)
  WEB_ONLY_ACTIONS: ["dall_e", "web_search", "intake_quiz", "direct_answer", "canvas"],

  // Tasks that ALWAYS go to CLI (Codex/Claude/Gemini)
  CLI_ONLY_ACTIONS: ["codex_scaffold", "codex_build", "codex_test", "codex_git", "file_write"],

  // Tasks that COULD go either way (conductor decides)
  HYBRID_ACTIONS: ["content_write", "code_review", "research"],

  // Fallback when CLI is unavailable (not installed, auth failed)
  CLI_UNAVAILABLE_FALLBACK: "web_with_warning",

  // Fallback when web is rate-limited
  WEB_RATE_LIMITED_FALLBACK: "defer_web_steps_continue_cli",

  // Maximum web steps queued while rate-limited before pausing entire project
  MAX_DEFERRED_WEB_STEPS: 5,
};
