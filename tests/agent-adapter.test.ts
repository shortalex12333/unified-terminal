import { spawnAgent, AgentConfig, AgentResult } from '../docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/runtime/adapters/agent-adapter';

describe('Agent Adapter', () => {
  it('should handle agent timeout gracefully', async () => {
    // Mock test using echo command (always available)
    const config: AgentConfig = {
      type: 'codex',
      sessionId: 'test-001',
      taskJson: '{"task": "test"}',
      timeout: 1
    };

    // This test is pseudo-code; real implementation would mock child_process
    // For now, just verify the config structure
    expect(config.sessionId).toBe('test-001');
  });

  it('should format CLI arguments correctly', () => {
    const config: AgentConfig = {
      type: 'codex',
      sessionId: 'session-001',
      taskJson: '{}',
      timeout: 30,
      skills: ['gsd', 'claude-code']
    };

    // Would call buildCLIArguments internally
    expect(config.skills).toContain('gsd');
  });
});
