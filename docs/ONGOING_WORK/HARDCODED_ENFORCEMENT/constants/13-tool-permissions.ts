// Source: HARDCODED-ENFORCEMENT-VALUES.md section 14

// Codex: sandbox model, NOT --allowed-tools (corrected by Instance V)
export const CODEX_SANDBOX: Record<string, string> = {
  '["read"]': "--sandbox read-only",
  '["read","bash"]': "--sandbox read-only", // bash for analysis (find, grep)
  '["read","write"]': "--sandbox workspace-write",
  '["read","write","bash"]': "--sandbox workspace-write --full-auto",
  '["read","write","bash","web"]': "--sandbox danger-full-access",
};

// Claude Code: tool names in settings.json / YAML frontmatter
export const CLAUDE_TOOL_MAP: Record<string, string> = {
  read: "Read",
  write: "Write",
  bash: "Bash",
  web_search: "WebSearch",
  edit: "Edit",
};

// Gemini: CLI flags
export const GEMINI_TOOL_MAP: Record<string, string> = {
  read: "read_file",
  write: "write_file",
  bash: "run_command",
  web_search: "google_search",
  edit: "edit_file",
};
