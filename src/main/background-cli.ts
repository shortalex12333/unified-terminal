/**
 * Background CLI Runner
 *
 * Runs CLI tools (Codex, Claude, Gemini) in the background
 * without visible terminal windows. Pipes output to renderer via IPC.
 */

import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export type Provider = 'codex' | 'claude-code' | 'gemini';

interface CLIConfig {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  /** If true, message is appended to args. If false, piped to stdin. */
  appendMessage?: boolean;
}

const CLI_CONFIGS: Record<Provider, CLIConfig> = {
  'codex': {
    command: 'codex',
    args: ['--print', '--full-auto'],
    appendMessage: true,
  },
  'claude-code': {
    command: 'claude',
    // Use --print for non-interactive one-shot mode
    // Use -p for "print mode" which outputs response and exits
    args: ['-p'],
    appendMessage: true,
  },
  'gemini': {
    command: 'gemini',
    // Gemini CLI uses positional prompt argument
    args: [],
    appendMessage: true,
  },
};

export class BackgroundCLI {
  private processes: Map<Provider, ChildProcess> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const home = os.homedir();
    const nvmDir = path.join(home, '.nvm');
    const brewPrefix = os.arch() === 'arm64' ? '/opt/homebrew' : '/usr/local';

    // Find nvm node path
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
      // Ignore errors when reading nvm versions
    }

    return {
      ...process.env,
      HOME: home,
      NVM_DIR: nvmDir,
      PATH: [
        nvmNodeBin,
        path.join(home, '.npm-global', 'bin'),
        `${brewPrefix}/bin`,
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        process.env.PATH || '',
      ].filter(Boolean).join(':'),
    };
  }

  async send(provider: Provider, message: string): Promise<void> {
    const config = CLI_CONFIGS[provider];

    // Kill existing process for this provider
    this.kill(provider);

    // Build args - append message if config says to, otherwise we'll pipe it
    const args = config.appendMessage !== false
      ? [...config.args, message]
      : [...config.args];

    console.log(`[BackgroundCLI] Spawning ${config.command} with args:`, args);

    const proc = spawn(config.command, args, {
      env: this.buildEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true, // Hide on Windows
      detached: false,
    });

    this.processes.set(provider, proc);

    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      buffer += chunk;

      // Send chunk to renderer
      this.mainWindow?.webContents.send('cli:output', {
        provider,
        chunk,
        done: false,
      });
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      // Send errors too
      this.mainWindow?.webContents.send('cli:output', {
        provider,
        chunk: `[stderr] ${chunk}`,
        done: false,
      });
    });

    proc.on('close', (code) => {
      console.log(`[BackgroundCLI] ${provider} exited with code ${code}`);
      this.processes.delete(provider);

      this.mainWindow?.webContents.send('cli:output', {
        provider,
        chunk: '',
        done: true,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      console.error(`[BackgroundCLI] ${provider} error:`, err);
      this.mainWindow?.webContents.send('cli:output', {
        provider,
        chunk: `Error: ${err.message}`,
        done: true,
        error: err.message,
      });
    });
  }

  kill(provider: Provider): void {
    const proc = this.processes.get(provider);
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      this.processes.delete(provider);
    }
  }

  killAll(): void {
    const providers = Array.from(this.processes.keys());
    for (const provider of providers) {
      this.kill(provider);
    }
  }
}

// Singleton instance
export const backgroundCLI = new BackgroundCLI();
