// Source: HARDCODED-ENFORCEMENT-VALUES.md section 6

export interface TierConfig {
  name: string;
  timeRange: string;
  agents: number | string;
  overhead: string;
  actors: string[];
  examples: string[];
}

export const TIER_CLASSIFICATION: Record<number, TierConfig> = {
  0: {
    name: "trivial",
    timeRange: "<1 min",
    agents: 0,
    overhead: "50ms",
    actors: [], // Fast-path regex to ChatGPT
    examples: ["What is X?", "Generate image", "Thanks!"],
  },
  1: {
    name: "simple",
    timeRange: "1-5 min",
    agents: 1,
    overhead: "3-5s",
    actors: ["worker", "bodyguard"], // 1 worker + bodyguard post-completion
    examples: ["Fix typo", "Change hero image", "Update copyright"],
  },
  2: {
    name: "medium",
    timeRange: "5-30 min",
    agents: "3-7",
    overhead: "15-30s per step",
    actors: ["worker", "bodyguard", "scope", "skill_injector", "pa_on_handoff", "context_warden"],
    examples: ["Add contact form", "Set up Stripe", "Create admin page"],
  },
  3: {
    name: "complex",
    timeRange: "30+ min",
    agents: "8-15",
    overhead: "2-4 min total (6-9% of task)",
    actors: ["conductor", "worker", "bodyguard", "scope", "skill_injector", "pa", "context_warden", "archivist"],
    examples: ["Build candle store", "SaaS dashboard with auth", "Portfolio with CMS"],
  },
};

export const MAX_OVERHEAD_PERCENT = 10; // enforcement overhead must NEVER exceed 10% of task time
