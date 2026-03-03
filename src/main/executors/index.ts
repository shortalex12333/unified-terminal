/**
 * Executors - Step execution handlers for the Unified Terminal
 *
 * Exports all executor implementations for different step types:
 * - CLIExecutor: Codex CLI for code generation
 * - ServiceExecutor: External service connections (Stripe, Supabase, etc.)
 */

// CLI Executor - Codex CLI wrapper
export {
  CLIExecutor,
  getCLIExecutor,
  cleanupCLIExecutor,
  executeCodexStep,
  scaffold,
  build,
  runTests,
  gitOperation,
} from './cli-executor';

export type {
  RuntimeStep as CLIRuntimeStep,
  CLIResult,
  Executor as CLIExecutorInterface,
} from './cli-executor';

// Service Executor - External service connections
export {
  ServiceExecutor,
  getServiceExecutor,
  cleanupServiceExecutor,
  SERVICE_GUIDES,
} from './service-executor';

export type {
  RuntimeStep as ServiceRuntimeStep,
  ServiceResult,
  ServiceGuide,
  ServiceAction,
  Executor as ServiceExecutorInterface,
} from './service-executor';

// Web Executor - ChatGPT BrowserView wrapper
export {
  WebExecutor,
  createWebExecutor,
  SELECTORS as WEB_SELECTORS,
  RATE_LIMIT_PATTERNS,
  ACTION_TIMEOUTS,
  POLL_CONFIG,
} from './web-executor';

export type {
  RuntimeStep as WebRuntimeStep,
  WebResult,
  ActionType,
  Executor as WebExecutorInterface,
} from './web-executor';
