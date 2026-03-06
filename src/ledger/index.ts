/**
 * Ledger Module — File-based Communication Backbone
 *
 * The ledger system provides append-only, auditable communication between actors:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    LEDGER COMMUNICATION FLOWS                       │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                     │
 * │   Worker ──checkpoint──▶ worker_checkpoints.jsonl                   │
 * │      │                          │                                   │
 * │      │                          ▼                                   │
 * │      │                  ┌───────────────┐                          │
 * │      │                  │    Monkey     │ (READ-ONLY observer)      │
 * │      │                  │  sub_spines   │                          │
 * │      │                  └───────┬───────┘                          │
 * │      │                          │                                   │
 * │      │              ONE-WAY     ▼                                   │
 * │      │                  monkey_detections.jsonl                     │
 * │      │                          │                                   │
 * │      │                          ▼                                   │
 * │      │                  ┌───────────────┐                          │
 * │      └──────────────────│      PA       │◀─── spine.jsonl          │
 * │                         │  (Decision    │                          │
 * │                         │    Brain)     │◀─── bodyguard.jsonl      │
 * │                         └───────┬───────┘                          │
 * │                                 │                                   │
 * │              pa_decisions.jsonl │ pa_queries.jsonl                  │
 * │                                 │                                   │
 * │                                 ▼                                   │
 * │                  ┌──────────────────────────┐                      │
 * │                  │      Orchestrator        │                      │
 * │                  │   (Step Scheduler)       │                      │
 * │                  └────────────┬─────────────┘                      │
 * │                               │                                     │
 * │               orchestrator.jsonl                                    │
 * │                               │                                     │
 * │                               ▼                                     │
 * │                  ┌──────────────────────────┐                      │
 * │                  │        Workers           │                      │
 * │                  │   (CLI agents)           │                      │
 * │                  └──────────────────────────┘                      │
 * │                                                                     │
 * │   Bodyguard ──verdict──▶ bodyguard.jsonl ──▶ PA                    │
 * │                                                                     │
 * │   Spine ──snapshot/diff──▶ spine.jsonl ──▶ PA                      │
 * │                                                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * KEY CONSTRAINTS:
 * 1. Ledgers are APPEND-ONLY (no edits, no deletes)
 * 2. Monkey writes ONE-WAY to PA (never receives direct replies)
 * 3. PA is the central decision point (reads all ledgers)
 * 4. Orchestrator acts on PA decisions
 * 5. correlationId links entries across ledgers for tracing
 */

// Re-export types
export * from './types';

// Re-export writer
export { LedgerWriter, getLedgerWriter, resetLedgerWriter, generateLedgerId } from './writer';

// Re-export reader
export { LedgerReader, getLedgerReader, resetLedgerReader } from './reader';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { getLedgerWriter } from './writer';
import { getLedgerReader } from './reader';
import type { MonkeyLedgerEntry, PADecisionLedgerEntry, OrchestratorLedgerEntry } from './types';

/**
 * Initialize ledger system for a project.
 * Creates ledger files and starts watching.
 */
export function initializeLedgers(projectRoot: string): {
  writer: ReturnType<typeof getLedgerWriter>;
  reader: ReturnType<typeof getLedgerReader>;
} {
  const writer = getLedgerWriter(projectRoot);
  const reader = getLedgerReader(projectRoot);

  // Start watching key ledgers
  reader.watch('ledgers/monkey_detections.jsonl');
  reader.watch('ledgers/pa_decisions.jsonl');
  reader.watch('ledgers/orchestrator.jsonl');
  reader.watch('ledgers/worker_checkpoints.jsonl');

  return { writer, reader };
}

/**
 * Clean up ledger system.
 */
export function cleanupLedgers(): void {
  const { resetLedgerWriter } = require('./writer');
  const { resetLedgerReader } = require('./reader');
  resetLedgerWriter();
  resetLedgerReader();
}

// =============================================================================
// LEDGER FILE PATHS
// =============================================================================

/**
 * All ledger file paths (relative to .kenoki/)
 */
export const LEDGER_PATHS = {
  BODYGUARD: 'ledgers/bodyguard.jsonl',
  SPINE: 'ledgers/spine.jsonl',
  MONKEY_DETECTIONS: 'ledgers/monkey_detections.jsonl',
  MONKEY_PATTERNS: 'ledgers/monkey_patterns.jsonl',
  PA_DECISIONS: 'ledgers/pa_decisions.jsonl',
  PA_QUERIES: 'ledgers/pa_queries.jsonl',
  ORCHESTRATOR: 'ledgers/orchestrator.jsonl',
  WORKER_CHECKPOINTS: 'ledgers/worker_checkpoints.jsonl',
  CARL: 'ledgers/carl.jsonl',
} as const;
