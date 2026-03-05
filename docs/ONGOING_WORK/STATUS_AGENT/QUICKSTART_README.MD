Viewed a file, created a file, ran a command
1,070 lines. Here's what this nails and why the surgical interrupt through PA is the game changer:

The flow you described, made exact:

User types "No don't generate new images, use my existing logo" → Status Agent keyword-matches "image" + "generate" + "logo" to IMAGE_GEN category → reads Spine to find which running agent matches → constructs a correction envelope with priority: "elevated" → hands it to PA. PA validates against Spine (is that agent actually running? what other agents reference its output?) → identifies primary target (step 5: image-gen) and secondary targets (step 7: content that references images) → dispatches correction to ONLY those two. Steps 3, 4, 6, 8, 9: no message, no pause, nothing. They never know the user hit stop.

The runtime-dependent mechanism:

Codex and Claude Code have session resume → PA injects the ---USER-UPDATE--- block mid-execution. The agent receives the correction without being killed. It adjusts and continues.

Gemini and ChatGPT Web have no resume → PA kills the process and respawns with the correction baked into the prompt via the Mutation Engine. Same result, different delivery.

Secondary targets (agents that are affected but less directly) get the correction queued for their next mandatory checkpoint rather than being interrupted mid-work. Gentler, less disruptive.

The Codex problem solved:

Codex one-shots and fucks it up because it never pauses. Our answer: the mandatory checkpoint system. Forced pause points at plan review, first visible output, pre-deploy, and every 5 completed steps. These checkpoints aren't inside Codex — they're AROUND Codex, in the Conductor's orchestration layer. Codex finishes a step, Conductor catches it, forces a query to the user ("Here's how it's looking — continue?") via the Status Agent, and doesn't dispatch the next step until the user responds or the 30-second timeout fires.

The tree UI:

Vertical timeline, main steps always visible, sub-steps cascade on click. Parallel branches when 2+ agents work simultaneously. Branch merge points when parallel work converges. Final output node at the bottom with the live URL / file location / download link. Progress bar fills alongside the tree. Text input at the bottom for corrections at any time.

The banned words list: "agent", "CLI", "API", "JSON", "token", "model", "Codex", "GSD", "exit code", "session ID", "context window", "prompt", "node_modules", "npm", "git commit" — none of these ever reach the user. Max 8 words per status line. Present tense. Calm and confident.