# Ingest Webhook — Why, How, and What

This API route receives analytics events (downloads, app opens, views, etc.) and forwards them to Supabase using a secure server‑to‑server call. The DB triggers then update daily counters automatically.

## Why

- Record critical product metrics (downloads, opens/DAU, views, completions) without exposing any secrets to the browser.
- Normalize events into a single source of truth (`events`) and keep a daily summary (`analytics_daily`) up to date via triggers.

## What It Does

- `pages/api/ingest.ts` (serverless function on Vercel)
  - Validates input
  - Optionally checks a shared secret header
  - Calls Supabase RPC `ingest_event` to insert into `public.events`
  - DB triggers increment per‑day counters (downloads/opens/views/interrupts/DAU)

## Where

- API Route: `pages/api/ingest.ts` (this repo)
- DB: Supabase project referenced in `docs/DB/## DB config.md` of the desktop app repo

## Environment Variables (Vercel)

- `SUPABASE_URL` — e.g., `https://djpbydshegxcsdnourjr.supabase.co`
- `SUPABASE_SERVICE_KEY` — service role key (never expose in browser)
- `WEBHOOK_SHARED_SECRET` — optional; set to a random string
- `USER_HASH_PEPPER` — required if you send raw `user_id`; used to compute SHA‑256 hash server‑side

## Request Contract

POST `/api/ingest`

Headers:
- `Content-Type: application/json`
- `X-Webhook-Secret: <WEBHOOK_SHARED_SECRET>` (if configured)

Body JSON (either pre‑hashed or raw ID):
```
{
  // Option A (preferred if already hashed):
  "user_id_hash": "<sha256-of-stable-id>",
  // OR Option B (server hashes with USER_HASH_PEPPER):
  "user_id": "<stable-non-PII-id>",
  "event_type": "download | app_open | view | ...",
  "timestamp": "YYYY-MM-DDTHH:mm:ss" (optional, UTC),
  "project_id": "uuid" (optional),
  "metadata": { "key": "value" } (optional)
}
```

Notes:
- `user_id_hash` is required for DAU and attribution. Use SHA‑256 of a stable but non‑PII identifier.
- `timestamp` defaults to “now” if omitted. The DB stores TIMESTAMP (no TZ); server converts ISO to `YYYY-MM-DDTHH:mm:ss`.
- Allowed `event_type` values (extendable):
  - Downloads: `download`, `artifact_download`, `artifact_export`
  - Opens: `app_open`, `open`
  - Views: `view`, `page_view`, `artifact_view`, `project_view`
  - Interrupts: `user_interrupt`

## What Gets Written

- `public.events(id, user_id_hash, event_type, project_id, timestamp, metadata)`
- Triggers update rollups:
  - `public.analytics_daily(day, downloads, opens, views, user_interrupts, dau, projects_started, projects_completed, deployments)`
  - `public.analytics_daily_event_types(day, event_type, event_count)`
  - `public.daily_user_events(day, user_id_hash)`

## Example (Landing Page Download) — raw user_id (server hashes)

```bash
curl -X POST "https://<your-vercel-domain>/api/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SHARED_SECRET" \
  -d '{
    "user_id": "install-12345",
    "event_type": "download",
    "timestamp": "2026-03-05T12:00:00",
    "metadata": {"src": "landing"}
  }'
```

## Example (App First Open) — pre‑hashed user_id_hash

```bash
curl -X POST "https://<your-vercel-domain>/api/ingest" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SHARED_SECRET" \
  -d '{
    "user_id_hash": "<sha256>",
    "event_type": "app_open",
    "timestamp": "2026-03-08T09:41:00",
    "metadata": {"platform": "mac", "version": "0.1.0"}
  }'
```

## Security

- Calls must originate from your server/landing site only.
- Keep `SUPABASE_SERVICE_KEY` in serverless env only; never in client code.
- Use `X-Webhook-Secret` to authenticate the caller.

## Checking the Data

- Per‑day summary: `public.analytics_daily` or view `public.v_daily_dashboard`
- Event breakdown by type/day: `public.analytics_daily_event_types` or `public.v_events_daily`
- DAU: `public.v_dau`

## Extending

- Add new `event_type` labels and map them in DB triggers if you want dedicated counters.
- For deployments, you can also call `ingest_deployment` RPC (documented in the desktop repo’s analytics doc) if you want explicit rows in `public.deployments`.
