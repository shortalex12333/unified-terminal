// Source: HARDCODED-ENFORCEMENT-VALUES.md section 7

export const PROJECT_STATE = {
  // OPEN -> PAUSED: inactivity timer
  INACTIVITY_TO_PAUSE_MS: 900_000, // 15 minutes no user activity

  // PAUSED -> CLOSED: abandonment timer
  PAUSE_TO_CLOSE_MS: 86_400_000, // 24 hours

  // On CLOSE: Archivist runs automatically. No user action needed.
  // On REOPEN (user returns after CLOSED): PA reads archive, PAUL mode activates.
};

// State transition logic
export interface ProjectStateContext {
  state: "OPEN" | "PAUSED" | "CLOSED";
  lastActivity: number;
  pauseTimestamp?: number;
}

export function createStateTransitionCheck(): (context: ProjectStateContext) => void {
  return (context: ProjectStateContext) => {
    const now = Date.now();
    const idle = now - context.lastActivity;

    if (context.state === "OPEN" && idle > PROJECT_STATE.INACTIVITY_TO_PAUSE_MS) {
      context.state = "PAUSED";
      context.pauseTimestamp = now;
    }

    if (context.state === "PAUSED" && context.pauseTimestamp !== undefined && (now - context.pauseTimestamp) > PROJECT_STATE.PAUSE_TO_CLOSE_MS) {
      context.state = "CLOSED";
      // runArchivist(); // produces PROJECT-ARCHIVE.md + llms.txt
    }
  };
}
