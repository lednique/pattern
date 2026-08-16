#!/usr/bin/env node
'use strict';
const assert=require('assert');const core=require('../src/pattern-core');let passed=0;
function test(name,fn){try{fn();passed++;console.log('  ✓ '+name);}catch(error){console.error('  ✗ '+name);throw error;}}
const base={mode:'grid',columns:4,rows:4,size1:100,size2:70,rotation1:0,rotation2:45,rotationStep:90,color1:'#DEDD74',color2:'#A9A84C',background:'#F8F8ED',shiftEnabled:false,shiftX:0,shiftY:0,halfGrid:false,halfHorizontal:true,halfVertical:true,decoration:'none',decorationColor:'#5E5D22',decorationSize:20};

test('tile size is fixed at 256 px',()=>{const s=core.normalizeSettings(base);assert.equal(s.tileSize,256);assert.equal(core.TILE_SIZE,256);});
test('cell dimensions are derived from columns and rows',()=>{const s=core.normalizeSettings({...base,columns:8,rows:2});assert.equal(s.cellWidth,32);assert.equal(s.cellHeight,128);});
test('row and column counts are never rounded to an even number',()=>{const s=core.normalizeSettings({...base,mode:'checker',columns:3,rows:5});assert.equal(s.columns,3);assert.equal(s.rows,5);});
test('one row and one column are supported',()=>{const s=core.normalizeSettings({...base,columns:1,rows:1});assert.equal(s.cellWidth,256);assert.equal(s.cellHeight,256);});
test('checker layout 1 leaves alternate cells empty',()=>{const s=core.normalizeSettings({...base,mode:'checker',checkerLayout:1});assert(core.variantAt(s,0,0,1).visible);assert(!core.variantAt(s,0,1,1).visible);});
test('checker layout 2 alternates two selected objects',()=>{const s=core.normalizeSettings({...base,mode:'checker',checkerLayout:2});assert.equal(core.variantAt(s,0,0,2).sourceIndex,0);assert.equal(core.variantAt(s,0,1,2).sourceIndex,1);});
test('checker layout 2 retains alternate style for one object',()=>{const s=core.normalizeSettings({...base,mode:'checker',checkerLayout:2});const v=core.variantAt(s,0,1,1);assert.equal(v.sourceIndex,0);assert.equal(v.color,'#A9A84C');assert.equal(v.size,70);});
test('rotation mode uses stepped angles',()=>{const s=core.normalizeSettings({...base,mode:'rotate',rotation1:15,rotationStep:45});assert.equal(core.variantAt(s,1,2,1).angle,150);});
test('intersection elements work in rotation mode',()=>{const s=core.normalizeSettings({...base,mode:'rotate',decoration:'star'});assert.equal(s.decoration,'star');});
test('intersection elements work in checker mode',()=>{const s=core.normalizeSettings({...base,mode:'checker',decoration:'circle'});assert.equal(s.decoration,'circle');});
test('checked zero offset keeps intersection elements',()=>{const s=core.normalizeSettings({...base,shiftEnabled:true,shiftX:0,shiftY:0,decoration:'cross'});assert.equal(s.decoration,'cross');});
test('non-zero alternate offset suppresses intersections',()=>{const s=core.normalizeSettings({...base,shiftEnabled:true,shiftX:50,decoration:'cross'});assert.equal(s.decoration,'none');});
test('both offset directions apply together',()=>{const s=core.normalizeSettings({...base,shiftEnabled:true,shiftX:50,shiftY:25});assert.equal(core.placementAt(s,1,1,1).x,128);assert.equal(core.placementAt(s,1,1,1).y,112);});
test('half-size grid activates with at least three grid elements',()=>{const s=core.normalizeSettings({...base,columns:3,rows:1,halfGrid:true});assert(s.halfEligible);assert(s.halfGrid);});
test('half-size grid is disabled below three elements',()=>{const s=core.normalizeSettings({...base,columns:2,rows:2,halfGrid:true});assert(!s.halfEligible);assert(!s.halfGrid);});
test('horizontal half grid inserts an element midway between cells',()=>{const b=core.buildPlacements({...base,columns:3,rows:1,halfGrid:true,halfHorizontal:true,halfVertical:false},1),s=b.settings,baseCell=b.placements.find(p=>p.row===0&&p.column===0&&p.phaseX===0),middle=b.placements.find(p=>p.row===0&&p.column===0&&p.phaseX===.5);assert(Math.abs(baseCell.x-s.cellWidth/2)<1e-9);assert(Math.abs(middle.x-s.cellWidth)<1e-9);assert(Math.abs(middle.x-baseCell.x-s.cellWidth/2)<1e-9);});
test('vertical half grid inserts an element midway between rows',()=>{const b=core.buildPlacements({...base,columns:1,rows:3,halfGrid:true,halfHorizontal:false,halfVertical:true},1),s=b.settings,baseCell=b.placements.find(p=>p.row===0&&p.column===0&&p.phaseY===0),middle=b.placements.find(p=>p.row===0&&p.column===0&&p.phaseY===.5);assert(Math.abs(middle.y-baseCell.y-s.cellHeight/2)<1e-9);});
test('both half-grid axes create all four base and midpoint combinations',()=>{const b=core.buildPlacements({...base,columns:3,rows:3,halfGrid:true,halfHorizontal:true,halfVertical:true},1);const cell=b.placements.filter(p=>p.row===0&&p.column===0);assert.equal(cell.length,4);assert.deepEqual(cell.map(p=>[p.phaseX,p.phaseY]),[[0,0],[.5,0],[0,.5],[.5,.5]]);});
test('half grid gives each inserted figure a half-size container',()=>{const normal=core.normalizeSettings({...base,columns:3,rows:3,halfGrid:false}),half=core.normalizeSettings({...base,columns:3,rows:3,halfGrid:true});const fullFit=core.fitDimensions(100,100,normal,100),halfFit=core.fitDimensions(100,100,half,100);assert(Math.abs(halfFit.width-fullFit.width*.5)<1e-9);assert(Math.abs(halfFit.height-fullFit.height*.5)<1e-9);});
test('rotation overscan wraps style to the opposite edge',()=>{const s=core.normalizeSettings({...base,mode:'rotate',columns:5,rows:3,rotationStep:45});assert.equal(core.placementAt(s,1,-1,1).angle,core.placementAt(s,1,4,1).angle);});
test('plain placement builder includes one-cell overscan',()=>{assert.equal(core.buildPlacements({...base,columns:2,rows:2},1).placements.length,16);});
test('object size is capped at 150%',()=>{const s=core.normalizeSettings({...base,size1:999,size2:175});assert.equal(s.size1,150);assert.equal(s.size2,150);});
test('theme colors convert to Figma RGB values',()=>{const c=core.hexToRgb('#DEDD74');assert(Math.abs(c.r-222/255)<1e-9);assert(Math.abs(c.g-221/255)<1e-9);assert(Math.abs(c.b-116/255)<1e-9);});
console.log('\nPatternCore: '+passed+' checks passed.');
