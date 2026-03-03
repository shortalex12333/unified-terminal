/**
 * ChatGPT DOM Injection Adapter
 *
 * Provides functions to inject text into ChatGPT's input field
 * and trigger message sending via the BrowserView's webContents.
 *
 * Injection Strategies (tried in order):
 * 1. ClipboardEvent paste - Most reliable for contentEditable (ProseMirror)
 * 2. nativeInputValueSetter - For React controlled input elements
 * 3. Keyboard events - Character by character fallback
 */

import { BrowserView, ipcMain, WebContents } from 'electron';
import { CHATGPT_SELECTORS, INJECTION_CONFIG, CAPTURE_CONFIG } from '../utils/dom-selectors';

// ============================================================================
// TYPES
// ============================================================================

export interface InjectionResult {
  success: boolean;
  strategy?: string;
  error?: string;
}

export interface SendResult {
  success: boolean;
  method?: string;
  error?: string;
}

// ============================================================================
// CAPTURE TYPES (Gate 3: Response Capture)
// ============================================================================

export interface CaptureState {
  isCapturing: boolean;
  lastContent: string;
  messageCount: number;
  startTime: number;
  pollIntervalId: NodeJS.Timeout | null;
  lastChunkTime: number;
}

export interface ChunkEvent {
  content: string;
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
  timestamp: number;
  messageIndex: number;
}

export interface CaptureStartResult {
  success: boolean;
  error?: string;
}

export interface CaptureStatusResult {
  isCapturing: boolean;
  lastContent?: string;
  messageCount?: number;
  startTime?: number;
  error?: string;
}

export interface ResponseResult {
  success: boolean;
  content?: string;
  messageCount?: number;
  isGenerating?: boolean;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  error?: string;
}

// ============================================================================
// INJECTION SCRIPT GENERATORS
// ============================================================================

/**
 * Generate JavaScript to find an element using multiple selectors
 */
function generateFindElementScript(selectors: string[], varName: string): string {
  const selectorChecks = selectors
    .map((sel) => `document.querySelector('${sel}')`)
    .join(' || ');
  return `const ${varName} = ${selectorChecks};`;
}

/**
 * Generate the complete injection script
 * This script runs in the ChatGPT page context
 */
function generateInjectionScript(text: string): string {
  // Escape the text for use in JavaScript string
  const escapedText = JSON.stringify(text);

  return `
(async () => {
  const textToInject = ${escapedText};

  // Find input element using multiple selectors
  ${generateFindElementScript(CHATGPT_SELECTORS.textarea, 'inputEl')}

  if (!inputEl) {
    return { success: false, error: 'Input element not found' };
  }

  console.log('[ChatGPT Adapter] Found input element:', inputEl.tagName, inputEl.className);

  // Focus the element first
  inputEl.focus();

  // Strategy 1: ClipboardEvent paste (best for contentEditable/ProseMirror)
  try {
    if (inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true') {
      console.log('[ChatGPT Adapter] Trying clipboard paste strategy for contentEditable');

      // Create a DataTransfer with the text
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', textToInject);

      // Create and dispatch paste event
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });

      inputEl.dispatchEvent(pasteEvent);

      // Verify content was inserted
      await new Promise(resolve => setTimeout(resolve, 50));

      if (inputEl.textContent && inputEl.textContent.includes(textToInject.substring(0, 20))) {
        return { success: true, strategy: 'clipboard-paste' };
      }

      // If paste didn't work, try execCommand
      document.execCommand('insertText', false, textToInject);
      await new Promise(resolve => setTimeout(resolve, 50));

      if (inputEl.textContent && inputEl.textContent.includes(textToInject.substring(0, 20))) {
        return { success: true, strategy: 'execCommand-insertText' };
      }

      // Direct text content manipulation as last resort for contentEditable
      // Using textContent is safe - it treats the string as plain text, not HTML
      inputEl.textContent = textToInject;

      // Trigger input event for React
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));

      return { success: true, strategy: 'direct-textContent' };
    }
  } catch (e) {
    console.log('[ChatGPT Adapter] Clipboard paste strategy failed:', e.message);
  }

  // Strategy 2: nativeInputValueSetter for React controlled inputs
  try {
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      console.log('[ChatGPT Adapter] Trying nativeInputValueSetter strategy');

      // Get the native value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputEl, textToInject);

        // Dispatch events to notify React
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        // Verify
        if (inputEl.value === textToInject) {
          return { success: true, strategy: 'nativeInputValueSetter' };
        }
      }
    }
  } catch (e) {
    console.log('[ChatGPT Adapter] nativeInputValueSetter strategy failed:', e.message);
  }

  // Strategy 3: Keyboard events character by character (fallback)
  try {
    console.log('[ChatGPT Adapter] Trying keyboard events strategy');

    for (const char of textToInject) {
      // KeyboardEvent for keydown/keypress/keyup
      const keydownEvent = new KeyboardEvent('keydown', {
        key: char,
        code: 'Key' + char.toUpperCase(),
        bubbles: true,
        cancelable: true,
      });

      const keypressEvent = new KeyboardEvent('keypress', {
        key: char,
        code: 'Key' + char.toUpperCase(),
        bubbles: true,
        cancelable: true,
      });

      const inputEvent = new InputEvent('input', {
        data: char,
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      });

      const keyupEvent = new KeyboardEvent('keyup', {
        key: char,
        code: 'Key' + char.toUpperCase(),
        bubbles: true,
        cancelable: true,
      });

      inputEl.dispatchEvent(keydownEvent);
      inputEl.dispatchEvent(keypressEvent);

      // For contentEditable, manually append character
      if (inputEl.isContentEditable) {
        document.execCommand('insertText', false, char);
      }

      inputEl.dispatchEvent(inputEvent);
      inputEl.dispatchEvent(keyupEvent);

      // Small delay between characters
      await new Promise(resolve => setTimeout(resolve, ${INJECTION_CONFIG.keystrokeDelay}));
    }

    return { success: true, strategy: 'keyboard-events' };
  } catch (e) {
    console.log('[ChatGPT Adapter] Keyboard events strategy failed:', e.message);
    return { success: false, error: 'All injection strategies failed: ' + e.message };
  }
})();
`;
}

