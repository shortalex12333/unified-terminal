/**
 * STATUS AGENT IPC ADDITIONS FOR PRELOAD.TS
 *
 * This file documents the additions needed in the main preload.ts file
 * to expose Status Agent IPC methods to the renderer process.
 *
 * Copy the relevant sections to:
 * /Users/celeste7/Documents/unified-terminal/src/main/preload.ts
 */

// =============================================================================
// TYPE DEFINITIONS (Add at top of preload.ts, after existing types)
// =============================================================================

/*
// Status Agent types - import from status-agent/types or define inline:

type StatusState = 'pending' | 'active' | 'done' | 'error' | 'paused' | 'waiting_user';

interface StatusLine {
  id: string;
  text: string;
  expandable: boolean;
  expandedText: string | null;
  state: StatusState;
  stepId: number | null;
  parentId: string | null;
  progress: number | null;
  icon: string;
}

type QueryType = 'choice' | 'text' | 'confirm' | 'upload';
type QueryPriority = 'normal' | 'blocking';

interface QueryOption {
  label: string;
  value: string;
  detail: string | null;
  icon: string | null;
}

interface UserQuery {
  id: string;
  source: string;
  stepId: number | null;
  agentHandle: string;
  type: QueryType;
  question: string;
  options: QueryOption[];
  placeholder: string | null;
  defaultChoice: string | null;
  timeout: number;
  priority: QueryPriority;
}

interface FuelState {
  percent: number;
  label: string;
  detail: string;
  warning: boolean;
  warningText: string | null;
}

type TreeNodeOutputType = 'url' | 'file' | 'preview' | 'download';

interface TreeNodeOutput {
  type: TreeNodeOutputType;
  label: string;
  value: string;
}

interface TreeNode {
  id: string;
  parentId: string | null;
  label: string;
  state: StatusState;
  progress: number | null;
  expandable: boolean;
  expanded: boolean;
  children: string[];
  stepId: number | null;
  agentId: string | null;
  output: TreeNodeOutput | null;
}
*/

// =============================================================================
// EXPOSED API (Add to contextBridge.exposeInMainWorld('electronAPI', { ... }))
// =============================================================================

