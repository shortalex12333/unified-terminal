# SPINE.md Output Specification

**Version:** 1.0.0
**Status:** SPEC (for Instance 4 implementation)
**Last Updated:** 2026-03-03

---

## 1. Purpose

SPINE.md is the **filesystem truth document** for the unified-terminal orchestration system.

### What SPINE.md IS:
- A machine-readable snapshot of the current project state
- Refreshed deterministically before and after every orchestration step
- Pure filesystem scan output with zero AI interpretation
- The single source of truth for all actors in the system

### What SPINE.md is NOT:
- NOT a planning document (that's PLAN.md)
- NOT a decision log (that's DECISIONS.md)
- NOT an AI summary or opinion
- NOT manually edited by humans or LLMs

### Core Principle

> **SPINE.md contains only facts that can be verified by filesystem inspection.**

If a value requires judgment, inference, or interpretation, it does not belong in SPINE.md.

---

## 2. Field Schema

SPINE.md uses YAML format for machine readability. All fields are documented below.

### 2.1 Project Metadata

```yaml
project:
  path: string          # REQUIRED - Absolute path to project root
  name: string          # REQUIRED - Directory name or package.json name
  created: ISO8601      # OPTIONAL - Git first commit date or filesystem creation
```

**Example:**
```yaml
project:
  path: /Users/celeste7/Documents/unified-terminal
  name: unified-terminal
  created: 2026-02-15T09:30:00Z
```

---

### 2.2 File Statistics

```yaml
files:
  total: integer                    # REQUIRED - Total file count (excluding .git, node_modules)
  by_type:                          # REQUIRED - Object mapping extension to count
    ".ts": integer
    ".tsx": integer
    ".js": integer
    ".json": integer
    ".md": integer
    ".yaml": integer
    # ... all detected extensions
  last_modified:                    # REQUIRED - Most recently modified file
    path: string                    # Relative path from project root
    timestamp: ISO8601              # Modification time
```

**Example:**
```yaml
files:
  total: 847
  by_type:
    ".ts": 234
    ".tsx": 89
    ".js": 12
    ".json": 45
    ".md": 67
    ".yaml": 8
    ".css": 23
    ".svg": 15
  last_modified:
    path: src/orchestrator/conductor.ts
    timestamp: 2026-03-03T14:22:15Z
```

---

### 2.3 Git State

```yaml
git:
  branch: string                    # REQUIRED - Current branch name
  clean: boolean                    # REQUIRED - true if no uncommitted changes
  uncommitted:                      # REQUIRED - Array of changed files (empty if clean)
    - path: string                  # Relative path
      status: string                # "modified" | "added" | "deleted" | "untracked"
  last_commit:                      # REQUIRED - Most recent commit info
    hash: string                    # Short hash (7 chars)
    message: string                 # First line of commit message
    author: string                  # Commit author
    timestamp: ISO8601              # Commit timestamp
  ahead: integer                    # OPTIONAL - Commits ahead of remote (0 if up to date)
  behind: integer                   # OPTIONAL - Commits behind remote (0 if up to date)
```

**Example:**
```yaml
git:
  branch: main
  clean: false
  uncommitted:
    - path: src/spine/scanner.ts
      status: modified
    - path: docs/SPINE.md
      status: added
  last_commit:
    hash: a3f7c2e
    message: "feat: Add spine scanner base implementation"
    author: celeste7
    timestamp: 2026-03-03T13:45:00Z
  ahead: 2
  behind: 0
```

---

### 2.4 Test State

```yaml
tests:
  runner: string                    # REQUIRED - "vitest" | "jest" | "playwright" | "pytest" | "none"
  config_file: string               # OPTIONAL - Path to test config if detected
  last_run:                         # OPTIONAL - null if never run in session
    timestamp: ISO8601
    duration_ms: integer
  passed: integer                   # REQUIRED - 0 if no tests or not run
  failed: integer                   # REQUIRED - 0 if no tests or not run
  skipped: integer                  # REQUIRED - 0 if no tests or not run
  coverage:                         # OPTIONAL - null if coverage not configured
    lines: float                    # Percentage 0-100
    branches: float
    functions: float
    statements: float
```

**Example:**
```yaml
tests:
  runner: vitest
  config_file: vitest.config.ts
  last_run:
    timestamp: 2026-03-03T14:10:00Z
    duration_ms: 4523
  passed: 283
  failed: 0
  skipped: 12
  coverage:
    lines: 78.4
    branches: 65.2
    functions: 82.1
    statements: 77.9
```

---

### 2.5 Build State

```yaml
build:
  command: string                   # REQUIRED - Detected build command
  config_file: string               # OPTIONAL - Path to build config
  last_build:                       # OPTIONAL - null if never built in session
    timestamp: ISO8601
    duration_ms: integer
    success: boolean
  output_dir: string                # OPTIONAL - Build output directory if detected
  output_size_kb: integer           # OPTIONAL - Size of output directory in KB
```

**Example:**
```yaml
build:
  command: "npm run build"
  config_file: next.config.js
  last_build:
    timestamp: 2026-03-03T14:05:00Z
    duration_ms: 12450
    success: true
  output_dir: .next
  output_size_kb: 45230
```

---

### 2.6 Tech Stack

```yaml
tech_stack:
  framework: string                 # REQUIRED - Primary framework detected
  language: string                  # REQUIRED - Primary language
  package_manager: string           # REQUIRED - "npm" | "yarn" | "pnpm" | "bun" | "pip" | "cargo" | "none"
  runtime: string                   # OPTIONAL - "node" | "deno" | "bun" | "python" | etc.
  database: string                  # OPTIONAL - Detected database type or "none"
  deploy_target: string             # OPTIONAL - Detected deployment platform or "unknown"
```

**Detection Rules:**
- `framework`: Inferred from package.json dependencies or config files
- `language`: Inferred from majority file extension
- `database`: Inferred from dependencies (prisma, drizzle, supabase, etc.)
- `deploy_target`: Inferred from config files (vercel.json, fly.toml, etc.)

**Example:**
```yaml
tech_stack:
  framework: next.js
  language: typescript
  package_manager: npm
  runtime: node
  database: supabase
  deploy_target: vercel
```

---

### 2.7 Dependencies

```yaml
dependencies:
  production:
    count: integer                  # REQUIRED - Number of production deps
    list: array                     # OPTIONAL - Array of {name, version} (top 20 by usage)
  dev:
    count: integer                  # REQUIRED - Number of dev deps
    list: array                     # OPTIONAL - Array of {name, version} (top 20 by usage)
  outdated:                         # OPTIONAL - Array of outdated packages
    - name: string
      current: string               # Currently installed version
      latest: string                # Latest available version
      type: string                  # "major" | "minor" | "patch"
```

**Example:**
```yaml
dependencies:
  production:
    count: 47
    list:
      - name: next
        version: 14.2.3
      - name: react
        version: 18.3.1
      - name: "@supabase/supabase-js"
        version: 2.45.0
  dev:
    count: 23
    list:
      - name: typescript
        version: 5.4.5
      - name: vitest
        version: 1.6.0
  outdated:
    - name: next
      current: 14.2.3
      latest: 14.3.1
      type: minor
```

---

### 2.8 Active Agents

```yaml
active_agents:                      # REQUIRED - Array, empty if no agents active
  - id: string                      # Agent identifier (e.g., "conductor", "pa-1", "worker-3")
    model: string                   # Model being used (e.g., "opus-4.5", "sonnet-4", "haiku-3.5")
    status: string                  # "idle" | "working" | "blocked" | "waiting"
    task: string                    # OPTIONAL - Current task description if working
    token_used: integer             # Tokens consumed this session
    token_limit: integer            # Token budget for this agent
    token_percent: float            # Percentage of budget consumed (0-100)
    started: ISO8601                # When agent was spawned
```

**Example:**
```yaml
active_agents:
  - id: conductor
    model: opus-4.5
    status: working
    task: "Orchestrating phase 3 implementation"
    token_used: 45000
    token_limit: 400000
    token_percent: 22.5
    started: 2026-03-03T13:00:00Z
  - id: pa-1
    model: sonnet-4
    status: idle
    token_used: 12000
    token_limit: 50000
    token_percent: 24.0
    started: 2026-03-03T13:15:00Z
  - id: worker-1
    model: haiku-3.5
    status: working
    task: "Writing unit tests for spine scanner"
    token_used: 8500
    token_limit: 25000
    token_percent: 34.0
    started: 2026-03-03T14:00:00Z
```

---

### 2.9 Errors (Runtime)

```yaml
errors:                             # OPTIONAL - Recent errors detected
  build: array                      # Build errors from last build
  test: array                       # Test failures from last run
  lint: array                       # Lint errors if linter configured
  runtime: array                    # Runtime errors if dev server running
```

**Example:**
```yaml
errors:
  build: []
  test:
    - file: src/spine/scanner.test.ts
      line: 45
      message: "Expected 5 but received 4"
  lint:
    - file: src/utils/helpers.ts
      line: 12
      rule: "@typescript-eslint/no-unused-vars"
      message: "Variable 'temp' is declared but never used"
  runtime: []
```

---

### 2.10 Metadata

```yaml
_meta:
  version: string                   # REQUIRED - SPINE schema version
  generated: ISO8601                # REQUIRED - When this SPINE was generated
  generation_ms: integer            # REQUIRED - How long generation took
  trigger: string                   # REQUIRED - What triggered this refresh
```

**Example:**
```yaml
_meta:
  version: "1.0.0"
  generated: 2026-03-03T14:25:00Z
  generation_ms: 87
  trigger: pre-step
```

---

## 3. Refresh Rules

SPINE.md is refreshed automatically at specific points in the orchestration lifecycle.

### 3.1 Refresh Triggers

| Trigger | When | Priority |
|---------|------|----------|
| `pre-step` | Before Conductor assigns any step | HIGH |
| `post-step` | After any agent completes a step | HIGH |
| `on-demand` | When explicitly requested by any actor | NORMAL |
| `on-git-change` | After any git operation (commit, checkout, pull) | NORMAL |
| `on-test-complete` | After test suite finishes | NORMAL |
| `on-build-complete` | After build completes | NORMAL |
| `periodic` | Every 5 minutes if idle | LOW |

### 3.2 Refresh Behavior

1. **Atomic Updates**: SPINE.md is written atomically (write to temp, then rename)
2. **No Partial States**: If refresh fails, previous SPINE.md is preserved
3. **Timestamp Always Updates**: Even if no data changed, `_meta.generated` updates
4. **Async Non-Blocking**: Refresh should not block orchestration (target <100ms)

### 3.3 Refresh Priority

When multiple refresh triggers occur simultaneously:
- HIGH priority triggers execute immediately
- NORMAL priority triggers queue behind HIGH
- LOW priority triggers are skipped if queue is non-empty

---

## 4. Consumer List

The following actors read SPINE.md as part of their operation:

### 4.1 Conductor

**Read Frequency:** Every step
**Fields Used:** All
**Purpose:**
- Assess current project state before assigning work
- Determine if build/test is needed
- Track agent utilization and token budgets
- Detect blockers (failed tests, build errors)

### 4.2 Principal Assistant (PA)

**Read Frequency:** On activation
**Fields Used:** `project`, `tech_stack`, `git`, `active_agents`
**Purpose:**
- Understand project context for planning
- Check git state before proposing changes
- Coordinate with other active agents

### 4.3 Skill Injector

**Read Frequency:** On skill resolution
**Fields Used:** `tech_stack`, `dependencies`, `files.by_type`
**Purpose:**
- Determine which skills are relevant to inject
- Match framework/language to skill registry
- Avoid injecting irrelevant skills

### 4.4 Archivist

**Read Frequency:** On archive operation
**Fields Used:** `git.last_commit`, `tests`, `build`, `_meta`
**Purpose:**
- Record project state at decision points
- Correlate decisions with test/build outcomes
- Track progression over time

### 4.5 Enforcer

**Read Frequency:** On validation
**Fields Used:** `git.uncommitted`, `tests.failed`, `errors`
**Purpose:**
- Block steps if tests are failing
- Enforce clean git state for certain operations
- Validate pre-conditions for sensitive actions

---

## 5. Implementation Notes

### 5.1 Performance Requirements

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Full refresh time | <100ms | 500ms |
| File scan time | <50ms | 200ms |
| Git operations | <30ms | 100ms |
| Memory usage | <10MB | 50MB |

### 5.2 Implementation Constraints

1. **Pure Filesystem**: No network calls, no LLM calls, no database queries
2. **Deterministic**: Same filesystem state = same SPINE output
3. **Idempotent**: Multiple refreshes without changes = identical output
4. **Fail-Safe**: On any error, preserve last valid SPINE

### 5.3 Scanning Strategy

```
1. Read cached gitignore patterns
2. Parallel scan:
   a. File tree walker (respecting gitignore)
   b. Git status (porcelain format)
   c. Package.json / pyproject.toml / Cargo.toml
3. Aggregate results
4. Write SPINE.md atomically
```

### 5.4 Caching

- **Gitignore patterns**: Cache parsed patterns, invalidate on .gitignore change
- **Package manager lock**: Cache dependency info, invalidate on lockfile change
- **File tree**: Use filesystem watchers for incremental updates (optional optimization)

### 5.5 Error Handling

```yaml
# If a section fails to scan, use this format:
tests:
  _error: "Could not detect test runner"
  _fallback: true
  runner: unknown
  passed: 0
  failed: 0
  skipped: 0
```

### 5.6 File Location

SPINE.md is always written to:
```
{project_root}/.unified-terminal/SPINE.md
```

This location is:
- Inside the project for easy access
- In a dotfolder to avoid polluting project root
- Gitignored by default

---

## 6. Complete Example

```yaml
# SPINE.md - Filesystem Truth Document
# Generated: 2026-03-03T14:25:00Z
# DO NOT EDIT - This file is auto-generated

project:
  path: /Users/celeste7/Documents/unified-terminal
  name: unified-terminal
  created: 2026-02-15T09:30:00Z

files:
  total: 847
  by_type:
    ".ts": 234
    ".tsx": 89
    ".js": 12
    ".json": 45
    ".md": 67
    ".yaml": 8
  last_modified:
    path: src/orchestrator/conductor.ts
    timestamp: 2026-03-03T14:22:15Z

git:
  branch: main
  clean: true
  uncommitted: []
  last_commit:
    hash: a3f7c2e
    message: "feat: Add spine scanner base implementation"
    author: celeste7
    timestamp: 2026-03-03T13:45:00Z
  ahead: 0
  behind: 0

tests:
  runner: vitest
  config_file: vitest.config.ts
  last_run:
    timestamp: 2026-03-03T14:10:00Z
    duration_ms: 4523
  passed: 283
  failed: 0
  skipped: 12
  coverage:
    lines: 78.4
    branches: 65.2
    functions: 82.1
    statements: 77.9

build:
  command: "npm run build"
  config_file: next.config.js
  last_build:
    timestamp: 2026-03-03T14:05:00Z
    duration_ms: 12450
    success: true
  output_dir: .next
  output_size_kb: 45230

tech_stack:
  framework: next.js
  language: typescript
  package_manager: npm
  runtime: node
  database: supabase
  deploy_target: vercel

dependencies:
  production:
    count: 47
    list:
      - name: next
        version: 14.2.3
      - name: react
        version: 18.3.1
  dev:
    count: 23
    list:
      - name: typescript
        version: 5.4.5
      - name: vitest
        version: 1.6.0
  outdated: []

active_agents:
  - id: conductor
    model: opus-4.5
    status: working
    task: "Orchestrating phase 3 implementation"
    token_used: 45000
    token_limit: 400000
    token_percent: 22.5
    started: 2026-03-03T13:00:00Z

errors:
  build: []
  test: []
  lint: []
  runtime: []

_meta:
  version: "1.0.0"
  generated: 2026-03-03T14:25:00Z
  generation_ms: 87
  trigger: pre-step
```

---

## 7. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-03 | Initial specification |

---

## 8. References

- [Unified Terminal Architecture](/docs/ONGOING_WORK/DISSECTION/architecture/)
- [Conductor Specification](/docs/ONGOING_WORK/DISSECTION/specs/conductor-spec.md)
- [Enforcer Specification](/docs/ONGOING_WORK/DISSECTION/specs/ENFORCER.json)
