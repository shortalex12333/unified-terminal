/**
 * Cleanup Module — Remove tools after step completion
 *
 * When a worker completes a step (success, failure, timeout, or cancelled),
 * the Storekeeper cleans up:
 * 1. Skill injections (clear from context)
 * 2. MCP connections (release if step-scoped)
 * 3. Plugin bindings (unbind)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ExecutionContext,
  CheckoutLog,
  STOREKEEPER_CONSTANTS,
} from './types';

// =============================================================================
// CONTEXT STORAGE (In-memory tracking of active contexts)
// =============================================================================

/**
 * Active execution contexts by step ID.
 */
const activeContexts: Map<string, ExecutionContext> = new Map();

/**
 * Track checkout times by step ID for duration calculation.
 */
const checkoutTimes: Map<string, Date> = new Map();

/**
 * Register a context as active.
 */
export function registerContext(stepId: string, context: ExecutionContext): void {
  activeContexts.set(stepId, context);
  checkoutTimes.set(stepId, new Date());
}

/**
 * Get an active context by step ID.
 */
export function getActiveContext(stepId: string): ExecutionContext | undefined {
  return activeContexts.get(stepId);
}

/**
 * Check if a step has an active context.
 */
export function hasActiveContext(stepId: string): boolean {
  return activeContexts.has(stepId);
}

// =============================================================================
// INDIVIDUAL CLEANUP OPERATIONS
// =============================================================================

/**
 * Clear skill injection from context.
 *
 * @param stepId Step ID to clear
 * @returns True if context was cleared
 */
export function clearContext(stepId: string): boolean {
  const context = activeContexts.get(stepId);
  if (!context) {
    console.warn('[Cleanup] No active context for step:', stepId);
    return false;
  }

  // Log what we're clearing
  console.log('[Cleanup] Clearing context for step:', stepId);
  console.log('[Cleanup] Skills to clear:', context.meta.skillsInjected.length);

  // Remove from active contexts
  activeContexts.delete(stepId);

  return true;
}

/**
 * Release MCP connections for a step.
 *
 * @param stepId Step ID
 * @returns Array of released connection IDs
 */
export function releaseConnections(stepId: string): string[] {
  const context = activeContexts.get(stepId);
  if (!context) {
    console.warn('[Cleanup] No active context for step:', stepId);
    return [];
  }

  const released: string[] = [];

  // For now, MCP connections are shared, so we just log the release
  // In a full implementation, this would decrement reference counts
  // and close connections when no steps are using them
  for (const [mcpId, status] of Object.entries(context.mcp)) {
    if (status === 'connected') {
      console.log('[Cleanup] Releasing MCP connection:', mcpId);
      released.push(mcpId);
    }
  }

  return released;
}

/**
 * Unbind plugin for a step.
 *
 * @param stepId Step ID
 * @returns Plugin ID that was unbound, or null
 */
export function unbindPlugin(stepId: string): string | null {
  const context = activeContexts.get(stepId);
  if (!context) {
    console.warn('[Cleanup] No active context for step:', stepId);
    return null;
  }

  if (context.plugin) {
    console.log('[Cleanup] Unbinding plugin:', context.plugin);
    return context.plugin;
  }

  return null;
}

// =============================================================================
// FULL CLEANUP FLOW
// =============================================================================

/**
 * Execution outcome types.
 */
export type CleanupOutcome = 'success' | 'failure' | 'timeout' | 'cancelled';

/**
 * Full cleanup for a completed step.
 *
 * @param stepId Step ID that completed
 * @param outcome Execution outcome
 * @param options Additional options
 * @returns Checkout log entry
 */
export function cleanupStep(
  stepId: string,
  outcome: CleanupOutcome,
  options?: {
    filesCreated?: number;
    filesModified?: number;
    projectDir?: string;
  }
): CheckoutLog {
  const context = activeContexts.get(stepId);
  const checkoutTime = checkoutTimes.get(stepId);

  const returnTime = new Date();
  const durationMs = checkoutTime
    ? returnTime.getTime() - checkoutTime.getTime()
    : 0;

  // Create checkout log before cleanup
  const log: CheckoutLog = {
    stepId,
    workerId: '', // Would be set from context if we tracked it
    checkoutTime: checkoutTime?.toISOString() || returnTime.toISOString(),
    returnTime: returnTime.toISOString(),
    durationMs,
    toolsUsed: {
      skills: context?.meta.skillsInjected || [],
      mcp: context ? Object.keys(context.mcp) : [],
      plugin: context?.plugin || null,
    },
    outcome,
    filesCreated: options?.filesCreated || 0,
    filesModified: options?.filesModified || 0,
  };

  // Perform cleanup operations
  const releasedMcp = releaseConnections(stepId);
  const unboundPlugin = unbindPlugin(stepId);
  const contextCleared = clearContext(stepId);

  // Remove checkout time
  checkoutTimes.delete(stepId);

  // Log cleanup summary
  console.log('[Cleanup] Step cleanup complete:', stepId);
  console.log('[Cleanup] Outcome:', outcome);
  console.log('[Cleanup] Duration:', durationMs, 'ms');
  console.log('[Cleanup] MCP released:', releasedMcp.length);
  console.log('[Cleanup] Plugin unbound:', unboundPlugin || 'none');
  console.log('[Cleanup] Context cleared:', contextCleared);

  return log;
}

