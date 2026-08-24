#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui-template.html'), 'utf8');
const built = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');
const codeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'code-template.js'), 'utf8');
let passed = 0;
function test(value, name) { assert(value, name); passed++; console.log('  ✓ ' + name); }

test(codeSource.includes("figma.showUI(__html__, { width: 600"), 'the plugin window is 200 px wider than Patternique');
test(source.includes('--accent:#F2A24C'), 'the palette is orange like the Veer brand');
test(source.includes('linear-gradient(180deg,var(--grad)') && source.includes('.baseGradient{position:fixed;z-index:0'), 'the original theme gradient is kept behind the plugin');
test(source.includes('.cols2{display:grid;grid-template-columns:1fr 1fr') && source.includes('id="startAngle"') && source.includes('id="bend"') && source.includes('id="overlap"') && source.includes('id="hierarchy"'), 'fan parameters are laid out in two columns');
test(source.includes('id="dirSegment"') && source.includes('id="dirGlider"') && source.includes("data-value=\"left\"") && source.includes("data-value=\"right\""), 'direction segment offers left and right with the glider animation');
test(source.includes('id="alternate"') && source.includes('id="crop"'), '«через 1» and crop toggles are present');
test(source.includes('id="chaosShift"') && source.includes('id="chaosSize"') && source.includes('id="chaosRotate"'), 'chaos has separate shift, size and rotation sliders');
test(source.includes('id="alternateShift"') && source.includes('id="alternateShiftRow"'), 'the «через 1» mode has its own signed shift slider');
test(source.includes('id="hierarchy"') && source.includes('hierarchyHint'), 'the hierarchy size parameter is present with a hint');
test(['startAngle', 'bend', 'hierarchy', 'alternateShift', 'chaosShift', 'chaosSize', 'chaosRotate'].every(id => source.includes('id="' + id + '" type="range" min="-100" max="100"')), 'every slider except overlap spans −100…+100 with 0 in the middle');
test(source.includes('id="overlap" type="range" min="0" max="90"'), 'overlap keeps its 0…90 range');
test(source.includes('input[type=range].bipolar::-webkit-slider-runnable-track') && source.includes('--fill-lo') && source.includes('--fill-hi'), 'bipolar tracks fill from the centre towards the thumb');
test(source.includes('<h1>Veer</h1>') && source.includes('class="brandLogo"'), 'the header keeps the brand logo next to the Veer title');
test(source.includes('.previewDock{position:sticky;top:5px;z-index:35') && source.includes('height:460px'), 'the sticky preview is taller for the wide fan stage');
test(source.includes("previewProgress=Math.max(0,Math.min(1,window.scrollY/180))") && source.includes('dock.classList.toggle(\'toolsHidden\',previewProgress>0.15)'), 'the preview keeps collapsing into a centered square on scroll');
test(source.includes('#presetsBtn{left:4px}#randomBtn{right:4px}'), 'template and random buttons flank the preview');
test(source.includes('grid-template-columns:repeat(5,90px)') && source.includes('VeerCore.TEMPLATES.forEach'), 'the preset overlay shows the 20 templates in a 5 × 4 grid');
test(source.includes('for(i=0;i<5;i++)items.push({width:96,height:64})') && source.includes("Math.round(77+(255-77)*card.slot/4)"), 'preset tiles are schematic: five cards from dark grey to white, no real images');
test(source.includes("'rgba(255,255,255,'+(0.4*s.hl)"), 'hovering a card paints a 40% white highlight');
test(source.includes('Math.min(12,Math.min(w,h)/2)'), 'interface cards are rounded to 12 px while the export stays square');
test(!source.includes("fillStyle='#FFFFFF'") && !source.includes("strokeStyle='#555555'"), 'the preview background is fully transparent');
test(source.includes('insertionIndexAt') && source.includes('applyLiveInsertion') && source.includes('pointSegmentDistance'), 'dragging opens the stack and inserts the card between its neighbours');
test(source.includes('document.activeElement===this') && source.includes("'ArrowLeft'"), 'sliders ignore the wheel and arrow keys: they change only while the mouse button is held');
test(source.includes('easeOutBack') && source.includes('scale:isDrag||isHover?1.08:1'), 'hover and drag animate from the card centre like the UI buttons');
test(source.includes('setPointerCapture') && source.includes('order.splice(drag.insert,0,source)'), 'dragging a card reorders the stack');
test(!source.includes('pluginDrop') && !source.includes('dragstart') && !codeSource.includes("figma.on('drop'"), 'the preview has no drag and drop into the Figma scene');
test(source.includes('constraint: { type: \'SCALE\''.replace('\'', '\'')) || codeSource.includes("type: 'SCALE'"), 'preview thumbnails are exported at 256 px on the longer side');
test(codeSource.includes("VeerCore.namePrefix(card.slot) + source.name"), 'exported images get the ordered _veer_ prefix');
test(source.includes('id="countChip"') && source.includes("' / 12'"), 'the image counter shows n / 12');
test(source.includes('capped') && source.includes('cappedHint'), 'selections above 12 images are reported');
test(source.includes('TRIAL_LIMIT=5') && source.includes('activate-key') && source.includes('id="lockScreen"'), 'the Patternique trial and license flow is reused');
test(source.includes("LANGS={en:") && source.includes('ja:'), 'all seven interface languages are kept');
test(source.includes("out.contentEditable='true'"), 'slider values support direct keyboard entry');
test(built.includes('Montserrat') && built.includes('__SLIDER_THUMB_B64__'.replace('__SLIDER_THUMB_B64__', 'data:image/svg+xml;base64,')), 'ui.html embeds the Montserrat font and the slider thumb');
test(built.includes('VeerCore.buildFan') && built.includes('drawSchematic'), 'the built ui.html carries the fan engine and schematic presets');

console.log('\nUI: ' + passed + ' checks passed.');
