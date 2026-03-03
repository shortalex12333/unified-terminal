/**
 * Auto-Installer - Installs missing CLI tools with progress reporting
 *
 * Installs tools in dependency order: Homebrew -> Node.js -> Python -> Git -> npm packages
 * Provides progress events via callbacks for UI integration.
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { scanSystem, SystemProfile } from './system-scanner';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface InstallStep {
  name: string;
  key: string;
  check: string;
  install: string;
  weight: number; // Percentage of total progress this step represents
  requiresBrew?: boolean;
  requiresNode?: boolean;
}

export interface InstallProgress {
  currentStep: string;
  stepIndex: number;
  totalSteps: number;
  percentComplete: number;
  status: 'pending' | 'installing' | 'complete' | 'failed' | 'skipped';
  message?: string;
  error?: string;
}

export interface InstallResult {
  success: boolean;
  installedTools: string[];
  failedTools: { name: string; error: string }[];
  skippedTools: string[];
  totalTime: number;
}

export type ProgressCallback = (progress: InstallProgress) => void;

// ============================================================================
// INSTALLATION STEPS
// ============================================================================

// Full Homebrew install script URL
const HOMEBREW_INSTALL_URL = 'https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh';

export const INSTALL_STEPS: InstallStep[] = [
  // Step 1: Xcode Command Line Tools (required for everything)
  {
    name: 'Xcode CLT',
    key: 'xcodeClt',
    check: 'xcode-select -p 2>/dev/null',
    install: 'xcode-select --install 2>/dev/null || true',
    weight: 5,
    // Note: This opens a macOS dialog. User must click Install.
  },
  // Step 2: Homebrew
  {
    name: 'Homebrew',
    key: 'homebrew',
    check: 'which brew || test -f /opt/homebrew/bin/brew || test -f /usr/local/bin/brew',
    install: `/bin/bash -c "$(curl -fsSL ${HOMEBREW_INSTALL_URL})"`,
    weight: 12,
  },
  // Step 3: Node.js (via brew, simpler than nvm for auto-install)
  {
    name: 'Node.js',
    key: 'node',
    check: 'node --version',
    install: 'brew install node@20 && brew link --overwrite node@20',
    weight: 12,
    requiresBrew: true,
  },
  // Step 4: Python
  {
    name: 'Python',
    key: 'python',
    check: 'python3 --version',
    install: 'brew install python@3.12',
    weight: 8,
    requiresBrew: true,
  },
  // Step 5: Git
  {
    name: 'Git',
    key: 'git',
    check: 'git --version',
    install: 'brew install git',
    weight: 5,
    requiresBrew: true,
  },
  // Step 6: Codex CLI
  {
    name: 'Codex CLI',
    key: 'codex',
    check: 'npm list -g @openai/codex --depth=0 2>/dev/null | grep -q codex || codex --version 2>/dev/null',
    install: 'npm install -g @openai/codex',
    weight: 10,
    requiresNode: true,
  },
  // Step 7: Claude Code
  {
    name: 'Claude Code',
    key: 'claudeCode',
    check: 'npm list -g @anthropic-ai/claude-code --depth=0 2>/dev/null | grep -q claude || claude --version 2>/dev/null',
    install: 'npm install -g @anthropic-ai/claude-code',
    weight: 10,
    requiresNode: true,
  },
  // Step 8: GSD
  {
    name: 'GSD',
    key: 'gsd',
    check: 'npm list -g gsd --depth=0 2>/dev/null | grep -q gsd || gsd --version 2>/dev/null',
    install: 'npm install -g gsd',
    weight: 10,
    requiresNode: true,
  },
  // Step 9: MCP Servers (optional, parallel install)
  {
    name: 'MCP Servers',
    key: 'mcpServers',
    check: 'npm list -g @anthropic-ai/mcp-server-filesystem --depth=0 2>/dev/null | grep -q mcp',
    install: 'npm install -g @anthropic-ai/mcp-server-filesystem @anthropic-ai/mcp-server-memory 2>/dev/null || true',
    weight: 8,
    requiresNode: true,
  },
  // Step 10: Browser-Use (Python automation)
  {
    name: 'Browser-Use',
    key: 'browserUse',
    check: 'pip3 show browser-use 2>/dev/null',
    install: 'pip3 install browser-use && python3 -m playwright install chromium 2>/dev/null || true',
    weight: 10,
    requiresNode: true, // Actually requires Python but grouping with optional tools
  },
  // Step 11: Playwright (JS automation)
  {
    name: 'Playwright',
    key: 'playwright',
    check: 'npx playwright --version 2>/dev/null',
    install: 'npm install -g playwright && npx playwright install chromium',
    weight: 10,
    requiresNode: true,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build comprehensive environment with nvm, brew, and npm-global paths.
 * This is critical for finding tools installed via nvm or brew in child processes.
 */
