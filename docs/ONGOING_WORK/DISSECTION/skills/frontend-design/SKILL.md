---
skill_id: frontend-design
skill_type: frontend
version: 1.0.0
triggers: [website, landing page, dashboard, UI, design, frontend, component, button, modal, navbar, sidebar, card, table, form, chart, glassmorphism, minimalism, dark mode, responsive]
runtime: any
data_files:
  - data/styles.csv
  - data/colors.csv
  - data/typography.csv
  - data/charts.csv
---

# Frontend Design Intelligence

Comprehensive design guide for web and mobile applications. Uses BM25 ranking to search 50+ styles, 97 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types.

## Quick Start

```bash
# Run with default query
python3 skills/frontend-design/search.py

# Run with custom query
python3 skills/frontend-design/search.py "fintech dashboard dark mode"
```

## How It Works

1. **BM25 Search** - Probabilistic ranking algorithm (k1=1.5, b=0.75)
2. **CSV Data** - Style, color, typography, and chart recommendations
3. **Top 3 Results** - Returns most relevant matches with scores

## Data Files

| File | Description | Columns |
|------|-------------|---------|
| `data/styles.csv` | 50+ UI styles (glassmorphism, minimalism, etc.) | Style, Keywords, Colors, Effects, Best For |
| `data/colors.csv` | 97 color palettes by product type | Product, Primary, Secondary, CTA, Background, Text |
| `data/typography.csv` | 57 font pairings | Pairing Name, Heading Font, Body Font, Google Fonts URL |
| `data/charts.csv` | 25 chart types | Data Type, Best Chart, Color Guidance, Library |

## Search Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `style` | UI styles, effects | glassmorphism, minimalism, dark mode |
| `color` | Color palettes | saas, ecommerce, healthcare, fintech |
| `typography` | Font pairings | elegant, playful, professional, modern |
| `chart` | Data visualization | trend, comparison, pie, funnel |

## Rule Categories by Priority

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Accessibility | CRITICAL |
| 2 | Touch & Interaction | CRITICAL |
| 3 | Performance | HIGH |
| 4 | Layout & Responsive | HIGH |
| 5 | Typography & Color | MEDIUM |
| 6 | Animation | MEDIUM |
| 7 | Style Selection | MEDIUM |
| 8 | Charts & Data | LOW |

## Quick Reference - Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text
- `focus-states` - Visible focus rings on interactive elements
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order

## Quick Reference - Touch & Interaction (CRITICAL)

- `touch-target-size` - Minimum 44x44px touch targets
- `hover-vs-tap` - Use click/tap for primary interactions
- `loading-buttons` - Disable button during async operations
- `cursor-pointer` - Add cursor-pointer to clickable elements

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] Hover states don't cause layout shift

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Transitions are smooth (150-300ms)
- [ ] Focus states visible for keyboard navigation

### Light/Dark Mode
- [ ] Light mode text has sufficient contrast (4.5:1 minimum)
- [ ] Glass/transparent elements visible in light mode
- [ ] Test both modes before delivery

### Layout
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] No content hidden behind fixed navbars

## Output Example

```
=== FRONTEND DESIGN SEARCH ===
Query: SaaS premium minimal clean apple whitespace
Domain: style
Results: 3

--- Result 1 (score: 4.23) ---
Style Category: Apple Minimalism
Type: Light Mode
Keywords: clean, whitespace, premium, elegant, simple
Primary Colors: #FFFFFF, #000000, #007AFF
Effects & Animation: Subtle shadows, smooth transitions
Best For: SaaS, portfolios, premium products

--- Result 2 (score: 3.87) ---
...
```
