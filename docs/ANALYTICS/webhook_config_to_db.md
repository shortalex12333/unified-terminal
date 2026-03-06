# Webhook → DB Ingestion Spec (Supabase)

This document defines the HTTP webhooks your backend should call to record downloads, app opens, views, and other analytics. Calls write into the `events` table via an RPC function and increment daily counters automatically via triggers.

Use only from your secure server (never expose the service key in a browser).

## Environment

- `SUPABASE_URL` = `https://djpbydshegxcsdnourjr.supabase.co`
- `SUPABASE_SERVICE_KEY` = value from `docs/DB/## DB config.md` `[SERVICE_KEY]`

Headers for all requests:

- `apikey: ${SUPABASE_SERVICE_KEY}`
- `Authorization: Bearer ${SUPABASE_SERVICE_KEY}`
- `Content-Type: application/json`

---

## Core RPC: Ingest Event

Endpoint:

- `POST ${SUPABASE_URL}/rest/v1/rpc/ingest_event`

Purpose:

- Insert a row into `public.events` and update daily analytics counters.

Parameters (JSON body):

- `p_user_id_hash` (string, required): Anonymous user identifier (SHA-256 of local user ID). See “User Hashing”.
- `p_event_type` (string, required): Event label (see below).
- `p_timestamp` (timestamp, optional): When the event happened. Defaults to `now()` if omitted. Use ISO 8601 (`YYYY-MM-DDTHH:mm:ss`).
- `p_project_id` (uuid, optional): Associated project (if applicable).
- `p_metadata` (json, optional): Arbitrary metadata object.

Event type mapping to counters:

- Downloads: `download`, `artifact_download`, `artifact_export` → increments `analytics_daily.downloads`.
- Opens: `app_open`, `open` → increments `analytics_daily.opens`.
- Views: `view`, `page_view`, `artifact_view`, `project_view` → increments `analytics_daily.views`.
- Interrupts: `user_interrupt` → increments `analytics_daily.user_interrupts`.
- DAU: Any event with a `p_user_id_hash` marks that user active for that `p_timestamp` day (deduped per user/day) and increments `analytics_daily.dau` once per user/day.

Tables impacted:

- `public.events` (append-only)
- `public.analytics_daily` (per-day counters)
- `public.analytics_daily_event_types` (per-day by event_type)
- `public.daily_user_events` (distinct users per day)

Example: Landing site “download”

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/ingest_event" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "p_user_id_hash": "<sha256-of-identifier>",
    "p_event_type": "download",
    "p_timestamp": "2026-03-05T12:00:00",
    "p_project_id": null,
    "p_metadata": {"src": "landing", "variant": "hero-button"}
  }'
```

Example: App first open

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/ingest_event" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "p_user_id_hash": "<sha256-of-identifier>",
    "p_event_type": "app_open",
    "p_timestamp": "2026-03-08T09:41:00",
    "p_project_id": null,
    "p_metadata": {"platform": "mac", "version": "0.1.0"}
  }'
```

Node.js example

```ts
await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_event`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    p_user_id_hash: userHash,
    p_event_type: 'download',
    p_timestamp: new Date().toISOString().slice(0,19), // no TZ
    p_project_id: null,
    p_metadata: { src: 'landing' },
  }),
});
```

Notes:

- If `p_timestamp` is omitted, DB uses `now()`; counters roll up by that day.
- If a user downloads today and opens the app days later, send their actual open time in `p_timestamp`.

---

## Optional RPC: Ingest Deployment

If you prefer explicit deployment rows over an `events` label, use this RPC to write into `public.deployments` (also increments `analytics_daily.deployments`).

Endpoint:

- `POST ${SUPABASE_URL}/rest/v1/rpc/ingest_deployment`

Parameters (JSON body):

- `p_project_id` (uuid, required)
- `p_timestamp` (timestamp, optional, defaults to `now()`)
- `p_provider` (text, optional) e.g., `vercel`, `netlify`
- `p_domain` (text, optional)
- `p_deployment_type` (text, optional) e.g., `local`, `hosted`
- `p_status` (text, optional, default `success`)

Example:

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/ingest_deployment" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "p_project_id": "00000000-0000-0000-0000-000000000000",
    "p_timestamp": "2026-03-05T12:30:00",
    "p_provider": "vercel",
    "p_domain": "example.com",
    "p_deployment_type": "hosted",
    "p_status": "success"
  }'
```

Tables impacted:

- `public.deployments` (append)
- `public.analytics_daily` (deployments++)

---

## User Hashing (server-side)

Compute `user_id_hash` as SHA-256 of a stable local identifier (install ID, license ID, etc.). Example:

```ts
import crypto from 'node:crypto';
const userHash = crypto.createHash('sha256').update(localId).digest('hex');
```

Never send raw PII; only the hash reaches the DB.

---

## Tables and Views (for reference)

- `events(id uuid, user_id_hash text, event_type text, project_id uuid, timestamp timestamp, metadata jsonb)`
- Daily rollups update automatically via triggers:
  - `analytics_daily(day, downloads, opens, views, user_interrupts, dau, projects_started, projects_completed, deployments)`
  - `analytics_daily_event_types(day, event_type, event_count)`
  - `daily_user_events(day, user_id_hash)`
- Optional:
  - `deployments(deployment_id uuid, project_id uuid, deployment_type text, provider text, domain text, status text, timestamp timestamp)`

Analytics views (ready to query/export):

- `v_daily_dashboard` — one row per day: dau, downloads, opens, views, projects_started, projects_completed, completion_rate, deployments, user_interrupts
- `v_events_daily` — per-day counts by `event_type`
- `v_dau`, `v_downloads_daily`, `v_views_daily`, `v_projects_started_daily`, `v_projects_completed_daily`, `v_deployments_daily`, `v_interrupts_daily`
- `v_core_metrics` — topline rates; `v_build_duration_stats` — build time stats

---

## Idempotency & Retries

- The RPC is not deduplicating by default. If you need idempotency, include a unique `event_id` in `p_metadata` and implement de-dupe later, or route through your server’s idempotency layer.
- Safe to retry; duplicates will increment counters again (by design) unless you gate them.

---

## Security

- Call RPCs only from a trusted server with the service key.
- Do not expose keys in client apps or on the landing page.
- RLS is disabled for these tables currently; service role is required.

