#!/bin/bash
# =============================================================================
# Production Readiness Verification
# =============================================================================
#
# Runs 13 structural/static checks before deployment.
# Does NOT run unit/integration/E2E test suites (those are slow).
# Use npx ts-node tests/*.test.ts for runtime checks.
#
# Usage: ./scripts/verify-production-readiness.sh
# Exit:  0 if all pass, 1 if any fail
# =============================================================================

set -uo pipefail

PASS=0
FAIL=0
TOTAL=13

check() {
  local name="$1"
  local result="$2"
  if [ "$result" -eq 0 ]; then
    printf "  [PASS] %s\n" "$name"
    PASS=$((PASS + 1))
  else
    printf "  [FAIL] %s\n" "$name"
    FAIL=$((FAIL + 1))
  fi
}

printf "=== Production Readiness Verification ===\n\n"

# ---------------------------------------------------------------------------
# Check 1: TypeScript compiles
# ---------------------------------------------------------------------------
npx tsc --noEmit > /dev/null 2>&1
check "TypeScript compiles (tsc --noEmit)" $?

# ---------------------------------------------------------------------------
# Check 2: Build succeeds
# ---------------------------------------------------------------------------
npm run build:main > /dev/null 2>&1
check "Build succeeds (npm run build:main)" $?

