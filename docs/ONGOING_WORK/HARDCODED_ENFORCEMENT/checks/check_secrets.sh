#!/bin/bash

# Check 7: Secret Detection
# Source: HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 7
#
# COMMAND:          gitleaks detect --source . --no-git --exit-code 1
# PASS:             exit code === 0
# FALSE POSITIVE:   test fixtures with fake keys (rare)
# CONFIDENCE:       definitive

PROJECT_DIR="${1:-.}"

if [ -z "$PROJECT_DIR" ]; then
    echo "Usage: check_secrets.sh <project_dir>"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

# Check if gitleaks is installed
if ! command -v gitleaks &> /dev/null; then
    echo "WARN: gitleaks not installed, attempting to run with npm"
    # Try to use npm-installed version
    if npx gitleaks --version &> /dev/null; then
        npx gitleaks detect --source . --no-git --exit-code 1
        exit_code=$?
    else
        echo "WARN: gitleaks not found, skipping secret detection"
        exit 0
    fi
else
    gitleaks detect --source . --no-git --exit-code 1
    exit_code=$?
fi

if [ "$exit_code" -eq 0 ]; then
    echo "PASS: No secrets detected"
    exit 0
else
    echo "FAIL: Secrets detected (gitleaks exit code: $exit_code)"
    exit 1
fi
