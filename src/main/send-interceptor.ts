/**
 * Send Interceptor - Captures messages before they go to ChatGPT
 *
 * Intercepts the send button click/form submission in ChatGPT,
 * routes through the Conductor system, and decides whether to:
 * - Let ChatGPT handle it (web route)
 * - Handle via CLI tools (cli route)
 * - Do both (hybrid route)
 */

import { WebContents, ipcMain, BrowserWindow } from 'electron';
import { CHATGPT_SELECTORS } from '../utils/dom-selectors';
import { fastPathCheck, fastPathCheckWithReason } from './fast-path';
import { getConductor, ExecutionPlan } from './conductor';
import { getStepScheduler } from './step-scheduler';

// ============================================================================
// TYPES
// ============================================================================

export interface InterceptionResult {
  intercepted: boolean;
  text: string;
  route?: 'web' | 'cli' | 'hybrid';
  plan?: ExecutionPlan;
  error?: string;
}

// ============================================================================
// INTERCEPTOR SCRIPT
// ============================================================================

/**
 * Generate the interceptor script that runs in ChatGPT's context.
 * This script:
 * 1. Listens for send button clicks
 * 2. Captures the input text
 * 3. Prevents the default send
 * 4. Posts message to parent (Electron) for routing
 */
function generateInterceptorScript(): string {
  const textareaSelectors = CHATGPT_SELECTORS.textarea.map(s => `'${s}'`).join(', ');
  const sendButtonSelectors = CHATGPT_SELECTORS.sendButton.map(s => `'${s}'`).join(', ');
  const formSelectors = CHATGPT_SELECTORS.form.map(s => `'${s}'`).join(', ');

  return `
(function() {
  // Prevent multiple injections
  if (window.__unifiedTerminalInterceptorInstalled) {
    console.log('[Interceptor] Already installed');
    return;
  }
  window.__unifiedTerminalInterceptorInstalled = true;

  console.log('[Interceptor] Installing send interceptor...');

  const textareaSelectors = [${textareaSelectors}];
  const sendButtonSelectors = [${sendButtonSelectors}];
  const formSelectors = [${formSelectors}];

  // Helper to find element by selectors
  function findElement(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // Get current input text
  function getInputText() {
    const input = findElement(textareaSelectors);
    if (!input) return '';

    if (input.isContentEditable || input.getAttribute('contenteditable') === 'true') {
      return input.textContent || input.innerText || '';
    }
    return input.value || '';
  }

  // Clear input field (safe - uses textContent only)
  function clearInput() {
    const input = findElement(textareaSelectors);
    if (!input) return;

    if (input.isContentEditable || input.getAttribute('contenteditable') === 'true') {
      // Clear all child nodes safely
      while (input.firstChild) {
        input.removeChild(input.firstChild);
      }
      input.textContent = '';
    } else {
      input.value = '';
    }

    // Trigger input event for React
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Flag to track if we're allowing a send through
  let allowNextSend = false;
  let pendingInterception = false;

  // Intercept send button clicks
  function interceptSendButton() {
    document.addEventListener('click', async (e) => {
      const sendBtn = findElement(sendButtonSelectors);
      if (!sendBtn) return;

      // Check if click is on send button or its children
      if (sendBtn.contains(e.target) || sendBtn === e.target) {
        if (allowNextSend) {
          console.log('[Interceptor] Allowing send through');
          allowNextSend = false;
          return; // Let it through
        }

        if (pendingInterception) {
          console.log('[Interceptor] Interception already pending, blocking');
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const text = getInputText().trim();
        if (!text) {
          console.log('[Interceptor] Empty input, allowing through');
          return;
        }

        console.log('[Interceptor] Intercepting send:', text.substring(0, 50));

        // Prevent the send
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        pendingInterception = true;

        // Send to Electron for routing
        try {
          const result = await window.electronAPI.routeMessage(text);
          console.log('[Interceptor] Route result:', result);

          if (result.route === 'web' || result.route === 'hybrid') {
            // Allow the send to go through
            allowNextSend = true;
            sendBtn.click();
          }

          if (result.route === 'cli' || result.route === 'hybrid') {
            // CLI will handle it, clear input if pure CLI
            if (result.route === 'cli') {
              clearInput();
            }
          }
        } catch (err) {
          console.error('[Interceptor] Route error:', err);
          // On error, allow send through
          allowNextSend = true;
          sendBtn.click();
        } finally {
          pendingInterception = false;
        }
      }
    }, true); // Use capture phase
  }

  // Intercept Enter key in input
  function interceptEnterKey() {
    document.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;

      const input = findElement(textareaSelectors);
      if (!input || !input.contains(e.target)) return;

      if (allowNextSend) {
        console.log('[Interceptor] Allowing Enter through');
        allowNextSend = false;
        return;
      }

      if (pendingInterception) {
        console.log('[Interceptor] Interception already pending, blocking Enter');
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const text = getInputText().trim();
      if (!text) return;

      console.log('[Interceptor] Intercepting Enter:', text.substring(0, 50));

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      pendingInterception = true;

      try {
        const result = await window.electronAPI.routeMessage(text);
        console.log('[Interceptor] Route result:', result);

        if (result.route === 'web' || result.route === 'hybrid') {
          // Simulate Enter to send
          allowNextSend = true;
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          input.dispatchEvent(enterEvent);
        }

        if (result.route === 'cli') {
          clearInput();
        }
      } catch (err) {
        console.error('[Interceptor] Route error:', err);
        allowNextSend = true;
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        input.dispatchEvent(enterEvent);
      } finally {
        pendingInterception = false;
      }
    }, true);
  }

  // Intercept form submission
  function interceptFormSubmit() {
    document.addEventListener('submit', async (e) => {
      const form = findElement(formSelectors);
      if (!form || !form.contains(e.target)) return;

      if (allowNextSend) {
        console.log('[Interceptor] Allowing form submit through');
        allowNextSend = false;
        return;
      }

      const text = getInputText().trim();
      if (!text) return;

      console.log('[Interceptor] Intercepting form submit');

      e.preventDefault();
      e.stopPropagation();

      // Route and handle...
      // (Similar to button click handling)
    }, true);
  }

  // Install interceptors
  interceptSendButton();
  interceptEnterKey();
  interceptFormSubmit();

  console.log('[Interceptor] Send interceptor installed successfully');
})();
`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Install the send interceptor into a ChatGPT WebContents.
 */
export async function installInterceptor(webContents: WebContents): Promise<boolean> {
  console.log('[SendInterceptor] Installing interceptor...');

  try {
    const script = generateInterceptorScript();
    await webContents.executeJavaScript(script);
    console.log('[SendInterceptor] Interceptor installed successfully');
    return true;
  } catch (error) {
    console.error('[SendInterceptor] Failed to install interceptor:', error);
    return false;
  }
}

/**
 * Route a message through the Conductor system.
 * Called when interceptor captures a message.
 */
export async function routeMessage(text: string): Promise<{
  route: 'web' | 'cli' | 'hybrid';
  plan?: ExecutionPlan;
  fastPath?: boolean;
}> {
  console.log('[SendInterceptor] Routing message:', text.substring(0, 50));

  // Tier 0: Fast-path check
  const fastPathResult = fastPathCheckWithReason(text);
  console.log('[SendInterceptor] Fast-path result:', fastPathResult);

  if (fastPathResult.result === 'bypass_to_chatgpt') {
    console.log('[SendInterceptor] Fast-path bypass to web');
    return { route: 'web', fastPath: true };
  }

  // Tier 1: Conductor classification
  try {
    const conductor = getConductor();

    // Check if conductor is ready
    if (!conductor.hasSession()) {
      console.log('[SendInterceptor] Conductor not ready, initializing...');
      await conductor.initialize();
    }

    const plan = await conductor.classify(text);
    console.log('[SendInterceptor] Conductor plan:', plan);

    // Execute the plan via step scheduler
    if (plan.route === 'cli' || plan.route === 'hybrid') {
      const scheduler = getStepScheduler();
      // Convert plan format
      const schedulerPlan = {
        planId: `plan-${Date.now()}`,
        name: `${plan.complexity} task`,
        steps: plan.plan.map(step => ({ ...step })),
        context: { estimatedMinutes: plan.estimated_minutes },
      };

      // Execute in background (don't await for hybrid)
      if (plan.route === 'hybrid') {
        scheduler.execute(schedulerPlan).catch(err => {
          console.error('[SendInterceptor] CLI execution error:', err);
        });
      } else {
        // For pure CLI, execute and wait
        scheduler.execute(schedulerPlan).catch(err => {
          console.error('[SendInterceptor] CLI execution error:', err);
        });
      }
    }

    return { route: plan.route, plan };
  } catch (error) {
    console.error('[SendInterceptor] Conductor error:', error);
    // On error, fall back to web
    return { route: 'web', fastPath: false };
  }
}

/**
 * Set up IPC handlers for the interceptor.
 */
export function setupInterceptorIPC(): void {
  // Handle route message from renderer
  ipcMain.handle('interceptor:route-message', async (_event, text: string) => {
    return await routeMessage(text);
  });

  console.log('[SendInterceptor] IPC handlers registered');
}
