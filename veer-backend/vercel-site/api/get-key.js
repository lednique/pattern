'use strict';
const { cors, send, sbReq } = require('./_shared');
module.exports = async (req, res) => {
  cors(res);
  try {
    const url = new URL(req.url, 'https://pattern.local');
    const invId = url.searchParams.get('inv_id');
    const paymentId = url.searchParams.get('payment');
    let payments = [];
    if (invId) payments = await sbReq('/rest/v1/payments?inv_id=eq.' + encodeURIComponent(invId), 'GET');
    else if (paymentId) payments = await sbReq('/rest/v1/payments?id=eq.' + encodeURIComponent(paymentId), 'GET');
    if (!payments || !payments.length || payments[0].status !== 'succeeded') return send(res, 404, { ok: false, error: 'not-paid' });
    const keys = await sbReq('/rest/v1/keys?id=eq.' + payments[0].key_id, 'GET');
    if (!keys || !keys.length) return send(res, 404, { ok: false, error: 'no-key' });
    return send(res, 200, { ok: true, key: keys[0].key, plan: keys[0].plan, expires_at: keys[0].expires_at });
  } catch (error) {
    return send(res, 500, { ok: false, error: 'server-error', detail: String(error.message || error) });
  }
};
