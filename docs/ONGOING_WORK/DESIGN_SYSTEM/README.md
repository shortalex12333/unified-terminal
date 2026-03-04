# Kenoki Design System

> **Status:** Implementation Ready
> **Last Updated:** 2026-03-04

## Overview

Unified design token system for the Electron app overlay. Separates launch screens (light) from build overlay (dark).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAUNCH SCREENS                              LIGHT MODE         │
│  ─────────────────────────────────────────────────────────────  │
│  StartingScreen.tsx  →  ProfilePicker.tsx  →  BrowserView      │
│  Kenoki branding        Provider selection     (external)      │
│                                                                 │
│  Background: #E8EDF5 (light lavender)                          │
│  Button: #ACCBEE (accent blue)                                 │
│  Logo: Pastel gradient                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  OVERLAY (on top of BrowserView)             DARK MODE         │
│  ─────────────────────────────────────────────────────────────  │
│  AppShell.tsx  →  ProgressTree.tsx  →  TopBarPill              │
│  Layout states    Build progress       Minimised view          │
│                                                                 │
│  Background: #1D1D1F (charcoal)                                │
│  Glass: rgba(30,30,34,0.65) + blur(12px)                       │
│  Accent: #ACCBEE (interactions)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Token System

Single source of truth: `src/renderer/tokens.css`

```css
:root {
  /* Brand */
  --kenoki-gradient: linear-gradient(135deg, #C7A6D8, #D9A6C7, #EAA7B6, #F1A8A6);
  --kenoki-accent: #ACCBEE;

  /* Semantic */
  --kenoki-success: #7ED9B5;
  --kenoki-warning: #F6C177;
  --kenoki-error: #F08A8A;

  /* Radius */
  --kenoki-radius-pill: 999px;
}

[data-theme="light"] { /* Launch screens */ }
[data-theme="dark"]  { /* Overlay */ }
```

## Files

| File | Purpose | Theme |
|------|---------|-------|
| `tokens.css` | CSS variables | Both |
| `StartingScreen.tsx` | App launch | Light |
| `ProfilePicker.tsx` | Provider select | Light |
| `AppShell.tsx` | Overlay layout | Dark |
| `ProgressTree.tsx` | Build progress | Dark |

## Brand Reference

- `docs/BRAND/kenoki_brand_design_system.md` — Full color spec
- `docs/BRAND/MEDIA/PROTOTYPES/` — UI prototypes

## Implementation Plan

See: `docs/plans/2026-03-04-kenoki-design-system.md`
