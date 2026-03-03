// Source: HARDCODED-ENFORCEMENT-VALUES.md section 2
// Registry: register/unregister timers, pause/resume

import { CRON_INTERVALS } from "../constants/02-cron-intervals";
import { CronEntry } from "./types";

// ============================================================================
// CRON REGISTRY (singleton)
// ============================================================================

const cronRegistry = new Map<string, CronEntry>();
let isPaused = false;

// ============================================================================
// REGISTER CRON — add timer to registry
// ============================================================================

export function registerCron(name: string, interval: number, fn: () => void | Promise<void>): void {
  // Prevent duplicates
  if (cronRegistry.has(name)) {
    console.warn(`[CRON] Cron job "${name}" already registered, skipping`);
    return;
  }

  // Create timer
  const timerId = setInterval(() => {
    if (!isPaused) {
      Promise.resolve(fn()).catch((err) => {
        console.error(`[CRON] Error in "${name}":`, err);
      });
    }
  }, interval);

  // Register
  cronRegistry.set(name, {
    name,
    interval,
    timerId,
    fn,
    active: true,
  });

  console.log(`[CRON] Registered "${name}" with interval ${interval}ms`);
}

// ============================================================================
// UNREGISTER CRON — remove timer
// ============================================================================

export function unregisterCron(name: string): void {
  const entry = cronRegistry.get(name);
  if (!entry) {
    console.warn(`[CRON] No cron job named "${name}"`);
    return;
  }

  clearInterval(entry.timerId as NodeJS.Timeout);
  cronRegistry.delete(name);
  console.log(`[CRON] Unregistered "${name}"`);
}

// ============================================================================
// PAUSE ALL — stop all timers temporarily
// ============================================================================

export function pauseAll(): void {
  isPaused = true;
  console.log(`[CRON] Paused all ${cronRegistry.size} cron jobs`);
}

// ============================================================================
// RESUME ALL — restart all timers
// ============================================================================

export function resumeAll(): void {
  isPaused = false;
  console.log(`[CRON] Resumed all ${cronRegistry.size} cron jobs`);
}

// ============================================================================
// GET REGISTRY — view all registered crons
// ============================================================================

export function getRegistry(): CronEntry[] {
  return Array.from(cronRegistry.values());
}

// ============================================================================
// CLEAR ALL — clean up on shutdown
// ============================================================================

export function clearAll(): void {
  for (const [name, entry] of cronRegistry.entries()) {
    clearInterval(entry.timerId as NodeJS.Timeout);
  }

  cronRegistry.clear();
  isPaused = false;
  console.log("[CRON] Cleared all cron jobs");
}

// ============================================================================
// IS PAUSED
// ============================================================================

export function isCronPaused(): boolean {
  return isPaused;
}
