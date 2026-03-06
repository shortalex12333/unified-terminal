# Kenoki — Context Window Auto-Switch Architecture

**Provider Switching & Local Model Continuation System (Concept Specification)**

**Status:** Future Feature Specification
**Audience:** Product, Engineering, Architecture
**Purpose:** Define the system that automatically detects when an AI model’s context window is exhausted and seamlessly continues the workflow using another provider or a local model.

---

# 1. Executive Overview

Large language models operate within a **finite context window**, which represents the maximum amount of information the model can consider during a single interaction. When this limit is exceeded, earlier information can be dropped or degraded, which can cause agents to fail or produce incorrect results. ([Comet][1])

In multi-agent workflows—such as Kenoki’s orchestration pipelines—context accumulation can occur rapidly due to:

* tool outputs
* system instructions
* conversation history
* workflow state
* retrieved data

Each element consumes tokens inside the model’s context window. ([Comet][1])

Kenoki addresses this limitation through a **context window continuation system** that allows agent workflows to resume execution using:

1. another AI provider already subscribed to by the user
2. a locally running AI model
3. a newly downloaded model optimized for the user’s hardware

The goal is to ensure that **long-running workflows never fail due to context limitations**.

---

# 2. Design Philosophy

The continuation system follows four core principles.

---

## 2.1 Workflow Continuity

Agentic workflows should **never terminate because a context window was exceeded**.

Instead, the system pauses execution, transitions to another model runtime, and resumes the plan.

---

## 2.2 Provider Independence

Kenoki is designed as an **AI orchestration framework**, not an AI provider.

The system must be able to operate with:

* OpenAI subscriptions
* Anthropic subscriptions
* Google subscriptions
* locally hosted models
* future providers

This allows the workflow engine to remain independent of model providers.

---

## 2.3 User Transparency

The user is informed through a simple prompt:

```
This task needs more context space.

Would you like to continue using another AI provider?
```

Users can choose:

* another connected AI provider
* local AI model
* download a model compatible with their hardware

The system handles all technical switching behind the scenes.

---

## 2.4 Stateless Agent Continuation

Agents must not depend on a single model instance.

Instead they operate on:

```
workflow state
plan steps
artifact outputs
memory summaries
```

This allows execution to resume on a different runtime without losing progress.

---

# 3. Context Window Limit Detection

The orchestration system monitors token usage during execution.

Trigger conditions include:

| Trigger            | Description                   |
| ------------------ | ----------------------------- |
| token threshold    | token usage approaching limit |
| provider error     | API returns context overflow  |
| context rot        | model accuracy degrading      |
| planned checkpoint | scheduled context reset       |

Context windows represent the maximum input size a model can process at once. ([Wikipedia][2])

Even before the hard limit is reached, agent performance can degrade as context length grows. ([Redis][3])

Therefore switching can occur **before failure**.

---

# 4. Context Continuation Workflow

When the limit is detected:

```
Agent Execution
       │
       ▼
Context Threshold Reached
       │
       ▼
Execution Pause
       │
       ▼
User Prompt
       │
       ▼
Provider Selection
       │
       ▼
State Compression
       │
       ▼
New Runtime Launch
       │
       ▼
Agent Continuation
```

---

# 5. User Interaction Flow

The user interface presents a simple decision prompt.

Example:

```
This task needs more memory to continue.

Choose how to proceed:

[ Continue with another AI provider ]
[ Use local AI model ]
[ Download compatible model ]
```

Users do not need to understand context windows or token limits.

---

# 6. Provider Switching

If the user chooses another provider:

1. Kenoki signs the user out of the current provider session
2. authentication screen opens
3. user logs into the new provider
4. API keys are stored securely
5. workflow continues

Example provider flow:

```
ChatGPT → Claude
Claude → Gemini
Gemini → Local Model
```

The orchestration engine remains unchanged.

---

# 7. Local Model Mode

If the user selects **local execution**, Kenoki searches the machine for installed models.

### Detection process

1. scan known model directories
2. detect running inference servers
3. identify compatible runtimes

Examples:

```
Ollama
LM Studio
llama.cpp
GGUF models
```

If a model exists, Kenoki launches a local inference instance.

---

# 8. Hardware Analysis

If no model is detected, Kenoki analyzes the machine hardware.

Parameters evaluated:

| Parameter  | Purpose                  |
| ---------- | ------------------------ |
| CPU cores  | compute capability       |
| GPU VRAM   | model size compatibility |
| system RAM | memory availability      |
| disk space | model storage            |

This determines the maximum feasible model size.

Example classification:

| Hardware Tier | Model Type    |
| ------------- | ------------- |
| low           | 3B model      |
| medium        | 7B model      |
| high          | 13B–70B model |

---

# 9. Model Download System

If a local model must be installed, Kenoki retrieves it automatically.

Source:

```
HuggingFace Model Hub
```

Download process:

```
Hardware Scan
       │
       ▼
Model Recommendation
       │
       ▼
User Approval
       │
       ▼
Background Download
       │
       ▼
Model Installation
       │
       ▼
Inference Server Launch
```

Supported formats include:

```
GGUF
Safetensors
Ollama models
```

---

# 10. Agent Continuation Logic

Before switching runtimes, Kenoki compresses the workflow state.

This includes:

```
current plan
completed steps
artifact outputs
agent notes
summaries
```

This approach is similar to **sequential context window strategies**, where earlier conversation history is summarized to allow work to continue in a fresh context window. ([Medium][4])

The new runtime receives:

```
workflow_summary
current_task
required_files
agent_instructions
```

Execution then resumes.

---

# 11. Multi-Agent Continuation

Kenoki supports multiple active agents.

During switching:

```
active agent paused
context summarized
runtime switched
agent resumed
```

Other agents remain unaffected.

This aligns with Kenoki’s **surgical orchestration model**.

---

# 12. Runtime Isolation

Each provider runtime operates inside an isolated execution container.

Example:

```
Provider Runtime A
ChatGPT API

Provider Runtime B
Claude API

Provider Runtime C
Local Model
```

Switching simply redirects agent requests to the new runtime.

---

# 13. Status Agent Integration

The Status Agent informs the user during switching.

Example messages:

```
This task needs more memory to continue.
Switching AI provider...
Continuing your build...
```

Users see progress updates but not technical details.

---

# 14. Security Considerations

Switching providers introduces several security risks.

Mitigations include:

### Credential isolation

Provider authentication tokens must be stored securely.

### Local model sandboxing

Local inference processes run in isolated environments.

### Execution verification

The PA verifies that continuation instructions match the original workflow plan.

---

# 15. Performance Considerations

Local models may operate slower than cloud providers.

The system must display clear status messages such as:

```
Running locally. This may take slightly longer.
```

Users should always have the option to return to a cloud provider.

---

# 16. Monetization Strategy

The continuation system is designed to become a premium feature.

Potential pricing structure:

| Tier | Capability                |
| ---- | ------------------------- |
| Free | single provider           |
| Paid | provider switching        |
| Pro  | local model orchestration |

This system effectively allows Kenoki to function as an **AI runtime manager**.

---

# 17. Strategic Value

The context continuation system provides three key advantages:

### Unlimited workflow length

Projects can continue indefinitely.

### Provider flexibility

Users are not locked into a single AI provider.

### Hardware leverage

Users can run models locally when cloud limits are reached.

---

# 18. Future Enhancements

Possible expansions include:

### automatic switching

Kenoki chooses the optimal runtime without user input.

### distributed execution

multiple models run different agents simultaneously.

### hybrid workflows

cloud + local models cooperate in a single pipeline.

---

# 19. Summary

Kenoki’s context window continuation system ensures that workflows never fail due to model memory limitations.

When context limits are reached:

1. execution pauses
2. user selects a continuation method
3. workflow state is summarized
4. a new runtime is launched
5. agents resume execution

This design allows Kenoki to function as a **model-agnostic orchestration framework** capable of sustaining complex, long-running AI workflows across multiple providers and hardware environments.

---

**End of Document**

