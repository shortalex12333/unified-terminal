// Source: HARDCODED-ENFORCEMENT-VALUES.md section 12

export const PHASE_BUDGET_WEIGHTS = {
  discuss: 0.1, // 10% of total budget
  plan: 0.15, // 15%
  execute: 0.6, // 60% (the actual work)
  verify: 0.1, // 10%
  archive: 0.05, // 5%
};

// Per-worker budget within a phase:
// worker_budget = (total_budget × phase_weight) / num_workers_in_phase
