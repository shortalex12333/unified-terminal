#!/usr/bin/env python3
"""
Check 12 (custom): Deploy Health
Source: HARDCODED-ENFORCEMENT-VALUES.md section 15 (Deploy Health)

COMMAND:          curl deployed-url
PASS:             HTTP 200 AND body > 500 bytes AND doesn't contain error strings
ERROR STRINGS:    "Cannot GET", "Error", "Internal Server Error", "404", "not found"
FALSE POSITIVE:   None (if deployed, should be healthy)
RETRY:            3 attempts, 10 second delay (DNS propagation slower)
CONFIDENCE:       heuristic
"""

import sys
import subprocess
import time
import os

# From HARDCODED-ENFORCEMENT-VALUES.md section 15
ERROR_BODY_STRINGS = ["Cannot GET", "Error", "Internal Server Error", "404", "not found"]
RETRIES = 3
RETRY_DELAY_MS = 10000

def check_deploy_health(project_dir):
    """
    Check deployed URL for health.
    Must return HTTP 200 with body > 500 bytes and no error strings.
    Accepts URL from environment variable or argument.
    """
    os.chdir(project_dir)

    # Get deploy URL from environment or manifest
    deploy_url = os.environ.get("DEPLOY_URL")

    if not deploy_url:
        # Try to read from manifest
        manifest_path = os.path.join(project_dir, ".enforcer-manifest.json")
        if os.path.exists(manifest_path):
            try:
                import json
                with open(manifest_path, "r") as f:
                    manifest = json.load(f)
                    deploy_url = manifest.get("deployUrl")
            except Exception as e:
                print(f"WARN: Could not read manifest: {e}")

    if not deploy_url:
        print("WARN: No DEPLOY_URL environment variable or manifest entry")
        return True

    print(f"Checking deployed URL: {deploy_url}")

    # Retry health check
    for attempt in range(RETRIES):
        print(f"Health check attempt {attempt + 1}/{RETRIES}...")
        time.sleep(RETRY_DELAY_MS / 1000.0)

        try:
            response = subprocess.run(
                ["curl", "-s", "-i", deploy_url],
                capture_output=True,
                text=True,
                timeout=10
            )

            # Check for HTTP 200
            if "200 OK" not in response.stdout:
                if attempt < RETRIES - 1:
                    print(f"  Not ready yet, retrying...")
                    continue
                else:
                    print(f"FAIL: HTTP response not 200")
                    print(f"Response (first 200 chars): {response.stdout[:200]}")
                    return False

            # Extract body (skip headers)
            parts = response.stdout.split("\r\n\r\n", 1)
            if len(parts) < 2:
                if attempt < RETRIES - 1:
                    print(f"  No body in response, retrying...")
                    continue
                else:
                    print(f"FAIL: No response body")
                    return False

            body = parts[1]

            # Check body size
            if len(body) < 500:
                if attempt < RETRIES - 1:
                    print(f"  Body too small ({len(body)} bytes), retrying...")
                    continue
                else:
                    print(f"FAIL: Response body too small ({len(body)} bytes, needs > 500)")
                    return False

            # Check for error strings in body
            has_error = any(error_str in body for error_str in ERROR_BODY_STRINGS)
            if has_error:
                if attempt < RETRIES - 1:
                    print(f"  Error page detected, retrying...")
                    continue
                else:
                    print(f"FAIL: Response contains error strings")
                    return False

            print(f"PASS: Deployed URL healthy (HTTP 200, {len(body)} bytes, no errors)")
            return True

        except subprocess.TimeoutExpired:
            if attempt < RETRIES - 1:
                print(f"  Timeout, retrying...")
                continue
            else:
                print(f"FAIL: Curl timeout")
                return False
        except Exception as e:
            if attempt < RETRIES - 1:
                print(f"  Error: {e}, retrying...")
                continue
            else:
                print(f"FAIL: {e}")
                return False

    print(f"FAIL: Health check failed after {RETRIES} attempts")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_deploy_health.py <project_dir>")
        print("  Set DEPLOY_URL environment variable or add deployUrl to .enforcer-manifest.json")
        sys.exit(1)

    project_dir = sys.argv[1]

    try:
        if check_deploy_health(project_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