/**
 * Generate the send trigger script
 */
function generateSendScript(): string {
  return `
(async () => {
  // Find send button using multiple selectors
  ${generateFindElementScript(CHATGPT_SELECTORS.sendButton, 'sendBtn')}

  if (sendBtn) {
    console.log('[ChatGPT Adapter] Found send button:', sendBtn.tagName, sendBtn.className);

    // Check if button is disabled
    if (sendBtn.disabled || sendBtn.getAttribute('disabled') !== null) {
      console.log('[ChatGPT Adapter] Send button is disabled, waiting...');

      // Wait for button to become enabled (up to 2 seconds)
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!sendBtn.disabled && sendBtn.getAttribute('disabled') === null) {
          break;
        }
      }
    }

    // Click the button
    sendBtn.click();
    return { success: true, method: 'button-click' };
  }

  console.log('[ChatGPT Adapter] Send button not found, trying Enter key');

  // Fallback: Find input and dispatch Enter keypress
  ${generateFindElementScript(CHATGPT_SELECTORS.textarea, 'inputEl')}

  if (inputEl) {
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });

    inputEl.dispatchEvent(enterEvent);
    return { success: true, method: 'enter-keypress' };
  }

  // Last resort: Find form and submit
  ${generateFindElementScript(CHATGPT_SELECTORS.form, 'formEl')}

  if (formEl) {
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return { success: true, method: 'form-submit' };
  }

  return { success: false, error: 'Could not find send button, input, or form' };
})();
`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Inject text into ChatGPT's input field
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @param text - The text to inject
 * @returns Promise resolving to injection result
 */
export async function injectText(
  webContents: WebContents,
  text: string
): Promise<InjectionResult> {
  console.log('[ChatGPT Adapter] Injecting text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

  try {
    const script = generateInjectionScript(text);
    const result = await webContents.executeJavaScript(script) as InjectionResult;

    console.log('[ChatGPT Adapter] Injection result:', result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ChatGPT Adapter] Injection error:', errorMessage);
    return {
      success: false,
      error: `Injection failed: ${errorMessage}`,
    };
  }
}

/**
 * Trigger message send in ChatGPT
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @returns Promise resolving to send result
 */
export async function triggerSend(webContents: WebContents): Promise<SendResult> {
  console.log('[ChatGPT Adapter] Triggering send');

  try {
    const script = generateSendScript();
    const result = await webContents.executeJavaScript(script) as SendResult;

    console.log('[ChatGPT Adapter] Send result:', result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ChatGPT Adapter] Send error:', errorMessage);
    return {
      success: false,
      error: `Send failed: ${errorMessage}`,
    };
  }
}

/**
 * Inject text and send in one operation with proper delay
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @param text - The text to inject and send
 * @returns Promise resolving to combined result
 */
export async function injectAndSend(
  webContents: WebContents,
  text: string
): Promise<{ injection: InjectionResult; send: SendResult }> {
  console.log('[ChatGPT Adapter] Inject and send:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

  // First inject the text
  const injectionResult = await injectText(webContents, text);

  if (!injectionResult.success) {
    return {
      injection: injectionResult,
      send: { success: false, error: 'Skipped due to injection failure' },
    };
  }

  // Wait for React state to update
  await new Promise((resolve) => setTimeout(resolve, INJECTION_CONFIG.pasteToSendDelay));

  // Then trigger send
  const sendResult = await triggerSend(webContents);

  return {
    injection: injectionResult,
    send: sendResult,
  };
}

/**
 * Check if ChatGPT page is ready for injection
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @returns Promise resolving to readiness status
 */
export async function isPageReady(webContents: WebContents): Promise<boolean> {
  try {
    const script = `
      (() => {
        ${generateFindElementScript(CHATGPT_SELECTORS.textarea, 'inputEl')}
        ${generateFindElementScript(CHATGPT_SELECTORS.chatContainer, 'containerEl')}
        return !!(inputEl && containerEl);
      })();
    `;

    const ready = await webContents.executeJavaScript(script);
    console.log('[ChatGPT Adapter] Page ready:', ready);
    return ready;
  } catch (error) {
    console.error('[ChatGPT Adapter] Page ready check error:', error);
    return false;
  }
}

/**
 * Wait for ChatGPT page to be ready for injection
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @param timeout - Maximum wait time in milliseconds
 * @returns Promise resolving to true if ready, false if timeout
 */
export async function waitForPageReady(
  webContents: WebContents,
  timeout: number = INJECTION_CONFIG.inputWaitTimeout
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await isPageReady(webContents)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, INJECTION_CONFIG.inputPollInterval));
  }

  console.warn('[ChatGPT Adapter] Timeout waiting for page ready');
  return false;
}

