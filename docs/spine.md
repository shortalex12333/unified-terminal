 Here’s a complete, production‑grade spec for the two‑column, scroll‑driven hero that explains the roles and shows users
  how Kenoki works. It’s designed to be visually premium, understandable to non‑technical users in ~10 seconds, and stunning
  enough to anchor the brand. It replaces “paragraph hero + chips” with a kinetic explanation: left side shows the frontend
  view (what the user “sees” happening), right side shows the system’s living topology (spine + roots) growing as you scroll.

  Use this as your single source of truth to design and build. No fluff, just what’s needed to execute cleanly.

  Overview

  - Intent: Make users “get it” in seconds via motion. Show outcomes and orchestration together. Eliminate jargon; let motion
    carry meaning.
  - Composition: Two synchronized columns that scroll as the user moves. Left = App Viewer (frontend) with clean shots of
    what’s building; Right = Topology Tree (spine + branches) that grows with each “chapter” of the scroll.
  - Tone: Premium, quiet, focused. Whitespace-driven. Little text. A single gradient wordmark above, then this two-column
    story. No secondary pills cluttering the moment.

  Layout (hero)

  - Above the fold:
      - Top: Gradient wordmark “Kenoki” (Bumbbled, 64/44, 135° brand gradient).
      - Immediately below: The two-column scrollytelling module fills the viewport height and extends 200–300vh for
        narrative.
  - Two columns:
      - Left: “App Viewer” — a clean, borderless canvas that displays the overlay timeline (planning → creating → testing →
        preview), subtle screenshots, and a single live “Proof chip” when relevant.
      - Right: “Topology Tree” — a living diagram: a vertical “Spine” (Tier 1 Router) with roots branching out for each role
        as you scroll (Bodyguard rails, Elder planner, Executors, MCP connectors, etc.).
  - Grid:
      - Desktop: max width 1200px; columns split ~58% (left) / 42% (right), 24px gutter; 64px top/bottom padding.
      - Mobile: collapses to stacked, same sequence; animation switches to step‑per‑section reveals (no scrubbing).
  - Colors:
      - Background: #FAFAFA; Surfaces: #FFFFFF; Primary text: #1D1D1F; Secondary text: #4A4A4F; Accent links: #ACCBEE.
  - Type:
      - Display (wordmark only): Bumbbled.
      - Headings/subheadings: Eloquia Display Light (300).
      - Body/UI: Poppins 400/500; min 18/28 for body, 15/24 for small.

  Scroll Choreography (high level)

  - Scroll length: 8–10 “frames” (chapters), each ~80–120vh. Each frame has:
      - An App Viewer state (left).
      - A Tree transition (right).
      - A single 1‑line caption (grade‑6, < 10 words).
  - Sync engine: Scroll progress (0–1) drives both columns using a central timeline. On larger viewports, the left and right
    panels pin while internal elements animate; on mobile, the panels stack and each frame becomes a discrete section.
  - Motion language:
      - The spine grows vertically as you scroll.
      - Branches “sprout” from the spine at precise frames (with subtle growth and easing).
      - App Viewer text uses simple fades/slide‑ins; preview thumbs cross‑fade to keep it calm.
  - Reduced motion: Respect prefers‑reduced‑motion; collapse to discrete steps with instant state changes and minimal fades.

  Frame‑by‑Frame Narrative
  Each frame reveals exactly one part of the story. Left = App Viewer; Right = Topology Tree. Below are the frames with copy
  lines, roles, and animation notes.

  Frame 1 — The Spine (Tier 1)

  - Caption: “Understand and plan.”
  - Left (App Viewer): Minimal UI with a single line: “Understanding what you need…” A soft progress tick appears (one dot).
  - Right (Tree): A single vertical bar (Spine) grows from bottom to top. A faint node pulsing indicates “Router active.”
  - Notes:
      - This is the routing brain. It reads context, not code yet.
      - Animation: spine growth (scaleY from 0.2 → 1), gentle pulse at the top node.

  Frame 2 — Hard Rails + Bodyguard

  - Caption: “Stay in bounds.”
  - Left: “Safety checks on.” A small shield icon appears with “rails locked.”
  - Right: A subtle rounded “rail” outline wraps the spine; a shield node snaps into place at mid-spine (Bodyguard).
  - Notes:
      - This is your safety engine: prompt guards, binary checks, refusal routes.
      - Animation: shield scales in from 0.8 with 80ms bounce; rails draw in (stroke-dashoffset animation).

  Frame 3 — Elder (Planner, complex only)

  - Caption: “Expand the plan.”
  - Left: “Generating a clean plan…” shows a single card with 3–5 steps (scaffold → build → test → preview).
  - Right: A larger “Elder” node attaches above mid-spine (Tier 2), connected with a soft line, then dematerializes for
    simple tasks (for complex, it remains visible longer).
  - Notes:
      - Elder appears only if complexity triggers it; otherwise it flickers in/out subtly.
      - Animation: elder node fade/scale with a connecting line grow.

  Frame 4 — Intake (first touch)

  - Caption: “Ask three simple questions.”
  - Left: Three short questions appear, one per line, then fade to a “Brief ready” badge.
  - Right: A small intake node sprouts near the top spine. The spine changes hue slightly (indicating context updated).
  - Notes:
      - Intake lives on the web side (ChatGPT window), not CLI.
      - The Branch is marked “intake_quiz” with a small bubble indicator.

  Frame 5 — Executors Spring (Roots)

  - Caption: “Do the work.”
  - Left: Timeline updates: “Scaffold,” “Build pages,” “Write copy,” with a calm progress tick.
  - Right: First roots appear off the spine:
      - Left forward branch: “Web” (intake/content/images/search icon).
      - Right forward branch: “CLI” (scaffold/build/test/git).
      - A third “Service” branch spawns later when needed (MCP connects).
  - Notes:
      - This is your “team arrives” moment; branches are clearly labeled but minimal.
      - Animation: branch curves grow from the spine to their nodes (ease in/out).

  Frame 6 — Image Generator (Web‑only)

  - Caption: “Use images when needed.”
  - Left: Small DALL‑E image chip slides in, then a hero placeholder updates to a real mock image (soft cross‑fade).
  - Right: A tiny image node appears off the Web branch; an arrow points back to the “Build pages” node to show handoff.
  - Notes:
      - Reinforces that image generation happens via the web branch.

  Frame 7 — Just‑in‑Time Connects (MCP)

  - Caption: “Connect only when needed.”
  - Left: “Payments optional → Connect Stripe?” Mini card appears with “Skip for now.”
  - Right: A Service branch sprouts (Stripe) with an on/off indicator; nodes appear only if chosen.
  - Notes:
      - Avoids upfront overwhelm. Timing is just‑in‑time.

  Frame 8 — Bodyguard + Verification

  - Caption: “Check everything.”
  - Left: “Testing everything works…” with a check animation; if fail, you see “Fixing an issue…” transiently before check
    returns.
  - Right: The Bodyguard node glows; small binary “check” dots pass along the branch returns.
  - Notes:
      - Students the “we don’t ship broken” promise.

  Frame 9 — Live Preview

  - Caption: “See it evolve.”
  - Left: Preview thumb appears; a button “Open preview” (just a visual indicator here).
  - Right: A “Preview” leaf appears; a tiny link icon shows outward.
  - Notes:
      - This frame must feel magical but calm—no fireworks.

  Frame 10 — Deploy

  - Caption: “Go live when ready.”
  - Left: “Publish to Vercel?” small card; then “Your site is live → view.”
  - Right: Service branch “Vercel” pops in, then locks; a gentle “wave” moves from spine → service node → outward (internet).
  - Notes:
      - If the user doesn’t deploy, this node doesn’t light up—still a clean narrative.

  Frame 11 — Control + Undo

  - Caption: “You stay in control.”
  - Left: “Pause, correct, or stop” small controls appear; “Clean up” button visible.
  - Right: A “Control” marker appears near the spine; project folder glyph appears, showing outputs under “Documents/Kenoki.”
  - Notes:
      - Reassurance: you can undo everything easily.

  Frame 12 — Done (Output Focus)

  - Caption: “Real files. Not instructions.”
  - Left: A simple file tree preview: index.html, hero.jpg, pages/about.html, etc.
  - Right: The tree calms; small dots “persist” next to created assets; the spine glows softly.
  - Notes:
      - End on outcomes, not process.

  Role Mapping (legends via hover/focus)

  - Hover states on right‑side nodes reveal concise names and descriptions:
      - Spine Agent: Router + Scheduler (Tier 1) — classifies, plans JSON, re‑plans.
      - Elder Planner (Tier 2): Appears for complex projects — expands DAG.
      - Bodyguard: Hard rails, safety checks, binary pass/fail, prompt guards.
      - Intake: Three simple questions, builds the brief.
      - Web: Intake/content/images/search (ChatGPT window).
      - CLI: Scaffold/build/test/git (local tools).
      - Service (MCP): Just‑in‑time connects (GitHub, Supabase, Stripe, Vercel).
      - PA/Messenger: Handoff/comparison between steps (semantic check).
      - Stats Agent: Fuel gauge, session budget, progress (overlay).
      - Output: Real files saved locally; preview and deploy nodes.

  Technical Implementation (front‑end)

  - Rendering:
      - Use SVG for the Spine + branches; parametric paths so you can animate stroke‑dashoffset and stroke‑dasharray for
        “growth”.
      - Each node is an SVG group with minimalist glyphs (shield, image, plug, rocket).
  - Scroll sync:
      - Desktop: use CSS Scroll‑Timeline or GSAP ScrollTrigger; fallback to IntersectionObserver.
      - Maintain a single normalized progress value (0..1) that drives both App Viewer state and Tree growth.
      - Each frame defines a progress range [start, end]. For each frame:
          - enter: animate in; mid: hold; exit: animate out.
  - Performance:
      - Target 60fps. GPU‑friendly transforms (translate, scale, opacity). Avoid layout thrash.
      - Lazy‑load heavy assets (demo video/images). Preload key hero assets.
      - Bundle budget: ~150–200 KB gz for the hero (fonts included), with deferred components below the fold.
  - Accessibility:
      - prefers‑reduced‑motion: collapse to step‑snap (no continuous scrubbing).
      - Keyboard support: W/S or arrow keys move frame to frame; focus rings visible.
      - ARIA labels on each node (role name + one‑line purpose).
      - Screen reader description: provide an “outline mode” list: Spine (router), Hard rails (safety), Elder (planner), etc.

  Copy Guidelines (each frame)

  - Single, short caption per frame (≤ 5 words):
      - “Understand and plan.” / “Stay in bounds.” / “Expand the plan.” / “Ask three simple questions.”
      - “Do the work.” / “Use images when needed.” / “Connect only when needed.”
      - “Check everything.” / “See it evolve.” / “Go live when ready.” / “You stay in control.” / “Real files. Not
        instructions.”
  - Tooltips (hover) use one sentence:
      - “The Spine classifies your request, plans the steps, and re‑plans if needed.”

  Component Breakdown

  - HeroScrolly (container)
      - Wordmark
      - TwoColumns
          - Left: AppViewer
              - Caption
              - Timeline ticks
              - Preview thumbnail
              - Small “live proof” chip
          - Right: TopologyTree
              - Spine SVG
              - Nodes (intake, elder, bodyguard, web, cli, service)
              - Branches (parametric paths)
      - ScrollController (state + progress)
  - Assets:
      - tree.svg (spine + branches structure, or fully code-generated paths)
      - glyphs: shield.svg, plug.svg, image.svg, rocket.svg, preview.svg
      - preview thumb (static image placeholder); real demo can be swapped later.

  Animation Specs (per frame)

  - Easing: use cubic‑bezier(0.22, 1, 0.36, 1) for growth; 250–450ms for in/out; 80ms bounce only on key nodes.
  - Branch growth:
      - stroke‑dasharray = pathLength; stroke‑dashoffset animates from pathLength → 0.
      - After growth, fill/fade in node glyph (opacity 0→1).
  - App Viewer text:
      - Fade/slide up 10px; avoid harsh motion; stagger 60–100ms if multiple lines.

  Responsive & Reduced Motion

  - Mobile (<768px):
      - Columns stack, order preserved. Each frame becomes a full‑width section, 100–120vh each.
      - Pinning replaced with snap points (scroll-snap).
  - Reduced motion:
      - Turn off scrubbing transitions; show discrete states; keep visible state changes (no parallax or growth strokes).

  Implementation Steps

  1. Skeleton & assets:

  - Build HeroScrolly scaffolding with pinned two columns (desktop) and stacked step sections (mobile).
  - Wire ScrollController using IntersectionObserver for frame activation; later upgrade to ScrollTimeline/GSAP.

  2. Tree:

  - Implement Spine SVG; parametric branch generator; minimal node glyphs.
  - Add role tooltips (hover/focus).

  3. App Viewer:

  - Add caption + simple timeline ticks; add preview thumb slot; proof chip UI.
  - Connect to scroll progress (state machine).

  4. Motion:

  - Implement per‑frame enter/exit; unify easing and durations; test at 60fps.
  - Add prefers‑reduced‑motion pathway.

  5. Copy & i18n hooks:

  - Insert one‑line captions; ensure <10 words each.

  6. QA & perf:

  - Test iPhone SE → 1440p; throttle CPU; Lighthouse; bundle size check; ensure no layout shift.
  - Accessibility: keyboard flow, focus rings, ARIA on nodes.

  Acceptance Criteria

  - Above fold shows brand wordmark and scrollytelling module; no paragraphs.
  - Scrolling reveals the 12 frames in order; left and right stay perfectly synchronized.
  - Every role is visible at least once on the right (Spine, Bodyguard, Elder, Intake, Web, CLI, Service, PA/Messenger,
    Stats).
  - Lighthouse performance and a11y both ≥ 90 on desktop; no reflow during scroll.
  - Reduced motion preference presents stepwise reveal with the same meaning (no scrubbing).
  - File sizes under budget; hero renders instantly; no flicker.
  - Copy lines are short, grade‑6, accessible.

  Risks & Mitigations

  - Too much motion: Respect reduced motion; make motion subtle; use short durations and small distances.
  - Performance drops: Avoid blur filters and oversized shadows; keep SVG paths minimal; memoize computed paths.
  - Synchronization drift: Drive both columns from a single progress source; don’t split into two observers.
  - Visual noise: Resist decorative borders/tiles; lean on whitespace and a few delicate lines.

  Minimal Copy (for the module)

  - Frame captions:
      - Understand and plan.
      - Stay in bounds.
      - Expand the plan.
      - Ask three simple questions.
      - Do the work.
      - Use images when needed.
      - Connect only when needed.
      - Check everything.
      - See it evolve.
      - Go live when ready.
      - You stay in control.
      - Real files. Not instructions.

  How this becomes “the hero”

  - You replace the traditional headline/subhead/chips block with this scrollytelling hero. The wordmark sets identity; the
    motion shows proof: a team forms from a backbone (spine), adds protection (rails), plans smartly (elder), then spawns
    doers (roots) to build the site in front of the user’s eyes. One narrative, one action.
