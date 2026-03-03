/**
 * System Scanner - Detects installed CLI tools and system environment
 *
 * Scans for required tools: Homebrew, Git, Node.js, Python, Codex CLI,
 * Claude Code, and GSD. Returns a comprehensive system profile.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface ToolInfo {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
}

export interface SystemProfile {
  platform: string;
  arch: string;
  tools: {
    homebrew: ToolInfo;
    git: ToolInfo;
    node: ToolInfo;
    python: ToolInfo;
    codex: ToolInfo;
    claudeCode: ToolInfo;
    gsd: ToolInfo;
  };
  allInstalled: boolean;
  missingTools: string[];
}

// ============================================================================
// TOOL DETECTION CONFIGURATION
// ============================================================================

interface ToolDetectionConfig {
  name: string;
  key: keyof SystemProfile['tools'];
  whichCommand: string;
  versionCommand: string;
  // Alternative check (e.g., npm global package)
  alternativeCheck?: string;
  // Parser to extract version from output
  versionParser?: (output: string) => string;
}

const TOOL_CONFIGS: ToolDetectionConfig[] = [
  {
    name: 'Homebrew',
    key: 'homebrew',
    whichCommand: 'which brew',
    versionCommand: 'brew --version',
    versionParser: (output) => {
      // "Homebrew 4.2.0" -> "4.2.0"
      const match = output.match(/Homebrew\s+(\d+\.\d+\.\d+)/);
      return match ? match[1] : output.trim().split('\n')[0];
    },
  },
  {
    name: 'Git',
    key: 'git',
    whichCommand: 'which git',
    versionCommand: 'git --version',
    versionParser: (output) => {
      // "git version 2.42.0" -> "2.42.0"
      const match = output.match(/git version\s+(\d+\.\d+\.\d+)/);
      return match ? match[1] : output.trim();
    },
  },
  {
    name: 'Node.js',
    key: 'node',
    whichCommand: 'which node',
    versionCommand: 'node --version',
    versionParser: (output) => {
      // "v20.11.0" -> "20.11.0"
      return output.trim().replace(/^v/, '');
    },
  },
  {
    name: 'Python',
    key: 'python',
    whichCommand: 'which python3',
    versionCommand: 'python3 --version',
    versionParser: (output) => {
      // "Python 3.11.6" -> "3.11.6"
      const match = output.match(/Python\s+(\d+\.\d+\.\d+)/);
      return match ? match[1] : output.trim();
    },
  },
  {
    name: 'Codex CLI',
    key: 'codex',
    whichCommand: 'which codex',
    versionCommand: 'codex --version',
    alternativeCheck: 'npm list -g @openai/codex --depth=0',
    versionParser: (output) => {
      // Handle npm list output: "@openai/codex@1.0.0"
      const npmMatch = output.match(/@openai\/codex@(\d+\.\d+\.\d+)/);
      if (npmMatch) return npmMatch[1];
      // Handle direct version output
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : output.trim();
    },
  },
  {
    name: 'Claude Code',
    key: 'claudeCode',
    whichCommand: 'which claude',
    versionCommand: 'claude --version',
    alternativeCheck: 'npm list -g @anthropic-ai/claude-code --depth=0',
    versionParser: (output) => {
      // Handle npm list output: "@anthropic-ai/claude-code@1.0.0"
      const npmMatch = output.match(/@anthropic-ai\/claude-code@(\d+\.\d+\.\d+)/);
      if (npmMatch) return npmMatch[1];
      // Handle direct version output
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : output.trim();
    },
  },
  {
    name: 'GSD',
    key: 'gsd',
    whichCommand: 'which gsd',
    versionCommand: 'gsd --version',
    alternativeCheck: 'npm list -g gsd --depth=0',
    versionParser: (output) => {
      // Handle npm list output: "gsd@1.0.0"
      const npmMatch = output.match(/gsd@(\d+\.\d+\.\d+)/);
      if (npmMatch) return npmMatch[1];
      // Handle direct version output
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : output.trim();
    },
  },
];

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Execute a shell command and return the output.
 * Returns null if the command fails.
 */
