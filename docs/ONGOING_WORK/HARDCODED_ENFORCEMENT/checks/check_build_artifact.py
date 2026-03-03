#!/usr/bin/env python3
"""
Check 4: Build Artifact Exists
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 4

COMMAND:          fs.readdirSync("dist/") + glob for .html/.js/.css
PASS:             dist/ exists AND contains at least one .html, .js, or .css file
FALSE POSITIVE:   dist/ has only sourcemaps
SECONDARY:        find dist/ -name '*.html' -o -name '*.js'
CONFIDENCE:       definitive
"""

import sys
import os
import glob

def check_build_artifact(project_dir):
    """
    Verify build artifacts exist in dist/ directory.
    Must have at least one .html, .js, or .css file (not just sourcemaps).
    """
    dist_path = os.path.join(project_dir, "dist")

    # Check if dist directory exists
    if not os.path.isdir(dist_path):
        print(f"FAIL: dist/ directory not found")
        return False

    # Look for actual build artifacts (.html, .js, .css)
    artifacts = []
    for ext in ["*.html", "*.js", "*.css"]:
        pattern = os.path.join(dist_path, f"**/{ext}")
        found = glob.glob(pattern, recursive=True)
        artifacts.extend(found)

    # Filter out sourcemaps
    artifacts = [a for a in artifacts if not a.endswith(".map")]

    if not artifacts:
        print("FAIL: No build artifacts found (.html, .js, .css files)")
        return False

    print(f"PASS: Found {len(artifacts)} build artifacts")
    for artifact in artifacts[:3]:
        print(f"  - {os.path.relpath(artifact, project_dir)}")
    if len(artifacts) > 3:
        print(f"  ... and {len(artifacts) - 3} more")

    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_build_artifact.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_build_artifact(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
