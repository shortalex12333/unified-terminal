// Source: HARDCODED-ENFORCEMENT-VALUES.md section 7
// State machine: OPEN → PAUSED → CLOSED → auto-archive

import { PROJECT_STATE } from "../constants/07-project-state";
import { ProjectStateContext } from "./types";

// ============================================================================
// PROJECT STATE (singleton)
// ============================================================================

let projectContext: ProjectStateContext = {
  state: "OPEN",
  lastActivity: Date.now(),
  pauseTimestamp: undefined,
  shouldAutoArchive: false,
};

// ============================================================================
// UPDATE PROJECT STATE — check transitions
// ============================================================================

export function updateProjectState(newState?: string): void {
  const now = Date.now();
  const idle = now - projectContext.lastActivity;

  // OPEN → PAUSED (15 minutes of inactivity)
  if (projectContext.state === "OPEN" && idle > PROJECT_STATE.INACTIVITY_TO_PAUSE_MS) {
    projectContext.state = "PAUSED";
    projectContext.pauseTimestamp = now;
    console.log(`[PROJECT-STATE] Transitioned to PAUSED after ${(idle / 1000 / 60).toFixed(1)} min of inactivity`);
  }

  // PAUSED → CLOSED (24 hours since paused)
  if (
    projectContext.state === "PAUSED" &&
    projectContext.pauseTimestamp !== undefined &&
    now - projectContext.pauseTimestamp > PROJECT_STATE.PAUSE_TO_CLOSE_MS
  ) {
    projectContext.state = "CLOSED";
    projectContext.shouldAutoArchive = true;
    console.log(
      `[PROJECT-STATE] Transitioned to CLOSED after ${((now - projectContext.pauseTimestamp) / 1000 / 60 / 60).toFixed(1)} hours paused`,
    );

    // In real implementation: trigger Archivist to create PROJECT-ARCHIVE.md + llms.txt
    // runArchivist();
  }

  // Optionally override state if explicitly requested
  if (newState && ["OPEN", "PAUSED", "CLOSED"].includes(newState)) {
    projectContext.state = newState as "OPEN" | "PAUSED" | "CLOSED";
  }
}

// ============================================================================
// RECORD ACTIVITY — user did something, reset idle timer
// ============================================================================

export function recordActivity(): void {
  projectContext.lastActivity = Date.now();

  // If PAUSED, return to OPEN on user activity
  if (projectContext.state === "PAUSED") {
    projectContext.state = "OPEN";
    projectContext.pauseTimestamp = undefined;
    console.log("[PROJECT-STATE] User activity detected, returning to OPEN");
  }
}

// ============================================================================
// SHOULD AUTO ARCHIVE — is archiving needed?
// ============================================================================

export function shouldAutoArchive(): boolean {
  return projectContext.shouldAutoArchive === true;
}

// ============================================================================
// GET PROJECT STATE
// ============================================================================

export function getProjectState(): ProjectStateContext {
  return { ...projectContext };
}

// ============================================================================
// SET PROJECT STATE (for testing/recovery)
// ============================================================================

export function setProjectState(state: ProjectStateContext): void {
  projectContext = state;
}

// ============================================================================
// STATE TRANSITION CHECK (runs every minute, can be called from cron)
// ============================================================================

export function runStateTransitionCheck(): void {
  updateProjectState();
}
