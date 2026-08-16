#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','src','ui-template.html'),'utf8');const built=fs.readFileSync(path.join(__dirname,'..','ui.html'),'utf8');let passed=0;
function test(value,name){assert(value,name);passed++;console.log('  ✓ '+name);}
test(source.includes('.previewDock{position:sticky;top:5px'),'preview is sticky with a 5 px top offset');
test(source.includes("previewProgress=Math.max(0,Math.min(1,window.scrollY/180))")&&!source.includes("classList.toggle('compact'"),'preview geometry follows scroll continuously without snapping');
test(source.includes('height:100px;background:linear-gradient(180deg,rgba(222,221,116,.92)')&&source.includes("--preview-progress',previewProgress"),'compact preview gets a 100 px theme gradient behind it');
test(source.includes('var display=256+(172-256)*previewProgress')&&source.includes('top:-100px;width:100%;height:456px'),'full preview renders the central tile at 100% scale and 100 px higher');
test(source.includes('.previewDock+.card')&&source.includes('margin-top:-100px'),'settings are raised 100 px over the preview continuation');
test(source.includes("ctx.lineWidth=3")&&source.includes('radius=5+(22-5)*previewProgress'),'central tile has a 3 px border and scroll-linked corner radius');
test(source.includes("for(var side=-2;side<=2;side++){if(side!==0)ctx.drawImage(ghost"),'side repeats are transparent theme-colored figures');
test(source.includes("out.contentEditable='true'")&&source.includes("input.value=value"),'slider values support direct keyboard entry');
test(!source.includes('stopImmediatePropagation')&&!source.includes('thumb/2+3'),'clicking anywhere on a slider is no longer blocked');
test(source.includes('pluginDrop')&&source.includes("source:'patternique'"),'central preview square starts a Figma drag and drop');
test(source.includes('-webkit-appearance:auto;appearance:auto')&&source.includes('input[type=color]'),'color controls use the standard system picker');
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
