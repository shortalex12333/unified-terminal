/**
 * Storekeeper Class — Runtime tool checkout/return wrapper
 *
 * Wraps the engineer's modules (approval-engine, inventory, injector, cleanup)
 * into a single class with a singleton accessor. The step-scheduler calls
 * getStorekeeper() to get this instance and uses processRequest() / cleanupStep().
 */

import type { ToolRequest, ToolResponse, ExecutionContext, Inventory } from './types';
import { processApproval } from './approval-engine';
import { loadInventory } from './inventory';
import { injectTools } from './injector';
import { cleanupStep as cleanupStepImpl, registerContext } from './cleanup';

// ============================================================================
// STOREKEEPER CLASS
// ============================================================================

export class Storekeeper {
  private inventory: Inventory | null = null;

  /**
   * Lazily load the inventory on first use.
   */
  private ensureInventory(): Inventory {
    if (!this.inventory) {
      this.inventory = loadInventory();
    }
    return this.inventory;
  }

  /**
   * Process a tool request through the approval engine.
   * Worker submits a request, storekeeper approves/denies.
   */
  async processRequest(request: ToolRequest): Promise<ToolResponse> {
    const inventory = this.ensureInventory();
    return processApproval(request, inventory);
  }

  /**
   * Build execution context from an approved response.
   * Reads skill files and assembles the prompt.
   */
  async buildContext(response: ToolResponse): Promise<ExecutionContext> {
    const inventory = this.ensureInventory();
    const context = injectTools(response, inventory);
    // Register for cleanup tracking
    if (response.requestId) {
      registerContext(response.requestId, context);
    }
    return context;
  }

  /**
   * Cleanup tools after a step completes.
   * Called by step-scheduler on success or failure.
   */
  async cleanupStep(stepId: string, outcome: 'success' | 'failure'): Promise<void> {
    cleanupStepImpl(stepId, outcome);
  }

  /**
   * Reload the inventory (e.g., after new skills are added).
   */
  reloadInventory(): void {
    this.inventory = null;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: Storekeeper | null = null;

export function getStorekeeper(): Storekeeper {
  if (!instance) {
    instance = new Storekeeper();
  }
  return instance;
}

/** Reset singleton (for testing) */
export function resetStorekeeper(): void {
  instance = null;
}
