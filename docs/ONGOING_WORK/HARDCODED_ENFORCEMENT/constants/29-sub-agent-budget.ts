// Source: ENFORCEMENT-GAPS.md gap 5

export const SUB_AGENT_BUDGET = {
  // Overhead tax per sub-agent (context window consumed by system prompt + spine summary)
  OVERHEAD_TOKENS_PER_SUB: 2_000,

  // Minimum viable budget (below this, don't sub-agent — do it directly)
  MIN_VIABLE_BUDGET_TOKENS: 8_000,

  // What happens when sub-agent hits budget limit
  BUDGET_EXCEEDED_POLICY: "kill_and_summarize",
  // NOT "warn" — hard kill, same as context warden

  // Can a sub-agent spawn its own sub-agents?
  SUB_SUB_AGENT_ALLOWED: true, // up to MAX_NESTING_DEPTH

  // How sub-agent reports back to parent
  REPORT_FORMAT: "files_on_disk", // NOT message passing — parent reads filesystem
};
