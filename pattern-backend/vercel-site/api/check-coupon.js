'use strict';
const { cors, send, readJson, sbReq } = require('./_shared');
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  try {
    const body = await readJson(req);
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) return send(res, 200, { ok: false });
    const rows = await sbReq('/rest/v1/coupons?code=eq.' + encodeURIComponent(code), 'GET');
    return rows && rows.length ? send(res, 200, { ok: true, percent: rows[0].percent }) : send(res, 200, { ok: false });
  } catch (error) {
    return send(res, 500, { ok: false, error: 'server-error' });
  }
};
