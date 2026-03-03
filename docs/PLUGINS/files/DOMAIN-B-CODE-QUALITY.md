# Domain B: Code Quality & Verification

## What This Domain Covers
Ensuring generated code works, tests run, builds succeed, security vulnerabilities are caught before deployment. The domain where hard rails matter most.

## Actors
| Actor | Role | Rail |
|-------|------|------|
| Bodyguard (dispatcher) | Spawns micro-checks in parallel via Promise.allSettled(). Aggregates binary results. Does NOT run checks itself. | HARD |
| Worker (verifier) | gsd-verifier.md prompt. Reviews output against requirements. | SOFT |
| Worker (code-reviewer) | code-reviewer.md prompt. Evaluates quality, patterns, maintainability. | SOFT |
| Worker (security-reviewer) | security-reviewer.md prompt. Evaluates security patterns. | SOFT |

---

## External Tools Kept (Real Code, Cannot Replicate)

| Tool | What It Does | Why Keep | Install |
|------|-------------|----------|---------|
| Vitest | Test runner | Locked winner. ESM-native, fast, Vite-compatible. Jest deleted. | `npm i -D vitest` |
| ESLint + Prettier | Linting + formatting | Locked pair. Bundled with `eslint-config-prettier` to prevent config fights. | `npm i -D eslint prettier eslint-config-prettier` |
| Semgrep | Static analysis | Catches security patterns, code smells at AST level. Real code, not prompt. | `pip install semgrep` or Docker |
| Gitleaks | Secret detection | Scans git history for API keys, tokens, passwords. Always-on pre-deploy. | Binary install or Docker |
| Playwright Test | E2E browser testing | Shared deps with Playwright MCP. Replaces Cypress (deleted). Lighter, more capable. | `npm i -D @playwright/test` |
| Context7 MCP | Live API doc injection | Returns real function signatures, not hallucinated ones. Cannot replicate their doc index. | MCP server config |

---

## Absorbed Prompts (Stolen, Rewritten, Owned)

### From everything-claude-code

**tdd-guide.md**
What it is: Prompt enforcing test-driven development workflow: write test first, run test (must fail), write implementation, run test (must pass), refactor.
What we took: The TDD loop structure and the specific phrasing that forces "run failing test BEFORE writing code."
What we changed: Removed Claude Code tool references. Added Vitest-specific commands instead of generic `npm test`.
Location: `/skills/workers/tdd-guide.md`

**code-reviewer.md**
What it is: Prompt for reviewing generated code against standards. Checks: naming conventions, error handling, edge cases, performance, security basics.
What we took: The review checklist structure.
What we changed: Added our severity levels (BLOCK vs WARN) to each check category.
Location: `/skills/workers/code-reviewer.md`

**security-reviewer.md**
What it is: Focused security review prompt. Checks: injection, auth bypass, exposed secrets, unsafe deserialization, XSS, CSRF.
What we took: The vulnerability category list and check methodology.
What we changed: Made it complement Semgrep (don't re-check what Semgrep catches; focus on logic-level security).
Location: `/skills/workers/security-reviewer.md`

**build-error-resolver.md**
What it is: Structured approach to build failures. Forces: read FULL error, identify root cause, check if dependency issue vs code issue, fix root not symptom.
What we took: The diagnostic flow.
What we changed: Added our fallback chain (retry > different approach > escalate to Conductor).
Location: `/skills/workers/build-error-resolver.md`

### From verification-integrity skill
**Two prompt templates:**
1. "Did tests ACTUALLY run or is this a false signal?" - Checks for: 0 tests passing (empty suite), skipped tests counted as pass, mocked-out assertions.
2. "Did the build ACTUALLY succeed?" - Checks for: empty dist/, error pages instead of content, partial builds.

Location: `/skills/verification/verification-integrity.md`

### From docker-local-first skill
**One prompt template:**
"Before pushing: does the container build? Does the app start? Can you hit the health endpoint?"

Location: `/skills/verification/docker-local-first.md`

---

## Deleted
| Tool | Why |
|------|-----|
| Jest | Vitest wins. Faster, ESM-native, Vite bundler default. |
| Cypress | Playwright Test wins. Shared MCP deps, lighter, more capable. |

---

## ENFORCER.json Schema (Per Micro-Check)

Each check dispatched by Bodyguard follows this schema:
```json
{
  "name": "test-exit-code",
  "check": "npm test 2>&1; echo $?",
  "pass": "output.trim().endsWith('0')",
  "false_positive": "Passes with 0 tests run. Secondary: parse test count > 0.",
  "secondary_check": "npx vitest --reporter=json | jq '.numTotalTests'",
  "confidence": "definitive",
  "retry": { "attempts": 1, "delay_ms": 0 },
  "rail": "HARD"
}
```

```json
{
  "name": "build-artifact-exists",
  "check": "ls -la dist/ 2>/dev/null | wc -l",
  "pass": "parseInt(output) > 1",
  "false_positive": "dist/ might contain only sourcemaps. Secondary: check for .html or .js files.",
  "secondary_check": "find dist/ -name '*.html' -o -name '*.js' | head -1",
  "confidence": "definitive",
  "retry": { "attempts": 1, "delay_ms": 0 },
  "rail": "HARD"
}
```

```json
{
  "name": "docker-health",
  "check": "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000",
  "pass": "output.trim() === '200'",
  "false_positive": "Container warming up returns 502. Retry. Also: 200 might be error page.",
  "secondary_check": "curl -s http://localhost:3000 | grep -v 'Cannot GET' | grep -v 'Error' | wc -c",
  "confidence": "heuristic",
  "retry": { "attempts": 3, "delay_ms": 5000 },
  "rail": "HARD (after retries exhausted)"
}
```

```json
{
  "name": "scope-enforcement",
  "check": "git diff --name-only HEAD",
  "pass": "every modified file is in step.declaredFiles[]",
  "false_positive": "Auto-generated files (lock files, .next/) not declared. Whitelist known auto-gen patterns.",
  "secondary_check": "filter out: package-lock.json, yarn.lock, .next/*, node_modules/*",
  "confidence": "definitive",
  "retry": { "attempts": 1, "delay_ms": 0 },
  "rail": "HARD"
}
```
