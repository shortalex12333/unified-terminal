# PRODUCT STRATEGY: THE INVISIBLE MACHINE
## Everything the user never sees, but always benefits from

---

## WHO WE ARE BUILDING FOR

**Our user:** Sarah, 34. Pays $20/mo for ChatGPT Plus. Uses it daily for work emails, brainstorming, research. Has heard about "AI agents" and "vibe coding" on TikTok. Downloaded Cursor once, saw a terminal, closed it. Would love to have AI build her entire Shopify alternative but doesn't know where to start. Thinks "MCP" is a Marvel character.

**Our user is NOT:** A developer. Not someone who reads Hacker News. Not someone who knows what npm is. Not someone who will ever open a terminal voluntarily.

**The market reality:** There are ~200M ChatGPT users. Maybe 2-5M use CLI tools like Codex or Claude Code. We are building for the other 195M.

---

## PART 1: DOCKER — ALWAYS-ON SELF-TESTING DEPLOY PIPELINE

### Why Docker
Every project our app generates should be immediately runnable. No "now open terminal and type npm run dev." The user clicks "Preview" and sees their site. Docker makes this possible without asking the user to install Node.js dev servers, Python servers, or anything else project-specific.

### Architecture
```
User's Mac
├── Our Electron App
│   ├── BrowserView (ChatGPT)
│   ├── Overlay UI
│   └── Orchestration Engine
├── Docker Desktop (auto-installed)
│   ├── Project Container (per project)
│   │   ├── Node.js + dependencies
│   │   ├── Dev server (localhost:3000)
│   │   ├── Hot reload (file changes → instant update)
│   │   └── Health check (is the app running? any errors?)
│   └── Test Runner Container
│       ├── Playwright (visual regression)
│       ├── Lighthouse (performance score)
│       └── Accessibility checker
└── ~/Documents/our_brand_name/
    └── [project-name]/
        ├── src/ (generated code)
        ├── Dockerfile (auto-generated)
        └── docker-compose.yml (auto-generated)
```

### Self-Test Pipeline
After every code generation phase, automatically:
1. Build the Docker container
2. Start the dev server
3. Run health check (does it load? any console errors?)
4. Run Lighthouse (performance score)
5. Take screenshot (for progress UI)
6. If errors found → feed errors back to LLM → auto-fix → re-test
7. If passes → show preview to user with "Your site is ready" + screenshot

### User sees:
```
✓ Building your project...
✓ Testing everything works...
✓ Your site is ready!          [Preview] [Deploy]

Performance: 94/100
Mobile Ready: Yes
Load Time: 1.2s
```

### User NEVER sees:
- Docker
- Container logs
- Build errors (we fix them automatically)
- Port numbers
- localhost anything

### Implementation for Claude Code overnight build:

**File: `src/main/docker-manager.ts`**
- Detect Docker Desktop installation (or install it in the auto-installer)
- Generate Dockerfile per project type (Next.js, Python Flask, static HTML)
- Build and start containers
- Health check via HTTP ping to localhost
- Screenshot via Playwright in test container
- Stop containers when user closes project
- Clean up old containers on app launch

**File: `src/main/self-tester.ts`**
- After every GSD phase completion, trigger test pipeline
- Parse test results into user-friendly summary
- If tests fail: extract error, send to LLM, get fix, apply, re-test (max 3 attempts)
- If tests pass: capture screenshot, update progress UI

