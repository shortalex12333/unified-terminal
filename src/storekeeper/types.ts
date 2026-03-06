/**
 * Storekeeper Types — Project file storage constants
 *
 * Defines the hidden agent workspace directory structure.
 * See: CARL-TASK-SPINE-ARCHITECTURE.md Section 4.1
 */

export const STOREKEEPER_CONSTANTS = {
  /** Hidden agent workspace root — users never see this */
  KENOKI_DIR: '.kenoki_projects',
} as const;
