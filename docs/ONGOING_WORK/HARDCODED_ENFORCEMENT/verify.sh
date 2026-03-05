#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  VERIFICATION: HARDCODED ENFORCEMENT ENGINE"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

# Helper functions
pass_check() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  ((pass_count++))
}

fail_check() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  ((fail_count++))
}

warn_check() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "=== VERIFY: Constants Directory Exists ==="
if [ -d "constants" ]; then
  pass_check "constants/ directory exists"
else
  fail_check "constants/ directory missing"
  exit 1
fi

echo ""
echo "=== VERIFY: Constants File Count ==="
const_count=$(find constants -name "*.ts" | wc -l)
if [ "$const_count" -eq 33 ]; then
  pass_check "All 33 constants files created (22 sections + 10 gaps + 1 index)"
else
  fail_check "Expected 33 constant files, found $const_count"
fi

echo ""
echo "=== VERIFY: Constants Compile ==="
if npx tsc constants/*.ts --noEmit --skipLibCheck --target es2020 2>/dev/null; then
  pass_check "All constants files compile (TypeScript)"
else
  fail_check "Constants compilation failed"
fi

echo ""
echo "=== VERIFY: Check Scripts Directory ==="
if [ -d "checks" ]; then
  pass_check "checks/ directory exists"
else
  fail_check "checks/ directory missing"
  exit 1
fi

echo ""
echo "=== VERIFY: Check Scripts File Count ==="
check_count=$(find checks -maxdepth 1 -type f \( -name "*.py" -o -name "*.sh" \) | wc -l)
if [ "$check_count" -eq 12 ]; then
  pass_check "All 12 check scripts created"
else
  fail_check "Expected 12 check scripts, found $check_count"
fi

echo ""
echo "=== VERIFY: Check Scripts Executable ==="
not_exec=0
for script in checks/*.py checks/*.sh; do
  if [ -f "$script" ] && [ ! -x "$script" ]; then
    fail_check "$script not executable"
    ((not_exec++))
  fi
done
if [ "$not_exec" -eq 0 ]; then
  pass_check "All check scripts are executable"
fi

echo ""
echo "=== VERIFY: Engine Directory ==="
if [ -d "engine" ]; then
  pass_check "engine/ directory exists"
else
  fail_check "engine/ directory missing"
  exit 1
fi

echo ""
echo "=== VERIFY: Engine Files ==="
required_engine_files=(
  "engine/types.ts"
  "engine/enforcer.ts"
  "engine/bodyguard.ts"
  "engine/circuit-breaker.ts"
  "engine/spine.ts"
  "engine/spine-lock.ts"
  "engine/context-warden.ts"
  "engine/heartbeat.ts"
  "engine/project-state.ts"
  "engine/cron-manager.ts"
  "engine/step-scheduler.ts"
  "engine/agent-spawner.ts"
)

for file in "${required_engine_files[@]}"; do
  if [ -f "$file" ]; then
    pass_check "$file exists"
  else
    fail_check "$file missing"
  fi
done

echo ""
echo "=== VERIFY: Engine Types Compile ==="
if npx tsc engine/types.ts --noEmit --skipLibCheck --target es2020 2>/dev/null; then
  pass_check "engine/types.ts compiles"
else
  fail_check "engine/types.ts compilation failed"
fi

echo ""
echo "=== VERIFY: Engine Core Compiles ==="
if npx tsc engine/enforcer.ts engine/bodyguard.ts engine/circuit-breaker.ts --noEmit --skipLibCheck --target es2020 2>/dev/null; then
  pass_check "Engine core files compile (enforcer, bodyguard, circuit-breaker)"
else
  fail_check "Engine core compilation failed"
fi

echo ""
echo "=== VERIFY: Engine Infrastructure Compiles ==="
if npx tsc engine/spine.ts engine/spine-lock.ts engine/context-warden.ts engine/heartbeat.ts engine/project-state.ts engine/cron-manager.ts --noEmit --skipLibCheck --target es2020 2>/dev/null; then
  pass_check "Engine infrastructure files compile"
else
  fail_check "Engine infrastructure compilation failed"
fi

echo ""
echo "=== VERIFY: Engine Scheduler Compiles ==="
if npx tsc engine/step-scheduler.ts engine/agent-spawner.ts --noEmit --skipLibCheck --target es2020 2>/dev/null; then
  pass_check "Engine scheduler & spawner compile"
else
  fail_check "Engine scheduler compilation failed"
fi

echo ""
echo "=== VERIFY: No Magic Numbers in Engine ==="
magic_count=$(grep -r "= [0-9]" engine/ 2>/dev/null | grep -v "constants/" | grep -v "//" | wc -l)
if [ "$magic_count" -eq 0 ]; then
  pass_check "No hardcoded numbers in engine/ (all from constants)"
else
  fail_check "Found $magic_count lines with hardcoded numbers in engine/"
fi

echo ""
echo "=== VERIFY: Bodyguard Uses Parallel Execution ==="
if grep -q "Promise.allSettled" engine/bodyguard.ts; then
  pass_check "bodyguard.ts uses Promise.allSettled (parallel checks)"
else
  fail_check "bodyguard.ts missing Promise.allSettled (must be parallel)"
fi

echo ""
echo "=== VERIFY: Bodyguard Not Sequential ==="
seq_count=$(grep -E "for.*of.*checks|await.*runCheck.*\n.*await.*runCheck" engine/bodyguard.ts | wc -l)
if [ "$seq_count" -eq 0 ]; then
  pass_check "bodyguard.ts has no sequential check execution"
else
  warn_check "bodyguard.ts may have sequential patterns (found $seq_count matches)"
fi

echo ""
echo "=== VERIFY: Spine Has One LLM Call ==="
llm_count=$(grep -c "// LLM CALL:" engine/spine.ts)
if [ "$llm_count" -eq 1 ]; then
  pass_check "spine.ts has exactly 1 LLM call marker"
elif [ "$llm_count" -eq 0 ]; then
  fail_check "spine.ts missing LLM call marker (should have 1)"
else
  fail_check "spine.ts has $llm_count LLM call markers (should be 1)"
fi

echo ""
echo "=== VERIFY: Templates Directory ==="
if [ -d "templates" ]; then
  pass_check "templates/ directory exists"
else
  fail_check "templates/ directory missing"
fi

echo ""
echo "=== VERIFY: Enforcer JSON Templates ==="
required_templates=(
  "templates/enforcer-test-before-commit.json"
  "templates/enforcer-docker-local-first.json"
  "templates/enforcer-scope-boundary.json"
  "templates/enforcer-deploy.json"
  "templates/enforcer-lesson.json"
  "templates/enforcer-scaffold.json"
  "templates/enforcer-build-artifact.json"
  "templates/enforcer-secret-detection.json"
  "templates/enforcer-token-threshold.json"
  "templates/enforcer-responsive.json"
  "templates/enforcer-uninstall-verify.json"
)

for template in "${required_templates[@]}"; do
  if [ -f "$template" ]; then
    if jq . "$template" > /dev/null 2>&1; then
      pass_check "$template is valid JSON"
    else
      fail_check "$template has invalid JSON syntax"
    fi
  else
    fail_check "$template missing"
  fi
done

echo ""
echo "=== VERIFY: Constants Index Re-exports ==="
if grep -q "export.*TOKEN_THRESHOLDS\|export.*from.*01-context-warden" constants/index.ts; then
  pass_check "constants/index.ts re-exports constants"
else
  fail_check "constants/index.ts missing re-exports"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "SUMMARY:"
echo "--------"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"
echo ""

if [ "$fail_count" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL VERIFICATIONS PASSED${NC}"
  echo ""
  echo "ENGINE READY FOR DEPLOYMENT"
  echo ""
  echo "Next steps:"
  echo "  1. Commit to git"
  echo "  2. Instance 4 can begin implementation"
  echo "  3. Start with spine.ts integration tests"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SOME VERIFICATIONS FAILED${NC}"
  echo ""
  echo "Fix the failures above and re-run verify.sh"
  echo ""
  exit 1
fi
