# Kenoki — Minimal Analytics Architecture (v1)

**Launch-Ready Telemetry Design for Electron + Supabase**

**Status:** Launch Implementation
**Audience:** Engineering / Product
**Goal:** Capture the minimum analytics required to understand user behavior, diagnose failures, and measure adoption without over-engineering.

---

# 1. Principles

This analytics system is designed with the following constraints:

**1. Ship fast.**
Instrumentation must not delay product launch.

**2. Capture events, not dashboards.**
Raw event data is far more valuable than premature visualization.

**3. Preserve user privacy.**
Users are identified only via a SHA-256 hash of a local user identifier.

**4. Focus on behavioral signals.**
Analytics must answer the core questions:

* Are users starting projects?
* Are they completing them?
* Where do builds fail?
* What artifacts are produced?
* Do users return?

**5. Keep schema flexible.**
Use `JSONB` metadata fields so the system can evolve without migrations.

---

# 2. System Architecture

Telemetry follows a simple pipeline:

```
Renderer (UI)
      │
      │ IPC Event
      ▼
Electron Main Process
      │
      │ Batched Webhook
      ▼
Supabase API
      │
      ▼
PostgreSQL Analytics Tables
```

### Why route through the Electron main process

Benefits:

* Prevent renderer tampering
* Batch events to reduce load
* Maintain centralized telemetry control
* Avoid UI thread blocking

---

# 3. User Identification

Users are tracked anonymously.

### Identifier generation

```
user_id_hash = SHA256(local_user_identifier)
```

Example sources:

* machine fingerprint
* locally generated UUID
* installation ID

Only the **hash** is stored in the database.

No personally identifiable information is required.

---

# 4. Core Analytics Tables

The initial launch system uses **four primary tables**.

These capture the majority of behavioral insight needed for early product development.

---

# 4.1 Events Table

This table records all system and user interactions.

### Table: `events`

| Column       | Type      | Description                   |
| ------------ | --------- | ----------------------------- |
| id           | UUID      | Unique event identifier       |
| user_id_hash | TEXT      | SHA256 hashed user identifier |
| event_type   | TEXT      | Event category                |
| project_id   | UUID      | Associated project            |
| timestamp    | TIMESTAMP | Event timestamp               |
| metadata     | JSONB     | Flexible event metadata       |

### Example Event Types

```
app_open
project_start
project_complete
project_fail
user_interrupt
user_edit
artifact_export
deploy_attempt
deploy_success
deploy_fail
subscription_start
subscription_cancel
```

### Example Event Record

```json
{
 "user_id_hash": "sha256hash",
 "event_type": "project_start",
 "project_id": "uuid",
 "timestamp": "2026-03-05T16:22:10Z",
 "metadata": {
   "intent": "website",
   "model": "gpt-5"
 }
}
```

---

# 4.2 Projects Table

Tracks project lifecycle and completion.

### Table: `projects`

| Column        | Type      | Description                |
| ------------- | --------- | -------------------------- |
| project_id    | UUID      | Unique project identifier  |
| user_id_hash  | TEXT      | Owner                      |
| project_type  | TEXT      | Classified project intent  |
| created_at    | TIMESTAMP | Project start              |
| completed_at  | TIMESTAMP | Completion timestamp       |
| status        | TEXT      | success / fail / abandoned |
| model_used    | TEXT      | Model used during build    |
| steps_count   | INT       | Number of DAG steps        |
| artifact_type | TEXT      | Primary artifact           |

### Example Project Types

```
website
landing_page
portfolio
store
blog
automation
```

---

# 4.3 Prompts Table

Stores user intent inputs.

### Table: `prompts`

| Column       | Type      | Description              |
| ------------ | --------- | ------------------------ |
| prompt_id    | UUID      | Prompt identifier        |
| user_id_hash | TEXT      | User                     |
| project_id   | UUID      | Associated project       |
| prompt_text  | TEXT      | User request             |
| intent_class | TEXT      | Conductor classification |
| timestamp    | TIMESTAMP | Creation time            |

### Example Intent Classes

```
website
landing_page
blog
portfolio
automation
general_chat
```

Intent classification should be performed by the orchestration layer (Conductor).

---