/**
 * Cleanup all active contexts (e.g., on shutdown).
 *
 * @returns Number of contexts cleaned up
 */
export function cleanupAll(): number {
  const stepIds = Array.from(activeContexts.keys());
  let count = 0;

  for (const stepId of stepIds) {
    try {
      cleanupStep(stepId, 'cancelled');
      count++;
    } catch (error) {
      console.error('[Cleanup] Failed to cleanup step:', stepId, error);
    }
  }

  console.log('[Cleanup] Cleaned up all active contexts:', count);
  return count;
}

// =============================================================================
// REQUEST FILE CLEANUP
// =============================================================================

/**
 * Remove request and response files for a completed step.
 *
 * @param stepId Step ID
 * @param projectDir Project directory
 */
export function cleanupRequestFiles(stepId: string, projectDir: string): void {
  const kenokiDir = path.join(projectDir, STOREKEEPER_CONSTANTS.KENOKI_DIR);

  // Remove request file
  const requestPath = path.join(
    kenokiDir,
    STOREKEEPER_CONSTANTS.REQUESTS_DIR,
    `${stepId}.yaml`
  );
  if (fs.existsSync(requestPath)) {
    fs.unlinkSync(requestPath);
    console.log('[Cleanup] Removed request file:', requestPath);
  }

  // Remove response file
  const responsePath = path.join(
    kenokiDir,
    STOREKEEPER_CONSTANTS.RESPONSES_DIR,
    `${stepId}.yaml`
  );
  if (fs.existsSync(responsePath)) {
    fs.unlinkSync(responsePath);
    console.log('[Cleanup] Removed response file:', responsePath);
  }
}

/**
 * Clean up old request/response files (older than retention period).
 *
 * @param projectDir Project directory
 * @param maxAgeMs Maximum age in milliseconds (default: 24 hours)
 * @returns Number of files cleaned up
 */
export function cleanupOldFiles(
  projectDir: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): number {
  const kenokiDir = path.join(projectDir, STOREKEEPER_CONSTANTS.KENOKI_DIR);
  const now = Date.now();
  let count = 0;

  const dirs = [
    STOREKEEPER_CONSTANTS.REQUESTS_DIR,
    STOREKEEPER_CONSTANTS.RESPONSES_DIR,
  ];

  for (const dir of dirs) {
    const dirPath = path.join(kenokiDir, dir);
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
          count++;
        }
      } catch (error) {
        console.error('[Cleanup] Failed to clean up file:', filePath, error);
      }
    }
  }

  if (count > 0) {
    console.log('[Cleanup] Cleaned up old files:', count);
  }

  return count;
}

// =============================================================================
// STATS AND MONITORING
// =============================================================================

/**
 * Get statistics about active contexts.
 */
export function getActiveStats(): {
  activeContexts: number;
  totalSkillsLoaded: number;
  totalMcpConnections: number;
  pluginsInUse: string[];
} {
  let totalSkillsLoaded = 0;
  let totalMcpConnections = 0;
  const pluginsInUse: Set<string> = new Set();

  for (const context of activeContexts.values()) {
    totalSkillsLoaded += context.meta.skillsInjected.length;
    totalMcpConnections += Object.values(context.mcp).filter(
      (s) => s === 'connected'
    ).length;
    if (context.plugin) {
      pluginsInUse.add(context.plugin);
    }
  }

  return {
    activeContexts: activeContexts.size,
    totalSkillsLoaded,
    totalMcpConnections,
    pluginsInUse: Array.from(pluginsInUse),
  };
}

/**
 * List all active step IDs.
 */
export function listActiveSteps(): string[] {
  return Array.from(activeContexts.keys());
}
