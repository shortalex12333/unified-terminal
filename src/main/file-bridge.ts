import * as chokidar from 'chokidar';
import { FSWatcher } from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import {
  translateStatus,
  translateSpine,
  friendlyFileName,
  generateReadMe,
  AgentStatus,
  ProgressUpdate,
  ProgressTree,
} from './transposer';
import { KENOKI_HIDDEN, KENOKI_VISIBLE } from './project-scaffold';

/**
 * FileBridge: Watches agent world and synchronizes to human world
 *
 * Core of the file-based transposition architecture:
 * - Watches ~/.kenoki_projects/{id}/ for file changes
 * - Copies workspace files to ~/Documents/Kenoki/{name}/Files/
 * - Emits IPC events for frontend consumption
 */
export class FileBridge {
  private watcher: FSWatcher | null = null;
  private projectId: string;
  private projectName: string;
  private agentRoot: string;
  private humanRoot: string;
  private mainWindow: BrowserWindow | null = null;

  constructor(projectId: string, projectName: string) {
    this.projectId = projectId;
    this.projectName = projectName;
    this.agentRoot = path.join(KENOKI_HIDDEN, projectId);
    this.humanRoot = path.join(KENOKI_VISIBLE, projectName);
  }

  /**
   * Sets the main window reference for IPC notifications
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Starts watching the agent folder for file changes
   */
  start(): void {
    if (this.watcher) {
      console.warn('FileBridge already started');
      return;
    }

    this.watcher = chokidar.watch(this.agentRoot, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
    });

    // Register handlers
    this.watcher.on('add', (filePath: string) => this.handleFileCreated(filePath));
    this.watcher.on('change', (filePath: string) => this.handleFileChanged(filePath));

