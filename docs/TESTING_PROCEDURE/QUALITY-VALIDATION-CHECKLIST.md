# Output Quality Validation Checklist

## Purpose

Validate that the Unified Terminal system produces websites people would actually pay for. This is the most important differentiator - not whether the pipeline works, but whether the OUTPUT is genuinely good.

**Philosophy:** The AI can claim 100% test coverage and green CI, but if the websites look like generic AI slop, we've failed. Human judgment is the final arbiter.

---

## Test Protocol

### Before Running Tests

1. **Clear browser cache** - Fresh start each time
2. **Use incognito mode** - No personalized styling leaking through
3. **Test on multiple viewport sizes** - Desktop (1920x1080), Tablet (768x1024), Mobile (375x812)
4. **Record screen** - Capture the entire build process for review

### During Each Test

1. **Use non-technical prompts** - What real users would actually say
2. **Let the full pipeline run** - No manual intervention
3. **Time the build** - Note how long each stage takes
4. **Screenshot key stages** - Initial, mid-build, final output

### After Each Test

1. **Judge the OUTPUT, not the process** - We don't care about pretty logs
2. **Score each build 1-10 on design quality** - Be harsh but fair
3. **Ask yourself: Would you pay for this?** - Honest answer only
4. **Document specific issues** - Not "looks bad" but "spacing inconsistent between cards"

---

## 10 Test Builds

### Build 1: E-commerce Store

**Prompt:** "Build me a website to sell handmade candles"

**Expected Output:**
- Product grid with at least 6 items
- Shopping cart functionality
- Checkout flow (even if mocked)
- Brand identity (logo, color scheme, typography)
- Navigation (Home, Products, About, Contact, Cart)

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Typography is intentional (not system defaults) | [ ] | |
| Color palette is cohesive (3-5 colors max) | [ ] | |
| Images are appropriately sized/optimized | [ ] | |
| Mobile responsive (no horizontal scroll) | [ ] | |
| Hero section is compelling | [ ] | |
| Product cards are consistent | [ ] | |
| CTA buttons are prominent | [ ] | |
| Footer has relevant links | [ ] | |
| Navigation is intuitive | [ ] | |
| **Would you pay $500+ for this?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 2: Photography Portfolio

**Prompt:** "I'm a photographer, I need a portfolio website"

**Expected Output:**
- Gallery with masonry or grid layout
- Individual photo pages with metadata
- About page with bio
- Contact form
- Social links

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Gallery layout showcases images well | [ ] | |
| Image loading is optimized (lazy load) | [ ] | |
| Minimal UI that doesn't compete with photos | [ ] | |
| Lightbox or full-screen view works | [ ] | |
| Mobile gallery is usable | [ ] | |
| About page has personality | [ ] | |
| Contact form is functional | [ ] | |
| Typography complements visual content | [ ] | |
| Navigation doesn't distract | [ ] | |
| **Would you pay $500+ for this?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 3: Restaurant Website

**Prompt:** "I own a Mexican restaurant called Casa Sol - make me a website with our menu"

**Expected Output:**
- Homepage with hero image of food
- Full menu with categories (Appetizers, Mains, Desserts, Drinks)
- Location and hours
- Reservation form or link
- About/story section
- Contact information

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Food imagery is appetizing | [ ] | |
| Menu is easy to read and navigate | [ ] | |
| Prices are clearly displayed | [ ] | |
| Location has map embed | [ ] | |
| Hours are prominently displayed | [ ] | |
| Mobile menu experience works | [ ] | |
| Brand colors match Mexican theme | [ ] | |
| Reservation CTA is prominent | [ ] | |
| Social proof (reviews, ratings) | [ ] | |
| **Would you pay $500+ for this?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 4: Freelancer Landing Page

**Prompt:** "I'm a freelance web developer named Alex, make me a single-page site to get clients"

**Expected Output:**
- Above-the-fold value proposition
- Skills/services section
- Portfolio/work examples
- Testimonials
- Contact CTA
- Social links

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Value proposition is clear immediately | [ ] | |
| Skills are presented professionally | [ ] | |
| Portfolio items are clickable | [ ] | |
| Testimonials feel authentic | [ ] | |
| Contact CTA stands out | [ ] | |
| Smooth scroll navigation | [ ] | |
| Professional but personable tone | [ ] | |
| Mobile experience is excellent | [ ] | |
| Loading performance is fast | [ ] | |
| **Would you pay $500+ for this?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 5: Event Invitation

**Prompt:** "Create a website for my daughter's sweet 16 birthday party on June 15th"

**Expected Output:**
- Event details (date, time, venue)
- RSVP form
- Event schedule/activities
- Photo gallery of past events (or placeholder)
- Map/directions
- Contact for questions

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Celebratory mood is established | [ ] | |
| Date/time are immediately visible | [ ] | |
| RSVP form is simple to use | [ ] | |
| Color scheme is age-appropriate | [ ] | |
| Animations are tasteful (if any) | [ ] | |
| Location is clearly communicated | [ ] | |
| Mobile-friendly for sharing | [ ] | |
| Shareable (good OG tags) | [ ] | |
| Personal touches evident | [ ] | |
| **Would you pay $200+ for this?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 6: Market Research Report