**File: `src/main/deploy-manager.ts`**
- "Deploy" button in overlay
- Connect to Vercel via MCP (user's Vercel account)
- Push to GitHub via MCP (user's GitHub account)
- Vercel auto-deploys from GitHub
- Show live URL when deployed
- User sees: "Your site is live at yourproject.vercel.app"

### Docker in Auto-Installer (add to Gate 5):
```bash
# Detection:
docker --version 2>/dev/null
# Install Docker Desktop:
brew install --cask docker
# Start Docker Desktop:
open -a Docker
# Wait for Docker daemon:
while ! docker info &>/dev/null; do sleep 2; done
# Timeout: 60 seconds (Docker Desktop takes a while to start first time)
```

---

## PART 2: THE FIRST PROMPT — INTAKE ROUTING

### The Problem
User types something. We need to figure out EXACTLY what they want, which tools to use, what files they might have, what output they expect, and what "done" looks like. And we need to do this without asking technical questions.

### The Intake Decision Tree

```
User message arrives
│
├─ Is this a CONTINUATION of an existing project?
│  └─ Yes → Load project state, skip intake, resume where we left off
│
├─ Is this a SIMPLE question (no project needed)?
│  └─ Yes → Let ChatGPT handle it directly, no orchestration
│  Examples: "what's the capital of France", "explain quantum computing"
│
├─ Is this a TASK that needs execution?
│  └─ Yes → Run intake quiz
│  Examples: "build me a website", "research the market for X"
│
└─ Is this AMBIGUOUS?
   └─ Yes → Ask ONE clarifying question, then decide
   Example: "help me with my business" → "What would be most helpful right now — a website, market research, a business plan, or something else?"
```

### The Meta-Prompt (Version 2 — improved from current)

```
SYSTEM PROMPT (injected before user's first project message):

You are a friendly project assistant. The user wants help with something.
Your job is to understand exactly what they need by asking a few quick questions.

RULES:
1. Ask exactly 3-4 questions. No more.
2. Use language a 10-year-old would understand. No jargon.
3. Never ask about technology, frameworks, databases, or hosting.
4. Always ask: "Who is this for?" and "Do you have anything to start with?"
5. If they mention a business: ask about their customer and what makes them different.
6. If they mention a website/app: ask what they want it to look and feel like (reference real sites).
7. If they mention research: ask what decision they're trying to make with the research.
8. End with: "Got it! I'll get started. Skip any questions you're not sure about."

The user said: "{USER_MESSAGE}"

{IF USER_HAS_UPLOADED_FILES}
The user has also uploaded these files: {FILE_LIST_WITH_TYPES}
Consider these files when asking questions. For example, if they uploaded a logo, don't ask about branding. If they uploaded a document, ask if they want to incorporate its content.
{/IF}

After the user answers (or skips), output a structured brief in this EXACT format between markers:

===BRIEF_START===
{
  "project_name": "short-name-no-spaces",
  "summary": "One sentence describing the project",
  "type": "website|app|research|document|automation|design",
  "audience": "who this is for",
  "requirements": ["list", "of", "things", "to", "build"],
  "style": "reference sites or aesthetics mentioned",
  "uploaded_files": ["what files they provided and how to use them"],
  "constraints": ["any limitations mentioned"],
  "needs_images": true/false,
  "needs_web_search": true/false,
  "needs_code": true/false,
  "needs_deploy": true/false,
  "complexity": "simple|medium|complex"
}
===BRIEF_END===
```

### Routing from Brief

```typescript
// src/intake/route-from-brief.ts

interface ExecutionPlan {
  primary: 'browser' | 'cli' | 'hybrid';
  tools: string[];           // Which CLI tools to use
  webFeatures: string[];     // Which ChatGPT web features to use
  mcpServers: string[];      // Which MCP servers to activate
  estimatedTokens: number;   // Rough estimate
  estimatedTime: string;     // "5 minutes" | "30 minutes" | "2 hours"
  phases: Phase[];           // Ordered execution phases
}

function planExecution(brief: ProjectBrief): ExecutionPlan {
  const plan: ExecutionPlan = {
    primary: 'hybrid',
    tools: [],
    webFeatures: [],
    mcpServers: [],
    estimatedTokens: 0,
    estimatedTime: '',
    phases: [],
  };

  // CODE PROJECTS (websites, apps, scripts)
  if (brief.needs_code) {
    plan.tools.push('codex');       // Primary code generator
    plan.mcpServers.push('github'); // Push code
    plan.mcpServers.push('filesystem');

    if (brief.needs_deploy) {
      plan.mcpServers.push('vercel');
    }

    if (brief.complexity === 'complex') {
      plan.tools.push('gsd');       // Full project lifecycle
      plan.estimatedTokens = 50000;
      plan.estimatedTime = '1-2 hours';
    } else {
      plan.estimatedTokens = 15000;
      plan.estimatedTime = '15-30 minutes';
    }
  }

  // RESEARCH TASKS
  if (brief.needs_web_search) {
    plan.webFeatures.push('web-search');
    plan.primary = brief.needs_code ? 'hybrid' : 'browser';
    plan.estimatedTokens += 10000;
  }

  // IMAGE GENERATION
  if (brief.needs_images) {
    plan.webFeatures.push('dall-e');
    // Images can ONLY be generated via ChatGPT's web interface
    // Cannot be done via CLI
  }

  // DATABASE PROJECTS
  if (brief.requirements.some(r => /auth|login|user|account/i.test(r))) {
    plan.mcpServers.push('supabase');
  }

  // PAYMENT PROJECTS
  if (brief.requirements.some(r => /payment|checkout|buy|sell|ecom/i.test(r))) {
    plan.mcpServers.push('stripe');
  }

  // Build phases
  plan.phases = buildPhases(brief, plan);

  return plan;
}
```

---

## PART 3: WEB-ONLY FEATURES — SKILLS THE CLI CAN'T DO

Some things can ONLY happen through the ChatGPT browser window. These are "web skills" — capabilities our app triggers by sending specific prompts to ChatGPT while the user watches.

### Web-Only Feature Map

| Feature | Trigger | How We Use It |
|---------|---------|---------------|
| DALL-E Image Generation | "Generate an image of..." | Logos, hero images, product mockups, social media graphics |
| Web Search | "Search the web for..." | Market research, competitor analysis, current pricing, trends |
| Code Interpreter | "Analyze this data..." | CSV processing, chart generation, data visualization |
| Canvas | "Open in Canvas..." | Long-form document editing, collaborative refinement |
| GPT-4 Vision | User uploads image | Analyze mockups, read documents, extract text from photos |

### When to Trigger Web Features

```typescript
// src/main/web-feature-router.ts

interface WebFeatureDecision {
  feature: string;
  prompt: string;
  afterPhase: string;  // Which GSD/execution phase triggers this
}

function detectWebFeatures(brief: ProjectBrief, currentPhase: string): WebFeatureDecision[] {
  const decisions: WebFeatureDecision[] = [];

  // IMAGE GENERATION
  // Trigger after design phase, before code generation
  if (brief.needs_images) {
    if (brief.type === 'website') {
      decisions.push({
        feature: 'dall-e',
        prompt: `Generate a hero image for a ${brief.summary}. Style: modern, professional, ${brief.style || 'clean and minimal'}. The image should work as a website hero banner at 1920x1080.`,
        afterPhase: 'design',
      });
    }
    if (brief.requirements.some(r => /logo/i.test(r))) {
      decisions.push({
        feature: 'dall-e',
        prompt: `Design a logo for "${brief.project_name}". ${brief.audience ? `Target audience: ${brief.audience}.` : ''} Style: ${brief.style || 'modern, clean, memorable'}. Create a simple icon-based logo suitable for web and print.`,
        afterPhase: 'design',
      });
    }
  }

  // WEB SEARCH
  // Trigger during research phase
  if (brief.needs_web_search) {
    decisions.push({
      feature: 'web-search',
      prompt: `Research the current market for ${brief.summary}. Find: top 5 competitors, pricing ranges, market size, recent trends. Focus on actionable data.`,
      afterPhase: 'research',
    });
  }

  return decisions;
}
```

### Image Download Pipeline
When DALL-E generates an image in ChatGPT:
1. DOM capture detects image element in response
2. Extract image URL from `<img>` tag
3. Download image to project folder: `~/Documents/our_brand_name/[project]/assets/`
4. Pass file path to code generator: "Use this image at assets/hero.png for the hero section"
5. Code generator references the local file

```typescript
// src/main/image-capture.ts
async function captureGeneratedImages(chatView: BrowserView, projectDir: string): Promise<string[]> {
  const images = await chatView.webContents.executeJavaScript(`
    (() => {
      const imgs = document.querySelectorAll('div[data-message-author-role="assistant"] img');
      const lastResponseImgs = Array.from(imgs).slice(-5); // Last 5 images
      return lastResponseImgs
        .filter(img => img.src.includes('oaidalleapiprodscus') || img.src.includes('dalle'))
        .map(img => img.src);
    })()
  `);

  const downloaded: string[] = [];
  for (const [i, url] of images.entries()) {
    const filename = `generated-${Date.now()}-${i}.png`;
    const filepath = path.join(projectDir, 'assets', filename);
    await downloadFile(url, filepath);
    downloaded.push(filepath);
  }
  return downloaded;
}
```

---

## PART 4: DOCUMENT CROSS-CHECKING SYSTEM

### The Problem
Users upload files. We need to understand what they uploaded, why, and how to use it in their project. A logo should go into the design. A spreadsheet might be product data. A PDF might be a business plan to reference.

### File Type Intelligence

```typescript
// src/intake/file-analyzer.ts

interface FileAnalysis {
  path: string;
  type: string;
  category: 'image' | 'document' | 'data' | 'code' | 'media' | 'archive' | 'unknown';
  suggestedUse: string;      // How to use in the project
  shouldInjectIntoPrompt: boolean;  // Should we tell the LLM about this?
  extractedContent?: string;  // Text content if readable
}

const FILE_INTELLIGENCE: Record<string, { category: string; use: string }> = {
  // Images
  '.png':  { category: 'image', use: 'Use as visual asset (logo, hero image, product photo)' },
  '.jpg':  { category: 'image', use: 'Use as visual asset' },
  '.jpeg': { category: 'image', use: 'Use as visual asset' },
  '.svg':  { category: 'image', use: 'Use as scalable graphic (logo, icon)' },
  '.gif':  { category: 'image', use: 'Use as animated element' },
  '.webp': { category: 'image', use: 'Use as optimized web image' },
  '.ico':  { category: 'image', use: 'Use as favicon' },
  '.psd':  { category: 'image', use: 'Photoshop source file — extract layers if needed' },
  '.fig':  { category: 'image', use: 'Figma export — use as design reference' },
  '.sketch': { category: 'image', use: 'Sketch file — use as design reference' },

  // Documents
  '.pdf':  { category: 'document', use: 'Extract text content, use as reference material' },
  '.docx': { category: 'document', use: 'Extract text content, use as project brief or copy' },
  '.doc':  { category: 'document', use: 'Extract text content' },
  '.txt':  { category: 'document', use: 'Use as text content directly' },
  '.md':   { category: 'document', use: 'Use as structured content' },
  '.rtf':  { category: 'document', use: 'Extract text content' },

  // Data
  '.csv':  { category: 'data', use: 'Use as data source (product list, contacts, inventory)' },
  '.xlsx': { category: 'data', use: 'Use as structured data source' },
  '.xls':  { category: 'data', use: 'Use as structured data source' },
  '.json': { category: 'data', use: 'Use as configuration or data source' },
  '.xml':  { category: 'data', use: 'Use as structured data source' },

  // Code
  '.html': { category: 'code', use: 'Use as template or reference for structure' },
  '.css':  { category: 'code', use: 'Use as style reference' },
  '.js':   { category: 'code', use: 'Use as code reference or dependency' },
  '.ts':   { category: 'code', use: 'Use as code reference' },
  '.py':   { category: 'code', use: 'Use as script reference' },

  // Media
  '.mp4':  { category: 'media', use: 'Use as video asset on site' },
  '.mp3':  { category: 'media', use: 'Use as audio asset' },
  '.wav':  { category: 'media', use: 'Use as audio asset' },

  // Archives
  '.zip':  { category: 'archive', use: 'Extract and use contents' },
  '.rar':  { category: 'archive', use: 'Extract and use contents' },
};

async function analyzeFile(filepath: string): Promise<FileAnalysis> {
  const ext = path.extname(filepath).toLowerCase();
  const intel = FILE_INTELLIGENCE[ext] || { category: 'unknown', use: 'Ask user how to use this file' };

  const analysis: FileAnalysis = {
    path: filepath,
    type: ext,
    category: intel.category as any,
    suggestedUse: intel.use,
    shouldInjectIntoPrompt: true,
    extractedContent: undefined,
  };

  // Extract content from readable files
  if (['document', 'data', 'code'].includes(intel.category)) {
    try {
      if (ext === '.pdf') {
        // Use pdf-parse or similar
        analysis.extractedContent = await extractPDFText(filepath);
      } else if (ext === '.docx') {
        // Use mammoth or similar
        analysis.extractedContent = await extractDocxText(filepath);
      } else if (ext === '.csv' || ext === '.txt' || ext === '.md' || ext === '.json') {
        analysis.extractedContent = fs.readFileSync(filepath, 'utf-8').slice(0, 5000); // First 5K chars
      } else if (ext === '.xlsx') {
        analysis.extractedContent = await extractXlsxText(filepath);
      }
    } catch {
      // If extraction fails, just note the file exists
    }
  }

  // Images: don't extract content, but note dimensions
  if (intel.category === 'image') {
    try {
      const dimensions = await getImageDimensions(filepath);
      analysis.suggestedUse += ` (${dimensions.width}x${dimensions.height})`;
    } catch {}
  }

  return analysis;
}

// Inject file context into the intake prompt
function buildFileContext(analyses: FileAnalysis[]): string {
  if (analyses.length === 0) return '';

  let context = '\n\nThe user uploaded these files:\n';
  for (const file of analyses) {
    context += `- ${path.basename(file.path)} (${file.category}): ${file.suggestedUse}\n`;
    if (file.extractedContent) {
      context += `  Content preview: "${file.extractedContent.slice(0, 200)}..."\n`;
    }
  }
  context += '\nConsider these files when planning the project. Use them where appropriate.\n';
  return context;
}
```

---

## PART 5: RATE LIMIT DETECTION + AUTO-CONTINUE

### The Problem
ChatGPT has message limits. When users hit them, ChatGPT shows a "You've reached the limit" message. Our orchestration must detect this, wait, and automatically continue when the limit resets.

### Rate Limit Detection

```typescript
// src/main/rate-limiter.ts

interface RateLimitState {
  isLimited: boolean;
  detectedAt: number;
  estimatedResetAt: number;    // When we think the limit resets
  retryCount: number;
  lastMessage: string;         // The message that triggered the limit
}

// Regex patterns for rate limit detection in ChatGPT DOM
const RATE_LIMIT_PATTERNS = [
  /you[''']ve reached (the|your) (message |usage )?limit/i,
  /rate limit/i,
  /too many (messages|requests)/i,
  /please try again (in |after )/i,
  /usage cap/i,
  /come back (in |after |at )/i,
  /limit (reached|exceeded|hit)/i,
  /wait.*?(\d+)\s*(minute|hour|second)/i,
  /try again.*?(\d+:\d+)/i,
  /you can send.*?more message/i,
];

// Extract wait time from rate limit message
const WAIT_TIME_PATTERNS = [
  { regex: /(\d+)\s*minute/i, multiplier: 60 * 1000 },
  { regex: /(\d+)\s*hour/i, multiplier: 60 * 60 * 1000 },
  { regex: /(\d+)\s*second/i, multiplier: 1000 },
  { regex: /(\d+):(\d+)\s*(AM|PM)/i, parser: 'time' },  // "try again at 3:45 PM"
];

class RateLimitMonitor {
  private state: RateLimitState | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private chatView: BrowserView,
    private onLimited: (state: RateLimitState) => void,
    private onResumed: () => void,
  ) {}

  startMonitoring(): void {
    // Check the DOM every 5 seconds for rate limit messages
    this.checkInterval = setInterval(async () => {
      const pageText = await this.chatView.webContents.executeJavaScript(`
        document.body.innerText.slice(-2000)
      `);

      const isLimited = RATE_LIMIT_PATTERNS.some(p => p.test(pageText));

      if (isLimited && !this.state?.isLimited) {
        // Just hit rate limit
        const waitMs = this.extractWaitTime(pageText);
        this.state = {
          isLimited: true,
          detectedAt: Date.now(),
          estimatedResetAt: Date.now() + (waitMs || 60 * 60 * 1000), // Default 1 hour
          retryCount: 0,
          lastMessage: '',
        };
        this.onLimited(this.state);
        this.startRetryLoop();
      }
    }, 5000);
  }

  private extractWaitTime(text: string): number | null {
    for (const { regex, multiplier } of WAIT_TIME_PATTERNS) {
      if (multiplier) {
        const match = text.match(regex);
        if (match) return parseInt(match[1]) * multiplier;
      }
    }
    // Default: assume 1 hour for Plus, 3 hours for Free
    return 60 * 60 * 1000;
  }

  private startRetryLoop(): void {
    // Every 2 minutes, try sending a simple message to see if limit lifted
    const retryInterval = setInterval(async () => {
      if (!this.state) {
        clearInterval(retryInterval);
        return;
      }

      this.state.retryCount++;

      // Try a lightweight test message
      // Inject "continue" into the search bar
      try {
        await this.chatView.webContents.executeJavaScript(`
          (() => {
            const input = document.querySelector('#prompt-textarea')
              || document.querySelector('div[contenteditable="true"]');
            if (!input) return false;
            input.focus();
            const dt = new DataTransfer();
            dt.setData('text/plain', 'continue');
            input.dispatchEvent(new ClipboardEvent('paste', {
              clipboardData: dt, bubbles: true, cancelable: true
            }));
            return true;
          })()
        `);

        await new Promise(r => setTimeout(r, 500));

        // Click send
        await this.chatView.webContents.executeJavaScript(`
          (() => {
            const btn = document.querySelector('button[data-testid="send-button"]')
              || document.querySelector('button[aria-label="Send prompt"]');
            if (btn) btn.click();
          })()
        `);

        // Wait 3 seconds, check if we got a real response (not rate limit)
        await new Promise(r => setTimeout(r, 3000));

        const stillLimited = await this.chatView.webContents.executeJavaScript(`
          (() => {
            const text = document.body.innerText.slice(-1000);
            return ${JSON.stringify(RATE_LIMIT_PATTERNS.map(p => p.source))}.some(p => new RegExp(p, 'i').test(text));
          })()
        `);

        if (!stillLimited) {
          // Rate limit lifted!
          this.state = null;
          clearInterval(retryInterval);
          this.onResumed();
        }
      } catch {
        // Ignore errors, keep retrying
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  stop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}
```

### User sees when rate limited:
```
⏸ ChatGPT needs a breather

Your account has a message limit. This is normal.
Estimated wait: ~45 minutes
We'll automatically continue when ready.

Meanwhile, any code-only tasks are still running.

[45:22 remaining]
```

### Cron Job: Scheduled Continuation
For long-running tasks that span rate limit windows:

```typescript
// src/main/task-scheduler.ts

class TaskScheduler {
  private pendingTasks: Array<{
    id: string;
    prompt: string;
    scheduledFor: number;  // timestamp
    context: any;          // project state to resume
  }> = [];

  // When rate limited, schedule continuation
  scheduleResume(taskId: string, prompt: string, resumeAfterMs: number, context: any): void {
    const scheduledFor = Date.now() + resumeAfterMs;
    this.pendingTasks.push({ id: taskId, prompt, scheduledFor, context });
    StateManager.save('scheduled-tasks', this.pendingTasks);

    // Set timeout
    setTimeout(() => this.tryResume(taskId), resumeAfterMs);
  }

  private async tryResume(taskId: string): Promise<void> {
    const task = this.pendingTasks.find(t => t.id === taskId);
    if (!task) return;

    // Attempt to send the continuation prompt
    const result = await this.injectAndVerify(task.prompt);
    if (result.rateLimited) {
      // Still limited, reschedule for 5 more minutes
      this.scheduleResume(taskId, task.prompt, 5 * 60 * 1000, task.context);
    } else {
      // Success! Remove from queue
      this.pendingTasks = this.pendingTasks.filter(t => t.id !== taskId);
      StateManager.save('scheduled-tasks', this.pendingTasks);
    }
  }

  // On app launch, check for pending scheduled tasks
  loadPending(): void {
    const saved = StateManager.load('scheduled-tasks');
    if (saved) {
      this.pendingTasks = saved;
      for (const task of this.pendingTasks) {
        const delay = Math.max(0, task.scheduledFor - Date.now());
        setTimeout(() => this.tryResume(task.id), delay);
      }
    }
  }
}
```

---

## PART 6: UNIFIED PLUGIN BUNDLE — "OUR PLUGIN"

### The Idea
Don't install GSD, Claude-Flow, Superpowers, 15 MCP servers separately. Package them ALL into ONE plugin that installs once. The user doesn't know (or care) that they're getting 20 tools. They just get "our app."

### How It Works

```
npm install -g @our-brand/toolkit
```

This single package bundles:
- GSD (project lifecycle)
- Claude-Flow/Ruflo (multi-agent orchestration)
- Claude-Code-Workflows agents + skills (112 agents, 146 skills)
- Superpowers (structured planning)
- All essential MCP servers (GitHub, Supabase, Stripe, Vercel, Memory, Filesystem, Brave Search)
- Our custom skills (intake, routing, output formatting)
- Our prompt templates

### Package Structure
```
@our-brand/toolkit/
├── package.json
├── bin/
│   └── toolkit          # Single CLI entry point (never exposed to users)
├── plugins/
│   ├── gsd/             # Vendored GSD (pinned version)
│   ├── claude-flow/     # Vendored Claude-Flow
│   ├── workflows/       # Vendored Claude-Code-Workflows
│   └── superpowers/     # Vendored Superpowers
├── mcp-servers/
│   ├── github/
│   ├── supabase/
│   ├── stripe/
│   ├── vercel/
│   ├── memory/
│   ├── filesystem/
│   └── brave-search/
├── skills/
│   ├── intake.md        # Our intake prompt
│   ├── routing.md       # Our routing logic
│   ├── output.md        # Our output formatting
│   └── web-features.md  # When to use DALL-E, search, etc.
└── templates/
    ├── nextjs/           # Default website template
    ├── ecom/             # E-commerce template
    ├── saas/             # SaaS template
    └── landing/          # Landing page template
```

### Why This Is Smart
1. **One install, one version, one update.** User never manages dependencies.
2. **Pinned versions.** We test compatibility. If GSD v2.3 breaks something, we stay on v2.2.
3. **Our branding.** It's "@our-brand/toolkit" not "gsd" or "claude-flow."
4. **Custom skills on top.** We add our intake layer, routing, and output formatting as additional skills.
5. **Smaller install.** We only include what we need from each plugin. GSD has 50 agents but maybe we only use 20.

### UX Principle: INVISIBLE TOOLING

The user NEVER sees:
- Plugin names (GSD, Claude-Flow, Superpowers)
- MCP server names
- Agent names (gsd-planner, gsd-roadmapper)
- Skill files or .md prompts
- Configuration files

The user ONLY sees:
- "Planning your project..." (GSD planning phase)
- "Researching best approach..." (GSD research phase)
- "Building your site..." (Codex/Claude Code executing)
- "Checking everything works..." (GSD verify phase)
- "Generating images..." (DALL-E via ChatGPT)
- "Almost done..." (final assembly)

### Translation Layer
```typescript
// src/plugins/status-translator.ts

const FRIENDLY_STATUS: Record<string, string> = {
  // GSD phases → user-friendly
  'gsd:new-project': 'Setting up your project...',
  'gsd:discuss-phase': 'Planning the approach...',
  'gsd:plan-phase': 'Creating a detailed plan...',
  'gsd:execute-phase': 'Building your project...',
  'gsd:verify-work': 'Checking everything works...',
  'gsd:complete-milestone': 'Finishing up this section...',

  // Claude-Flow → user-friendly
  'claude-flow:spawn-agent': 'Working on multiple parts at once...',
  'claude-flow:agent-complete': 'One section done...',
  'claude-flow:swarm-complete': 'All sections complete...',

  // MCP servers → user-friendly
  'mcp:github:push': 'Saving your code...',
  'mcp:supabase:create-table': 'Setting up your database...',
  'mcp:stripe:create-product': 'Setting up payments...',
  'mcp:vercel:deploy': 'Publishing your site...',

  // CLI output → user-friendly
  'npm install': 'Installing what we need...',
  'creating file': 'Building your pages...',
  'running tests': 'Testing everything...',
  'build complete': 'Build done!',
  'error': 'Found an issue, fixing it...',
};
```

---

## PART 7: THE "EXPLAIN TO MUM" GUIDES

### Principle
Every external service we connect to needs a one-paragraph explanation that:
1. Says what it does in simple terms
2. Names a company/brand the user trusts (social proof)
3. Says it's free (or buries the cost)
4. Doesn't use technical jargon
5. Makes the user feel safe, not overwhelmed

### The Four Staple Services

---

#### GitHub
**What we show the user:**
> **GitHub** is where your website's code lives safely in the cloud. It's owned by Microsoft and used by every major company in the world — Apple, Google, Netflix, NASA. It's completely free for personal projects. Think of it like Google Drive, but for code.

**What we show when connecting:**
> We need to link your GitHub account so we can save your project safely. This means your code is backed up and you can access it from anywhere.
>
> **Don't have a GitHub account?** No worries — we'll help you create one. It takes 30 seconds.

**What we DON'T say:** repository, git, commit, push, pull, branch, merge, CLI, SSH key, token.

---

#### Supabase
**What we show the user:**
> **Supabase** is your project's database — think of it like a smart spreadsheet in the cloud. When someone signs up to your site, their info is stored here. When they log in, Supabase checks their password. It's used by thousands of companies and is completely free to start.

**What we show when connecting:**
> We need to connect a database for your project. Supabase handles all the user accounts, passwords, and data storage. You won't need to manage any of this — we set it all up automatically.
>
> **Don't have a Supabase account?** We'll walk you through creating one. Just needs an email.

**What we DON'T say:** PostgreSQL, SQL, rows, columns, RLS, auth tokens, API keys, JWT, migration.

---

#### Stripe
**What we show the user:**
> **Stripe** handles all the payments for your project. You've probably used Stripe without knowing it — it powers payments for Amazon, Google, Shopify, Zara, H&M, and millions of online stores. When someone buys something on your site, the money goes straight to your bank account.

**What we show when connecting:**
> We'll connect Stripe so you can accept payments on your site. Stripe handles all the security and compliance — you just need to link your bank account in their dashboard.
>
> **Don't have a Stripe account?** Create one at stripe.com. You'll need a bank account to receive payments.

**What we DON'T say about fees initially.** After setup, we show:
> *Note: Stripe charges 2.9% + 30¢ per transaction. This is standard for online payments and is handled entirely by Stripe.*

**Pattern:** "It's Stripe's fee, not ours." We never own the bad news.

---

#### Vercel
**What we show the user:**
> **Vercel** is where your website actually lives on the internet — it's what makes yoursite.com work. They host websites for some of the biggest brands in the world including Hulu, The Washington Post, and McDonald's. Your site loads fast from anywhere in the world. Free for personal projects.

**What we show when connecting:**
> We'll connect your Vercel account so your site goes live automatically whenever we make changes. Once connected, your site gets a free URL like yourproject.vercel.app.
>
> **Want your own domain?** (like mybusiness.com) You can connect one later in Vercel's dashboard. Vercel doesn't sell domains, but we can help you get one from Namecheap or Google Domains.

**What we DON'T say:** serverless, edge functions, CDN, build pipeline, deployment, CI/CD, DNS, CNAME.

---

### Connection Flow UX

When a project requires one of these services, show them ONE AT A TIME:

```
Step 1 of 3: Connecting GitHub

[GitHub logo]

GitHub is where your website's code lives safely
in the cloud. Owned by Microsoft. Free for personal projects.

[Connect GitHub]    [Skip for now]


───────────────────────────────

Step 2 of 3: Setting up Supabase

[Supabase logo]

Your project needs a database for user accounts.
Supabase handles this — think of it like a smart
spreadsheet in the cloud. Free to start.

[Connect Supabase]  [Skip for now]
```

### If user skips:
- GitHub skip → we save code locally only, no cloud backup, no deploy
- Supabase skip → no auth/database features, we build a static site instead
- Stripe skip → no payments, we build the site without checkout
- Vercel skip → no live URL, preview only runs locally in Docker

Never block. Always degrade gracefully. User can connect later.

---

## PART 8: MCP SETUP GUIDE (FOR CLAUDE CODE BUILD)

Add this to the Claude Code overnight prompt as an additional section:

### File: `src/mcp/mcp-manager.ts`

```typescript
interface MCPServer {
  id: string;
  name: string;              // Internal name
  friendlyName: string;      // What user sees
  description: string;       // Explain-to-mum description
  package: string;           // npm package or pip package
  requiredForTaskTypes: string[];  // When to activate
  requiresAuth: boolean;
  authGuide: string;         // User-friendly auth instructions
  tools: string[];           // What tools this server provides
  tokenOverhead: number;     // Approximate schema size in tokens
}

const MCP_REGISTRY: MCPServer[] = [
  {
    id: 'github',
    name: '@anthropic-ai/mcp-server-github',
    friendlyName: 'Code Storage',
    description: 'Saves your code safely in the cloud (GitHub)',
    package: '@anthropic-ai/mcp-server-github',
    requiredForTaskTypes: ['website', 'app', 'code'],
    requiresAuth: true,
    authGuide: 'Sign into GitHub when prompted. Your code will be saved automatically.',
    tools: ['create_repo', 'push_code', 'create_branch', 'create_pr'],
    tokenOverhead: 800,
  },
  {
    id: 'supabase',
    name: '@anthropic-ai/mcp-server-supabase',
    friendlyName: 'Database',
    description: 'Stores user data like a smart spreadsheet in the cloud',
    package: '@anthropic-ai/mcp-server-supabase',
    requiredForTaskTypes: ['app', 'saas', 'ecom'],
    requiresAuth: true,
    authGuide: 'Create a free Supabase account at supabase.com, then paste your project URL when prompted.',
    tools: ['create_table', 'insert_row', 'query', 'setup_auth'],
    tokenOverhead: 1200,
  },
  {
    id: 'stripe',
    name: 'stripe-mcp',
    friendlyName: 'Payments',
    description: 'Accept payments on your site (Stripe)',
    package: 'stripe-mcp',
    requiredForTaskTypes: ['ecom', 'saas'],
    requiresAuth: true,
    authGuide: 'Create a Stripe account at stripe.com. Link your bank account to receive payments.',
    tools: ['create_product', 'create_price', 'create_checkout_session'],
    tokenOverhead: 900,
  },
  {
    id: 'vercel',
    name: 'vercel-mcp',
    friendlyName: 'Website Hosting',
    description: 'Makes your site live on the internet',
    package: 'vercel-mcp',
    requiredForTaskTypes: ['website', 'app', 'landing', 'ecom'],
    requiresAuth: true,
    authGuide: 'Create a free Vercel account at vercel.com. Your site gets a free URL.',
    tools: ['deploy', 'create_project', 'add_domain'],
    tokenOverhead: 600,
  },
  {
    id: 'memory',
    name: '@anthropic-ai/mcp-server-memory',
    friendlyName: 'Project Memory',
    description: 'Remembers context across long projects',
    package: '@anthropic-ai/mcp-server-memory',
    requiredForTaskTypes: ['*'],  // Always useful
    requiresAuth: false,
    authGuide: '',
    tools: ['store', 'retrieve', 'search'],
    tokenOverhead: 400,
  },
  {
    id: 'filesystem',
    name: '@anthropic-ai/mcp-server-filesystem',
    friendlyName: 'File Manager',
    description: 'Reads and writes project files',
    package: '@anthropic-ai/mcp-server-filesystem',
    requiredForTaskTypes: ['*'],
    requiresAuth: false,
    authGuide: '',
    tools: ['read_file', 'write_file', 'list_dir', 'search_files'],
    tokenOverhead: 500,
  },
  {
    id: 'brave-search',
    name: '@anthropic-ai/mcp-server-brave-search',
    friendlyName: 'Web Research',
    description: 'Searches the internet for current information',
    package: '@anthropic-ai/mcp-server-brave-search',
    requiredForTaskTypes: ['research'],
    requiresAuth: true,
    authGuide: 'Get a free API key at brave.com/search/api',
    tools: ['search', 'get_page'],
    tokenOverhead: 300,
  },
];

// Only load MCP servers needed for this task
function getRequiredServers(taskType: string): MCPServer[] {
  return MCP_REGISTRY.filter(s =>
    s.requiredForTaskTypes.includes('*') || s.requiredForTaskTypes.includes(taskType)
  );
}

// Calculate total token overhead for active servers
function calculateTokenOverhead(servers: MCPServer[]): number {
  return servers.reduce((sum, s) => sum + s.tokenOverhead, 0);
}
```

### Lazy Loading
Don't start all MCP servers on app launch. Start them when needed:
1. App launches → start only `filesystem` and `memory` (always needed)
2. User starts a code project → start `github`
3. User's project needs auth → start `supabase`
4. User wants payments → start `stripe`
5. User clicks "Deploy" → start `vercel`

This saves ~300MB RAM vs starting everything upfront.

---

## SUMMARY: OVERNIGHT BUILD TASKS

### For Codex (research — CODEX-RESEARCH-PROMPT.md):
Already written. 11 sections, deep research.

### For Claude Code (Gates 5-6 — CLAUDE-CODE-GATE5-6.md):
Already written. Auto-installer + CLI auth.

### ADDITIONAL for Claude Code — add these files to the build:

```
NEW FILES TO CREATE:
├── src/main/docker-manager.ts       # Docker container management
├── src/main/self-tester.ts          # Auto-test pipeline
├── src/main/deploy-manager.ts       # Vercel deploy integration
├── src/main/rate-limiter.ts         # Rate limit detection + auto-continue
├── src/main/task-scheduler.ts       # Cron-style task scheduling
├── src/intake/file-analyzer.ts      # Document/file type intelligence
├── src/intake/route-from-brief.ts   # Execution plan builder
├── src/main/web-feature-router.ts   # DALL-E, search, Canvas triggers
├── src/main/image-capture.ts        # Download generated images
├── src/mcp/mcp-manager.ts           # MCP server registry + lifecycle
├── src/plugins/status-translator.ts # Friendly status messages
├── src/renderer/components/ServiceConnect.tsx  # GitHub/Supabase/Stripe/Vercel connection UI
├── docs/SERVICE-GUIDES.md           # The "explain to mum" guides
```

Run command:
```bash
cd ~/Documents/unified-terminal
claude --dangerously-skip-permissions "Read CLAUDE-CODE-GATE5-6.md first and complete it. Then read PRODUCT-STRATEGY.md and build all files listed in the SUMMARY section. Create every file, wire every integration, write tests. You have all night."
```
