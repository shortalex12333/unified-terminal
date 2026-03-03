# Hardcoded Enforcement Check Scripts

This directory contains 12 executable check scripts that validate project health and compliance with hardcoded enforcement rules.

## Scripts Created

All scripts follow this pattern:
- **Shebang:** `#!/usr/bin/env python3` or `#!/bin/bash`
- **Argument:** Takes `<project_dir>` as first argument
- **Exit Code:** 0 on PASS, 1 on FAIL
- **Source:** Copied verbatim from HARDCODED-ENFORCEMENT-VALUES.md section 10

### Checks 1-11 (From Hard Rails)

| # | Script | Type | Command | Confidence |
|---|--------|------|---------|-----------|
| 1 | `check_tests.py` | Python | `npm test` + vitest count | definitive |
| 2 | `check_files_exist.py` | Python | `fs.existsSync()` for declared files | definitive |
| 3 | `check_files_nonempty.py` | Python | File size > 50 bytes (with whitelist) | heuristic |
| 4 | `check_build_artifact.py` | Python | `dist/` has .html/.js/.css | definitive |
| 5 | `check_scope.py` | Python | `git diff --name-only` vs declared | definitive |
| 6 | `check_tokens.py` | Python | Token utilization vs per-model threshold | definitive |
| 7 | `check_secrets.sh` | Bash | `gitleaks detect` exit code | definitive |
| 8 | `check_uninstall.py` | Python | `node_modules/{pkg}` verification | definitive |
| 9 | `check_docker_health.py` | Python | `docker build && docker run && curl` | heuristic |
| 10 | `check_lesson.py` | Python | Lesson template regex validation | definitive |
| 11 | `check_responsive.py` | Python | Playwright 3 viewports > 1KB each | definitive |

### Check 12 (Custom)

| # | Script | Type | Command | Confidence |
|---|--------|------|---------|-----------|
| 12 | `check_deploy_health.py` | Python | `curl deployed-url` + retry logic | heuristic |

## Usage

Run any script with a project directory:

```bash
python3 checks/check_tests.py /path/to/project
bash checks/check_secrets.sh /path/to/project
python3 checks/check_deploy_health.py /path/to/project
```

## Pass/Fail Behavior

### Exit 0 (PASS)
- Script successfully validated the condition
- Project is healthy for this check
- No action needed

### Exit 1 (FAIL)
- Script detected a problem
- Output explains the issue
- Action required to fix

## Special Cases

### check_docker_health.py
- Builds Docker image
- Runs container in background
- Performs 3 retry attempts (5s delay)
- Cleans up container after check
- Returns 1 on build/run/health failure

### check_deploy_health.py
- Requires `DEPLOY_URL` environment variable OR `deployUrl` in `.enforcer-manifest.json`
- Performs 3 retry attempts (10s delay for DNS propagation)
- Validates HTTP 200 status and body size (> 500 bytes)
- Checks for error strings: "Cannot GET", "Error", "Internal Server Error", "404", "not found"

### check_responsive.py
- Requires Playwright installed
- Creates temporary test file
- Takes screenshots at 3 viewports:
  - 375×812 (mobile)
  - 768×1024 (tablet)
  - 1440×900 (desktop)
- Each screenshot must be > 1000 bytes
- Timeout: 30 seconds per viewport

### check_lesson.py
- Looks for `tasks/lessons.md`
- Requires all 4 fields: "what broke", "root cause", "fix applied", "prevention rule"
- Forbids: "one sentence", "TODO", "TBD", "fill in", "[placeholder]", "[...]"
- Case-insensitive matching

## Constants

All hardcoded values come from HARDCODED-ENFORCEMENT-VALUES.md:

- **File thresholds:** MIN_MEANINGFUL_BYTES = 50 (section 5)
- **Min screenshot:** MIN_SCREENSHOT_BYTES = 1000 (section 5)
- **Docker health retries:** 3 attempts, 5s delay (section 9)
- **Deploy health retries:** 3 attempts, 10s delay (section 15)
- **Error strings:** "Cannot GET", "Error", "Internal Server Error", "404", "not found" (section 15)
- **Viewports:** 375×812, 768×1024, 1440×900 (section 22)
- **Token thresholds:** Per-model from section 1
- **Grace threshold:** 0.85 task progress (section 1)
- **Scope whitelist:** package-lock.json, yarn.lock, .next/, node_modules/, __pycache__/, dist/, .git/ (section 21)
- **Config whitelist:** .env, .eslintrc, .prettierrc, .editorconfig, tsconfig.json (section 3 logic)

## All Scripts Executable

```bash
chmod +x checks/*.py checks/*.sh
```

All scripts are made executable at creation time.
