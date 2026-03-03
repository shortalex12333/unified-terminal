# CLAUDE CODE: BUILD GATES 5-6 — AUTO-INSTALLER + CLI AUTH
## Run: `claude --dangerously-skip-permissions` in `~/Documents/unified-terminal/`
## Scope: Build, test, stress-test, iterate until bulletproof. You have all night.

---

## CONTEXT: WHAT EXISTS

You are working in `~/Documents/unified-terminal/`, an Electron app that wraps ChatGPT in a BrowserView. Gates 1-3 are PASSING (ChatGPT loads, DOM injection works, response capture works). Your job is to build Gates 5 and 6.

### Files you MUST read first before writing any code:
```
cat src/main/system-scanner.ts    # SystemScanner class — detects installed tools
cat src/main/index.ts             # Main process — has placeholder IPC at line 290
cat src/main/preload.ts           # IPC bridge — already exposes system:installTools and system:onInstallProgress
cat src/main/cli-runner.ts        # CLIRunner class — spawns processes, you'll extend this
cat src/main/state-manager.ts     # StateManager — save/load JSON state
cat src/renderer/App.tsx          # Has 'setup' state but no SetupScreen component yet
cat src/renderer/global.d.ts      # TypeScript types for window.api
cat package.json                  # Current dependencies
cat tsconfig.main.json            # TypeScript config for main process
```

Read ALL of these before writing a single line. Understand the patterns, naming conventions, and architecture.

### Integration points already wired:
- `ipcMain.handle('system:install-tools')` exists at line 290 of index.ts — currently a placeholder
- `ipcRenderer.on('system:install-progress')` is already exposed via preload.ts
- `window.api.system.installTools()` is already typed in global.d.ts
- `window.api.system.onInstallProgress(cb)` is already typed
- `AppState` type includes `'setup'` but no component renders for it
- `SystemScanner.scan()` returns `SystemProfile` with tool detection

---

## GATE 5: AUTO-INSTALLER

### What you are building:

A system that on first launch (or when tools are missing) automatically installs every dependency the app needs. The user sees a friendly progress screen. They never open a terminal.

### File: `src/main/auto-installer.ts`

Create this file. It must:

#### 1. Export an `AutoInstaller` class with this interface:
```typescript
interface InstallProgress {
  phase: string;           // "homebrew" | "node" | "python" | "git" | "codex" | "claude-code" | "gsd" | "mcp-servers" | "browser-use" | "complete"
  status: 'pending' | 'installing' | 'installed' | 'skipped' | 'failed';
  message: string;         // User-friendly: "Installing Node.js..." not "Running nvm install 20"
  detail?: string;         // Technical detail for debug: "nvm install 20 --lts"
  progress?: number;       // 0-100 if calculable
  error?: string;          // Error message if failed
}

interface InstallResult {
  success: boolean;
  installed: string[];     // Tools that were installed
  skipped: string[];       // Tools that were already present
  failed: string[];        // Tools that failed to install
  errors: Record<string, string>; // tool -> error message
  totalTime: number;       // ms
}

class AutoInstaller {
  constructor(
    private onProgress: (progress: InstallProgress) => void,
    private logger: Logger
  );

  async runFullInstall(): Promise<InstallResult>;
  async installSingle(tool: string): Promise<boolean>;
  async verifyAll(): Promise<SystemProfile>;
}
```

#### 2. Installation order (strict sequence, each step depends on previous):

**Step 1: Xcode Command Line Tools**
```bash
# Detection:
xcode-select -p 2>/dev/null
# If missing, this opens a macOS dialog that CANNOT be automated:
xcode-select --install
# The user must click "Install" in the macOS popup
# Wait for completion by polling: while ! xcode-select -p &>/dev/null; do sleep 5; done
# Timeout after 15 minutes (user may have cancelled)
```
- CRITICAL: This is a blocking step. If xcode-select is not installed, the installer MUST pause and tell the user "Click Install when the macOS dialog appears" via the progress callback.
- If already installed, skip immediately.

