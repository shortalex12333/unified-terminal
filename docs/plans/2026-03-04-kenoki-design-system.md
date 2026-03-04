# Kenoki Design System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert overlay components from hardcoded colors to Kenoki brand CSS variables, add StartingScreen matching prototype.

**Architecture:** Create tokens.css with CSS variables for light/dark themes. Update components incrementally to reference variables. Each task is independently verifiable.

**Tech Stack:** React, TypeScript, CSS Variables, Vite

---

### Task 1: Create Kenoki Design Tokens

**Files:**
- Create: `src/renderer/tokens.css`
- Modify: `src/renderer/styles.css`

**Step 1: Create tokens.css with all Kenoki variables**

```css
/* Kenoki Design System Tokens */

:root {
  /* Brand gradient (logo/hero only - NOT for small UI) */
  --kenoki-gradient: linear-gradient(135deg, #C7A6D8, #D9A6C7, #EAA7B6, #F1A8A6);

  /* Accent blue (interactions only) */
  --kenoki-accent: #ACCBEE;
  --kenoki-accent-hover: #9FC2EA;
  --kenoki-accent-soft: rgba(172, 203, 238, 0.08);
  --kenoki-accent-border: rgba(172, 203, 238, 0.15);

  /* Semantic states */
  --kenoki-success: #7ED9B5;
  --kenoki-warning: #F6C177;
  --kenoki-error: #F08A8A;
  --kenoki-error-soft: rgba(240, 138, 138, 0.1);

  /* Radius system */
  --kenoki-radius-sm: 8px;
  --kenoki-radius-md: 14px;
  --kenoki-radius-lg: 22px;
  --kenoki-radius-pill: 999px;

  /* Shadows */
  --kenoki-shadow-light: 0px 8px 20px rgba(0, 0, 0, 0.06);
  --kenoki-shadow-dark: 0px 10px 30px rgba(0, 0, 0, 0.35);

  /* Typography */
  --kenoki-font: 'SF Pro Display', 'SF Pro Text', -apple-system, system-ui, sans-serif;
}

/* Light theme (launch screens) */
[data-theme="light"], .theme-light {
  --kenoki-bg: #E8EDF5;
  --kenoki-bg-secondary: #F0F0F8;
  --kenoki-surface: #FFFFFF;
  --kenoki-border: #E4E4E7;
  --kenoki-text: #1D1D1F;
  --kenoki-text-secondary: #4A4A4F;
  --kenoki-text-muted: #8A8A93;
  --kenoki-glass: rgba(255, 255, 255, 0.65);
}

/* Dark theme (overlay) */
[data-theme="dark"], .theme-dark {
  --kenoki-bg: #1D1D1F;
  --kenoki-bg-secondary: #232327;
  --kenoki-surface: #2B2B30;
  --kenoki-border: #3A3A40;
  --kenoki-text: #F4F4F4;
  --kenoki-text-secondary: #CFCFD6;
  --kenoki-text-muted: #9A9AA3;
  --kenoki-glass: rgba(30, 30, 34, 0.65);
}

/* Tree-specific tokens (dark theme) */
[data-theme="dark"], .theme-dark {
  --kenoki-spine: rgba(172, 203, 238, 0.3);
  --kenoki-spine-done: rgba(172, 203, 238, 0.6);
  --kenoki-spine-active: #ACCBEE;
  --kenoki-spine-pending: rgba(172, 203, 238, 0.15);
  --kenoki-dot-done: #9FC2EA;
  --kenoki-dot-active: #ACCBEE;
  --kenoki-dot-pending: rgba(172, 203, 238, 0.3);
}
```

**Step 2: Import tokens in styles.css**

```css
@import "tailwindcss";
@import "./tokens.css";

/* Ensure body fills the screen and has a background */
html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--kenoki-bg, #1D1D1F);
  font-family: var(--kenoki-font);
}
```

**Step 3: Verify tokens load**

Run: `cd /Users/celeste7/Documents/unified-terminal && npm run dev`
Expected: App starts without CSS errors

**Step 4: Commit**

```bash
git add src/renderer/tokens.css src/renderer/styles.css
git commit -m "feat: add Kenoki design tokens CSS variables"
```

---

### Task 2: Create StartingScreen Component

**Files:**
- Create: `src/renderer/components/StartingScreen.tsx`

**Step 1: Create StartingScreen matching prototype**

```tsx
/**
 * StartingScreen Component
 *
 * First screen user sees on app launch.
 * Shows Kenoki branding and "Begin" button.
 * Matches prototype: docs/BRAND/MEDIA/PROTOTYPES/starting_screen.png
 */

import React from 'react';

interface StartingScreenProps {
  onBegin: () => void;
}

export default function StartingScreen({ onBegin }: StartingScreenProps): React.ReactElement {
  return (
    <div
      className="theme-light"
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--kenoki-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--kenoki-font)',
      }}
    >
      {/* Kenoki Logo - Script font with gradient */}
      <h1
        style={{
          fontSize: 96,
          fontWeight: 400,
          fontStyle: 'italic',
          fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
          background: 'var(--kenoki-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
          marginBottom: 8,
        }}
      >
        Kenoki
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 20,
          color: 'var(--kenoki-text)',
          margin: 0,
          marginBottom: 40,
        }}
      >
        Do more, with Kenoki.
      </p>

      {/* Begin Button */}
      <button
        onClick={onBegin}
        style={{
          padding: '14px 48px',
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--kenoki-text)',
          background: 'var(--kenoki-accent)',
          border: 'none',
          borderRadius: 'var(--kenoki-radius-pill)',
          cursor: 'pointer',
          transition: 'background 0.15s, transform 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--kenoki-accent-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--kenoki-accent)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.98)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Begin
      </button>
    </div>
  );
}
```

