/**
 * MCP Detector - Analyzes steps to determine required MCP servers
 */

import { MCPDetectionResult } from './types';
import { getMCPManager } from './mcp-manager';

const PATTERNS: Record<string, RegExp[]> = {
  stripe: [/payment/i, /checkout/i, /stripe/i, /billing/i, /subscription/i],
  github: [/github/i, /repository/i, /git push/i, /commit/i],
  vercel: [/vercel/i, /deploy/i, /hosting/i],
  supabase: [/supabase/i, /database/i, /postgres/i, /auth/i],
  notion: [/notion/i, /documentation/i, /wiki/i],
};

export function detectRequiredMCPs(stepAction: string, stepDetail: string): string[] {
  const text = (stepAction + ' ' + stepDetail).toLowerCase();
  const required: string[] = [];

  for (const [serverId, patterns] of Object.entries(PATTERNS)) {
    if (patterns.some(p => p.test(text))) {
      required.push(serverId);
    }
  }

  return required;
}

export function detectRequiredMCPsFromPlan(steps: Array<{ action: string; detail: string }>): string[] {
  const allRequired = new Set<string>();
  for (const step of steps) {
    for (const mcp of detectRequiredMCPs(step.action, step.detail)) {
      allRequired.add(mcp);
    }
  }
  return Array.from(allRequired);
}

/**
 * MCPDetector class for integration with step-scheduler
 */
export class MCPDetector {
  private static instance: MCPDetector | null = null;

  private constructor() {}

  static getInstance(): MCPDetector {
    if (!MCPDetector.instance) MCPDetector.instance = new MCPDetector();
    return MCPDetector.instance;
  }

  detect(stepAction: string, stepDetail: string): MCPDetectionResult {
    const required = detectRequiredMCPs(stepAction, stepDetail);
    const mcpManager = getMCPManager();
    const missing = required.filter(id => !mcpManager.isConnected(id));
    return {
      required,
      missing,
      allConnected: missing.length === 0,
    };
  }
}

let detectorInstance: MCPDetector | null = null;
export function getMCPDetector(): MCPDetector {
  if (!detectorInstance) detectorInstance = MCPDetector.getInstance();
  return detectorInstance;
}

export function cleanupMCPDetector(): void {
  detectorInstance = null;
}
