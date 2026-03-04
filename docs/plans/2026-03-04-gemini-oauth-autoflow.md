# Gemini OAuth Auto-Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-detect OAuth prompt from Gemini CLI, open system browser, show code-entry modal, and authenticate seamlessly.

**Architecture:** Monitor CLI output stream for OAuth URL pattern. When detected, use Electron's shell.openExternal() to open system browser. Show modal overlay in TerminalUI for code entry. Send code to CLI stdin. Track auth state to handle success/failure.

**Tech Stack:** React (TerminalUI component), Electron IPC, shell.openExternal(), TypeScript

---

### Task 1: Add IPC Handler for System Browser

**Files:**
- Modify: `src/main/index.ts` (add new IPC handler after line ~2235)
- Modify: `src/main/preload.ts` (expose to renderer)
- Modify: `src/renderer/global.d.ts` (add type definition)

**Step 1: Add IPC handler in main process**

In `src/main/index.ts`, add after the `cli:send-input` handler:

```typescript
/**
 * IPC: Open URL in system browser (for OAuth flows)
 */
ipcMain.handle('shell:open-external', async (
  _event,
  url: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await shell.openExternal(url);
    console.log(`[IPC] Opened in system browser: ${url.substring(0, 50)}...`);
    return { success: true };
  } catch (error) {
    console.error('[IPC] Failed to open external URL:', error);
    return { success: false, error: String(error) };
  }
});
```

**Step 2: Expose in preload.ts**

Add to the `contextBridge.exposeInMainWorld` object:

```typescript
shell: {
  openExternal: (url: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('shell:open-external', url);
  },
},
```

**Step 3: Add type definition in global.d.ts**

Add to the `ElectronAPI` interface:

```typescript
shell?: {
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
};
```

**Step 4: Build and verify no TypeScript errors**

Run: `npm run build:main`
Expected: Success with no errors

**Step 5: Commit**

```bash
git add src/main/index.ts src/main/preload.ts src/renderer/global.d.ts
git commit -m "feat: add IPC handler for opening URLs in system browser"
```

---

### Task 2: Add OAuth Detection and Modal State to TerminalUI

**Files:**
- Modify: `src/renderer/components/TerminalUI.tsx`

**Step 1: Add OAuth detection constants and state**

At the top of the file, add:

```typescript
// OAuth URL detection pattern
const OAUTH_URL_PATTERN = /https:\/\/accounts\.google\.com\/o\/oauth2[^\s]+/;

// Auth flow states
type AuthFlowState = 'idle' | 'awaiting_code' | 'authenticating' | 'authenticated' | 'failed';
```

Inside the component, add state:

```typescript
const [authFlowState, setAuthFlowState] = useState<AuthFlowState>('idle');
const [oauthUrl, setOauthUrl] = useState<string | null>(null);
const [authCode, setAuthCode] = useState<string>('');
const [authError, setAuthError] = useState<string | null>(null);
```

**Step 2: Add OAuth URL detection in output handler**

Modify the `onOutputChunk` effect to detect OAuth URL:

```typescript
useEffect(() => {
  const cleanup = window.electronAPI?.cli?.onOutputChunk?.((data: { processId: string; chunk: string }) => {
    if (data.processId === processId) {
      setOutput(prev => prev + data.chunk);

      // Detect OAuth URL in output
      const urlMatch = data.chunk.match(OAUTH_URL_PATTERN);
      if (urlMatch && authFlowState === 'idle') {
        const url = urlMatch[0];
        setOauthUrl(url);
        setAuthFlowState('awaiting_code');

        // Auto-open in system browser
        window.electronAPI?.shell?.openExternal?.(url);
      }

      // Detect successful authentication
      if (data.chunk.includes('Successfully authenticated') ||
          data.chunk.includes('Authentication successful') ||
          data.chunk.includes('Welcome to Gemini')) {
        setAuthFlowState('authenticated');
      }

      // Detect authentication errors
      if (data.chunk.includes('Invalid authorization code') ||
          data.chunk.includes('Authentication failed')) {
        setAuthFlowState('failed');
        setAuthError('Invalid code. Please try again.');
      }

      // Auto-scroll to bottom
      setTimeout(() => {
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }, 0);
    }
  });

  return () => {
    cleanup?.();
  };
}, [processId, authFlowState]);
```

**Step 3: Build and verify no TypeScript errors**

Run: `npm run build:renderer`
Expected: Success with no errors

**Step 4: Commit**

```bash
git add src/renderer/components/TerminalUI.tsx
git commit -m "feat: add OAuth URL detection and auth state management"
```

---

### Task 3: Add OAuth Modal UI Component

**Files:**
- Modify: `src/renderer/components/TerminalUI.tsx`

**Step 1: Add auth code submission handler**

Add this function inside the component:

```typescript
const handleAuthCodeSubmit = async () => {
  if (!authCode.trim()) return;

  setAuthFlowState('authenticating');
  setAuthError(null);

  try {
    const result = await window.electronAPI?.cli?.send?.(provider, processId, authCode.trim());
    if (!result?.success) {
      setAuthFlowState('failed');
      setAuthError(result?.error || 'Failed to send code');
    }
    // Success state will be detected via output stream
    setAuthCode('');
  } catch (err) {
    setAuthFlowState('failed');
    setAuthError(String(err));
  }
};

const handleRetryAuth = () => {
  setAuthFlowState('awaiting_code');
  setAuthError(null);
  setAuthCode('');
  if (oauthUrl) {
    window.electronAPI?.shell?.openExternal?.(oauthUrl);
  }
};
```