# 4.4 Artifacts Table

Tracks generated outputs.

### Table: `artifacts`

| Column        | Type      | Description         |
| ------------- | --------- | ------------------- |
| artifact_id   | UUID      | Artifact identifier |
| project_id    | UUID      | Associated project  |
| artifact_type | TEXT      | Output type         |
| size          | INTEGER   | File size           |
| created_at    | TIMESTAMP | Creation timestamp  |

### Artifact Types

```
website
image
logo
pdf
document
code
```

This table answers the key question:

**What are users actually creating with the system?**

---

# 5. Optional Tables (Post-Launch)

These tables are useful but **not required for initial launch**.

Add them only after early traction.

---

## Step Runtime Table

Tracks performance of individual DAG steps.

### Table: `project_steps`

| Column        | Type | Description     |
| ------------- | ---- | --------------- |
| step_id       | UUID | Step identifier |
| project_id    | UUID | Parent project  |
| step_type     | TEXT | Worker role     |
| runtime_model | TEXT | Model used      |
| duration_ms   | INT  | Step runtime    |
| status        | TEXT | success / fail  |
| retry_count   | INT  | Retry attempts  |

---

## Deployments Table

Tracks website publishing activity.

### Table: `deployments`

| Column          | Type      | Description           |
| --------------- | --------- | --------------------- |
| deployment_id   | UUID      | Deployment identifier |
| project_id      | UUID      | Project               |
| deployment_type | TEXT      | local / hosted        |
| provider        | TEXT      | Hosting provider      |
| domain          | TEXT      | Published domain      |
| status          | TEXT      | success / fail        |
| timestamp       | TIMESTAMP | Deployment time       |

---

## Subscriptions Table

Tracks monetization lifecycle.

### Table: `subscriptions`

| Column               | Type      | Description            |
| -------------------- | --------- | ---------------------- |
| user_id_hash         | TEXT      | User                   |
| plan                 | TEXT      | Free / Paid            |
| started_at           | TIMESTAMP | Start date             |
| ended_at             | TIMESTAMP | End date               |
| local_model_fallback | BOOLEAN   | Offline mode activated |

---

# 6. Key Metrics to Monitor

Six metrics are sufficient to evaluate product traction.

---

## Project Start Rate

```
projects_started / total_users
```

Measures onboarding success.

---

## Project Completion Rate

```
projects_completed / projects_started
```

If this falls below **40–50%**, users are encountering friction.

---

## Artifact Export Rate

```
artifacts_exported / projects_completed
```

Indicates whether users perceive outputs as valuable.

---

## Deployment Rate

```
deployments / projects_completed
```

Critical for website-building workflows.

---

## Interrupt Rate

```
user_interrupt_events / projects
```

High values indicate poor initial build accuracy.

---

## 7-Day Return Rate

```
users_returning_within_7_days / total_users
```

Primary indicator of product stickiness.

---

# 7. Build Duration Metric

One additional metric should always be recorded:

```
build_duration = project_complete_time - project_start_time
```

Users generally tolerate build times of:

```
5–12 minutes
```

Beyond this threshold, perceived performance declines rapidly.

---

# 8. Implementation Guidelines

### Event Capture

All events should be sent through:

```
Renderer → IPC → Electron Main → Supabase
```

### Event Batching

Batch events in the main process to reduce database overhead.

### Metadata Storage

Use `JSONB` fields for extensibility.

Example metadata payload:

```json
{
 "intent": "website",
 "model": "gpt-5",
 "agent_runtime": "codex",
 "tier": "tier2"
}
```

---

# 9. Data Strategy (Long-Term)

The most valuable analytics data will not be token usage or runtime metrics.

The key strategic dataset is **workflow behavior**:

```
task patterns
workflow patterns
artifact patterns
```

Examples of future insights:

* Most common workflows for non-technical users
* Points where users abandon builds
* Most requested artifact types
* Successful project templates

Over time this dataset enables:

* workflow templates
* artifact recipes
* predictive build pipelines

---

# 10. Launch Scope

For initial release, only implement:

```
events
projects
prompts
artifacts
```

All other telemetry can be added incrementally.

The priority is **shipping the product**, not perfect analytics.

---

**End of Document**
