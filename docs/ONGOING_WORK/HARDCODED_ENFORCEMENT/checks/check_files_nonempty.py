#!/usr/bin/env python3
"""
Check 3: File Non-Empty
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 3

COMMAND:          fs.statSync(path).size for each declared file
PASS:             all files > 50 bytes
FALSE POSITIVE:   some config files legitimately < 50 bytes
SECONDARY:        check if file is a known config type (.env, .eslintrc)
CONFIDENCE:       heuristic
"""

import sys
import os
import json

# File threshold from HARDCODED-ENFORCEMENT-VALUES.md section 5
MIN_MEANINGFUL_BYTES = 50

# Known config files that can be < 50 bytes
CONFIG_WHITELIST = {
    ".env",
    ".eslintrc",
    ".prettierrc",
    ".editorconfig",
    "tsconfig.json",  # can be minimal
}

def check_files_nonempty(project_dir):
    """
    Check that all declared files are non-empty (> 50 bytes).
    Whitelist known config files.
    """
    expected_files = [
        "package.json",
        "src",
    ]

    # Load manifest if available
    manifest_path = os.path.join(project_dir, ".enforcer-manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
                expected_files = manifest.get("declaredFiles", expected_files)
        except Exception as e:
            print(f"WARN: Could not read manifest: {e}")

    failures = []
    for file_path in expected_files:
        full_path = os.path.join(project_dir, file_path)

        if not os.path.exists(full_path):
            continue

        # Check file size
        try:
            size = os.path.getsize(full_path)
            filename = os.path.basename(file_path)

            if size < MIN_MEANINGFUL_BYTES:
                # Check whitelist
                if filename not in CONFIG_WHITELIST and not any(
                    full_path.endswith(cfg) for cfg in CONFIG_WHITELIST
                ):
                    failures.append(f"{file_path} ({size} bytes, needs > {MIN_MEANINGFUL_BYTES})")
        except Exception as e:
            print(f"WARN: Could not check {file_path}: {e}")

    if failures:
        print(f"FAIL: Files too small:")
        for fail in failures:
            print(f"  - {fail}")
        return False

    print(f"PASS: All files meet minimum size ({MIN_MEANINGFUL_BYTES} bytes)")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_files_nonempty.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_files_nonempty(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
