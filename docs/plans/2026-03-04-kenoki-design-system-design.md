# Kenoki Design System — Design Document

> **Approved:** 2026-03-04
> **Approach:** Incremental Migration (Approach A)

## Goal

Convert overlay components from hardcoded blue prototype colors to Kenoki brand tokens using CSS variables.

## Screen Mapping

| Screen | File | Theme |
|--------|------|-------|
| Starting Screen | NEW `StartingScreen.tsx` | Light |
| Select Provider | `ProfilePicker.tsx` | Light |
| Top Bar Pill | `AppShell.tsx` | Dark |
| Progress Tree | `ProgressTree.tsx` | Dark |
| Complete Banner | `AppShell.tsx` | Dark |

## Token Architecture

```css
/* tokens.css */

:root {
  /* Brand gradient (logo/hero only) */
  --kenoki-gradient: linear-gradient(135deg, #C7A6D8, #D9A6C7, #EAA7B6, #F1A8A6);

  /* Accent (interactions only) */
  --kenoki-accent: #ACCBEE;
  --kenoki-accent-hover: #9FC2EA;
  --kenoki-accent-soft: rgba(172, 203, 238, 0.08);

  /* Semantic states */
  --kenoki-success: #7ED9B5;
  --kenoki-warning: #F6C177;
  --kenoki-error: #F08A8A;

  /* Radius */
  --kenoki-radius-sm: 8px;
  --kenoki-radius-md: 14px;
  --kenoki-radius-lg: 22px;
  --kenoki-radius-pill: 999px;
}

/* Light theme (launch screens) */
[data-theme="light"] {
  --kenoki-bg: #E8EDF5;
  --kenoki-surface: #FFFFFF;
  --kenoki-border: #E4E4E7;
  --kenoki-text: #1D1D1F;
  --kenoki-text-secondary: #4A4A4F;
  --kenoki-text-muted: #8A8A93;
}

/* Dark theme (overlay) */
[data-theme="dark"] {
  --kenoki-bg: #1D1D1F;
  --kenoki-surface: #2B2B30;
  --kenoki-surface-secondary: #232327;
  --kenoki-border: #3A3A40;
  --kenoki-text: #F4F4F4;
  --kenoki-text-secondary: #CFCFD6;
  --kenoki-text-muted: #9A9AA3;
  --kenoki-glass: rgba(30, 30, 34, 0.65);
}
```

## Prototype Reference

- `docs/BRAND/MEDIA/PROTOTYPES/starting_screen.png` — Kenoki logo + "Begin" button
- `docs/BRAND/MEDIA/PROTOTYPES/select_provider.png` — ChatGPT/Claude cards

## Implementation Steps

1. Create `src/renderer/tokens.css` with all variables
2. Import tokens.css in `src/renderer/styles.css`
3. Create `StartingScreen.tsx` matching prototype
4. Update `ProfilePicker.tsx` to match prototype + use tokens
5. Update `AppShell.tsx` to use dark theme tokens
6. Update `ProgressTree.tsx` to use dark theme tokens
7. Verify each component renders correctly

## Success Criteria

- [ ] Launch screens match prototypes (light mode)
- [ ] Overlay uses Kenoki dark mode colors
- [ ] All hardcoded color constants removed
- [ ] Single source of truth in tokens.css