**Step 2: Homebrew**
```bash
# Detection:
which brew || test -f /opt/homebrew/bin/brew || test -f /usr/local/bin/brew
# Installation (Apple Silicon):
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
# Post-install PATH (Apple Silicon):
eval "$(/opt/homebrew/bin/brew shellenv)"
# Post-install PATH (Intel):
eval "$(/usr/local/bin/brew shellenv)"
```
- CRITICAL: Homebrew install requires sudo password. The stdin of the child process must be piped. Detect the sudo prompt by watching stdout for "Password:" and emit a progress event asking user for password.
- ALTERNATIVE: If we cannot get sudo, try the "unattended" Homebrew install: `NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` — but this may fail if /opt/homebrew doesn't exist.
- If Homebrew is already installed, run `brew update` silently.

**Step 3: Node.js via nvm**
```bash
# Detection:
node --version  # Need v18+ 
# Install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Source nvm (critical — nvm modifies shell config):
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# Install Node 20 LTS:
nvm install 20 --lts
nvm use 20
nvm alias default 20
# Verify:
node --version  # Should be v20.x.x
npm --version
```
- CRITICAL: Every subsequent `spawn` call must include NVM_DIR and source nvm in the environment, or Node won't be found.
- Build the PATH string: `${HOME}/.nvm/versions/node/v20.*/bin:${PATH}`
- If Node is already installed at v18+, skip. If Node exists but is <v18, install v20 alongside.

**Step 4: Python 3 via Homebrew**
```bash
# Detection:
python3 --version  # Need 3.10+
# Install:
brew install python@3.12
# Verify:
python3 --version
pip3 --version
```
- If Python 3.10+ exists, skip.
- macOS ships with python3 since Monterey, but it may be old. Only install if version < 3.10.

**Step 5: Git**
```bash
# Detection:
git --version
# Usually pre-installed with Xcode CLT. If missing:
brew install git
```

**Step 6: Codex CLI (OpenAI)**
```bash
# Detection:
npm list -g @openai/codex 2>/dev/null || npx @openai/codex --version 2>/dev/null
# Install:
npm install -g @openai/codex
# Verify:
npx @openai/codex --version
```
- Does NOT require auth at install time. Auth happens on first use (Gate 6).

**Step 7: Claude Code (Anthropic)**
```bash
# Detection:
npm list -g @anthropic-ai/claude-code 2>/dev/null || claude --version 2>/dev/null
# Install:
npm install -g @anthropic-ai/claude-code
# Verify:
claude --version
```
- Does NOT require auth at install time. Auth happens on first use (Gate 6).

**Step 8: GSD (Get Shit Done)**
```bash
# Detection — check both npm global and common git clone locations:
which gsd 2>/dev/null || npm list -g get-shit-done 2>/dev/null
# Install — research the actual installation method first:
# Option A: npm install -g get-shit-done (if published to npm)
# Option B: git clone + npm link
# Verify:
gsd --version 2>/dev/null
```
- IMPORTANT: GSD's install method may have changed. Check `https://github.com/gsd-build/get-shit-done` README for current instructions. If you can't determine the install method, log it as "manual install needed" and skip.

**Step 9: MCP Servers**
```bash
# Install each as npm global or in a shared location:
npm install -g @anthropic-ai/mcp-server-filesystem 2>/dev/null
npm install -g @anthropic-ai/mcp-server-github 2>/dev/null
npm install -g @anthropic-ai/mcp-server-memory 2>/dev/null
npm install -g @anthropic-ai/mcp-server-brave-search 2>/dev/null
npm install -g @anthropic-ai/mcp-server-puppeteer 2>/dev/null
npm install -g @anthropic-ai/mcp-server-sqlite 2>/dev/null
```
- These are optional. Failures should be logged but NOT block the install.
- Each is independent. Install in parallel if possible (Promise.allSettled).

**Step 10: Browser-Use (Python)**
```bash
# Detection:
pip3 show browser-use 2>/dev/null
# Install:
pip3 install browser-use
# Playwright browsers (BIG download, ~500MB):
python3 -m playwright install chromium
```
- This is optional. If it fails, log and skip.
- Warn user about Playwright download size in progress callback.

