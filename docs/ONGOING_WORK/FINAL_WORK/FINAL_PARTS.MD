
### FINAL UPDATES NEEDED.

---

**1. The Empty State Problem**

User installs the app. It opens. They see ChatGPT in a window. Now what? There's no moment that tells them "this isn't just ChatGPT — this does MORE." You've designed the entire pipeline for when a build starts, but nothing for the 30 seconds before the user types their first message. Those 30 seconds determine whether they use it once or forever.

You need a "What can I build?" moment. Not a tutorial. Not a walkthrough. A set of 4-6 tappable cards that show real outputs: "A website like this was built in 38 minutes," "This brand identity was created from one sentence," "This market research report was generated automatically." Tapping one pre-fills the input with a starter prompt. The user sees what's possible, taps, and they're in a build. First value delivered in under 60 seconds.

Right now your app opens and looks like ChatGPT in a slightly different window. That's a churn machine.

---

**2. Live Preview of What's Being Built**

Your tree shows progress beautifully. But the user is building a WEBSITE — they want to SEE it. Not see "✅ Homepage layout complete" — see the actual homepage rendering in real time. You have Docker local-first mentioned in the skills, you have `localhost:3000` referenced in health checks, but there's no spec for showing a live preview inside the app.

This should be a tab or panel alongside the tree: "Preview" that loads the dev server output in a second BrowserView. User watches their website materialise as agents build it. Every time a file is saved, the preview hot-reloads. This is the "wow" moment that makes someone tell their friend about the app. The tree is satisfying. The live preview is magical.

Without it, the user waits 40 minutes staring at status lines, then gets a link at the end. That's an Amazon delivery experience, not a "watch your house being built" experience.

---

**3. Post-Build: "Now What?"**

Your pipeline ends at deploy. The Archivist archives. The tree shows "Your site is live!" with a URL. But then what? The user built a candle store. Tomorrow they want to change the hero image. Next week they want to add a blog. Next month they want to update prices.

You have no spec for PROJECT CONTINUATION. The Archivist handles reopening (PAUL mode), but the user experience of "I want to change something on my existing site" isn't designed. Is it a new message? Do they select the project from a list? Does the system remember what was built and offer targeted options ("Update content," "Change design," "Add a feature")?

This matters because your 190M users don't build once. They iterate. If every change requires "build me a website" from scratch, they'll leave. If they can say "change the hero image to this photo" and the system knows which project, which file, which component — that's retention.

---

**4. Templates / Starting Points**

You're targeting non-technical users who say "build me a website." But most of them don't even know what to ask for. They know they need SOMETHING but can't articulate it. "Build me a website" is the best they can do, and your system will ask clarifying questions, but the user still doesn't know what's possible.

Templates solve this. "Candle Store," "Portfolio," "Restaurant," "Freelancer Landing Page," "Event Invitation," "Market Research Report." Each template is a pre-filled brief that skips intake and goes straight to plan review. The user picks a template, sees the plan card, tweaks it ("I sell soap, not candles"), and hits go.

This dramatically reduces the cognitive load of the first interaction. Instead of "what do you want?" (terrifying for non-technical users), it's "which of these is closest?" (easy).

---

**5. Trust and Safety Communication**

Your 190M users are not developers. They're people who heard about AI from a friend, pay $20/month, and are mildly scared of it. They're going to wonder:

- "Is this app reading my ChatGPT conversations?" (You need a clear privacy statement, visible in the app, not buried in ToS)
- "Will this break my computer?" (The auto-installer installs Node.js, Python, Git, multiple CLI tools. That's terrifying for non-technical users. They need reassurance.)
- "Can I undo what it built?" (Every project is a git repo, but users don't know what git is. You need an "Undo everything" button that's visually prominent.)
- "Will this use up my ChatGPT subscription?" (Fuel gauge helps, but users need this BEFORE they start, not during. "This build will use approximately 40% of your daily messages. Continue?")

You've designed the system for safety (hard rails, bodyguard, scope enforcement). But you haven't designed the COMMUNICATION of safety to users. The system is safe. The user doesn't know that.

---

**6. Error Recovery UX for Non-Recoverable Failures**

Your circuit breaker handles retries. Your mutation engine prevents loops. But what happens when a build genuinely CANNOT complete? The API is down for 6 hours. The user's ChatGPT subscription expired mid-build. The project requires a feature that doesn't exist.

You have no "graceful failure" UX. The current design retries 3 times, asks the user, then... what? "Stop build" and they've lost 30 minutes. You need a "Save progress and resume later" option that's visible and reassuring. "We hit a wall — your progress is saved. You can continue tomorrow, or I can try a different approach." The tree should show exactly where it stopped and what's already done. The user should be able to download whatever partial output exists (the 6 pages that were built even though payments failed).

Non-technical users have zero tolerance for "it didn't work." They need to feel like nothing was wasted.

---

**7. MCP as "Connect Your Accounts" (Your Note, But Needs UX)**

You flagged this yourself. The implementation path is clear: the Skill Selector identifies which MCPs are needed for the task, the Status Agent renders "To set up payments, we need to connect your Stripe account" as a card with a "Connect Stripe" button, the user authenticates via OAuth in a popup, and the MCP is live for that session.

But the UX question you haven't answered: WHEN does this happen? During intake? Mid-build when the payment step starts? Upfront as a "connect all your accounts" setup screen?

The answer should be just-in-time, mid-build. Don't ask the user to connect Stripe before they've even confirmed the plan. Wait until Step 6 (payments) is about to execute, then render the connection card. If they don't have Stripe, offer to skip payments and add them later. This matches your progressive intake pattern — don't ask for everything upfront, ask when needed.

---

**8. Analytics / Learning What Users Actually Build**

You have zero instrumentation for understanding user behaviour. What percentage of users use Tier 0 vs Tier 3? What's the average build time? Where do users stop and cancel? Which intake questions do users skip most? What are the most common first messages?

This isn't about monetisation. It's about knowing whether your product works. You need anonymised, local-first telemetry (no cloud, no tracking — just local stats the user can see) that tells YOU what's working and what isn't. "85% of users never expand the tree" tells you the cascade-on-click isn't discoverable. "60% of users cancel during intake questions" tells you intake is too long. Without this, you're flying blind after launch.

---

**9. The Competitive Moat Isn't Architecture — It's Output Quality**

This is the big one. Everything you've built — the adapters, the enforcement, the skills, the tiers, the Status Agent, the tree — is orchestration infrastructure. It's excellent infrastructure. But the user doesn't care about infrastructure. They care about ONE thing: **is the website good?**

If your system builds a mediocre website after 40 minutes, users won't come back regardless of how pretty the tree animation is. If it builds a stunning website in 40 minutes, users will forgive every UX rough edge.

Your skill system (frontend-design with CSV databases, BM25 search, design tokens) is the most important differentiator you have. It's what makes your output look like a designer built it instead of an LLM hallucinating CSS. But you haven't stress-tested output quality. You've tested that the PIPELINE works (enforcement, gates, skills inject correctly). You haven't tested that the RESULT is beautiful.

Before launch, you need 10 real builds with real prompts from non-technical people, judged by someone with design taste. Not "did the pipeline complete?" but "would you pay for this website?" That's the test that matters, and no pre-flight verification matrix covers it.

---

Those are the gaps. The architecture is sound. The infrastructure is thorough. What's missing is the human layer: the empty state, the live preview, the post-build experience, the trust communication, the templates, the graceful failure, and the output quality validation. The engine is built. The showroom needs finishing.