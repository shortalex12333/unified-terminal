# Kenoki Design Tokens — Complete Reference

## Brand Fonts

| Font | File | Use |
|------|------|-----|
| Bumbbled Regular | `fonts/Bumbbled.otf` | Logo only |
| Eloquia Display Light | `fonts/Eloquia-Display-Light.otf` | Subheaders, taglines |
| Poppins Regular | `fonts/Poppins-Regular.ttf` | Buttons, UI text |

**Location:** `src/renderer/fonts/`

---

## Brand Gradient (Logo Only)

```
#e6c3df → #fcc5cb @135°
Pink Lavender → Soft Coral
```

**Token:** `--kenoki-gradient`
**Usage:** Logo text only
**Avoid:** Small UI elements, body text, buttons

---

## Primary Blue (Buttons)

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-primary` | `#1b70db` | Primary buttons |
| `--kenoki-primary-hover` | `#1560c0` | Button hover state |

---

## Accent Blue (Interactions)

| Token | Value | Use |
|-------|-------|-----|
| `--kenoki-accent` | `#ACCBEE` | Links, focus states |
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
| `--kenoki-bg` | `#e7f0fd` | Page background |
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

## File Structure

```
src/renderer/
├── fonts/
│   ├── Bumbbled.otf           # Logo font
│   ├── Eloquia-Display-Light.otf  # Subheader font
│   └── Poppins-Regular.ttf    # Button/UI font
├── fonts.css                  # @font-face declarations
├── tokens.css                 # CSS variables
├── styles.css                 # Global styles (imports fonts + tokens)
└── components/
    ├── StartingScreen.tsx     # Light theme - launch
    ├── ProfilePicker.tsx      # Light theme - provider select
    ├── ProgressTree.tsx       # Dark theme - build progress
    └── AppShell.tsx           # Dark theme - overlay shell
```

---

## StartingScreen Specs

| Element | Font | Color | Notes |
|---------|------|-------|-------|
| Logo "Kenoki" | Bumbbled Regular | Gradient | 96px |
| Tagline | Eloquia Display Light | #1d1d1f | 20px |
| Begin button | Poppins Regular | #ffffff on #1b70db | Pill radius |
| Background | — | #e7f0fd | Full viewport |

---

## Usage Example

```tsx
// StartingScreen uses light theme
<div className="theme-light">
  <h1 style={{
    fontFamily: "'Bumbbled', cursive",
    background: 'var(--kenoki-gradient)',
    WebkitBackgroundClip: 'text',
  }}>
    Kenoki
  </h1>

  <button style={{
    fontFamily: "'Poppins', sans-serif",
    background: 'var(--kenoki-primary)',
    color: '#ffffff',
  }}>
    Begin
  </button>
</div>
```
