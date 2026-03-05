/**
 * Universal Adapter Types
 *
 * Single source of truth for all runtime adapters.
 * Claude Code is native — no adapter needed.
 * Codex adapter translates this universal interface to CLI commands.
 *
 * Target: ES2022 CommonJS strict
 */

import type { ChildProcess } from 'child_process';

// =============================================================================
// CORE TYPES
// =============================================================================

/** Tools available across all runtimes */
export type Tool = 'read' | 'write' | 'bash' | 'web_search' | 'edit' | 'grep' | 'glob';

/**
 * Supported runtime targets.
 * Gemini is shelved — Codex and Claude are active.
 */
export type Runtime = 'codex' | 'claude';

/** Agent execution outcome */
export type Status = 'completed' | 'failed' | 'timeout' | 'killed';

// =============================================================================
// AGENT CONFIG (Input)
// =============================================================================

export interface AgentConfig {
  /** Unique identifier for this agent instance */
  id: string;

  /** Agent name/role (e.g., "executor", "planner") */
  name: string;

  /** Human-readable description of the agent's mandate */
  role: string;

  /** Model to use (adapter translates to runtime-specific ID) */
  model: string;

  /** Tool permissions — adapter enforces via sandbox/approval modes */
  tools: Tool[];

  /** Maximum output tokens */
  maxTokens: number;

  /** The full prompt payload (piped via stdin for large prompts) */
  prompt: string;

  /** Files this agent is ALLOWED to modify (Bodyguard enforcement) */
  declaredFiles: string[];

  /** Project directory */
  workingDir: string;

  /** Maximum execution time in milliseconds */
  timeout: number;

  /** Environment variables (secrets — never logged) */
  env?: Record<string, string>;

  /**
   * Secondary document for dual-input agents.
   * Used by verifier (mandate vs result).
   */
  secondaryInput?: string;
}

// =============================================================================
// AGENT RESULT (Output)
// =============================================================================

export interface AgentResult {
  /** Matches AgentConfig.id */
  id: string;

  /** Execution outcome */
  status: Status;

  /** Full text output from the agent */
  output: string;

  /** Files created during execution */
  filesCreated: string[];

  /** Files modified (not created) during execution */
  filesModified: string[];

  /** Token consumption */
  tokensUsed: {
    input: number;
    output: number;
  };

  /** Execution time in milliseconds */
  duration: number;

  /** Process exit code (null if killed/timeout) */
  exitCode: number | null;

  /** Which runtime executed this */
  runtime: Runtime;

  /** Raw tool calls for audit trail */
  toolCalls?: string[];

  /** Error message if status is failed/timeout/killed */
  error?: string;
}

// =============================================================================
// RUNTIME CAPABILITIES
// =============================================================================

export interface Capabilities {
  /** Can this runtime resume a previous session? */
  sessionResume: boolean;

  /** Does this runtime output structured JSON? */
  jsonOutput: boolean;

  /** Can tool permissions be enforced? */
  toolPermissions: boolean;

  /** Maximum prompt tokens */
  maxPromptTokens: number;

  /** Supported tools */
  supportedTools: Tool[];

  /** Model identifiers */
  models: {
    fast: string;
    standard: string;
    reasoning: string;
  };
}

// =============================================================================
// AGENT HANDLE (Running Process)
// =============================================================================

export interface AgentHandle {
  /** Unique identifier for this execution */
  id: string;

  /** Underlying process (null for web adapters) */
  process: ChildProcess | null;

  /** All output chunks accumulated during execution */
  outputHistory: string[];

  /** Register callback for streaming output */
  onOutput: (callback: (chunk: string) => void) => void;

  /** Wait for agent completion and get result */
  onComplete: () => Promise<AgentResult>;
}

// =============================================================================
// RUNTIME ADAPTER INTERFACE
// =============================================================================

export interface Adapter {
  /** Runtime identifier */
  readonly runtime: Runtime;

  /** Get runtime capabilities */
  capabilities(): Capabilities;

  /** Check if runtime is available and authenticated */
  isAvailable(): Promise<boolean>;

  /** Spawn a new agent */
  spawn(config: AgentConfig): Promise<AgentHandle>;

  /** Kill a running agent */
  kill(handle: AgentHandle): Promise<void>;
}