# ---------------------------------------------------------------------------
# Check 3: No hardcoded user paths in src/
# ---------------------------------------------------------------------------
HARDCODED_PATHS=$(grep -rn '/Users/' src/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$HARDCODED_PATHS" -eq 0 ]; then
  check "No hardcoded user paths in src/" 0
else
  check "No hardcoded user paths in src/ (found $HARDCODED_PATHS)" 1
fi

# ---------------------------------------------------------------------------
# Check 4: No hardcoded secrets in src/
# ---------------------------------------------------------------------------
SECRET_HITS=$(grep -rn 'API_KEY\|SECRET_KEY\|PASSWORD' src/ --include='*.ts' 2>/dev/null \
  | grep -v '^\s*//' \
  | grep -v 'process\.env' \
  | grep -v ':\s*string' \
  | grep -v 'type\s' \
  | grep -v 'interface\s' \
  | grep -v '@param' \
  | grep -v '\*' \
  | grep -v 'requiredEnv' \
  | grep -v "'\w*_KEY'" \
  | wc -l | tr -d ' ')
if [ "$SECRET_HITS" -eq 0 ]; then
  check "No hardcoded secrets in src/" 0
else
  check "No hardcoded secrets in src/ (found $SECRET_HITS)" 1
fi

# ---------------------------------------------------------------------------
# Check 5: CLI commands use safe process spawning
# ---------------------------------------------------------------------------
UNSAFE_COUNT=0
for f in $(grep -rl 'child_process' src/ --include='*.ts' 2>/dev/null); do
  BARE=$(grep -n '\bexec(' "$f" 2>/dev/null \
    | grep -v 'execFile' \
    | grep -v 'execSync' \
    | grep -v '//' \
    | grep -v '\*' \
    | wc -l | tr -d ' ')
  UNSAFE_COUNT=$((UNSAFE_COUNT + BARE))
done
if [ "$UNSAFE_COUNT" -eq 0 ]; then
  check "CLI commands use safe process spawning (no bare exec)" 0
else
  check "CLI commands use safe process spawning (found $UNSAFE_COUNT)" 1
fi

# ---------------------------------------------------------------------------
# Check 6: All adapter source files exist
# ---------------------------------------------------------------------------
ADAPTER_FILES=(
  "src/adapters/types.ts"
  "src/adapters/codex/adapter.ts"
  "src/adapters/claude/adapter.ts"
  "src/adapters/claude/frontmatter.ts"
  "src/adapters/permissions.ts"
  "src/adapters/factory.ts"
)
ADAPTER_MISSING=0
for f in "${ADAPTER_FILES[@]}"; do
  [ ! -f "$f" ] && ADAPTER_MISSING=$((ADAPTER_MISSING + 1))
done
if [ "$ADAPTER_MISSING" -eq 0 ]; then
  check "All adapter source files exist (6/6)" 0
else
  check "All adapter source files exist (missing $ADAPTER_MISSING)" 1
fi

# ---------------------------------------------------------------------------
# Check 7: All enforcement source files exist
# ---------------------------------------------------------------------------
ENFORCEMENT_FILES=(
  "src/enforcement/types.ts"
  "src/enforcement/constants.ts"
  "src/enforcement/enforcer.ts"
  "src/enforcement/bodyguard.ts"
  "src/enforcement/spine.ts"
  "src/enforcement/index.ts"
)
ENFORCEMENT_MISSING=0
for f in "${ENFORCEMENT_FILES[@]}"; do
  [ ! -f "$f" ] && ENFORCEMENT_MISSING=$((ENFORCEMENT_MISSING + 1))
done
if [ "$ENFORCEMENT_MISSING" -eq 0 ]; then
  check "All enforcement source files exist (6/6)" 0
else
  check "All enforcement source files exist (missing $ENFORCEMENT_MISSING)" 1
fi

# ---------------------------------------------------------------------------
# Check 8: All skills source files exist
# ---------------------------------------------------------------------------
SKILLS_FILES=(
  "src/skills/selector.ts"
  "src/skills/validator.ts"
  "src/skills/verify-parser.ts"
  "src/skills/critical-checks.ts"
  "src/skills/verify-sandbox.ts"
  "src/skills/index.ts"
)
SKILLS_MISSING=0
for f in "${SKILLS_FILES[@]}"; do
  [ ! -f "$f" ] && SKILLS_MISSING=$((SKILLS_MISSING + 1))
done
if [ "$SKILLS_MISSING" -eq 0 ]; then
  check "All skills source files exist (6/6)" 0
else
  check "All skills source files exist (missing $SKILLS_MISSING)" 1
fi

# ---------------------------------------------------------------------------
# Check 9: All glue source files exist
# ---------------------------------------------------------------------------
GLUE_FILES=(
  "src/glue/assemble-prompt.ts"
  "src/glue/normalizer.ts"
  "src/glue/index.ts"
)
GLUE_MISSING=0
for f in "${GLUE_FILES[@]}"; do
  [ ! -f "$f" ] && GLUE_MISSING=$((GLUE_MISSING + 1))
done
if [ "$GLUE_MISSING" -eq 0 ]; then
  check "All glue source files exist (3/3)" 0
else
  check "All glue source files exist (missing $GLUE_MISSING)" 1
fi

# ---------------------------------------------------------------------------
# Check 10: Documentation present
# ---------------------------------------------------------------------------
DOC_FILES=(
  "docs/ONGOING_WORK/ADAPTORS/LEVEL-3-E2E-TESTING.md"
  "docs/ONGOING_WORK/ADAPTORS/COMPATIBILITY.md"
  "docs/ONGOING_WORK/ADAPTORS/LEVEL-3-TASK-SUMMARY.md"
)
DOC_MISSING=0
for f in "${DOC_FILES[@]}"; do
  [ ! -f "$f" ] && DOC_MISSING=$((DOC_MISSING + 1))
done
if [ "$DOC_MISSING" -eq 0 ]; then
  check "Documentation present (3/3)" 0
else
  check "Documentation present (missing $DOC_MISSING)" 1
fi

# ---------------------------------------------------------------------------
# Check 11: E2E test file exists
# ---------------------------------------------------------------------------
if [ -f "tests/e2e/electron-dispatch.test.ts" ]; then
  check "E2E test file exists" 0
else
  check "E2E test file exists (tests/e2e/electron-dispatch.test.ts)" 1
fi

# ---------------------------------------------------------------------------
# Check 12: Compatibility validation file exists
# ---------------------------------------------------------------------------
if [ -f "tests/compatibility-matrix-validation.ts" ]; then
  check "Compatibility validation file exists" 0
else
  check "Compatibility validation file exists" 1
fi

# ---------------------------------------------------------------------------
# Check 13: TypeScript strict mode enabled
# ---------------------------------------------------------------------------
if grep -q '"strict": true' tsconfig.json 2>/dev/null; then
  check "TypeScript strict mode enabled in tsconfig.json" 0
else
  check "TypeScript strict mode enabled in tsconfig.json" 1
fi

# ---------------------------------------------------------------------------
# RESULTS
# ---------------------------------------------------------------------------
printf "\nResults: %d passed, %d failed (of %d)\n\n" "$PASS" "$FAIL" "$TOTAL"
if [ $FAIL -eq 0 ]; then
  printf "PRODUCTION READY\n"
  exit 0
else
  printf "NOT READY - fix %d failing check(s)\n" "$FAIL"
  exit 1
fi
