#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const site=path.join(__dirname,'..','vercel-site');
const index=fs.readFileSync(path.join(site,'index.html'),'utf8');
const success=fs.readFileSync(path.join(site,'success.html'),'utf8');
let passed=0;function test(value,name){assert(value,name);passed++;console.log('  ✓ '+name);}
test(index.includes('id="annualPrice">290<'),'annual price 290 ₽ is rendered without JavaScript');
test(index.includes('id="lifetimePrice">790<'),'lifetime price 790 ₽ is rendered without JavaScript');
test(index.includes('prices={annual:290,lifetime:790}'),'client fallback prices match checkout');
test(index.includes("fetch('/api/prices')"),'checkout loads canonical API prices');
test(index.includes("plan:selectedPlan"),'selected plan is sent to payment API');
test(index.includes('до 12 изображений')&&index.includes('полного круга')&&index.includes('хаос'),'landing page describes the Veer fan features');
test(index.includes('/terms.html')&&index.includes('/privacy.html'),'legal links are present');
test(index.includes('data:image/png;base64,')&&!index.includes('__LED_FOOTER_B64__'),'footer logo is embedded');
test(success.includes("fetch('/api/get-key?'+query)"),'success page retrieves paid license key');
test(index.includes('--accent:#F2A24C')&&index.includes('rgba(242,162,76'),'purchase site uses the orange #F2A24C theme');
test(index.includes('linear-gradient(180deg,#F2A24C 0%,#E08A33 10%,#B36420 30%,#7C3F11 50%,#401F08 70%,#170C04 86%,#050708 100%)'),'background stretches from orange at the top to black at the bottom');
['success.html','404.html','error.html','privacy.html','terms.html','manage.html'].forEach((name)=>{const page=fs.readFileSync(path.join(site,name),'utf8');test(page.includes('linear-gradient(180deg,#F2A24C'),name+' carries the same orange→black gradient');});
test(!index.includes('Patternique')&&!success.includes('Patternique'),'no Patternique branding remains on the Veer site');
['en','ru','it','pt','fr','zh','ja'].forEach((code)=>test(index.includes('"'+code+'":{'),code+' purchase-site localization exists'));
test(index.includes('id="langMenu"')&&index.includes('buildLangMenu'),'seven-language dropdown is rendered');
['terms.html','privacy.html','manage.html','404.html'].forEach((name)=>test(fs.existsSync(path.join(site,name)),name+' exists'));
console.log('\nSite: '+passed+' checks passed.');
