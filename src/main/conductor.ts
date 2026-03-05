/**
 * Conductor - Tier 1 Persistent Codex Router
 *
 * Manages a persistent Codex session that acts as an intelligent router.
 * The conductor classifies user messages and returns execution plans
 * specifying which targets (web/cli/service) should handle each step.
 *
 * Lifecycle:
 * 1. Initialize new session on first use (or resume existing)
 * 2. Classify messages via the persistent session
 * 3. Report step status back for re-planning if needed
 * 4. Persist session ID across app restarts
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { getStateManager, StateManager } from './state-manager';
import { conductorEvents } from './events';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Execution target for a step.
 */
export type ExecutionTarget = 'web' | 'cli' | 'service';

/**
 * Complexity level of the task.
 */
export type TaskComplexity = 'trivial' | 'simple' | 'medium' | 'complex';

/**
 * Route type for the overall execution plan.
 */
export type RouteType = 'web' | 'cli' | 'hybrid';

/**
 * A single step in an execution plan.
 */
export interface Step {
  /** Step identifier */
  id: number;
  /** Target system for execution */
  target: ExecutionTarget;
  /** Action to perform */
  action: string;
  /** Detailed description of what to do */
  detail: string;
  /** IDs of steps this depends on (must complete first) */
  waitFor: number[];
  /** Whether this can run in parallel with other steps */
  parallel: boolean;
}

/**
 * Full execution plan returned by the conductor.
 */
export interface ExecutionPlan {
  /** Primary route type */
  route: RouteType;
  /** Overall complexity assessment */
  complexity: TaskComplexity;
  /** Ordered list of execution steps */
  plan: Step[];
  /** Estimated time to complete in minutes */
  estimated_minutes: number;
}

/**
 * Status of a step execution.
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Context provided to the conductor for classification.
 */
export interface ClassificationContext {
  /** Active project path, if any */
  projectPath?: string;
  /** Recent conversation history summary */
  conversationSummary?: string;
  /** Available CLI tools */
  availableTools?: string[];
  /** User preferences */
  preferences?: Record<string, unknown>;
}

/**
 * Internal Codex message format.
 */
