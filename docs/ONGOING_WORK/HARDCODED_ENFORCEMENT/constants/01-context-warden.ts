// Source: HARDCODED-ENFORCEMENT-VALUES.md section 1

export const TOKEN_THRESHOLDS: Record<string, { window: number; killAt: number; effective: number }> = {
  "claude-sonnet-4": { window: 200_000, killAt: 0.55, effective: 110_000 },
  "claude-opus-4": { window: 200_000, killAt: 0.65, effective: 130_000 },
  "gpt-4o": { window: 128_000, killAt: 0.60, effective: 76_800 },
  "gpt-4o-mini": { window: 128_000, killAt: 0.50, effective: 64_000 },
  "o3": { window: 200_000, killAt: 0.65, effective: 130_000 },
  "gemini-pro": { window: 1_000_000, killAt: 0.60, effective: 600_000 },
  "gemini-flash": { window: 1_000_000, killAt: 0.50, effective: 500_000 },
  "default": { window: 128_000, killAt: 0.55, effective: 70_400 },
};

export const GRACE_THRESHOLD = 0.85; // task progress ratio
