# Kenoki Architecture Refactor: Primary Input Flow

## Executive Summary

**Current State:** Parasitic interceptor pattern wrapping ChatGPT
**Target State:** Kenoki-first input with ChatGPT as one backend option

**Core Change:** User intent enters through OUR UI, not intercepted from ChatGPT's input field.

---

## New Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KENOKI PRIMARY INPUT                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Build       │  │ Just Chat   │  │ Open        │  │ Quick Task  │        │
│  │ Something   │  │ (ChatGPT)   │  │ Existing    │  │             │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ PROJECT FLOW    │ │ PASS-THROUGH│ │ ANALYSIS    │ │ DIRECT EXECUTE  │
│                 │ │             │ │ FIRST       │ │                 │
│ ┌─────────────┐ │ │ ChatGPT     │ │ ┌─────────┐ │ │ Single Codex    │
│ │ Classifier  │ │ │ BrowserView │ │ │Codebase │ │ │ call + bodyguard│
│ │ (agent)     │ │ │ direct      │ │ │Mapper   │ │ │                 │
│ └──────┬──────┘ │ │             │ │ └────┬────┘ │ └─────────────────┘
│        ▼        │ │ /skill-     │ │      ▼      │
│ ┌─────────────┐ │ │ kenoki      │ │ Analysis    │
│ │ Capability  │ │ │ injected    │ │ Brief →     │
│ │ Registry    │ │ │             │ │ PAUL mode   │
│ │ (hardcoded) │ │ └─────────────┘ └─────────────┘
│ └──────┬──────┘ │
│        ▼        │
│ ┌─────────────┐ │
│ │ MCP Checker │ │
│ │ (prompt if  │ │
│ │ missing)    │ │
│ └──────┬──────┘ │
│        ▼        │
│ ┌─────────────┐ │
│ │ Brief Agent │ │
│ │ (targeted   │ │
│ │ questions)  │ │
│ └──────┬──────┘ │
│        ▼        │
│ ┌─────────────┐ │
│ │ Brief       │ │
│ │ Validator   │ │
│ │ (hard rail) │ │
│ └──────┬──────┘ │
│        ▼        │
│ ┌─────────────┐ │
│ │ Conductor   │ │
│ │ (receives   │ │
│ │ COMPLETE    │ │
│ │ brief)      │ │
│ └──────┬──────┘ │
└────────┼────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXISTING EXECUTION LAYER (UNCHANGED)                      │
│  Step Scheduler → Adapters → Bodyguard → Spine → Enforcer → Done            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Changes Overview

### NEW FILES TO CREATE

| File | Purpose | Type | Lines Est. |
|------|---------|------|------------|
| `src/main/classification/types.ts` | Type definitions for project types, capabilities | Types | ~80 |
| `src/main/classification/capability-registry.ts` | Hardcoded mapping: project type → skills/MCPs | Data | ~150 |
| `src/main/classification/project-classifier.ts` | Cheap agent that detects project type | Agent | ~120 |
| `src/main/classification/index.ts` | Exports | Barrel | ~10 |
| `src/main/brief/types.ts` | Brief interfaces, template structure | Types | ~100 |
| `src/main/brief/templates/site.ts` | Site project brief template | Data | ~60 |
| `src/main/brief/templates/app.ts` | App project brief template | Data | ~80 |
| `src/main/brief/templates/ecom.ts` | Ecom project brief template | Data | ~100 |
| `src/main/brief/templates/existing.ts` | Existing project brief template | Data | ~70 |
| `src/main/brief/templates/index.ts` | Template exports | Barrel | ~15 |
| `src/main/brief/brief-generator.ts` | Creates brief from intent + type | Code | ~80 |
| `src/main/brief/brief-agent.ts` | Asks targeted questions to fill blanks | Agent | ~150 |
| `src/main/brief/brief-validator.ts` | Hard rail: ensures brief complete | Code | ~100 |
| `src/main/brief/index.ts` | Exports | Barrel | ~15 |
| `src/main/orchestration/entry-router.ts` | Routes user choice to correct flow | Code | ~80 |
| `src/main/orchestration/index.ts` | Exports | Barrel | ~10 |
| `src/renderer/components/PrimaryInput.tsx` | Main input UI with 4 options | React | ~200 |
| `src/renderer/components/ProjectTypeCard.tsx` | Visual card for project type | React | ~80 |
| `src/renderer/components/BriefQuestionnaire.tsx` | UI for brief agent questions | React | ~250 |
| `src/renderer/components/MCPConnectionPrompt.tsx` | Prompt when MCPs needed | React | ~120 |
| `src/skills/kenoki.md` | Skill file describing Kenoki itself | Markdown | ~50 |

