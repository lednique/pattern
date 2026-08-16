#!/usr/bin/env node
'use strict';
const fs=require('fs');const vm=require('vm');const assert=require('assert');
let nextId=0;const messages=[];const pageChildren=[];
function node(type,name,width,height){return{id:'n'+(++nextId),type,name:name||type,width:width||10,height:height||10,x:0,y:0,fills:[{type:'SOLID',color:{r:0,g:0,b:0}}],strokes:[],children:type==='FRAME'?[]:undefined,absoluteTransform:[[1,0,0],[0,1,0]],effects:[],clone(){const cloned=node(this.type,this.name,this.width,this.height);cloned.fills=JSON.parse(JSON.stringify(this.fills));cloned.strokes=JSON.parse(JSON.stringify(this.strokes));cloned.effects=JSON.parse(JSON.stringify(this.effects||[]));return cloned;},resize(w,h){this.width=w;this.height=h;},resizeWithoutConstraints(w,h){this.resize(w,h);},rescale(factor){this.width*=factor;this.height*=factor;(this.effects||[]).forEach(e=>{if(typeof e.radius==='number')e.radius*=factor;if(e.offset){e.offset.x*=factor;e.offset.y*=factor;}});},exportAsync:async()=>new Uint8Array([1,2,3]),setPluginData(k,v){this.pluginData=this.pluginData||{};this.pluginData[k]=v;},remove(){this.removed=true;},appendChild(child){this.children=this.children||[];this.children.push(child);child.parent=this;}};}
const source=node('VECTOR','Leaf',40,20);source.absoluteTransform=[[1,0,100],[0,1,200]];source.absoluteBoundingBox={x:100,y:200,width:40,height:20};source.absoluteRenderBounds={x:95,y:192,width:50,height:34};source.fills=[{type:'SOLID',color:{r:.2,g:.4,b:.6},opacity:.8},{type:'GRADIENT_LINEAR',gradientStops:[]}];source.strokes=[{type:'SOLID',color:{r:.1,g:.1,b:.1}}];source.effects=[{type:'DROP_SHADOW',radius:8,visible:true,blendMode:'NORMAL',color:{r:0,g:0,b:0,a:.3},offset:{x:0,y:3}}];
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
  const selectionMessage=messages.find(m=>m.type==='selection'&&m.valid);assert(selectionMessage);assert.equal(selectionMessage.items[0].renderWidth,50);assert.equal(selectionMessage.items[0].renderHeight,34);assert.equal(selectionMessage.items[0].renderOffsetX,0);assert.equal(selectionMessage.items[0].renderOffsetY,-1);
  await figma.ui.onmessage({type:'create-pattern',settings:{mode:'grid',columns:2,rows:2,size1:50,color1:'#336699',background:'#FFFFFF',shiftEnabled:false,decoration:'none'}});
  const done=messages.find(m=>m.type==='pattern-created');assert(done,'pattern-created message');
  assert.equal(done.result.width,256);assert.equal(done.result.height,256);
  const frame=page.selection[0];assert.equal(frame.type,'FRAME');assert.equal(frame.clipsContent,true);assert.equal(frame.children.length,16);assert(frame.pluginData.patterniqueSettings);
  assert.equal(frame.children[0].effects[0].type,'DROP_SHADOW');assert(Math.abs(frame.children[0].effects[0].radius-12.8)<1e-9);assert.equal(frame.children[0].fills[1].type,'GRADIENT_LINEAR');assert.equal(frame.children[0].fills[0].opacity,.8);assert.equal(frame.children[0].fills[0].color.r,.2);assert.equal(frame.children[0].strokes[0].color.r,.1);
  await figma.ui.onmessage({type:'create-pattern',settings:{mode:'grid',columns:3,rows:1,size1:100,color1:'#336699',background:'#FFFFFF',halfGrid:true,halfHorizontal:true,halfVertical:false,shiftEnabled:false,decoration:'none'}});
  const halfFrame=page.selection[0];assert(Math.abs(halfFrame.children[0].width-(256/3))<1e-6);assert.equal(halfFrame.children.length,9);
  const dragSettings={mode:'grid',columns:2,rows:2,size1:50,color1:'#DEDD74',background:'#FFFFFF',shiftEnabled:false,decoration:'none'};
  const handled=handlers.drop({absoluteX:500,absoluteY:400,items:[{type:'application/json',data:JSON.stringify({source:'patternique',settings:dragSettings})}]});
  assert.equal(handled,false);await new Promise(r=>setTimeout(r,10));assert.equal(page.selection[0].x,372);assert.equal(page.selection[0].y,272);
  console.log('  ✓ selection metadata is sent');
  console.log('  ✓ editable fixed 256×256 frame is created');
  console.log('  ✓ overscan repeat clones are appended and clipped');
  console.log('  ✓ settings are stored in plugin data');
  console.log('  ✓ fills, strokes, opacity, and effects are preserved');
  console.log('  ✓ half-grid recomposes the same number of full-size repeats');
  console.log('  ✓ drag and drop places the pattern at scene coordinates');
  console.log('\nSandbox: 7 checks passed.');
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
