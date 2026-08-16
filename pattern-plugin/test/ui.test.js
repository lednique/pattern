#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','src','ui-template.html'),'utf8');const built=fs.readFileSync(path.join(__dirname,'..','ui.html'),'utf8');let passed=0;
function test(value,name){assert(value,name);passed++;console.log('  ✓ '+name);}
test(source.includes('.previewDock{position:sticky;top:5px'),'preview is sticky with a 5 px top offset');
test(source.includes('.previewDock.compact')&&source.includes('width:172px;height:172px'),'scrolling collapses preview to its centered square');
test(source.includes('var display=Math.min(156,w-200,h-200)')&&source.includes("makeTile(settings,'#DEDD74',true)"),'expanded preview renders a framed tile with fading pattern continuation');
test(source.includes("var TILE_SIZE = 256")===false&&built.includes('var TILE_SIZE = 256'),'shared core is injected into the built UI');
test(!source.includes('id="cellWidth"')&&!source.includes('id="cellHeight"'),'cell width and height inputs are removed');
test(source.includes('id="halfGrid"')&&source.includes('id="halfHorizontal"')&&source.includes('id="halfVertical"'),'half-size grid has horizontal and vertical checkboxes');
test(source.includes('id="shiftEnabled"')&&!source.includes('id="shiftMode"'),'alternate offset is a single both-directions checkbox');
test(source.includes('checkerInline')&&source.includes('data-checker="1"')&&source.includes('data-checker="2"'),'checker layouts 1 and 2 are embedded in the mode button');
test(source.includes("$('checkerSlot').appendChild($('decorationPanel'))"),'intersection controls move into checker mode settings');
test(source.includes('class="objectGrid"')&&source.includes('objectPanel inactive'),'object settings use two persistent columns');
test(!source.includes('selectionTitle')&&!source.includes('selectionMeta')&&!source.includes('selectionIcon'),'selection labels, dimensions, and icon are removed from preview');
test(source.includes('--accent:#DEDD74')&&built.includes('data:image/png;base64,')&&!built.includes('__TRACEBASE_LOGO_B64__'),'new theme and embedded TraceBase-style logo are built');
['en','ru','it','pt','fr','zh','ja'].forEach((code)=>test(source.includes(code+':{subtitle:'),code+' plugin localization exists'));
console.log('\nPlugin UI: '+passed+' checks passed.');
