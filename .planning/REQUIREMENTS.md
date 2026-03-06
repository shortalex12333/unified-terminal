# Unified Terminal v2.0 — Requirements

## Milestone: Primary Input Architecture

### R1: Explicit Entry Paths
**Priority:** P0
**Description:** User explicitly chooses one of 4 paths before any input is processed.

**Acceptance Criteria:**
- [ ] PrimaryInput component renders 4 cards: Build, Chat, Existing, Quick
- [ ] "Build Something" → triggers project flow (classify → brief → orchestrate)
- [ ] "Just Chat" → direct to ChatGPT BrowserView
- [ ] "Open Existing" → file picker → codebase mapper → brief
- [ ] "Quick Task" → single input → single Codex call

---

### R2: Project Type Classifier
**Priority:** P0
**Description:** Cheap agent (~200 tokens) detects project type from user input.

**Acceptance Criteria:**
- [ ] Returns `{primary, addons[], confidence, extractedGoal, suggestedName}`
- [ ] Primary type is one of: site | app | ecom | existing | chat | quick
- [ ] Addons array captures blended types (e.g., ecom with app backend)
- [ ] Confidence threshold: >0.7 to proceed, else ask user to clarify
- [ ] Classification completes in <2 seconds

**Types:**
- `site`: static website, landing page, portfolio
- `app`: web application with backend, database, auth
- `ecom`: online store, payments, inventory, shopping cart
- `existing`: working on existing codebase
- `chat`: general question, not a build request
- `quick`: tiny task, single file change

---

### R3: Capability Registry
**Priority:** P0
**Description:** Hardcoded mapping from project type to required capabilities.

**Acceptance Criteria:**
- [ ] `CAPABILITY_REGISTRY` maps each ProjectType to:
  - `skills`: array of skill IDs needed
  - `mcps`: array of MCP server IDs needed
  - `template`: brief template ID
  - `estimatedSteps`: [min, max] step range
  - `firstPhase`: 'analysis' | 'scaffold'
  - `route`: 'chatgpt-direct' | 'codex-single' | 'full-orchestration'
- [ ] Registry is const (no runtime modification)
- [ ] All 6 project types have entries

---

### R4: Brief Templates
**Priority:** P0
**Description:** Project-type-specific templates with required/optional fields.

**Acceptance Criteria:**
- [ ] Templates exist for: site, app, ecom, existing
- [ ] Each template has sections with fields
- [ ] Fields specify: id, label, type, required, question, validation
- [ ] Validation functions for each field type
- [ ] REQUIRED_FIELDS constant per template

---

### R5: Brief Agent
**Priority:** P0
**Description:** Asks targeted questions to fill template blanks.

**Acceptance Criteria:**
- [ ] Infers values from initial input where possible
- [ ] Only asks questions for unfilled required fields
- [ ] Questions presented one at a time via UI
- [ ] Supports field types: text, select, multiselect, boolean
- [ ] Stores answers in brief object

---

### R6: Brief Validator (Hard Rail)
**Priority:** P0
**Description:** Enforces brief completeness before Conductor receives it.

**Acceptance Criteria:**
- [ ] Validates all required fields are filled
- [ ] Runs field-specific validation functions
- [ ] BLOCKS progression if validation fails (hard rail)
- [ ] Returns clear error messages for missing/invalid fields
- [ ] No workarounds - Conductor never sees incomplete briefs

---

### R7: MCP Checker
**Priority:** P1
**Description:** Check if required MCPs are connected before starting project.

**Acceptance Criteria:**
- [ ] `mcp:check-required` IPC handler returns missing MCPs
- [ ] MCPConnectionPrompt component shows when MCPs missing
- [ ] User can connect MCPs inline or skip (with warning)
- [ ] MCP status persists across sessions

---

### R8: Entry Router
**Priority:** P0
**Description:** Routes user choice + input to correct flow.

**Acceptance Criteria:**
- [ ] `entry:route` IPC handler dispatches to correct flow
- [ ] Build path: classify → capabilities → MCP check → brief → validate → conductor
- [ ] Chat path: direct to ChatGPT BrowserView
- [ ] Existing path: file picker → codebase mapper → brief
- [ ] Quick path: single Codex call with bodyguard

---

### R9: Conductor Refactor
**Priority:** P0
**Description:** Conductor receives complete briefs, not raw messages.

**Acceptance Criteria:**
- [ ] `classify()` method removed
- [ ] `planFromBrief(brief, capabilities)` method added
- [ ] Prompt includes full brief JSON + available skills + MCP list
- [ ] DAG output unchanged (compatible with step-scheduler)
- [ ] No guessing or inference - all info in brief

---

### R10: UI Components
**Priority:** P0
**Description:** React components for new primary input flow.

**Acceptance Criteria:**
- [ ] PrimaryInput: 4-card selector, input capture, mode transitions
- [ ] ProjectTypeCard: visual card for each entry path
- [ ] BriefQuestionnaire: Q&A flow for brief filling
- [ ] MCPConnectionPrompt: modal for connecting required MCPs

---

### R11: Feature Flag Migration
**Priority:** P1
**Description:** New flow behind feature flag, gradual rollout.

**Acceptance Criteria:**
- [ ] `USE_NEW_FLOW` environment variable controls routing
- [ ] Old flow (send-interceptor) still accessible
- [ ] Can switch between flows without rebuild
- [ ] Telemetry tracks which flow users are on

---

### R12: Fallback Handling
**Priority:** P1
**Description:** Handle edge cases and classifier uncertainty.

**Acceptance Criteria:**
- [ ] Low confidence (<0.7) prompts user to select type manually
- [ ] "LEARNING" project type for tutorials/courses
- [ ] Classifier wrong → user can override at brief stage
- [ ] Quick path handles multi-file changes gracefully

---

## Non-Requirements (Explicitly Out of Scope)

- [ ] Windows/Linux builds (macOS only for v2.0)
- [ ] Code signing and notarization
- [ ] Advanced analytics dashboard
- [ ] Team/collaboration features
- [ ] Custom template builder UI

---

## Success Criteria

1. **Brief completion < 2 minutes** for new projects
2. **Classification accuracy > 90%** (measured by override rate)
3. **Zero interceptor failures** (because we don't intercept)
4. **MCP connection prompts** shown at the right time (not after failure)
5. **DAG quality maintained** (execution success rate same or better)