**Total new files:** 21
**Total new lines:** ~1,920

---

### EXISTING FILES TO MODIFY

| File | Changes | Impact |
|------|---------|--------|
| `src/main/index.ts` | Add new IPC handlers for classification, brief, entry routing. Remove interceptor setup for build flow (keep for chat). | Medium |
| `src/main/conductor.ts` | Refactor `classify()` to `planFromBrief()`. Remove intent classification logic. Expect complete brief as input. | High |
| `src/renderer/components/App.tsx` | Replace ProfilePicker as default view with PrimaryInput. Add routing logic for 4 paths. | High |
| `src/main/mcp/mcp-manager.ts` | Add `checkRequired(capabilities)` method that returns missing MCPs | Low |
| `src/main/step-scheduler.ts` | No changes - receives DAG from Conductor as before | None |
| `src/main/executors/*` | No changes - execute steps as before | None |
| `src/enforcement/*` | No changes - hard rails work as before | None |

---

### FILES TO DEPRECATE (NOT DELETE YET)

| File | Reason | Replacement |
|------|--------|-------------|
| `src/main/send-interceptor.ts` | Parasitic pattern | PrimaryInput captures intent |
| `src/main/fast-path.ts` | Regex classification | Explicit user choice in UI |
| `src/intake/*` | ChatGPT-driven intake | Brief Agent with templates |

**Note:** Keep these files but don't wire them into main flow. They may be useful for chat pass-through or as reference.

---

## Detailed Implementation Plan

### Phase 1: Foundation (Classification Layer)

**Goal:** Project type detection and capability mapping

```
src/main/classification/
├── types.ts              # ProjectType, Capabilities, ClassificationResult
├── capability-registry.ts # HARDCODED mapping
├── project-classifier.ts  # Cheap Codex agent
└── index.ts
```

**types.ts:**
```typescript
export type ProjectType = 'site' | 'app' | 'ecom' | 'existing' | 'chat' | 'quick';

export interface Capabilities {
  skills: string[];
  mcps: string[];
  template: string;
  estimatedSteps: [number, number]; // min-max range
  firstPhase?: 'analysis' | 'scaffold'; // what to do first
  route?: 'chatgpt-direct' | 'codex-single' | 'full-orchestration';
}

export interface ClassificationResult {
  type: ProjectType;
  confidence: number;
  extractedGoal: string;
  suggestedName: string;
}
```

**capability-registry.ts:**
```typescript
export const CAPABILITY_REGISTRY: Record<ProjectType, Capabilities> = {
  site: {
    skills: ['scaffold', 'frontend-design', 'deploy'],
    mcps: [],
    template: 'site',
    estimatedSteps: [5, 8],
    firstPhase: 'scaffold',
    route: 'full-orchestration',
  },
  app: {
    skills: ['scaffold', 'auth-setup', 'db-setup', 'api-design', 'deploy'],
    mcps: ['supabase'],
    template: 'app',
    estimatedSteps: [8, 12],
    firstPhase: 'scaffold',
    route: 'full-orchestration',
  },
  ecom: {
    skills: ['scaffold', 'payment-flow', 'inventory', 'frontend-design', 'deploy'],
    mcps: ['stripe', 'shopify'],
    template: 'ecom',
    estimatedSteps: [12, 20],
    firstPhase: 'scaffold',
    route: 'full-orchestration',
  },
  existing: {
    skills: ['codebase-mapper', 'code-reviewer'],
    mcps: [],
    template: 'existing',
    estimatedSteps: [3, 7],
    firstPhase: 'analysis',
    route: 'full-orchestration',
  },
  chat: {
    skills: [],
    mcps: [],
    template: '',
    estimatedSteps: [0, 0],
    route: 'chatgpt-direct',
  },
  quick: {
    skills: [],
    mcps: [],
    template: '',
    estimatedSteps: [1, 2],
    route: 'codex-single',
  },
};
```

