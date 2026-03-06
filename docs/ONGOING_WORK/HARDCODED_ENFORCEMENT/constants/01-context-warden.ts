// Source: HARDCODED-ENFORCEMENT-VALUES.md section 1

export const TOKEN_THRESHOLDS: Record<string, { window: number; killAt: number; effective: number; maxOutput: number }> = {
  "claude-sonnet-4": { window: 200_000, killAt: 0.55, effective: 110_000, maxOutput: 64_000 },
  "claude-opus-4": { window: 200_000, killAt: 0.65, effective: 130_000, maxOutput: 64_000 },
  "gpt-5-codex": { window: 400_000, killAt: 0.60, effective: 240_000, maxOutput: 128_000 },
  "gpt-5": { window: 400_000, killAt: 0.60, effective: 240_000, maxOutput: 128_000 },
  "default": { window: 400_000, killAt: 0.55, effective: 220_000, maxOutput: 128_000 },
};

export const GRACE_THRESHOLD = 0.85; // task progress ratio
