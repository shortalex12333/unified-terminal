import { loadDAGFromString, topologicalSort, DagStep } from '../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/state/dag-loader';

describe('DAG Loader', () => {
  const sampleDag = {
    id: 'dag-001',
    version: '1.0',
    steps: [
      {
        id: 'step-1',
        name: 'initialize',
        tierIndex: 0,
        type: 'spawn' as const,
        expectedOutputType: 'initialized',
        acceptanceCriteria: 'project state valid',
        timeout: 30,
        retryCount: 2,
        allowSkip: false,
        dependencies: []
      },
      {
        id: 'step-2',
        name: 'build',
        tierIndex: 1,
        type: 'spawn' as const,
        expectedOutputType: 'artifacts',
        acceptanceCriteria: 'dist/ populated',
        timeout: 60,
        retryCount: 1,
        allowSkip: false,
        dependencies: ['step-1']
      }
    ],
    createdAt: new Date().toISOString(),
    priority: 'normal' as const,
    maxConcurrentSteps: 1
  };

  it('should load valid DAG', () => {
    const dag = loadDAGFromString(JSON.stringify(sampleDag));
    expect(dag.steps).toHaveLength(2);
    expect(dag.steps[0].name).toBe('initialize');
  });

  it('should reject DAG with missing id', () => {
    const invalid = { ...sampleDag, id: undefined };
    expect(() => loadDAGFromString(JSON.stringify(invalid))).toThrow('missing id');
  });

  it('should detect circular dependencies', () => {
    const circular = {
      ...sampleDag,
      steps: [
        { ...sampleDag.steps[0], dependencies: ['step-2'] },
        { ...sampleDag.steps[1], dependencies: ['step-1'] }
      ]
    };
    expect(() => loadDAGFromString(JSON.stringify(circular))).toThrow('Circular');
  });

  it('should sort steps topologically', () => {
    const dag = loadDAGFromString(JSON.stringify(sampleDag));
    const sorted = topologicalSort(dag.steps);
    expect(sorted[0].id).toBe('step-1');
    expect(sorted[1].id).toBe('step-2');
  });
});