**project-classifier.ts:**
```typescript
// Uses Codex with a tiny prompt to classify
// Input: "build me an ecom store for street clothes"
// Output: { type: 'ecom', confidence: 0.95, extractedGoal: 'ecom store for street clothes', suggestedName: 'street-clothes-store' }

const CLASSIFIER_PROMPT = `Classify this project request into exactly one type:
- site: static website, landing page, portfolio
- app: web application with backend, database, auth
- ecom: online store, payments, inventory, shopping cart
- existing: working on existing codebase, optimization, bug fix
- chat: general question, not a build request
- quick: tiny task, single file change, simple fix

Respond ONLY with JSON: {"type": "...", "confidence": 0.0-1.0, "extractedGoal": "...", "suggestedName": "..."}

Request: {{INPUT}}`;
```

---

### Phase 2: Brief System

**Goal:** Template-driven brief generation with targeted questions

```
src/main/brief/
├── types.ts
├── templates/
│   ├── site.ts
│   ├── app.ts
│   ├── ecom.ts
│   ├── existing.ts
│   └── index.ts
├── brief-generator.ts
├── brief-agent.ts
├── brief-validator.ts
└── index.ts
```

**Brief Template Structure:**
```typescript
export interface BriefTemplate {
  type: ProjectType;
  sections: BriefSection[];
}

export interface BriefSection {
  id: string;
  title: string;
  fields: BriefField[];
}

export interface BriefField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean';
  required: boolean;
  options?: string[]; // for select/multiselect
  default?: string;
  inferFrom?: string; // can be inferred from initial input
  question: string; // what to ask user if not filled
}
```

**Example: ecom.ts template:**
```typescript
export const ECOM_TEMPLATE: BriefTemplate = {
  type: 'ecom',
  sections: [
    {
      id: 'brand',
      title: 'Brand Identity',
      fields: [
        { id: 'brand_name', label: 'Brand Name', type: 'text', required: true, question: 'What is your brand name?' },
        { id: 'tagline', label: 'Tagline', type: 'text', required: false, question: 'Do you have a tagline?' },
        { id: 'aesthetic', label: 'Visual Style', type: 'select', required: true, options: ['minimal', 'bold', 'luxury', 'streetwear', 'vintage'], question: 'What visual style fits your brand?' },
      ],
    },
    {
      id: 'products',
      title: 'Products',
      fields: [
        { id: 'product_types', label: 'Product Categories', type: 'multiselect', required: true, options: ['clothing', 'accessories', 'footwear', 'digital'], question: 'What types of products do you sell?' },
        { id: 'inventory_size', label: 'Inventory Size', type: 'select', required: true, options: ['small (<50)', 'medium (50-500)', 'large (500+)'], question: 'How many products do you have?' },
      ],
    },
    {
      id: 'payments',
      title: 'Payments & Shipping',
      fields: [
        { id: 'payment_provider', label: 'Payment Provider', type: 'select', required: true, options: ['stripe', 'shopify-payments', 'paypal'], question: 'Which payment provider do you want to use?' },
        { id: 'shipping_regions', label: 'Shipping Regions', type: 'multiselect', required: true, options: ['domestic', 'europe', 'worldwide'], question: 'Where do you ship to?' },
      ],
    },
  ],
};
```

**brief-agent.ts:**
```typescript
// Takes: partially filled brief (from initial input inference)
// Returns: array of questions for unfilled required fields
// Asks questions one at a time via IPC to renderer

export class BriefAgent {
  async fillBrief(template: BriefTemplate, initialInput: string): Promise<FilledBrief> {
    // 1. Use cheap Codex call to infer what we can from initial input
    const inferred = await this.inferFromInput(template, initialInput);

    // 2. Find unfilled required fields
    const missing = this.findMissingFields(template, inferred);

    // 3. Ask user for each missing field (via IPC)
    for (const field of missing) {
      const answer = await this.askUser(field);
      inferred[field.id] = answer;
    }

    return inferred;
  }
}
```

