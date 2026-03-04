# Design: Gemini CLI OAuth Auto-Flow

**Date:** 2026-03-04
**Status:** Approved
**Author:** Claude + User

## Problem Statement

Gemini CLI requires OAuth authentication. Google blocks embedded browsers (Electron BrowserView) for security. Users need a seamless way to authenticate once and have permanent CLI access.

## Solution

Auto-detect OAuth prompt from Gemini CLI, open system browser for authentication, show simple code-entry modal, then proceed to TerminalUI for chat.

## User Flow

```
User clicks Gemini card
    ↓
ProfilePicker spawns Gemini CLI with NO_BROWSER=true
    ↓
CLI outputs OAuth URL ("Please visit...")
    ↓
App detects OAuth URL in output stream
    ↓
App opens URL in system browser (Safari/Chrome)
    ↓
App shows simple modal: "Paste authorization code: [____] [Authorize]"
    ↓
User completes OAuth in browser, copies code
    ↓
User pastes code in modal, clicks Authorize
    ↓
App sends code to CLI stdin
    ↓
CLI authenticates, stores credentials
    ↓
App transitions to TerminalUI for chat
    ↓
Future sessions: CLI already authenticated → Instant TerminalUI
```

## Architecture

### Components Modified

1. **TerminalUI.tsx** - Add OAuth detection + modal overlay
2. **src/main/index.ts** - Add IPC handler to open system browser

### Detection Logic

Monitor CLI output for OAuth URL pattern:
```typescript
const OAUTH_URL_PATTERN = /https:\/\/accounts\.google\.com\/o\/oauth2/;
```

When detected:
1. Extract full URL from output
2. Trigger system browser open via IPC
3. Show code entry modal in TerminalUI

### System Browser Opening

Use Electron's `shell.openExternal()` to open OAuth URL in default system browser (Safari, Chrome, Firefox).

### Modal Component

Simple overlay in TerminalUI:
- Text: "Complete sign-in in your browser, then paste the code below"
- Input field for authorization code
- "Authorize" button
- Cancel/back option

### State Management

Track OAuth state in TerminalUI:
```typescript
type AuthState = 'idle' | 'awaiting_code' | 'authenticating' | 'authenticated' | 'failed';
```

## Success Criteria

1. User clicks Gemini → System browser opens OAuth URL automatically
2. User sees clean modal for code entry (not raw terminal output)
3. User pastes code → CLI authenticates
4. Subsequent sessions skip OAuth entirely (CLI remembers auth)

## Error Handling

- If code entry fails: Show error, allow retry
- If CLI crashes: Fall back to error state with "Try Again" option
- If user cancels: Return to ProfilePicker

## Testing Plan

1. Fresh auth: Delete `~/.config/gemini-cli/` to simulate first-time user
2. Click Gemini → Verify system browser opens
3. Complete OAuth → Verify code entry modal appears
4. Enter code → Verify CLI authenticates
5. Restart app → Verify no OAuth needed (instant TerminalUI)
