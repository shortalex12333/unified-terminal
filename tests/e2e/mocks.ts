/**
 * E2E Test Mocks
 *
 * Mock ChatGPT DOM structures, CLI responses, rate limit content,
 * malformed output, and timeout errors for automated E2E testing.
 *
 * No Gemini mocks -- Gemini is SHELVED.
 */

// ============================================================================
// MOCK CHATGPT DOM
// ============================================================================

/**
 * Mock ChatGPT DOM structure with input field, send button, and response container.
 * Selectors match those defined in src/utils/dom-selectors.ts.
 */
export interface MockDOMElement {
  tagName: string;
  id?: string;
  className?: string;
  attributes: Record<string, string>;
  textContent: string;
  value?: string;
  isContentEditable?: boolean;
  disabled?: boolean;
  children: MockDOMElement[];
}

export interface MockChatGPTDOM {
  inputField: MockDOMElement;
  submitButton: MockDOMElement;
  responseContainer: MockDOMElement;
  form: MockDOMElement;
  chatContainer: MockDOMElement;
}

/**
 * Returns a mock ChatGPT DOM structure matching the selectors in dom-selectors.ts.
 */
export function mockChatGPTDOM(): MockChatGPTDOM {
  const inputField: MockDOMElement = {
    tagName: 'DIV',
    id: 'prompt-textarea',
    className: 'ProseMirror',
    attributes: {
      'contenteditable': 'true',
      'data-placeholder': 'Message ChatGPT',
      'role': 'textbox',
    },
    textContent: '',
    isContentEditable: true,
    children: [],
  };

  const submitButton: MockDOMElement = {
    tagName: 'BUTTON',
    attributes: {
      'data-testid': 'send-button',
      'aria-label': 'Send prompt',
      'type': 'submit',
    },
    textContent: '',
    disabled: false,
    children: [],
  };

  const responseContainer: MockDOMElement = {
    tagName: 'DIV',
    attributes: {
      'data-message-author-role': 'assistant',
    },
    className: 'agent-turn',
    textContent: 'Hello! How can I help you today?',
    children: [
      {
        tagName: 'DIV',
        className: 'markdown prose',
        attributes: {},
        textContent: 'Hello! How can I help you today?',
        children: [],
      },
    ],
  };

  const form: MockDOMElement = {
    tagName: 'FORM',
    className: 'stretch',
    attributes: {},
    textContent: '',
    children: [inputField, submitButton],
  };

  const chatContainer: MockDOMElement = {
    tagName: 'MAIN',
    attributes: {
      'role': 'presentation',
    },
    className: 'conversation',
    textContent: '',
    children: [responseContainer],
  };

  return { inputField, submitButton, responseContainer, form, chatContainer };
}

// ============================================================================
// MOCK CLI RESPONSES
// ============================================================================

/**
 * Returns mock successful CLI output for the specified runtime.
 * Codex returns JSONL with files_modified; Claude returns structured JSON with result.
 */
export function mockCLIResponse(runtime: 'codex' | 'claude'): string {
  if (runtime === 'codex') {
    return [
      '{"type":"tool_call","name":"write","arguments":{"path":"src/app.ts"}}',
      '{"type":"tool_call","name":"edit","arguments":{"path":"src/index.ts"}}',
      '{"type":"turn.completed","usage":{"input_tokens":1200,"output_tokens":800}}',
    ].join('\n');
  }

  // Claude Code JSON output
  return [
    '{"type":"tool_use","name":"Write","input":{"file_path":"src/component.tsx"}}',
    '{"type":"tool_use","name":"Edit","input":{"file_path":"src/styles.css"}}',
    '{"type":"result","usage":{"input_tokens":900,"output_tokens":600}}',
  ].join('\n');
}

// ============================================================================
// MOCK RATE LIMIT DOM
// ============================================================================

/**
 * Returns DOM content simulating a ChatGPT rate limit message.
 * Contains the text pattern that RateLimitRecovery.isRateLimited() detects.
 */
export function mockRateLimitDOM(): string {
  return "You've reached your message limit for GPT-4. " +
    "Please try again after 1:23 PM. " +
    "You can still use GPT-3.5 or switch to a different plan.";
}

// ============================================================================
// MOCK ERROR OUTPUTS
// ============================================================================

/**
 * Returns garbled/incomplete CLI output for error classification testing.
 * Simulates a process that crashed mid-output.
 */
export function mockMalformedOutput(): string {
  return [
    '{"type":"tool_call","name":"write","arguments":{',
    'SEGFAULT: memory access violation at 0xDEADBEEF',
    '--- cut here ---',
    '{"type":"incomplete_json_no_closing_brace',
    '',
    'ERR! Process exited with code 139 (SIGSEGV)',
  ].join('\n');
}

/**
 * Returns a timeout error object simulating a CLI process that exceeded its time limit.
 */
export function mockTimeoutError(): {
  status: 'timeout';
  error: string;
  exitCode: null;
  duration: number;
} {
  return {
    status: 'timeout',
    error: 'Timeout after 120000ms',
    exitCode: null,
    duration: 120_000,
  };
}

// ============================================================================
// MOCK AGENT CONFIGS
// ============================================================================

/**
 * Returns a minimal AgentConfig for testing adapter dispatch.
 */
export function mockAgentConfig(runtime: 'codex' | 'claude'): {
  id: string;
  name: string;
  role: string;
  model: string;
  tools: string[];
  maxTokens: number;
  prompt: string;
  declaredFiles: string[];
  workingDir: string;
  timeout: number;
} {
  return {
    id: `test-${runtime}-${Date.now()}`,
    name: `test-${runtime}`,
    role: 'executor',
    model: runtime === 'codex' ? 'gpt-5-codex' : 'claude-sonnet-4-6',
    tools: ['read', 'write', 'bash'],
    maxTokens: 4000,
    prompt: 'Test prompt for E2E dispatch verification',
    declaredFiles: ['src/app.ts'],
    workingDir: '/tmp/e2e-test',
    timeout: 30_000,
  };
}
