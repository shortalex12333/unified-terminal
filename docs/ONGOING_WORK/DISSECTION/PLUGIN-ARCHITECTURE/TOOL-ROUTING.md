# Tool Routing: How to Call External Tools

## The Routing Principle

Skills don't call tools directly. Skills describe WHAT needs to happen. The **executor** translates to HOW.

```
Skill says: "Execute the test suite"
Executor translates:
  - Codex: shell tool with "npm test"
  - Claude Code: Bash tool
  - ChatGPT: Send to code interpreter
```

---

## The Three Executor Types

| Executor | When Used | Underlying Tool |
|----------|-----------|-----------------|
| **CLI Executor** | Code generation, file ops, tests | Codex CLI, Claude Code CLI |
| **Web Executor** | Browsing, image gen, research | ChatGPT BrowserView |
| **Service Executor** | Auth, external APIs, payments | Unified Terminal handlers |

---

## Tool Categories

### File Operations

| Action | Skill Language | Codex | Claude Code |
|--------|---------------|-------|-------------|
| Read file | "Read the file at..." | `file.read(path)` | `Read` tool |
| Write file | "Create a file at..." | `file.write(path, content)` | `Write` tool |
| Edit file | "Modify the file..." | `file.edit(path, changes)` | `Edit` tool |
| List files | "Show files in..." | `file.list(pattern)` | `Glob` tool |
| Search in files | "Find occurrences of..." | `file.search(pattern)` | `Grep` tool |

### Shell Operations

| Action | Skill Language | Codex | Claude Code |
|--------|---------------|-------|-------------|
| Run command | "Execute the command..." | `shell.run(cmd)` | `Bash` tool |
| Run npm | "Install dependencies" | `shell.run('npm install')` | `Bash` tool |
| Run tests | "Run the test suite" | `shell.run('npm test')` | `Bash` tool |
| Build | "Build the project" | `shell.run('npm run build')` | `Bash` tool |
| Git operations | "Commit the changes" | `shell.run('git commit')` | `Bash` tool |

### Web Operations

| Action | Skill Language | Executor | Tool |
|--------|---------------|----------|------|
| Search web | "Search for information about..." | Web | `WebSearch` or ChatGPT |
| Fetch page | "Get the contents of URL..." | Web | `WebFetch` or ChatGPT |
| Browse interactively | "Navigate to... and click..." | Web | ChatGPT BrowserView |
| Get API docs | "Find documentation for..." | CLI | `Context7 MCP` |

### Image Operations

| Action | Skill Language | Executor | Tool |
|--------|---------------|----------|------|
| Generate image | "Create an image of..." | Web | ChatGPT → DALL-E |
| Optimize image | "Compress the image at..." | CLI | Sharp (Node) |
| Take screenshot | "Screenshot the page at..." | Web | Playwright MCP |

### Database Operations

| Action | Skill Language | Executor | Tool |
|--------|---------------|----------|------|
| Query SQLite | "Read from the database..." | CLI | shell with sqlite3 |
| Query Supabase | "Fetch records from..." | Service | Supabase MCP |
| Run migration | "Apply the migration..." | CLI | shell with migration tool |

---

## MCP Server Integration

### Available MCP Servers

| Server | Purpose | When Activated |
|--------|---------|----------------|
| **Context7** | API documentation lookup | Research phase, unfamiliar APIs |
| **Playwright** | Browser automation | E2E tests, scraping JS sites |
| **Memory** | Cross-session knowledge | Project reopening, context restoration |
| **Supabase** | Database operations | When user connects Supabase |
| **Firecrawl** | Structured web scraping | Research phase, data extraction |

### MCP Call Pattern

```typescript
// In skill: "Look up the Stripe API documentation"
// Executor translates to:

// 1. Resolve library ID
const result = await mcp.context7.resolveLibraryId({
  libraryName: 'stripe',
  query: 'payment intents API'
});

// 2. Query documentation
const docs = await mcp.context7.queryDocs({
  libraryId: result.libraryId,
  query: 'how to create a payment intent'
});
```

---

## Fallback Chains

When primary tool fails, fallback to alternatives:

### Web Scraping Chain
```
1. Firecrawl (structured extraction)
   ↓ fails
2. Playwright MCP (JS rendering)
   ↓ fails
3. WebFetch (simple HTTP)
   ↓ fails
4. ChatGPT browsing (anti-bot)
   ↓ fails
5. Manual (ask user)
```

