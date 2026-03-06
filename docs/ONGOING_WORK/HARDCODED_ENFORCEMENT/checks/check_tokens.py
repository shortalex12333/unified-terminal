#!/usr/bin/env python3
"""
Check 6: Token Threshold (Context Warden)
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 6

COMMAND:          compare agent.tokensUsed against per-model threshold
PASS:             utilization < model.killAt OR (utilization > killAt AND taskProgress > 0.85)
FALSE POSITIVE:   none (token counts are exact)
CONFIDENCE:       definitive
"""

import sys
import json
import os

# From HARDCODED-ENFORCEMENT-VALUES.md section 1
TOKEN_THRESHOLDS = {
    "claude-sonnet-4":  {"window": 200_000,   "killAt": 0.55, "effective": 110_000, "maxOutput": 64_000},
    "claude-opus-4":    {"window": 200_000,   "killAt": 0.65, "effective": 130_000, "maxOutput": 64_000},
    "gpt-5-codex":      {"window": 400_000,   "killAt": 0.60, "effective": 240_000, "maxOutput": 128_000},
    "gpt-5":            {"window": 400_000,   "killAt": 0.60, "effective": 240_000, "maxOutput": 128_000},
    "default":          {"window": 400_000,   "killAt": 0.55, "effective": 220_000, "maxOutput": 128_000},
}

# From HARDCODED-ENFORCEMENT-VALUES.md section 1
GRACE_THRESHOLD = 0.85

def check_tokens(project_dir):
    """
    Check token utilization against per-model threshold.
    Read token data from agent context file if available.
    """
    # Look for agent context file
    context_file = os.path.join(project_dir, ".agent-context.json")

    if not os.path.exists(context_file):
        print("INFO: No agent context file found, skipping token check")
        return True

    try:
        with open(context_file, "r") as f:
            context = json.load(f)
    except Exception as e:
        print(f"WARN: Could not read context file: {e}")
        return True

    # Extract token info
    tokens_used = context.get("tokensUsed", 0)
    model = context.get("model", "default")
    task_progress = context.get("taskProgress", 0.0)

    # Get threshold for model
    threshold = TOKEN_THRESHOLDS.get(model, TOKEN_THRESHOLDS["default"])
    window = threshold["window"]
    kill_at = threshold["killAt"]

    # Calculate utilization
    utilization = tokens_used / window if window > 0 else 0

    # Grace rule: allow completion if nearly done
    if utilization > kill_at:
        if task_progress > GRACE_THRESHOLD:
            print(f"PASS: Token utilization {utilization:.1%} exceeds kill_at {kill_at:.1%}, "
                  f"but task is {task_progress:.1%} complete (grace threshold: {GRACE_THRESHOLD:.1%})")
            return True
        else:
            print(f"FAIL: Token utilization {utilization:.1%} exceeds kill_at {kill_at:.1%}, "
                  f"task only {task_progress:.1%} complete (grace threshold: {GRACE_THRESHOLD:.1%})")
            return False
    else:
        print(f"PASS: Token utilization {utilization:.1%} within threshold ({kill_at:.1%})")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_tokens.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_tokens(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
