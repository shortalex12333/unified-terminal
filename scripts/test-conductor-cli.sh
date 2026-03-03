#!/bin/bash

# Test CLI availability and installation for Conductor system
# The conductor REQUIRES these CLIs to route tasks:
# - codex (tier 1 router + executor)
# - claude-code (executor, optional but recommended)
# - gemini (executor, optional)

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "CONDUCTOR CLI AVAILABILITY TEST"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_cli() {
  local cli=$1
  local package=$2

  echo -n "Checking $cli... "

  if command -v "$cli" &> /dev/null; then
    local version=$("$cli" --version 2>/dev/null || echo "version unknown")
    echo -e "${GREEN}✓ INSTALLED${NC} ($version)"
    return 0
  else
    echo -e "${RED}✗ NOT FOUND${NC}"
    return 1
  fi
}

install_cli() {
  local package=$1
  local cli_name=$2

  echo ""
  echo -e "${YELLOW}Installing $package...${NC}"

  if npm install -g "$package" 2>&1 | tail -5; then
    echo -e "${GREEN}✓ Installation complete${NC}"
    sleep 2
    return 0
  else
    echo -e "${RED}✗ Installation failed${NC}"
    return 1
  fi
}

test_cli() {
  local cli=$1

  echo -n "Testing $cli spawn... "

  if command -v "$cli" &> /dev/null; then
    # Simple test: get version
    if $cli --version &> /dev/null; then
      echo -e "${GREEN}✓ WORKS${NC}"
      return 0
    else
      echo -e "${YELLOW}⚠ INSTALLED BUT MIGHT NEED AUTH${NC}"
      return 0
    fi
  else
    echo -e "${RED}✗ NOT AVAILABLE${NC}"
    return 1
  fi
}

# =============================================================================
# TEST 1: CODEX (CRITICAL FOR CONDUCTOR TIER 1 ROUTER)
# =============================================================================
echo "TEST 1: CODEX (TIER 1 ROUTER - REQUIRED)"
echo "─────────────────────────────────────────"

if ! check_cli "codex" "@anthropic-ai/codex"; then
  read -p "Install codex? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    install_cli "@anthropic-ai/codex" "codex"
  else
    echo -e "${RED}ERROR: Codex is REQUIRED for conductor to work!${NC}"
    exit 1
  fi
fi

test_cli "codex"
echo ""

# =============================================================================
# TEST 2: CLAUDE CODE (EXECUTOR - HIGHLY RECOMMENDED)
# =============================================================================
echo "TEST 2: CLAUDE CODE (EXECUTOR - RECOMMENDED)"
echo "────────────────────────────────────────────"

if ! check_cli "claude" "@anthropic-ai/claude-code"; then
  read -p "Install claude-code? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    install_cli "@anthropic-ai/claude-code" "claude"
  else
    echo -e "${YELLOW}⚠ Claude Code optional (executor only)${NC}"
  fi
fi

if command -v "claude" &> /dev/null; then
  test_cli "claude"
fi
echo ""

# =============================================================================
# TEST 3: GEMINI (EXECUTOR - OPTIONAL)
# =============================================================================
echo "TEST 3: GEMINI (EXECUTOR - OPTIONAL)"
echo "─────────────────────────────────────"

if ! check_cli "gemini" "@anthropic-ai/gemini-cli"; then
  read -p "Install gemini? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    install_cli "@anthropic-ai/gemini-cli" "gemini"
  else
    echo -e "${YELLOW}⚠ Gemini optional (web interface also available)${NC}"
  fi
fi

if command -v "gemini" &> /dev/null; then
  test_cli "gemini"
fi
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "═══════════════════════════════════════════════════════════════"
echo "CONDUCTOR SYSTEM READINESS"
echo "═══════════════════════════════════════════════════════════════"

CODEX_OK=false
CLAUDE_OK=false
GEMINI_OK=false

command -v "codex" &> /dev/null && CODEX_OK=true
command -v "claude" &> /dev/null && CLAUDE_OK=true
command -v "gemini" &> /dev/null && GEMINI_OK=true

echo ""
echo "Required:"
if $CODEX_OK; then
  echo -e "  ${GREEN}✓ Codex (Tier 1 Router)${NC}"
else
  echo -e "  ${RED}✗ Codex (Tier 1 Router)${NC}"
  echo -e "${RED}CONDUCTOR CANNOT START WITHOUT CODEX${NC}"
  exit 1
fi

echo ""
echo "Recommended:"
if $CLAUDE_OK; then
  echo -e "  ${GREEN}✓ Claude Code (Executor)${NC}"
else
  echo -e "  ${YELLOW}⚠ Claude Code (Executor) - optional${NC}"
fi

echo ""
echo "Optional:"
if $GEMINI_OK; then
  echo -e "  ${GREEN}✓ Gemini (Executor)${NC}"
else
  echo -e "  ${YELLOW}⚠ Gemini (Executor) - optional${NC}"
fi

echo ""
echo -e "${GREEN}✓ CONDUCTOR READY TO LAUNCH${NC}"
echo ""
echo "Next: npm run dev"
echo ""