    console.log(`FileBridge watching: ${this.agentRoot}`);
  }

  /**
   * Stops watching and cleans up
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('FileBridge stopped');
    }
  }

  /**
   * Handles new files created in agent world
   */
  private handleFileCreated(agentPath: string): void {
    // If workspace file, copy to human folder and notify
    if (agentPath.includes('/workspace/')) {
      this.syncWorkspaceFile(agentPath);
    }
  }

  /**
   * Handles file changes in agent world
   */
  private handleFileChanged(agentPath: string): void {
    // Status file change → emit project:update
    if (agentPath.includes('/status/') && agentPath.endsWith('.json')) {
      this.handleStatusChange(agentPath);
    }

    // Spine file change → emit project:progress
    else if (agentPath.includes('spine_master.md') || agentPath.includes('spine_record.md')) {
      this.handleSpineChange(agentPath);
    }

    // Workspace file change → sync to human folder
    else if (agentPath.includes('/workspace/')) {
      this.syncWorkspaceFile(agentPath);
    }

    // MCP file change → check for missing MCPs
    else if (agentPath.includes('/skills/active_mcps.json')) {
      this.handleMcpChange(agentPath);
    }
  }

  /**
   * Handles status/*.json file changes
   * Translates agent status to human-friendly updates
   */
  private handleStatusChange(agentPath: string): void {
    try {
      const content = fs.readFileSync(agentPath, 'utf-8');
      const status: AgentStatus = JSON.parse(content);

      const update = translateStatus(status);

      this.notify({
        type: 'project:update',
        data: update,
      });
    } catch (error) {
      console.error('Error handling status change:', error);
    }
  }

  /**
   * Handles spine file changes
   * Parses progress tree and checks for completion
   */
  private handleSpineChange(agentPath: string): void {
    try {
      const content = fs.readFileSync(agentPath, 'utf-8');
      const progressTree = translateSpine(content);

      this.notify({
        type: 'project:progress',
        data: progressTree,
      });

      // Check if project is complete
      if (this.isProjectComplete(content)) {
        this.handleProjectComplete();
      }
    } catch (error) {
      console.error('Error handling spine change:', error);
    }
  }

  /**
   * Syncs workspace file from agent world to human world
   */
  private syncWorkspaceFile(agentPath: string): void {
    try {
      const humanPath = this.mapToHumanPath(agentPath);

      // Create parent directory
      const dir = path.dirname(humanPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Copy file
      fs.copyFileSync(agentPath, humanPath);

      // Notify frontend
      this.notify({
        type: 'project:file',
        data: {
          name: friendlyFileName(agentPath),
          path: humanPath,
          canPreview: this.canPreview(agentPath),
          canOpen: true,
        },
      });
    } catch (error) {
      console.error('Error syncing workspace file:', error);
    }
  }

  /**
   * Handles active_mcps.json changes
   * Checks for missing MCPs and prompts user to connect
   */
  private handleMcpChange(agentPath: string): void {
    try {
      const content = fs.readFileSync(agentPath, 'utf-8');
      const mcps = JSON.parse(content);

      if (mcps.missing && Array.isArray(mcps.missing) && mcps.missing.length > 0) {
        // Emit action overlay prompt
        this.notify({
          type: 'project:action',
          data: {
            type: 'mcp',
            title: 'Connection Required',
            message: `Your project needs ${mcps.missing.join(', ')} to continue.`,
            actions: [
              { label: 'Connect Now', action: 'connect' },
              { label: 'Skip', action: 'skip' },
            ],
          },
        });
      }
    } catch (error) {
      console.error('Error handling MCP change:', error);
    }
  }

  /**
   * Handles project completion
   * Final sync + generates Read Me + emits project:complete
   */
  private handleProjectComplete(): void {
    try {
      // Reconcile all workspace files (final sync)
      this.reconcileAllFiles();

      // Generate Read Me
      const readMePath = path.join(this.humanRoot, `Read Me.md`);
      const readMeContent = generateReadMe(
        {
          name: this.projectName,
          typeFriendly: 'project',
          deployedUrl: undefined,
        },
        {
          firstName: 'there', // Default - should be replaced with actual user name
        }
      );

      fs.writeFileSync(readMePath, readMeContent);

      // Emit project:complete
      this.notify({
        type: 'project:complete',
        data: {
          humanFolder: this.humanRoot,
          deployedUrl: undefined,
          summary: {
            pages: 0,
            components: 0,
          },
        },
      });
    } catch (error) {
      console.error('Error handling project complete:', error);
    }
  }

  /**
   * Maps agent workspace path to human Files/ path
   * Example: ~/.kenoki_projects/{id}/frontend/agent_x/workspace/Header.tsx
   *       → ~/Documents/Kenoki/{name}/Files/src/components/Header.tsx
   */
  private mapToHumanPath(agentPath: string): string {
    // Extract path after /workspace/
    const workspaceIndex = agentPath.indexOf('/workspace/');
    if (workspaceIndex === -1) {
      throw new Error('Not a workspace path');
    }

    const relativePath = agentPath.slice(workspaceIndex + '/workspace/'.length);
    return path.join(this.humanRoot, 'Files', relativePath);
  }

  /**
   * Checks if a file can be previewed (images, markdown)
   */
  private canPreview(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.md', '.markdown'].includes(ext);
  }

  /**
   * Checks if project is complete (all phases COMPLETE)
   */
  private isProjectComplete(spineContent: string): boolean {
    const lines = spineContent.split('\n');
    const phaseRegex = /^##\s+Phase\s+\d+:/i;
    const phases = lines.filter((line) => phaseRegex.test(line));

    if (phases.length === 0) {
      return false;
    }

    // All phases must have [COMPLETE]
    return phases.every((line) => line.includes('[COMPLETE]'));
  }

  /**
   * Reconciles all workspace files to human folder (final sync)
   */
  private reconcileAllFiles(): void {
    try {
      // Find all workspace directories
      const domains = ['frontend', 'backend', 'database', 'deploy'];

      for (const domain of domains) {
        const domainPath = path.join(this.agentRoot, domain);
        if (!fs.existsSync(domainPath)) continue;

        // Scan for subagents
        const subagentsPath = path.join(domainPath, 'subagents');
        if (!fs.existsSync(subagentsPath)) continue;

        const subagents = fs.readdirSync(subagentsPath);

        for (const subagent of subagents) {
          const workspacePath = path.join(subagentsPath, subagent, 'workspace');
          if (!fs.existsSync(workspacePath)) continue;

          // Sync all files in workspace
          this.syncDirectoryRecursive(workspacePath);
        }
      }
    } catch (error) {
      console.error('Error reconciling files:', error);
    }
  }

  /**
   * Recursively syncs all files in a directory
   */
  private syncDirectoryRecursive(dirPath: string): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.syncDirectoryRecursive(fullPath);
        } else {
          this.syncWorkspaceFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error syncing directory ${dirPath}:`, error);
    }
  }

  /**
   * Sends IPC notification to renderer
   */
  private notify(update: { type: string; data: unknown }): void {
    if (!this.mainWindow) {
      return;
    }

    this.mainWindow.webContents.send(update.type, update.data);
  }
}