**brief-validator.ts (HARD RAIL):**
```typescript
export function validateBrief(template: BriefTemplate, brief: FilledBrief): ValidationResult {
  const errors: string[] = [];

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.required && !brief[field.id]) {
        errors.push(`Missing required field: ${field.label}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    canProceed: errors.length === 0, // HARD GATE - no proceeding with incomplete brief
  };
}
```

---

### Phase 3: Entry Router & Orchestration

**Goal:** Route user choice to correct flow

```
src/main/orchestration/
├── entry-router.ts
└── index.ts
```

**entry-router.ts:**
```typescript
export type EntryPath = 'build' | 'chat' | 'existing' | 'quick';

export async function routeEntry(
  path: EntryPath,
  input: string,
  context?: { projectPath?: string }
): Promise<void> {
  switch (path) {
    case 'build':
      // 1. Classify project type
      const classification = await classifyProject(input);

      // 2. Get capabilities from registry
      const capabilities = CAPABILITY_REGISTRY[classification.type];

      // 3. Check MCPs
      const missingMCPs = await checkMCPs(capabilities.mcps);
      if (missingMCPs.length > 0) {
        await promptMCPConnection(missingMCPs);
      }

      // 4. Load template and fill brief
      const template = getTemplate(classification.type);
      const brief = await briefAgent.fillBrief(template, input);

      // 5. Validate brief (HARD RAIL)
      const validation = validateBrief(template, brief);
      if (!validation.valid) {
        throw new BriefIncompleteError(validation.errors);
      }

      // 6. Send to Conductor for DAG generation
      const dag = await conductor.planFromBrief(brief, capabilities);

      // 7. Execute via Step Scheduler
      await scheduler.execute(dag);
      break;

    case 'chat':
      // Direct to ChatGPT BrowserView
      await showChatGPT();
      break;

    case 'existing':
      // Analysis first, then brief
      const analysis = await runCodebaseMapper(context.projectPath);
      const existingBrief = await briefAgent.fillBrief(EXISTING_TEMPLATE, input, analysis);
      // ... continue with validated brief
      break;

    case 'quick':
      // Single Codex call
      await runSingleCodex(input, context);
      break;
  }
}
```

---

### Phase 4: UI Components

**Goal:** Primary input interface

```
src/renderer/components/
├── PrimaryInput.tsx       # Main entry screen
├── ProjectTypeCard.tsx    # Card for each project type
├── BriefQuestionnaire.tsx # Q&A UI for brief filling
└── MCPConnectionPrompt.tsx # MCP connection modal
```

**PrimaryInput.tsx structure:**
```tsx
export function PrimaryInput() {
  const [mode, setMode] = useState<'select' | 'input' | 'brief'>('select');
  const [selectedPath, setSelectedPath] = useState<EntryPath | null>(null);

  return (
    <div className="primary-input">
      {mode === 'select' && (
        <div className="path-selector">
          <h1>What do you want to do?</h1>
          <div className="path-grid">
            <ProjectTypeCard
              icon="🏗️"
              title="Build Something"
              description="Create a new website, app, or store"
              onClick={() => { setSelectedPath('build'); setMode('input'); }}
            />
            <ProjectTypeCard
              icon="💬"
              title="Just Chat"
              description="Talk with ChatGPT directly"
              onClick={() => { setSelectedPath('chat'); routeEntry('chat', ''); }}
            />
            <ProjectTypeCard
              icon="📂"
              title="Open Project"
              description="Work on an existing codebase"
              onClick={() => { setSelectedPath('existing'); setMode('input'); }}
            />
            <ProjectTypeCard
              icon="⚡"
              title="Quick Task"
              description="Small fix or simple change"
              onClick={() => { setSelectedPath('quick'); setMode('input'); }}
            />
          </div>
        </div>
      )}

      {mode === 'input' && (
        <div className="intent-input">
          <h2>{getPromptForPath(selectedPath)}</h2>
          <textarea
            placeholder={getPlaceholderForPath(selectedPath)}
            onSubmit={(value) => handleSubmit(selectedPath, value)}
          />
        </div>
      )}

      {mode === 'brief' && (
        <BriefQuestionnaire
          template={currentTemplate}
          onComplete={(brief) => handleBriefComplete(brief)}
        />
      )}
    </div>
  );
}
```

---

### Phase 5: Conductor Refactor

**Goal:** Conductor receives complete brief, produces DAG

**Changes to `src/main/conductor.ts`:**

```typescript
// BEFORE: classify(message: string, context?: any): ExecutionPlan
// AFTER:  planFromBrief(brief: FilledBrief, capabilities: Capabilities): ExecutionPlan