**Prompt:** "Generate a market research report website about the electric vehicle industry"

**Expected Output:**
- Executive summary
- Market size and growth data
- Key players analysis
- Trends and forecasts
- Data visualizations (charts, graphs)
- Downloadable PDF option
- Source citations

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Data visualizations are clear | [ ] | |
| Charts are interactive or well-designed | [ ] | |
| Typography is professional/corporate | [ ] | |
| Navigation through sections works | [ ] | |
| Key insights are highlighted | [ ] | |
| Sources are properly cited | [ ] | |
| PDF download works (if present) | [ ] | |
| Mobile reading experience | [ ] | |
| Overall credibility factor | [ ] | |
| **Would a business pay $1000+ for this?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 7: SaaS Landing Page

**Prompt:** "Build a landing page for my project management app called FlowTask"

**Expected Output:**
- Hero with product screenshot/demo
- Feature highlights (3-5 key features)
- Pricing tiers
- Testimonials/social proof
- FAQ section
- Sign-up CTA
- Footer with legal links

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Hero immediately explains the product | [ ] | |
| Product screenshots are professional | [ ] | |
| Feature sections are scannable | [ ] | |
| Pricing is clear and comparable | [ ] | |
| Sign-up CTA appears multiple times | [ ] | |
| Trust signals present (logos, badges) | [ ] | |
| FAQ answers likely objections | [ ] | |
| Mobile conversion path works | [ ] | |
| Modern, clean aesthetic | [ ] | |
| **Would this convert visitors?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 8: Personal Blog

**Prompt:** "I want a blog about sustainable living and minimalism"

**Expected Output:**
- Blog post list/grid
- Individual post pages
- Category/tag filtering
- About the author
- Newsletter signup
- Social sharing buttons
- Search functionality

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Reading experience is pleasant | [ ] | |
| Typography optimized for long-form | [ ] | |
| Post cards are inviting | [ ] | |
| Categories are intuitive | [ ] | |
| Individual posts have good layout | [ ] | |
| Author presence feels personal | [ ] | |
| Newsletter CTA is not annoying | [ ] | |
| Social sharing works | [ ] | |
| Search is functional | [ ] | |
| **Would this attract regular readers?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 9: Non-profit Organization

**Prompt:** "Create a website for Ocean Guardians, a marine conservation non-profit"

**Expected Output:**
- Mission statement
- Current campaigns/projects
- Donation form/CTA
- Impact statistics
- Team/leadership page
- News/blog section
- Volunteer signup
- Contact information

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Emotional impact is immediate | [ ] | |
| Mission is crystal clear | [ ] | |
| Donate CTA is prominent | [ ] | |
| Impact stats are compelling | [ ] | |
| Imagery supports the cause | [ ] | |
| Trust and credibility evident | [ ] | |
| Volunteer path is clear | [ ] | |
| Mobile donation flow works | [ ] | |
| Professional but passionate | [ ] | |
| **Would this inspire donations?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

### Build 10: Local Service Business

**Prompt:** "Make a website for Mike's Plumbing - emergency plumbing services in Austin, TX"

**Expected Output:**
- Services offered (list)
- Service area/map
- Emergency contact (prominent phone number)
- Pricing or quote request
- Reviews/testimonials
- About the business
- License/insurance info
- FAQ

**Quality Criteria:**

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Phone number is immediately visible | [ ] | |
| Services are clearly listed | [ ] | |
| Emergency availability is clear | [ ] | |
| Trust signals (licensed, insured) | [ ] | |
| Local area is specified | [ ] | |
| Reviews build confidence | [ ] | |
| Quote/contact form works | [ ] | |
| Mobile experience (people Google plumbers on phones!) | [ ] | |
| Professional appearance | [ ] | |
| **Would you call this plumber?** | [ ] Y / [ ] N | |

**Design Score:** ___/10
**Functionality Score:** ___/10

---

## Scoring Matrix

| Build | Design (1-10) | Functionality (1-10) | Would Pay? | Build Time | Major Issues |
|-------|---------------|---------------------|------------|------------|--------------|
| 1. E-commerce | | | | | |
| 2. Portfolio | | | | | |
| 3. Restaurant | | | | | |
| 4. Freelancer | | | | | |
| 5. Event | | | | | |
| 6. Research | | | | | |
| 7. SaaS | | | | | |
| 8. Blog | | | | | |
| 9. Non-profit | | | | | |
| 10. Local Business | | | | | |
| **AVERAGE** | | | **/10 Yes** | | |

---

## Quality Gates

### Hard Requirements (All must pass)

- [ ] **Average design score >= 7** - Otherwise we're producing mediocre work
- [ ] **"Would Pay?" must be Yes for >= 8/10 builds** - Commercial viability
- [ ] **No build can score below 5** - No catastrophic failures allowed
- [ ] **All builds must be mobile responsive** - Non-negotiable in 2026
- [ ] **No broken links or 404 errors** - Basic functionality
- [ ] **No console errors in production build** - Professional output

### Soft Requirements (Target but not blocking)

