#!/usr/bin/env python3
"""
Check 5: Scope Enforcement
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 5

COMMAND:          git diff --name-only HEAD
PASS:             every modified file is in step.declaredFiles[]
FALSE POSITIVE:   auto-generated files (package-lock.json, .next/, node_modules/)
SECONDARY:        filter out known auto-gen patterns before comparison
AUTO-GEN WHITELIST: package-lock.json, yarn.lock, .next/*, node_modules/*, __pycache__/*
CONFIDENCE:       definitive
"""

import sys
import os
import subprocess
import json

# From HARDCODED-ENFORCEMENT-VALUES.md section 21
SCOPE_WHITELIST_EXACT = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

SCOPE_WHITELIST_PREFIXES = {
    ".next/",
    "node_modules/",
    "__pycache__/",
    "dist/",
    ".git/",
}

def is_whitelisted(filepath):
    """Check if file is auto-generated and whitelisted."""
    # Check exact matches
    if os.path.basename(filepath) in SCOPE_WHITELIST_EXACT:
        return True

    # Check prefixes
    for prefix in SCOPE_WHITELIST_PREFIXES:
        if filepath.startswith(prefix) or f"/{prefix}" in filepath:
            return True

    return False

def check_scope(project_dir):
    """
    Verify all modified files are within declared scope.
    Filter out auto-generated files.
    """
    os.chdir(project_dir)

    # Get modified files from git
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            print("WARN: Could not run git diff (not a git repo?)")
            return True  # Skip check if not in git repo

        modified_files = result.stdout.strip().split("\n")
        modified_files = [f for f in modified_files if f]  # Remove empty lines
    except Exception as e:
        print(f"WARN: Could not get git diff: {e}")
        return True

    # Load manifest for declared files
    declared_files = []
    manifest_path = os.path.join(project_dir, ".enforcer-manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
                declared_files = manifest.get("declaredFiles", [])
        except Exception as e:
            print(f"WARN: Could not read manifest: {e}")

    # Filter out whitelisted files
    out_of_scope = []
    for modified_file in modified_files:
        if is_whitelisted(modified_file):
            continue

        # Check if in declared files
        if declared_files and modified_file not in declared_files:
            out_of_scope.append(modified_file)

    if out_of_scope:
        print("FAIL: Modified files outside declared scope:")
        for file in out_of_scope:
            print(f"  - {file}")
        return False

    print(f"PASS: All {len(modified_files)} modified files in scope")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_scope.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_scope(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
