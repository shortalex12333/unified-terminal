# Everything Claude Code (ECC) Repository Audit

**Repository:** github.com/affaan-m/everything-claude-code
**Audit Date:** 2026-03-03
**Total Files:** 998
**Markdown Files:** 350+
**Primary Purpose:** Claude Code plugin with agents, skills, commands, hooks, and rules

---

## Repository Structure Overview

```
├── agents/           # 13 specialized subagents
├── skills/           # 50+ workflow skills
├── commands/         # 33 slash commands
├── hooks/            # Trigger-based automations
├── rules/            # Always-follow guidelines (common + per-language)
├── mcp-configs/      # 14 MCP server configurations
├── scripts/          # Cross-platform Node.js utilities
├── tests/            # Test suite
├── .agents/skills/   # Additional skills in dotfile format
├── .cursor/rules/    # Cursor-specific rules
├── .opencode/        # OpenCode integration
├── docs/             # Japanese, Chinese translations
└── examples/         # Example CLAUDE.md configurations
```

---

## FILE TRIAGE

### EXTRACT (High Priority - Copy to Unified Terminal)

| File | Path | Reason |
|------|------|--------|
| **tdd-guide** | `agents/tdd-guide.md` | Complete TDD workflow with Red-Green-Refactor cycle, 80% coverage requirements, edge case checklist |
| **code-reviewer** | `agents/code-reviewer.md` | Comprehensive code review with confidence-based filtering, severity levels, React/Node.js patterns |
| **security-reviewer** | `agents/security-reviewer.md` | OWASP Top 10, secrets detection, pattern table with severity ratings |
| **doc-updater** | `agents/doc-updater.md` | Codemap generation, AST analysis, documentation sync |
| **build-error-resolver** | `agents/build-error-resolver.md` | Minimal-diff build fixing, guardrails, common fix patterns |
| **tdd-workflow** | `skills/tdd-workflow/SKILL.md` | Extended TDD examples with mocking patterns (Supabase, Redis, OpenAI) |
| **security-review** | `skills/security-review/SKILL.md` | Full security checklist with code examples (secrets, XSS, CSRF, RLS) |
| **verification-loop** | `skills/verification-loop/SKILL.md` | 6-phase verification (build, types, lint, tests, security, diff review) |
| **AGENTS.md** | `AGENTS.md` | Master index of agent orchestration patterns |

### REVIEW (Medium Priority - Evaluate for Adaptation)

| File | Path | Notes |
|------|------|-------|
| planner | `agents/planner.md` | Implementation planning agent |
| architect | `agents/architect.md` | System design specialist |
| e2e-runner | `agents/e2e-runner.md` | Playwright E2E test generation |
| refactor-cleaner | `agents/refactor-cleaner.md` | Dead code cleanup |
| database-reviewer | `agents/database-reviewer.md` | PostgreSQL/Supabase specialist |
| the-longform-guide | `the-longform-guide.md` | Advanced patterns (context management, memory persistence) |
| the-shortform-guide | `the-shortform-guide.md` | Basic setup patterns |
| continuous-learning | `skills/continuous-learning/SKILL.md` | Auto-extraction of patterns |
| strategic-compact | `skills/strategic-compact/SKILL.md` | Context window management |
| eval-harness | `skills/eval-harness/SKILL.md` | Testing evaluation framework |

### SKIP (Low Priority or Duplicates)

