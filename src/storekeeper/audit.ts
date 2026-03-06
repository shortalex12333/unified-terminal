/**
 * Audit Module — Log all storekeeper transactions
 *
 * Every tool checkout and return is logged to .kenoki/audit/ for:
 * - Debugging and troubleshooting
 * - Usage tracking and analytics
 * - Compliance and security auditing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  CheckoutLog,
  ToolRequest,
  ToolResponse,
  STOREKEEPER_CONSTANTS,
} from './types';

// =============================================================================
// AUDIT LOG WRITING
// =============================================================================

/**
 * Write a checkout log to the audit directory.
 *
 * @param log Checkout log to write
 * @param projectDir Project directory
 * @returns Path to the written file
 */
export function writeCheckoutLog(log: CheckoutLog, projectDir: string): string {
  const auditDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.AUDIT_DIR
  );

  // Ensure directory exists
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  // Generate filename with timestamp for uniqueness
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${log.stepId}-${timestamp}.yaml`;
  const filePath = path.join(auditDir, filename);

  // Write log as YAML
  const yamlContent = yaml.stringify({
    stepId: log.stepId,
    workerId: log.workerId,
    checkoutTime: log.checkoutTime,
    returnTime: log.returnTime,
    durationMs: log.durationMs,
    toolsUsed: {
      skills: log.toolsUsed.skills,
      mcp: log.toolsUsed.mcp,
      plugin: log.toolsUsed.plugin,
    },
    outcome: log.outcome,
    filesCreated: log.filesCreated,
    filesModified: log.filesModified,
  });

  fs.writeFileSync(filePath, yamlContent, 'utf-8');

  return filePath;
}

/**
 * Read a checkout log by step ID.
 *
 * @param stepId Step ID to look up
 * @param projectDir Project directory
 * @returns CheckoutLog or null if not found
 */
export function readCheckoutLog(
  stepId: string,
  projectDir: string
): CheckoutLog | null {
  const auditDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.AUDIT_DIR
  );

  if (!fs.existsSync(auditDir)) {
    return null;
  }

  // Find the latest log file for this step ID
  const files = fs.readdirSync(auditDir);
  const matchingFiles = files
    .filter((f) => f.startsWith(stepId) && f.endsWith('.yaml'))
    .sort()
    .reverse();

  if (matchingFiles.length === 0) {
    return null;
  }

  const filePath = path.join(auditDir, matchingFiles[0]);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(content);

    return {
      stepId: parsed.stepId,
      workerId: parsed.workerId,
      checkoutTime: parsed.checkoutTime,
      returnTime: parsed.returnTime,
      durationMs: parsed.durationMs,
      toolsUsed: {
        skills: parsed.toolsUsed?.skills || [],
        mcp: parsed.toolsUsed?.mcp || [],
        plugin: parsed.toolsUsed?.plugin || null,
      },
      outcome: parsed.outcome,
      filesCreated: parsed.filesCreated || 0,
      filesModified: parsed.filesModified || 0,
    };
  } catch (error) {
    console.error('[Audit] Failed to read checkout log:', error);
    return null;
  }
}

// =============================================================================
// AUDIT HISTORY
// =============================================================================

/**
 * Get all audit logs for a project.
 *
 * @param projectDir Project directory
 * @param options Filter options
 * @returns Array of CheckoutLog entries
 */
export function getAuditHistory(
  projectDir: string,
  options?: {
    /** Maximum number of logs to return */
    limit?: number;
    /** Filter by outcome */
    outcome?: 'success' | 'failure' | 'timeout' | 'cancelled';
    /** Filter by worker ID */
    workerId?: string;
    /** Filter logs after this date */
    after?: Date;
    /** Filter logs before this date */
    before?: Date;
  }
): CheckoutLog[] {
  const auditDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.AUDIT_DIR
  );

  if (!fs.existsSync(auditDir)) {
    return [];
  }

  const files = fs.readdirSync(auditDir);
  const logs: CheckoutLog[] = [];

  // Sort files by name (which includes timestamp) in reverse order
  const sortedFiles = files
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .reverse();

  for (const file of sortedFiles) {
    // Apply limit
    if (options?.limit && logs.length >= options.limit) {
      break;
    }

    const filePath = path.join(auditDir, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(content);

      const log: CheckoutLog = {
        stepId: parsed.stepId,
        workerId: parsed.workerId,
        checkoutTime: parsed.checkoutTime,
        returnTime: parsed.returnTime,
        durationMs: parsed.durationMs,
        toolsUsed: {
          skills: parsed.toolsUsed?.skills || [],
          mcp: parsed.toolsUsed?.mcp || [],
          plugin: parsed.toolsUsed?.plugin || null,
        },
        outcome: parsed.outcome,
        filesCreated: parsed.filesCreated || 0,
        filesModified: parsed.filesModified || 0,
      };

      // Apply filters
      if (options?.outcome && log.outcome !== options.outcome) {
        continue;
      }

      if (options?.workerId && log.workerId !== options.workerId) {
        continue;
      }

      if (options?.after) {
        const checkoutDate = new Date(log.checkoutTime);
        if (checkoutDate < options.after) {
          continue;
        }
      }

      if (options?.before) {
        const checkoutDate = new Date(log.checkoutTime);
        if (checkoutDate > options.before) {
          continue;
        }
      }

      logs.push(log);
    } catch (error) {
      console.error('[Audit] Failed to parse log file:', file, error);
    }
  }

  return logs;
}

// =============================================================================
// REQUEST/RESPONSE LOGGING
// =============================================================================

/**
 * Log a tool request.
 *
 * @param request Tool request
 * @param projectDir Project directory
 */
export function logRequest(request: ToolRequest, projectDir: string): void {
  const auditDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.AUDIT_DIR,
    'requests'
  );

  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  const filename = `${request.stepId}-request.yaml`;
  const filePath = path.join(auditDir, filename);

  const yamlContent = yaml.stringify(request);
  fs.writeFileSync(filePath, yamlContent, 'utf-8');
}

/**
 * Log a tool response.
 *
 * @param response Tool response
 * @param projectDir Project directory
 */
export function logResponse(response: ToolResponse, projectDir: string): void {
  const auditDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.AUDIT_DIR,
    'responses'
  );

  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  const filename = `${response.requestId}-response.yaml`;
  const filePath = path.join(auditDir, filename);

  const yamlContent = yaml.stringify(response);
  fs.writeFileSync(filePath, yamlContent, 'utf-8');
}

// =============================================================================
// AUDIT STATISTICS
// =============================================================================

/**
 * Get audit statistics for a project.
 *
 * @param projectDir Project directory
 * @param options Time range options
 * @returns Statistics object
 */
export function getAuditStats(
  projectDir: string,
  options?: {
    after?: Date;
    before?: Date;
  }
): {
  totalCheckouts: number;
  byOutcome: Record<string, number>;
  byWorker: Record<string, number>;
  byPlugin: Record<string, number>;
  avgDurationMs: number;
  totalFilesCreated: number;
  totalFilesModified: number;
  skillUsage: Record<string, number>;
  mcpUsage: Record<string, number>;
} {
  const logs = getAuditHistory(projectDir, options);

  const stats = {
    totalCheckouts: logs.length,
    byOutcome: {} as Record<string, number>,
    byWorker: {} as Record<string, number>,
    byPlugin: {} as Record<string, number>,
    avgDurationMs: 0,
    totalFilesCreated: 0,
    totalFilesModified: 0,
    skillUsage: {} as Record<string, number>,
    mcpUsage: {} as Record<string, number>,
  };

  let totalDuration = 0;

  for (const log of logs) {
    // Outcome counts
    stats.byOutcome[log.outcome] = (stats.byOutcome[log.outcome] || 0) + 1;

    // Worker counts
    if (log.workerId) {
      stats.byWorker[log.workerId] = (stats.byWorker[log.workerId] || 0) + 1;
    }

    // Plugin counts
    if (log.toolsUsed.plugin) {
      stats.byPlugin[log.toolsUsed.plugin] =
        (stats.byPlugin[log.toolsUsed.plugin] || 0) + 1;
    }

    // Duration
    totalDuration += log.durationMs;

    // File counts
    stats.totalFilesCreated += log.filesCreated;
    stats.totalFilesModified += log.filesModified;

    // Skill usage
    for (const skill of log.toolsUsed.skills) {
      stats.skillUsage[skill] = (stats.skillUsage[skill] || 0) + 1;
    }

    // MCP usage
    for (const mcp of log.toolsUsed.mcp) {
      stats.mcpUsage[mcp] = (stats.mcpUsage[mcp] || 0) + 1;
    }
  }

  stats.avgDurationMs = logs.length > 0 ? totalDuration / logs.length : 0;

  return stats;
}

// =============================================================================
// AUDIT CLEANUP
// =============================================================================

/**
 * Clean up old audit logs.
 *
 * @param projectDir Project directory
 * @param maxAgeDays Maximum age in days (default: 30)
 * @returns Number of files cleaned up
 */
export function cleanupOldAuditLogs(
  projectDir: string,
  maxAgeDays: number = 30
): number {
  const auditDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.AUDIT_DIR
  );

  if (!fs.existsSync(auditDir)) {
    return 0;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let count = 0;

  function cleanDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        cleanDir(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          const age = now - stats.mtimeMs;
          if (age > maxAgeMs) {
            fs.unlinkSync(fullPath);
            count++;
          }
        } catch (error) {
          console.error('[Audit] Failed to clean up file:', fullPath, error);
        }
      }
    }
  }

  cleanDir(auditDir);

  if (count > 0) {
    console.log('[Audit] Cleaned up old audit logs:', count);
  }

  return count;
}

/**
 * Export audit logs to JSON format.
 *
 * @param projectDir Project directory
 * @param outputPath Output file path
 * @param options Filter options
 */
export function exportAuditLogs(
  projectDir: string,
  outputPath: string,
  options?: Parameters<typeof getAuditHistory>[1]
): void {
  const logs = getAuditHistory(projectDir, options);
  const stats = getAuditStats(projectDir, options);

  const exportData = {
    exportedAt: new Date().toISOString(),
    projectDir,
    stats,
    logs,
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
  console.log('[Audit] Exported audit logs to:', outputPath);
}
