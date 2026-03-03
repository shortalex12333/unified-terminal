// Source: HARDCODED-ENFORCEMENT-VALUES.md section 8

export const SUB_AGENT_RULES = {
  // File count thresholds
  DIRECT_EXECUTION_MAX_FILES: 2, // 1-2 files: execute directly, no sub-agents
  MAY_SUB_AGENT_MIN_FILES: 3, // 3-5 files: MAY sub-agent
  SHOULD_SUB_AGENT_MIN_FILES: 6, // 6+ files: SHOULD sub-agent

  // Concern count threshold (independent of file count)
  MAY_SUB_AGENT_MIN_CONCERNS: 2, // 2+ distinct concerns: MAY sub-agent

  // Depth limit (practical, not enforced — overhead makes it self-limiting)
  MAX_NESTING_DEPTH: 4, // Level 4+ theoretically possible, practically never needed

  // Budget inheritance
  BUDGET_FORMULA: "parent_budget / num_sub_agents",

  // Max parallel workers (memory constraint on user machines)
  MAX_PARALLEL_WORKERS: 3, // Source: conductor-system.md (gap analysis)
};