#### 3. Implementation requirements:

**Process spawning:** Use `child_process.spawn` with `{ shell: true }` for all commands. Never use `exec` (buffer overflow risk on long output). Pipe stdout and stderr to the progress callback.

**Environment construction:** Before each spawn, build the full environment:
```typescript
private buildEnv(): NodeJS.ProcessEnv {
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
  } catch {}

  const npmGlobal = path.join(home, '.npm-global', 'bin');

  return {
    ...process.env,
    HOME: home,
    NVM_DIR: nvmDir,
    PATH: [
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
    ].filter(Boolean).join(':'),
  };
}
```

**Timeout per step:** No single install step should run longer than:
- Xcode CLT: 15 minutes (user interaction required)
- Homebrew: 10 minutes
- Node/Python/Git: 5 minutes each
- npm packages: 3 minutes each
- Browser-Use + Playwright: 10 minutes

If a step exceeds its timeout, kill the process and mark as failed.

**Skip logic:** Before every step, run the detection command. If the tool exists at an acceptable version, emit `{ status: 'skipped', message: 'Node.js v20.11.0 already installed' }` and move to the next step. A second run of the installer should complete in <5 seconds if everything is already installed.

**Failure isolation:** If any step fails, log the error and continue to the next step. Never abort the entire install because one optional tool failed. The only truly blocking steps are: Xcode CLT (needed for everything), and Node.js (needed for npm packages).

**State persistence:** After install completes, save the result to StateManager:
```typescript
StateManager.save('install-result', result);
StateManager.save('install-timestamp', Date.now());
```
On subsequent launches, check if install-result exists and all tools are verified. If yes, skip the setup screen entirely.

#### 4. Wire into main/index.ts:

Replace the placeholder at line 290:
```typescript
ipcMain.handle('system:install-tools', async () => {
  const installer = new AutoInstaller(
    (progress) => {
      mainWindow?.webContents.send('system:install-progress', progress);
    },
    logger
  );
  return installer.runFullInstall();
});
```

Also add a new IPC handler:
```typescript
ipcMain.handle('system:needs-setup', async () => {
  // Check if we've already installed successfully
  const lastResult = StateManager.load('install-result');
  if (lastResult?.success) {
    // Verify tools are still present
    const scanner = new SystemScanner();
    const profile = scanner.scan();
    return {
      needsSetup: !profile.capable.canRunCLI,
      profile,
    };
  }
  return { needsSetup: true, profile: null };
});
```

Add this to preload.ts:
```typescript
needsSetup: () => ipcRenderer.invoke('system:needs-setup'),
```

Add this to global.d.ts in the system interface:
```typescript
needsSetup: () => Promise<{ needsSetup: boolean; profile: any }>;
```

#### 5. Handle the sudo password problem:

Homebrew install requires sudo. Options (implement in priority order):

**Option A: NONINTERACTIVE mode**
```bash
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
This may work if the user has passwordless sudo or if /opt/homebrew already exists.

**Option B: Emit progress event requesting password**
```typescript
// When stdout contains "Password:" or "password for"
this.onProgress({
  phase: 'homebrew',
  status: 'installing',
  message: 'Homebrew needs your Mac password to install',
  detail: 'sudo-required',
});
```
Then the renderer shows a native-looking password input. The password is piped to stdin of the child process. THE PASSWORD MUST NEVER BE STORED. Pipe it directly and immediately clear from memory.

**Option C: Use osascript for a native macOS password dialog**
```bash
osascript -e 'do shell script "command here" with administrator privileges'
```
This shows the standard macOS "an application wants to make changes" dialog. More trustworthy-looking to users.

Implement Option A first. If it fails (detected by non-zero exit code), fall back to Option C. Only use Option B as last resort.

---

## GATE 6: CLI TOOL AUTHENTICATION

### What you are building:

After tools are installed, some need authentication before first use. This gate handles detecting auth requirements and guiding the user through them.

### File: `src/main/cli-auth.ts`

Create this file. It must:

#### 1. Export a `CLIAuthManager` class:
```typescript
interface AuthStatus {
  tool: string;
  authenticated: boolean;
  method: string;          // "oauth" | "api-key" | "login-command" | "none"
  detail?: string;
}

