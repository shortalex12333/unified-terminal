# Kenoki Design Tokens — Complete Reference

## Brand Gradient (Logo/Hero Only)

```
#C7A6D8 → #D9A6C7 → #EAA7B6 → #F1A8A6
Lavender → Mauve → Dusty Rose → Warm Peach
```

**Usage:** Logo, hero elements, marketing
**Avoid:** Small UI elements, body text, buttons

---

## Accent Blue (Interactions Only)

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-accent` | `#ACCBEE` | Buttons, links, focus states |
| `--kenoki-accent-hover` | `#9FC2EA` | Hover state |
| `--kenoki-accent-soft` | `rgba(172,203,238,0.08)` | Subtle backgrounds |
| `--kenoki-accent-border` | `rgba(172,203,238,0.15)` | Borders |

---

## Semantic States

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-success` | `#7ED9B5` | Success, complete |
| `--kenoki-warning` | `#F6C177` | Warning, caution |
| `--kenoki-error` | `#F08A8A` | Error, cancel |

---

## Light Theme (Launch Screens)

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-bg` | `#E8EDF5` | Page background |
| `--kenoki-surface` | `#FFFFFF` | Cards, panels |
| `--kenoki-border` | `#E4E4E7` | Borders |
| `--kenoki-text` | `#1D1D1F` | Primary text |
| `--kenoki-text-secondary` | `#4A4A4F` | Secondary text |
| `--kenoki-text-muted` | `#8A8A93` | Muted text |
| `--kenoki-glass` | `rgba(255,255,255,0.65)` | Glass overlay |

---

## Dark Theme (Overlay)

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-bg` | `#1D1D1F` | Page background |
| `--kenoki-bg-secondary` | `#232327` | Secondary background |
| `--kenoki-surface` | `#2B2B30` | Cards, panels |
| `--kenoki-border` | `#3A3A40` | Borders |
| `--kenoki-text` | `#F4F4F4` | Primary text |
| `--kenoki-text-secondary` | `#CFCFD6` | Secondary text |
| `--kenoki-text-muted` | `#9A9AA3` | Muted text |
| `--kenoki-glass` | `rgba(30,30,34,0.65)` | Glass overlay |

---

## Tree Tokens (Dark Theme)

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-spine` | `rgba(172,203,238,0.3)` | Tree spine |
| `--kenoki-spine-done` | `rgba(172,203,238,0.6)` | Completed spine |
| `--kenoki-spine-active` | `#ACCBEE` | Active spine |
| `--kenoki-spine-pending` | `rgba(172,203,238,0.15)` | Pending spine |
| `--kenoki-dot-done` | `#9FC2EA` | Completed dot |
| `--kenoki-dot-active` | `#ACCBEE` | Active dot |
| `--kenoki-dot-pending` | `rgba(172,203,238,0.3)` | Pending dot |

---

## Radius System

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-radius-sm` | `8px` | Small elements |
| `--kenoki-radius-md` | `14px` | Medium elements |
| `--kenoki-radius-lg` | `22px` | Large cards |
| `--kenoki-radius-pill` | `999px` | Buttons, tags, inputs |

---

## Shadows

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-shadow-light` | `0px 8px 20px rgba(0,0,0,0.06)` | Light mode |
| `--kenoki-shadow-dark` | `0px 10px 30px rgba(0,0,0,0.35)` | Dark mode |

---

## Typography

```css
--kenoki-font: 'SF Pro Display', 'SF Pro Text', -apple-system, system-ui, sans-serif;
```

---

## Usage in Components

```tsx
// Apply theme class to container
<div className="theme-dark">
  <div style={{
    background: 'var(--kenoki-bg)',
    color: 'var(--kenoki-text)',
    borderRadius: 'var(--kenoki-radius-md)',
  }}>
    Content
  </div>
</div>
```
