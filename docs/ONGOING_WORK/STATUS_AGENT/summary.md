                                              
  Complete Topology (Corrected)                                                                                            
                                                                                                                           
                             ┌─────────────────────────────────────────┐                                                   
                             │            USER (Electron Window)        │                                                  
                             │  ┌─────────────────┬───────────────────┐│                                                   
                             │  │ ChatGPT         │   Build Tree      ││                                                   
                             │  │ BrowserView     │   (React Overlay) ││                                                   
                             │  │ (Always usable) │   - Progress      ││                                                   
                             │  │                 │   - Queries       ││                                                   
                             │  │                 │   - Input bar     ││                                                   
                             │  └─────────────────┴───────────────────┘│                                                   
                             └───────────────┬────────────────────────┘                                                    
                                             │ IPC (bidirectional)                                                         
                                             ▼                                                                             
  ┌──────────────────────────────────────────────────────────────────────────────┐                                         
  │                            STATUS AGENT (User-Facing Skin)                   │                                         
  │                                                                              │                                         
  │   JOB 1: TRANSLATOR          JOB 2: QUERY ROUTER         JOB 3: INTERRUPT   │                                          
  │   ──────────────────         ──────────────────          ─────────────────   │                                         
  │   Event → StatusLine         Query → Buttons             User text → PA     │                                          
  │   (Lookup table, no LLM)     Response → PA routing       (Keyword classify  │                                          
  │   Max 8 words                Timeout → default           then PA validates) │                                          
  │                                                                              │                                         
  │   SUBSCRIBES TO: Conductor, Executors, Bodyguard, PA, Spine, Archivist,     │                                          
  │                  Rate-Limit-Recovery, Context-Warden, Heartbeat             │                                          
  └──────────────────────────────────────────────────────────────────────────────┘                                         
             │                         │                              │                                                    
             │ subscribes              │ routes                       │ subscribes                                         
             ▼                         ▼                              ▼                                                    
  ┌───────────────────┐    ┌───────────────────┐          ┌───────────────────────┐                                        
  │ ORCHESTRATION     │    │ PA / MESSENGER    │          │ CRON LAYER            │                                        
  │ ─────────────────│    │ surgical routing  │          │ ──────────────────────│                                         
  │ Conductor (Tier1) │    │ envelope dispatch │          │ Rate-Limit-Recovery   │                                        
  │ Step-Scheduler    │    │ format bridging   │          │ Context-Warden kills  │                                        
  │ Circuit-Breaker   │    └───────────────────┘          │ Heartbeat (liveness)  │                                        
  │ DAG progress      │                                   │ Stale agent cleanup   │                                        
  └───────────────────┘                                   └───────────────────────┘                                        
             │                                                        │                                                    
             ▼                                                        │                                                    
  ┌───────────────────┐    ┌───────────────────┐                     │                                                     
  │ EXECUTION         │    │ ENFORCEMENT       │                     │                                                     
  │ ─────────────────│    │ ─────────────────│                     │                                                       
  │ CLI-Executor      │    │ Bodyguard (gates) │ ◄──────────────────┘                                                      
  │ Web-Executor      │    │ Spine (state)     │   (warden can kill/respawn                                                
  │ Service-Executor  │    │ PA-Comparison     │    agents, bodyguard checks                                               
  │ Adapters (Codex)  │    │ Skill Verification│    health via heartbeat)                                                  
  └───────────────────┘    └───────────────────┘                                                                           
             │                                                                                                             
             ▼                                                                                                             
  ┌───────────────────┐    ┌───────────────────────────────────────────┐                                                   
  │ SKILL SELECTOR    │    │ ARCHIVIST (Project Lifecycle)            │                                                    
  │ ─────────────────│    │ ────────────────────────────────────────│                                                      
  │ Agent (~400 tok)  │    │ Lifecycle: OPEN → PAUSED → CLOSED        │                                                    
  │ Keyword fallback  │    │                                          │                                                    
  │ Validator rails   │    │ On CLOSE: writes PROJECT-ARCHIVE.md      │                                                    
  └───────────────────┘    │           writes llms.txt                │                                                    
                           │           emits "archivist:complete"     │                                                    
                           │                                          │                                                    
                           │ On REOPEN: Conductor reads archive       │                                                    
                           │           (PAUL mode — knows history)    │                                                    
                           │                                          │                                                    
                           │ Status Agent translation:                │                                                    
                           │   "archivist:archiving" → "Saving..."    │                                                    
                           │   "archivist:complete" → output node     │                                                    
                           └───────────────────────────────────────────┘                                                   
                                                                                                                           
  Cron Layer → Status Agent Translation Map (Missing Events)                                                               
                                                                                                                           
  const CRON_TRANSLATIONS: Record<string, (detail: string) => StatusLine> = {                                              
                                                                                                                           
    // ── RATE LIMIT RECOVERY ────────────────────────────────────────                                                     
    "rate-limit:hit": (d) => ({                                                                                            
      text: "Taking a short break...",                                                                                     
      expandedText: `One of our tools needs to cool down. Estimated wait: ${JSON.parse(d).estimatedWait}. Other work       
  continues in the background.`,                                                                                           
      state: "paused",                                                                                                     
      icon: "⏸️",                                                                                                          
    }),                                                                                                                    
    "rate-limit:resumed": (_) => ({                                                                                        
      text: "Back to work!",                                                                                               
      expandedText: null,                                                                                                  
      state: "done",                                                                                                       
      icon: "▶️",                                                                                                          
    }),                                                                                                                    
                                                                                                                           
    // ── CONTEXT WARDEN ─────────────────────────────────────────────                                                     
    "context-warden:kill": (d) => ({                                                                                       
      text: "Refreshing memory...",                                                                                        
      expandedText: `Resetting context to stay sharp. No work lost.`,                                                      
      state: "active",                                                                                                     
      icon: "🔄",                                                                                                          
    }),                                                                                                                    
    "context-warden:respawn": (d) => ({                                                                                    
      text: "Memory refreshed",                                                                                            
      expandedText: `Picked up where we left off.`,                                                                        
      state: "done",                                                                                                       
      icon: "✅",                                                                                                          
    }),                                                                                                                    
                                                                                                                           
    // ── HEARTBEAT / LIVENESS ───────────────────────────────────────                                                     
    "heartbeat:stale": (d) => ({                                                                                           
      text: "Waking up a sleepy step...",                                                                                  
      expandedText: `Step "${JSON.parse(d).stepName}" went quiet. Restarting it.`,                                         
      state: "active",                                                                                                     
      icon: "⚡",                                                                                                          
    }),                                                                                                                    
    "heartbeat:recovered": (_) => ({                                                                                       
      text: "Step is back",                                                                                                
      state: "done",                                                                                                       
      icon: "✅",                                                                                                          
    }),                                                                                                                    
                                                                                                                           
    // ── ARCHIVIST ──────────────────────────────────────────────────                                                     
    "archivist:archiving": (_) => ({                                                                                       
      text: "Saving your project...",                                                                                      
      expandedText: `Creating project archive for next time.`,                                                             
      state: "active",                                                                                                     
      icon: "📦",                                                                                                          
    }),                                                                                                                    
    "archivist:complete": (d) => ({                                                                                        
      text: "Project saved",                                                                                               
      expandedText: `Archive ready: ${JSON.parse(d).archivePath}`,                                                         
      state: "done",                                                                                                       
      icon: "✅",                                                                                                          
    }),                                                                                                                    
    "archivist:reopen": (d) => ({                                                                                          
      text: "Remembering your project...",                                                                                 
      expandedText: `Loading history from last session.`,                                                                  
      state: "active",                                                                                                     
      icon: "📖",                                                                                                          
    }),                                                                                                                    
  };                                                                                                                       
                                                                                                                           
  Archivist Lifecycle Position                                                                                             
                                                                                                                           
  PROJECT LIFECYCLE:                                                                                                       
  ─────────────────────────────────────────────────────────────────────────                                                
                                                                                                                           
    ┌────────┐      User starts      ┌────────┐      Build       ┌────────┐                                                
    │  NEW   │ ──────build───────► │  OPEN  │ ────completes───► │ CLOSED │                                                 
    └────────┘                       └────────┘                   └────────┘                                               
                                          │                           │                                                    
                                     User closes                 Archivist                                                 
                                     mid-build                   triggers                                                  
                                          │                           │                                                    
                                          ▼                           ▼                                                    
                                    ┌────────┐              PROJECT-ARCHIVE.md                                             
                                    │ PAUSED │              llms.txt                                                       
                                    └────────┘              (output node)                                                  
                                          │                                                                                
                                     User reopens                                                                          
                                          │                                                                                
                                          ▼                                                                                
                                    ┌────────┐                                                                             
                                    │  OPEN  │ ◄── Conductor reads archive                                                 
                                    │ (PAUL) │     (knows full history)                                                    
                                    └────────┘                                                                             
                                                                                                                           
  Output Node in Tree (Archivist's Contribution)                                                                           
                                                                                                                           
  The final node at the bottom of the Build Tree is partly Archivist output:                                               
                                                                                                                           
    ○ Testing everything                                                                                                   
    ○ Publishing your site                                                                                                 
    │                                                                                                                      
    └─ 📦 Your finished site              ← Archivist produces this                                                        
       ├─ 🌐 Live URL (from deploy step)                                                                                   
       ├─ 📁 Project files (from Archivist archive)                                                                        
       └─ 📊 Performance report (from bodyguard final check)                                                               
                                                                                                                           
  When Status Agent receives archivist:complete, it updates the output node's projectFiles field with the archive path.    
                                                                                                                           
  ---                                                                                                                      
  The Archivist is the lifecycle manager that:                                                                             
  1. On CLOSE → Writes archive, Status Agent shows "Saving your project..."                                                
  2. On REOPEN → Conductor reads archive (PAUL mode), Status Agent shows "Remembering your project..."                     
  3. Produces → The "📁 Project files" link in the output node                             