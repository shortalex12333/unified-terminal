/**
 * Codex Adapter - Interface for Codex CLI
 *
 * Handles spawning Codex, parsing JSON output, and streaming responses.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// TYPES
// ============================================================================

export interface CodexMessage {
  type: 'thread.started' | 'turn.started' | 'item.completed' | 'turn.completed' | 'error';
  thread_id?: string;
  item?: {
    id: string;
    type: 'reasoning' | 'agent_message' | 'tool_call' | 'tool_result';
    text?: string;
    name?: string;
    arguments?: string;
    output?: string;
  };
  usage?: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

export interface CodexResult {
  success: boolean;
  threadId: string;
  messages: CodexMessage[];
  reasoning: string[];
  response: string;
  codeBlocks: string[];
  toolCalls: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}

export interface CodexOptions {
  model?: string;
  workingDir?: string;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  timeout?: number;
  fullAuto?: boolean;
}

// ============================================================================
// CODEX ADAPTER CLASS
// ============================================================================

export class CodexAdapter extends EventEmitter {
  private process: ChildProcess | null = null;
  private messages: CodexMessage[] = [];
  private buffer: string = '';

  constructor() {
    super();
  }

  /**
   * Build enhanced environment with brew/nvm paths
   */
  private buildEnv(): NodeJS.ProcessEnv {
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
    } catch {}

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
   * Execute a prompt with Codex
   */
  async execute(prompt: string, options: CodexOptions = {}): Promise<CodexResult> {
    this.messages = [];
    this.buffer = '';

    const args = ['exec', '--json'];

    if (options.model) {
      args.push('-m', options.model);
    }

    if (options.workingDir) {
      args.push('-C', options.workingDir);
    }

    if (options.sandbox) {
      args.push('-s', options.sandbox);
    }

    if (options.fullAuto) {
      args.push('--full-auto');
    }

    // Skip git repo check for simple prompts
    args.push('--skip-git-repo-check');

    return new Promise((resolve) => {
      const timeout = options.timeout || 120000; // 2 minute default
      let timeoutId: NodeJS.Timeout;

      this.process = spawn('codex', args, {
        env: this.buildEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Send prompt to stdin
      this.process.stdin?.write(prompt);
      this.process.stdin?.end();

      // Handle stdout (JSON lines)
      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Ignore "Reading prompt from stdin..." message
        if (!text.includes('Reading prompt from stdin')) {
          console.error('[Codex] stderr:', text);
        }
      });

      // Handle completion
      this.process.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(this.buildResult(code === 0));
      });

      // Handle errors
      this.process.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          threadId: '',
          messages: this.messages,
          reasoning: [],
          response: '',
          codeBlocks: [],
          toolCalls: [],
          usage: { inputTokens: 0, outputTokens: 0 },
          error: err.message,
        });
      });

      // Timeout
      timeoutId = setTimeout(() => {
        this.process?.kill();
        resolve({
          ...this.buildResult(false),
          error: 'Execution timed out',
        });
      }, timeout);
    });
  }

  /**
   * Process buffered data for complete JSON lines
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as CodexMessage;
          this.messages.push(message);
          this.emit('message', message);

          // Emit specific events
          if (message.type === 'item.completed' && message.item) {
            if (message.item.type === 'agent_message') {
              this.emit('response', message.item.text);
            } else if (message.item.type === 'reasoning') {
              this.emit('reasoning', message.item.text);
            } else if (message.item.type === 'tool_call') {
              this.emit('tool_call', message.item);
            }
          }
        } catch (e) {
          // Not JSON, might be raw output
          console.log('[Codex] non-JSON:', line);
        }
      }
    }
  }

  /**
   * Build result object from collected messages
   */
  private buildResult(success: boolean): CodexResult {
    let threadId = '';
    const reasoning: string[] = [];
    const responses: string[] = [];
    const codeBlocks: string[] = [];
    const toolCalls: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    for (const msg of this.messages) {
      if (msg.type === 'thread.started' && msg.thread_id) {
        threadId = msg.thread_id;
      }

      if (msg.type === 'item.completed' && msg.item) {
        if (msg.item.type === 'reasoning' && msg.item.text) {
          reasoning.push(msg.item.text);
        }
        if (msg.item.type === 'agent_message' && msg.item.text) {
          responses.push(msg.item.text);

          // Extract code blocks
          const codeMatches = msg.item.text.matchAll(/```[\w]*\n([\s\S]*?)```/g);
          for (const match of codeMatches) {
            codeBlocks.push(match[1].trim());
          }
        }
        if (msg.item.type === 'tool_call' && msg.item.name) {
          toolCalls.push(`${msg.item.name}: ${msg.item.arguments || ''}`);
        }
      }

      if (msg.type === 'turn.completed' && msg.usage) {
        inputTokens += msg.usage.input_tokens;
        outputTokens += msg.usage.output_tokens;
      }
    }

    return {
      success,
      threadId,
      messages: this.messages,
      reasoning,
      response: responses.join('\n\n'),
      codeBlocks,
      toolCalls,
      usage: { inputTokens, outputTokens },
    };
  }

  /**
   * Cancel current execution
   */
  cancel(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  /**
   * Check if Codex is installed
   */
  static async isInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', ['codex']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Get Codex version
   */
  static async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('codex', ['--version']);
      let output = '';
      proc.stdout?.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });
      proc.on('error', () => resolve(null));
    });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let codexAdapter: CodexAdapter | null = null;

export function getCodexAdapter(): CodexAdapter {
  if (!codexAdapter) {
    codexAdapter = new CodexAdapter();
  }
  return codexAdapter;
}

export function cleanupCodexAdapter(): void {
  if (codexAdapter) {
    codexAdapter.cancel();
    codexAdapter.removeAllListeners();
    codexAdapter = null;
  }
}
