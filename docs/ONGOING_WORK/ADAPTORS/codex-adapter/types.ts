/**
 * Codex Adapter - Type Definitions
 *
 * Single source of truth for all types used by the Codex adapter.
 * These types define the contract between Unified Terminal and Codex CLI.
 */

import type { ChildProcess } from 'child_process';

// =============================================================================
// TOOL PERMISSIONS
// =============================================================================

/**
 * Tools that Codex can use during execution.
 * Maps to sandbox permissions.
 */
export type Tool = 'read' | 'write' | 'bash' | 'edit' | 'grep' | 'glob';

/**
 * Codex sandbox modes.
 * - read-only: Can read files, cannot write
 * - workspace-write: Can read and write within workspace
 */
export type SandboxMode = 'read-only' | 'workspace-write';

// =============================================================================
// AGENT CONFIGURATION (Input)
// =============================================================================

/**
 * Configuration for spawning a Codex agent.
 * This is what Unified Terminal sends to the adapter.
 */
export interface AgentConfig {
  /** Unique identifier for this agent instance */
  id: string;

  /** Human-readable name for logging/debugging */
  name: string;

  /** The prompt/instruction to execute */
  prompt: string;

  /** Tool permissions - determines sandbox mode */
  tools: Tool[];

  /** Working directory for file operations */
  workingDir: string;

  /** Maximum execution time in milliseconds (default: 120000) */
  timeout?: number;

  /** Optional model override (default: uses Codex default) */
  model?: string;

  /** Optional environment variables */
  env?: Record<string, string>;
}

// =============================================================================
// AGENT RESULT (Output)
// =============================================================================

/**
 * Execution status.
 */
export type Status = 'completed' | 'failed' | 'timeout' | 'killed';

/**
 * Result returned after agent execution completes.
 */
export interface AgentResult {
  /** Matches AgentConfig.id */
  id: string;

  /** Execution outcome */
  status: Status;

  /** Process exit code (null if killed/timeout) */
  exitCode: number | null;

  /** Full output from agent */
  output: string;

  /** Execution duration in milliseconds */
  duration: number;

  /** Error message if status is not 'completed' */
  error?: string;

  /** Files created during execution (parsed from output) */
  filesCreated: string[];

  /** Files modified during execution (parsed from output) */
  filesModified: string[];
}

// =============================================================================
// AGENT HANDLE (Running Process)
// =============================================================================

/**
 * Handle to a running agent process.
 * Allows streaming output and waiting for completion.
 */
export interface AgentHandle {
  /** Agent ID */
  id: string;

  /** Underlying child process */
  process: ChildProcess;

  /** Register callback for streaming output */
  onOutput(callback: (chunk: string) => void): void;

  /** Wait for agent to complete and get result */
  onComplete(): Promise<AgentResult>;

  /** Kill the agent */
  kill(): void;
}
