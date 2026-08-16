'use strict';
const { PRICES, cors, send } = require('./_shared');
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  return send(res, 200, { annual: PRICES.annual, lifetime: PRICES.lifetime, currency: 'RUB' });
};