interface CodexMessage {
  type: string;
  thread_id?: string;
  item?: {
    type: string;
    text?: string;
  };
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * State key for persisting session ID.
 */
const SESSION_STATE_KEY = 'conductor_session_id';

/**
 * System prompt for the router Codex session (~600 tokens).
 */
const ROUTER_SYSTEM_PROMPT = `You are the Unified Terminal Router, an intelligent task classifier and planner.

## Your Role
Analyze user requests and create execution plans that route work to the appropriate targets.

## Available Targets

### WEB (ChatGPT Browser)
- General conversation and Q&A
- Image generation (DALL-E)
- Research and information lookup
- Text analysis and summarization
- Creative writing
- Explanations and teaching

### CLI (Local Tools)
- codex: Code generation, file operations, project scaffolding
- claude-code: Complex coding tasks, multi-file changes
- gsd: Task orchestration, project planning, milestone tracking
- git: Version control operations
- npm/yarn: Package management
- docker: Container operations
- shell: General terminal commands

### SERVICE (External Accounts)
- vercel: Deployment
- github: Repository operations
- supabase: Database operations
- stripe: Payment integration
- aws/gcp: Cloud services

## Classification Rules

1. TRIVIAL (route: web, complexity: trivial)
   - Greetings, confirmations, simple questions
   - Single-step web interactions

2. SIMPLE (route: web OR cli, complexity: simple)
   - Single-tool operations
   - No dependencies between steps
   - Estimated < 5 minutes

3. MEDIUM (route: cli OR hybrid, complexity: medium)
   - 2-5 step operations
   - Some step dependencies
   - Estimated 5-30 minutes

4. COMPLEX (route: hybrid, complexity: complex)
   - Multi-step DAG with dependencies
   - Multiple targets involved
   - Estimated > 30 minutes

## Output Format
Always respond with valid JSON only, no markdown code blocks:

{
  "route": "web" | "cli" | "hybrid",
  "complexity": "trivial" | "simple" | "medium" | "complex",
  "plan": [
    {
      "id": 1,
      "target": "web" | "cli" | "service",
      "action": "action_name",
      "detail": "What to do",
      "waitFor": [],
      "parallel": false
    }
  ],
  "estimated_minutes": 5
}

## Examples

User: "Build a React app with authentication"
{
  "route": "hybrid",
  "complexity": "complex",
  "plan": [
    {"id": 1, "target": "cli", "action": "scaffold", "detail": "Create React app with Vite", "waitFor": [], "parallel": false},
    {"id": 2, "target": "cli", "action": "install", "detail": "Install auth dependencies", "waitFor": [1], "parallel": false},
    {"id": 3, "target": "cli", "action": "generate", "detail": "Create auth components", "waitFor": [2], "parallel": false},
    {"id": 4, "target": "service", "action": "configure", "detail": "Set up Supabase auth", "waitFor": [], "parallel": true},
    {"id": 5, "target": "cli", "action": "integrate", "detail": "Connect frontend to auth service", "waitFor": [3, 4], "parallel": false}
  ],
  "estimated_minutes": 45
}

User: "What's the weather like?"
{
  "route": "web",
  "complexity": "trivial",
  "plan": [
    {"id": 1, "target": "web", "action": "query", "detail": "Ask ChatGPT about weather", "waitFor": [], "parallel": false}
  ],
  "estimated_minutes": 1
}

Respond ONLY with the JSON execution plan. No explanations.`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape a string for safe shell usage.
 * Prevents command injection.
 */
export function escapeForShell(str: string): string {
  // Replace single quotes with escaped version
  // Wrap in single quotes for safety
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Build enhanced environment with brew/nvm paths.
 * Copied pattern from codex-adapter.ts.
 */
function buildEnv(): NodeJS.ProcessEnv {
  const home = os.homedir();
  const nvmDir = path.join(home, '.nvm');
  const brewPrefix = os.arch() === 'arm64' ? '/opt/homebrew' : '/usr/local';

  let nvmNodeBin = '';
  try {
    const nodeVersions = path.join(nvmDir, 'versions', 'node');
    if (fs.existsSync(nodeVersions)) {
      const versions = fs.readdirSync(nodeVersions).sort().reverse();
      if (versions.length > 0) {
        nvmNodeBin = path.join(nodeVersions, versions[0], 'bin');
      }
    }
  } catch {
    // Ignore errors
  }

  return {
    ...process.env,
    HOME: home,
    PATH: [
      nvmNodeBin,
      `${brewPrefix}/bin`,
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      process.env.PATH || '',
    ].filter(Boolean).join(':'),
  };
}

/**
 * Parse JSON from Codex response, handling potential markdown wrapping.
 */
function parseExecutionPlan(text: string): ExecutionPlan | null {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try to find JSON object in text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    return null;
  }
}

// ============================================================================
// CONDUCTOR CLASS
// ============================================================================

/**
 * Conductor - Manages persistent Codex routing session.
 *
 * Events:
 * - 'session-started': (sessionId: string) - New session created
 * - 'session-resumed': (sessionId: string) - Existing session resumed
 * - 'classification-complete': (plan: ExecutionPlan) - Classification done
 * - 'error': (error: Error) - Error occurred
 */
export class Conductor extends EventEmitter {
  private sessionId: string | null = null;
  private stateManager: StateManager;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.stateManager = getStateManager();
    this.loadSessionId();
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Load session ID from persistent state.
   */
  private loadSessionId(): void {
    try {
      const stateDir = this.stateManager.getStateDirectory();
      const conductorStatePath = path.join(stateDir, 'conductor.json');

      if (fs.existsSync(conductorStatePath)) {
        const data = JSON.parse(fs.readFileSync(conductorStatePath, 'utf-8'));
        if (data.sessionId) {
          this.sessionId = data.sessionId;
          console.log('[Conductor] Loaded existing session:', this.sessionId);
        }
      }
    } catch (error) {
      console.error('[Conductor] Failed to load session ID:', error);
    }
  }