/**
 * Get the current content of ChatGPT's input field
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @returns Promise resolving to current input content
 */
export async function getInputContent(webContents: WebContents): Promise<string> {
  try {
    const script = `
      (() => {
        ${generateFindElementScript(CHATGPT_SELECTORS.textarea, 'inputEl')}
        if (!inputEl) return '';

        // For contentEditable
        if (inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true') {
          return inputEl.textContent || inputEl.innerText || '';
        }

        // For textarea/input
        return inputEl.value || '';
      })();
    `;

    return await webContents.executeJavaScript(script) as string;
  } catch (error) {
    console.error('[ChatGPT Adapter] Get input content error:', error);
    return '';
  }
}

/**
 * Clear ChatGPT's input field
 *
 * @param webContents - The WebContents of the ChatGPT BrowserView
 * @returns Promise resolving to success status
 */
export async function clearInput(webContents: WebContents): Promise<boolean> {
  try {
    const script = `
      (() => {
        ${generateFindElementScript(CHATGPT_SELECTORS.textarea, 'inputEl')}
        if (!inputEl) return false;

        inputEl.focus();

        // For contentEditable - use textContent for safe clearing
        if (inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true') {
          inputEl.textContent = '';
          inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
          return true;
        }

        // For textarea/input
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeSetter) {
          nativeSetter.call(inputEl, '');
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }

        inputEl.value = '';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })();
    `;

    return await webContents.executeJavaScript(script) as boolean;
  } catch (error) {
    console.error('[ChatGPT Adapter] Clear input error:', error);
    return false;
  }
}

// ============================================================================
// RESPONSE CAPTURE (Gate 3)
// ============================================================================

/**
 * Build selectors string for querySelector
 */
function buildSelectorString(selectors: string[]): string {
  return selectors.join(', ');
}

/**
 * Generate JavaScript code to capture response state.
 * This is executed via executeJavaScript polling.
 */
