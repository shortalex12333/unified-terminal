### Illustrating Plan made by agents during PLANNING phawe of product use-case

### Start /Context 
Read the = the PLAN_REVIEW checkpoint from the Status Agent spec, this docuemnt is about forwarding planning ai agents in our app ahve made, and ensuring we ar ealligned with user.

We  need to transpose the "plan" when made?. like gsd, when plan is made, llm request "accept plan and move forward"? this is paramount to hash out details, ensure we are alligned. majority will say "yeah go for it regardless. but how can we articualte this plan to frontend in pretty way (simply transpose typogrpahy, spacing, radius etc with brand colouring to be more readable), and then forward remarks ebfore proceeding.
We haven't defined HOW the plan renders. The checkpoint exists as a blocking gate ("Here's what I'm going to build. Look good?") but the actual plan presentation is undefined. It just says "show plan" without specifying what that looks like.

The plan needs to be readable by someone who has never seen a DAG, doesn't know what "scaffold" means, and will spend 3 seconds looking at it before hitting "Go." But it also needs enough detail that someone who DOES care can see what's coming and correct it before 45 minutes of work starts.

The rendering is a card — not a list, not a table, not JSON. A card with sections that breathe, using the Kenoki design tokens you already have.

c Details
What the Conductor produces (technical):
```json
{
  "steps": [
    { "id": 1, "action": "codex_scaffold", "detail": "Next.js project with Tailwind", "runtime": "cli", "waitFor": [] },
    { "id": 2, "action": "web_research", "detail": "Competitor candle brands", "runtime": "web", "waitFor": [] },
    { "id": 3, "action": "codex_build", "detail": "Homepage with hero, nav, footer", "runtime": "cli", "waitFor": [1] },
    { "id": 4, "action": "dall_e", "detail": "Hero image, product photos, logo", "runtime": "web", "waitFor": [2] },
    { "id": 5, "action": "codex_build", "detail": "Product gallery with filter", "runtime": "cli", "waitFor": [1] },
    { "id": 6, "action": "codex_build", "detail": "Stripe checkout integration", "runtime": "cli", "waitFor": [3,5] },
    { "id": 7, "action": "codex_build", "detail": "Contact form with email", "runtime": "cli", "waitFor": [3] },
    { "id": 8, "action": "test_suite", "detail": "Full test pass + Lighthouse", "runtime": "cli", "waitFor": [6,7] },
    { "id": 9, "action": "deploy", "detail": "Vercel deploy", "runtime": "cli", "waitFor": [8] }
  ]
}
```
### Frontend UX
What the user sees (translated by the Status Agent's plan formatter):

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Your Candle Store                                         │
│  Here's what I'm planning to build:                        │
│                                                            │
│  ─────────────────────────────────────────────────         │
│                                                            │
│  📐  Set up the foundation                                 │
│      Next.js project with modern styling                   │
│                                                            │
│  🔎  Research your competitors                              │
│      Look at other candle brands for inspiration           │
│                                                            │
│  🏠  Build your homepage                                    │
│      Hero section, navigation, footer                      │
│                                                            │
│  🎨  Create your brand images                               │
│      Hero banner, product photos, logo                     │
│                                                            │
│  🛍️  Product gallery                                        │
│      Browsable products with filtering                     │
│                                                            │
│  💳  Set up payments                                        │
│      Stripe checkout so customers can buy                  │
│                                                            │
│  ✉️  Contact form                                           │
│      Email form so customers can reach you                 │
│                                                            │
│  ✅  Test everything                                        │
│      Make sure it all works on every device                │
│                                                            │
│  🚀  Publish your site                                      │
│      Live on the internet with your own URL                │
│                                                            │
│  ─────────────────────────────────────────────────         │
│                                                            │
│  ⏱  Estimated time: ~40 minutes                            │
│  📄  9 steps, mostly automatic                              │
│  💬  I'll check in with you a couple of times              │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────────┐           │
│  │   Let's build!   │  │  Change something    │           │
│  └──────────────────┘  └──────────────────────┘           │
│                                                            │
│  Or type what you'd like to change:                        │
│  [                                              ] [Send]   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The translation from technical DAG to this card is a function in the Status Agent — same pattern as the event translator, just for plans specifically:

```typescript
const STEP_HUMANIZER: Record<string, { icon: string; label: string; descriptionFn: (detail: string) => string }> = {
  "codex_scaffold": { icon: "📐", label: "Set up the foundation",     descriptionFn: (d) => simplifyTech(d) },
  "web_research":   { icon: "🔎", label: "Research your competitors",  descriptionFn: (d) => d },
  "codex_build":    { icon: "🏠", label: null,                         descriptionFn: (d) => humanizeBuildStep(d) },
  "dall_e":         { icon: "🎨", label: "Create your brand images",   descriptionFn: (d) => d },
  "test_suite":     { icon: "✅", label: "Test everything",            descriptionFn: () => "Make sure it all works on every device" },
  "deploy":         { icon: "🚀", label: "Publish your site",          descriptionFn: () => "Live on the internet with your own URL" },
};
```

### Summary

Where `simplifyTech` strips jargon: "Next.js project with Tailwind" becomes "Modern website with styling." "Stripe checkout integration" becomes "So customers can buy." The user never sees framework names.

When the user clicks "Change something" or types a modification, that feeds back through the Status Agent → PA → Conductor. The Conductor re-plans with the user's feedback incorporated, emits a new `conductor:plan-ready` event, and the plan card re-renders with the updated steps. The user can iterate on the plan before a single agent starts working.

This is the same QueryWidget mechanism from the spec — the plan card IS a query with `type: "confirm"` and `priority: "blocking"`. The Conductor pauses until the user approves. The only new piece is the plan formatter that turns DAG JSON into the readable card layout. That's a pure function — takes DAG steps, returns an array of `{ icon, label, description }` objects that the React component renders with Kenoki tokens.

The "majority will say yeah go for it" insight is handled by the timeout: if the user doesn't respond within 2 minutes, it auto-approves. But the plan is still VISIBLE in the tree — they can scroll back and see what was planned even after it started executing. And if they spot something wrong mid-build, the interrupt handler lets them correct it surgically without stopping everything.

