// Source: HARDCODED-ENFORCEMENT-VALUES.md section 13

export interface ModelRouting {
  fast?: string;
  standard?: string;
  reasoning?: string;
  default?: string;
}

export const MODEL_ROUTING: Record<string, ModelRouting> = {
  codex: {
    fast: "gpt-4o-mini", // Tier 1 simple tasks
    standard: "gpt-4o", // Tier 2 medium tasks (default)
    reasoning: "o3", // Tier 3 complex planning
  },
  claude: {
    fast: "claude-haiku-4",
    standard: "claude-sonnet-4",
    reasoning: "claude-opus-4",
  },
  gemini: {
    fast: "gemini-flash",
    standard: "gemini-pro",
    reasoning: "gemini-pro", // no separate reasoning model
  },
  chatgpt_web: {
    // Model determined by user's ChatGPT subscription, not our choice
    default: "user_subscription_model",
  },
};
