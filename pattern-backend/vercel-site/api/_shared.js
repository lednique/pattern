/* Shared helpers for Patternique's dependency-free Vercel API. */
'use strict';
const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const PRICES = Object.freeze({
  annual: Number(process.env.PRICE_ANNUAL || 690),
  lifetime: Number(process.env.PRICE_LIFETIME || 1790)
});
const PLANS = ['annual', 'lifetime'];
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genKey() {
  function segment() {
    let value = '';
    for (let index = 0; index < 4; index++) value += CHARSET[crypto.randomInt(CHARSET.length)];
    return value;
  }
  return [segment(), segment(), segment(), segment()].join('-');
}
function isValidKey(key) { return /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/.test(String(key || '')); }
function isPlan(plan) { return PLANS.includes(plan); }
function annualExpiry(from) {
  const date = from ? new Date(from) : new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString();
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Pass');
}
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) reject(new Error('body-too-large')); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
async function readJson(req) {
  try { return JSON.parse(await readBody(req)); } catch (error) { throw new Error('bad-json'); }
}
async function sbReq(path, method, body, prefer) {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not configured');
  if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY is not configured');
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json'
  };
  if (prefer) headers.Prefer = prefer;
  const options = { method: method || 'GET', headers };
  if (body !== undefined) options.body = JSON.stringify(body);
  const response = await fetch(SUPABASE_URL + path, options);
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (error) { data = raw; }
  if (!response.ok) throw new Error('supabase-' + response.status + ': ' + String(raw).slice(0, 300));
  return data;
}

module.exports = { PRICES, PLANS, genKey, isValidKey, isPlan, annualExpiry, cors, send, readBody, readJson, sbReq };
