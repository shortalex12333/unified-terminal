# Domain D: Frontend & Design

## What This Domain Covers
Visual UI generation: websites, dashboards, landing pages. The domain where LLM output is most visibly mediocre without design intelligence injected.

## Actors
| Actor | Role | Rail |
|-------|------|------|
| Skill Injector | Detects frontend task, loads skill-frontend-design/ with CSVs + BM25 results. | HARD (code match) |
| Worker (builder) | Receives design system pre-loaded. Generates code matching design tokens. | Output verified by Bodyguard |
| Intake | Captures aesthetic preference. Default: Apple-like. | SOFT + defaults |
| Worker (image-gen) | Routes image requests to ChatGPT/DALL-E via web executor. | Output: file existence check |

---

## Absorbed

### From ui-ux-pro-max-skill (36k stars)
**CSV databases (~500KB total):**
- `styles.csv` -- Design system patterns (minimal, brutalist, playful, corporate, etc.)
- `colors.csv` -- Color palettes mapped to moods and industries
- `typography.csv` -- Font pairings with use cases
- `charts.csv` -- Data visualization patterns

**BM25 search script (~400 lines Python):**
Runs at skill injection time. Takes user description (or default), searches CSV databases, returns top matching design system parameters.

**What we took:** The CSV data files and the BM25 search logic.
**What we changed:** Wrapped in our Skill Injector flow. Default query hardcoded:
```
defaultQuery = "SaaS premium minimal clean apple whitespace"
```
Returns: white space dominant, SF Pro/Inter typography, neutral palette, large hero sections, subtle shadows, no gradients.

**Critical insight:** This is an INTAKE decision, not a Skill Injector decision. The Intake layer either captures user aesthetic preference or falls through to Apple-like default. Skill Injector receives the RESOLVED preference.

**Location:** `/skills/frontend-design/data/*.csv`, `/skills/frontend-design/search.py`

### From product architecture
**worker-image-gen.md**
Routes image generation requests to ChatGPT web executor (DALL-E). Handles: hero images, logos, product photos, backgrounds.
Location: `/skills/workers/worker-image-gen.md`

---

## External Tools
| Tool | Status | Why |
|------|--------|-----|
| Sharp | KEPT | Image optimization. Node-native. Processes hero images, logos, thumbnails after generation. |
| ImageMagick | DELETED | Sharp wins for Node stack. ImageMagick is system dependency we dont need. |

---

## The llms.txt Feature (Zero-Cost Killer Feature)

After ANY site build completes:
1. Archivist reads PROJECT-ARCHIVE.md (already generated)
2. Templates llms.txt from same data:
```
# {project_name}
> {one-line description from intake}

## About
{what the business does}

## Pages
{list of routes built}

## Tech
Built with {stack}. Deployed at {url}.
```
3. Also generates llms-full.txt with deeper page content
4. User notification: "We created llms.txt so AI assistants can understand your site when it goes live."

**No extra LLM calls. Pure string templating. User did not ask for it. They feel like they got something nobody else offers.**

---

## Hard Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| HTML validity | `htmlhint` exit code 0/non-0 | BLOCK. Invalid HTML not deployed. |
| Responsive | Playwright screenshots at 3 viewports (375px, 768px, 1440px). Files must exist. | BLOCK. Must be responsive. |
| Image optimization | Sharp output file size < input (or within 10%). `fs.statSync()` compare. | WARN. Images should be optimized. |

## Soft Rails
| Check | Implementation | On Failure |
|-------|---------------|------------|
| Design compliance | LLM checks generated code against injected design tokens | WARN. Regenerate if confidence < 0.5. |
| Visual quality | Screenshot + LLM: "Professional or Bootstrap 2019?" | WARN. Subjective but catches obvious failures. |
| Accessibility | LLM checks for alt tags, contrast, keyboard nav basics | WARN. Log issues. |
