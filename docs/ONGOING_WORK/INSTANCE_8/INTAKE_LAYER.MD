The Intake layer in PRODUCT-STRATEGY.md defines the quiz flow: user says "build me a website," the system asks 3-4 clarifying questions before any agent starts working. But it's currently designed as a blocking gate — everything waits until intake finishes.
What you're describing is smarter: intake as a living conversation that feeds agents progressively, not a gate that blocks everything.
The difference:
Current design (blocking):
User: "build me a website"
→ Intake asks 4 questions (everything waits)
→ User answers all 4
→ Brief generated
→ Conductor plans
→ Agents start
What you want (progressive):
User: "build me a website"
→ Intake asks: "Who is this for?"
→ Meanwhile: Conductor already knows it's a website, starts scaffolding
→ User answers: "candle business, women 25-40"
→ Research agent starts: competitor analysis for candle brands
→ Intake asks: "Any colours or style in mind?"
→ Meanwhile: scaffold is done, structure ready
→ User answers: "warm, minimal, like Aesop"
→ Design agent receives style direction, starts working
→ Intake asks: "Do you have a logo?"
→ User uploads logo
→ Image agent receives logo, skips generation
Each answer feeds the specific agent that needs it, and agents that DON'T need that answer are already running. The conversation isn't a wall — it's a river feeding tributaries.
This routes through the Status Agent and PA exactly as we designed:
The Status Agent renders the intake questions as QueryWidgets in the tree (same buttons/text inputs we already specced). The user's answers flow back via IPC → Status Agent → PA → the specific agent that needs that answer. The PA knows which agent is waiting for which piece of information because the Conductor's DAG marks dependencies: "Step 3 (design) depends on style_preference. Step 1 (scaffold) depends on nothing."
The Conductor's DAG just needs one new field per step: requiredInputs. Steps with no required inputs start immediately. Steps with required inputs wait for that specific answer, not for the entire intake to finish.
DAG Step 1: scaffold        → requiredInputs: []           → STARTS IMMEDIATELY
DAG Step 2: research        → requiredInputs: ["audience"] → STARTS after Q1 answered
DAG Step 3: design          → requiredInputs: ["style"]    → STARTS after Q2 answered
DAG Step 4: images          → requiredInputs: ["logo"]     → STARTS after Q3 answered
DAG Step 5: content         → requiredInputs: ["audience"] → ALREADY HAVE IT, starts
DAG Step 6: payments        → requiredInputs: []           → STARTS when dependencies met
The intake questions themselves come from the Conductor. It knows what information each step needs. Instead of asking all questions upfront, it asks them just-in-time — the question renders in the tree right before the step that needs the answer. If the user is slow answering, other steps that don't need that answer continue running. If the user answers fast, the waiting step starts immediately.
This means the user experience is a conversation WITH visible progress happening alongside it, not a conversation THEN progress. They see "Setting up your project..." filling up while they're still answering questions about their colour preferences. That's the feeling of a system that's working WITH them, not waiting FOR them.
The PA routes each answer to the step that declared it as a requiredInput. No broadcast, no "send answer to all agents." Surgical, same as the interrupt pattern. The answer is a query response, same IPC channel, same PA envelope format.
This doesn't need a new agent or a new system. It needs the Conductor to emit intake questions as queries through the Status Agent, and the DAG step schema to include requiredInputs so the scheduler knows which steps can start before all questions are answered. Everything else — the QueryWidget rendering, the IPC routing, the PA delivery — already exists in the specs.