interface AuthProgress {
  tool: string;
  status: 'checking' | 'auth-required' | 'authenticating' | 'authenticated' | 'failed';
  message: string;
  action?: 'open-browser' | 'enter-key' | 'accept-tos' | 'none';
  url?: string;            // URL to open if action is 'open-browser'
}

class CLIAuthManager {
  constructor(
    private onProgress: (progress: AuthProgress) => void,
    private logger: Logger
  );

  async checkAll(): Promise<AuthStatus[]>;
  async authenticateTool(tool: string): Promise<boolean>;
  async runAuthFlow(): Promise<AuthStatus[]>;
}
```

#### 2. Auth flow per tool:

**Codex CLI:**
```bash
# Check auth:
codex auth status 2>/dev/null
# or check for config file:
test -f ~/.codex/config.json && cat ~/.codex/config.json | grep -q "api_key"
# Auth flow — Codex uses OpenAI OAuth which opens system browser:
codex auth login
# This opens https://platform.openai.com in the default browser
# User logs in, grants permission, browser redirects back
# Codex stores the token in ~/.codex/
```
- CRITICAL: `codex auth login` opens the SYSTEM browser, not our BrowserView. This is actually fine — let it happen. Emit a progress event: "A browser window will open. Sign in with your OpenAI account."
- After the browser flow completes, poll `codex auth status` every 2 seconds until it reports authenticated, or timeout after 5 minutes.

**Claude Code:**
```bash
# Check auth:
claude auth status 2>/dev/null
# or check for config:
test -f ~/.claude/config.json
# Auth flow:
claude auth login
# Opens browser for Anthropic OAuth
# Stores token in ~/.claude/
```
- Same pattern as Codex. Opens system browser. Poll for completion.

**GSD:**
```bash
# GSD typically piggybacks on Claude Code's auth
# Check if Claude Code is authenticated — that's usually sufficient
# GSD may also need its own config — check the README
claude auth status 2>/dev/null
```

**GitHub (for Codex git operations):**
```bash
# Check:
gh auth status 2>/dev/null
# or:
git config --global credential.helper
# Auth:
gh auth login
# or Codex handles this via its own OAuth
```
- GitHub auth may or may not be needed. Only attempt if user tries a task requiring git push.

#### 3. Implementation pattern:

For each tool auth:
1. Check if already authenticated
2. If yes, emit `authenticated` and skip
3. If no, emit `auth-required` with instructions
4. Spawn the auth command
5. Watch stdout for browser-open indicators
6. Emit progress so renderer can show "Waiting for you to sign in..."
7. Poll for auth completion every 2-3 seconds
8. Timeout after 5 minutes
9. Save auth status to StateManager

#### 4. Interactive prompt detection:

Some auth flows ask yes/no questions in the terminal (e.g., "Accept Terms of Service? (y/n)"). Handle this:

```typescript
private async spawnWithPromptDetection(
  command: string,
  args: string[],
  promptHandlers: Record<string, string>  // regex -> response
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: true,
      env: this.buildEnv(),
    });

    let output = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;

      // Check each prompt handler
      for (const [pattern, response] of Object.entries(promptHandlers)) {
        if (new RegExp(pattern, 'i').test(text)) {
          proc.stdin?.write(response + '\n');
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.on('exit', (code) => {
      resolve({ exitCode: code ?? 1, output });
    });
  });
}
```

Common prompts to auto-answer:
```typescript
const COMMON_PROMPTS: Record<string, string> = {
  'accept.*terms': 'y',
  'agree.*tos': 'y',
  'continue.*\\?': 'y',
  'select.*provider': '1',  // Usually "OpenAI" or "Anthropic" is option 1
  'which.*model': '1',      // Default model
};
```

#### 5. Wire into main/index.ts:

Add IPC handlers:
```typescript
ipcMain.handle('auth:check-all', async () => {
  const authManager = new CLIAuthManager(
    (progress) => mainWindow?.webContents.send('auth:progress', progress),
    logger
  );
  return authManager.checkAll();
});