### API Documentation Chain
```
1. Context7 MCP (indexed docs)
   ↓ not found
2. WebSearch + WebFetch (live docs)
   ↓ not found
3. Repomix (local source analysis)
   ↓ not found
4. Ask user for docs link
```

### Image Generation Chain
```
1. ChatGPT → DALL-E
   ↓ rate limited
2. Wait and retry
   ↓ still limited
3. Ask user to provide image
```

---

## Tool Permission Matrix

From `plugin-requirements-manifest.json`:

| Skill | file | shell | web | mcp |
|-------|------|-------|-----|-----|
| gsd-executor | RW | Y | N | N |
| gsd-planner | R | N | N | Y (Context7) |
| gsd-debugger | RW | Y | N | N |
| gsd-verifier | R | Y | N | N |
| gsd-researcher | R | N | Y | Y (Context7) |
| tdd-guide | RW | Y | N | N |
| code-reviewer | R | N | N | N |
| security-reviewer | R | Y | N | N |
| web-researcher | N | N | Y | Y (Firecrawl) |
| worker-deploy | R | Y | N | N |
| worker-image-gen | W | N | Y | N |

**Legend:** R = read, W = write, RW = read+write, Y = yes, N = no

---

## Routing Decision Tree

```
User message arrives
        │
        ├── Contains "search" or "find online"?
        │   └── YES → Web Executor (ChatGPT or WebSearch)
        │
        ├── Contains "generate image" or "create logo"?
        │   └── YES → Web Executor (ChatGPT → DALL-E)
        │
        ├── Contains "deploy" or "go live"?
        │   └── YES → Service Executor (Vercel CLI)
        │
        ├── Contains "connect" + external service?
        │   └── YES → Service Executor (OAuth flow)
        │
        └── DEFAULT → CLI Executor (Codex)
```

---

## Cross-Executor Handoffs

When a task requires multiple executors:

### Example: "Build a landing page with a hero image"

```
Step 1: CLI Executor
  - Skill: frontend-design
  - Action: Generate page code
  - Output: src/pages/index.tsx

Step 2: Web Executor
  - Skill: worker-image-gen
  - Action: Generate hero image via DALL-E
  - Output: public/hero.png

Step 3: CLI Executor
  - Skill: gsd-executor
  - Action: Wire image into component
  - Output: Updated index.tsx

Step 4: CLI Executor
  - Skill: worker-deploy
  - Action: Deploy to Vercel
  - Output: Live URL
```

**PA/Messenger handles handoffs:** After Step 2 completes, PA compresses the output ("Generated hero image at public/hero.png, 1920x1080, landscape") and passes to Step 3's context.

---

## Tool-Specific Patterns

### Git Operations (via shell)

```bash
# Commit pattern (from worker-deploy skill)
git add {specific_files}  # Never git add -A
git commit -m "{type}({scope}): {message}"
git push origin {branch}
```

### npm Operations (via shell)

```bash
# Test pattern (from tdd-guide skill)
npm test 2>&1; echo "EXIT:$?"
# Parse output for exit code

# Build pattern (from worker-deploy skill)
npm run build 2>&1
# Check for dist/ directory existence
```

### Docker Operations (via shell)

```bash
# Local verification pattern (from docker-local-first skill)
docker build -t test:local .
docker run -d --name test-container test:local
sleep 3
curl -s http://localhost:$PORT/health
docker rm -f test-container
```

### Supabase Operations (via MCP)

```typescript
// Query pattern
const result = await mcp.supabase.query({
  table: 'users',
  select: '*',
  filter: { id: userId }
});

// Insert pattern
await mcp.supabase.insert({
  table: 'logs',
  data: { event: 'deployment', timestamp: new Date() }
});
```

---

## Error Recovery by Tool Type

| Tool Type | Common Error | Recovery |
|-----------|--------------|----------|
| shell | Exit code non-zero | Parse error, apply minimal fix |
| file.read | File not found | Check alternative paths |
| file.write | Permission denied | Escalate to user |
| web | Rate limited | Exponential backoff |
| web | Blocked by anti-bot | Route to ChatGPT |
| mcp | Server not available | Use fallback chain |
| mcp | Auth expired | Trigger re-auth flow |

---

## Adding New Tools

When a new MCP server or CLI tool becomes available:

1. **Add to tool matrix** in `plugin-requirements-manifest.json`
2. **Update fallback chains** if it's a better option
3. **Update skill permissions** for relevant skills
4. **Add translation rules** in each adapter (Codex, Claude, Gemini)
5. **Test integration** with a sample skill

The skills themselves don't change. Only the executor translation layer updates.
