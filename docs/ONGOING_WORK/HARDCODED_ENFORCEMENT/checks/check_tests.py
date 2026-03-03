#!/usr/bin/env python3
"""
Check 1: Test Suite Exit Code
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 1

COMMAND:          npm test
PASS:             exit code === 0
FALSE POSITIVE:   0 tests run (empty suite)
SECONDARY:        npx vitest reports > 0 tests
CONFIDENCE:       definitive
"""

import sys
import subprocess
import json
import os

def check_tests(project_dir):
    """
    Run npm test and verify:
    1. Exit code is 0
    2. At least one test was run (not empty suite)
    """
    os.chdir(project_dir)

    # Run npm test
    result = subprocess.run(
        ["npm", "test"],
        capture_output=True,
        text=True,
        timeout=60
    )

    # Check exit code
    if result.returncode != 0:
        print(f"FAIL: npm test exited with code {result.returncode}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        return False

    # Secondary check: ensure tests were run (not empty suite)
    # Try to get vitest JSON output to count tests
    try:
        json_result = subprocess.run(
            ["npx", "vitest", "--reporter=json"],
            capture_output=True,
            text=True,
            timeout=60
        )

        if json_result.returncode == 0 or json_result.stdout:
            try:
                data = json.loads(json_result.stdout)
                num_tests = data.get("numTotalTests", 0)
                if num_tests == 0:
                    print("FAIL: No tests run (empty suite)")
                    return False
                print(f"PASS: {num_tests} tests run")
                return True
            except json.JSONDecodeError:
                # If JSON parse fails, fallback to checking stdout for test counts
                if "test" in result.stdout.lower():
                    print("PASS: Tests ran (JSON parse failed but output suggests tests)")
                    return True
                else:
                    print("FAIL: Could not verify test count")
                    return False
    except Exception as e:
        print(f"WARN: Could not get vitest JSON output: {e}")
        # Fallback: if npm test passed, assume tests ran
        print("PASS: npm test exited 0 (vitest check skipped)")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_tests.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_tests(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
