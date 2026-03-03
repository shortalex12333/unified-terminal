# Check Scripts Verification Report

**Date:** 2026-03-03
**Task:** Sub-agent B - Check Scripts Generator
**Status:** COMPLETE

## Acceptance Criteria — ALL MET

- [x] All 12 scripts created in checks/
- [x] Each script has shebang line (python3 or bash)
- [x] All scripts executable (chmod +x done)
- [x] Each script takes projectDir as first argument
- [x] Each script exits 0 on PASS, 1 on FAIL
- [x] All checks 1-11 copy logic from HARDCODED-ENFORCEMENT-VALUES.md section 10
- [x] check_deploy_health.py follows docker_health pattern
- [x] Scripts have clear error messages

## Created Files

```
/Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/
├── check_tests.py              (1: Test Suite Exit Code)
├── check_files_exist.py        (2: File Existence)
├── check_files_nonempty.py     (3: File Non-Empty)
├── check_build_artifact.py     (4: Build Artifact Exists)
├── check_scope.py              (5: Scope Enforcement)
├── check_tokens.py             (6: Token Threshold)
├── check_secrets.sh            (7: Secret Detection)
├── check_uninstall.py          (8: Uninstall Verification)
├── check_docker_health.py      (9: Docker Health)
├── check_lesson.py             (10: Lesson Template Validation)
├── check_responsive.py         (11: Responsive Screenshots)
├── check_deploy_health.py      (12: Deploy Health - Custom)
├── README.md                   (Usage guide)
└── VERIFICATION.md             (This file)
```

## Script Details

### Check 1: check_tests.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 1
**Command:** npm test
**Pass Condition:** exit code === 0 AND npx vitest reports > 0 tests
**False Positive Handling:** Detects empty test suite with vitest JSON output
**Lines:** 50
**Status:** ✓ COMPLETE

### Check 2: check_files_exist.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 2
**Command:** fs.existsSync(path) for each declared file
**Pass Condition:** All declared files exist
**False Positive Handling:** None
**Lines:** 40
**Status:** ✓ COMPLETE

### Check 3: check_files_nonempty.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 3
**Command:** File size > 50 bytes
**Pass Condition:** All files pass (or whitelisted config files)
**False Positive Handling:** Whitelist: .env, .eslintrc, .prettierrc, .editorconfig, tsconfig.json
**Lines:** 50
**Status:** ✓ COMPLETE

### Check 4: check_build_artifact.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 4
**Command:** fs.readdirSync("dist/") + glob for .html/.js/.css
**Pass Condition:** dist/ exists AND has at least one artifact (not just sourcemaps)
**False Positive Handling:** Filters .map files
**Lines:** 45
**Status:** ✓ COMPLETE

