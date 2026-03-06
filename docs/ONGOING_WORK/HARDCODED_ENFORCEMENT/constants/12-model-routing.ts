// Source: HARDCODED-ENFORCEMENT-VALUES.md section 13

export interface ModelRouting {
  fast?: string;
  standard?: string;
  reasoning?: string;
  default?: string;
}

export const MODEL_ROUTING: Record<string, ModelRouting> = {
  codex: {
    fast: "gpt-5-codex", // Optimized for coding tasks with many tools
    standard: "gpt-5-codex", // Default for all coding/agent work
    reasoning: "gpt-5", // Broad world knowledge with strong general reasoning
  },
  claude: {
    fast: "claude-haiku-4",
    standard: "claude-sonnet-4",
    reasoning: "claude-opus-4",
  },
  chatgpt_web: {
    // Model determined by user's ChatGPT subscription, not our choice
    default: "user_subscription_model",
  },
};