| File | Path | Reason |
|------|------|--------|
| docs/ja-JP/* | Japanese translations | Duplicates of English versions |
| docs/zh-CN/* | Chinese translations | Duplicates of English versions |
| docs/zh-TW/* | Traditional Chinese | Duplicates of English versions |
| .cursor/* | Cursor-specific rules | IDE-specific, not portable |
| .opencode/* | OpenCode integration | Tool-specific |
| go-reviewer | `agents/go-reviewer.md` | Go-specific (not using Go) |
| go-build-resolver | `agents/go-build-resolver.md` | Go-specific |
| python-reviewer | `agents/python-reviewer.md` | Python-specific (evaluate if needed) |
| swift-* | `rules/swift/*` | Swift-specific (not using Swift) |
| springboot-* | `skills/springboot-*` | Java-specific |
| django-* | `skills/django-*` | Python/Django-specific |

---

## EXTRACTED CONTENT ANALYSIS

### 1. tdd-guide (agents/tdd-guide.md)

**Purpose:** Test-Driven Development specialist

**Key Components:**
- TDD Workflow: RED (failing test) -> GREEN (minimal implementation) -> REFACTOR
- Coverage requirement: 80% minimum
- Test types: Unit, Integration, E2E
- Edge case checklist (8 categories)
- Anti-patterns list

**Useful Patterns:**
```
## Edge Cases You MUST Test

1. Null/Undefined input
2. Empty arrays/strings
3. Invalid types passed
4. Boundary values (min/max)
5. Error paths (network failures, DB errors)
6. Race conditions (concurrent operations)
7. Large data (performance with 10k+ items)
8. Special characters (Unicode, emojis, SQL chars)
```

**Quality Checklist:**
- All public functions have unit tests
- All API endpoints have integration tests
- Critical user flows have E2E tests
- Coverage 80%+

---

### 2. code-reviewer (agents/code-reviewer.md)

**Purpose:** Senior code review specialist

**Key Components:**
- Confidence-based filtering (>80% confidence to report)
- Severity levels: CRITICAL, HIGH, MEDIUM, LOW
- Review categories: Security, Code Quality, React/Next.js, Node.js, Performance, Best Practices

**Critical Security Patterns:**
```typescript
// BAD: SQL injection via string concatenation
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD: Parameterized query
const query = `SELECT * FROM users WHERE id = $1`;
```

**Approval Criteria:**
- Approve: No CRITICAL or HIGH issues
- Warning: HIGH issues only (can merge with caution)
- Block: CRITICAL issues found

**Output Format:**
```
[CRITICAL] Hardcoded API key in source
File: src/api/client.ts:42
Issue: API key "sk-abc..." exposed in source code
Fix: Move to environment variable
```

---

### 3. security-reviewer (agents/security-reviewer.md)

**Purpose:** Security vulnerability detection

**OWASP Top 10 Coverage:**
1. Injection
2. Broken Authentication
3. Sensitive Data Exposure
4. XXE
5. Broken Access Control
6. Security Misconfiguration
7. XSS
8. Insecure Deserialization
9. Known Vulnerabilities
10. Insufficient Logging

**Pattern Table:**
| Pattern | Severity | Fix |
|---------|----------|-----|
| Hardcoded secrets | CRITICAL | Use `process.env` |
| Shell command with user input | CRITICAL | Use safe APIs or execFile |
| String-concatenated SQL | CRITICAL | Parameterized queries |
| `innerHTML = userInput` | HIGH | Use `textContent` or DOMPurify |
| No auth check on route | CRITICAL | Add authentication middleware |
| Balance check without lock | CRITICAL | Use `FOR UPDATE` in transaction |

**When to Run:**
- New API endpoints
- Auth code changes
- User input handling
- DB query changes
- Payment code
- Before major releases

---

### 4. build-error-resolver (agents/build-error-resolver.md)

**Purpose:** Fix build/type errors with minimal changes

**DO:**
- Add type annotations where missing
- Add null checks where needed
- Fix imports/exports
- Add missing dependencies
- Fix configuration files

**DON'T:**
- Refactor unrelated code
- Change architecture
- Add new features
- Change logic flow

**Common Fixes Table:**
| Error | Fix |
|-------|-----|
| `implicitly has 'any' type` | Add type annotation |
| `Object is possibly 'undefined'` | Optional chaining `?.` or null check |
| `Property does not exist` | Add to interface or use optional `?` |
| `Cannot find module` | Check tsconfig paths, install package |
| `Type 'X' not assignable to 'Y'` | Parse/convert type or fix the type |

**Recovery Commands:**
```bash
# Nuclear option: clear all caches
rm -rf .next node_modules/.cache && npm run build

# Reinstall dependencies
rm -rf node_modules package-lock.json && npm install

# Fix ESLint auto-fixable
npx eslint . --fix
```

---

### 5. doc-updater (agents/doc-updater.md)

**Purpose:** Documentation and codemap maintenance

**Codemap Output Structure:**
```
docs/CODEMAPS/
├── INDEX.md          # Overview of all areas
├── frontend.md       # Frontend structure
├── backend.md        # Backend/API structure
├── database.md       # Database schema
├── integrations.md   # External services
└── workers.md        # Background jobs
```

**Key Principles:**
1. Single Source of Truth - Generate from code, don't manually write
2. Freshness Timestamps - Always include last updated date
3. Token Efficiency - Keep codemaps under 500 lines each
4. Actionable - Include setup commands that actually work

---

### 6. verification-loop (skills/verification-loop/SKILL.md)

**Purpose:** Comprehensive 6-phase verification system

**Phases:**
1. Build Verification - `npm run build`
2. Type Check - `npx tsc --noEmit`
3. Lint Check - `npm run lint`
4. Test Suite - `npm test -- --coverage`
5. Security Scan - grep for secrets, console.log
6. Diff Review - `git diff --stat`

**Output Format:**
```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR
```

---

## REUSABLE PATTERNS FOR UNIFIED TERMINAL

### Pattern 1: Confidence-Based Filtering
From code-reviewer - only report issues with >80% confidence to reduce noise.

### Pattern 2: Severity Classification
CRITICAL > HIGH > MEDIUM > LOW
- CRITICAL blocks deployment
- HIGH requires attention before merge
- MEDIUM is informational
- LOW is style/preference

### Pattern 3: Edge Case Checklist
Always test: Null/Undefined, Empty, Invalid types, Boundary values, Error paths, Race conditions, Large data, Special characters

### Pattern 4: Minimal Diff Philosophy
From build-error-resolver - fix only what's broken, don't refactor, don't improve, just fix and move on.

### Pattern 5: Verification Loop
Run 6-phase check after every significant change: Build, Types, Lint, Tests, Security, Diff

### Pattern 6: Mocking External Services
```typescript
// Supabase Mock
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [...],
          error: null
        }))
      }))
    }))
  }
}))
```

---

## COMMAND STRUCTURE

Commands follow this pattern:
```markdown
---
description: Brief description of command purpose
---

# Command Name

## What This Command Does
[List of actions]

## When to Use
[Trigger conditions]

## How It Works
[Step-by-step workflow]
```

---

## INTEGRATION RECOMMENDATIONS

### For Unified Terminal Conductor System

1. **Adopt verification-loop** as post-execution check
2. **Integrate security-reviewer patterns** into CLI executor
3. **Use build-error-resolver** as fallback for failed builds
4. **Add tdd-guide edge cases** to test generation

### For Project CLAUDE.md

1. Copy AGENTS.md orchestration patterns
2. Adopt confidence-based filtering for reviews
3. Use severity classification system
4. Add verification loop to workflow

---

## SUMMARY

**Files to Extract:** 9 files
**Files to Review:** 10 files  
**Files to Skip:** 200+ (translations, language-specific, IDE-specific)

**Most Valuable Patterns:**
1. TDD workflow with edge case checklist
2. Confidence-based code review
3. OWASP-aligned security review
4. Minimal-diff build fixing
5. 6-phase verification loop

**Repository Quality:** HIGH - Well-structured, comprehensive, production-tested patterns with clear documentation and examples.