**Step 2: Add modal overlay render**

Add this before the closing `</div>` of the main component, inside the return statement:

```typescript
{/* OAuth Code Entry Modal */}
{(authFlowState === 'awaiting_code' || authFlowState === 'authenticating' || authFlowState === 'failed') && (
  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
    <div className="bg-[#1a1a1a] border border-white/20 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
      <h2 className="text-xl font-semibold text-white mb-2">
        Sign in to Gemini
      </h2>
      <p className="text-white/60 text-sm mb-6">
        Complete sign-in in your browser, then paste the authorization code below.
      </p>

      {authError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded px-3 py-2 mb-4">
          <span className="text-red-400 text-sm">{authError}</span>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={authCode}
          onChange={e => setAuthCode(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleAuthCodeSubmit()}
          placeholder="Paste authorization code..."
          disabled={authFlowState === 'authenticating'}
          className="flex-1 bg-[#0d1117] text-white placeholder-white/30 border border-white/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          autoFocus
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleAuthCodeSubmit}
          disabled={authFlowState === 'authenticating' || !authCode.trim()}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {authFlowState === 'authenticating' ? 'Authorizing...' : 'Authorize'}
        </button>

        {authFlowState === 'failed' && (
          <button
            onClick={handleRetryAuth}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-medium text-sm transition-colors"
          >
            Retry
          </button>
        )}

        <button
          onClick={onSwitchAI}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-medium text-sm transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <button
          onClick={() => oauthUrl && window.electronAPI?.shell?.openExternal?.(oauthUrl)}
          className="text-blue-400 hover:text-blue-300 text-sm underline"
        >
          Open browser again
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 3: Make the parent div relative for absolute positioning**

Change the outermost div className from:
```typescript
<div className="h-screen w-screen bg-[#0d1117] flex flex-col">
```
To:
```typescript
<div className="h-screen w-screen bg-[#0d1117] flex flex-col relative">
```

**Step 4: Build and verify no TypeScript errors**

Run: `npm run build:renderer`
Expected: Success with no errors

**Step 5: Commit**

```bash
git add src/renderer/components/TerminalUI.tsx
git commit -m "feat: add OAuth code entry modal UI"
```

---

### Task 4: Hide Raw Terminal Output During OAuth Flow

**Files:**
- Modify: `src/renderer/components/TerminalUI.tsx`

**Step 1: Conditionally hide terminal output during auth flow**

Modify the terminal output div to show a cleaner message during auth:

```typescript
{/* Terminal output area */}
<div
  ref={outputRef}
  className="flex-1 overflow-auto p-4 font-mono text-sm text-green-400 whitespace-pre-wrap break-words"
  style={{ fontFamily: 'Menlo, Monaco, Courier New, monospace' }}
>
  {authFlowState !== 'idle' && authFlowState !== 'authenticated' ? (
    <div className="text-white/50">
      Waiting for authorization...
    </div>
  ) : output ? (
    output
  ) : (
    <div className="text-green-400/50">
      {provider.toUpperCase()} CLI initialized. Type a message to start...
    </div>
  )}
</div>
```

**Step 2: Hide input area during OAuth flow**

Modify the input area to be hidden during auth:

```typescript
{/* Input area - hidden during OAuth flow */}
{authFlowState === 'idle' || authFlowState === 'authenticated' ? (
  <div className="border-t border-white/10 bg-[#0d1117] p-4">
    {/* existing input JSX */}
  </div>
) : null}
```

**Step 3: Build and verify no TypeScript errors**

Run: `npm run build:renderer`
Expected: Success with no errors

**Step 4: Commit**

```bash
git add src/renderer/components/TerminalUI.tsx
git commit -m "feat: hide terminal output during OAuth flow for cleaner UX"
```

---

### Task 5: Integration Test

**Files:** None (manual test)

**Step 1: Clear existing Gemini credentials**

Run:
```bash
rm -rf ~/.config/gemini-cli/
```

**Step 2: Start the app**

Run:
```bash
npm run dev
```

**Step 3: Click Gemini card**

Expected:
- App spawns Gemini CLI
- System browser (Safari/Chrome) opens to Google OAuth URL
- Modal appears: "Sign in to Gemini" with code entry field

**Step 4: Complete OAuth in browser**

- Sign in with Google account
- Copy the authorization code from Google's page

**Step 5: Paste code and authorize**

- Paste code in modal input
- Click "Authorize"

Expected:
- Modal shows "Authorizing..."
- CLI authenticates successfully
- Modal disappears
- TerminalUI shows ready state

**Step 6: Verify persistent auth**

- Close app
- Restart with `npm run dev`
- Click Gemini card

Expected:
- No OAuth prompt
- Direct to TerminalUI
- CLI is already authenticated

---

## Summary

| Task | Description | Time |
|------|-------------|------|
| 1 | IPC handler for system browser | 3 min |
| 2 | OAuth detection + state | 5 min |
| 3 | Modal UI component | 5 min |
| 4 | Hide raw output during auth | 3 min |
| 5 | Integration test | 5 min |

**Total estimated time: ~20 minutes**
