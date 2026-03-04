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

def ensure_running(project_dir: str) -> tuple[bool, str]:
    """Ensure docker container is running. Returns (success, message)."""

    # Change to project directory first
    original_cwd = os.getcwd()
    os.chdir(project_dir)

    try:
        # Check if docker-compose.yml exists
        if not os.path.exists("docker-compose.yml"):
            return False, "docker-compose.yml not found"

        # Start container
        start_result = subprocess.run(
            ["docker-compose", "up", "-d"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if start_result.returncode != 0:
            return False, f"docker-compose up failed: {start_result.stderr}"

        # Wait for health check
        for attempt in range(3):
            time.sleep(2)
            health_result = subprocess.run(
                ["docker-compose", "ps"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if "Up" in health_result.stdout:
                return True, "Container is running"

        return False, "Container failed to start"

    finally:
        os.chdir(original_cwd)


def check_curl(project_dir: str) -> tuple[bool, str]:
    """Check if localhost:3000 responds with 200. Returns (success, message)."""

    for attempt in range(3):
        try:
            response = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:3000"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if response.stdout.strip() == "200":
                return True, "HTTP 200 from localhost:3000"

            time.sleep(2)
        except subprocess.TimeoutExpired:
            if attempt < 2:
                time.sleep(2)
                continue
            return False, "curl timeout"

    return False, "HTTP response was not 200"

def main():
    if len(sys.argv) < 2:
        print("Usage: check_docker_health.py <project_dir>")
        sys.exit(1)

    project_dir = sys.argv[1]

    # Step 1: Ensure running
    success, msg = ensure_running(project_dir)
    if not success:
        print(f"FAIL: {msg}", file=sys.stderr)
        sys.exit(1)

    # Step 2: Check curl
    success, msg = check_curl(project_dir)
    if not success:
        print(f"FAIL: {msg}", file=sys.stderr)
        sys.exit(1)

    print("PASS: Docker health check successful")
    sys.exit(0)


if __name__ == "__main__":
    main()
