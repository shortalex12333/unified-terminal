# Domain E: Deployment & Infrastructure

## What This Domain Covers
Getting code from local to live. Build pipelines, deploy targets, DNS, SSL, database provisioning, health checks.

## Locked Decisions
| Decision | Winner | Why | Loser |
|----------|--------|-----|-------|
| Deploy target | Vercel | Largest ecosystem, Next.js native (our default framework), zero-config | Netlify CLI (deleted) |
| Fallback deploy | GitHub Pages | Free, works when Vercel unavailable, static-only | -- |
| Database default | SQLite | Ships everywhere, zero config, sufficient for 90% of user projects | DuckDB (deleted) |
| Database upgrade | Supabase | When user needs auth, realtime, or Postgres. Connected via MCP. | -- |
| Container strategy | Docker local-first | Verify locally before any remote push. Catches env issues early. | Push-and-pray |

---

## External Tools
| Tool | Status | Why |
|------|--------|-----|
| Vercel CLI | KEPT (conditional) | Only installed when user connects Vercel account. Service executor handles. |
| GitHub CLI | KEPT | Git ops, PR creation, CI/CD triggers. Already authenticated via Gate 6. |
| Docker | KEPT (if available) | Local verification. Not required -- graceful fallback if Docker not installed. |
| Netlify CLI | DELETED | Vercel wins. One deploy target, no choice paralysis. |
| DuckDB | DELETED | SQLite more universal. DuckDB is analytics-optimized, users build CRUD apps. |

---

## Absorbed Prompts

### From docker-local-first skill
**The full verification prompt:**
Before pushing to any remote: Does the container build? (`docker build .` exit code 0). Does the app start? (`docker run` + health check). Can you hit the health endpoint? (curl localhost:PORT returns 200).

Location: `/skills/verification/docker-local-first.md`

### From product architecture
**worker-deploy.md**
Handles the deploy sequence: build > test > deploy > verify. Knows Vercel CLI commands, GH Pages workflow, Supabase migration commands.

Location: `/skills/workers/worker-deploy.md`

---

## Deploy Sequence (Tier 3 Complex Build)

```
1. Build locally (npm run build)
   HARD RAIL: dist/ exists and non-empty

2. Run test suite (npm test)
   HARD RAIL: exit code 0, test count > 0

3. Secret scan (gitleaks)
   HARD RAIL: exit code 0, no secrets found

4. Docker local verification (if Docker available)
   HARD RAIL: container builds, starts, responds 200

5. Deploy to Vercel (vercel --prod)
   SERVICE: may require user to connect Vercel account first

6. Post-deploy health check
   HARD RAIL: curl deployed URL returns 200, 3 retries at 10s intervals
   SECONDARY: response body must NOT contain error strings

7. Archivist generates PROJECT-ARCHIVE.md + llms.txt
```

---

## Hard Rails
| Check | Implementation | Confidence | On Failure |
|-------|---------------|-----------|------------|
| Build artifact | `fs.existsSync('dist/') && fs.readdirSync('dist/').length > 0` | definitive | BLOCK |
| Pre-deploy secret scan | `gitleaks detect --source . --exit-code 1` | definitive | BLOCK deploy |
| Docker build | `docker build . 2>&1; echo $?` | definitive | BLOCK (or skip if no Docker) |
| Docker health | `curl -s localhost:3000` with retry | heuristic | BLOCK after 3 retries |
| Post-deploy health | `curl -s -o /dev/null -w '%{http_code}' https://deployed-url.vercel.app` | heuristic | WARN + retry. May be DNS propagation. |

## Soft Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| Deploy preview review | LLM evaluates deployed preview against Spine requirements | WARN. Flag mismatches. |