  /**
   * Save session ID to persistent state.
   */
  private saveSessionId(): void {
    try {
      const stateDir = this.stateManager.getStateDirectory();
      const conductorStatePath = path.join(stateDir, 'conductor.json');

      const data = {
        sessionId: this.sessionId,
        lastUpdated: new Date().toISOString(),
      };

      fs.writeFileSync(conductorStatePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('[Conductor] Saved session ID:', this.sessionId);
    } catch (error) {
      console.error('[Conductor] Failed to save session ID:', error);
    }
  }

  /**
   * Get the current session ID, if any.
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if a session is active.
   */
  hasSession(): boolean {
    return this.sessionId !== null;
  }

  /**
   * Initialize or resume the conductor session.
   * Creates a new Codex session with the router system prompt.
   */
  async initialize(): Promise<void> {
    // If already initializing, wait for that to complete
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        if (this.sessionId) {
          // Try to resume existing session
          const resumed = await this.verifySession();
          if (resumed) {
            console.log('[Conductor] Resumed existing session');
            this.emit('session-resumed', this.sessionId);
            conductorEvents.sessionStart(this.sessionId, true);
            return;
          }
          // Session invalid, create new one
          console.log('[Conductor] Existing session invalid, creating new');
          this.sessionId = null;
        }

        // Create new session
        await this.createSession();
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Verify that an existing session is still valid.
   */
  private async verifySession(): Promise<boolean> {
    if (!this.sessionId) return false;

    const sessionId = this.sessionId; // Capture for closure

    return new Promise((resolve) => {
      // Try to send a simple message to the session
      const proc = spawn('codex', ['resume', sessionId, '--json'], {
        env: buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let hasError = false;

      proc.stdin?.write('ping');
      proc.stdin?.end();

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.includes('error') || text.includes('not found') || text.includes('invalid')) {
          hasError = true;
        }
      });

      proc.on('close', (code: number | null) => {
        if (code === 0 && !hasError && output.includes('thread_id')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 10000);
    });
  }

  /**
   * Create a new Codex session with the router system prompt.
   */
  private async createSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['exec', '--json', '--skip-git-repo-check'];

      const proc = spawn('codex', args, {
        env: buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let threadId = '';

      // Send system prompt to initialize the session
      const initMessage = `SYSTEM: ${ROUTER_SYSTEM_PROMPT}\n\nRespond with: {"status": "ready"}`;
      proc.stdin?.write(initMessage);
      proc.stdin?.end();

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();

        // Parse JSON lines to find thread ID
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as CodexMessage;
              if (msg.type === 'thread.started' && msg.thread_id) {
                threadId = msg.thread_id;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        if (!text.includes('Reading prompt from stdin')) {
          console.error('[Conductor] stderr:', text);
        }
      });

      proc.on('close', (code: number | null) => {
        if (code === 0 && threadId) {
          this.sessionId = threadId;
          this.saveSessionId();
          console.log('[Conductor] Created new session:', threadId);
          this.emit('session-started', threadId);
          conductorEvents.sessionStart(threadId, false);
          resolve();
        } else {
          const error = new Error(`Failed to create session (code: ${code})`);
          this.emit('error', error);
          reject(error);
        }
      });

      proc.on('error', (err: Error) => {
        this.emit('error', err);
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!threadId) {
          proc.kill();
          const error = new Error('Session creation timed out');
          this.emit('error', error);
          reject(error);
        }
      }, 30000);
    });
  }

  /**
   * Reset the session (for testing or recovery).
   */
  async resetSession(): Promise<void> {
    this.sessionId = null;
    this.saveSessionId();
    await this.initialize();
  }

  // ==========================================================================
  // CLASSIFICATION
  // ==========================================================================

