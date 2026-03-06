
  Ingestion Architecture

  - App → Ingest endpoint (Supabase Edge Function) → DB
  - No direct client DB access. Edge Function runs with service role, validates payloads, derives geo/device, writes to DB.
  - Batch-friendly: app sends small batches; function upserts users/devices/sessions then inserts events.

  Schema Additions

  - events: add session_id uuid, app_version text, os text, os_version text, device_type text, device_model text, cpu_arch
    text, screen_resolution text, locale text, country text, region text, city text, ip_hash text, user_agent text,
    install_source text, referrer text, utm_source/utm_medium/utm_campaign/utm_content/utm_term text, consent_version text.
  - users: user_id_hash text PK, email_encrypted bytea, email_hash text unique, first_seen timestamptz, last_seen
    timestamptz, marketing_opt_in boolean, privacy_consent_at timestamptz, consent_version text.
  - devices: device_id uuid PK, user_id_hash FK, device_fingerprint text, os text, os_version text, device_model text,
    device_type text, installed_at timestamptz, last_seen timestamptz.
  - sessions: session_id uuid PK, user_id_hash FK, device_id FK, started_at timestamptz, ended_at timestamptz, app_version
    text.
  - webhooks_installs: install_id uuid PK, email_encrypted bytea, email_hash text unique, ip_hash text, user_agent text,
    country/region/city text, referrer/utm_* text, created_at timestamptz.
  - consent_events: consent_id uuid PK, user_id_hash, event text, version text, timestamp timestamptz.

  Keys, FKs, Indexes

  - events.project_id → projects.project_id (exists)
  - events.session_id → sessions.session_id
  - events.user_id_hash → users.user_id_hash (soft FK via upsert in function; can add FK if we upsert first)
  - artifacts.project_id → projects.project_id (exists)
  - prompts.project_id → projects.project_id (exists)
  - project_steps.project_id → projects.project_id (exists)
  - deployments.project_id → projects.project_id (exists)
  - devices.user_id_hash → users.user_id_hash
  - sessions.user_id_hash → users.user_id_hash; sessions.device_id → devices.device_id
  - Indexes: user_id_hash on users/sessions/events; (country, created_at) on events for geo/time; (utm_*, created_at)
    partials as needed.

  RLS (Row‑Level Security)

  - Enable RLS on all tables.
  - No app auth ⇒ do not allow anon/authenticated direct access.
  - Policies:
      - Base tables (events, projects, prompts, artifacts, project_steps, deployments, subscriptions, users, devices,
        sessions, webhooks_installs, consent_events):
          - anon: deny all (no policies).
          - authenticated: deny all (no policies).
          - service_role: bypasses RLS (Supabase default), used by the Edge Function to write.
  - Optional public views:
      - Create aggregated, non‑PII views (e.g., v_metrics_7d) and grant SELECT to anon if you want a public status page;
        otherwise keep internal only.

  RBAC

  - Supabase roles in use: anon, authenticated, service_role.
  - No client keys embedded other than anon; all writes route through Edge Function using service key server‑side.
  - Create a read-only Postgres role (analytics_ro) if you need BI access via connection pooling; grant SELECT on views only.

  PII and SOC‑2 Controls

  - Email: store as pgcrypto pgp_sym_encrypt(email, :KMS_KEY) in email_encrypted, and store blind index email_hash =
    sha256(lower(email)||':'||pepper) for lookups. Never store raw email in events.
  - IP: never store raw IP; store only ip_hash = sha256(ip||':'||pepper), and derived geo fields (country/region/city) from
    the ingest function.
  - Device fingerprint: store a stable, privacy‑preserving fingerprint (hash) in devices; no raw serials.
  - Consent: record privacy consent events with version, and consent_version on events.
  - Data minimization: keep user_id_hash as primary identity; emails optional via webhook/landing “install” with explicit
    notice.
  - Retention: schedule TTL jobs (pg_cron) to purge ip_hash after N days (e.g., 30), and to archive raw events after N
    months.
  - Access logging: add write triggers to audit table (operation, table, row_id, timestamp) for admin actions.

  “Install” Webhook (email capture)

  - Marketing site “Install” button POSTs to /install Edge Function with optional email and UTM params.
  - Function:
      - Normalizes and validates email (optional).
      - Encrypts email, computes blind index.
      - Derives geo from request IP.
      - Creates/updates users (by email_hash or user_id_hash when provided), webhooks_installs row, and a synthetic “install”
        event.
      - Returns 204; no cookies; rate‑limits per IP/email.

  Why this fits “no app auth”

  - App never authenticates with Supabase. It only calls public Edge Function endpoints.
  - Functions run server‑side with service role; RLS is enabled everywhere; base tables are not exposed to anon.

  Implementation Steps

  - Alter schema: add columns to events; create users/devices/sessions/webhooks_installs/consent_events.
  - Enable RLS on all tables; remove any permissive anon policies; keep service_role path via Edge Functions.
  - Create views for internal analytics; optional public view for non‑PII aggregates.
  - Add pgcrypto and pg_cron extensions; store encryption key/pepper in Supabase secrets.
  - Build Edge Functions:
      - /ingest (batch events)
      - /install (landing webhook)
      - Shared lib for hashing/geo/device parsing.
  - Add retention cron jobs and audit triggers.
