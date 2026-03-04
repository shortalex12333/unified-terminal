import { initializeRuntime } from '../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/index';
import { loadDAGFromString } from '../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/state/dag-loader';

describe('Runtime Integration', () => {
  it('should execute simple DAG end-to-end', async () => {
    const runtime = await initializeRuntime({
      projectDir: process.cwd(),
      dagFile: 'test.json',
      maxConcurrentSteps: 1,
      enableLogging: true
    });

    const sampleDag = {
      id: 'integration-test',
      version: '1.0',
      steps: [
        {
          id: 's1',
          name: 'setup',
          tierIndex: 0,
          type: 'spawn',
          expectedOutputType: 'ready',
          acceptanceCriteria: 'system initialized',
          timeout: 10,
          retryCount: 1,
          allowSkip: false
        }
      ],
      createdAt: new Date().toISOString(),
      priority: 'normal',
      maxConcurrentSteps: 1
    };

    const result = await runtime.executeDAG(JSON.stringify(sampleDag));

    expect(result).toBeDefined();
    expect(result.verdict).toBeDefined();

    await runtime.shutdown();
  });
});
