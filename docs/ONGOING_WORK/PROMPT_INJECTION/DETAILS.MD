                                                                   
                                                                                                                     
  Skill vs Prompt Injection — The Core Difference                                                                    
                                                                                                                     
  ┌─────────────────────────────────────────────────────────────────────┐                                            
  │  PROMPT INJECTION                │  /SKILL                         │                                             
  ├─────────────────────────────────────────────────────────────────────┤                                            
  │  • Always in context             │  • Loaded on trigger/demand     │                                             
  │  • Consumes tokens every turn    │  • Only consumes when needed    │                                             
  │  • No conditional logic          │  • Has trigger conditions       │                                             
  │  • Static text                   │  • Can have references, files   │                                             
  │  • User must paste/manage        │  • System manages automatically │                                             
  │  • No versioning                 │  • Can be versioned/updated     │                                             
  └─────────────────────────────────────────────────────────────────────┘                                            
                                                                                                                     
  ---                                                                                                                
  When to Use Each                                                                                                   
                                                                                                                     
  Use PROMPT INJECTION When:                                                                                         
  ┌────────────────────────────┬───────────────────────────────────────┐                                             
  │          Scenario          │                  Why                  │                                             
  ├────────────────────────────┼───────────────────────────────────────┤                                             
  │ Always-on behavioral rules │ Must be in every response (CLAUDE.md) │                                             
  ├────────────────────────────┼───────────────────────────────────────┤                                             
  │ Identity/persona           │ "You are an orchestrator"             │                                             
  ├────────────────────────────┼───────────────────────────────────────┤                                             
  │ Non-negotiable constraints │ Security rules, yacht isolation       │                                             
  ├────────────────────────────┼───────────────────────────────────────┤                                             
  │ Simple, short rules        │ < 500 tokens                          │                                             
  ├────────────────────────────┼───────────────────────────────────────┤                                             
  │ No conditional activation  │ Applies to ALL tasks                  │                                             
  └────────────────────────────┴───────────────────────────────────────┘                                             
  Example: CLAUDE.md content                                                                                         
  You are an orchestrator. You do NOT implement directly.                                                            
  Always verify yacht_id on ALL queries.                                                                             
                                                                                                                     
  Use /SKILL When:                                                                                                   
  ┌───────────────────────────┬──────────────────────────────────────────┐                                           
  │         Scenario          │                   Why                    │                                           
  ├───────────────────────────┼──────────────────────────────────────────┤                                           
  │ Domain-specific expertise │ Only needed for certain tasks            │                                           
  ├───────────────────────────┼──────────────────────────────────────────┤                                           
  │ Complex workflows         │ Multi-step processes with references     │                                           
  ├───────────────────────────┼──────────────────────────────────────────┤                                           
  │ Conditional activation    │ "When debugging...", "When deploying..." │                                           
  ├───────────────────────────┼──────────────────────────────────────────┤                                           
  │ Large content             │ Would bloat context if always present    │                                           
  ├───────────────────────────┼──────────────────────────────────────────┤                                           
  │ Evolving knowledge        │ Updated separately from core rules       │                                           
  ├───────────────────────────┼──────────────────────────────────────────┤                                           
  │ Reusable across projects  │ Share between codebases                  │                                           
  └───────────────────────────┴──────────────────────────────────────────┘                                           
  Example: verification-integrity skill                                                                              
  triggers:                                                                                                          
    - test failure                                                                                                   
    - 404 error                                                                                                      
    - "it works"                                                                                                     
  # Only loads when these patterns detected                                                                          
                                                                                                                     
  ---                                                                                                                
  The Architecture                                                                                                   
                                                                                                                     
  ┌─────────────────────────────────────────────────────────────────────┐                                            
  │  LAYER 1: PROMPT INJECTION (Always Present)                        │                                             
  │  ─────────────────────────────────────────                          │                                            
  │  • CLAUDE.md (project root)                                         │                                            
  │  • ~/.claude/CLAUDE.md (global)                                     │                                            
  │  • System prompt                                                    │                                            
  │                                                                     │                                            
  │  Token cost: EVERY turn                                             │                                            
  │  Use for: Identity, constraints, non-negotiables                    │                                            
  ├─────────────────────────────────────────────────────────────────────┤                                            
  │  LAYER 2: /SKILL (On-Demand)                                        │                                            
  │  ─────────────────────────────                                      │                                            
  │  • .claude/skills/*/SKILL.md                                        │                                            
  │  • Triggered by keywords or user invocation                         │                                            
  │  • Can reference additional files                                   │                                            
  │                                                                     │                                            
  │  Token cost: Only when triggered                                    │                                            
  │  Use for: Domain expertise, workflows, methodologies                │                                            
  ├─────────────────────────────────────────────────────────────────────┤                                            
  │  LAYER 3: /COMMAND (User-Invoked)                                   │                                            
  │  ─────────────────────────────────                                  │                                            
  │  • Slash commands like /commit, /review                             │                                            
  │  • Explicit user action                                             │                                            
  │                                                                     │                                            
  │  Token cost: Only when invoked                                      │                                            
  │  Use for: Specific actions, utilities                               │                                            
  └─────────────────────────────────────────────────────────────────────┘                                            
                                                                                                                     
  ---                                                                                                                
  Decision Tree                                                                                                      
                                                                                                                     
  Need guidance for Claude?                                                                                          
           │                                                                                                         
           ├── Must apply to EVERY response?                                                                         
           │         │                                                                                               
           │         ├── YES: Does it fit in < 500 tokens?                                                           
           │         │         │                                                                                     
           │         │         ├── YES → PROMPT INJECTION (CLAUDE.md)                                                
           │         │         │                                                                                     
           │         │         └── NO → Split: Core rules in CLAUDE.md                                               
           │         │                   Detail in /SKILL with always_active: true                                   
           │         │                                                                                               
           │         └── NO → Conditional?                                                                           
           │                   │                                                                                     
           │                   ├── YES → /SKILL with triggers                                                        
           │                   │                                                                                     
           │                   └── NO → /COMMAND (user invokes)                                                      
           │                                                                                                         
           └── Complex multi-step workflow?                                                                          
                     │                                                                                               
                     ├── YES → /SKILL (can have references/)                                                         
                     │                                                                                               
                     └── NO → Simple rule? → PROMPT INJECTION                                                        
                                                                                                                     
  ---                                                                                                                
  Concrete Examples                                                                                                  
                                                                                                                     
  CLAUDE.md (Prompt Injection) — Always On                                                                           
                                                                                                                     
  # Project Rules                                                                                                    
  - You are orchestrator only, never implement directly                                                              
  - All queries MUST include yacht_id via get_user_yacht_id()                                                        
  - Signature column: '{}'::jsonb or valid payload, NEVER NULL                                                       
  ~150 tokens, every turn                                                                                            
                                                                                                                     
  /SKILL — Triggered On-Demand                                                                                       
                                                                                                                     
  # verification-integrity/SKILL.md                                                                                  
  triggers:                                                                                                          
    - test failure                                                                                                   
    - 404 error                                                                                                      
    - "tests pass"                                                                                                   
  ---                                                                                                                
  # 800+ tokens of detailed false failure/success patterns                                                           
  # Only loaded when trigger detected                                                                                
  ~800 tokens, only when verification context detected                                                               
                                                                                                                     
  Hybrid Approach (Best Practice)                                                                                    
                                                                                                                     
  # CLAUDE.md (always present, ~50 tokens)                                                                           
  When verifying test results, invoke verification-integrity skill.                                                  
                                                                                                                     
  # verification-integrity/SKILL.md (on-demand, ~800 tokens)                                                         
  [Full detailed patterns, checklists, examples]                                                                     
                                                                                                                     
  ---                                                                                                                
  Token Economics                                                                                                    
  ┌────────────────────────────────┬──────────────────────────┬──────────────────┐                                   
  │            Approach            │       Tokens/Turn        │ 100 Turn Session │                                   
  ├────────────────────────────────┼──────────────────────────┼──────────────────┤                                   
  │ Everything in prompt           │ 5000                     │ 500,000 tokens   │                                   
  ├────────────────────────────────┼──────────────────────────┼──────────────────┤                                   
  │ Core in prompt, rest in skills │ 500 + 1000 (10 triggers) │ 60,000 tokens    │                                   
  ├────────────────────────────────┼──────────────────────────┼──────────────────┤                                   
  │ Savings                        │                          │ 88% reduction    │                                   
  └────────────────────────────────┴──────────────────────────┴──────────────────┘                                   
  ---                                                                                                                
  ★ Insight ─────────────────────────────────────                                                                    
  The key insight:                                                                                                   
                                                                                                                     
  Prompt injection = Constitution (always applies)                                                                   
  Skills = Expertise (called when needed)                                                                            
                                                                                                                     
  Put identity and constraints in prompt injection.                                                                  
  Put domain knowledge and workflows in skills.                                                                      
                                                                                                                     
  The mistake is putting everything in CLAUDE.md — context bloats, important rules get lost in noise.                
  ─────────────────────────────────────────────────                                                                  
                                                                                                                     
  ---                                                                                                                
  Quick Reference                                                                                                    
                                                                                                                     
  ┌────────────────────────────────────────────────────────────────┐                                                 
  │  PROMPT INJECTION (CLAUDE.md)     │  /SKILL                    │                                                 
  ├────────────────────────────────────────────────────────────────┤                                                 
  │  "You are X"                      │  "When doing X, here's how" │                                                
  │  "Never do Y"                     │  "The workflow for Y is..." │                                                
  │  "Always check Z"                 │  "Detailed Z patterns..."   │                                                
  │  Short, critical, universal       │  Long, specific, conditional│                                                
  └────────────────────────────────────────────────────────────────┘  