/*
  // ============================================================================
  // STATUS AGENT METHODS (Build Progress + User Interaction)
  // ============================================================================

  statusAgent: {
    // -------------------------------------------------------------------------
    // EVENT LISTENERS (Main -> Renderer)
    // -------------------------------------------------------------------------

    // Listen for new status lines (tree nodes)
    onStatusLine: (callback: (line: StatusLine) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, line: StatusLine) => callback(line);
      ipcRenderer.on('status:line', handler);
      return () => ipcRenderer.removeListener('status:line', handler);
    },

    // Listen for status line partial updates (progress, state changes)
    onStatusLineUpdate: (callback: (data: { id: string } & Partial<StatusLine>) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { id: string } & Partial<StatusLine>) => callback(data);
      ipcRenderer.on('status:line-update', handler);
      return () => ipcRenderer.removeListener('status:line-update', handler);
    },

    // Listen for batch status line updates (performance optimization)
    onStatusLineBatch: (callback: (lines: StatusLine[]) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, lines: StatusLine[]) => callback(lines);
      ipcRenderer.on('status:line-batch', handler);
      return () => ipcRenderer.removeListener('status:line-batch', handler);
    },

    // Listen for batch partial updates
    onStatusLineUpdateBatch: (callback: (updates: Array<{ id: string } & Partial<StatusLine>>) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, updates: Array<{ id: string } & Partial<StatusLine>>) => callback(updates);
      ipcRenderer.on('status:line-update-batch', handler);
      return () => ipcRenderer.removeListener('status:line-update-batch', handler);
    },

    // Listen for tree node updates
    onTreeNode: (callback: (node: TreeNode) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, node: TreeNode) => callback(node);
      ipcRenderer.on('status:tree-node', handler);
      return () => ipcRenderer.removeListener('status:tree-node', handler);
    },

    // Listen for user queries (decision points)
    onQuery: (callback: (query: UserQuery) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, query: UserQuery) => callback(query);
      ipcRenderer.on('status:query', handler);
      return () => ipcRenderer.removeListener('status:query', handler);
    },

    // Listen for query timeout (default was used)
    onQueryTimeout: (callback: (data: { queryId: string; defaultValue: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { queryId: string; defaultValue: string }) => callback(data);
      ipcRenderer.on('status:query-timeout', handler);
      return () => ipcRenderer.removeListener('status:query-timeout', handler);
    },

    // Listen for fuel gauge updates (session budget)
    onFuelUpdate: (callback: (fuel: FuelState) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, fuel: FuelState) => callback(fuel);
      ipcRenderer.on('status:fuel-update', handler);
      return () => ipcRenderer.removeListener('status:fuel-update', handler);
    },

    // Listen for build started event
    onBuildStarted: (callback: (data: { projectName: string; tier: number; estimatedTime: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { projectName: string; tier: number; estimatedTime: string }) => callback(data);
      ipcRenderer.on('build:started', handler);
      return () => ipcRenderer.removeListener('build:started', handler);
    },

    // Listen for build complete event
    onBuildComplete: (callback: (data: { outputs: Array<{ type: string; label: string; value: string }> }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { outputs: Array<{ type: string; label: string; value: string }> }) => callback(data);
      ipcRenderer.on('build:complete', handler);
      return () => ipcRenderer.removeListener('build:complete', handler);
    },

    // Listen for interrupt acknowledgement
    onInterruptAck: (callback: (detail: { affected: string[]; unaffected: string[]; message: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, detail: { affected: string[]; unaffected: string[]; message: string }) => callback(detail);
      ipcRenderer.on('status:interrupt-ack', handler);
      return () => ipcRenderer.removeListener('status:interrupt-ack', handler);
    },

    // Listen for shell state changes (idle/building/minimised/complete)
    onShellState: (callback: (state: 'idle' | 'building' | 'minimised' | 'complete') => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, state: 'idle' | 'building' | 'minimised' | 'complete') => callback(state);
      ipcRenderer.on('shell:state-change', handler);
      return () => ipcRenderer.removeListener('shell:state-change', handler);
    },

    // Listen for errors
    onError: (callback: (error: { id: string; message: string; stepId?: number; recoverable: boolean }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, error: { id: string; message: string; stepId?: number; recoverable: boolean }) => callback(error);
      ipcRenderer.on('status:error', handler);
      return () => ipcRenderer.removeListener('status:error', handler);
    },

    // Listen for error recovery
    onErrorRecovered: (callback: (data: { errorId: string; resolution: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { errorId: string; resolution: string }) => callback(data);
      ipcRenderer.on('status:error-recovered', handler);
      return () => ipcRenderer.removeListener('status:error-recovered', handler);
    },

    // -------------------------------------------------------------------------
    // USER ACTIONS (Renderer -> Main)
    // -------------------------------------------------------------------------

    // Send query response (button click or text input)
    sendQueryResponse: (queryId: string, value: string): void => {
      ipcRenderer.send('user:query-response', { queryId, value });
    },

    // Send free-text correction
    sendCorrection: (text: string): void => {
      ipcRenderer.send('user:correction', text);
    },

    // Stop specific step
    sendStopStep: (stepId: number): void => {
      ipcRenderer.send('user:stop-step', stepId);
    },

    // Stop all (global stop button)
    sendStopAll: (): void => {
      ipcRenderer.send('user:stop-all');
    },

    // -------------------------------------------------------------------------
    // LAYOUT CONTROLS (Renderer -> Main)
    // -------------------------------------------------------------------------

    // Hide the status tree (minimize)
    hideTree: (): void => {
      ipcRenderer.send('user:hide-tree');
    },

    // Expand the status tree (full view)
    expandTree: (): void => {
      ipcRenderer.send('user:expand-tree');
    },

    // Dismiss the status tree (remove from view)
    dismissTree: (): void => {
      ipcRenderer.send('user:dismiss-tree');
    },

    // -------------------------------------------------------------------------
    // INVOKE METHODS (Request-Response Pattern)
    // -------------------------------------------------------------------------

    // Get current status tree state (for initial render)
    getTree: (): Promise<unknown> => {
      return ipcRenderer.invoke('status:get-tree');
    },

    // Get pending user queries
    getPendingQueries: (): Promise<unknown> => {
      return ipcRenderer.invoke('status:get-pending-queries');
    },

    // Get current fuel state
    getFuel: (): Promise<unknown> => {
      return ipcRenderer.invoke('status:get-fuel');
    },
  },
*/