=======
files to read; 
needs to fully grok roles, agents, flow, app overlay, routing, hard rails,
  adapters, and deployment. I grouped them by purpose and included the precise paths.

  Core Topology & Flow

  - /Users/celeste7/Documents/unified-terminal/docs/BOTTLENECKS/CONDUCTOR-ARCHITECTURE.md
  - /Users/celeste7/Documents/unified-terminal/docs/PLUGINS/files/AGENT-TOPOLOGY-MVP.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/FINAL_WORK/FINAL_PARTS.MD

  Orchestration & Roles (Conductor + Modes)

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/CONDUCTOR /FRAMEWORK.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/CONDUCTOR /AGENT-ONBOARDING.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/BUILD_FRAMEWORK/ROLE-GAP-ANALYSIS.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/DISSECTION/ROLE-GAP-ANALYSIS.md

  Overlay UI (Status Agent) & App Shell

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/STATUS_AGENT/UX_TREE/APP-SHELL-OVERLAY-SPEC.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/STATUS_AGENT/IMPLEMENTATION-STATUS.md

  Build Framework (Electron + Integration)

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/BUILD_FRAMEWORK/ELECTRON-ARCHITECTURE.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/BUILD_FRAMEWORK/OVERLAY-INTEGRATION.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/BUILD_FRAMEWORK/QUICKSTART.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HANDOFF_INTEGRATION/BUILD-ENGINEER-HANDOFF.md

  Adapters & Runtimes

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/INSTANCE-2-ADAPTERS.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/ENGINEER-HANDOFF.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/COMPATIBILITY.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/LEVEL-3-TASK-SUMMARY.md

  Hard Rails, Injection Guards, Trigger Maps

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/specs/ENFORCER.json
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/checks/VERIFICATION.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/PROMPT_INJECTION/PROMPT-INJECTION-ARCHITECTURE.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/DISSECTION/specs/trigger-map.json

  Domains (Workers) — Frontend/Research/Quality

  - /Users/celeste7/Documents/unified-terminal/docs/PLUGINS/files/DOMAIN-D-FRONTEND.md
  - /Users/celeste7/Documents/unified-terminal/docs/PLUGINS/files/DOMAIN-C-RESEARCH.md
  - /Users/celeste7/Documents/unified-terminal/docs/PLUGINS/files/DOMAIN-B-CODE-QUALITY.md

  Source Lineage & Audits (what came from where)

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/DISSECTION/PLUGIN-ARCHITECTURE/SOURCE-LINEAGE.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/DISSECTION/audits/gsd-audit.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/DISSECTION/originals/ecc-security-reviewer-original.md

  MCP & Auth (JIT connections, tokens)

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/MCP (read all markdown files in this directory)
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/CLI_AUTH (read README/markdown files here)

  Verification & QA (so the loop is trustworthy)

  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/VERIFICATION/ADAPTER-REVIEW.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/VERIFICATION/TEST-QUALITY-REVIEW.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/VERIFICATION/VERIFICATION-REPORT.md
  - /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/VERIFICATION/ENFORCEMENT-REVIEW.md

  Brand & Product Context (for tone and defaults)

  - /Users/celeste7/Documents/unified-terminal/docs/BRAND/CONTEXT.md
  - /Users/celeste7/Documents/unified-terminal/docs/BRAND/PRODUCT-STRATEGY.md
  - /Users/celeste7/Documents/unified-terminal/docs/BRAND/kenoki_brand_design_system.md

  Landing Telemetry (server-only ingest webhook)

  - /Users/celeste7/Documents/KENOKI_LANDING_PAGE/docs/INGEST_WEBHOOK.md
  - /Users/celeste7/Documents/KENOKI_LANDING_PAGE/pages/api/ingest.ts
  - KENOKI_LANDING_PAGE/api/ingest.js (the production Vercel function path inside the GitHub repo)

  Why these files matter (mapping to “who does what”)

  - Topology & Flow (Conductor-Architecture, AGENT-TOPOLOGY-MVP): defines the spine/elder/roots, tiers, and JSON DAG.
  - Orchestration (CONDUCTOR/FRAMEWORK, ROLE-GAP-ANALYSIS): spells out the 10 actors + 22 worker roles and gaps to close.
  - Overlay UI (APP-SHELL-OVERLAY-SPEC): gives the app shell, overlay, fuel gauge, IPC contracts the frontend must follow.
  - Build Framework (Electron-Architecture, OVERLAY-INTEGRATION): ties main/renderer/BrowserView and how we inject/observe.
  - Adapters (INSTANCE-2-ADAPTERS, ENGINEER-HANDOFF): concrete runtime spawn/IO and permission maps for workers.
  - Hard Rails & Guards (ENFORCER.json, PROMPT-INJECTION-ARCHITECTURE): the bodyguard rules and prompt safety boundaries.
  - Trigger Map: how skills are matched to steps; essential for the skill injector logic.
  - Domains (Frontend/Research/Quality): what worker prompts exist and how they should be applied (design tokens, research,
    QA).
  - MCP & Auth: just‑in‑time connections and Gate‑6 OAuth flows.
  - Verification: how we confirm outcomes, not just task completion; what’s missing and how to test.
  - Brand: the exact design tokens/typography/colors that must inform generated output and the landing visuals.
  - Telemetry Ingest: server‑side webhook schema, security, and envs to capture product outcomes.

  If you want a pared‑down “read in this exact order” for onboarding:

  1. /Users/celeste7/Documents/unified-terminal/docs/BOTTLENECKS/CONDUCTOR-ARCHITECTURE.md
  2. /Users/celeste7/Documents/unified-terminal/docs/PLUGINS/files/AGENT-TOPOLOGY-MVP.md
  3. /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/CONDUCTOR /FRAMEWORK.md
  4. /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/STATUS_AGENT/UX_TREE/APP-SHELL-OVERLAY-SPEC.md
  5. /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/ADAPTORS/ENGINEER-HANDOFF.md
  6. /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/HARDCODED_ENFORCEMENT/specs/ENFORCER.json
  7. /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/PROMPT_INJECTION/PROMPT-INJECTION-ARCHITECTURE.md
  8. /Users/celeste7/Documents/unified-terminal/docs/ONGOING_WORK/DISSECTION/specs/trigger-map.json
  9. /Users/celeste7/Documents/unified-terminal/docs/PLUGINS/files/DOMAIN-D-FRONTEND.md
  10. /Users/celeste7/Documents/unified-terminal/docs/BRAND/kenoki_brand_design_system.md
