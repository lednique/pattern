/* Creates a fixed-RUB Robokassa payment or immediately issues a 100%-coupon key. */
'use strict';
const crypto = require('crypto');
const { PRICES, cors, send, readJson, sbReq, genKey, isPlan } = require('./_shared');

const MERCHANT_LOGIN = process.env.ROBO_MERCHANT_LOGIN || '';
const PASS1 = process.env.ROBO_PASS1 || '';
const IS_TEST = process.env.ROBO_ISTEST === '1';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method-not-allowed' });
  try {
    const body = await readJson(req);
    const plan = String(body.plan || '');
    const email = String(body.email || '').trim().toLowerCase();
    if (!isPlan(plan)) return send(res, 400, { ok: false, error: 'bad-plan' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { ok: false, error: 'bad-email' });
    if (!MERCHANT_LOGIN || !PASS1) return send(res, 500, { ok: false, error: 'robokassa-not-configured' });

    const base = PRICES[plan];
    let amount = base;
    let discount = 0;
    let couponCode = null;
    if (body.coupon) {
      couponCode = String(body.coupon).trim().toUpperCase();
      const rows = await sbReq('/rest/v1/coupons?code=eq.' + encodeURIComponent(couponCode), 'GET');
      if (!rows || !rows.length) return send(res, 200, { ok: false, error: 'bad-coupon' });
      discount = Math.round(base * Number(rows[0].percent) / 100);
      amount = Math.max(0, base - discount);
    }

    const paymentId = crypto.randomUUID();
    const invId = Number(String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 10)));
    if (amount === 0) {
      const created = await sbReq('/rest/v1/keys', 'POST', {
        key: genKey(), plan, email, status: 'paid', expires_at: null
      }, 'return=representation');
      await sbReq('/rest/v1/payments', 'POST', {
        id: paymentId, inv_id: invId, plan, email, amount: '0.00', currency: 'RUB', status: 'succeeded',
        coupon: couponCode, key_id: created[0].id, paid_at: new Date().toISOString()
      });
      return send(res, 200, { ok: true, coupon_100: true, key: created[0].key, plan, payment_id: paymentId, inv_id: invId });
    }

    const outSum = amount.toFixed(2);
    const signature = crypto.createHash('md5').update(MERCHANT_LOGIN + ':' + outSum + ':' + invId + ':' + PASS1).digest('hex');
    await sbReq('/rest/v1/payments', 'POST', {
      id: paymentId, inv_id: invId, plan, email, amount: outSum, currency: 'RUB', status: 'pending', coupon: couponCode
    });
    const form = {
      MerchantLogin: MERCHANT_LOGIN,
      OutSum: outSum,
      InvId: String(invId),
      SignatureValue: signature,
      Description: 'Patternique — ' + (plan === 'annual' ? 'лицензия на 1 год' : 'бессрочная лицензия'),
      Email: email,
      Culture: 'ru'
    };
    if (IS_TEST) form.IsTest = '1';
    return send(res, 200, {
      ok: true, action: 'https://auth.robokassa.ru/Merchant/Index.aspx', form,
      payment_id: paymentId, inv_id: invId, amount, currency: 'RUB', discount
    });
  } catch (error) {
    console.error('[create-payment]', error);
    return send(res, 500, { ok: false, error: 'server-error', detail: String(error.message || error) });
  }
};
