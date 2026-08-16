#!/usr/bin/env node
'use strict';
const assert = require('assert');
const core = require('../src/pattern-core');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (error) { console.error('  ✗ ' + name); throw error; } }

const base = { mode:'grid', columns:5, rows:3, cellWidth:100, cellHeight:80, size1:60, size2:40, rotation1:0, rotation2:45, rotationStep:90, color1:'#112233', color2:'#AABBCC', background:'#FFFFFF', shiftMode:'none', shiftX:50, shiftY:25, decoration:'none', decorationColor:'#000000', decorationSize:20 };

test('grid preserves ordinary row and column counts', () => { const s=core.normalizeSettings(base); assert.equal(s.columns,5); assert.equal(s.rows,3); });
test('checkerboard rounds both dimensions to an even period', () => { const s=core.normalizeSettings({...base,mode:'checker'}); assert.equal(s.columns,6); assert.equal(s.rows,4); });
test('alternating row shift only requires even rows', () => { const s=core.normalizeSettings({...base,shiftMode:'rows'}); assert.equal(s.columns,5); assert.equal(s.rows,4); });
test('alternating column shift only requires even columns', () => { const s=core.normalizeSettings({...base,shiftMode:'columns'}); assert.equal(s.columns,6); assert.equal(s.rows,3); });
test('intersection decoration is available for plain grid', () => { const s=core.normalizeSettings({...base,decoration:'star'}); assert.equal(s.decoration,'star'); });
test('intersection decoration is disabled with offset', () => { const s=core.normalizeSettings({...base,decoration:'star',shiftMode:'rows'}); assert.equal(s.decoration,'none'); });
test('intersection decoration is disabled outside grid mode', () => { const s=core.normalizeSettings({...base,decoration:'circle',mode:'rotate'}); assert.equal(s.decoration,'none'); });
test('invalid colors use safe fallback', () => { const s=core.normalizeSettings({...base,color1:'red'}); assert.equal(s.color1,'#11A5CA'); });
test('one-object checker skip hides odd cells', () => { const s=core.normalizeSettings({...base,mode:'checker',checkerBehavior:'skip'}); assert.equal(core.variantAt(s,0,0,1).visible,true); assert.equal(core.variantAt(s,0,1,1).visible,false); });
test('one-object checker variant alternates style', () => { const s=core.normalizeSettings({...base,mode:'checker',checkerBehavior:'variant'}); const v=core.variantAt(s,0,1,1); assert.equal(v.visible,true); assert.equal(v.second,true); assert.equal(v.size,40); assert.equal(v.color,'#AABBCC'); assert.equal(v.angle,45); });
test('two-object checker alternates source nodes', () => { const s=core.normalizeSettings({...base,mode:'checker'}); assert.equal(core.variantAt(s,0,0,2).sourceIndex,0); assert.equal(core.variantAt(s,0,1,2).sourceIndex,1); assert.equal(core.variantAt(s,1,0,2).sourceIndex,1); });
test('rotation mode adds the configured step', () => { const s=core.normalizeSettings({...base,mode:'rotate',rotation1:15,rotationStep:90}); assert.equal(core.variantAt(s,1,2,1).angle,285); });
test('odd rows shift horizontally by a cell percentage', () => { const s=core.normalizeSettings({...base,shiftMode:'rows',shiftX:50}); assert.equal(core.placementAt(s,0,0,1).x,50); assert.equal(core.placementAt(s,1,0,1).x,100); });
test('odd columns shift vertically by a cell percentage', () => { const s=core.normalizeSettings({...base,shiftMode:'columns',shiftY:25}); assert.equal(core.placementAt(s,0,0,1).y,40); assert.equal(core.placementAt(s,0,1,1).y,60); });
test('negative checker indices retain stable parity', () => { const s=core.normalizeSettings({...base,mode:'checker',checkerBehavior:'variant'}); assert.equal(core.variantAt(s,-1,0,1).second,true); assert.equal(core.variantAt(s,-1,-1,1).second,false); });
test('rotation overscan wraps style to the opposite tile edge', () => { const s=core.normalizeSettings({...base,mode:'rotate',columns:5,rows:3,rotationStep:45}); const left=core.placementAt(s,1,-1,1); const right=core.placementAt(s,1,4,1); assert.equal(left.angle,right.angle); assert.equal(left.styleColumn,4); });
test('placement builder includes overscan for edge wrapping', () => { const b=core.buildPlacements({...base,columns:2,rows:2},1); assert.equal(b.placements.length,16); });
test('percentage and dimensions are clamped', () => { const s=core.normalizeSettings({...base,cellWidth:2,cellHeight:900,size1:999}); assert.equal(s.cellWidth,32); assert.equal(s.cellHeight,400); assert.equal(s.size1,180); });
test('hex colors convert to Figma RGB values', () => { const c=core.hexToRgb('#FF8000'); assert.equal(c.r,1); assert(Math.abs(c.g-128/255)<1e-9); assert.equal(c.b,0); });

console.log('\nPatternCore: ' + passed + ' checks passed.');
