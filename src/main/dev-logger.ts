/**
 * Backend Terminal Logger - Streams raw CLI content to renderer
 *
 * Shows the actual CLI terminal experience:
 * - Agent spawns (Codex, Claude Code, etc.)
 * - Prompts being sent (stdin)
 * - Raw output streams (stdout/stderr)
 * - Process lifecycle events
 *
 * This is for creators to see exactly what's happening with backend agents.
 */

import { BrowserWindow } from 'electron';

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalLine {
  id: string;
  timestamp: Date;
  sessionId: string;
  type: 'spawn' | 'stdin' | 'stdout' | 'stderr' | 'exit' | 'system';
  content: string;
  tool?: string;
  pid?: number;
  exitCode?: number;
}

export interface AgentSession {
  id: string;
  tool: string;
  command: string;
  args: string[];
  pid?: number;
  startedAt: Date;
  endedAt?: Date;
  status: 'running' | 'done' | 'failed';
}

// =============================================================================
// BACKEND TERMINAL LOGGER
// =============================================================================

class BackendTerminal {
  private static instance: BackendTerminal | null = null;
  private mainWindow: BrowserWindow | null = null;
  private enabled = true;
  private sessions: Map<string, AgentSession> = new Map();

  private constructor() {}

  static getInstance(): BackendTerminal {
    if (!BackendTerminal.instance) {
      BackendTerminal.instance = new BackendTerminal();
    }
    return BackendTerminal.instance;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Send a terminal line to the renderer
   */
  private send(line: Omit<TerminalLine, 'id' | 'timestamp'>): void {
    if (!this.enabled || !this.mainWindow) return;

    const fullLine: TerminalLine = {
      ...line,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    try {
      this.mainWindow.webContents.send('terminal-line', fullLine);
    } catch (err) {
      // Window might be closed
    }
  }

  /**
   * Log agent spawn - when a CLI tool is launched
   */
  agentSpawn(sessionId: string, tool: string, command: string, args: string[], pid?: number): void {
    const session: AgentSession = {
      id: sessionId,
      tool,
      command,
      args,
      pid,
      startedAt: new Date(),
      status: 'running',
    };
    this.sessions.set(sessionId, session);

    const argsStr = args.length > 0 ? ` ${args.join(' ')}` : '';
    this.send({
      sessionId,
      type: 'spawn',
      content: `$ ${command}${argsStr}`,
      tool,
      pid,
    });

    // Also notify about session state
    if (this.mainWindow) {
      try {
        this.mainWindow.webContents.send('agent-session', { action: 'start', session });
      } catch (err) {}
    }
  }

  /**
   * Log stdin - prompt/input sent to the agent
   */
  stdin(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    this.send({
      sessionId,
      type: 'stdin',
      content: content,
      tool: session?.tool,
    });
  }

  /**
   * Log stdout - agent output
   */
  stdout(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    // Don't send empty lines
    if (!content.trim()) return;

    this.send({
      sessionId,
      type: 'stdout',
      content: content,
      tool: session?.tool,
    });
  }

  /**
   * Log stderr - agent errors/warnings
   */
  stderr(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    // Filter out noise
    if (!content.trim()) return;
    if (content.includes('Reading prompt from stdin')) return;

    this.send({
      sessionId,
      type: 'stderr',
      content: content,
      tool: session?.tool,
    });
  }

  /**
   * Log agent exit
   */
  agentExit(sessionId: string, exitCode: number, signal?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endedAt = new Date();
      session.status = exitCode === 0 ? 'done' : 'failed';
    }

    const statusText = exitCode === 0 ? 'completed' : `failed (code: ${exitCode})`;
    this.send({
      sessionId,
      type: 'exit',
      content: `Process ${statusText}${signal ? ` [signal: ${signal}]` : ''}`,
      tool: session?.tool,
      exitCode,
    });

    // Notify about session state
    if (this.mainWindow && session) {
      try {
        this.mainWindow.webContents.send('agent-session', { action: 'end', session });
      } catch (err) {}
    }
  }

  /**
   * Log system message (orchestration events)
   */
  system(content: string): void {
    this.send({
      sessionId: 'system',
      type: 'system',
      content,
    });
  }

  // ==========================================================================
  // CONVENIENCE METHODS (for backwards compatibility with devLog pattern)
  // ==========================================================================

  cli(level: string, message: string, details?: string): void {
    this.system(`[CLI] ${message}${details ? `: ${details}` : ''}`);
  }

  conductor(level: string, message: string, details?: string): void {
    this.system(`[CONDUCTOR] ${message}${details ? `: ${details}` : ''}`);
  }

  scheduler(level: string, message: string, details?: string): void {
    this.system(`[SCHEDULER] ${message}${details ? `: ${details}` : ''}`);
  }

  mcp(level: string, message: string, details?: string): void {
    this.system(`[MCP] ${message}${details ? `: ${details}` : ''}`);
  }

  // Legacy cliProcess method
  cliProcess(event: { action: string; id: string; command: string; pid?: number; success?: boolean }): void {
    if (event.action === 'start') {
      this.system(`Starting: ${event.command}`);
    } else if (event.action === 'end') {
      this.system(`Finished: ${event.command} (${event.success ? 'success' : 'failed'})`);
    }
  }
}

// Export singleton instance
export const backendTerminal = BackendTerminal.getInstance();
export const devLog = backendTerminal; // Alias for backwards compatibility
export function getDevLogger(): BackendTerminal {
  return BackendTerminal.getInstance();
}
