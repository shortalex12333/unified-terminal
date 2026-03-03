#!/usr/bin/env python3
"""
Check 8: Uninstall Verification
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 8

COMMAND:          check node_modules/{package} for each claimed-uninstalled package
PASS:             none of the claimed-removed packages exist on disk
FALSE POSITIVE:   none
CONFIDENCE:       definitive
"""

import sys
import os
import json

def check_uninstall(project_dir):
    """
    Verify that claimed-uninstalled packages are actually removed from node_modules.
    """
    # Load manifest
    manifest_path = os.path.join(project_dir, ".enforcer-manifest.json")
    if not os.path.exists(manifest_path):
        print("INFO: No manifest found, skipping uninstall check")
        return True

    try:
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"WARN: Could not read manifest: {e}")
        return True

    # Get list of claimed-removed packages
    claimed_removed = manifest.get("claimedRemoved", [])

    if not claimed_removed:
        print("INFO: No claimed removals in manifest")
        return True

    node_modules_path = os.path.join(project_dir, "node_modules")

    if not os.path.isdir(node_modules_path):
        print("WARN: node_modules directory not found, skipping uninstall check")
        return True

    # Check each claimed-removed package
    still_present = []
    for package in claimed_removed:
        package_path = os.path.join(node_modules_path, package)
        if os.path.exists(package_path):
            still_present.append(package)

    if still_present:
        print("FAIL: Claimed-removed packages still present:")
        for package in still_present:
            print(f"  - {package}")
        return False

    print(f"PASS: All {len(claimed_removed)} claimed-removed packages verified gone")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_uninstall.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_uninstall(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
