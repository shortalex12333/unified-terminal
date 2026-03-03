# GATES 15-16: CLI Authentication Flows

**Status:** PRE-PLANNING → IN PROGRESS
**Created:** 2026-03-03
**Estimate:** 2-4 hours total

---

## CONTEXT

The app already has `src/main/cli-auth.ts` which handles authentication for:
- ✅ `codex` CLI (OpenAI)
- ✅ `claude-code` CLI (Anthropic)

We need to extend this to also support:
- ⏳ `gemini` CLI (Google)

All three follow the same pattern: **browser-based OAuth → poll for completion → store tokens locally**.

---

## GATE 15: GEMINI CLI OAUTH

### What We Know

**CLI installed at:** `/opt/homebrew/bin/gemini`

**Config location:** `~/.gemini/`
- `oauth_creds.json` — OAuth tokens
- `google_accounts.json` — Account info
- `settings.json` — User preferences
- `state.json` — Session state

**Auth pattern:** Gemini CLI prompts for OAuth on first run or when credentials expire. Opens system browser to Google accounts login. No explicit `gemini auth` command - just run `gemini` and it handles auth automatically.

### Implementation Spec

#### 1. Add Gemini to CLITool type

```typescript
// cli-auth.ts line 25
export type CLITool = 'codex' | 'claude-code' | 'gemini';
```

#### 2. Add Gemini auth patterns

```typescript
// cli-auth.ts AUTH_PATTERNS
gemini: {
  googleAuth: /google|sign in|accounts\.google|oauth|authorization/i,
  tos: /terms|accept|agree|continue|y\/n|yes\/no/i,
  token: /token|api.key|secret|paste|enter.*key/i,
  question: /\?\s*$|\[y\/n\]|\[yes\/no\]|press enter|confirm/i,
},
```

#### 3. Add Gemini token paths

```typescript
// cli-auth.ts TOKEN_PATHS
gemini: [
  '.gemini/oauth_creds.json',
  '.gemini/google_accounts.json',
],
```

#### 4. Add Gemini OAuth providers

```typescript
// shouldInterceptUrl function
const oauthProviders = [
  'github.com/login',
  'accounts.google.com',      // Already present - used by Gemini
  'auth.anthropic.com',
  'console.anthropic.com',
  'openai.com/auth',
  'api.openai.com',
];
```

#### 5. Update checkAllAuthStatus

```typescript
export async function checkAllAuthStatus(): Promise<AuthStatus[]> {
  const tools: CLITool[] = ['codex', 'claude-code', 'gemini'];
  return Promise.all(tools.map(tool => isAuthenticated(tool)));
}
```

---

## GATE 16: AUTH SCREEN COMPONENT

### What We Need

A React component that:
1. Shows list of CLI tools with auth status
2. Allows user to initiate auth flow for each tool
3. Handles OAuth browser popup
4. Polls for completion
5. Shows success/failure state

### File: `src/renderer/components/AuthScreen.tsx`