- [ ] Average build time under 5 minutes
- [ ] Average Lighthouse score >= 80
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] SEO basics present (titles, meta descriptions, OG tags)

---

## Common Issues to Watch For

### Visual Anti-Patterns (Immediate Deductions)

1. **Generic AI Aesthetics**
   - Gratuitous gradients (especially blue-purple)
   - Overuse of glass morphism
   - Stock photo placeholder look
   - "Everything is a card" syndrome
   - Generic blob/wave backgrounds

2. **Typography Failures**
   - System fonts only (Arial, Times)
   - Inconsistent sizing hierarchy
   - Poor line height (too tight or too loose)
   - Missing font fallbacks
   - All caps overuse

3. **Color Problems**
   - Clashing colors
   - Insufficient contrast (WCAG fail)
   - More than 5 colors (visual noise)
   - Black text on dark backgrounds
   - Pure black (#000) instead of soft black

4. **Layout Issues**
   - Inconsistent spacing (margins/padding)
   - Elements not aligned to grid
   - Sections feel disconnected
   - Too much whitespace OR too cramped
   - Horizontal scroll on mobile

5. **Image Problems**
   - Wrong aspect ratios
   - Pixelated or stretched
   - No lazy loading (slow page)
   - Missing alt text
   - Stock photos that scream "stock photo"

### Functional Anti-Patterns

1. **Navigation Failures**
   - No mobile hamburger menu
   - Broken links
   - No back-to-top button on long pages
   - Unclear current page indicator

2. **Form Issues**
   - No validation feedback
   - Submit button doesn't indicate state
   - Missing required field indicators
   - No success/error messages

3. **Performance Issues**
   - Slow initial load (>3s)
   - Layout shift during load
   - Unoptimized images (>500KB each)
   - Too many HTTP requests

---

## Automated Pre-Checks (Run Before Human Review)

The `quality-scorer.ts` module runs these automated checks:

1. **Lighthouse Audit**
   - Performance score
   - Accessibility score
   - Best practices score
   - SEO score

2. **Responsive Check**
   - Desktop (1920x1080) - no horizontal scroll
   - Tablet (768x1024) - no horizontal scroll
   - Mobile (375x812) - no horizontal scroll

3. **Asset Validation**
   - All images under 500KB
   - No broken image links
   - All CSS/JS loads

4. **Link Check**
   - No 404 errors
   - All internal links resolve

5. **Accessibility Quick Check**
   - All images have alt text
   - Color contrast passes
   - Focusable elements have focus states

---

## Rating Guide

### Design Score Rubric

| Score | Description |
|-------|-------------|
| 10 | Professional agency quality. Could win design awards. |
| 9 | Excellent design. Minor nitpicks only. Production-ready. |
| 8 | Very good. Some refinements needed but solid foundation. |
| 7 | Good. Acceptable for launch, clear improvement areas. |
| 6 | Decent. Needs work but not embarrassing. |
| 5 | Mediocre. Functional but uninspired. Generic. |
| 4 | Below average. Multiple obvious issues. |
| 3 | Poor. Feels unfinished or broken. |
| 2 | Very poor. Barely functional as a website. |
| 1 | Catastrophic. Would damage a brand. |

### Functionality Score Rubric

| Score | Description |
|-------|-------------|
| 10 | Everything works flawlessly. Edge cases handled. |
| 9 | Excellent functionality. Minor edge case misses. |
| 8 | Very good. All main flows work, some polish needed. |
| 7 | Good. Core functionality works, some issues. |
| 6 | Decent. Main features work, rough edges. |
| 5 | Mediocre. Some things work, some don't. |
| 4 | Below average. More broken than working. |
| 3 | Poor. Major features broken. |
| 2 | Very poor. Barely functions. |
| 1 | Non-functional. Critical errors throughout. |

---

## Post-Test Analysis Template

After completing all 10 tests, fill out this analysis:

### Overall Assessment

**Date of Testing:** _______________
**Tester Name:** _______________
**System Version:** _______________

### Aggregate Scores

- **Average Design Score:** ___/10
- **Average Functionality Score:** ___/10
- **"Would Pay" Rate:** ___/10
- **Quality Gate Status:** [ ] PASS / [ ] FAIL

### Patterns Observed

**Consistent Strengths:**
1.
2.
3.

**Consistent Weaknesses:**
1.
2.
3.

### Recommendations for Improvement

**Priority 1 (Blocking):**
-

**Priority 2 (High):**
-

**Priority 3 (Medium):**
-

### Comparison to Previous Test Run

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Avg Design | | | |
| Avg Function | | | |
| Would Pay | | | |
| Build Time | | | |

---

## Appendix: Test Execution Commands

```bash
# Run all 10 quality tests
npx ts-node scripts/run-quality-tests.ts

# Run specific test build
npx ts-node scripts/run-quality-tests.ts --build 1

# Run with screenshots
npx ts-node scripts/run-quality-tests.ts --screenshots

# Generate HTML report
npx ts-node scripts/run-quality-tests.ts --report html

# Run automated pre-checks only
npx ts-node scripts/run-quality-tests.ts --pre-checks-only
```