export class Conductor {
  // REMOVE: classify() method
  // REMOVE: session management for classification

  // ADD: planFromBrief()
  async planFromBrief(brief: FilledBrief, capabilities: Capabilities): Promise<ExecutionPlan> {
    // Use Codex to generate DAG from complete brief
    // The brief has ALL the information, no guessing needed

    const prompt = this.buildPlanningPrompt(brief, capabilities);
    const plan = await this.codexSession.send(prompt);

    return this.parsePlan(plan);
  }

  private buildPlanningPrompt(brief: FilledBrief, capabilities: Capabilities): string {
    return `
You are planning a ${brief.type} project.

PROJECT BRIEF:
${JSON.stringify(brief, null, 2)}

AVAILABLE SKILLS: ${capabilities.skills.join(', ')}
CONNECTED MCPs: ${capabilities.mcps.join(', ')}
ESTIMATED STEPS: ${capabilities.estimatedSteps[0]}-${capabilities.estimatedSteps[1]}

Generate an execution plan as a DAG. Each step must specify:
- id: sequential number
- target: 'cli' | 'web' | 'service'
- action: what to do
- detail: specific instructions
- waitFor: array of step IDs that must complete first
- parallel: can this run in parallel with siblings?

Return ONLY valid JSON array of steps.
`;
  }
}
```

---

### Phase 6: IPC Wiring

**New IPC handlers to add to `src/main/index.ts`:**

```typescript
// Classification
ipcMain.handle('classification:classify', async (_event, input: string) => {
  return classifyProject(input);
});

ipcMain.handle('classification:get-capabilities', async (_event, type: ProjectType) => {
  return CAPABILITY_REGISTRY[type];
});

// Brief
ipcMain.handle('brief:get-template', async (_event, type: ProjectType) => {
  return getTemplate(type);
});

ipcMain.handle('brief:infer-fields', async (_event, template: BriefTemplate, input: string) => {
  return briefAgent.inferFromInput(template, input);
});

ipcMain.handle('brief:validate', async (_event, template: BriefTemplate, brief: FilledBrief) => {
  return validateBrief(template, brief);
});

// Entry routing
ipcMain.handle('entry:route', async (_event, path: EntryPath, input: string, context?: any) => {
  return routeEntry(path, input, context);
});

// MCP checking
ipcMain.handle('mcp:check-required', async (_event, required: string[]) => {
  const manager = getMCPManager();
  return required.filter(mcp => !manager.isConnected(mcp));
});
```

---

## Migration Strategy

### Step 1: Build New (Don't Break Old)
- Create all new files in `classification/`, `brief/`, `orchestration/`
- Add new IPC handlers alongside existing ones
- Build new UI components

### Step 2: Feature Flag
```typescript
const USE_NEW_FLOW = process.env.NEW_FLOW === 'true';

