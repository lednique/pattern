#!/usr/bin/env node
'use strict';
const fs=require('fs');const vm=require('vm');const assert=require('assert');
let nextId=0;const messages=[];const pageChildren=[];
function node(type,name,width,height){return{id:'n'+(++nextId),type,name:name||type,width:width||10,height:height||10,x:0,y:0,fills:[{type:'SOLID',color:{r:0,g:0,b:0}}],strokes:[],children:type==='FRAME'?[]:undefined,absoluteTransform:[[1,0,0],[0,1,0]],clone(){return node(this.type,this.name,this.width,this.height);},resize(w,h){this.width=w;this.height=h;},resizeWithoutConstraints(w,h){this.resize(w,h);},exportAsync:async()=>new Uint8Array([1,2,3]),setPluginData(k,v){this.pluginData=this.pluginData||{};this.pluginData[k]=v;},remove(){this.removed=true;},appendChild(child){this.children=this.children||[];this.children.push(child);child.parent=this;}};}
const source=node('VECTOR','Leaf',40,20);source.absoluteTransform=[[1,0,100],[0,1,200]];
const page={selection:[source],children:pageChildren,loadAsync:async()=>{},appendChild(child){pageChildren.push(child);}};
const handlers={};
const figma={
  mixed:Symbol('mixed'),currentPage:page,currentUser:{id:'figma-test'},showUI(){},on(type,cb){handlers[type]=cb;},
  ui:{postMessage(msg){messages.push(msg);},onmessage:null},clientStorage:{async getAsync(){return null;},async setAsync(){}},
  createFrame(){const n=node('FRAME','Frame',100,100);n.layoutMode='NONE';n.clipsContent=false;pageChildren.push(n);return n;},
  createRectangle(){return node('RECTANGLE','Rectangle',100,100);},createEllipse(){return node('ELLIPSE','Ellipse',100,100);},createStar(){const n=node('STAR','Star',100,100);n.pointCount=5;n.innerRadius=.4;return n;},
  createText(){const n=node('TEXT','Text',1,1);n.characters='';n.textAutoResize='WIDTH_AND_HEIGHT';return n;},loadFontAsync:async()=>{},listAvailableFontsAsync:async()=>[{fontName:{family:'Inter',style:'Regular'}}],
  viewport:{scrollAndZoomIntoView(){}},notify(){}
};
const sandbox={figma,__html__:'',console,Uint8Array,Math,Number,String,Array,JSON,Date,Promise,Symbol,setTimeout,clearTimeout,module:undefined,self:{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','code.js'),'utf8'),sandbox);
(async function(){
  await new Promise(r=>setTimeout(r,10));
  assert(messages.some(m=>m.type==='selection'&&m.valid));
  await figma.ui.onmessage({type:'create-pattern',settings:{mode:'grid',columns:2,rows:2,cellWidth:80,cellHeight:60,size1:50,color1:'#11A5CA',background:'#FFFFFF',shiftMode:'none',decoration:'none'}});
  const done=messages.find(m=>m.type==='pattern-created');assert(done,'pattern-created message');
  assert.equal(done.result.width,160);assert.equal(done.result.height,120);
  const frame=page.selection[0];assert.equal(frame.type,'FRAME');assert.equal(frame.clipsContent,true);assert.equal(frame.children.length,16);assert(frame.pluginData.patterniqueSettings);
  console.log('  ✓ selection metadata is sent');
  console.log('  ✓ editable frame 160×120 is created');
  console.log('  ✓ overscan repeat clones are appended and clipped');
  console.log('  ✓ settings are stored in plugin data');
  console.log('\nSandbox: 4 checks passed.');
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
