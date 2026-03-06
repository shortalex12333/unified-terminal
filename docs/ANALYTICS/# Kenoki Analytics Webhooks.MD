# Kenoki Analytics Webhooks — v1 Spec (Electron → Supabase)

**Status:** Launch-ready
**Purpose:** Define the minimal webhook surface area and app-side requirements to reliably send analytics + build results into Supabase at scale (10k+ users) without over-engineering.

---

## 1) Design Goals

* **One-way telemetry** from app → backend (no inbound commands required for v1).
* **Events-first** schema so you can answer product questions later.
* **Batching + offline queue** so you don’t lose data or spam Supabase.
* **Privacy by default:** store only `user_id_hash` (SHA-256), never raw identifiers.

---

## 2) Required Webhooks (Minimal Set)

You only need **3** endpoints for launch:

1. `POST /v1/telemetry/batch`
2. `POST /v1/project/snapshot`
3. `POST /v1/artifact/record`

Everything else can be derived from these.

### 2.1 `POST /v1/telemetry/batch`

Primary endpoint. Accepts **batched events**. This powers 80–90% of analytics.

**Used for**

* app opens / closes
* project start / complete / fail
* step updates (optional)
* interrupt/edit actions
* export / deploy actions
* subscription changes

**Request body**

```json
{
  "schema_version": "1.0",
  "client": {
    "app_version": "0.1.0",
    "platform": "macos",
    "os_version": "14.3",
    "device_arch": "arm64",
    "timezone": "America/New_York"
  },
  "identity": {
    "user_id_hash": "sha256_hex",
    "install_id_hash": "sha256_hex"
  },
  "batch": {
    "batch_id": "uuid",
    "sent_at": "2026-03-05T18:15:00Z",
    "events": [
      {
        "event_id": "uuid",
        "event_type": "project_start",
        "timestamp": "2026-03-05T18:14:10Z",
        "project_id": "uuid",
        "metadata": {
          "intent_class": "website",
          "tier": 2,
          "model_target": "codex",
          "source": "conductor"
        }
      }
    ]
  }
}
```

**Response**

```json
{
  "ok": true,
  "accepted": 42,
  "rejected": 0
}
```

**Server-side action**

* Insert rows into `events` table (and optionally derive `projects` updates from certain event types).

---

### 2.2 `POST /v1/project/snapshot`

Stores **one project record** (start + end + status) plus high-level summary. Useful because it prevents you relying purely on event reconstruction.

**Used for**

* project created
* project completed
* project failed / abandoned

**Request body**

```json
{
  "schema_version": "1.0",
  "user_id_hash": "sha256_hex",
  "project": {
    "project_id": "uuid",
    "project_type": "website",
    "intent_class": "website",
    "status": "complete",
    "created_at": "2026-03-05T18:14:10Z",
    "completed_at": "2026-03-05T18:29:40Z",
    "model_used": "codex",
    "steps_count": 9,
    "build_duration_ms": 930000,
    "failure_reason": null
  },
  "summary": {
    "interrupt_count": 2,
    "export_count": 1,
    "deploy_status": "not_attempted"
  }
}
```

**Response**

```json
{ "ok": true }
```

**Server-side action**

* Upsert into `projects` by `project_id`.

---

### 2.3 `POST /v1/artifact/record`

Tracks generated outputs (files/urls) and whether user exported or deployed.

**Used for**

* “artifact created”
* “export clicked”
* “deploy succeeded”

**Request body**

```json
{
  "schema_version": "1.0",
  "user_id_hash": "sha256_hex",
  "project_id": "uuid",
  "artifact": {
    "artifact_id": "uuid",
    "artifact_type": "website",
    "created_at": "2026-03-05T18:26:02Z",
    "size_bytes": 2483921,
    "storage": {
      "location": "local",
      "path_hint": "Kenoki/Projects/candle-store",
      "public_url": null
    },
    "labels": ["mvp", "site"]
  }
}
```

**Response**

```json
{ "ok": true }
```

**Server-side action**

* Insert into `artifacts`.
* If `public_url` exists, store it (do not infer it later).

---

## 3) Optional Webhooks (Defer Until Post-Launch)

Only add these if you actually need them.

### 3.1 `POST /v1/step/runtime`

Fine-grained per-step metrics (duration, retries). Good for cost/perf tuning later. Not required to ship.

### 3.2 `POST /v1/feedback`

Captures explicit user feedback with a project_id reference (thumbs up/down + short note).

### 3.3 `POST /v1/deploy/record`

If deploy logic becomes complex across providers, splitting deploy into its own endpoint can help. For v1 you can record deploy actions as events + artifact updates.

---

## 4) Authentication & Security (Minimal but Real)

### 4.1 Auth model

Use a **single app-level secret** (not user secrets) for telemetry ingestion:

* App sends header: `Authorization: Bearer <KENOKI_INGEST_KEY>`
* Key stored in app build-time config (rotateable).

Why: You do *not* want user auth + sessions just to log events.

### 4.2 Payload signing (recommended)

Add:

* `X-Kenoki-Signature: sha256_hmac(payload, ingest_secret)`
* `X-Kenoki-Timestamp: epoch_ms`

Server verifies:

* signature
* timestamp within 5–10 minutes (prevents replay)

### 4.3 Never store

* raw machine id
* raw email
* full file contents
* full HTML output
* user tokens / cookies
* model session IDs

If you store prompt text, treat it as sensitive and make it **opt-in** later.

---

## 5) App-Side Requirements (What Must Exist in Electron)

### 5.1 Telemetry client module (main process)

A single module responsible for:

* receiving IPC telemetry messages from renderer
* batching events
* retrying delivery
* persisting to disk when offline
* flushing on app close

**Core functions**

* `track(event_type, project_id?, metadata?)`
* `flush()`
* `setUserHash(user_id_hash, install_id_hash)`

### 5.2 Local queue (must-have)

You need a persistent queue so you don’t lose events.

**Storage**

* SQLite (recommended) or
* append-only JSONL file (acceptable for v1)

Minimal queue fields:

* event_id
* payload
* created_at
* retry_count
* next_attempt_at

### 5.3 Batching rules (sane defaults)

* Batch up to **50 events** or **64 KB**, whichever first
* Flush every **5–10 seconds** while active
* Flush immediately on:

  * `project_complete`
  * `project_fail`
  * `subscription_start/cancel`

### 5.4 Retry + backoff (must-have)

* exponential backoff
* jitter
* max retries: 10
* dead-letter: store locally until next launch after max retries (don’t drop)

### 5.5 IPC contract (renderer → main)

Renderer should never directly call Supabase. It sends:

* `telemetry:track`
* `telemetry:flush`
* `telemetry:setProjectContext`

---

## 6) Supabase Setup

### 6.1 Database tables (minimum)

* `events`
* `projects`
* `prompts` (optional at launch if you want prompt retention)
* `artifacts`

(Your previous doc already defines these; this webhook spec assumes that structure.)

### 6.2 Row volume expectation

At 10k users, if you emit ~50 events/user/week:

* 500k events/week
  That’s fine in Postgres if you:
* index correctly
* batch inserts

### 6.3 Indexes (minimum)

* `events(user_id_hash, timestamp desc)`
* `events(project_id, timestamp)`
* `projects(user_id_hash, created_at desc)`
* `artifacts(project_id, created_at desc)`

### 6.4 Storage buckets (optional)

If you ever upload:

* screenshots
* small previews
* logs

Use Supabase Storage with:

* short retention
* explicit user opt-in
  For v1, you can skip uploads entirely.

---

## 7) Packages (Electron / Node)

Minimal, safe choices:

**Core**

* `@supabase/supabase-js` (only if you write directly; otherwise not needed if you use your own webhook server)
* `node-fetch` or native `fetch` (Node 18+)
* `crypto` (built-in) for SHA-256 + HMAC

**Queue (pick one)**

* `better-sqlite3` (simple, fast, reliable)
* or `sqlite3` (fine but heavier)
* or JSONL (no dependency, but less robust)

**Validation (recommended)**

* `zod` for payload schema validation before sending

**Server (if you run a lightweight ingest API)**

* `express` or `fastify`
* `pg` if not using Supabase RPC directly
* or Supabase Edge Functions if you want to keep it inside Supabase

---

## 8) What the App Should Send (Event Coverage)

Here’s the minimal event set you should implement **tomorrow**:

### App lifecycle

* `app_open`
* `app_close`

### Project lifecycle

* `project_start`
* `project_complete`
* `project_fail` (include failure reason category)

### User control signals

* `user_interrupt`
* `user_edit` (your hover-overlay edits count here)

### Value signals

* `artifact_created`
* `artifact_export`
* `deploy_attempt`
* `deploy_success`
* `deploy_fail`

### Monetization

* `subscription_start`
* `subscription_cancel`
* `local_model_fallback_enabled`

Everything else is noise at launch.

---

## 9) Data Minimization Defaults

**Default (recommended for shipping tomorrow):**

* store prompts only if they are short and non-sensitive, OR store only `intent_class` + a prompt hash
* store “build requirements” as structured fields (industry, style, pages) rather than raw free text where possible

You can add “full prompt retention” later as an explicit opt-in.

---

## 10) Launch Checklist

**Must have**

* main-process telemetry client
* disk-backed queue
* batch + retry + flush on complete
* 3 endpoints implemented
* Supabase tables + indexes

**Nice to have**

* payload signing
* zod validation
* dead-letter viewer for debugging

---