function generateCaptureScript(): string {
  const responseSelectors = buildSelectorString(CHATGPT_SELECTORS.responseContainer);
  const markdownSelectors = buildSelectorString(CHATGPT_SELECTORS.markdownContent);
  const stopButtonSelectors = buildSelectorString(CHATGPT_SELECTORS.stopButton);
  const regenerateSelectors = buildSelectorString(CHATGPT_SELECTORS.regenerateButton);
  const errorSelectors = buildSelectorString(CHATGPT_SELECTORS.errorMessage);

  return `
    (function() {
      try {
        // Find all assistant response containers
        const responseContainers = document.querySelectorAll('${responseSelectors}');
        const lastResponse = responseContainers[responseContainers.length - 1];

        // Check for stop button (indicates still generating)
        const stopButton = document.querySelector('${stopButtonSelectors}');
        const isGenerating = stopButton !== null;

        // Check for regenerate button (indicates completed)
        const regenerateButton = document.querySelector('${regenerateSelectors}');
        const hasRegenerateButton = regenerateButton !== null;

        // Check for errors
        const errorElement = document.querySelector('${errorSelectors}');
        const hasError = errorElement !== null;
        const errorText = hasError ? errorElement.innerText : null;

        // Extract content from last response
        let content = '';
        if (lastResponse) {
          // Try to get markdown content first for cleaner output
          const markdown = lastResponse.querySelector('${markdownSelectors}');
          if (markdown) {
            content = markdown.innerHTML;
          } else {
            content = lastResponse.innerHTML;
          }
        }

        return {
          content: content,
          messageCount: responseContainers.length,
          isGenerating: isGenerating,
          isComplete: !isGenerating && (hasRegenerateButton || content.length > 0),
          hasError: hasError,
          errorText: errorText,
          timestamp: Date.now()
        };
      } catch (err) {
        return {
          content: '',
          messageCount: 0,
          isGenerating: false,
          isComplete: false,
          hasError: true,
          errorText: err.message,
          timestamp: Date.now()
        };
      }
    })();
  `;
}

// ============================================================================
// CAPTURE STATE MANAGEMENT
// ============================================================================

const captureStates = new Map<number, CaptureState>();

/**
 * Get or create capture state for a webContents
 */
function getCaptureState(webContentsId: number): CaptureState {
  if (!captureStates.has(webContentsId)) {
    captureStates.set(webContentsId, {
      isCapturing: false,
      lastContent: '',
      messageCount: 0,
      startTime: 0,
      pollIntervalId: null,
      lastChunkTime: 0,
    });
  }
  return captureStates.get(webContentsId)!;
}

/**
 * Clean up capture state
 */
function cleanupCaptureState(webContentsId: number): void {
  const state = captureStates.get(webContentsId);
  if (state?.pollIntervalId) {
    clearInterval(state.pollIntervalId);
  }
  captureStates.delete(webContentsId);
}

// ============================================================================
// CAPTURE FUNCTIONS
// ============================================================================

/**
 * Start capturing responses from ChatGPT
 */
async function startCapture(
  webContents: WebContents,
  onChunk: (chunk: ChunkEvent) => void
): Promise<CaptureStartResult> {
  const webContentsId = webContents.id;
  const state = getCaptureState(webContentsId);

  // Don't start if already capturing
  if (state.isCapturing) {
    return { success: false, error: 'Already capturing' };
  }

  // Initialize capture state
  state.isCapturing = true;
  state.lastContent = '';
  state.messageCount = 0;
  state.startTime = Date.now();
  state.lastChunkTime = 0;

  const captureScript = generateCaptureScript();

  // Start polling
  state.pollIntervalId = setInterval(async () => {
    if (!state.isCapturing) {
      cleanupCaptureState(webContentsId);
      return;
    }

    try {
      const result = await webContents.executeJavaScript(captureScript);

      // Debounce chunk emissions
      const now = Date.now();
      const timeSinceLastChunk = now - state.lastChunkTime;

      // Check if content has changed enough to emit
      const contentChanged = result.content !== state.lastContent;
      const contentDelta = Math.abs(result.content.length - state.lastContent.length);
      const shouldEmit =
        contentChanged &&
        (contentDelta >= CAPTURE_CONFIG.minChunkDelta ||
          timeSinceLastChunk >= CAPTURE_CONFIG.chunkDebounce);

      if (shouldEmit || result.hasError || result.isComplete) {
        state.lastContent = result.content;
        state.messageCount = result.messageCount;
        state.lastChunkTime = now;

        const chunk: ChunkEvent = {
          content: result.content,
          isComplete: result.isComplete,
          hasError: result.hasError,
          errorMessage: result.errorText,
          timestamp: now,
          messageIndex: result.messageCount - 1,
        };

        onChunk(chunk);

        // Stop capturing if complete or error
        if (result.isComplete || result.hasError) {
          // Wait a bit to confirm completion
          setTimeout(() => {
            stopCapture(webContentsId);
          }, CAPTURE_CONFIG.completionConfirmDelay);
        }
      }

      // Check for timeout
      if (now - state.startTime > CAPTURE_CONFIG.responseStartTimeout) {
        if (state.lastContent === '') {
          // No response started, timeout
          onChunk({
            content: '',
            isComplete: true,
            hasError: true,
            errorMessage: 'Response timeout - no content received',
            timestamp: now,
            messageIndex: -1,
          });
          stopCapture(webContentsId);
        }
      }
    } catch (err) {
      console.error('[ChatGPT Adapter] Polling error:', err);
      // Don't stop on transient errors, just log them
    }
  }, CAPTURE_CONFIG.pollInterval);

  console.log('[ChatGPT Adapter] Started capture for webContents:', webContentsId);
  return { success: true };
}

