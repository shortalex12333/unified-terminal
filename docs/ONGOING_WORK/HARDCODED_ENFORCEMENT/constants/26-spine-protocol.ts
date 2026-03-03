// Source: ENFORCEMENT-GAPS.md gap 2

export const SPINE_PROTOCOL = {
  // Max age of spine data before it's considered stale
  MAX_STALENESS_MS: 30_000, // 30 seconds

  // What happens when an agent reads stale spine
  STALE_SPINE_POLICY: "force_refresh_before_action",

  // Spine write lock: prevent concurrent writes
  // (two agents finishing simultaneously could corrupt SPINE.md)
  WRITE_LOCK_TIMEOUT_MS: 5_000, // 5 seconds to acquire lock

  // Spine file max size before rotation
  MAX_SPINE_SIZE_BYTES: 100_000, // 100KB — if bigger, spine is bloated

  // What spine sections are REQUIRED (binary: present or not)
  REQUIRED_SECTIONS: ["files", "gitStatus", "lastTestRun", "dagProgress", "projectState"],
};
