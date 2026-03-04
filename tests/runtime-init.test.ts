import { initializeRuntime, RuntimeConfig } from '../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/index';

describe('Runtime Initialization', () => {
  it('should initialize runtime with valid config', async () => {
    const config: RuntimeConfig = {
      projectDir: process.cwd(),
      dagFile: 'test-dag.json',
      maxConcurrentSteps: 1,
      enableLogging: true
    };

    const runtime = await initializeRuntime(config);

    expect(runtime).toBeDefined();
    expect(runtime.config).toEqual(config);
    expect(runtime.scheduler).toBeDefined();
    expect(runtime.warden).toBeDefined();
    expect(runtime.cron).toBeDefined();
  });

  it('should throw on missing projectDir', async () => {
    const config: RuntimeConfig = {
      projectDir: '',
      dagFile: 'test-dag.json',
      maxConcurrentSteps: 1,
      enableLogging: true
    };

    await expect(initializeRuntime(config)).rejects.toThrow('projectDir required');
  });
});
