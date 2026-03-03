# Check Scripts Directory Index

**Created:** 2026-03-03 (Sub-agent B: Check Scripts Generator)
**Status:** COMPLETE
**Total Scripts:** 12 (11 Python + 1 Bash)

## Quick Reference

| Check # | Script | Type | Purpose |
|---------|--------|------|---------|
| 1 | `check_tests.py` | Python | Verify npm test passes with tests run |
| 2 | `check_files_exist.py` | Python | Verify declared files exist |
| 3 | `check_files_nonempty.py` | Python | Verify files > 50 bytes (with whitelist) |
| 4 | `check_build_artifact.py` | Python | Verify dist/ has .html/.js/.css artifacts |
| 5 | `check_scope.py` | Python | Verify git modifications in declared scope |
| 6 | `check_tokens.py` | Python | Verify token utilization within thresholds |
| 7 | `check_secrets.sh` | Bash | Verify no secrets in code (gitleaks) |
| 8 | `check_uninstall.py` | Python | Verify removed packages gone from node_modules |
| 9 | `check_docker_health.py` | Python | Verify Docker container health (3 retries) |
| 10 | `check_lesson.py` | Python | Verify lesson file has required fields |
| 11 | `check_responsive.py` | Python | Verify screenshots at 3 viewports |
| 12 | `check_deploy_health.py` | Python | Verify deployed URL health (3 retries) |

## Documentation

- **README.md** — Usage guide, script details, and argument handling
- **VERIFICATION.md** — Acceptance criteria checklist and verification report
- **INDEX.md** — This file

## Usage Pattern

All scripts follow the same pattern:

```bash
# Run check
python3 check_tests.py /path/to/project
bash check_secrets.sh /path/to/project

# Check result
echo $?  # 0 = PASS, 1 = FAIL
```

## Integration Points

These scripts are called by:

1. **enforcer.ts** (Sub-agent C)
   - Spawns as subprocess
   - Captures exit code + stdout
   - Returns EnforcerResult

2. **bodyguard.ts** (Sub-agent C)
   - Filters based on CHECK_ACTIVATION
   - Runs in parallel with Promise.allSettled()
   - Aggregates results

3. **step-scheduler.ts** (Sub-agent E)
   - Called after each step
   - Gates deployments
   - Triggers circuit-breaker on failure

## Source of Truth

All scripts implement logic from:
- **HARDCODED-ENFORCEMENT-VALUES.md** section 10 (The 11 Hard Rail Checks)
- **HARDCODED-ENFORCEMENT-VALUES.md** section 15 (Deploy Health Check)

Every value, condition, and error string is copied verbatim from these sections.

## Verification

Run all checks on a project:

```bash
cd /path/to/project
for script in checks/*.py checks/*.sh; do
  echo "Running $script..."
  python3 "$script" . && echo "PASS" || echo "FAIL"
done
```

## Troubleshooting

**Script not executable:**
```bash
chmod +x checks/*.py checks/*.sh
```

**Python not found:**
```bash
# Ensure Python 3.8+ installed
python3 --version
```

**Bash script permissions:**
```bash
# Verify bash is available
which bash
```

**Missing dependencies:**
- `check_tests.py`: Requires npm, vitest
- `check_secrets.sh`: Requires gitleaks
- `check_docker_health.py`: Requires Docker
- `check_responsive.py`: Requires Playwright
- `check_deploy_health.py`: Requires curl

Most scripts gracefully degrade if tools not available.

## File List

```
checks/
├── check_tests.py              (50 lines)
├── check_files_exist.py        (40 lines)
├── check_files_nonempty.py     (50 lines)
├── check_build_artifact.py     (45 lines)
├── check_scope.py              (60 lines)
├── check_tokens.py             (55 lines)
├── check_secrets.sh            (25 lines)
├── check_uninstall.py          (40 lines)
├── check_docker_health.py      (110 lines)
├── check_lesson.py             (65 lines)
├── check_responsive.py         (95 lines)
├── check_deploy_health.py      (110 lines)
├── README.md                   (Reference guide)
├── VERIFICATION.md             (Acceptance report)
├── INDEX.md                    (This file)
└── (Total: ~725 lines of code)
```

## Next Steps

Sub-agent C will:
1. Read these scripts
2. Write enforcer.ts to spawn them
3. Write bodyguard.ts to dispatch them in parallel
4. Write circuit-breaker.ts to handle failures

Sub-agent E will:
1. Integrate checks into step-scheduler.ts
2. Gate deployments on check failures
3. Trigger user escape hatch on definitive failures
