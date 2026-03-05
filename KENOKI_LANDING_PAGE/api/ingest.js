const crypto = require('node:crypto');

const EVENT_TYPES = new Set([
  'download',
  'app_open',
  'view:hero',
  'view:how_it_works',
  'view:templates',
  'view:proof',
  'view:privacy',
  'view:faq',
  'user_interrupt',
  'project_start',
  'project_complete',
  'deploy'
]);

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function isoSeconds(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  } catch {
    return new Date().toISOString().slice(0, 19);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const sharedSecret = process.env.WEBHOOK_SHARED_SECRET || '';
  if (sharedSecret) {
    const got = req.headers['x-webhook-secret'] || req.headers['x-shared-secret'];
    if (!got || got !== sharedSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  let body = req.body;
  if (!body || typeof body !== 'object') {
    try { body = JSON.parse(req.body || '{}'); } catch {}
  }

  const { event_type, user_id_hash, user_id, metadata, timestamp } = body || {};

  if (!event_type || !EVENT_TYPES.has(event_type)) {
    res.status(400).json({ error: 'Invalid or missing event_type' });
    return;
  }

  if (!user_id_hash && !user_id) {
    res.status(400).json({ error: 'Provide user_id_hash or user_id' });
    return;
  }

  if (metadata && typeof metadata !== 'object') {
    res.status(400).json({ error: 'metadata must be an object' });
    return;
  }

  let uidHash = user_id_hash;
  if (!uidHash && user_id) {
    const pepper = process.env.USER_HASH_PEPPER;
    if (!pepper) {
      res.status(400).json({ error: 'USER_HASH_PEPPER required when sending user_id' });
      return;
    }
    uidHash = sha256(String(pepper) + String(user_id));
  }

  const ts = isoSeconds(timestamp);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    res.status(500).json({ error: 'Server not configured (SUPABASE_URL/SUPABASE_SERVICE_KEY)' });
    return;
  }

  // Call RPC ingest_event
  const url = `${SUPABASE_URL.replace(/\/?$/, '')}/rest/v1/rpc/ingest_event`;
  const payload = {
    p_event_type: event_type,
    p_user_id_hash: uidHash,
    p_timestamp: ts,
    p_metadata: metadata || {}
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    if (!r.ok) {
      res.status(502).json({ error: 'supabase_error', status: r.status, body: text });
      return;
    }
    res.status(200).json({ ok: true, ts, event_type });
  } catch (e) {
    res.status(502).json({ error: 'supabase_unreachable', detail: String(e && e.message || e) });
  }
};
