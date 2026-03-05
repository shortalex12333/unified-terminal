/**
 * useAppShell Hook
 *
 * Manages the overall app shell state, including tree visibility.
 * Controls transitions between idle, building, minimised, and complete states.
 */

import { useState, useEffect, useCallback } from 'react';

// Shell state type (matches what's sent via IPC)
type ShellState = 'idle' | 'building' | 'minimised' | 'complete';

// =============================================================================
// HOOK STATE INTERFACE
// =============================================================================

export interface AppShellState {
  /** Current shell state */
  state: ShellState;
  /** Whether the progress tree is visible */
  treeVisible: boolean;
  /** Whether the shell is in a minimized state */
  isMinimised: boolean;
  /** Whether a build is active (building or complete, not dismissed) */
  isActive: boolean;
}

export interface AppShellActions {
  /** Hide the progress tree (minimize view) */
  hideTree: () => void;
  /** Expand/show the progress tree */
  expandTree: () => void;
  /** Dismiss the tree completely (return to idle) */
  dismissTree: () => void;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useAppShell(): AppShellState & AppShellActions {
  const [state, setState] = useState<ShellState>('idle');
  const [treeVisible, setTreeVisible] = useState(false);

  // ==========================================================================
  // Derived State
  // ==========================================================================

  const isMinimised = state === 'minimised';
  const isActive = state === 'building' || state === 'complete' || state === 'minimised';

  // ==========================================================================
  // IPC Event Subscription
  // ==========================================================================

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (window.electronAPI?.statusAgent) {
      const api = window.electronAPI.statusAgent;

      cleanups.push(
        api.onShellState((newState) => {
          setState(newState);
          // Automatically show tree when building starts or completes
          if (newState === 'building' || newState === 'complete') {
            setTreeVisible(true);
          } else if (newState === 'idle') {
            setTreeVisible(false);
          } else if (newState === 'minimised') {
            setTreeVisible(false);
          }
        })
      );

      // Also listen for build started to ensure tree visibility
      cleanups.push(
        api.onBuildStarted(() => {
          setState('building');
          setTreeVisible(true);
        })
      );

      // Listen for build complete
      cleanups.push(
        api.onBuildComplete(() => {
          setState('complete');
          setTreeVisible(true);
        })
      );
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const hideTree = useCallback(() => {
    window.electronAPI?.statusAgent?.hideTree();
    setTreeVisible(false);
    // Only transition to minimised if we were building
    setState((prev) => (prev === 'building' ? 'minimised' : prev));
  }, []);

  const expandTree = useCallback(() => {
    window.electronAPI?.statusAgent?.expandTree();
    setTreeVisible(true);
    // Restore from minimised to building
    setState((prev) => (prev === 'minimised' ? 'building' : prev));
  }, []);

  const dismissTree = useCallback(() => {
    window.electronAPI?.statusAgent?.dismissTree();
    setTreeVisible(false);
    setState('idle');
  }, []);

  // ==========================================================================
  // Return combined state and actions
  // ==========================================================================

  return {
    state,
    treeVisible,
    isMinimised,
    isActive,
    hideTree,
    expandTree,
    dismissTree,
  };
}

export default useAppShell;