/**
 * Stop capturing responses
 */
function stopCapture(webContentsId: number): void {
  const state = captureStates.get(webContentsId);
  if (state) {
    state.isCapturing = false;
    if (state.pollIntervalId) {
      clearInterval(state.pollIntervalId);
      state.pollIntervalId = null;
    }
    console.log('[ChatGPT Adapter] Stopped capture for webContents:', webContentsId);
  }
}

/**
 * Check if currently capturing
 */
function isCapturing(webContentsId: number): boolean {
  const state = captureStates.get(webContentsId);
  return state?.isCapturing ?? false;
}

/**
 * Get current response content (one-shot, no streaming)
 */
async function getResponse(webContents: WebContents): Promise<ResponseResult> {
  try {
    const captureScript = generateCaptureScript();
    const result = await webContents.executeJavaScript(captureScript);
    return {
      success: true,
      content: result.content,
      messageCount: result.messageCount,
      isGenerating: result.isGenerating,
      isComplete: result.isComplete,
      hasError: result.hasError,
      errorMessage: result.errorText,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// IPC HANDLER SETUP
// ============================================================================

/**
 * Set up IPC handlers for capture commands.
 * Call this from main process initialization.
 */
export function setupCaptureIPC(getBrowserView: () => BrowserView | null): void {
  // Handler to start capture
  ipcMain.handle('chatgpt:capture-start', async (event) => {
    const view = getBrowserView();
    if (!view) {
      return { success: false, error: 'No BrowserView available' };
    }

    const webContents = view.webContents;

    return startCapture(webContents, (chunk) => {
      // Send chunk to the renderer that requested capture
      try {
        event.sender.send('chatgpt:chunk', chunk);

        // Also send complete event if done
        if (chunk.isComplete) {
          event.sender.send('chatgpt:complete', {
            content: chunk.content,
            hasError: chunk.hasError,
            errorMessage: chunk.errorMessage,
            timestamp: chunk.timestamp,
          });
        }
      } catch (err) {
        console.error('[ChatGPT Adapter] Failed to send chunk to renderer:', err);
      }
    });
  });

  // Handler to stop capture
  ipcMain.handle('chatgpt:capture-stop', async () => {
    const view = getBrowserView();
    if (!view) {
      return { success: false, error: 'No BrowserView available' };
    }

    stopCapture(view.webContents.id);
    return { success: true };
  });

  // Handler to check capture status
  ipcMain.handle('chatgpt:capture-status', async (): Promise<CaptureStatusResult> => {
    const view = getBrowserView();
    if (!view) {
      return { isCapturing: false, error: 'No BrowserView available' };
    }

    const state = getCaptureState(view.webContents.id);
    return {
      isCapturing: state.isCapturing,
      lastContent: state.lastContent,
      messageCount: state.messageCount,
      startTime: state.startTime,
    };
  });

  // Handler to get current response content (one-shot, no streaming)
  ipcMain.handle('chatgpt:get-response', async (): Promise<ResponseResult> => {
    const view = getBrowserView();
    if (!view) {
      return { success: false, error: 'No BrowserView available' };
    }

    return getResponse(view.webContents);
  });

  console.log('[ChatGPT Adapter] Capture IPC handlers registered');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  startCapture,
  stopCapture,
  isCapturing,
  getCaptureState,
  cleanupCaptureState,
  generateCaptureScript,
  getResponse,
};