// In App.tsx
{USE_NEW_FLOW ? <PrimaryInput /> : <ProfilePicker />}
```

### Step 3: Test New Flow Independently
- Test classification accuracy
- Test brief filling
- Test DAG generation from brief
- Test full flow end-to-end

### Step 4: Switch Default
- Change `USE_NEW_FLOW` default to `true`
- Keep old flow accessible via flag

### Step 5: Deprecate Old
- Remove send-interceptor from build flow
- Remove fast-path
- Archive old intake system

---

## What Stays Unchanged

| Component | Status | Notes |
|-----------|--------|-------|
| `src/enforcement/*` | UNCHANGED | Hard rails work perfectly |
| `src/main/step-scheduler.ts` | UNCHANGED | Receives DAG, executes it |
| `src/main/executors/*` | UNCHANGED | CLI, Web, Service executors |
| `src/status-agent/*` | UNCHANGED | Event translation |
| `src/main/events.ts` | UNCHANGED | Event bus |
| `src/main/mcp/*` | MINOR CHANGE | Add `checkRequired()` method |
| `src/main/analytics/*` | UNCHANGED | Tracking works |
| `src/main/failure/*` | UNCHANGED | Progress saving works |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Classification accuracy | Medium | High | Extensive prompt engineering, fallback to manual selection |
| Brief templates incomplete | Low | Medium | Add fields as discovered, templates are easy to update |
| User confusion at new UI | Medium | Medium | Clear copy, progressive disclosure |
| Codex rate limits during brief | Low | Low | Brief questions are cheap (~200 tokens each) |
| Migration breaks existing | Low | High | Feature flag, parallel flows |

---

## Success Metrics

1. **User completes brief in < 2 minutes** (vs current: undefined intake time)
2. **Classification accuracy > 90%** (measured by user corrections)
3. **DAG quality equal or better** (measured by execution success rate)
4. **Zero interceptor failures** (because we don't intercept anymore)
5. **MCP connection rate up** (because we prompt at the right time)

---

## Timeline Estimate

| Phase | Work | Duration |
|-------|------|----------|
| Phase 1: Classification | Registry + Classifier | 2-3 hours |
| Phase 2: Brief System | Templates + Agent + Validator | 3-4 hours |
| Phase 3: Entry Router | Orchestration logic | 1-2 hours |
| Phase 4: UI Components | React components | 3-4 hours |
| Phase 5: Conductor Refactor | planFromBrief() | 1-2 hours |
| Phase 6: IPC Wiring | Handlers + integration | 1-2 hours |
| Testing & Polish | End-to-end testing | 2-3 hours |

**Total: ~15-20 hours of implementation**

---

## Appendix: File Tree After Refactor

```
src/
├── main/
│   ├── classification/          # NEW
│   │   ├── types.ts
│   │   ├── capability-registry.ts
│   │   ├── project-classifier.ts
│   │   └── index.ts
│   │
│   ├── brief/                   # NEW
│   │   ├── types.ts
│   │   ├── templates/
│   │   │   ├── site.ts
│   │   │   ├── app.ts
│   │   │   ├── ecom.ts
│   │   │   ├── existing.ts
│   │   │   └── index.ts
│   │   ├── brief-generator.ts
│   │   ├── brief-agent.ts
│   │   ├── brief-validator.ts
│   │   └── index.ts
│   │
│   ├── orchestration/           # NEW
│   │   ├── entry-router.ts
│   │   └── index.ts
│   │
│   ├── conductor.ts             # MODIFIED (planFromBrief)
│   ├── index.ts                 # MODIFIED (new IPC handlers)
│   │
│   ├── send-interceptor.ts      # DEPRECATED (not wired for builds)
│   ├── fast-path.ts             # DEPRECATED (not wired)
│   │
│   └── ... (unchanged files)
│
├── renderer/
│   ├── components/
│   │   ├── PrimaryInput.tsx     # NEW
│   │   ├── ProjectTypeCard.tsx  # NEW
│   │   ├── BriefQuestionnaire.tsx # NEW
│   │   ├── MCPConnectionPrompt.tsx # NEW
│   │   ├── App.tsx              # MODIFIED
│   │   └── ... (unchanged)
│   └── ...
│
├── intake/                      # DEPRECATED (not wired)
│   └── ...
│
└── skills/
    └── kenoki.md                # NEW (self-describing skill)
```

---

## Next Steps

1. **Review this plan** - Confirm architecture makes sense
2. **Start Phase 1** - Build classification layer first (foundation)
3. **Test in isolation** - Each phase can be tested independently
4. **Feature flag integration** - New flow lives alongside old until validated
5. **Gradual migration** - Switch users to new flow once tested
