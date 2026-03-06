import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const WEBHOOK_SHARED_SECRET = process.env.WEBHOOK_SHARED_SECRET || '';
const USER_HASH_PEPPER = process.env.USER_HASH_PEPPER || '';

// Canonical event types for rollups. Extend as needed.
const ALLOWED_EVENTS = new Set([
  'download', 'artifact_download', 'artifact_export',
  'app_open', 'open',
  'view', 'page_view', 'artifact_view', 'project_view',
  'user_interrupt',
]);

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function toTimestampSeconds(v?: string): string | undefined {
  if (!v) return undefined;
  // Accept ISO and trim timezone/fraction if present
  // e.g., 2026-03-05T12:00:00Z -> 2026-03-05T12:00:00
  const iso = new Date(v);
  if (isNaN(iso.getTime())) return undefined;
  return new Date(iso.getTime() - iso.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Optional shared-secret check
    if (WEBHOOK_SHARED_SECRET) {
      const provided = req.headers['x-webhook-secret'];
      if (provided !== WEBHOOK_SHARED_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const {
      user_id_hash,
      user_id,
      event_type,
      timestamp,
      project_id,
      metadata,
    } = req.body || {};

    // Basic validation
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Server not configured for Supabase' });
    }
    if ((typeof user_id_hash !== 'string' || user_id_hash.length < 6) && (typeof user_id !== 'string' || user_id.length < 1)) {
      return res.status(400).json({ error: 'user_id_hash or user_id required' });
    }
    if (typeof event_type !== 'string' || event_type.length < 3) {
      return res.status(400).json({ error: 'event_type required' });
    }
    const normalizedType = String(event_type).toLowerCase();
    if (!ALLOWED_EVENTS.has(normalizedType)) {
      return res.status(400).json({ error: 'unsupported event_type' });
    }

    let projectId: string | null = null;
    if (project_id != null) {
      if (typeof project_id !== 'string' || !isUUID(project_id)) {
        return res.status(400).json({ error: 'project_id must be uuid' });
      }
      projectId = project_id;
    }

    let meta: Record<string, unknown> = {};
    if (metadata != null) {
      if (typeof metadata !== 'object') {
        return res.status(400).json({ error: 'metadata must be object' });
      }
      meta = metadata as Record<string, unknown>;
    }

    // Resolve user hash (prefer provided hash; otherwise hash server-side with pepper)
    let resolvedUserHash: string;
    if (typeof user_id_hash === 'string' && user_id_hash.length >= 6) {
      resolvedUserHash = user_id_hash;
    } else {
      if (!USER_HASH_PEPPER) {
        return res.status(500).json({ error: 'server_not_configured', detail: 'USER_HASH_PEPPER required when using user_id' });
      }
      resolvedUserHash = sha256Hex(`${USER_HASH_PEPPER}${String(user_id)}`);
    }

    const ts = toTimestampSeconds(timestamp);

    const rpcBody: Record<string, unknown> = {
      p_user_id_hash: resolvedUserHash,
      p_event_type: normalizedType,
      p_project_id: projectId,
      p_metadata: meta,
    };
    if (ts) rpcBody.p_timestamp = ts;

    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/ingest_event`;
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcBody),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: 'supabase_rpc_failed', detail: text });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'internal_error', detail: err?.message || 'unknown' });
  }
}
