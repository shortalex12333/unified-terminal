/**
 * useStatusAgent Hook
 *
 * Main hook for Status Agent state management in the renderer process.
 * Subscribes to IPC events from the main process and provides state + actions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type StatusState = 'pending' | 'active' | 'done' | 'error' | 'paused' | 'waiting_user';

export interface StatusLine {
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

export interface StatusLineUpdate {
  id: string;
  text?: string;
  state?: StatusState;
  progress?: number | null;
  expandable?: boolean;
  expandedText?: string | null;
  icon?: string;
}

export interface QueryOption {
  label: string;
  value: string;
  detail: string | null;
  icon: string | null;
}

export interface UserQuery {
  id: string;
  source: string;
  stepId: number | null;
  agentHandle: string;
  type: 'choice' | 'text' | 'confirm' | 'upload';
  question: string;
  options: QueryOption[];
  placeholder: string | null;
  defaultChoice: string | null;
  timeout: number;
  priority: 'normal' | 'blocking';
}

export interface FuelState {
  percent: number;
  label: string;
  detail: string;
  warning: boolean;
  warningText: string | null;
}

// =============================================================================
// RENDERER TREE NODE (adapted for React rendering)
// =============================================================================

/**
 * Tree node structure optimized for React rendering.
 * Flattens children into nested structure rather than ID references.
 */
export interface RenderTreeNode {
  id: string;
  label: string;
  state: StatusState;
  progress: number;
  elapsed?: string;
  parallel?: boolean;
  children: RenderTreeNode[];
}

// =============================================================================
// HOOK STATE INTERFACE
// =============================================================================

export interface StatusAgentState {
  /** Hierarchical tree of status nodes for rendering */
  tree: RenderTreeNode[];
  /** Currently active user query, if any */
  query: UserQuery | null;
  /** Current fuel gauge state */
  fuel: FuelState;
  /** Overall build state */
  buildState: 'idle' | 'building' | 'complete';
  /** Project name from build started event */
  projectName: string | null;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Interrupt feedback message */
  interruptFeedback: { text: string; detail: string } | null;
  /** Query countdown timer (seconds remaining) */
  queryTimer: number;
}

export interface StatusAgentActions {
  /** Respond to a user query */
  sendQueryResponse: (queryId: string, value: string) => void;
  /** Send user correction/feedback */
  sendCorrection: (text: string) => void;
  /** Stop a specific step */
  sendStopStep: (stepId: number) => void;
  /** Stop all running steps */
  sendStopAll: () => void;
  /** Pause the build */
  sendPause: () => void;
  /** Resume the build */
  sendResume: () => void;
}

// =============================================================================
// HELPER: Build tree structure from flat status lines
// =============================================================================

/**
 * Convert StatusLine into RenderTreeNode.
 * StatusLine has parentId references; we need nested children arrays.
 */
