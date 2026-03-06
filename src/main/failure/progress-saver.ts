import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SavedProgress, PartialOutput, FailureReason, serializeSavedProgress, deserializeSavedProgress, detectFailureReason } from './types';

const KENOKI_DIR = path.join(os.homedir(), '.kenoki');
const SAVED_PROGRESS_DIR = path.join(KENOKI_DIR, 'saved-progress');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export class ProgressSaver extends EventEmitter {
  private static instance: ProgressSaver | null = null;

  private constructor() {
    super();
    ensureDir(SAVED_PROGRESS_DIR);
  }

  static getInstance(): ProgressSaver {
    if (!ProgressSaver.instance) ProgressSaver.instance = new ProgressSaver();
    return ProgressSaver.instance;
  }

  async save(data: {
    planId: string;
    projectPath: string;
    projectName?: string;
    planName?: string;
    steps?: Array<{ id: number; status: string }>;
    completedSteps?: number[];
    totalSteps?: number;
    failedStepId?: number;
    failedStep?: number;
    error?: string;
    failureReason?: FailureReason;
    failureMessage?: string;
    originalMessage?: string;
    context?: Record<string, unknown>;
  }): Promise<SavedProgress> {
    const id = 'progress_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const partialOutputs = await this.scanPartialOutputs(data.projectPath);

    // Convert steps array to completed steps if provided
    const completedSteps = data.completedSteps ||
      (data.steps?.filter(s => s.status === 'done').map(s => s.id) ?? []);
    const totalSteps = data.totalSteps || data.steps?.length || 0;
    const failedStep = data.failedStep ?? data.failedStepId ?? 0;
    const failureMessage = data.failureMessage || data.error || 'Unknown error';
    const failureReason = data.failureReason || detectFailureReason(failureMessage);
    const planName = data.planName || data.projectName || 'Untitled Build';

    const progress: SavedProgress = {
      id,
      planId: data.planId,
      planName,
      projectPath: data.projectPath,
      completedSteps,
      totalSteps,
      failedStep,
      failureReason,
      failureMessage,
      savedAt: new Date(),
      canResume: this.checkCanResume(failureReason),
      partialOutputs,
    };

    const filePath = path.join(SAVED_PROGRESS_DIR, id + '.json');
    fs.writeFileSync(filePath, JSON.stringify(serializeSavedProgress(progress), null, 2));
    this.emit('saved', progress);
    return progress;
  }

  list(): SavedProgress[] {
    ensureDir(SAVED_PROGRESS_DIR);
    return fs.readdirSync(SAVED_PROGRESS_DIR).filter(f => f.endsWith('.json')).map(file => {
      try { return deserializeSavedProgress(JSON.parse(fs.readFileSync(path.join(SAVED_PROGRESS_DIR, file), 'utf-8'))); }
      catch { return null; }
    }).filter((p): p is SavedProgress => p !== null).sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
  }

  load(id: string): SavedProgress | null {
    const filePath = path.join(SAVED_PROGRESS_DIR, id + '.json');
    if (!fs.existsSync(filePath)) return null;
    try { return deserializeSavedProgress(JSON.parse(fs.readFileSync(filePath, 'utf-8'))); } catch { return null; }
  }

  delete(id: string): boolean {
    const filePath = path.join(SAVED_PROGRESS_DIR, id + '.json');
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); this.emit('deleted', id); return true; }
    return false;
  }

  canResume(id: string): boolean {
    const progress = this.load(id);
    return progress ? fs.existsSync(progress.projectPath) && progress.canResume : false;
  }

  private async scanPartialOutputs(projectPath: string): Promise<PartialOutput[]> {
    const outputs: PartialOutput[] = [];
    if (!fs.existsSync(projectPath)) return outputs;
    const scan = (dir: string, depth = 0): void => {
      if (depth > 3) return;
      try {
        for (const item of fs.readdirSync(dir)) {
          if (item.startsWith('.') || item === 'node_modules') continue;
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          outputs.push({ stepId: 0, type: stat.isDirectory() ? 'directory' : 'file', path: fullPath, size: stat.isDirectory() ? 0 : stat.size });
          if (stat.isDirectory()) scan(fullPath, depth + 1);
        }
      } catch {}
    };
    scan(projectPath);
    return outputs;
  }

  private checkCanResume(reason: FailureReason): boolean {
    return ['api_unavailable', 'rate_limited', 'network_error', 'timeout'].includes(reason);
  }
}

let instance: ProgressSaver | null = null;
export function getProgressSaver(): ProgressSaver { if (!instance) instance = ProgressSaver.getInstance(); return instance; }
export function cleanupProgressSaver(): void { instance = null; }
