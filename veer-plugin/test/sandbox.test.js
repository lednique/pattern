#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
let nextId = 0;
const messages = [];
const pageChildren = [];
const exportsLog = [];
function node(type, name, width, height) {
  return {
    id: 'n' + (++nextId), type, name: name || type, width: width || 10, height: height || 10, x: 0, y: 0,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }], strokes: [], children: type === 'FRAME' ? [] : undefined,
    absoluteTransform: [[1, 0, 0], [0, 1, 0]], effects: [],
    clone() {
      const cloned = node(this.type, this.name, this.width, this.height);
      cloned.fills = JSON.parse(JSON.stringify(this.fills));
      cloned.strokes = JSON.parse(JSON.stringify(this.strokes));
      cloned.effects = JSON.parse(JSON.stringify(this.effects || []));
      return cloned;
    },
    resize(w, h) { this.width = w; this.height = h; },
    resizeWithoutConstraints(w, h) { this.resize(w, h); },
    rescale(factor) { this.width *= factor; this.height *= factor; (this.effects || []).forEach(e => { if (typeof e.radius === 'number') e.radius *= factor; if (e.offset) { e.offset.x *= factor; e.offset.y *= factor; } }); },
    exportAsync: async (settings) => { exportsLog.push(settings); return new Uint8Array([1, 2, 3]); },
    setPluginData(k, v) { this.pluginData = this.pluginData || {}; this.pluginData[k] = v; },
    remove() { this.removed = true; },
    appendChild(child) { this.children = this.children || []; this.children.push(child); child.parent = this; }
  };
}
/* Three images with different aspect ratios, like a real fan selection. */
const sources = [node('RECTANGLE', 'Beach', 400, 300), node('RECTANGLE', 'Forest', 640, 320), node('RECTANGLE', 'City', 300, 450)];
sources[0].absoluteTransform = [[1, 0, 100], [0, 1, 200]];
sources[0].absoluteBoundingBox = { x: 100, y: 200, width: 400, height: 300 };
const page = { selection: sources, children: pageChildren, loadAsync: async () => {}, appendChild(child) { pageChildren.push(child); } };
const handlers = {};
const figma = {
  mixed: Symbol('mixed'), currentPage: page, currentUser: { id: 'figma-test' }, showUI() {}, on(type, cb) { handlers[type] = cb; },
  ui: { postMessage(msg) { messages.push(msg); }, onmessage: null },
  clientStorage: { async getAsync() { return null; }, async setAsync() {} },
  createFrame() { const n = node('FRAME', 'Frame', 100, 100); n.layoutMode = 'NONE'; n.clipsContent = false; pageChildren.push(n); return n; },
  viewport: { scrollAndZoomIntoView() {} }, notify() {}
};
const sandbox = { figma, __html__: '', console, Uint8Array, Math, Number, String, Array, JSON, Date, Promise, Symbol, setTimeout, clearTimeout, module: undefined, self: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'code.js'), 'utf8'), sandbox);
(async function () {
  await new Promise(r => setTimeout(r, 10));
  const selectionMessage = messages.find(m => m.type === 'selection');
  assert(selectionMessage && selectionMessage.valid, 'selection is reported');
  assert.equal(selectionMessage.items.length, 3);
  assert.equal(selectionMessage.items[0].name, 'Beach');
  assert(!selectionMessage.capped, 'three images are below the cap');

  /* Thumbnails are requested at 256 px on the longer side. */
  const thumbsMessage = messages.find(m => m.type === 'selection-thumbs');
  assert(thumbsMessage, 'thumbs are exported');
  assert(Math.abs(exportsLog[0].constraint.value - 256 / 400) < 1e-9, 'long image scaled to 256 px long side');
  assert(Math.abs(exportsLog[2].constraint.value - 256 / 450) < 1e-9, 'tall image scaled to 256 px long side');

  /* Crop mode: every image becomes a clipped uniform card with a prefixed name. */
  await figma.ui.onmessage({ type: 'create-fan', settings: { direction: 'right', startAngle: 0, bend: 140, overlap: 50, alternate: false, crop: true, chaosShift: 0, chaosSize: 0, chaosRotate: 0, seed: 1, order: [2, 0, 1] } });
  const done = messages.find(m => m.type === 'fan-created');
  assert(done, 'fan-created message');
  const frame = page.selection[0];
  assert.equal(frame.type, 'FRAME');
  assert.equal(frame.children.length, 3, 'all images live in one frame');
  assert.equal(frame.fills.length, 0, 'the fan frame is transparent');
  assert(frame.pluginData.veerSettings, 'settings are stored in plugin data');
  assert.deepEqual(JSON.parse(frame.pluginData.veerSettings).order, [2, 0, 1]);
  const names = frame.children.map(c => c.name);
  assert.deepEqual(names, ['01_veer_City', '02_veer_Beach', '03_veer_Forest'], 'prefixed names follow the stack order');
  frame.children.forEach(card => {
    assert.equal(card.type, 'FRAME');
    assert.equal(card.clipsContent, true, 'crop cards clip their image');
    assert(Math.abs(card.width - 446.666) < 0.01 || Math.abs(card.width - ((400 + 640 + 300) / 3)) < 0.01, 'uniform average card width');
    assert(card.children.length === 1 && card.children[0].name === card.name.replace(/^\d\d_veer_/, ''), 'the clone keeps its original name inside the clip frame');
    assert(card.children[0].width >= card.width - 0.01 && card.children[0].height >= card.height - 0.01, 'the clone covers the whole card');
  });
  assert(Math.abs(frame.children[1].children[0].effects.length - sources[0].effects.length) === 0, 'clone keeps its effects');

  /* No-crop mode: clones are appended directly and keep their aspect ratio. */
  await figma.ui.onmessage({ type: 'create-fan', settings: { direction: 'left', startAngle: 90, bend: 90, overlap: 30, alternate: true, crop: false, chaosShift: 20, chaosSize: 10, chaosRotate: 15, seed: 4 } });
  const freeFrame = page.selection[0];
  assert.equal(freeFrame.children.length, 3);
  freeFrame.children.forEach((clone, i) => {
    assert.equal(clone.type, 'RECTANGLE');
    assert(clone.name.match(/^\d\d_veer_/), 'prefix present without crop too');
    const aspect = sources[i].width / sources[i].height;
    assert(Math.abs(clone.width / clone.height - aspect) < 0.05, 'aspect ratio survives the fit scale');
  });

  /* Many selected images are capped at 12. */
  const many = Array.from({ length: 15 }, (_, i) => node('RECTANGLE', 'Img' + i, 100, 80));
  page.selection = many;
  messages.length = 0;
  handlers.selectionchange();
  await new Promise(r => setTimeout(r, 10));
  const capped = messages.find(m => m.type === 'selection');
  assert(capped.capped, 'cap flag is sent');
  assert.equal(capped.count, 15);
  assert.equal(capped.items.length, 12, 'only the first 12 images are used');

  console.log('  ✓ selection metadata and 256 px thumbnails are sent');
  console.log('  ✓ transparent fan frame stores settings and order');
  console.log('  ✓ crop mode builds uniform clipped cards with 01_veer_ names');
  console.log('  ✓ no-crop mode keeps aspect ratios directly in the frame');
  console.log('  ✓ selections above 12 images are capped');
  console.log('\nSandbox: 5 checks passed.');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