function buildRenderTree(lines: Map<string, StatusLine>): RenderTreeNode[] {
  const nodeMap = new Map<string, RenderTreeNode>();
  const rootNodes: RenderTreeNode[] = [];

  // First pass: create all nodes
  for (const [id, line] of lines) {
    nodeMap.set(id, {
      id: line.id,
      label: line.text,
      state: line.state,
      progress: line.progress ?? 0,
      children: [],
    });
  }

  // Second pass: build hierarchy
  for (const [id, line] of lines) {
    const node = nodeMap.get(id)!;
    if (line.parentId && nodeMap.has(line.parentId)) {
      nodeMap.get(line.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

/**
 * Update tree with a new or updated status line.
 */
function updateTreeWithLine(
  linesMap: Map<string, StatusLine>,
  line: StatusLine
): Map<string, StatusLine> {
  const newMap = new Map(linesMap);
  newMap.set(line.id, line);
  return newMap;
}

/**
 * Apply partial update to existing line.
 */
function applyPartialUpdate(
  linesMap: Map<string, StatusLine>,
  update: { id: string } & Partial<StatusLine>
): Map<string, StatusLine> {
  const existing = linesMap.get(update.id);
  if (!existing) return linesMap;

  const newMap = new Map(linesMap);
  newMap.set(update.id, { ...existing, ...update });
  return newMap;
}

/**
 * Calculate overall progress from root nodes.
 */
function calculateOverallProgress(tree: RenderTreeNode[]): number {
  if (tree.length === 0) return 0;
  const sum = tree.reduce((acc, node) => acc + node.progress, 0);
  return Math.round(sum / tree.length);
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useStatusAgent(): StatusAgentState & StatusAgentActions {
  // Internal state: flat map of status lines
  const linesMapRef = useRef<Map<string, StatusLine>>(new Map());

  // Rendered state
  const [tree, setTree] = useState<RenderTreeNode[]>([]);
  const [query, setQuery] = useState<UserQuery | null>(null);
  const [fuel, setFuel] = useState<FuelState>({
    percent: 100,
    label: 'Ready',
    detail: '',
    warning: false,
    warningText: null,
  });
  const [buildState, setBuildState] = useState<'idle' | 'building' | 'complete'>('idle');
  const [projectName, setProjectName] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [interruptFeedback, setInterruptFeedback] = useState<{
    text: string;
    detail: string;
  } | null>(null);
  const [queryTimer, setQueryTimer] = useState(0);

  // Timer ref for query countdown
  const queryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==========================================================================
  // IPC Event Subscriptions
  // ==========================================================================

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (window.electronAPI?.statusAgent) {
      const api = window.electronAPI.statusAgent;

      // ────────────────────────────────────────────────────────────────────
      // Status Line Events
      // ────────────────────────────────────────────────────────────────────

      cleanups.push(
        api.onStatusLine((line) => {
          linesMapRef.current = updateTreeWithLine(linesMapRef.current, line);
          const newTree = buildRenderTree(linesMapRef.current);
          setTree(newTree);
          setOverallProgress(calculateOverallProgress(newTree));
        })
      );

      cleanups.push(
        api.onStatusLineUpdate((data) => {
          linesMapRef.current = applyPartialUpdate(linesMapRef.current, data);
          const newTree = buildRenderTree(linesMapRef.current);
          setTree(newTree);
          setOverallProgress(calculateOverallProgress(newTree));
        })
      );

      cleanups.push(
        api.onStatusLineBatch((lines) => {
          for (const line of lines) {
            linesMapRef.current = updateTreeWithLine(linesMapRef.current, line);
          }
          const newTree = buildRenderTree(linesMapRef.current);
          setTree(newTree);
          setOverallProgress(calculateOverallProgress(newTree));
        })
      );

      cleanups.push(
        api.onStatusLineUpdateBatch((updates) => {
          for (const update of updates) {
            linesMapRef.current = applyPartialUpdate(linesMapRef.current, update);
          }
          const newTree = buildRenderTree(linesMapRef.current);
          setTree(newTree);
          setOverallProgress(calculateOverallProgress(newTree));
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // User Query Events
      // ────────────────────────────────────────────────────────────────────

      cleanups.push(
        api.onQuery((incomingQuery) => {
          setQuery(incomingQuery);
          // Start countdown timer
          const timeoutSeconds = Math.ceil(incomingQuery.timeout / 1000);
          setQueryTimer(timeoutSeconds);

          // Clear any existing timer
          if (queryTimerRef.current) {
            clearInterval(queryTimerRef.current);
          }

          // Start new countdown
          queryTimerRef.current = setInterval(() => {
            setQueryTimer((prev) => {
              if (prev <= 1) {
                if (queryTimerRef.current) {
                  clearInterval(queryTimerRef.current);
                  queryTimerRef.current = null;
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        })
      );

      cleanups.push(
        api.onQueryTimeout(({ queryId, defaultValue }) => {
          // Clear timer
          if (queryTimerRef.current) {
            clearInterval(queryTimerRef.current);
            queryTimerRef.current = null;
          }
          // Only clear if this is the current query
          setQuery((currentQuery) => {
            if (currentQuery?.id === queryId) {
              return null;
            }
            return currentQuery;
          });
          setQueryTimer(0);
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // Fuel Gauge Events
      // ────────────────────────────────────────────────────────────────────

      cleanups.push(api.onFuelUpdate(setFuel));

      // ────────────────────────────────────────────────────────────────────
      // Build Lifecycle Events
      // ────────────────────────────────────────────────────────────────────

      cleanups.push(
        api.onBuildStarted(({ projectName: name }) => {
          setProjectName(name);
          setBuildState('building');
          // Clear previous state
          linesMapRef.current = new Map();
          setTree([]);
          setOverallProgress(0);
        })
      );

      cleanups.push(
        api.onBuildComplete(() => {
          setBuildState('complete');
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // Interrupt Acknowledgement
      // ────────────────────────────────────────────────────────────────────

      cleanups.push(
        api.onInterruptAck(({ message, affected }) => {
          setInterruptFeedback({
            text: 'Got it - updating based on your feedback',
            detail: message,
          });
          // Auto-clear after 4 seconds
          setTimeout(() => setInterruptFeedback(null), 4000);
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // Shell State Events
      // ────────────────────────────────────────────────────────────────────

      cleanups.push(
        api.onShellState((state) => {
          if (state === 'idle') {
            setBuildState('idle');
            linesMapRef.current = new Map();
            setTree([]);
            setOverallProgress(0);
            setProjectName(null);
          } else if (state === 'building') {
            setBuildState('building');
          } else if (state === 'complete') {
            setBuildState('complete');
          }
        })
      );
    }

    // Cleanup all subscriptions on unmount
    return () => {
      cleanups.forEach((fn) => fn());
      if (queryTimerRef.current) {
        clearInterval(queryTimerRef.current);
        queryTimerRef.current = null;
      }
    };
  }, []);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const sendQueryResponse = useCallback((queryId: string, value: string) => {
    window.electronAPI?.statusAgent?.sendQueryResponse(queryId, value);
    // Clear query immediately
    setQuery(null);
    setQueryTimer(0);
    if (queryTimerRef.current) {
      clearInterval(queryTimerRef.current);
      queryTimerRef.current = null;
    }
  }, []);

  const sendCorrection = useCallback((text: string) => {
    window.electronAPI?.statusAgent?.sendCorrection(text);
  }, []);

  const sendStopStep = useCallback((stepId: number) => {
    window.electronAPI?.statusAgent?.sendStopStep(stepId);
  }, []);

  const sendStopAll = useCallback(() => {
    window.electronAPI?.statusAgent?.sendStopAll();
  }, []);

  const sendPause = useCallback(() => {
    window.electronAPI?.statusAgent?.sendPause();
  }, []);

  const sendResume = useCallback(() => {
    window.electronAPI?.statusAgent?.sendResume();
  }, []);

  // ==========================================================================
  // Return combined state and actions
  // ==========================================================================

  return {
    tree,
    query,
    fuel,
    buildState,
    projectName,
    overallProgress,
    interruptFeedback,
    queryTimer,
    sendQueryResponse,
    sendCorrection,
    sendStopStep,
    sendStopAll,
    sendPause,
    sendResume,
  };
}

export default useStatusAgent;
