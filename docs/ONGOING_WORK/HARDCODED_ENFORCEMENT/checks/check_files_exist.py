#!/usr/bin/env python3
"""
Check 2: File Existence
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 2

COMMAND:          fs.existsSync(path) for each declared file
PASS:             all declared files exist on disk
FALSE POSITIVE:   none
CONFIDENCE:       definitive
"""

import sys
import os
import json

def check_files_exist(project_dir):
    """
    Check that all required files exist.
    Reads from a manifest file or checks standard expected files.
    """
    # Check for common expected files based on project type
    expected_files = [
        "package.json",
        "tsconfig.json",
        "src",
    ]

    # Also check for manifest if it exists
    manifest_path = os.path.join(project_dir, ".enforcer-manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
                expected_files = manifest.get("declaredFiles", expected_files)
        except Exception as e:
            print(f"WARN: Could not read manifest: {e}")

    missing_files = []
    for file_path in expected_files:
        full_path = os.path.join(project_dir, file_path)
        if not os.path.exists(full_path):
            missing_files.append(file_path)

    if missing_files:
        print(f"FAIL: Missing files: {', '.join(missing_files)}")
        return False

    print(f"PASS: All {len(expected_files)} declared files exist")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_files_exist.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_files_exist(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
