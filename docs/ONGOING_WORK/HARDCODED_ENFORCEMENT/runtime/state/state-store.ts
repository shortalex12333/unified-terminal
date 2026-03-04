// Source: Instance 4 - State persistence

import * as fs from 'fs';
import * as path from 'path';

export interface SpineState {
  timestamp: string;
  projectDir: string;
  files: {
    count: number;
    totalSize: number;
    paths: string[];
  };
  git: {
    branch: string;
    commit: string;
    isDirty: boolean;
    stagedChanges: string[];
  };
  tests: {
    passed: number;
    failed: number;
    skipped: number;
  };
  build: {
    succeeded: boolean;
    artifactSize: number;
    artifactPath: string;
  };
  docker: {
    running: boolean;
    containers: string[];
  };
  health: {
    httpStatus: number;
    responseTime: number;
  };
}

export interface ActionExecution {
  id: string;
  stepName: string;
  agentType: string;
  startTime: string;
  endTime: string;
  duration: number;
  passed: boolean;
  output: string;
  checks: CheckExecution[];
  userAction?: 'Retry' | 'Skip' | 'Stop';
}

export interface CheckExecution {
  checkName: string;
  passed: boolean;
  output: string;
  duration: number;
}

/**
 * State store for runtime persistence
 */
export class StateStore {
  private spineFile: string;
  private actionDir: string;

  constructor(private projectDir: string) {
    this.spineFile = path.join(projectDir, 'SPINE.json');
    this.actionDir = path.join(projectDir, '.enforcement/actions');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dir = path.dirname(this.actionDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Write spine state to SPINE.json
   */
  async writeSpineState(state: SpineState): Promise<void> {
    const content = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.spineFile, content);
  }

  /**
   * Read spine state from SPINE.json
   */
  async readSpineState(): Promise<SpineState | null> {
    if (!fs.existsSync(this.spineFile)) {
      return null;
    }

    const content = fs.readFileSync(this.spineFile, 'utf-8');
    return JSON.parse(content) as SpineState;
  }

  /**
   * Record action execution
   */
  async recordActionExecution(action: ActionExecution): Promise<void> {
    const filename = path.join(this.actionDir, `${action.id}.json`);
    const content = JSON.stringify(action, null, 2);
    fs.writeFileSync(filename, content);
  }

  /**
   * Retrieve action execution history
   */
  async getActionHistory(stepName: string): Promise<ActionExecution[]> {
    if (!fs.existsSync(this.actionDir)) {
      return [];
    }

    const files = fs.readdirSync(this.actionDir);
    const actions: ActionExecution[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.actionDir, file), 'utf-8');
      const action = JSON.parse(content) as ActionExecution;
      if (stepName === undefined || action.stepName === stepName) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Clear old action records (keep last N days)
   */
  async cleanup(daysToKeep: number = 7): Promise<void> {
    if (!fs.existsSync(this.actionDir)) return;

    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(this.actionDir);

    for (const file of files) {
      const filePath = path.join(this.actionDir, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

export default StateStore;