**Step 2: Verify component renders**

Temporarily import in App.tsx and verify visually matches prototype.

**Step 3: Commit**

```bash
git add src/renderer/components/StartingScreen.tsx
git commit -m "feat: add StartingScreen component with Kenoki branding"
```

---

### Task 3: Update ProfilePicker to Match Prototype

**Files:**
- Modify: `src/renderer/components/ProfilePicker.tsx`

**Step 1: Update ProfilePicker to use tokens and match prototype**

Key changes:
- Use `theme-light` class
- Use CSS variables for colors
- Match prototype layout: large rounded square cards with provider icons
- Update copy to "Select your app, and login"

```tsx
/**
 * ProfilePicker Component
 *
 * Provider selection screen.
 * Matches prototype: docs/BRAND/MEDIA/PROTOTYPES/select_provider.png
 */

import React, { useState } from 'react';
import { ProviderState } from './App';

export type Provider = 'chatgpt' | 'claude';

interface ProviderProfile {
  id: Provider;
  name: string;
  color: string;
  icon: string; // Emoji or character for MVP
}

const PROVIDERS: ProviderProfile[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    color: '#10a37f',
    icon: '⟡', // OpenAI-like symbol
  },
  {
    id: 'claude',
    name: 'Claude',
    color: '#cc785c',
    icon: '✦', // Claude sunburst-like symbol
  },
];

interface Props {
  onSelectProvider: (state: ProviderState) => void;
}

export default function ProfilePicker({ onSelectProvider }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (provider: Provider) => {
    setSelectedProvider(provider);
    setIsLoading(true);

    try {
      const result = await window.electronAPI?.providerView?.show?.(provider);
      if (result?.success) {
        onSelectProvider({
          provider,
          providerType: 'browserview',
        });
      } else {
        console.error('[ProfilePicker] Failed to show provider:', result?.error);
        setSelectedProvider(null);
      }
    } catch (err) {
      console.error('[ProfilePicker] Error:', err);
      setSelectedProvider(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="theme-light"
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--kenoki-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--kenoki-font)',
      }}
    >
      {/* Header */}
      <p
        style={{
          fontSize: 24,
          color: 'var(--kenoki-text)',
          margin: 0,
          marginBottom: 48,
        }}
      >
        Select your app, and{' '}
        <span style={{ color: 'var(--kenoki-accent)' }}>login</span>
      </p>

      {/* Provider cards */}
      <div style={{ display: 'flex', gap: 48 }}>
        {PROVIDERS.map((provider) => {
          const isSelected = selectedProvider === provider.id;

          return (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              disabled={isLoading}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading && !isSelected ? 0.5 : 1,
                transition: 'transform 0.15s, opacity 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Large icon card */}
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 'var(--kenoki-radius-lg)',
                  background: provider.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 64, color: 'white' }}>
                  {provider.icon}
                </span>

                {/* Loading spinner */}
                {isSelected && isLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 'var(--kenoki-radius-lg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Provider name */}
              <span
                style={{
                  fontSize: 18,
                  color: 'var(--kenoki-text)',
                }}
              >
                {provider.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
```

**Step 2: Verify component matches prototype**

Run: `npm run dev`
Expected: Provider cards are large squares with icons, matching prototype

**Step 3: Commit**

```bash
git add src/renderer/components/ProfilePicker.tsx
git commit -m "feat: update ProfilePicker to match Kenoki prototype"
```

---

### Task 4: Update ProgressTree to Use Dark Theme Tokens

**Files:**
- Modify: `src/renderer/components/ProgressTree.tsx`

**Step 1: Replace hardcoded color constants with CSS variables**

Replace the `const C = {...}` block (lines 64-87) with:

```tsx
// Colors now come from CSS variables (tokens.css)
// Component uses .theme-dark class to activate dark theme tokens
const C = {
  bg: 'var(--kenoki-bg)',
  spine: 'var(--kenoki-spine)',
  spineDone: 'var(--kenoki-spine-done)',
  spineActive: 'var(--kenoki-spine-active)',
  spinePending: 'var(--kenoki-spine-pending)',
  branchDone: 'var(--kenoki-spine-done)',
  branchActive: 'var(--kenoki-spine-active)',
  branchPending: 'var(--kenoki-spine-pending)',
  dot: 'var(--kenoki-accent)',
  dotDone: 'var(--kenoki-dot-done)',
  dotActive: 'var(--kenoki-dot-active)',
  dotPending: 'var(--kenoki-dot-pending)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  accent: 'var(--kenoki-accent)',
  accentSoft: 'var(--kenoki-accent-soft)',
  white: 'var(--kenoki-surface)',
  queryBg: 'var(--kenoki-accent-soft)',
  queryBorder: 'var(--kenoki-accent-border)',
  errorSoft: 'var(--kenoki-error-soft)',
  pauseSoft: 'rgba(246, 193, 119, 0.15)',
};
```

