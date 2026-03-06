  Required Env Vars

  - SUPABASE_URL: https://djpbydshegxcsdnourjr.supabase.co
  - SUPABASE_SERVICE_KEY: from docs/DB/## DB config.md [SERVICE_KEY]
  - Optional: WEBHOOK_SHARED_SECRET (to authenticate callers)

  Vercel Setup

  - Add the above env vars in Vercel project settings.
  - Create an API route that proxies to the Supabase RPC ingest_event.

  Next.js API Route (pages/api/ingest.ts)

  - Accepts JSON: { user_id_hash, event_type, timestamp?, project_id?, metadata? }
  - Calls POST ${SUPABASE_URL}/rest/v1/rpc/ingest_event with required headers.

  Example:

  - Path: pages/api/ingest.ts
  - Behavior:
      - Validate WEBHOOK_SHARED_SECRET (if set)
      - Map body → RPC params:
          - p_user_id_hash, p_event_type, p_timestamp (string like YYYY-MM-DDTHH:mm:ss), p_project_id, p_metadata
      - Forward with headers:
          - apikey: SUPABASE_SERVICE_KEY
          - Authorization: Bearer SUPABASE_SERVICE_KEY
          - Content-Type: application/json

  Event Types to Send

  - Downloads: download (or artifact_download, artifact_export)
  - Opens: app_open
  - Views: view, page_view, artifact_view, project_view
  - Interrupts: user_interrupt
  - Note: Any event with a user_id_hash increments DAU for that day.

  Timestamp Note

  - DB uses TIMESTAMP (no tz). Send UTC like new Date().toISOString().slice(0,19) or an explicit YYYY-MM-DDTHH:mm:ss.

  Testing

  - From your landing page backend: POST to your Vercel function with event_type = "download".
  - From the app on first use: POST with event_type = "app_open".
  - Verify: query analytics_daily (today’s row), or v_daily_dashboard.

