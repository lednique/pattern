#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const site=path.join(__dirname,'..','vercel-site');
const index=fs.readFileSync(path.join(site,'index.html'),'utf8');
const success=fs.readFileSync(path.join(site,'success.html'),'utf8');
let passed=0;function test(value,name){assert(value,name);passed++;console.log('  ✓ '+name);}
test(index.includes('id="annualPrice">690<'),'annual price 690 ₽ is rendered without JavaScript');
test(index.includes('id="lifetimePrice">1 790<'),'lifetime price 1 790 ₽ is rendered without JavaScript');
test(index.includes('prices={annual:690,lifetime:1790}'),'client fallback prices match checkout');
test(index.includes("fetch('/api/prices')"),'checkout loads canonical API prices');
test(index.includes("plan:selectedPlan"),'selected plan is sent to payment API');
test(index.includes('двух фигур')&&index.includes('сдвиги')&&index.includes('элементы на пересечениях'),'landing page describes requested pattern modes');
test(index.includes('/terms.html')&&index.includes('/privacy.html'),'legal links are present');
test(index.includes('data:image/png;base64,')&&!index.includes('__LED_FOOTER_B64__'),'footer logo is embedded');
test(success.includes("fetch('/api/get-key?'+query)"),'success page retrieves paid license key');
['terms.html','privacy.html','manage.html','404.html'].forEach((name)=>test(fs.existsSync(path.join(site,name)),name+' exists'));
console.log('\nSite: '+passed+' checks passed.');
