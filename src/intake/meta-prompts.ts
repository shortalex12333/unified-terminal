/**
 * Unified Terminal - Meta-Prompt Templates
 *
 * System prompts that guide ChatGPT through the intake process.
 * These prompts transform vague user requests into structured briefs
 * through non-technical, conversational questioning.
 */

// ============================================================================
// INTAKE PROMPT
// ============================================================================

/**
 * Initial prompt injected when user submits their first request.
 * Guides ChatGPT to ask clarifying questions.
 *
 * @param userMessage - The user's original request
 * @returns Formatted system prompt
 */
export function buildIntakePrompt(userMessage: string): string {
  return `You are a project intake specialist helping a non-technical user clarify their request. The user wants:

"${userMessage}"

Your job is to ask 3-5 simple, conversational questions to understand:

1. WHO is this for? (target audience, end users, customers)
2. WHAT do they already have? (existing website, brand assets, content)
3. WHY are they doing this? (end goal, success metric, problem to solve)
4. WHAT constraints exist? (timeline, budget, style preferences)

RULES:
- Do NOT ask about technical choices (frameworks, databases, hosting)
- Do NOT ask about implementation details
- Keep questions brief and conversational
- Ask one topic per question
- Use plain language, not jargon
- Be friendly and helpful

IMPORTANT: When the user has answered your questions, respond with exactly:
INTAKE_COMPLETE

Followed by a brief summary of what you learned.

Begin by asking your first clarifying question.`;
}

// ============================================================================
// BRIEF BUILDER PROMPT
// ============================================================================

/**
 * Prompt injected after intake is complete to build the structured brief.
 * Instructs ChatGPT to output JSON.
 *
 * @returns System prompt for brief building
 */
export function buildBriefBuilderPrompt(): string {
  return `Based on the conversation above, create a structured project brief.

Output ONLY a valid JSON object in this exact format (no markdown, no explanation):

{
  "task_type": "build_product" | "build_content" | "research" | "automate" | "general",
  "category": "short description of the project type",
  "requirements": {
    "target_audience": "who this is for",
    "existing_assets": "what they already have",
    "success_metric": "how they'll measure success",
    "constraints": "any limitations mentioned",
    "style": "any style preferences",
    "timeline": "any timeline mentioned",
    "budget": "any budget mentioned"
  },
  "execution_path": "browser" | "local" | "hybrid",
  "plugins_needed": ["list", "of", "needed", "tools"]
}

TASK TYPE GUIDE:
- "build_product": websites, apps, landing pages, stores, software
- "build_content": blog posts, copy, emails, documentation, scripts
- "research": market research, competitor analysis, data gathering
- "automate": scraping, form filling, scheduling, repetitive tasks
- "general": anything that doesn't fit above

EXECUTION PATH GUIDE:
- "browser": primarily uses browser (scraping, form automation)
- "local": primarily uses local tools (code generation, file operations)
- "hybrid": needs both browser and local capabilities

PLUGINS GUIDE:
- "gsd": project planning and management
- "codex": code generation
- "claude": AI-assisted development
- "playwright": browser automation
- "scraper": web scraping
- "dall-e": image generation
- "vercel": deployment
- "github": git operations

Respond with ONLY the JSON object, nothing else.`;
}

// ============================================================================
// SKIP FLOW PROMPT
// ============================================================================

/**
 * Prompt used when user wants to skip the intake process.
 * Makes best assumptions from the original request.
 *
 * @param userMessage - The user's original request
 * @returns System prompt for quick brief building
 */
export function buildSkipFlowPrompt(userMessage: string): string {
  return `The user wants to skip clarifying questions and proceed immediately with:

"${userMessage}"

Create a project brief using reasonable assumptions. Output ONLY a valid JSON object:

{
  "task_type": "build_product" | "build_content" | "research" | "automate" | "general",
  "category": "inferred project type",
  "requirements": {
    "target_audience": "general audience (assumed)",
    "existing_assets": "none specified",
    "success_metric": "completion of request",
    "constraints": "none specified",
    "style": "professional (assumed)",
    "timeline": "not specified",
    "budget": "not specified"
  },
  "execution_path": "browser" | "local" | "hybrid",
  "plugins_needed": ["list", "of", "likely", "tools"]
}

Make intelligent assumptions based on common patterns:
- "landing page" -> build_product, local, ["codex", "claude", "vercel"]
- "scrape" -> automate, browser, ["playwright", "scraper"]
- "blog post" -> build_content, local, ["claude"]
- "research competitors" -> research, hybrid, ["scraper", "claude"]

Respond with ONLY the JSON object, nothing else.`;
}

// ============================================================================
// RECOVERY PROMPTS
// ============================================================================

/**
 * Prompt used when JSON parsing fails.
 * Asks ChatGPT to fix its output.
 */
export const RECOVERY_PROMPT = `Your previous response was not valid JSON. Please output ONLY a valid JSON object with no markdown formatting, no backticks, and no explanation text. Just the raw JSON.`;

/**
 * Prompt used to redirect conversation back to intake.
 * Used when user goes off-topic.
 */
export function buildRedirectPrompt(): string {
  return `Let's get back to understanding your project. I just have a few more questions to make sure I build exactly what you need.`;
}

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

/**
 * Pattern to detect INTAKE_COMPLETE signal in ChatGPT response.
 */
export const INTAKE_COMPLETE_PATTERN = /INTAKE_COMPLETE/i;

/**
 * Patterns to detect if user wants to skip intake.
 */
export const SKIP_PATTERNS = [
  /just\s+build\s+it/i,
  /skip\s+(the\s+)?questions?/i,
  /no\s+(more\s+)?questions?/i,
  /just\s+do\s+it/i,
  /go\s+ahead/i,
  /start\s+building/i,
  /begin\s+(now|already)/i,
  /proceed/i,
  /let's?\s+go/i,
  /get\s+started/i,
];

/**
 * Check if a message indicates skip intent.
 */
export function detectSkipIntent(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return SKIP_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Check if ChatGPT response indicates intake is complete.
 */
export function detectIntakeComplete(response: string): boolean {
  return INTAKE_COMPLETE_PATTERN.test(response);
}
