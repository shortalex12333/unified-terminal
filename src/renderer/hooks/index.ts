/**
 * Renderer Hooks Index
 *
 * Exports all custom hooks for the renderer process.
 */

export { useStatusAgent } from './useStatusAgent';
export type {
  StatusAgentState,
  StatusAgentActions,
  RenderTreeNode,
  StatusState,
  StatusLine,
  StatusLineUpdate,
  QueryOption,
  UserQuery,
  FuelState,
} from './useStatusAgent';

export { useAppShell } from './useAppShell';
export type { AppShellState, AppShellActions } from './useAppShell';
