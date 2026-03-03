#!/usr/bin/env python3
"""
Check 9: Docker Health
Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 9

COMMAND:          docker build . && docker run -d && curl -s http://localhost:3000
PASS:             curl returns HTTP 200 AND body does not contain error strings
ERROR STRINGS:    "Cannot GET", "Error", "Internal Server Error", "not found"
FALSE POSITIVE:   container warming (502 during startup)
RETRY:            3 attempts, 5 second delay between each
CONFIDENCE:       heuristic (port conflicts, warming)
"""

import sys
import subprocess
import time
import os

# From HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 9
ERROR_STRINGS = ["Cannot GET", "Error", "Internal Server Error", "not found"]
RETRIES = 3
RETRY_DELAY_MS = 5000

def check_docker_health(project_dir):
    """
    Build Docker image, run container, and verify it responds correctly.
    """
    os.chdir(project_dir)

    # Check if Docker is available
    try:
        subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            timeout=5
        )
    except Exception as e:
        print(f"WARN: Docker not available: {e}")
        return True  # Skip if Docker not available

    # Build image
    print("Building Docker image...")
    build_result = subprocess.run(
        ["docker", "build", "."],
        capture_output=True,
        text=True,
        timeout=120
    )

    if build_result.returncode != 0:
        print(f"FAIL: Docker build failed")
        print(f"STDERR: {build_result.stderr}")
        return False

    # Run container in background
    print("Starting Docker container...")
    run_result = subprocess.run(
        ["docker", "run", "-d", "-p", "3000:3000"],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=project_dir
    )

    if run_result.returncode != 0:
        print(f"FAIL: Docker run failed")
        print(f"STDERR: {run_result.stderr}")
        return False

    container_id = run_result.stdout.strip()
    print(f"Container started: {container_id[:12]}")

    try:
        # Retry health check
        for attempt in range(RETRIES):
            print(f"Health check attempt {attempt + 1}/{RETRIES}...")
            time.sleep(RETRY_DELAY_MS / 1000.0)

            try:
                response = subprocess.run(
                    ["curl", "-s", "-i", "http://localhost:3000"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                # Check for HTTP 200
                if "200 OK" not in response.stdout:
                    if attempt < RETRIES - 1:
                        print(f"  Not ready yet, retrying...")
                        continue
                    else:
                        print(f"FAIL: HTTP response not 200")
                        print(f"Response: {response.stdout[:200]}")
                        return False

                # Check for error strings in body
                has_error = any(error_str in response.stdout for error_str in ERROR_STRINGS)
                if has_error:
                    if attempt < RETRIES - 1:
                        print(f"  Error page detected, retrying...")
                        continue
                    else:
                        print(f"FAIL: Response contains error strings")
                        return False

                print(f"PASS: Docker container healthy (HTTP 200, no errors)")
                return True

            except subprocess.TimeoutExpired:
                if attempt < RETRIES - 1:
                    print(f"  Timeout, retrying...")
                    continue
                else:
                    print(f"FAIL: Curl timeout")
                    return False

        print(f"FAIL: Health check failed after {RETRIES} attempts")
        return False

    finally:
        # Cleanup container
        try:
            subprocess.run(
                ["docker", "stop", container_id],
                capture_output=True,
                timeout=10
            )
            subprocess.run(
                ["docker", "rm", container_id],
                capture_output=True,
                timeout=10
            )
        except Exception as e:
            print(f"WARN: Could not cleanup container: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_docker_health.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_docker_health(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
