// Source: ENFORCEMENT-GAPS.md gap 2
// Prevent concurrent SPINE.md writes using lockfile pattern

import * as fs from "fs";
import * as path from "path";
import { SPINE_PROTOCOL } from "../constants/26-spine-protocol";

// ============================================================================
// ACQUIRE LOCK — create lockfile, wait if exists
// ============================================================================

export async function acquireLock(spinePath: string): Promise<void> {
  const lockFile = `${spinePath}.lock`;
  const maxWaitMs = SPINE_PROTOCOL.WRITE_LOCK_TIMEOUT_MS;
  const startTime = Date.now();

  while (true) {
    // Try to create lock file atomically (fails if exists)
    try {
      fs.writeFileSync(lockFile, JSON.stringify({ timestamp: Date.now(), pid: process.pid }), {
        flag: "wx", // exclusive write (fails if file exists)
      });

      // Success — lock acquired
      return;
    } catch (err) {
      // Lock file exists; check if we've exceeded timeout
      const elapsedMs = Date.now() - startTime;

      if (elapsedMs > maxWaitMs) {
        throw new Error(`Failed to acquire spine lock after ${maxWaitMs}ms. Lock file: ${lockFile}`);
      }

      // Wait 100ms and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

// ============================================================================
// RELEASE LOCK — delete lockfile
// ============================================================================

export async function releaseLock(spinePath: string): Promise<void> {
  const lockFile = `${spinePath}.lock`;

  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (err) {
    console.error(`Warning: failed to release lock file ${lockFile}:`, err);
  }
}

// ============================================================================
// CHECK LOCK — is lock held?
// ============================================================================

export function isLockHeld(spinePath: string): boolean {
  const lockFile = `${spinePath}.lock`;
  return fs.existsSync(lockFile);
}
