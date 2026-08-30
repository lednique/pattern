'use strict';
const { cors, send, readJson, sbReq } = require('./_shared');
const ADMIN_PASS = process.env.ADMIN_PASS || '';
function authorized(req) { return ADMIN_PASS && req.headers && (req.headers['x-admin-pass'] || req.headers['X-Admin-Pass']) === ADMIN_PASS; }
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (!authorized(req)) return send(res, 401, { ok: false, error: 'unauthorized' });
  try {
    if (req.method === 'GET') return send(res, 200, { ok: true, coupons: await sbReq('/rest/v1/coupons?order=created_at.desc', 'GET') });
    const body = await readJson(req);
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return send(res, 400, { ok: false, error: 'bad-code' });
    if (req.method === 'DELETE') { await sbReq('/rest/v1/coupons?code=eq.' + encodeURIComponent(code), 'DELETE'); return send(res, 200, { ok: true }); }
    const percent = Math.max(1, Math.min(100, parseInt(body.percent, 10) || 0));
    if (req.method === 'POST') {
      const created = await sbReq('/rest/v1/coupons', 'POST', { code, percent }, 'return=representation');
      return send(res, 200, { ok: true, coupon: created[0] });
    }
    if (req.method === 'PATCH') {
      await sbReq('/rest/v1/coupons?code=eq.' + encodeURIComponent(code), 'PATCH', { percent });
      const rows = await sbReq('/rest/v1/coupons?code=eq.' + encodeURIComponent(code), 'GET');
      return send(res, 200, { ok: true, coupon: rows[0] });
    }
    return send(res, 405, { ok: false, error: 'method-not-allowed' });
  } catch (error) { return send(res, 500, { ok: false, error: 'server-error', detail: String(error.message || error) }); }
};
