/* Binds a paid key to one Figma account. Annual term begins on first activation. */
'use strict';
const { cors, send, readJson, sbReq, isValidKey, annualExpiry } = require('./_shared');
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  try {
    const body = await readJson(req);
    const key = String(body.key || '').trim().toUpperCase();
    const userId = String(body.figma_user_id || '').trim();
    if (!isValidKey(key)) return send(res, 200, { ok: false, error: 'format' });
    if (!userId) return send(res, 200, { ok: false, error: 'no-user' });
    const rows = await sbReq('/rest/v1/keys?key=eq.' + encodeURIComponent(key), 'GET');
    if (!rows || !rows.length) return send(res, 200, { ok: false, error: 'not_found' });
    const record = rows[0];
    if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) return send(res, 200, { ok: false, error: 'expired' });
    if (record.status === 'activated') {
      if (record.figma_user_id !== userId) return send(res, 200, { ok: false, error: 'bound' });
      return send(res, 200, { ok: true, plan: record.plan, expires_at: record.expires_at });
    }
    const expiresAt = record.plan === 'annual' ? (record.expires_at || annualExpiry()) : null;
    // Include status=paid in the update filter. Two simultaneous first activations
    // cannot overwrite one another; only one request can win the transition.
    await sbReq('/rest/v1/keys?key=eq.' + encodeURIComponent(key) + '&status=eq.paid', 'PATCH', {
      status: 'activated', figma_user_id: userId, activated_at: new Date().toISOString(), expires_at: expiresAt
    });
    const after = await sbReq('/rest/v1/keys?key=eq.' + encodeURIComponent(key), 'GET');
    if (!after || !after.length || after[0].figma_user_id !== userId) {
      return send(res, 200, { ok: false, error: 'bound' });
    }
    return send(res, 200, { ok: true, plan: after[0].plan, expires_at: after[0].expires_at });
  } catch (error) {
    console.error('[activate-key]', error);
    return send(res, 500, { ok: false, error: 'server-error', detail: String(error.message || error) });
  }
};
