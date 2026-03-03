// Source: ENFORCEMENT-GAPS.md gap 10

export const STEP_EXECUTION = {
  // Heartbeat: how often worker must produce output to prove it's alive
  HEARTBEAT_INTERVAL_MS: 60_000, // 1 minute

  // What counts as "output" for heartbeat purposes
  HEARTBEAT_SIGNALS: ["stdout_bytes", "file_created", "file_modified", "api_call"],

  // Stale worker detection: no heartbeat for N intervals = presumed stuck
  STALE_AFTER_MISSED_BEATS: 3, // 3 minutes of silence = stuck

  // What to do with stuck worker
  STALE_WORKER_POLICY: "kill_and_retry", // not "warn" — kill it

  // Output capture: where worker stdout/stderr goes
  OUTPUT_CAPTURE_PATH: ".prism/logs/{step_id}.log",

  // Max output capture size per step
  MAX_OUTPUT_CAPTURE_BYTES: 2_000_000, // 2MB
};
