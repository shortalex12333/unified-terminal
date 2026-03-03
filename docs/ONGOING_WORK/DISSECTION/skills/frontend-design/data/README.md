# Frontend Design Data Files

This directory contains CSV data files for the BM25 search engine.

## Required Files

The following CSV files need to be populated from the ui-ux-pro-max repository:

### 1. styles.csv

UI style definitions (50+ styles).

**Required Columns:**
| Column | Description | Example |
|--------|-------------|---------|
| Style Category | Name of the style | Glassmorphism |
| Type | Light Mode / Dark Mode | Dark Mode |
| Keywords | Searchable keywords | glass, blur, transparent, modern |
| Primary Colors | Hex color codes | #FFFFFF, #000000 |
| Effects & Animation | Visual effects | backdrop-blur, shadow-xl |
| Best For | Recommended use cases | SaaS, dashboards, portfolios |
| Performance | Performance impact | Medium (blur is expensive) |
| Accessibility | A11y notes | Ensure text contrast |
| Framework Compatibility | Supported frameworks | Tailwind, CSS |
| Complexity | Implementation difficulty | Medium |
| AI Prompt Keywords | Keywords for AI generation | frosted glass effect |
| CSS/Technical Keywords | Technical implementation | backdrop-filter: blur |
| Implementation Checklist | Steps to implement | 1. Add blur 2. Add opacity |
| Design System Variables | CSS variables | --glass-blur, --glass-bg |

### 2. colors.csv

Color palettes by product type (97 palettes).

**Required Columns:**
| Column | Description | Example |
|--------|-------------|---------|
| Product Type | Type of product | SaaS Dashboard |
| Primary (Hex) | Primary color | #3B82F6 |
| Secondary (Hex) | Secondary color | #10B981 |
| CTA (Hex) | Call-to-action color | #F59E0B |
| Background (Hex) | Background color | #FFFFFF |
| Text (Hex) | Text color | #1F2937 |
| Notes | Usage notes | Use CTA sparingly |

### 3. typography.csv

Font pairings (57 pairings).

**Required Columns:**
| Column | Description | Example |
|--------|-------------|---------|
| Font Pairing Name | Name of pairing | Tech Modern |
| Category | Style category | Sans-serif |
| Heading Font | Font for headings | Inter |
| Body Font | Font for body text | Open Sans |
| Mood/Style Keywords | Mood keywords | clean, modern, tech |
| Best For | Recommended use cases | SaaS, tech startups |
| Google Fonts URL | Import URL | fonts.google.com/... |
| CSS Import | CSS import code | @import url(...) |
| Tailwind Config | Tailwind font config | fontFamily: {...} |
| Notes | Additional notes | Great x-height |

### 4. charts.csv

Chart type recommendations (25 types).

**Required Columns:**
| Column | Description | Example |
|--------|-------------|---------|
| Data Type | Type of data | Time series |
| Keywords | Searchable keywords | trend, over time |
| Best Chart Type | Primary recommendation | Line chart |
| Secondary Options | Alternative charts | Area chart, Bar chart |
| Color Guidance | Color recommendations | Use sequential colors |
| Accessibility Notes | A11y considerations | Add patterns for colorblind |
| Library Recommendation | Suggested libraries | Recharts, Chart.js |
| Interactive Level | Interactivity level | High (hover, zoom) |

## Data Source

These CSV files should be fetched from the ui-ux-pro-max skill repository:
- `styles.csv` - UI styles database
- `colors.csv` - Color palettes database
- `typography.csv` - Font pairings database
- `charts.csv` - Chart recommendations database

## Placeholder Data

Until the actual CSVs are fetched, the search will return an error indicating missing files. To test the search functionality, create minimal CSV files with sample data matching the column structure above.

## Example Minimal styles.csv

```csv
Style Category,Type,Keywords,Primary Colors,Effects & Animation,Best For
Apple Minimalism,Light Mode,"clean, whitespace, premium, apple",#FFFFFF #000000 #007AFF,subtle shadows smooth transitions,SaaS portfolios premium
Glassmorphism,Dark Mode,"glass, blur, transparent, modern",#FFFFFF10 #FFFFFF20,backdrop-blur shadow-xl,dashboards cards modals
Brutalism,Dark Mode,"bold, raw, aggressive, unconventional",#000000 #FF0000,none hard edges,creative agencies art portfolios
```
