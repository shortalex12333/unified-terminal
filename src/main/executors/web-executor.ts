/**
 * Web Executor for ChatGPT BrowserView
 *
 * Sends prompts to ChatGPT via DOM injection and captures responses,
 * including DALL-E generated images. Handles rate limiting detection
 * and provides structured results for the scheduler.
 */

import { BrowserView, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { CHATGPT_SELECTORS, INJECTION_CONFIG, CAPTURE_CONFIG } from '../../utils/dom-selectors';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action types that determine how the executor handles the step.
 */
export type ActionType =
  | 'direct_answer'  // Simple Q&A
  | 'intake_quiz'    // Requirements gathering
  | 'web_search'     // Research
  | 'dall_e'         // Image generation
  | 'canvas'         // Document editing
  | 'content';       // Writing tasks

/**
 * A runtime step to be executed via ChatGPT.
 */
export interface RuntimeStep {
  /** Unique identifier for this step */
  id: string;

  /** The prompt to send to ChatGPT */
  prompt: string;

  /** Type of action determining execution strategy */
  action: ActionType;

  /** Project directory for saving assets */
  projectDir?: string;

  /** Optional timeout override in milliseconds */
  timeout?: number;

  /** Optional context from previous steps */
  context?: string;
}

/**
 * Result from executing a web step.
 */
export interface WebResult {
  /** Whether the execution succeeded */
  success: boolean;

  /** The response text from ChatGPT */
  response: string;

  /** Local file paths for downloaded images */
  images: string[];

  /** Error message if execution failed */
  error?: string;

  /** Error type for scheduler routing decisions */
  errorType?: 'rate_limit' | 'timeout' | 'dom_error' | 'network' | 'unknown';

  /** Time taken in milliseconds */
  duration?: number;

  /** Whether response is still generating (for streaming) */
  isGenerating?: boolean;
}

/**
 * Executor interface for polymorphic execution strategies.
 */
export interface Executor {
  execute(step: RuntimeStep): Promise<WebResult>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * DOM selectors for ChatGPT elements.
 */
const SELECTORS = {
  textArea: '#prompt-textarea',
  sendButton: 'button[data-testid="send-button"]',
  assistantMessage: 'div[data-message-author-role="assistant"]',
  stopButton: 'button[aria-label="Stop generating"]',
  regenerateButton: 'button[data-testid="regenerate-button"]',
  errorContainer: '.text-red-500, [data-testid="rate-limit-error"], .error-message',
};

/**
 * Patterns that indicate rate limiting.
 */
const RATE_LIMIT_PATTERNS = [
  /you['']ve reached (the|your) (message |usage )?limit/i,
  /too many (messages|requests)/i,
  /rate limit/i,
  /please try again (later|in)/i,
  /usage cap/i,
  /limit reached/i,
  /slow down/i,
  /wait (a moment|a bit|before)/i,
];

/**
 * Default timeouts for different action types.
 */
const ACTION_TIMEOUTS: Record<ActionType, number> = {
  direct_answer: 60000,      // 1 minute
  intake_quiz: 90000,        // 1.5 minutes
  web_search: 120000,        // 2 minutes (can be slow)
  dall_e: 180000,            // 3 minutes (image gen is slow)
  canvas: 120000,            // 2 minutes
  content: 120000,           // 2 minutes
};

/**
 * Polling configuration.
 */
const POLL_CONFIG = {
  interval: 200,              // Check every 200ms
  stabilityChecks: 3,         // Number of stable checks before considering complete
  stabilityDelay: 500,        // Delay between stability checks
  maxPollAttempts: 600,       // Max attempts (200ms * 600 = 2 minutes default)
};

// ============================================================================
// WEB EXECUTOR CLASS
// ============================================================================

/**
 * WebExecutor sends prompts to ChatGPT via BrowserView and captures responses.
 */
export class WebExecutor implements Executor {
  private view: BrowserView;
  private lastMessageCount: number = 0;

  /**
   * Create a new WebExecutor.
   * @param view - The BrowserView containing ChatGPT
   */
  constructor(view: BrowserView) {
    this.view = view;
  }

  /**
   * Execute a runtime step via ChatGPT.
   * @param step - The step to execute
   * @returns Promise resolving to WebResult
   */
  async execute(step: RuntimeStep): Promise<WebResult> {
    const startTime = Date.now();
    const timeout = step.timeout || ACTION_TIMEOUTS[step.action] || 120000;

    console.log(`[WebExecutor] Executing step: ${step.id}, action: ${step.action}`);

    try {
      // Check if page is ready
      const ready = await this.waitForPageReady(5000);
      if (!ready) {
        return {
          success: false,
          response: '',
          images: [],
          error: 'ChatGPT page not ready for input',
          errorType: 'dom_error',
          duration: Date.now() - startTime,
        };
      }

      // Get current message count before sending
      this.lastMessageCount = await this.getMessageCount();

      // Inject the prompt
      const injectionResult = await this.injectMessage(step.prompt);
      if (!injectionResult.success) {
        return {
          success: false,
          response: '',
          images: [],
          error: injectionResult.error || 'Failed to inject message',
          errorType: 'dom_error',
          duration: Date.now() - startTime,
        };
      }

      // Wait for response to complete
      const responseResult = await this.waitForResponse(timeout);

      // Check for rate limiting
      if (responseResult.isRateLimited) {
        return {
          success: false,
          response: responseResult.text || '',
          images: [],
          error: 'Rate limit detected',
          errorType: 'rate_limit',
          duration: Date.now() - startTime,
        };
      }

      // Check for errors
      if (responseResult.hasError) {
        return {
          success: false,
          response: responseResult.text || '',
          images: [],
          error: responseResult.errorMessage || 'Unknown error occurred',
          errorType: 'unknown',
          duration: Date.now() - startTime,
        };
      }

      // Capture the final response
      const response = await this.captureResponse();

      // Extract and download images if this is a DALL-E action
      let images: string[] = [];
      if (step.action === 'dall_e' && step.projectDir) {
        const imageUrls = await this.extractImageUrls();
        if (imageUrls.length > 0) {
          images = await this.downloadImages(imageUrls, step.projectDir);
        }
      }

      return {
        success: true,
        response,
        images,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[WebExecutor] Error executing step ${step.id}:`, errorMessage);

      // Determine error type
      let errorType: WebResult['errorType'] = 'unknown';
      if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorType = 'network';
      }

      return {
        success: false,
        response: '',
        images: [],
        error: errorMessage,
        errorType,
        duration: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // MESSAGE INJECTION
  // ==========================================================================

  /**
   * Inject a prompt into ChatGPT's input field and click send.
   */
  private async injectMessage(prompt: string): Promise<{ success: boolean; error?: string }> {
    console.log('[WebExecutor] Injecting message:', prompt.substring(0, 50) + '...');

    try {
      const escapedPrompt = JSON.stringify(prompt);

      // Injection script using multiple strategies
      const script = `
        (async () => {
          const textToInject = ${escapedPrompt};

          // Find input element using multiple selectors
          const selectors = ${JSON.stringify(CHATGPT_SELECTORS.textarea)};
          let inputEl = null;
          for (const sel of selectors) {
            inputEl = document.querySelector(sel);
            if (inputEl) break;
          }

          if (!inputEl) {
            return { success: false, error: 'Input element not found' };
          }

          // Focus the element
          inputEl.focus();

          // Strategy: ClipboardEvent paste for contentEditable
          if (inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true') {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', textToInject);

            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dataTransfer,
            });

            inputEl.dispatchEvent(pasteEvent);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify content was inserted
            if (inputEl.textContent && inputEl.textContent.includes(textToInject.substring(0, 20))) {
              return { success: true, strategy: 'clipboard-paste' };
            }

            // Fallback: execCommand
            document.execCommand('insertText', false, textToInject);
            await new Promise(resolve => setTimeout(resolve, 50));

            if (inputEl.textContent && inputEl.textContent.includes(textToInject.substring(0, 20))) {
              return { success: true, strategy: 'execCommand' };
            }

            // Last resort: direct textContent
            inputEl.textContent = textToInject;
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
            return { success: true, strategy: 'direct-textContent' };
          }

          // Strategy: nativeInputValueSetter for textarea/input
          if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              'value'
            )?.set || Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            )?.set;

            if (nativeSetter) {
              nativeSetter.call(inputEl, textToInject);
              inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true, strategy: 'nativeInputValueSetter' };
            }
          }

          return { success: false, error: 'No injection strategy succeeded' };
        })();
      `;

      const injectionResult = await this.view.webContents.executeJavaScript(script);

      if (!injectionResult.success) {
        return { success: false, error: injectionResult.error };
      }

      // Wait for React state update
      await this.delay(INJECTION_CONFIG.pasteToSendDelay);

      // Click send button
      const sendResult = await this.clickSendButton();

      return sendResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Injection failed: ${errorMessage}` };
    }
  }

  /**
   * Click the send button to submit the message.
   */
  private async clickSendButton(): Promise<{ success: boolean; error?: string }> {
    const script = `
      (async () => {
        // Find send button using multiple selectors
        const selectors = ${JSON.stringify(CHATGPT_SELECTORS.sendButton)};
        let sendBtn = null;
        for (const sel of selectors) {
          sendBtn = document.querySelector(sel);
          if (sendBtn) break;
        }

        if (sendBtn) {
          // Wait for button to be enabled (up to 2 seconds)
          for (let i = 0; i < 20; i++) {
            if (!sendBtn.disabled && sendBtn.getAttribute('disabled') === null) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          sendBtn.click();
          return { success: true, method: 'button-click' };
        }

        // Fallback: Enter key on input
        const textareaSelectors = ${JSON.stringify(CHATGPT_SELECTORS.textarea)};
        let inputEl = null;
        for (const sel of textareaSelectors) {
          inputEl = document.querySelector(sel);
          if (inputEl) break;
        }

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

        return { success: false, error: 'Could not find send button or input' };
      })();
    `;

    try {
      const result = await this.view.webContents.executeJavaScript(script);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Send failed: ${errorMessage}` };
    }
  }

  // ==========================================================================
  // RESPONSE WAITING & CAPTURE
  // ==========================================================================

  /**
   * Wait for ChatGPT to finish generating a response.
   */
  private async waitForResponse(timeout: number): Promise<{
    success: boolean;
    text?: string;
    hasError: boolean;
    errorMessage?: string;
    isRateLimited: boolean;
  }> {
    const startTime = Date.now();
    let stableCount = 0;
    let lastContent = '';
    let lastContentLength = 0;

    console.log('[WebExecutor] Waiting for response...');

    while (Date.now() - startTime < timeout) {
      const state = await this.getResponseState();

      // Check for rate limiting first
      if (state.hasError && state.errorText) {
        const isRateLimited = RATE_LIMIT_PATTERNS.some(pattern =>
          pattern.test(state.errorText || '')
        );

        if (isRateLimited) {
          console.log('[WebExecutor] Rate limit detected');
          return {
            success: false,
            text: state.errorText,
            hasError: true,
            errorMessage: state.errorText,
            isRateLimited: true,
          };
        }
      }

      // Check if still generating
      if (state.isGenerating) {
        stableCount = 0;
        lastContent = state.content;
        lastContentLength = state.content.length;
        await this.delay(POLL_CONFIG.interval);
        continue;
      }

      // Check if new message appeared
      if (state.messageCount > this.lastMessageCount) {
        // Response started, check for stability
        if (state.content.length > 0 && state.content.length === lastContentLength) {
          stableCount++;
          if (stableCount >= POLL_CONFIG.stabilityChecks) {
            console.log('[WebExecutor] Response stable, completing');
            return {
              success: true,
              text: state.content,
              hasError: state.hasError,
              errorMessage: state.errorText,
              isRateLimited: false,
            };
          }
          await this.delay(POLL_CONFIG.stabilityDelay);
        } else {
          stableCount = 0;
          lastContentLength = state.content.length;
          await this.delay(POLL_CONFIG.interval);
        }
        continue;
      }

      // Check for error without new message
      if (state.hasError) {
        return {
          success: false,
          text: state.errorText,
          hasError: true,
          errorMessage: state.errorText,
          isRateLimited: false,
        };
      }

      await this.delay(POLL_CONFIG.interval);
    }

    // Timeout reached
    console.log('[WebExecutor] Response timeout');
    return {
      success: false,
      hasError: true,
      errorMessage: 'Response timeout',
      isRateLimited: false,
    };
  }

  /**
   * Get the current state of ChatGPT's response.
   */
  private async getResponseState(): Promise<{
    content: string;
    messageCount: number;
    isGenerating: boolean;
    hasError: boolean;
    errorText?: string;
  }> {
    const script = `
      (function() {
        try {
          // Find all assistant response containers
          const responseSelectors = ${JSON.stringify(CHATGPT_SELECTORS.responseContainer)}.join(', ');
          const responseContainers = document.querySelectorAll(responseSelectors);
          const lastResponse = responseContainers[responseContainers.length - 1];

          // Check for stop button (indicates still generating)
          const stopSelectors = ${JSON.stringify(CHATGPT_SELECTORS.stopButton)}.join(', ');
          const stopButton = document.querySelector(stopSelectors);
          const isGenerating = stopButton !== null;

          // Check for errors
          const errorSelectors = ${JSON.stringify(CHATGPT_SELECTORS.errorMessage)}.join(', ');
          const errorElement = document.querySelector(errorSelectors);
          const hasError = errorElement !== null;
          const errorText = hasError ? errorElement.innerText : null;

          // Extract content from last response
          let content = '';
          if (lastResponse) {
            const markdownSelectors = ${JSON.stringify(CHATGPT_SELECTORS.markdownContent)}.join(', ');
            const markdown = lastResponse.querySelector(markdownSelectors);
            if (markdown) {
              content = markdown.innerText || markdown.textContent || '';
            } else {
              content = lastResponse.innerText || lastResponse.textContent || '';
            }
          }

          return {
            content: content,
            messageCount: responseContainers.length,
            isGenerating: isGenerating,
            hasError: hasError,
            errorText: errorText
          };
        } catch (err) {
          return {
            content: '',
            messageCount: 0,
            isGenerating: false,
            hasError: true,
            errorText: err.message
          };
        }
      })();
    `;

    try {
      return await this.view.webContents.executeJavaScript(script);
    } catch (error) {
      return {
        content: '',
        messageCount: 0,
        isGenerating: false,
        hasError: true,
        errorText: error instanceof Error ? error.message : 'Failed to get response state',
      };
    }
  }

  /**
   * Capture the final response text from ChatGPT.
   */
  private async captureResponse(): Promise<string> {
    const script = `
      (function() {
        const responseSelectors = ${JSON.stringify(CHATGPT_SELECTORS.responseContainer)}.join(', ');
        const responseContainers = document.querySelectorAll(responseSelectors);
        const lastResponse = responseContainers[responseContainers.length - 1];

        if (!lastResponse) return '';

        // Try to get clean markdown content
        const markdownSelectors = ${JSON.stringify(CHATGPT_SELECTORS.markdownContent)}.join(', ');
        const markdown = lastResponse.querySelector(markdownSelectors);

        if (markdown) {
          return markdown.innerText || markdown.textContent || '';
        }

        return lastResponse.innerText || lastResponse.textContent || '';
      })();
    `;

    try {
      const response = await this.view.webContents.executeJavaScript(script);
      return response || '';
    } catch (error) {
      console.error('[WebExecutor] Failed to capture response:', error);
      return '';
    }
  }

  /**
   * Get the current count of assistant messages.
   */
  private async getMessageCount(): Promise<number> {
    const script = `
      (function() {
        const responseSelectors = ${JSON.stringify(CHATGPT_SELECTORS.responseContainer)}.join(', ');
        return document.querySelectorAll(responseSelectors).length;
      })();
    `;

    try {
      return await this.view.webContents.executeJavaScript(script);
    } catch (error) {
      return 0;
    }
  }

  // ==========================================================================
  // IMAGE EXTRACTION & DOWNLOAD
  // ==========================================================================

  /**
   * Extract DALL-E image URLs from the last assistant message.
   */
  private async extractImageUrls(): Promise<string[]> {
    const script = `
      (function() {
        const responseSelectors = ${JSON.stringify(CHATGPT_SELECTORS.responseContainer)}.join(', ');
        const lastResponse = document.querySelector(responseSelectors + ':last-of-type');

        if (!lastResponse) return [];

        const images = lastResponse.querySelectorAll('img');
        return Array.from(images)
          .filter(img => {
            // Filter for DALL-E images
            const src = img.src || '';
            const isDALLE = src.includes('dalle') ||
                           src.includes('oaidalleapi') ||
                           src.includes('openai') ||
                           src.includes('blob:');

            // Also include large images that might be generated
            const isLarge = img.naturalWidth > 256 || img.width > 256;

            return isDALLE || isLarge;
          })
          .map(img => img.src)
          .filter(src => src && src.length > 0);
      })();
    `;

    try {
      const urls = await this.view.webContents.executeJavaScript(script);
      console.log('[WebExecutor] Extracted image URLs:', urls);
      return urls || [];
    } catch (error) {
      console.error('[WebExecutor] Failed to extract image URLs:', error);
      return [];
    }
  }

  /**
   * Download images to the project assets directory.
   */
  private async downloadImages(urls: string[], projectDir: string): Promise<string[]> {
    const assetsDir = path.join(projectDir, 'assets');

    // Ensure assets directory exists
    try {
      await fs.promises.mkdir(assetsDir, { recursive: true });
    } catch (error) {
      console.error('[WebExecutor] Failed to create assets directory:', error);
      return [];
    }

    const downloadedPaths: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      try {
        // Handle blob URLs by capturing from canvas
        if (url.startsWith('blob:')) {
          const blobPath = await this.downloadBlobImage(url, assetsDir, i);
          if (blobPath) {
            downloadedPaths.push(blobPath);
          }
          continue;
        }

        // Regular URL download
        const filePath = await this.downloadToAssets(url, assetsDir, i);
        if (filePath) {
          downloadedPaths.push(filePath);
        }
      } catch (error) {
        console.error(`[WebExecutor] Failed to download image ${i}:`, error);
      }
    }

    return downloadedPaths;
  }

  /**
   * Download a blob image by converting it in the browser context.
   */
  private async downloadBlobImage(blobUrl: string, assetsDir: string, index: number): Promise<string | null> {
    try {
      // Convert blob to base64 in browser context
      const script = `
        (async function() {
          const response = await fetch('${blobUrl}');
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })();
      `;

      const dataUrl = await this.view.webContents.executeJavaScript(script);

      if (!dataUrl || typeof dataUrl !== 'string') {
        return null;
      }

      // Extract base64 data and extension
      const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return null;
      }

      const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const base64Data = matches[2];
      const fileName = `dalle_${Date.now()}_${index}.${extension}`;
      const filePath = path.join(assetsDir, fileName);

      // Write file
      await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
      console.log(`[WebExecutor] Downloaded blob image to: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('[WebExecutor] Failed to download blob image:', error);
      return null;
    }
  }

  /**
   * Download an image from a URL to the assets directory.
   */
  private async downloadToAssets(imageUrl: string, assetsDir: string, index: number): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(imageUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        // Determine file extension from URL or default to png
        let extension = 'png';
        const urlPath = parsedUrl.pathname;
        const extMatch = urlPath.match(/\.(\w+)$/);
        if (extMatch) {
          extension = extMatch[1].toLowerCase();
        }

        const fileName = `dalle_${Date.now()}_${index}.${extension}`;
        const filePath = path.join(assetsDir, fileName);
        const fileStream = fs.createWriteStream(filePath);

        protocol.get(imageUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              this.downloadToAssets(redirectUrl, assetsDir, index).then(resolve);
              return;
            }
          }

          if (response.statusCode !== 200) {
            console.error(`[WebExecutor] Failed to download image: HTTP ${response.statusCode}`);
            resolve(null);
            return;
          }

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            console.log(`[WebExecutor] Downloaded image to: ${filePath}`);
            resolve(filePath);
          });

          fileStream.on('error', (error) => {
            console.error('[WebExecutor] File write error:', error);
            fs.unlink(filePath, () => {}); // Clean up partial file
            resolve(null);
          });
        }).on('error', (error) => {
          console.error('[WebExecutor] Download error:', error);
          resolve(null);
        });

      } catch (error) {
        console.error('[WebExecutor] URL parsing error:', error);
        resolve(null);
      }
    });
  }

  // ==========================================================================
  // PAGE STATE HELPERS
  // ==========================================================================

  /**
   * Wait for the ChatGPT page to be ready for input.
   */
  private async waitForPageReady(timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const ready = await this.isPageReady();
      if (ready) {
        return true;
      }
      await this.delay(100);
    }

    return false;
  }

  /**
   * Check if the ChatGPT page is ready for input.
   */
  private async isPageReady(): Promise<boolean> {
    const script = `
      (function() {
        const textareaSelectors = ${JSON.stringify(CHATGPT_SELECTORS.textarea)};
        let inputEl = null;
        for (const sel of textareaSelectors) {
          inputEl = document.querySelector(sel);
          if (inputEl) break;
        }

        const containerSelectors = ${JSON.stringify(CHATGPT_SELECTORS.chatContainer)};
        let containerEl = null;
        for (const sel of containerSelectors) {
          containerEl = document.querySelector(sel);
          if (containerEl) break;
        }

        return !!(inputEl && containerEl);
      })();
    `;

    try {
      return await this.view.webContents.executeJavaScript(script);
    } catch (error) {
      return false;
    }
  }

  /**
   * Utility delay function.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // RATE LIMIT DETECTION (Exposed for scheduler)
  // ==========================================================================

  /**
   * Check if ChatGPT is currently rate limited.
   */
  async isRateLimited(): Promise<boolean> {
    const script = `
      (function() {
        const errorSelectors = ${JSON.stringify(CHATGPT_SELECTORS.errorMessage)}.join(', ');
        const errorElements = document.querySelectorAll(errorSelectors);

        for (const el of errorElements) {
          const text = el.innerText || el.textContent || '';
          const patterns = ${JSON.stringify(RATE_LIMIT_PATTERNS.map(p => p.source))};
          for (const pattern of patterns) {
            if (new RegExp(pattern, 'i').test(text)) {
              return true;
            }
          }
        }

        return false;
      })();
    `;

    try {
      return await this.view.webContents.executeJavaScript(script);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the WebContents for direct access if needed.
   */
  getWebContents() {
    return this.view.webContents;
  }

  /**
   * Clear the input field.
   */
  async clearInput(): Promise<boolean> {
    const script = `
      (function() {
        const selectors = ${JSON.stringify(CHATGPT_SELECTORS.textarea)};
        let inputEl = null;
        for (const sel of selectors) {
          inputEl = document.querySelector(sel);
          if (inputEl) break;
        }

        if (!inputEl) return false;

        inputEl.focus();

        if (inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true') {
          inputEl.textContent = '';
          inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
          return true;
        }

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

    try {
      return await this.view.webContents.executeJavaScript(script);
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new WebExecutor instance.
 * @param view - The BrowserView containing ChatGPT
 * @returns WebExecutor instance
 */
export function createWebExecutor(view: BrowserView): WebExecutor {
  return new WebExecutor(view);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SELECTORS,
  RATE_LIMIT_PATTERNS,
  ACTION_TIMEOUTS,
  POLL_CONFIG,
};