// =============================================================================
// TYPESCRIPT TYPE DECLARATION (Add to global.d.ts for renderer)
// =============================================================================

/*
// Add to src/renderer/global.d.ts or equivalent

interface StatusAgentAPI {
  // Event listeners (return cleanup function)
  onStatusLine: (callback: (line: StatusLine) => void) => () => void;
  onStatusLineUpdate: (callback: (data: { id: string } & Partial<StatusLine>) => void) => () => void;
  onStatusLineBatch: (callback: (lines: StatusLine[]) => void) => () => void;
  onStatusLineUpdateBatch: (callback: (updates: Array<{ id: string } & Partial<StatusLine>>) => void) => () => void;
  onTreeNode: (callback: (node: TreeNode) => void) => () => void;
  onQuery: (callback: (query: UserQuery) => void) => () => void;
  onQueryTimeout: (callback: (data: { queryId: string; defaultValue: string }) => void) => () => void;
  onFuelUpdate: (callback: (fuel: FuelState) => void) => () => void;
  onBuildStarted: (callback: (data: { projectName: string; tier: number; estimatedTime: string }) => void) => () => void;
  onBuildComplete: (callback: (data: { outputs: Array<{ type: string; label: string; value: string }> }) => void) => () => void;
  onInterruptAck: (callback: (detail: { affected: string[]; unaffected: string[]; message: string }) => void) => () => void;
  onShellState: (callback: (state: 'idle' | 'building' | 'minimised' | 'complete') => void) => () => void;
  onError: (callback: (error: { id: string; message: string; stepId?: number; recoverable: boolean }) => void) => () => void;
  onErrorRecovered: (callback: (data: { errorId: string; resolution: string }) => void) => () => void;

  // User actions
  sendQueryResponse: (queryId: string, value: string) => void;
  sendCorrection: (text: string) => void;
  sendStopStep: (stepId: number) => void;
  sendStopAll: () => void;

  // Layout controls
  hideTree: () => void;
  expandTree: () => void;
  dismissTree: () => void;

  // Invoke methods
  getTree: () => Promise<unknown>;
  getPendingQueries: () => Promise<unknown>;
  getFuel: () => Promise<unknown>;
}

// Extend the existing ElectronAPI interface
interface ElectronAPI {
  // ... existing properties ...
  statusAgent: StatusAgentAPI;
}
*/

// =============================================================================
// USAGE EXAMPLE (React Component)
// =============================================================================

/*
// Example: React hook for Status Agent

import { useEffect, useState, useCallback } from 'react';

export function useStatusAgent() {
  const [lines, setLines] = useState<Map<string, StatusLine>>(new Map());
  const [queries, setQueries] = useState<UserQuery[]>([]);
  const [fuel, setFuel] = useState<FuelState | null>(null);
  const [shellState, setShellState] = useState<'idle' | 'building' | 'minimised' | 'complete'>('idle');

  useEffect(() => {
    const api = window.electronAPI.statusAgent;

    // Subscribe to events
    const cleanupLine = api.onStatusLine((line) => {
      setLines(prev => new Map(prev).set(line.id, line));
    });

    const cleanupUpdate = api.onStatusLineUpdate((data) => {
      setLines(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.id);
        if (existing) {
          updated.set(data.id, { ...existing, ...data });
        }
        return updated;
      });
    });

    const cleanupQuery = api.onQuery((query) => {
      setQueries(prev => [...prev, query]);
    });

    const cleanupFuel = api.onFuelUpdate((state) => {
      setFuel(state);
    });

    const cleanupShell = api.onShellState((state) => {
      setShellState(state);
    });

    // Cleanup on unmount
    return () => {
      cleanupLine();
      cleanupUpdate();
      cleanupQuery();
      cleanupFuel();
      cleanupShell();
    };
  }, []);

  // Actions
  const respondToQuery = useCallback((queryId: string, value: string) => {
    window.electronAPI.statusAgent.sendQueryResponse(queryId, value);
    setQueries(prev => prev.filter(q => q.id !== queryId));
  }, []);

  const stopAll = useCallback(() => {
    window.electronAPI.statusAgent.sendStopAll();
  }, []);

  return {
    lines: Array.from(lines.values()),
    queries,
    fuel,
    shellState,
    respondToQuery,
    stopAll,
  };
}
*/

export {};
