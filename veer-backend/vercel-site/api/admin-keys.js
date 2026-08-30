'use strict';
const { cors, send, readJson, sbReq, genKey, isPlan, annualExpiry } = require('./_shared');
const ADMIN_PASS = process.env.ADMIN_PASS || '';
function authorized(req) { return ADMIN_PASS && req.headers && (req.headers['x-admin-pass'] || req.headers['X-Admin-Pass']) === ADMIN_PASS; }
function daysExpiry(days) { return days ? new Date(Date.now() + days * 864e5).toISOString() : null; }
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (!authorized(req)) return send(res, 401, { ok: false, error: 'unauthorized' });
  try {
    if (req.method === 'GET') return send(res, 200, { ok: true, keys: await sbReq('/rest/v1/keys?order=created_at.desc', 'GET') });
    const body = await readJson(req);
    if (req.method === 'POST') {
      const plan = isPlan(body.plan) ? body.plan : 'lifetime';
      const days = body.days ? Math.max(1, Math.min(3650, parseInt(body.days, 10))) : 0;
      const created = await sbReq('/rest/v1/keys', 'POST', {
        key: genKey(), plan, email: body.email || null, status: 'paid',
        expires_at: days ? daysExpiry(days) : null
      }, 'return=representation');
      return send(res, 200, { ok: true, key: created[0] });
    }
    const key = String(body.key || '').trim().toUpperCase();
    if (!key) return send(res, 400, { ok: false, error: 'no-key' });
    if (req.method === 'DELETE') { await sbReq('/rest/v1/keys?key=eq.' + encodeURIComponent(key), 'DELETE'); return send(res, 200, { ok: true }); }
    if (req.method === 'PATCH') {
      const patch = {};
      if (isPlan(body.plan)) patch.plan = body.plan;
      if (body.email !== undefined) patch.email = body.email || null;
      if (body.days !== undefined && body.days !== '') patch.expires_at = daysExpiry(Math.max(1, Math.min(3650, parseInt(body.days, 10))));
      if (body.reset_activation) Object.assign(patch, { status: 'paid', figma_user_id: null, activated_at: null, expires_at: null });
      await sbReq('/rest/v1/keys?key=eq.' + encodeURIComponent(key), 'PATCH', patch);
      const rows = await sbReq('/rest/v1/keys?key=eq.' + encodeURIComponent(key), 'GET');
      return send(res, 200, { ok: true, key: rows[0] });
    }
    return send(res, 405, { ok: false, error: 'method-not-allowed' });
  } catch (error) { return send(res, 500, { ok: false, error: 'server-error', detail: String(error.message || error) }); }
};
