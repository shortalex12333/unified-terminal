# GATE 17: Provider Selection + Unified Chat UX

**Status:** IN PROGRESS
**Created:** 2026-03-03

---

## SIMPLIFIED UX

### Flow
```
1. Provider Screen → Pick: Codex | Claude | Gemini
   - Sign In / Sign Out buttons
   - Only one active at a time

2. Chat Interface → Same look for all providers
   - ChatGPT-style message bubbles
   - User types, sees response
   - No visible terminal

3. Background → CLI runs invisibly
   - Spawned in hidden window
   - Output piped to chat UI
```

---

## FILES TO CREATE

| File | Purpose |
|------|---------|
| `src/renderer/components/ProviderScreen.tsx` | Provider picker + auth |
| `src/renderer/components/ChatInterface.tsx` | Unified chat UI |
| `src/main/background-cli.ts` | Invisible CLI runner |

---

## IMPLEMENTATION

### 1. ProviderScreen.tsx
- Three cards: Codex, Claude, Gemini
- Each shows: Logo, Name, Status (signed in/out)
- Sign In → Opens OAuth flow
- Sign Out → Clears token
- Select → Sets active provider, goes to chat

### 2. ChatInterface.tsx
- Message list (user/assistant bubbles)
- Input box at bottom
- Send button
- Streams response from active CLI

### 3. background-cli.ts
- Spawns CLI with `--print` mode (non-interactive)
- Pipes stdout to IPC
- Runs in background (no visible window)
- Handles Codex, Claude, Gemini commands