function getEnhancedEnv(): NodeJS.ProcessEnv {
  const home = os.homedir();
  const nvmDir = path.join(home, '.nvm');
  const brewPrefix = os.arch() === 'arm64' ? '/opt/homebrew' : '/usr/local';

  // Find the actual nvm node version directory
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
    // nvm not installed, that's fine
  }

  const npmGlobal = path.join(home, '.npm-global', 'bin');

  // Build PATH with priority order: nvm -> npm-global -> brew -> system
  const pathParts = [
    nvmNodeBin,
    npmGlobal,
    `${brewPrefix}/bin`,
    `${brewPrefix}/sbin`,
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    process.env.PATH || '',
  ].filter(Boolean);

  return {
    ...process.env,
    HOME: home,
    NVM_DIR: nvmDir,
    PATH: pathParts.join(':'),
    // Prevent Homebrew from prompting
    NONINTERACTIVE: '1',
    HOMEBREW_NO_ANALYTICS: '1',
    HOMEBREW_NO_AUTO_UPDATE: '1',
  };
}

/**
 * Check if a tool is already installed.
 */
async function isInstalled(checkCommand: string): Promise<boolean> {
  try {
    await execAsync(checkCommand, {
      timeout: 10000,
      env: getEnhancedEnv(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run an install command with live output streaming.
 * Returns a promise that resolves when installation completes.
 */
function runInstallCommand(
  command: string,
  onOutput?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    console.log(`[Auto-Installer] Running: ${command}`);

    // Use spawn for better control over the process
    const child: ChildProcess = spawn('bash', ['-c', command], {
      env: getEnhancedEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      if (onOutput) {
        onOutput(text);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      // Also send stderr to output callback (many tools log to stderr)
      if (onOutput) {
        onOutput(text);
      }
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: stderr || stdout || `Process exited with code ${code}`,
        });
      }
    });

    child.on('error', (err: Error) => {
      resolve({
        success: false,
        error: err.message,
      });
    });

    // Timeout after 10 minutes (some installs take a while)
    setTimeout(() => {
      if (!child.killed) {
        child.kill();
        resolve({
          success: false,
          error: 'Installation timed out after 10 minutes',
        });
      }
    }, 600000);
  });
}

// ============================================================================
// MAIN INSTALLER
// ============================================================================

/**
 * Install all missing tools with progress reporting.
 *
 * @param onProgress - Callback function for progress updates
 * @param specificTools - Optional array of tool keys to install (installs all missing if not provided)
 * @returns InstallResult with success status and details
 */
export async function installMissingTools(
  onProgress?: ProgressCallback,
  specificTools?: string[]
): Promise<InstallResult> {
  const startTime = Date.now();
  const installedTools: string[] = [];
  const failedTools: { name: string; error: string }[] = [];
  const skippedTools: string[] = [];

  console.log('[Auto-Installer] Starting installation process...');

  // Determine which steps to run
  let stepsToRun = INSTALL_STEPS;

  if (specificTools && specificTools.length > 0) {
    stepsToRun = INSTALL_STEPS.filter(step =>
      specificTools.includes(step.key) || specificTools.includes(step.name)
    );
  }

  // Calculate total weight for percentage calculation
  const totalWeight = stepsToRun.reduce((sum, step) => sum + step.weight, 0);
  let completedWeight = 0;

  // Track what we've installed this session
  let brewInstalled = await isInstalled('which brew');
  let nodeInstalled = await isInstalled('node --version');

  for (let i = 0; i < stepsToRun.length; i++) {
    const step = stepsToRun[i];

    // Report starting this step
    const progress: InstallProgress = {
      currentStep: step.name,
      stepIndex: i,
      totalSteps: stepsToRun.length,
      percentComplete: Math.round((completedWeight / totalWeight) * 100),
      status: 'pending',
      message: `Checking ${step.name}...`,
    };

    if (onProgress) {
      onProgress(progress);
    }

    // Check dependencies
    if (step.requiresBrew && !brewInstalled) {
      console.log(`[Auto-Installer] Skipping ${step.name}: Homebrew not available`);
      progress.status = 'skipped';
      progress.message = `Skipped: Homebrew required but not available`;
      skippedTools.push(step.name);

      if (onProgress) {
        onProgress(progress);
      }

      completedWeight += step.weight;
      continue;
    }

    if (step.requiresNode && !nodeInstalled) {
      console.log(`[Auto-Installer] Skipping ${step.name}: Node.js not available`);
      progress.status = 'skipped';
      progress.message = `Skipped: Node.js required but not available`;
      skippedTools.push(step.name);

      if (onProgress) {
        onProgress(progress);
      }

      completedWeight += step.weight;
      continue;
    }

    // Check if already installed
    const alreadyInstalled = await isInstalled(step.check);

    if (alreadyInstalled) {
      console.log(`[Auto-Installer] ${step.name} already installed`);
      progress.status = 'skipped';
      progress.message = `${step.name} is already installed`;
      skippedTools.push(step.name);

      if (onProgress) {
        onProgress(progress);
      }

      completedWeight += step.weight;

      // Update our tracking
      if (step.key === 'homebrew') brewInstalled = true;
      if (step.key === 'node') nodeInstalled = true;

      continue;
    }

    // Install the tool
    progress.status = 'installing';
    progress.message = `Installing ${step.name}...`;

    if (onProgress) {
      onProgress(progress);
    }

    const result = await runInstallCommand(step.install, (output) => {
      // Update progress with output (optional: could parse for more detail)
      if (onProgress) {
        onProgress({
          ...progress,
          message: `Installing ${step.name}... (see console for details)`,
        });
      }
    });

    if (result.success) {
      console.log(`[Auto-Installer] Successfully installed ${step.name}`);
      progress.status = 'complete';
      progress.message = `${step.name} installed successfully`;
      installedTools.push(step.name);

      // Update our tracking
      if (step.key === 'homebrew') brewInstalled = true;
      if (step.key === 'node') nodeInstalled = true;
    } else {
      console.error(`[Auto-Installer] Failed to install ${step.name}:`, result.error);
      progress.status = 'failed';
      progress.message = `Failed to install ${step.name}`;
      progress.error = result.error;
      failedTools.push({ name: step.name, error: result.error || 'Unknown error' });
    }

    if (onProgress) {
      onProgress(progress);
    }

    completedWeight += step.weight;
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      currentStep: 'Complete',
      stepIndex: stepsToRun.length,
      totalSteps: stepsToRun.length,
      percentComplete: 100,
      status: failedTools.length === 0 ? 'complete' : 'failed',
      message: failedTools.length === 0
        ? 'All tools installed successfully'
        : `Installation complete with ${failedTools.length} failure(s)`,
    });
  }

  const totalTime = Date.now() - startTime;

  const installResult: InstallResult = {
    success: failedTools.length === 0,
    installedTools,
    failedTools,
    skippedTools,
    totalTime,
  };

  console.log('[Auto-Installer] Installation complete:', installResult);

  return installResult;
}

