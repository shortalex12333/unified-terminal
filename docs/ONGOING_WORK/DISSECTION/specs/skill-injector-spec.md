# Skill Injector Specification

## 1. Purpose

The Skill Injector reads a step mandate from the execution plan and matches keywords against `trigger-map.json` to load exactly ONE skill into the worker agent's prompt. This enables workers to receive domain-specific instructions without requiring LLM calls for skill selection.

**Core Responsibilities:**
- Parse step mandate text into searchable tokens
- Score each skill based on trigger keyword matches
- Select the single best-matching skill
- Inject skill content into the worker's system prompt

**Design Principle:** Fast, deterministic, zero-LLM overhead skill routing.

---

## 2. Matching Algorithm

### 2.1 Tokenization

```typescript
function tokenize(mandate: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
    'by', 'from', 'as', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if',
    'or', 'because', 'until', 'while', 'this', 'that', 'these',
    'those', 'it', 'its'
  ]);

  return mandate
    .toLowerCase()
    .split(/[\s,;:.()\[\]{}]+/)       // Split on whitespace and punctuation
    .filter(token => token.length > 1) // Remove single chars
    .filter(token => !stopwords.has(token));
}
```

### 2.2 Scoring

For each skill in `trigger-map.json`, count how many of its triggers appear in the tokenized mandate:

```typescript
interface SkillScore {
  skillId: string;
  matches: number;
  totalTriggers: number;
  score: number;  // matches / totalTriggers (precision-based)
}

function scoreSkill(skillId: string, triggers: string[], tokens: string[]): SkillScore {
  const tokenSet = new Set(tokens);

  // Also check for multi-word triggers as substrings in original mandate
  let matches = 0;
  for (const trigger of triggers) {
    if (trigger.includes(' ')) {
      // Multi-word trigger: check if present in original mandate
      if (mandate.toLowerCase().includes(trigger.toLowerCase())) {
        matches++;
      }
    } else {
      // Single-word trigger: check token set
      if (tokenSet.has(trigger.toLowerCase())) {
        matches++;
      }
    }
  }

  return {
    skillId,
    matches,
    totalTriggers: triggers.length,
    score: triggers.length > 0 ? matches / triggers.length : 0
  };
}
```

### 2.3 Selection Rules

1. **Threshold Check:** Score must be > 0.2 or no skill is loaded
2. **Best Match Wins:** Highest score takes priority
3. **Tie Resolution:** If 2+ skills have equal scores:
   - Prefer the skill with fewer total triggers (more specific)
   - If still tied, use trigger-map.json order (first declared wins)

```typescript
function selectBestSkill(scores: SkillScore[]): SkillScore | null {
  const THRESHOLD = 0.2;

  // Filter to candidates above threshold
  const candidates = scores.filter(s => s.score > THRESHOLD);

  if (candidates.length === 0) {
    return null;
  }

  // Sort by score DESC, then by totalTriggers ASC (more specific wins)
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;  // Higher score first
    }
    return a.totalTriggers - b.totalTriggers;  // Fewer triggers (more specific) first
  });

  return candidates[0];
}
```

---

## 3. Special Cases

### 3.1 Frontend Skill Enhancement

When the `frontend-design` skill is matched AND no design system exists in the project, enhance the skill with BM25 search results from the design CSV data:

```typescript
async function enhanceFrontendSkill(
  skillContent: string,
  projectPath: string
): Promise<string> {
  // Check if design system exists
  const hasDesignSystem = await checkForDesignSystem(projectPath);

  if (hasDesignSystem) {
    return skillContent;  // No enhancement needed
  }

  // Run BM25 search against design CSV with default query
  const defaultQuery = "SaaS premium minimal clean apple whitespace";
  const csvPath = "skills/frontend-design/design-references.csv";

  const searchResults = await bm25Search(csvPath, defaultQuery, { topK: 5 });

  // Append search results to skill content
  return skillContent + `

## Design Reference Data (BM25 Search Results)

Query: "${defaultQuery}"

${searchResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}
`;
}

function checkForDesignSystem(projectPath: string): boolean {
  // Look for common design system indicators
  const indicators = [
    'design-system/',
    'design-tokens.json',
    'theme.config.ts',
    'tailwind.config.ts',
    'styles/tokens/',
    '.storybook/'
  ];

  return indicators.some(indicator =>
    fs.existsSync(path.join(projectPath, indicator))
  );
}
```

### 3.2 Multiple Equal Matches

When 2+ skills have exactly the same score AND the same trigger count:

1. Check `routing_rules` in trigger-map.json for context-based preferences
2. If routing rule applies (e.g., "investigate" prefers "gsd-debugger" in error context), use it
3. Otherwise, use trigger-map.json declaration order (skills.keys() iteration order)

```typescript
function resolveEqualScores(
  candidates: SkillScore[],
  mandate: string,
  triggerMap: TriggerMap
): SkillScore {
  // Check routing rules
  for (const [keyword, rule] of Object.entries(triggerMap.routing_rules)) {
    if (mandate.toLowerCase().includes(keyword)) {
      const preferred = candidates.find(c => c.skillId === rule.prefer);
      if (preferred) {
        return preferred;
      }
    }
  }

  // Fall back to declaration order
  const skillOrder = Object.keys(triggerMap.skills);
  candidates.sort((a, b) =>
    skillOrder.indexOf(a.skillId) - skillOrder.indexOf(b.skillId)
  );

  return candidates[0];
}
```

### 3.3 Skill Type Filtering

Only `worker` and `frontend` skill types are eligible for injection:

```typescript
const INJECTABLE_TYPES = new Set(['worker', 'frontend', 'verification']);

function filterInjectableSkills(triggerMap: TriggerMap): Map<string, Skill> {
  const injectable = new Map();

  for (const [skillId, skill] of Object.entries(triggerMap.skills)) {
    if (INJECTABLE_TYPES.has(skill.skill_type)) {
      injectable.set(skillId, skill);
    }
  }

  return injectable;
}
```

Phase, template, and internal skill types are NOT injected into workers.

---

## 4. Output Format

The Skill Injector returns an `AgentConfig` with the matched skill content appended:

```typescript
interface AgentConfig {
  prompt: string;           // Base worker prompt + skill content
  runtime: string;          // From matched skill (e.g., 'codex', 'sonnet')
  skillId: string | null;   // ID of injected skill, or null if none
  skillPath: string | null; // File path of skill, or null if none
}

function buildAgentConfig(
  baseWorkerPrompt: string,
  matchedSkill: Skill | null,
  skillContent: string | null
): AgentConfig {
  if (!matchedSkill || !skillContent) {
    return {
      prompt: baseWorkerPrompt,
      runtime: 'default',
      skillId: null,
      skillPath: null
    };
  }

  const enhancedPrompt = `${baseWorkerPrompt}

## Skill Pre-Load

${skillContent}`;

  return {
    prompt: enhancedPrompt,
    runtime: matchedSkill.runtime,
    skillId: matchedSkill.id,
    skillPath: matchedSkill.path
  };
}
```

**Prompt Structure:**
```
[Base Worker Prompt]

## Skill Pre-Load

[Full content of matched skill markdown file]
```

---

## 5. Performance Target

| Metric | Target | Notes |
|--------|--------|-------|
| Total matching time | < 50ms | Including tokenization, scoring, selection |
| LLM calls | 0 | All logic is deterministic |
| Memory overhead | < 1MB | Trigger map cached in memory |
| Skill file read | < 10ms | Async file read, cached if repeated |

**Performance Optimizations:**
- Load and cache `trigger-map.json` on module initialization
- Pre-compute lowercase trigger sets for each skill
- Use Set for O(1) token lookups
- Cache skill file contents after first read

```typescript
// Module-level cache
let triggerMapCache: TriggerMap | null = null;
let skillContentCache: Map<string, string> = new Map();

async function getTriggerMap(): Promise<TriggerMap> {
  if (!triggerMapCache) {
    const content = await fs.promises.readFile(TRIGGER_MAP_PATH, 'utf-8');
    triggerMapCache = JSON.parse(content);
  }
  return triggerMapCache;
}

async function getSkillContent(skillPath: string): Promise<string> {
  if (!skillContentCache.has(skillPath)) {
    const content = await fs.promises.readFile(skillPath, 'utf-8');
    skillContentCache.set(skillPath, content);
  }
  return skillContentCache.get(skillPath)!;
}
```

