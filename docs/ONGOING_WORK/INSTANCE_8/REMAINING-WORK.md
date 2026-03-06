What's NOT built yet:
ProgressTree visual component — the hooks exist (useStatusAgent) but the actual tree UI that renders soft blue pills, vertical timeline, branches for parallel agents, cascade-on-click — that's still the prototype from our session. It needs to be connected to real IPC data instead of mock data.
PA/Messenger — still a stub. User corrections log to console but don't route surgically to specific agents. The full interrupt pipeline (keyword classify → PA validates against Spine → pause only affected agents) isn't implemented.
Fuel Gauge — spec exists, code doesn't. No session budget visibility.
Forced Checkpoints — spec exists but the plan-review, first-output, and pre-deploy pause gates need to be wired into the Conductor's DAG loop so they actually block execution until the user responds.
App Shell layout states — idle/building/minimised transitions, BrowserView resize, top bar pill. Not built.
Archivist — project lifecycle (OPEN → PAUSED → CLOSED), archive generation, PAUL mode on reopen. Not built.