async function runCommand(command: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(command, {
      timeout: 10000, // 10 second timeout
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin`,
      },
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Detect a single tool based on its configuration.
 */
async function detectTool(config: ToolDetectionConfig): Promise<ToolInfo> {
  const toolInfo: ToolInfo = {
    name: config.name,
    installed: false,
  };

  // Try which command first
  const whichResult = await runCommand(config.whichCommand);

  if (whichResult) {
    toolInfo.installed = true;
    toolInfo.path = whichResult;

    // Get version
    const versionResult = await runCommand(config.versionCommand);
    if (versionResult && config.versionParser) {
      toolInfo.version = config.versionParser(versionResult);
    } else if (versionResult) {
      toolInfo.version = versionResult;
    }

    return toolInfo;
  }

  // Try alternative check (npm global packages)
  if (config.alternativeCheck) {
    const altResult = await runCommand(config.alternativeCheck);

    if (altResult && !altResult.includes('(empty)') && !altResult.includes('ERR!')) {
      toolInfo.installed = true;

      if (config.versionParser) {
        toolInfo.version = config.versionParser(altResult);
      }

      // Try to find the path via npm bin
      const npmBinResult = await runCommand('npm bin -g');
      if (npmBinResult) {
        const binName = config.key === 'claudeCode' ? 'claude' :
                        config.key === 'codex' ? 'codex' : 'gsd';
        toolInfo.path = `${npmBinResult}/${binName}`;
      }
    }
  }

  return toolInfo;
}

// ============================================================================
// MAIN SCANNER FUNCTION
// ============================================================================

/**
 * Scan the system for all required tools.
 * Returns a comprehensive SystemProfile.
 */
export async function scanSystem(): Promise<SystemProfile> {
  console.log('[System Scanner] Starting system scan...');

  // Get platform info
  const platform = process.platform;
  const arch = process.arch;

  // Detect all tools in parallel
  const toolResults = await Promise.all(
    TOOL_CONFIGS.map(config => detectTool(config))
  );

  // Build tools object
  const tools: SystemProfile['tools'] = {
    homebrew: toolResults[0],
    git: toolResults[1],
    node: toolResults[2],
    python: toolResults[3],
    codex: toolResults[4],
    claudeCode: toolResults[5],
    gsd: toolResults[6],
  };

  // Calculate missing tools
  const missingTools: string[] = [];
  for (const [key, info] of Object.entries(tools)) {
    if (!info.installed) {
      missingTools.push(info.name);
    }
  }

  const profile: SystemProfile = {
    platform,
    arch,
    tools,
    allInstalled: missingTools.length === 0,
    missingTools,
  };

  console.log('[System Scanner] Scan complete:', {
    platform,
    arch,
    installed: Object.values(tools).filter(t => t.installed).map(t => t.name),
    missing: missingTools,
  });

  return profile;
}

/**
 * Quick check if a specific tool is installed.
 */
export async function isToolInstalled(
  toolKey: keyof SystemProfile['tools']
): Promise<boolean> {
  const config = TOOL_CONFIGS.find(c => c.key === toolKey);
  if (!config) {
    console.error(`[System Scanner] Unknown tool key: ${toolKey}`);
    return false;
  }

  const result = await detectTool(config);
  return result.installed;
}

/**
 * Get tool info for a specific tool.
 */
export async function getToolInfo(
  toolKey: keyof SystemProfile['tools']
): Promise<ToolInfo | null> {
  const config = TOOL_CONFIGS.find(c => c.key === toolKey);
  if (!config) {
    console.error(`[System Scanner] Unknown tool key: ${toolKey}`);
    return null;
  }

  return await detectTool(config);
}