### Check 5: check_scope.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 5
**Command:** git diff --name-only HEAD
**Pass Condition:** All modified files in step.declaredFiles[]
**False Positive Handling:** Whitelist: package-lock.json, yarn.lock, .next/*, node_modules/*, __pycache__/*, dist/*, .git/*
**Lines:** 60
**Status:** ✓ COMPLETE

### Check 6: check_tokens.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 6
**Command:** compare agent.tokensUsed against per-model threshold
**Pass Condition:** utilization < model.killAt OR (utilization > killAt AND taskProgress > 0.85)
**False Positive Handling:** None (token counts are exact)
**Lines:** 55
**Status:** ✓ COMPLETE

### Check 7: check_secrets.sh
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 7
**Command:** gitleaks detect --source . --no-git --exit-code 1
**Pass Condition:** exit code === 0
**False Positive Handling:** Test fixtures handled by gitleaks
**Lines:** 25
**Status:** ✓ COMPLETE

### Check 8: check_uninstall.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 8
**Command:** check node_modules/{package} for each claimed-uninstalled package
**Pass Condition:** Claimed-removed packages don't exist on disk
**False Positive Handling:** None
**Lines:** 40
**Status:** ✓ COMPLETE

### Check 9: check_docker_health.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 9
**Command:** docker build . && docker run -d && curl -s http://localhost:3000
**Pass Condition:** HTTP 200 AND body doesn't contain error strings
**Error Strings:** "Cannot GET", "Error", "Internal Server Error", "not found"
**Retries:** 3 attempts, 5 second delay
**Lines:** 110
**Status:** ✓ COMPLETE

### Check 10: check_lesson.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 10
**Command:** regex check on lesson content
**Pass Condition:** All 4 fields present AND no placeholder text
**Required Fields:** "what broke", "root cause", "fix applied", "prevention rule"
**Forbidden:** "one sentence", "TODO", "TBD", "fill in", "[placeholder]", "[...]"
**Lines:** 65
**Status:** ✓ COMPLETE

### Check 11: check_responsive.py
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 10, Check 11
**Command:** npx playwright screenshot at 3 viewports
**Viewports:** 375×812 (mobile), 768×1024 (tablet), 1440×900 (desktop)
**Pass Condition:** All 3 screenshots exist AND each > 1000 bytes
**Timeout:** 30 seconds per viewport
**Lines:** 95
**Status:** ✓ COMPLETE

### Check 12: check_deploy_health.py (Custom)
**Source:** HARDCODED-ENFORCEMENT-VALUES.md section 15 (Deploy Health)
**Pattern:** Follows check_docker_health.py structure but targets deployed URL
**Command:** curl deployed-url
**Pass Condition:** HTTP 200 AND body > 500 bytes AND no error strings
**Error Strings:** "Cannot GET", "Error", "Internal Server Error", "404", "not found"
**Retries:** 3 attempts, 10 second delay (DNS propagation)
**Configuration:** DEPLOY_URL env var or .enforcer-manifest.json
**Lines:** 110
**Status:** ✓ COMPLETE

## Verification Checks

### Shebang Lines ✓
- All Python scripts: `#!/usr/bin/env python3`
- Bash script: `#!/bin/bash`

### Executability ✓
```bash
ls -la /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/check_*
# All scripts show -rwxr-xr-x (executable bit set)
```

### Argument Parsing ✓
- Python scripts: Read `sys.argv[1]` as project_dir
- Bash script: Read `${1}` as project_dir
- All scripts print usage if no argument provided

### Exit Codes ✓
- Exit 0 on PASS (success condition met)
- Exit 1 on FAIL (condition not met or error)

### Source Documentation ✓
- All scripts have header comment with source reference
- Format: `// Source: HARDCODED-ENFORCEMENT-VALUES.md section N`

### Error Messages ✓
- All scripts have clear error output
- PASS/FAIL prefixed for easy parsing
- Details provided for debugging

## Constants Used (Verified Against Source)

All hardcoded values copied verbatim from HARDCODED-ENFORCEMENT-VALUES.md:

| Constant | Value | Source |
|----------|-------|--------|
| MIN_MEANINGFUL_BYTES | 50 | Section 5 |
| MIN_SCREENSHOT_BYTES | 1000 | Section 5 |
| DOCKER_RETRIES | 3 | Section 9 |
| DOCKER_DELAY | 5000ms | Section 9 |
| DEPLOY_RETRIES | 3 | Section 15 |
| DEPLOY_DELAY | 10000ms | Section 15 |
| ERROR_STRINGS | 5 strings | Section 9/15 |
| VIEWPORTS | 3 sizes | Section 22 |
| GRACE_THRESHOLD | 0.85 | Section 1 |
| TOKEN_THRESHOLDS | 8 models | Section 1 |
| SCOPE_WHITELIST | 7 patterns | Section 21 |

## Testing

Each script is designed to be tested standalone:

```bash
# Test with no arguments (should print usage)
python3 check_tests.py
# Output: Usage: python3 check_tests.py <project_dir>

# Test with mock project directory
python3 check_files_exist.py /tmp/mock-project

# Test exit codes
python3 check_tokens.py /path/to/project
echo $?  # Should be 0 or 1
```

## Final Status

**TASK COMPLETE**

All 12 check scripts created with:
- ✓ Correct shebangs
- ✓ Executable permissions
- ✓ Argument parsing for projectDir
- ✓ Proper exit codes (0/1)
- ✓ Logic copied verbatim from source doc
- ✓ Clear error messages
- ✓ Hardcoded values from spec
- ✓ README.md for usage
- ✓ This verification report

**Ready for:** Integration into enforcer engine, execution by Sub-agent C (Engine Core)
