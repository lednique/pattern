#!/usr/bin/env node
'use strict';
process.env.ROBO_MERCHANT_LOGIN='test-shop';
process.env.ROBO_PASS1='pass1';
process.env.ROBO_PASS2='pass2';
process.env.ROBO_ISTEST='1';
process.env.ADMIN_PASS='admin-secret';
process.env.SUPABASE_URL='https://mock.supabase.co';
process.env.SUPABASE_SERVICE_KEY='service-key';
process.env.PRICE_ANNUAL='290';
process.env.PRICE_LIFETIME='790';

const assert=require('assert');
const crypto=require('crypto');
const path=require('path');
const api=path.join(__dirname,'..','vercel-site','api');
const db={payments:[],keys:[],coupons:[]};
let sequence=0;
function query(url){const u=new URL(url);const table=u.pathname.replace('/rest/v1/','');const filters={};u.searchParams.forEach((value,key)=>{if(key!=='order')filters[key]=value.startsWith('eq.')?value.slice(3):value;});return{table,filters};}
function matches(row,filters){return Object.keys(filters).every((key)=>String(row[key])===String(filters[key]));}
global.fetch=async function(url,options={}){
  const {table,filters}=query(String(url));const method=options.method||'GET';
  if(!db[table])return{ok:false,status:404,text:async()=>''};
  if(method==='GET'){const rows=db[table].filter((row)=>matches(row,filters));return{ok:true,status:200,text:async()=>JSON.stringify(rows)};}
  if(method==='POST'){const row=JSON.parse(options.body||'{}');if(!row.id)row.id='id-'+(++sequence);if(!row.created_at)row.created_at=new Date().toISOString();db[table].push(row);const data=(options.headers.Prefer||'').includes('return=representation')?[row]:null;return{ok:true,status:201,text:async()=>JSON.stringify(data)};}
  if(method==='PATCH'){const patch=JSON.parse(options.body||'{}');db[table].filter((row)=>matches(row,filters)).forEach((row)=>Object.assign(row,patch));return{ok:true,status:200,text:async()=>'[]'};}
  if(method==='DELETE'){db[table]=db[table].filter((row)=>!matches(row,filters));return{ok:true,status:200,text:async()=>'[]'};}
  return{ok:false,status:405,text:async()=>''};
};
function request(body,headers,method,url){const req={method:method||'POST',headers:headers||{},url:url||'/'};req.on=(event,callback)=>{if(event==='data'&&body!==undefined&&body!==null)callback(Buffer.from(body));if(event==='end')callback();};return req;}
function response(){return{code:200,body:'',headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(c,h){this.code=c;Object.assign(this.headers,h||{});},end(value){this.body=value||'';}};}
async function call(handler,body,headers,method,url){const res=response();await handler(request(body,headers,method,url),res);let data=res.body;try{data=JSON.parse(data);}catch(error){}return{code:res.code,data,headers:res.headers};}
let passed=0;function test(condition,name){if(!condition)throw new Error(name);passed++;console.log('  ✓ '+name);}

(async function(){
  const prices=await call(require(path.join(api,'prices.js')),null,{},'GET');
  test(prices.data.annual===290&&prices.data.lifetime===790&&prices.data.currency==='RUB','prices are exactly 290 ₽ and 790 ₽');

  const create=require(path.join(api,'create-payment.js'));
  const annual=await call(create,JSON.stringify({plan:'annual',email:'one@example.com'}));
  test(annual.data.ok&&annual.data.form.OutSum==='290.00','annual Robokassa payment is 290.00 RUB');
  const lifetime=await call(create,JSON.stringify({plan:'lifetime',email:'life@example.com'}));
  test(lifetime.data.ok&&lifetime.data.form.OutSum==='790.00','lifetime Robokassa payment is 790.00 RUB');
  test(lifetime.data.form.Description.startsWith('Veer — ')&&lifetime.data.form.Description.includes('бессрочная'),'payment description identifies Veer lifetime plan');
  const signature=crypto.createHash('md5').update('test-shop:290.00:'+annual.data.form.InvId+':pass1').digest('hex');
  test(annual.data.form.SignatureValue===signature,'Robokassa init signature is valid');
  test(db.payments.length===2&&db.payments[0].plan==='annual','pending payments retain selected plan');
  const badPlan=await call(create,JSON.stringify({plan:'monthly',email:'one@example.com'}));
  test(badPlan.code===400&&badPlan.data.error==='bad-plan','unsupported plan is rejected');

  const result=require(path.join(api,'robokassa-result.js'));
  const inv=annual.data.form.InvId,out='290.00';
  const resultSignature=crypto.createHash('md5').update(out+':'+inv+':pass2').digest('hex');
  const paid=await call(result,'OutSum='+out+'&InvId='+inv+'&SignatureValue='+resultSignature,{},'POST');
  test(paid.data==='OK'+inv,'Robokassa ResultURL returns OK<InvId>');
  test(db.keys.length===1&&db.keys[0].plan==='annual','successful annual payment issues annual key');
  await call(result,'OutSum='+out+'&InvId='+inv+'&SignatureValue='+resultSignature,{},'POST');
  test(db.keys.length===1,'duplicate payment callback does not issue another key');

  const activate=require(path.join(api,'activate-key.js'));
  const key=db.keys[0].key;
  const activation=await call(activate,JSON.stringify({key,figma_user_id:'figma-user-1'}));
  test(activation.data.ok&&activation.data.plan==='annual','annual key activates');
  const expiry=new Date(activation.data.expires_at).getTime()-Date.now();
  test(expiry>364*864e5&&expiry<367*864e5,'annual term begins on first activation');
  const rebound=await call(activate,JSON.stringify({key,figma_user_id:'figma-user-2'}));
  test(!rebound.data.ok&&rebound.data.error==='bound','key is bound to one Figma account');

  db.coupons.push({id:'coupon-1',code:'FREE100',percent:100});
  const free=await call(create,JSON.stringify({plan:'lifetime',email:'free@example.com',coupon:'FREE100'}));
  test(free.data.ok&&free.data.coupon_100&&free.data.plan==='lifetime','100% coupon immediately issues lifetime key');
  const freeActivation=await call(activate,JSON.stringify({key:free.data.key,figma_user_id:'figma-free'}));
  test(freeActivation.data.ok&&freeActivation.data.expires_at===null,'lifetime activation never expires');

  const getKey=require(path.join(api,'get-key.js'));
  const fetched=await call(getKey,null,{},'GET','/api/get-key?inv_id='+inv);
  test(fetched.data.ok&&fetched.data.key===key&&fetched.data.plan==='annual','paid key can be retrieved by invoice id');

  const admin=require(path.join(api,'admin-keys.js'));
  const denied=await call(admin,null,{},'GET');test(denied.code===401,'admin API requires a password');
  const added=await call(admin,JSON.stringify({plan:'lifetime',email:'manual@example.com'}),{'x-admin-pass':'admin-secret'},'POST');
  test(added.data.ok&&added.data.key.plan==='lifetime','admin can create lifetime key');
  test(prices.headers['Access-Control-Allow-Origin']==='*','API sends Figma-compatible CORS');

  const health=await call(require(path.join(api,'health.js')),null,{},'GET');
  test(health.data.ok&&health.data.product==='Veer'&&health.data.prices.annual===290,'health endpoint reports the Veer product and prices');

  console.log('\nBackend: '+passed+' checks passed.');
})().catch((error)=>{console.error('\nFAIL:',error.stack||error);process.exit(1);});