/**
 * Install a single tool.
 */
export async function installTool(
  toolKey: string,
  onProgress?: ProgressCallback
): Promise<InstallResult> {
  return installMissingTools(onProgress, [toolKey]);
}

/**
 * Retry installing failed tools from a previous result.
 */
export async function retryFailedInstalls(
  previousResult: InstallResult,
  onProgress?: ProgressCallback
): Promise<InstallResult> {
  const toolsToRetry = previousResult.failedTools.map(f => f.name);
  return installMissingTools(onProgress, toolsToRetry);
}

/**
 * Get the installation order for a set of tools (respects dependencies).
 */
export function getInstallOrder(toolKeys: string[]): InstallStep[] {
  return INSTALL_STEPS.filter(step =>
    toolKeys.includes(step.key) || toolKeys.includes(step.name)
  );
}

/**
 * Calculate total install time estimate based on tools to install.
 * Returns estimated seconds.
 */
export function estimateInstallTime(toolKeys: string[]): number {
  const steps = getInstallOrder(toolKeys);
  // Rough estimates in seconds per tool
  const estimates: Record<string, number> = {
    xcodeClt: 300,     // 5 min - user must click dialog
    homebrew: 180,     // 3 min
    node: 60,          // 1 min
    python: 45,        // 45 sec
    git: 15,           // 15 sec
    codex: 30,         // 30 sec
    claudeCode: 30,    // 30 sec
    gsd: 30,           // 30 sec
    mcpServers: 45,    // 45 sec
    browserUse: 120,   // 2 min (includes playwright browsers)
    playwright: 120,   // 2 min (chromium download)
  };

  return steps.reduce((total, step) => {
    return total + (estimates[step.key] || 30);
  }, 0);
}
