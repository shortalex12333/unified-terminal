 Kenoki (Unified Terminal) Architecture Overview              
                               
  App Identity                 
                               
  Name: Kenoki (internal), Unified Terminal (product)          
  Type: Electron app wrapping CLI AI tools for non-technical users                             
  Runtimes: Codex (primary), Claude Code (native), ChatGPT Web (research/images)               
                               
  ---                          
  1. PLUGIN SYSTEM             
                               
  Location: src/plugins/       
  ┌────────────────────────────┬──────────────────────────────────────────────────┐            
  │            File            │                     Purpose                      │            
  ├────────────────────────────┼──────────────────────────────────────────────────┤            
  │ configs/gsd.ts             │ GSD plugin (17 triggers, 8 capabilities)         │            
  ├────────────────────────────┼──────────────────────────────────────────────────┤            
  │ configs/codex.ts           │ Codex plugin (11 triggers, 5 capabilities)       │            
  ├────────────────────────────┼──────────────────────────────────────────────────┤            
  │ configs/claude-code.ts     │ Claude Code plugin (12 triggers, 8 capabilities) │            
  ├────────────────────────────┼──────────────────────────────────────────────────┤            
  │ configs/research.ts        │ Research plugin (13 triggers, 6 capabilities)    │            
  ├────────────────────────────┼──────────────────────────────────────────────────┤            
  │ plugin-registry.ts:43-76   │ Registration, lookup, dependency resolution      │            
  ├────────────────────────────┼──────────────────────────────────────────────────┤            
  │ plugin-executor.ts:150-227 │ Execution lifecycle, event emission              │            
  └────────────────────────────┴──────────────────────────────────────────────────┘            
  How to add a plugin:         
  1. Create src/plugins/configs/my-plugin.ts with PluginConfig 
  2. Add to BUILTIN_PLUGINS array in configs/index.ts          
  3. Restart app               
                               
  ---                          
  2. HARD RAILS (Enforcement System)                           
                               
  Location: src/enforcement/   
  ┌──────────────┬───────┬─────────────────────────────────────────────────────────┐           
  │     File     │ Lines │                         Purpose                         │           
  ├──────────────┼───────┼─────────────────────────────────────────────────────────┤           
  │ constants.ts │ 520   │ THE ONE SOURCE OF TRUTH — all thresholds, limits, rules │           
  ├──────────────┼───────┼─────────────────────────────────────────────────────────┤           
  │ bodyguard.ts │ 351   │ Gate checker (parallel checks, verdict aggregation)     │           
  ├──────────────┼───────┼─────────────────────────────────────────────────────────┤           
  │ enforcer.ts  │ 320   │ Individual check execution with retry                   │           
  ├──────────────┼───────┼─────────────────────────────────────────────────────────┤           
  │ spine.ts     │ 249   │ File/git state snapshots for diff detection             │           
  └──────────────┴───────┴─────────────────────────────────────────────────────────┘           
  Key Constants (easily editable in constants.ts):             
  ┌──────────────────┬─────────┬─────────────────────────────────────────────────────────┐     
  │     Section      │  Lines  │                    What It Controls                     │     
  ├──────────────────┼─────────┼─────────────────────────────────────────────────────────┤     
  │ TOKEN_THRESHOLDS │ 12-46   │ Per-model context windows, kill ratios                  │     
  ├──────────────────┼─────────┼─────────────────────────────────────────────────────────┤     
  │ TIMEOUTS         │ 191-221 │ Agent spawn, worker tiers, deploy health                │     
  ├──────────────────┼─────────┼─────────────────────────────────────────────────────────┤     
  │ CIRCUIT_BREAKER  │ 329-334 │ Max retries (3), skip options per confidence            │     
  ├──────────────────┼─────────┼─────────────────────────────────────────────────────────┤     
  │ CRON_INTERVALS   │ 163-184 │ Context check (30s), rate limit poll (60s)              │     
  ├──────────────────┼─────────┼─────────────────────────────────────────────────────────┤     
  │ CHECK_ACTIVATION │ 125-135 │ Which checks run when (every_execute, post_build, etc.) │     
  └──────────────────┴─────────┴─────────────────────────────────────────────────────────┘     
  Hard vs Soft Rails:          
  - HARD: Test exit code, file existence, scope enforcement, secret detection → Cannot skip    
  - SOFT: File non-empty, docker health, deploy health → User can skip                         
                               
  ---                          
  3. SKILLS SYSTEM             
                               
  Location: src/skills/ + resources/skills/                    
  ┌───────────────────────────────────┬─────────────────────────────────────────────────────────────┐                          
  │               File                │                           Purpose                           │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ selector.ts:83-154                │ Agent-based skill selection (Codex 400 tokens)              │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ selector.ts:202-229               │ Fallback keyword matching (0 tokens)                        │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ validator.ts:73                   │ Tier-based limits (Tier 0-1: 1 skill, Tier 2: 2, Tier 3: 3) │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ verify-parser.ts:61-115           │ Extract ## verify blocks from skill markdown                │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ critical-checks.ts:20-57          │ Hardcoded fallback checks (tdd-guide, security-reviewer)    │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ verify-sandbox.ts:43-55           │ Allowlist/blocklist for check commands                      │                          
  ├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤                          
  │ resources/skills/trigger-map.json │ Empty array — skills not deployed yet                       │                          
  └───────────────────────────────────┴─────────────────────────────────────────────────────────────┘                          
  How to add a skill:          
  1. Create markdown in resources/skills/my-skill.md (8 sections: You Are, Context, Process, Boundaries, Output, Failure Modes,
   Success, ## verify)         
  2. Register in trigger-map.json: { "skill": "my-skill.md", "keywords": ["kw1", "kw2"] }      
  3. Optionally add critical checks in critical-checks.ts      
                               
  ---                          
  4. MCP (Model Context Protocol) Integration                  
                               
  Location: src/main/mcp/      
  ┌────────────────────────────────┬─────────────────────────────────────────────────────────┐ 
  │              File              │                         Purpose                         │ 
  ├────────────────────────────────┼─────────────────────────────────────────────────────────┤ 
  │ types.ts:27-33                 │ 5 MCP servers: Stripe, GitHub, Vercel, Supabase, Notion │ 
  ├────────────────────────────────┼─────────────────────────────────────────────────────────┤ 
  │ mcp-manager.ts                 │ Singleton manager (OAuth, API keys, persistence)        │ 
  ├────────────────────────────────┼─────────────────────────────────────────────────────────┤ 
  │ mcp-detector.ts:8-27           │ Auto-detect required MCPs from step text                │ 
  ├────────────────────────────────┼─────────────────────────────────────────────────────────┤ 
  │ ~/.kenoki/mcp-connections.json │ Persisted connections   │ 
  └────────────────────────────────┴─────────────────────────────────────────────────────────┘ 
  IPC Channels (11 handlers in index.ts:2945-3097):            
  - mcp:connect, mcp:disconnect, mcp:set-api-key               
  - mcp:check-required (pattern matching on step text)         
  - mcp:verify-connection, mcp:refresh-token                   
                               
  ---                          
  5. MESSAGE FLOW & ROLE ASSIGNMENT                            
                               
  Entry Point: src/main/send-interceptor.ts:302-389            
                               
  USER TYPES IN CHATGPT        
         ↓                     
  ┌─────────────────────────────────────────────────────────────┐                              
  │ TIER 0: FAST-PATH (fast-path.ts:173-259)                   │                               
  │ Regex-based bypass for trivial messages                    │                               
  │ Greetings, confirmations, short questions → BYPASS TO WEB │
  └────────────────────────────┬────────────────────────────────┘                              
                               │ Non-trivial                   
                               ↓                               
  ┌─────────────────────────────────────────────────────────────┐                              
  │ TIER 1: CONDUCTOR (conductor.ts:575-702)                   │                               
  │ Persistent Codex session classifies message                 │                              
  │ Returns ExecutionPlan: route, complexity, steps[]          │                               
  └────────────────────────────┬────────────────────────────────┘                              
                               │ Plan approved                 
                               ↓                               
  ┌─────────────────────────────────────────────────────────────┐                              
  │ TIER 3: STEP SCHEDULER (step-scheduler.ts:284-366)         │                               
  │ DAG executor with 10-step enforcement per step:             │                              
  │ 1. Pre-spine  2. Skill select  3. Assemble prompt          │                               
  │ 4. Pre-gate   5. Execute       6. Normalize                │                               
  │ 7. Post-spine 8. Post-gate     9. Skill verify             │                               
  │ 10. PA comparison           │                              
  │ Circuit breaker: 3 retries → ask user (retry/skip/stop)    │                               
  └─────────────────────────────────────────────────────────────┘                              
                               ↓                               
  ┌─────────────────────────────────────────────────────────────┐                              
  │ TARGET EXECUTORS (executors/*.ts)                           │                              
  │ Web: ChatGPT DOM injection/extraction                       │                              
  │ CLI: codex --full-auto spawn                               │                               
  │ Service: External service guides (Vercel, Supabase)         │                              
  └─────────────────────────────────────────────────────────────┘                              
                               
  ---                          
  6. EASILY EDITABLE LOCATIONS 
                               
  JSON (No Code Changes)       
  ┌───────────────────────────────────┬────────────────────────────────┐                       
  │               File                │            Purpose             │                       
  ├───────────────────────────────────┼────────────────────────────────┤                       
  │ package.json                      │ Version, scripts, dependencies │                       
  ├───────────────────────────────────┼────────────────────────────────┤                       
  │ electron-builder.yml              │ App metadata, DMG config       │                       
  ├───────────────────────────────────┼────────────────────────────────┤                       
  │ resources/skills/trigger-map.json │ Skill → keyword mappings       │                       
  └───────────────────────────────────┴────────────────────────────────┘                       
  TypeScript (Simple Edits)    
  ┌──────────────────────────────┬───────────────────────────────────────────────────┐         
  │             File             │                   What to Edit                    │         
  ├──────────────────────────────┼───────────────────────────────────────────────────┤         
  │ src/enforcement/constants.ts │ ALL thresholds, timeouts, limits                  │         
  ├──────────────────────────────┼───────────────────────────────────────────────────┤         
  │ src/plugins/configs/*.ts     │ Plugin triggers, capabilities, timeouts           │         
  ├──────────────────────────────┼───────────────────────────────────────────────────┤         
  │ src/main/fast-path.ts:19-72  │ Bypass patterns (ACTION_VERBS, GREETING_PATTERNS) │         
  └──────────────────────────────┴───────────────────────────────────────────────────┘         
  ---                          
  7. WHERE ISSUES LIE (Role Assignment/Flow)                   
                               
  Based on the exploration:    
  ┌───────────────────────────────┬───────────────────────────────────────────────────┬───────────────────────────────────────┐
  │             Issue             │                     Location                      │                Impact                 │
  ├───────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ Skills not deployed           │ resources/skills/trigger-map.json is empty        │ Skill selection always falls back to  │
  │                               │                   │ empty │
  ├───────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ MCP auto-detection            │ mcp-detector.ts:8-27                              │ May miss edge cases; no LLM fallback  │
  │ regex-based                   │                   │       │
  ├───────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ Conductor timeout is null     │ constants.ts:206  │ Persistent session never times out —  │
  │                               │                   │ could hang                            │
  ├───────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ Fast-path patterns may be too │ fast-path.ts:19-72│ Could misclassify complex questions   │
  │  broad                        │                   │ as trivial                            │
  ├───────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ Circuit breaker only 3        │ constants.ts:330  │ May be too aggressive for flaky       │
  │ retries                       │                   │ networks                              │
  ├───────────────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ Check scripts not all         │ constants.ts:143-156 paths exist but files may be │ Gate checks could no-op               │
  │ implemented                   │  empty            │       │
  └───────────────────────────────┴───────────────────────────────────────────────────┴───────────────────────────────────────┘
  ---                          
  Quick Reference: Key Files   
  ┌──────────────────────────┬───────────────────────────────────┬───────────┐                 
  │         Concern          │           Primary File            │ Key Lines │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Token limits             │ src/enforcement/constants.ts      │ 12-46     │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Timeouts                 │ src/enforcement/constants.ts      │ 191-221   │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Circuit breaker          │ src/enforcement/constants.ts      │ 329-334   │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Plugin registration      │ src/plugins/configs/index.ts      │ 32-37     │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Message routing          │ src/main/send-interceptor.ts      │ 302-389   │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Fast-path bypass         │ src/main/fast-path.ts             │ 173-259   │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Conductor classification │ src/main/conductor.ts             │ 575-702   │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ DAG execution            │ src/main/step-scheduler.ts        │ 474-511   │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ MCP servers              │ src/main/mcp/types.ts             │ 27-33     │                 
  ├──────────────────────────┼───────────────────────────────────┼───────────┤                 
  │ Skill triggers           │ resources/skills/trigger-map.json │ (empty)   │                 
  └──────────────────────────┴───────────────────────────────────┴───────────┘                