ipcMain.handle('auth:authenticate', async (_event, tool: string) => {
  const authManager = new CLIAuthManager(
    (progress) => mainWindow?.webContents.send('auth:progress', progress),
    logger
  );
  return authManager.authenticateTool(tool);
});

ipcMain.handle('auth:run-flow', async () => {
  const authManager = new CLIAuthManager(
    (progress) => mainWindow?.webContents.send('auth:progress', progress),
    logger
  );
  return authManager.runAuthFlow();
});
```

Add to preload.ts:
```typescript
auth: {
  checkAll: () => ipcRenderer.invoke('auth:check-all'),
  authenticate: (tool: string) => ipcRenderer.invoke('auth:authenticate', tool),
  runFlow: () => ipcRenderer.invoke('auth:run-flow'),
  onProgress: (cb: (data: any) => void) => {
    ipcRenderer.on('auth:progress', (_e, data) => cb(data));
  },
},
```

Add to global.d.ts:
```typescript
auth: {
  checkAll: () => Promise<any[]>;
  authenticate: (tool: string) => Promise<boolean>;
  runFlow: () => Promise<any[]>;
  onProgress: (cb: (data: any) => void) => void;
};
```

---

## RENDERER: SETUP SCREEN

### File: `src/renderer/components/SetupScreen.tsx`

Create this component. It renders when `AppState === 'setup'`.

#### Design spec:
- Full height of the sidebar (380px wide)
- Dark background matching existing theme (surface-0, surface-1, surface-2)
- Shows a vertical list of install steps
- Each step has: icon/emoji, name, status indicator (pending/installing/done/failed/skipped)
- Installing step shows a pulse animation
- Completed steps show green checkmark
- Failed steps show red X with error message and "Retry" button
- Bottom of screen: overall progress bar + estimated time remaining
- When all steps complete: "Setup Complete — Starting App..." then transition to auth state

#### Implementation:
```tsx
import React, { useState, useEffect } from 'react';

interface SetupStep {
  phase: string;
  label: string;
  status: 'pending' | 'installing' | 'installed' | 'skipped' | 'failed';
  message: string;
  error?: string;
}

const SETUP_STEPS: SetupStep[] = [
  { phase: 'xcode-clt', label: 'Developer Tools', status: 'pending', message: '' },
  { phase: 'homebrew', label: 'Package Manager', status: 'pending', message: '' },
  { phase: 'node', label: 'Node.js', status: 'pending', message: '' },
  { phase: 'python', label: 'Python', status: 'pending', message: '' },
  { phase: 'git', label: 'Git', status: 'pending', message: '' },
  { phase: 'codex', label: 'Codex CLI', status: 'pending', message: '' },
  { phase: 'claude-code', label: 'Claude Code', status: 'pending', message: '' },
  { phase: 'gsd', label: 'GSD Framework', status: 'pending', message: '' },
  { phase: 'mcp-servers', label: 'MCP Servers', status: 'pending', message: '' },
  { phase: 'browser-use', label: 'Browser Automation', status: 'pending', message: '' },
];