**Step 2: Add theme-dark class to root container**

Update the root div (around line 503):

```tsx
<div
  className="progress-tree theme-dark"
  style={{
    fontFamily: 'var(--kenoki-font)',
    // ... rest of styles
  }}
>
```

**Step 3: Verify component renders in dark mode**

Run: `npm run dev`
Expected: ProgressTree uses dark charcoal background with blue accent

**Step 4: Commit**

```bash
git add src/renderer/components/ProgressTree.tsx
git commit -m "feat: update ProgressTree to use Kenoki dark theme tokens"
```

---

### Task 5: Update AppShell to Use Dark Theme Tokens

**Files:**
- Modify: `src/renderer/components/AppShell.tsx`

**Step 1: Replace hardcoded color constants with CSS variables**

Replace the `const C = {...}` block (lines 35-49) with:

```tsx
// Colors from CSS variables (tokens.css)
const C = {
  bg: 'var(--kenoki-bg)',
  overlay: 'var(--kenoki-glass)',
  pillBg: 'var(--kenoki-accent-soft)',
  pillBgHover: 'rgba(172, 203, 238, 0.15)',
  accent: 'var(--kenoki-accent)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  border: 'var(--kenoki-accent-border)',
  white: 'var(--kenoki-surface)',
  fuelGreen: 'var(--kenoki-success)',
  fuelYellow: 'var(--kenoki-warning)',
  fuelRed: 'var(--kenoki-error)',
};
```

**Step 2: Add theme-dark class to overlay containers**

Update the building overlay div and other containers to include `className="theme-dark"`.

**Step 3: Verify component renders correctly**

Run: `npm run dev`
Expected: TopBarPill, FuelGauge, CompleteState all use dark theme

**Step 4: Commit**

```bash
git add src/renderer/components/AppShell.tsx
git commit -m "feat: update AppShell to use Kenoki dark theme tokens"
```

---

### Task 6: Wire Up App Flow with StartingScreen

**Files:**
- Modify: `src/renderer/components/App.tsx`

**Step 1: Add StartingScreen to app flow**

```tsx
import React, { useState } from 'react';
import StartingScreen from './StartingScreen';
import ProfilePicker, { Provider } from './ProfilePicker';
import ChatInterface from './ChatInterface';

export interface ProviderState {
  provider: Provider;
  providerType: 'browserview' | 'cli';
  processId?: string;
}

type AppScreen = 'starting' | 'select-provider' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('starting');
  const [providerState, setProviderState] = useState<ProviderState | null>(null);

  const handleBegin = () => {
    setScreen('select-provider');
  };

  const handleSelectProvider = (state: ProviderState) => {
    setProviderState(state);
    setScreen('chat');
  };

  const handleLogout = async () => {
    await window.electronAPI?.providerView?.hide?.();
    setProviderState(null);
    setScreen('select-provider');
  };

  // Render based on current screen
  switch (screen) {
    case 'starting':
      return <StartingScreen onBegin={handleBegin} />;

    case 'select-provider':
      return <ProfilePicker onSelectProvider={handleSelectProvider} />;

    case 'chat':
      return providerState ? (
        <ChatInterface
          provider={providerState.provider}
          onLogout={handleLogout}
        />
      ) : null;

    default:
      return <StartingScreen onBegin={handleBegin} />;
  }
}
```

**Step 2: Verify full flow**

Run: `npm run dev`
Expected:
1. App shows StartingScreen with Kenoki branding
2. Click "Begin" → Shows ProfilePicker with ChatGPT/Claude cards
3. Click provider → BrowserView loads, ChatInterface shows

**Step 3: Commit**

```bash
git add src/renderer/components/App.tsx
git commit -m "feat: wire up StartingScreen in app flow"
```

---

### Task 7: Final Verification and Cleanup

**Step 1: Run full test**

```bash
cd /Users/celeste7/Documents/unified-terminal
npm run dev
```

Verify:
- [ ] StartingScreen renders with gradient logo
- [ ] ProfilePicker shows large provider cards
- [ ] Clicking provider loads BrowserView
- [ ] No hardcoded hex colors remain in updated components

**Step 2: Build check**

```bash
npm run build:main
```

Expected: No TypeScript errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Kenoki design system migration (MVP)"
```

---

## Summary

| Task | Component | Theme | Status |
|------|-----------|-------|--------|
| 1 | tokens.css | - | Creates foundation |
| 2 | StartingScreen | Light | New component |
| 3 | ProfilePicker | Light | Update to prototype |
| 4 | ProgressTree | Dark | Token migration |
| 5 | AppShell | Dark | Token migration |
| 6 | App.tsx | - | Wire up flow |
| 7 | Verification | - | Final check |
