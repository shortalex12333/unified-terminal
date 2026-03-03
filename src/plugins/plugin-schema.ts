/**
 * Plugin Schema - Type definitions for the plugin system
 *
 * Gate 10: GSD + Plugin Orchestration
 *
 * Defines the structure of plugins that can be registered and executed
 * within the Unified Terminal. Plugins wrap CLI tools like GSD, Codex,
 * Claude Code, etc.
 */

// ============================================================================
// PLUGIN CONFIGURATION
// ============================================================================

/**
 * Plugin type determines how the plugin executes.
 * - 'cli': Command-line tool (spawned as child process)
 * - 'browser': Browser-based tool (uses Playwright/BrowserView)
 * - 'hybrid': Uses both CLI and browser capabilities
 */
export type PluginType = 'cli' | 'browser' | 'hybrid';

/**
 * Configuration for a plugin.
 * This defines the plugin's identity, capabilities, and how to invoke it.
 */
export interface PluginConfig {
  /** Unique plugin identifier (lowercase, no spaces) */
  name: string;

  /** Semantic version string */
  version: string;

  /** Human-readable description of what the plugin does */
  description: string;

  /** How this plugin executes */
  type: PluginType;

  /** CLI command to run (for cli/hybrid types) */
  command?: string;

  /** Default arguments to pass to the command */
  defaultArgs?: string[];

  /** Names of other plugins this depends on */
  dependencies: string[];

  /** What this plugin can do (for capability-based routing) */
  capabilities: string[];

  /** Keywords that activate this plugin (for intelligent routing) */
  triggers: string[];

  /** Whether this plugin requires authentication */
  requiresAuth?: boolean;

  /** Environment variables required by this plugin */
  requiredEnv?: string[];

  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
}

// ============================================================================
// PLUGIN INSTANCE (RUNTIME STATE)
// ============================================================================

/**
 * Status of a plugin execution.
 */
export type PluginStatus = 'idle' | 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Runtime instance of a plugin execution.
 * Tracks the current state of a plugin being executed.
 */
export interface PluginInstance {
  /** The plugin configuration */
  config: PluginConfig;

  /** Unique execution ID */
  executionId: string;

  /** Current execution status */
  status: PluginStatus;

  /** Process ID from CLIRunner (for CLI plugins) */
  processId?: string;

  /** Project path being worked on */
  projectPath: string;

  /** Arguments passed to this execution */
  args: string[];

  /** When execution started */
  startedAt: Date;

  /** When execution ended (if finished) */
  endedAt?: Date;

  /** Error message if failed */
  errorMessage?: string;

  /** Progress percentage (0-100) if available */
  progress?: number;

  /** Current phase/step description */
  currentStep?: string;
}

// ============================================================================
// PLUGIN EVENTS
// ============================================================================

/**
 * Event emitted when plugin status changes.
 */
export interface PluginStatusEvent {
  /** Execution ID */
  executionId: string;

  /** Plugin name */
  pluginName: string;

  /** New status */
  status: PluginStatus;

  /** Progress percentage if available */
  progress?: number;

  /** Current step description */
  currentStep?: string;

  /** Error message if failed */
  errorMessage?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Event emitted for plugin output.
 */
export interface PluginOutputEvent {
  /** Execution ID */
  executionId: string;

  /** Plugin name */
  pluginName: string;

  /** Output stream */
  stream: 'stdout' | 'stderr';

  /** Output data */
  data: string;

  /** Parsed/translated output (if available) */
  translated?: string;

  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// PLUGIN EXECUTION OPTIONS
// ============================================================================

/**
 * Options for executing a plugin.
 */
export interface PluginExecuteOptions {
  /** Working directory for execution */
  cwd?: string;

  /** Environment variables to add */
  env?: Record<string, string>;

  /** Timeout override (ms) */
  timeout?: number;

  /** Whether to run in background */
  background?: boolean;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a plugin configuration.
 * @param config - Configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validatePluginConfig(config: PluginConfig): string[] {
  const errors: string[] = [];

  if (!config.name || typeof config.name !== 'string') {
    errors.push('Plugin name is required and must be a string');
  } else if (!/^[a-z][a-z0-9-]*$/.test(config.name)) {
    errors.push('Plugin name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens');
  }

  if (!config.version || typeof config.version !== 'string') {
    errors.push('Plugin version is required and must be a string');
  }

  if (!config.description || typeof config.description !== 'string') {
    errors.push('Plugin description is required and must be a string');
  }

  if (!['cli', 'browser', 'hybrid'].includes(config.type)) {
    errors.push('Plugin type must be "cli", "browser", or "hybrid"');
  }

  if (config.type === 'cli' && !config.command) {
    errors.push('CLI plugins must specify a command');
  }

  if (!Array.isArray(config.dependencies)) {
    errors.push('Plugin dependencies must be an array');
  }

  if (!Array.isArray(config.capabilities)) {
    errors.push('Plugin capabilities must be an array');
  }

  if (!Array.isArray(config.triggers)) {
    errors.push('Plugin triggers must be an array');
  }

  return errors;
}

/**
 * Check if a plugin config is valid.
 * @param config - Configuration to check
 * @returns True if valid
 */
export function isValidPluginConfig(config: PluginConfig): boolean {
  return validatePluginConfig(config).length === 0;
}