```tsx
import React, { useState, useEffect } from 'react';

interface ToolAuth {
  tool: string;
  name: string;
  status: 'checking' | 'authenticated' | 'needs-auth' | 'authenticating' | 'failed';
  error?: string;
}

const TOOLS: ToolAuth[] = [
  { tool: 'codex', name: 'OpenAI Codex', status: 'checking' },
  { tool: 'claude-code', name: 'Claude Code', status: 'checking' },
  { tool: 'gemini', name: 'Google Gemini', status: 'checking' },
];

export default function AuthScreen({ onComplete }: { onComplete: () => void }) {
  const [tools, setTools] = useState<ToolAuth[]>(TOOLS);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check auth status for all tools
    checkAuthStatus();

    // Listen for auth progress
    window.api.auth.onProgress((data) => {
      setTools(prev => prev.map(t =>
        t.tool === data.tool
          ? { ...t, status: data.status, error: data.error }
          : t
      ));
    });
  }, []);

  const checkAuthStatus = async () => {
    setIsChecking(true);
    const statuses = await window.api.auth.checkAll();

    setTools(prev => prev.map(t => {
      const status = statuses.find(s => s.tool === t.tool);
      return {
        ...t,
        status: status?.isAuthenticated ? 'authenticated' : 'needs-auth',
      };
    }));
    setIsChecking(false);

    // If all authenticated, move on
    if (statuses.every(s => s.isAuthenticated)) {
      setTimeout(onComplete, 1000);
    }
  };

  const handleAuth = async (tool: string) => {
    setTools(prev => prev.map(t =>
      t.tool === tool ? { ...t, status: 'authenticating' } : t
    ));

    const success = await window.api.auth.authenticate(tool);

    setTools(prev => prev.map(t =>
      t.tool === tool
        ? { ...t, status: success ? 'authenticated' : 'failed' }
        : t
    ));

    // Check if all are now authenticated
    const allAuth = tools.every(t =>
      t.tool === tool ? success : t.status === 'authenticated'
    );
    if (allAuth) {
      setTimeout(onComplete, 1000);
    }
  };

  const handleSkip = () => {
    // Allow skipping if at least one tool is authenticated
    const anyAuth = tools.some(t => t.status === 'authenticated');
    if (anyAuth) {
      onComplete();
    }
  };

  const authCount = tools.filter(t => t.status === 'authenticated').length;

  return (
    <div className="flex flex-col h-full">
      <div className="titlebar-drag h-12 flex items-center px-20 shrink-0">
        <span className="text-sm font-semibold text-white/60 select-none">
          Sign In
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1">Connect Your Accounts</h2>
          <p className="text-sm text-white/50">
            Sign in to enable AI coding tools. You need at least one.
          </p>
        </div>

        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.tool}
              className="flex items-center gap-3 px-3 py-3 rounded-lg bg-surface-2"
            >
              {/* Status indicator */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                tool.status === 'authenticated' ? 'bg-success' :
                tool.status === 'authenticating' ? 'bg-accent animate-pulse' :
                tool.status === 'failed' ? 'bg-danger' :
                tool.status === 'checking' ? 'bg-white/20 animate-pulse' :
                'bg-white/10'
              }`} />

              {/* Name */}
              <span className="flex-1 text-sm text-white/80">{tool.name}</span>

              {/* Action button */}
              {tool.status === 'authenticated' ? (
                <span className="text-xs text-success">Connected</span>
              ) : tool.status === 'authenticating' ? (
                <span className="text-xs text-accent">Signing in...</span>
              ) : tool.status === 'checking' ? (
                <span className="text-xs text-white/30">Checking...</span>
              ) : tool.status === 'failed' ? (
                <button
                  onClick={() => handleAuth(tool.tool)}
                  className="text-xs text-danger hover:text-danger/80"
                >
                  Retry
                </button>
              ) : (
                <button
                  onClick={() => handleAuth(tool.tool)}
                  className="text-xs text-accent hover:text-accent/80"
                >
                  Sign In
                </button>
              )}
            </div>
          ))}
        </div>

        {tools.some(t => t.status === 'failed' && t.error) && (
          <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20">
            <p className="text-xs text-danger">
              {tools.find(t => t.status === 'failed')?.error}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 space-y-2">
        <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${(authCount / tools.length) * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-xs text-white/30">
            {authCount} of {tools.length} connected
          </p>

          {authCount > 0 && (
            <button
              onClick={handleSkip}
              className="text-xs text-white/40 hover:text-white/60"
            >
              Continue with {authCount} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## IPC UPDATES

### preload.ts additions

```typescript
auth: {
  checkAll: () => ipcRenderer.invoke('cli:auth-status-all'),
  authenticate: (tool: string) => ipcRenderer.invoke('cli:auth-start', tool),
  onProgress: (cb: (data: any) => void) => {
    ipcRenderer.on('cli:auth-prompt', (_e, data) => cb(data));
    ipcRenderer.on('cli:auth-result', (_e, data) => cb(data));
  },
},
```

### global.d.ts additions

```typescript
interface Window {
  api: {
    // ... existing
    auth: {
      checkAll: () => Promise<AuthStatus[]>;
      authenticate: (tool: string) => Promise<boolean>;
      onProgress: (cb: (data: AuthProgress) => void) => void;
    };
  };
}
```

---

## ACCEPTANCE CRITERIA

### Gate 15: Gemini Auth
- [ ] `CLITool` type includes 'gemini'
- [ ] `TOKEN_PATHS` includes gemini paths
- [ ] `AUTH_PATTERNS` includes gemini patterns
- [ ] `isAuthenticated('gemini')` correctly detects auth state
- [ ] `startAuthFlow('gemini')` spawns gemini and opens OAuth
- [ ] OAuth window intercepts Google accounts login
- [ ] Auth completion is detected and reported

### Gate 16: Auth Screen
- [ ] AuthScreen.tsx renders list of 3 tools
- [ ] Auth status is checked on mount
- [ ] Sign In button triggers auth flow
- [ ] OAuth opens in Electron window (not system browser)
- [ ] Progress events update UI
- [ ] Success/failure states display correctly
- [ ] Can skip with partial auth
- [ ] All authenticated → auto-proceed

### Tests
- [ ] test for gemini auth detection
- [ ] test for gemini auth flow spawn
- [ ] test for auth screen rendering
- [ ] test for auth status aggregation

---

## FILES TO CREATE/MODIFY

| File | Action | Description |
|------|--------|-------------|
| `src/main/cli-auth.ts` | MODIFY | Add gemini support |
| `src/renderer/components/AuthScreen.tsx` | CREATE | Auth UI component |
| `src/main/preload.ts` | MODIFY | Add auth IPC |
| `src/renderer/global.d.ts` | MODIFY | Add auth types |
| `src/renderer/App.tsx` | MODIFY | Wire AuthScreen |
| `tests/cli-auth-gemini.test.ts` | CREATE | Gemini auth tests |

---

## AGENT DISPATCH

### Agent 1: Backend Auth Extension
**Task:** Extend cli-auth.ts with Gemini support
**Files:** cli-auth.ts
**Tests:** cli-auth-gemini.test.ts

### Agent 2: Frontend Auth Screen
**Task:** Create AuthScreen.tsx + wire into App.tsx
**Files:** AuthScreen.tsx, App.tsx, preload.ts, global.d.ts

### Agent 3: Integration Tests
**Task:** Write and run integration tests
**Files:** tests/cli-auth-integration.test.ts