export default function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [steps, setSteps] = useState<SetupStep[]>(SETUP_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    // Listen for progress events
    window.api.system.onInstallProgress((data) => {
      setSteps(prev => prev.map(s =>
        s.phase === data.phase ? { ...s, status: data.status, message: data.message, error: data.error } : s
      ));

      if (data.phase === 'complete') {
        setTimeout(onComplete, 1500); // Brief pause then transition
      }
    });

    // Start installation
    setIsRunning(true);
    setStartTime(Date.now());
    window.api.system.installTools();
  }, []);

  const completedCount = steps.filter(s => s.status === 'installed' || s.status === 'skipped').length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="flex flex-col h-full">
      <div className="titlebar-drag h-12 flex items-center px-20 shrink-0">
        <span className="text-sm font-semibold text-white/60 select-none">Setting up...</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1">First-Time Setup</h2>
          <p className="text-sm text-white/50">Installing tools. This takes 5-10 minutes.</p>
        </div>

        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.phase} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2">
              {/* Status indicator */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                step.status === 'installing' ? 'bg-accent animate-pulse' :
                step.status === 'installed' ? 'bg-success' :
                step.status === 'skipped' ? 'bg-white/30' :
                step.status === 'failed' ? 'bg-danger' : 'bg-white/10'
              }`} />
              {/* Label + message */}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white/80">{step.label}</span>
                {step.message && (
                  <p className="text-xs text-white/40 truncate">{step.message}</p>
                )}
                {step.error && (
                  <p className="text-xs text-danger/80 truncate">{step.error}</p>
                )}
              </div>
              {/* Status text */}
              <span className={`text-xs shrink-0 ${
                step.status === 'installed' ? 'text-success' :
                step.status === 'skipped' ? 'text-white/30' :
                step.status === 'failed' ? 'text-danger' : 'text-white/20'
              }`}>
                {step.status === 'installed' ? '✓' :
                 step.status === 'skipped' ? 'skip' :
                 step.status === 'failed' ? '✗' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-white/30 mt-2 text-center">
          {completedCount} of {steps.length} complete
        </p>
      </div>
    </div>
  );
}
```

#### Wire into App.tsx:

Import SetupScreen and add it to the render:
```tsx
import SetupScreen from './components/SetupScreen';

// In the useEffect, before checking auth:
const setup = await window.api.system.needsSetup();
if (setup.needsSetup) {
  setState('setup');
  return; // Don't proceed to auth check
}

// In the JSX:
{state === 'setup' && (
  <SetupScreen onComplete={() => setState('auth')} />
)}
```

---

## TESTS

### File: `tests/auto-installer.test.ts`

Write comprehensive tests. Since we can't actually install Homebrew in a test, mock the spawn calls and test the orchestration logic:

```typescript
// Test: skipAlreadyInstalled
// Mock SystemScanner to return all tools present
// Verify runFullInstall completes in <1 second with all "skipped"

// Test: installSequence
// Mock all spawns to succeed
// Verify steps run in correct order
// Verify progress callbacks fire for each step

// Test: failureIsolation
// Mock Homebrew install to fail
// Verify Node.js install is still attempted
// Verify result.failed includes "homebrew"

// Test: timeoutHandling
// Mock a spawn that never exits
// Verify timeout kills the process after configured duration

// Test: environmentConstruction
// Verify buildEnv() includes nvm, brew, npm-global paths
// Verify PATH is correctly ordered (nvm first, then brew, then system)

// Test: skipOnSecondRun
// Mock StateManager.load('install-result') returning success
// Verify needsSetup returns false

// Test: sudoDetection
// Mock stdout containing "Password:"
// Verify progress event fires with sudo-required detail

// Test: xcodeBlockingBehavior
// Mock xcode-select returning not-installed
// Verify installer pauses and emits user-action-required

// Test: mpcParallelInstall
// Verify MCP servers install in parallel (Promise.allSettled)
// Verify one failure doesn't block others

// Test: authCheckAll
// Mock codex auth status, claude auth status
// Verify returns correct auth states

// Test: authFlowSpawnsCommand
// Mock authenticateTool('codex')
// Verify it spawns 'codex auth login'
// Verify it polls for completion

// Test: promptAutoAnswer
// Mock stdout with "Accept Terms of Service? (y/n)"
// Verify stdin receives "y\n"
```

Run tests with: `npx jest tests/auto-installer.test.ts` or whatever test runner is configured.

### File: `tests/cli-auth.test.ts`

Similar test structure for CLIAuthManager.

---

## STRESS TESTING

After building everything, run these stress tests:

### Stress Test 1: Fresh install simulation
```bash
# Create a temporary HOME directory that has nothing installed
# Run the installer against it
# Verify it attempts to install everything
# Verify progress events fire correctly
# Verify it handles missing tools gracefully
```

### Stress Test 2: Everything already installed
```bash
# Run SystemScanner.scan() on the actual system
# Run installer — it should skip everything in <2 seconds
# Verify all steps report "skipped"
```