  /**
   * Classify a user message and return an execution plan.
   *
   * @param message - User's input message
   * @param context - Additional context for classification
   * @returns Execution plan with steps
   */
  async classify(
    message: string,
    context?: ClassificationContext
  ): Promise<ExecutionPlan> {
    // Ensure session is initialized
    if (!this.sessionId) {
      await this.initialize();
    }

    // Emit classification start event
    conductorEvents.classifyStart(message);

    return new Promise((resolve, reject) => {
      // Build the classification prompt
      let prompt = `CLASSIFY: ${message}`;

      if (context) {
        const contextParts: string[] = [];
        if (context.projectPath) {
          contextParts.push(`Project: ${context.projectPath}`);
        }
        if (context.availableTools?.length) {
          contextParts.push(`Available tools: ${context.availableTools.join(', ')}`);
        }
        if (context.conversationSummary) {
          contextParts.push(`Context: ${context.conversationSummary}`);
        }
        if (contextParts.length > 0) {
          prompt = `${contextParts.join('\n')}\n\n${prompt}`;
        }
      }

      // Use resume to continue the session
      const args = this.sessionId
        ? ['resume', this.sessionId, '--json']
        : ['exec', '--json', '--skip-git-repo-check'];

      const proc = spawn('codex', args, {
        env: buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let responseText = '';

      proc.stdin?.write(prompt);
      proc.stdin?.end();

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();

        // Parse JSON lines to extract response
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as CodexMessage;
              if (msg.type === 'item.completed' && msg.item?.type === 'agent_message') {
                responseText = msg.item.text || '';
              }
              // Capture thread ID if this is a new session
              if (msg.type === 'thread.started' && msg.thread_id && !this.sessionId) {
                this.sessionId = msg.thread_id;
                this.saveSessionId();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        if (!text.includes('Reading prompt from stdin')) {
          console.error('[Conductor] classify stderr:', text);
        }
      });

      proc.on('close', (code: number | null) => {
        if (code === 0 && responseText) {
          const plan = parseExecutionPlan(responseText);
          if (plan) {
            this.emit('classification-complete', plan);
            conductorEvents.classifyComplete(`plan_${Date.now()}`, plan.plan.length);
            conductorEvents.planReady(`plan_${Date.now()}`, `${plan.complexity} task with ${plan.plan.length} steps`);
            resolve(plan);
          } else {
            // Fallback: create a simple web route
            const fallbackPlan: ExecutionPlan = {
              route: 'web',
              complexity: 'simple',
              plan: [{
                id: 1,
                target: 'web',
                action: 'query',
                detail: message,
                waitFor: [],
                parallel: false,
              }],
              estimated_minutes: 1,
            };
            console.warn('[Conductor] Could not parse plan, using fallback');
            resolve(fallbackPlan);
          }
        } else {
          const error = new Error(`Classification failed (code: ${code})`);
          this.emit('error', error);
          conductorEvents.error(error.message);
          reject(error);
        }
      });

      proc.on('error', (err: Error) => {
        this.emit('error', err);
        conductorEvents.error(err.message);
        reject(err);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        proc.kill();
        const error = new Error('Classification timed out');
        this.emit('error', error);
        reject(error);
      }, 60000);
    });
  }

  // ==========================================================================
  // STATUS REPORTING
  // ==========================================================================

  /**
   * Report the status of a step back to the conductor.
   * Used for re-planning if a step fails or completes with unexpected results.
   *
   * @param stepId - ID of the step
   * @param status - Current status
   * @param detail - Additional detail about the status
   * @returns Updated execution plan if re-planning is needed
   */
  async reportStatus(
    stepId: number,
    status: StepStatus,
    detail?: string
  ): Promise<ExecutionPlan | null> {
    if (!this.sessionId) {
      console.warn('[Conductor] No session for status report');
      return null;
    }

    // Only re-plan on failures or unexpected completions
    if (status !== 'failed') {
      return null;
    }

    // Emit replan event
    conductorEvents.replan(detail || 'Step failed', stepId);

    const sessionId = this.sessionId; // Capture for closure

    return new Promise((resolve) => {
      const prompt = `REPLAN: Step ${stepId} failed. ${detail || 'Unknown error'}\n\nProvide updated execution plan.`;

      const proc = spawn('codex', ['resume', sessionId, '--json'], {
        env: buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let responseText = '';

      proc.stdin?.write(prompt);
      proc.stdin?.end();

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();

        const lines = output.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as CodexMessage;
              if (msg.type === 'item.completed' && msg.item?.type === 'agent_message') {
                responseText = msg.item.text || '';
              }
            } catch {
              // Ignore
            }
          }
        }
      });

      proc.on('close', () => {
        if (responseText) {
          const plan = parseExecutionPlan(responseText);
          resolve(plan);
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => {
        resolve(null);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 30000);
    });
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up resources.
   */
  cleanup(): void {
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let conductorInstance: Conductor | null = null;

/**
 * Get the singleton Conductor instance.
 */
export function getConductor(): Conductor {
  if (!conductorInstance) {
    conductorInstance = new Conductor();
  }
  return conductorInstance;
}

/**
 * Clean up the conductor instance.
 */
export function cleanupConductor(): void {
  if (conductorInstance) {
    conductorInstance.cleanup();
    conductorInstance = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ROUTER_SYSTEM_PROMPT };
