import { StateStore, SpineState, ActionExecution } from '../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/state/state-store';
import * as fs from 'fs';
import * as path from 'path';

describe('StateStore', () => {
  let tempDir: string;
  let store: StateStore;

  beforeEach(() => {
    tempDir = path.join(__dirname, '.test-runtime-state');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    store = new StateStore(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should write and read spine state', async () => {
    const state: SpineState = {
      timestamp: new Date().toISOString(),
      projectDir: tempDir,
      files: { count: 10, totalSize: 50000, paths: ['file1.ts', 'file2.ts'] },
      git: { branch: 'main', commit: 'abc123', isDirty: false, stagedChanges: [] },
      tests: { passed: 10, failed: 0, skipped: 1 },
      build: { succeeded: true, artifactSize: 100000, artifactPath: 'dist/' },
      docker: { running: true, containers: ['app'] },
      health: { httpStatus: 200, responseTime: 150 }
    };

    await store.writeSpineState(state);
    const read = await store.readSpineState();

    expect(read).toEqual(state);
  });

  it('should record and retrieve action execution', async () => {
    const action: ActionExecution = {
      id: 'action-001',
      stepName: 'build',
      agentType: 'codex',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 5000,
      passed: true,
      output: 'Build succeeded',
      checks: [
        { checkName: 'test', passed: true, output: 'Tests pass', duration: 1000 }
      ]
    };

    await store.recordActionExecution(action);
    const history = await store.getActionHistory('build');

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('action-001');
  });
});
