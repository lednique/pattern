'use strict';
const crypto = require('crypto');
const { cors, readBody, sbReq, genKey } = require('./_shared');
const PASS2 = process.env.ROBO_PASS2 || '';

function parse(raw) {
  const values = {};
  String(raw || '').split('&').forEach((part) => {
    const index = part.indexOf('=');
    if (index > 0) values[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1).replace(/\+/g, ' '));
  });
  return values;
}
module.exports = async (req, res) => {
  cors(res);
  try {
    const values = parse(req.method === 'POST' ? await readBody(req) : (req.url.split('?')[1] || ''));
    const outSum = String(values.OutSum || ''), invId = String(values.InvId || ''), signature = String(values.SignatureValue || '');
    if (!PASS2) { res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('ROBO_PASS2 not configured'); }
    const expected = crypto.createHash('md5').update(outSum + ':' + invId + ':' + PASS2).digest('hex');
    if (signature.toLowerCase() !== expected.toLowerCase()) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('bad signature'); }
    const payments = await sbReq('/rest/v1/payments?inv_id=eq.' + encodeURIComponent(invId), 'GET');
    if (payments && payments.length && payments[0].status === 'pending') {
      const payment = payments[0];
      const created = await sbReq('/rest/v1/keys', 'POST', {
        key: genKey(), plan: payment.plan, email: payment.email || null, status: 'paid', expires_at: null
      }, 'return=representation');
      await sbReq('/rest/v1/payments?id=eq.' + payment.id, 'PATCH', {
        status: 'succeeded', key_id: created[0].id, paid_at: new Date().toISOString()
      });
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('OK' + invId);
  } catch (error) {
    console.error('[robokassa-result]', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('ERR');
  }
};
