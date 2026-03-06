
  Capture Strategies

  - Install-click webhook (recommended): On landing page “Download” click, POST metadata to /install (Edge Function), then
    serve the DMG. Optional email field (visible, not required).
  - Optional email gate: “Get updates + download” collects email with consent; issues a magic install_id for pairing.
  - App-only mode: No email on web. App generates user_id_hash locally and sends usage events; you still get geo/device via
    server from request IP/UA.

  Recommended Approach

  - Primary: Install-click webhook with optional email; DMG named with install_id to link click → install invisibly.
  - Secondary: In-app “Connect email for updates” toggle on first-run (off by default) to enrich users later, not required to
    use the app.
  - Never scrape provider emails from ChatGPT/Claude UI; violates ToS and risks your exit.

  Landing Page Setup

  - On “Download” button click:
      - Generate install_id = uuidv4() client-side.
      - POST to /install with: install_id, email (if provided), user_agent, referrer, utm_*, consent_version.
      - On 204, start download from a URL that embeds the same install_id, e.g. https://cdn/kenoki/
        Kenoki-<version>-<install_id>.dmg.
  - Snippet:
      - await fetch('/install', { method:'POST', headers:{'Content-Type':'application/json'}, body:
        JSON.stringify({ install_id, email, referrer: document.referrer, utm: getUTM(), consent_version:'v1' }) })

  App Setup (no auth)

  - First run:
      - Parse install_id from the app bundle name or from a small sidecar file dropped by the installer; fall back to none.
      - Generate user_id_hash = sha256(local_uuid) and device_id = uuidv4().
      - Collect device/app info: os, os_version, device_model, device_type, cpu_arch, screen_resolution, locale, app_version.
      - Send /ingest batch with session start + telemetry; include install_id if present to link web → app.
  - Optional “Email for updates” toggle: if user opts in, POST email to /install (same pipeline), encrypt at rest.

  Data Model (additions)

  - users(user_id_hash PK, email_encrypted, email_hash, first_seen, last_seen, marketing_opt_in, privacy_consent_at,
    consent_version)
  - devices(device_id PK, user_id_hash FK, os, os_version, device_model, device_type, installed_at, last_seen,
    device_fingerprint)
  - sessions(session_id PK, user_id_hash FK, device_id FK, started_at, ended_at, app_version)
  - events add: session_id, app_version, os, os_version, device_type, device_model, cpu_arch, screen_resolution, locale,
    country, region, city, ip_hash, user_agent, install_source, referrer, utm_source/medium/campaign/content/term,
    consent_version
  - webhooks_installs(install_id PK, email_encrypted, email_hash, ip_hash, user_agent, country/region/city, referrer, utm_*,
    created_at)

  Security/RLS/RBAC

  - Enable RLS on all tables; no anon/auth policies (deny all).
  - All writes only via Edge Functions using service_role key (server-side).
  - Encrypt PII (email) with pgcrypto; store blind index (email_hash) for lookups.
  - Hash IP (ip_hash) + derive geo; never store raw IP.
  - Add TTL jobs (pg_cron) to purge ip_hash after N days and archive raw events after N months.
  - Create analytics read-only views for internal dashboards; do not expose raw tables.

  Compliance/Consent

  - Landing page: short consent copy near Download (“We collect install metrics and optional email to improve Kenoki;
    privacy-first, no resale of PII”). Link Privacy Policy.
  - App first-run: single toggle for “Send usage analytics” (on) and “Email updates” (off). Record consent_version in events.
  - Avoid “invisible” email capture without clear consent; use optional field or magic-link flow if you need verified email.

  Provider Selection UX

  - Keep provider selection inside app after first-run (ChatGPT first), but don’t block usage. No extra “account” required to
    use Kenoki.

  What NOT to do

  - Don’t scrape ChatGPT/Claude DOM for emails or IDs.
  - Don’t store raw IPs or emails in plain text.
  - Don’t expose service keys in the app.

