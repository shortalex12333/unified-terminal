# Lesson Template
<!-- triggers: lesson, learn, failure, mistake, error, guard, pattern -->
<!-- version: 1.0 -->
<!-- source: custom -->
<!-- runtime: any -->

## Purpose

Capture structured lessons from failures and near-failures. Every lesson feeds into ENFORCER.json to prevent future occurrences.

## Template

```markdown
## LESSON: [Short Title]

**Date:** YYYY-MM-DD
**Phase:** [Phase number or "N/A"]
**Context:** [One sentence: What were we trying to do?]
**Failure:** [One sentence: What went wrong or almost went wrong?]
**Root Cause:** [One sentence: Why did it happen?]
**Guard Added:** [What rule prevents this in the future?]
**Test Added:** [What test catches this? Include command if applicable]
**Reusable Pattern:** [What can be applied to other projects?]
**Tags:** [comma-separated: deployment, database, frontend, rls, security, testing, etc.]

### Prevention Rule (Machine-Readable)

```json
{
  "check": "[Description of what to check]",
  "script": "[Command or script to run]",
  "pass": "[Condition that indicates success]",
  "confidence": "definitive | heuristic",
  "rail": "HARD | SOFT"
}
```
```

## Example

```markdown
## LESSON: Missing env var in Docker

**Date:** 2026-03-03
**Phase:** 14
**Context:** Deploying Stripe webhook handler to production
**Failure:** Webhook handler returned 500 on test event
**Root Cause:** STRIPE_WEBHOOK_SECRET env var not passed to Docker container
**Guard Added:** Pre-deploy check: verify all required env vars are in docker-compose.yml
**Test Added:** `docker exec app env | grep STRIPE_WEBHOOK_SECRET`
**Reusable Pattern:** Create .env.example with all required vars, script to diff against docker-compose.yml
**Tags:** deployment, docker, env-vars, stripe

### Prevention Rule (Machine-Readable)

```json
{
  "check": "STRIPE_WEBHOOK_SECRET env var exists in container",
  "script": "docker exec app env | grep STRIPE_WEBHOOK_SECRET",
  "pass": "output.length > 0",
  "confidence": "definitive",
  "rail": "HARD"
}
```
```

## Hard Boundaries

- NEVER write a lesson without a prevention rule
- NEVER use vague language ("it should work better now")
- ALWAYS include a machine-checkable test
- ALWAYS assign tags for future searchability

## Success Looks Like

- [ ] All 8 fields filled (Date, Phase, Context, Failure, Root Cause, Guard, Test, Pattern)
- [ ] Tags assigned
- [ ] Prevention rule is valid JSON
- [ ] Prevention rule has check, script, pass, confidence, rail fields
- [ ] Test command is runnable (not pseudocode)
