/**
 * Request Parser Module — Parse and validate worker tool requests
 *
 * Workers write YAML request files to .kenoki/requests/.
 * This module parses those files and validates their signatures.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';
import { ToolRequest, STOREKEEPER_CONSTANTS } from './types';

// =============================================================================
// YAML PARSING
// =============================================================================

/**
 * Parse a tool request from a YAML file.
 *
 * @param yamlPath Path to the request YAML file
 * @returns Parsed ToolRequest or null if invalid
 */
export function parseRequest(yamlPath: string): ToolRequest | null {
  if (!fs.existsSync(yamlPath)) {
    console.error('[RequestParser] Request file not found:', yamlPath);
    return null;
  }

  try {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    const parsed = yaml.parse(content);

    // Validate required fields
    if (!parsed || typeof parsed !== 'object') {
      console.error('[RequestParser] Invalid YAML structure');
      return null;
    }

    const request: ToolRequest = {
      requestId: parsed.requestId || parsed.request_id || generateRequestId(),
      workerId: parsed.workerId || parsed.worker_id || 'unknown',
      stepId: parsed.stepId || parsed.step_id || '',
      timestamp: parsed.timestamp || new Date().toISOString(),
      signature: parsed.signature || '',
      task: {
        action: parsed.task?.action || '',
        detail: parsed.task?.detail || '',
        projectDir: parsed.task?.projectDir || parsed.task?.project_dir || process.cwd(),
      },
      requestedSkills: normalizeArray(parsed.requestedSkills || parsed.requested_skills || parsed.skills),
      requestedMcp: normalizeArray(parsed.requestedMcp || parsed.requested_mcp || parsed.mcp),
      requestedPlugins: normalizeArray(parsed.requestedPlugins || parsed.requested_plugins || parsed.plugins),
      justification: parsed.justification || '',
    };

    // Validate essential fields
    if (!request.stepId) {
      console.error('[RequestParser] Missing required field: stepId');
      return null;
    }

    if (!request.task.action) {
      console.error('[RequestParser] Missing required field: task.action');
      return null;
    }

    return request;
  } catch (error) {
    console.error('[RequestParser] Failed to parse YAML:', error);
    return null;
  }
}

/**
 * Normalize a value to an array of strings.
 */
function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

/**
 * Generate a unique request ID.
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `req-${timestamp}-${random}`;
}

// =============================================================================
// SIGNATURE VALIDATION
// =============================================================================

/**
 * Compute SHA256 signature for a request.
 * The signature is computed over the canonical request content (excluding signature field).
 *
 * @param request Tool request
 * @param secret Optional secret key for HMAC
 * @returns SHA256 signature
 */
export function computeSignature(request: ToolRequest, secret?: string): string {
  // Create canonical representation (excluding signature field)
  const canonical = {
    requestId: request.requestId,
    workerId: request.workerId,
    stepId: request.stepId,
    timestamp: request.timestamp,
    task: request.task,
    requestedSkills: [...request.requestedSkills].sort(),
    requestedMcp: [...request.requestedMcp].sort(),
    requestedPlugins: [...request.requestedPlugins].sort(),
    justification: request.justification,
  };

  const data = JSON.stringify(canonical, null, 0);

  if (secret) {
    // HMAC-SHA256 with secret
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Plain SHA256
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate the signature of a tool request.
 *
 * @param request Tool request to validate
 * @param secret Optional secret key (if using HMAC)
 * @returns True if signature is valid
 */
export function validateSignature(request: ToolRequest, secret?: string): boolean {
  // If no signature provided, skip validation (allow unsigned requests in dev)
  if (!request.signature) {
    console.warn('[RequestParser] Request has no signature, allowing in dev mode');
    return true;
  }

  const expected = computeSignature(request, secret);
  return crypto.timingSafeEqual(
    Buffer.from(request.signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// =============================================================================
// REQUEST CREATION
// =============================================================================

/**
 * Create a new tool request.
 *
 * @param workerId Worker identifier
 * @param stepId Step identifier from scheduler
 * @param task Task details
 * @param skills Requested skill paths
 * @param mcp Requested MCP server IDs
 * @param plugins Requested plugin IDs
 * @param options Additional options
 * @returns Complete ToolRequest
 */
export function createRequest(
  workerId: string,
  stepId: string,
  task: { action: string; detail: string; projectDir: string },
  skills: string[] = [],
  mcp: string[] = [],
  plugins: string[] = [],
  options?: {
    justification?: string;
    secret?: string;
  }
): ToolRequest {
  const request: ToolRequest = {
    requestId: generateRequestId(),
    workerId,
    stepId,
    timestamp: new Date().toISOString(),
    signature: '', // Will be computed below
    task,
    requestedSkills: skills,
    requestedMcp: mcp,
    requestedPlugins: plugins,
    justification: options?.justification || '',
  };

  // Compute signature
  request.signature = computeSignature(request, options?.secret);

  return request;
}

// =============================================================================
// REQUEST FILE OPERATIONS
// =============================================================================

/**
 * Write a tool request to a YAML file.
 *
 * @param request Tool request to write
 * @param projectDir Project directory (for .kenoki/requests/)
 * @returns Path to the written file
 */
export function writeRequest(request: ToolRequest, projectDir: string): string {
  const requestsDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.REQUESTS_DIR
  );

  // Ensure directory exists
  if (!fs.existsSync(requestsDir)) {
    fs.mkdirSync(requestsDir, { recursive: true });
  }

  const filename = `${request.stepId}.yaml`;
  const filePath = path.join(requestsDir, filename);

  // Convert to YAML-friendly format
  const yamlContent = yaml.stringify({
    requestId: request.requestId,
    workerId: request.workerId,
    stepId: request.stepId,
    timestamp: request.timestamp,
    signature: request.signature,
    task: {
      action: request.task.action,
      detail: request.task.detail,
      projectDir: request.task.projectDir,
    },
    requestedSkills: request.requestedSkills,
    requestedMcp: request.requestedMcp,
    requestedPlugins: request.requestedPlugins,
    justification: request.justification,
  });

  fs.writeFileSync(filePath, yamlContent, 'utf-8');

  return filePath;
}

/**
 * Read all pending requests from the requests directory.
 *
 * @param projectDir Project directory
 * @returns Array of parsed requests
 */
export function readPendingRequests(projectDir: string): ToolRequest[] {
  const requestsDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.REQUESTS_DIR
  );

  if (!fs.existsSync(requestsDir)) {
    return [];
  }

  const requests: ToolRequest[] = [];
  const files = fs.readdirSync(requestsDir);

  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const filePath = path.join(requestsDir, file);
      const request = parseRequest(filePath);
      if (request) {
        requests.push(request);
      }
    }
  }

  return requests;
}

/**
 * Remove a processed request file.
 *
 * @param stepId Step ID of the request
 * @param projectDir Project directory
 */
export function removeRequest(stepId: string, projectDir: string): void {
  const requestsDir = path.join(
    projectDir,
    STOREKEEPER_CONSTANTS.KENOKI_DIR,
    STOREKEEPER_CONSTANTS.REQUESTS_DIR
  );

  const filePath = path.join(requestsDir, `${stepId}.yaml`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
