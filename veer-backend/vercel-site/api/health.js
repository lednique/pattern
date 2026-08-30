'use strict';
const { PRICES, cors, send } = require('./_shared');
module.exports = async (req, res) => {
  cors(res);
  return send(res, 200, {
    ok: true, product: 'Veer', prices: PRICES,
    configured: { supabase: !!process.env.SUPABASE_URL, robokassa: !!process.env.ROBO_MERCHANT_LOGIN }
  });
};