### Stress Test 3: Partial installation
```bash
# Mock: Node exists, Python exists, but Codex/Claude Code don't
# Run installer — should skip Node/Python, install Codex/Claude Code
# Verify mixed result (some skipped, some installed)
```

### Stress Test 4: Network failure
```bash
# Block network (or mock curl/npm to fail)
# Run installer
# Verify graceful failure messages
# Verify state is saved even on failure
```

### Stress Test 5: Concurrent run protection
```bash
# Call runFullInstall() twice simultaneously
# Verify second call is rejected or queued (no double-install)
```

### Stress Test 6: Interrupt and resume
```bash
# Start installer
# Kill the process mid-install (SIGTERM)
# Restart
# Verify it detects partial state and resumes (or re-runs)
```

---

## VERIFICATION CHECKLIST

Before you consider this gate complete, verify ALL of the following:

### Code quality:
- [ ] `src/main/auto-installer.ts` exists and compiles: `npx tsc -p tsconfig.main.json --noEmit`
- [ ] `src/main/cli-auth.ts` exists and compiles
- [ ] `src/renderer/components/SetupScreen.tsx` exists and compiles
- [ ] No TypeScript errors anywhere in the project
- [ ] All imports resolve correctly
- [ ] Follows existing code patterns (Logger usage, EventEmitter patterns, IPC naming)

### Integration:
- [ ] main/index.ts imports and uses AutoInstaller (placeholder replaced)
- [ ] main/index.ts imports and uses CLIAuthManager
- [ ] preload.ts exposes all new IPC channels
- [ ] global.d.ts has types for all new API methods
- [ ] App.tsx uses SetupScreen component
- [ ] App.tsx checks needsSetup before auth check

### Functionality:
- [ ] SystemScanner is called before each install step to check if tool exists
- [ ] Each step has detection → skip/install → verify flow
- [ ] Progress events fire for every status change
- [ ] Failures don't abort the entire install
- [ ] State is saved after install completes
- [ ] Second launch skips setup if everything is installed
- [ ] Auth flow spawns correct commands for each tool
- [ ] Auth polling detects completion
- [ ] Timeouts kill stuck processes

### Tests:
- [ ] All tests pass: `npm test`
- [ ] At least 15 test cases covering: skip, install, fail, timeout, env, auth

### Files created:
- [ ] `src/main/auto-installer.ts`
- [ ] `src/main/cli-auth.ts`
- [ ] `src/renderer/components/SetupScreen.tsx`
- [ ] `tests/auto-installer.test.ts`
- [ ] `tests/cli-auth.test.ts`
- [ ] Updated: `src/main/index.ts`
- [ ] Updated: `src/main/preload.ts`
- [ ] Updated: `src/renderer/global.d.ts`
- [ ] Updated: `src/renderer/App.tsx`

---

## CRITICAL REMINDERS

1. **Read existing files first.** Match patterns exactly. Don't introduce new conventions.
2. **The app already works for Gates 1-3.** Do NOT break anything. Run `npx tsc -p tsconfig.main.json --noEmit` after every change.
3. **The user never opens a terminal.** Every install step must work without terminal interaction except the Xcode CLT dialog and potential sudo password.
4. **Handle the PATH problem.** This is the #1 cause of "tool not found" errors in Electron child processes. Every spawn must have the full PATH with nvm, brew, and npm-global.
5. **Test on the actual machine.** After building, run `npm run dev` and verify the setup screen appears if tools are missing (or skips if they're all present).
6. **Don't over-engineer.** This is an MVP. If something is hard (like GSD install), mark it as "manual install needed" and skip it. The installer should work for the 80% case.
7. **Save your work frequently.** Commit after each major file is complete.
8. **The renderer is 380px wide.** All UI must fit in a narrow sidebar. No wide layouts.
9. **Use existing Tailwind classes.** Check tailwind.config.js for the custom colors (surface-0 through surface-4, accent, success, danger).
10. **When in doubt, look at how the existing code does it.** cli-runner.ts for process spawning. state-manager.ts for persistence. The patterns are established.
