# Unified Terminal — Task Tracking

## Current: Gate 18 — Provider-Specific Sign-In Methods

**Status:** Planning
**Started:** 2026-03-03
**Previous:** Gates 1-17 COMPLETE (444+ tests passing)

---

### Problem Statement

Current ProfilePicker shows 3 provider cards but immediately launches auth.
Users expect to see the SAME sign-in options each provider offers:

| Provider | Expected Sign-In Options |
|----------|--------------------------|
| ChatGPT (OpenAI) | Google, Apple, Microsoft, Email |
| Gemini (Google) | Google (only) |
| Claude (Anthropic) | Google, Email |

### Tasks

- [ ] **Design:** Create UI flow for provider-specific sign-in buttons
- [ ] **Implement:** Update ProfilePicker with sign-in method selection
- [ ] **Implement:** Wire each sign-in method to correct auth flow
- [ ] **Test:** Manual login test with user for each provider
- [ ] **Verify:** All 3 providers authenticate correctly
- [ ] **Document:** Update CLAUDE.md with Gate 18 status

### Flow Design

```
1. User opens app
   ↓
2. ProfilePicker shows 3 provider cards
   [ChatGPT]  [Gemini]  [Claude]
   ↓
3. User clicks provider → Show sign-in methods for THAT provider
   ChatGPT: [Google] [Apple] [Microsoft] [Email]
   Gemini:  [Google]
   Claude:  [Google] [Email]
   ↓
4. User clicks sign-in method → Trigger auth flow
   ↓
5. Provider interface opens (authenticated)
```

### Implementation Approach

**ChatGPT:** BrowserView loads chatgpt.com, user sees OpenAI login page
**Gemini:** CLI OAuth → `gemini` command triggers Google OAuth
**Claude:** CLI OAuth → `claude` command triggers Anthropic OAuth

### Sub-Agent Strategy

1. **Explore Agent:** Research current auth flows in codebase
2. **Plan Agent:** Design component structure
3. **Code Agent:** Implement ProfilePicker updates
4. **Test Agent:** Verify with Playwright + manual user login

### Success Criteria

- [ ] ChatGPT: All 4 sign-in options work (Google, Apple, Microsoft, Email)
- [ ] Gemini: Google sign-in works via CLI OAuth
- [ ] Claude: Google + Email sign-in work via CLI OAuth
- [ ] UI matches each provider's native sign-in page aesthetics
- [ ] User can switch providers after logging in

---

## Completed Gates (1-17)

| Gate | Description | Tests |
|------|-------------|-------|
| 1-4 | ChatGPT BrowserView + OAuth + DOM | ✅ |
| 5-6 | System Scanner + Auto-Installer | 15/15 |
| 7-8 | CLI Process Mgmt + Task Routing | 80/80 |
| 9-10 | File Watcher + Plugin System | ✅ |
| 11-13 | State Persistence + Error Recovery | ✅ |
| 14 | Packaging (.dmg) | ✅ |
| 15-16 | Gemini CLI OAuth + AuthScreen | 57/57 |
| 17 | Chrome-style ProfilePicker | ✅ |

**Total:** 444+ tests passing