---

## 6. Consumer

**Primary Consumer:** `step-scheduler.ts`

The Step Scheduler calls the Skill Injector before spawning each worker agent:

```typescript
// In step-scheduler.ts, before spawning a worker

import { injectSkill } from './skill-injector';

async function spawnWorker(step: RuntimeStep, context: Record<string, any>): Promise<void> {
  // Get step mandate (the "detail" field contains the work description)
  const mandate = step.detail;

  // Inject appropriate skill
  const agentConfig = await injectSkill(mandate, {
    projectPath: context.projectPath,
    basePrompt: DEFAULT_WORKER_PROMPT
  });

  // Spawn worker with enhanced prompt
  const worker = await spawnAgent({
    prompt: agentConfig.prompt,
    runtime: agentConfig.runtime,
    step: step,
    context: context
  });

  // Log skill injection for debugging
  if (agentConfig.skillId) {
    console.log(`[SkillInjector] Loaded skill: ${agentConfig.skillId}`);
  } else {
    console.log(`[SkillInjector] No skill matched for mandate: "${mandate.slice(0, 50)}..."`);
  }
}
```

**Integration Points:**
1. `step-scheduler.ts` - Primary consumer, calls before each worker spawn
2. `conductor.ts` - May query skill matches for plan validation
3. `fast-path.ts` - Does NOT use skill injection (trivial messages bypass)

---

## 7. API Surface

```typescript
/**
 * Main entry point for skill injection.
 *
 * @param mandate - The step description/work mandate
 * @param options - Configuration options
 * @returns AgentConfig with enhanced prompt
 */
export async function injectSkill(
  mandate: string,
  options: {
    projectPath?: string;
    basePrompt: string;
  }
): Promise<AgentConfig>;

/**
 * Get all matching skills with scores (for debugging/testing).
 *
 * @param mandate - The step description
 * @returns Array of scored skills
 */
export function getSkillScores(mandate: string): SkillScore[];

/**
 * Clear caches (for testing or hot-reload).
 */
export function clearCaches(): void;
```

---

## 8. Error Handling

| Error Case | Behavior |
|------------|----------|
| trigger-map.json missing | Return base prompt, log warning |
| Skill file missing | Return base prompt, log error |
| Malformed trigger-map.json | Throw on initialization |
| Empty mandate | Return base prompt (no skill) |
| All scores below threshold | Return base prompt (no skill) |

---

## 9. Testing Requirements

```typescript
describe('SkillInjector', () => {
  describe('tokenization', () => {
    it('removes stopwords');
    it('lowercases all tokens');
    it('splits on punctuation');
    it('handles empty mandate');
  });

  describe('scoring', () => {
    it('matches single-word triggers');
    it('matches multi-word triggers as substrings');
    it('calculates precision-based score');
    it('returns 0 for no matches');
  });

  describe('selection', () => {
    it('selects highest score');
    it('enforces 0.2 threshold');
    it('prefers fewer triggers on tie');
    it('uses declaration order as final tiebreaker');
    it('applies routing_rules for context');
  });

  describe('frontend enhancement', () => {
    it('skips BM25 if design system exists');
    it('runs BM25 with default query if no design system');
    it('appends results to skill content');
  });

  describe('performance', () => {
    it('completes in under 50ms');
    it('caches trigger map');
    it('caches skill content');
  });
});
```

---

## 10. File Locations

| File | Purpose |
|------|---------|
| `docs/ONGOING_WORK/DISSECTION/specs/trigger-map.json` | Skill definitions and triggers |
| `skills/workers/*.md` | Worker skill content files |
| `skills/frontend-design/SKILL.md` | Frontend design skill |
| `skills/frontend-design/design-references.csv` | BM25 search corpus |
| `src/main/skill-injector.ts` | Implementation (to be created) |
| `tests/skill-injector.test.ts` | Test suite (to be created) |
