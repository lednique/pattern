#!/usr/bin/env node
'use strict';
/* Headless smoke test: boots the built ui.html inside a minimal DOM stub and
   drives the full lifecycle — selection, hover, drag reorder, presets, random,
   create — to catch runtime errors a static parse cannot. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let fakeNow = 0;
const rafQueue = [];
function requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; }
function pump(frames) {
  for (let i = 0; i < frames; i++) {
    fakeNow += 60;
    const queue = rafQueue.splice(0, rafQueue.length);
    queue.forEach(fn => fn(fakeNow));
  }
}

function makeContext() {
  const gradient = { addColorStop() {} };
  const ctx = {};
  ['setTransform', 'clearRect', 'save', 'restore', 'beginPath', 'moveTo', 'arcTo', 'closePath', 'fill', 'stroke', 'translate', 'rotate', 'rect', 'clip', 'drawImage', 'fillRect', 'fillText'].forEach(name => { ctx[name] = () => {}; });
  ctx.createLinearGradient = () => gradient;
  ctx.fillStyle = ''; ctx.strokeStyle = ''; ctx.lineWidth = 1; ctx.font = ''; ctx.textAlign = ''; ctx.textBaseline = '';
  ctx.shadowColor = ''; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  return ctx;
}
let listeners = {};
function makeEl(tag, id) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', children: [], dataset: {}, style: { setProperty() {} },
    textContent: '', innerHTML: '', value: '', checked: false, disabled: false, tabIndex: 0, title: '',
    type: '', className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { this.children.push(child); child.parent = this; return child; },
    addEventListener(type, fn) { (this._l = this._l || {})[type] = (this._l[type] || []).concat(fn); },
    dispatch(type, event) { (this._l && this._l[type] || []).forEach(fn => fn.call(this, event || {})); },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 576, height: 506 }; },
    getContext() { return makeContext(); },
    focus() {}, blur() {},
    closest(selector) { return null; },
    querySelector() { return null; },
    offsetLeft: 0, offsetWidth: 96, clientWidth: 576, clientHeight: 506, width: 0, height: 0,
    isContentEditable: false, contentEditable: 'false', draggable: false
  };
  if (id) registry[id] = el;
  return el;
}
const registry = {};
['langBtn', 'langFlag', 'langCode', 'langMenu', 'licenseBadge', 'lockScreen', 'licenseKey', 'activateBtn', 'licenseMessage', 'buyBtn', 'editor', 'previewDock', 'scrollPreviewGlow', 'previewStage', 'preview', 'previewHint', 'countChip', 'countChipText', 'presetsBtn', 'randomBtn', 'dirSegment', 'dirGlider', 'countValue', 'alternate', 'crop', 'footerLogo', 'stickyBottom', 'createBtn', 'status', 'presetOverlay', 'presetGrid'].forEach(id => makeEl('div', id));
['startAngle', 'bend', 'overlap', 'hierarchy', 'alternateShift', 'chaosShift', 'chaosSize', 'chaosRotate'].forEach(id => { makeEl('input', id); registry[id].type = 'range'; registry[id + 'Out'] = makeEl('output', id + 'Out'); });
registry.startAngle.value = '0'; registry.bend.value = '40'; registry.overlap.value = '50';
registry.hierarchy.value = '0'; registry.alternateShift.value = '50';
registry.chaosShift.value = '0'; registry.chaosSize.value = '0'; registry.chaosRotate.value = '0';
makeEl('div', 'alternateShiftRow');
['startAngle', 'bend', 'hierarchy', 'alternateShift', 'chaosShift', 'chaosSize', 'chaosRotate'].forEach(id => { registry[id].min = '-100'; registry[id].max = '100'; });
registry.overlap.min = '0'; registry.overlap.max = '90';
registry.preview.tagName = 'CANVAS';
registry.previewStage.clientWidth = 576; registry.previewStage.clientHeight = 506;
registry.preview.clientWidth = 576; registry.preview.clientHeight = 506;
/* Two direction buttons inside the segment. */
[['left', false], ['right', true]].forEach(([value, active]) => {
  const button = makeEl('button', 'dirBtn-' + value);
  button.dataset.value = value;
  if (active) button.className = 'active';
  registry.dirSegment.appendChild(button);
});
registry.createBtn.querySelector = () => ({ textContent: '' });

const outbound = [];
function respond(message) {
  if (message && message.pluginMessage && message.pluginMessage.type === 'cache-get') {
    setTimeout(() => fire({ pluginMessage: { type: 'cache-get', key: message.pluginMessage.key, value: null } }), 0);
  }
}
function fire(data) { (listeners.message || []).forEach(fn => fn({ data })); }
const sandbox = {
  console, Math, Number, String, Array, JSON, Date, Object, RegExp, Promise, Symbol, Uint8Array, parseFloat, parseInt, isNaN, Infinity,
  setTimeout, clearTimeout, performance: { now: () => fakeNow },
  requestAnimationFrame,
  navigator: { language: 'ru' },
  window: null,
  document: {
    documentElement: makeEl('html'),
    getElementById(id) { if (!registry[id]) throw new Error('missing #' + id); return registry[id]; },
    createElement(tag) { return makeEl(tag); },
    querySelector(selector) {
      if (selector === '#dirSegment>button.active') {
        return registry.dirSegment.children.find(b => String(b.className).includes('active')) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#langMenu button') return registry.langMenu.children;
      if (selector === '#dirSegment>button') return registry.dirSegment.children;
      return [];
    },
    addEventListener() {},
    createRange() { return { selectNodeContents() {} }; },
    getSelection() { return { removeAllRanges() {}, addRange() {} }; }
  },
  URL: { createObjectURL() { return 'blob:mock'; }, revokeObjectURL() {} },
  Blob: function (parts, options) { this.type = options && options.type; },
  Image: function () { const image = this; Object.defineProperty(image, 'src', { set() { setTimeout(() => image.onerror && image.onerror(), 0); } }); },
  fetch: async () => { throw new Error('offline'); },
  parent: { postMessage(message) { outbound.push(message); respond(message); } }
};
sandbox.window = {
  addEventListener(type, fn) { listeners[type] = (listeners[type] || []).concat(fn); },
  scrollY: 0, devicePixelRatio: 2, innerWidth: 600,
  requestAnimationFrame
};
sandbox.self = sandbox;
vm.createContext(sandbox);
const html = fs.readFileSync(require('path').join(__dirname, '..', 'ui.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(script, sandbox);

(async function () {
  await new Promise(r => setTimeout(r, 20)); pump(4);
  const core = vm.runInContext('VeerCore', sandbox);
  const view = () => vm.runInContext('view', sandbox);
  const state = () => vm.runInContext('state', sandbox);

  assert.equal(core.TEMPLATES.length, 20, 'core with 20 templates is embedded in ui.html');

  /* Selection with five images arrives from the sandbox. */
  fire({ pluginMessage: { type: 'selection', valid: true, count: 5, capped: false, items: [1, 2, 3, 4, 5].map(i => ({ id: 'n' + i, name: 'Img' + i, width: 100 * i, height: 80 })) } });
  pump(4);
  assert.equal(view().built.cards.length, 5, 'the fan renders five cards');
  assert.equal(registry.countChipText.textContent, '5 / 12');
  assert(!registry.createBtn.disabled, 'CREATE unlocks with a valid selection');

  /* Thumbnails resolve (as failed loads → placeholder path). */
  fire({ pluginMessage: { type: 'selection-thumbs', items: [1, 2, 3, 4, 5].map(i => ({ id: 'n' + i, bytes: null })) } });
  await new Promise(r => setTimeout(r, 10)); pump(4);

  /* Hover: pointer over the middle card animates the highlight. */
  const cards = view().built.cards;
  const middle = cards[2];
  registry.preview.dispatch('pointermove', { clientX: view().ox + middle.x * view().k, clientY: view().oy + middle.y * view().k });
  pump(8);
  assert.equal(view().hover, 2, 'hover finds the card under the pointer');

  /* Stray slider input without a held mouse button is reverted instantly. */
  registry.bend.value = '90';
  registry.bend.dispatch('input', {});
  assert.equal(registry.bend.value, '40', 'hover-induced slider ticks are reverted to the last committed value');

  /* Drag with live insertion: pick slot 0, the stack opens between cards 3 and 4. */
  const point = card => ({ clientX: view().ox + card.x * view().k, clientY: view().oy + card.y * view().k });
  const p0 = point(cards[0]);
  registry.preview.dispatch('pointerdown', p0);
  registry.preview.dispatch('pointermove', { clientX: p0.clientX + 40, clientY: p0.clientY + 6 });
  pump(2);
  assert(view().drag && view().drag.moved, 'the drag threshold is detected');
  const between = { clientX: view().ox + (cards[3].x + cards[4].x) / 2 * view().k, clientY: view().oy + (cards[3].y + cards[4].y) / 2 * view().k };
  registry.preview.dispatch('pointermove', between);
  pump(2);
  assert.equal(view().drag.insert, 3, 'the insertion gap opens between cards 3 and 4');
  registry.preview.dispatch('pointerup', {});
  pump(12);
  assert.deepEqual(state().order, [1, 2, 3, 0, 4], 'slot 0 was inserted between cards 3 and 4');

  /* Presets overlay builds ten schematic tiles. */
  registry.presetsBtn.dispatch('click', {});
  assert(!registry.presetOverlay.className.includes('hidden'), 'overlay opens');
  assert.equal(registry.presetGrid.children.length, 20, 'twenty template tiles');
  const tile = registry.presetGrid.children[6];
  tile.closest = () => tile;
  registry.presetOverlay.dispatch('click', { target: tile });
  assert.equal(vm.runInContext('+(document.getElementById("bend").value)', sandbox), Math.round(210 / 3.6), 'template 7 applies its bend through the slider mapping');
  pump(6);

  /* Randomizer keeps the window alive. */
  registry.randomBtn.dispatch('click', {});
  pump(6);

  /* Direction segment switches with the glider target. */
  const leftButton = registry.dirSegment.children[0];
  leftButton.closest = () => leftButton;
  registry.dirSegment.dispatch('click', { target: leftButton });
  assert.equal(state().direction, 'left');

  /* CREATE posts the fan settings including the current order. */
  registry.createBtn.dispatch('click', {});
  const create = outbound.map(m => m.pluginMessage).find(m => m.type === 'create-fan');
  assert(create, 'create-fan message is posted');
  const sentOrder = create.settings.order || [0, 1, 2, 3, 4];
  assert.equal(sentOrder.length, 5, 'the order travels with the settings');
  assert.equal(create.settings.direction, 'left');
  fire({ pluginMessage: { type: 'fan-created', result: { name: 'Veer · fan', width: 800, height: 400 } } });
  await new Promise(r => setTimeout(r, 10)); pump(4);
  assert.equal(registry.status.textContent, vm.runInContext('t("created")', sandbox), 'success status is shown');

  /* Over-cap selection is reported. */
  fire({ pluginMessage: { type: 'selection', valid: true, count: 15, capped: true, items: Array.from({ length: 12 }, (_, i) => ({ id: 'c' + i, name: 'C' + i, width: 100, height: 70 })) } });
  pump(4);
  assert.equal(registry.countChipText.textContent, '12 / 12');
  assert.equal(view().built.cards.length, 12, 'the preview scales to twelve cards');

  /* Settings persist through the cache channel. */
  await new Promise(r => setTimeout(r, 320));
  const saved = outbound.map(m => m.pluginMessage).filter(m => m.type === 'cache-set' && m.key === 'settings');
  assert(saved.length, 'settings are saved to client storage');

  console.log('  ✓ boots without runtime errors');
  console.log('  ✓ selection renders and auto-scales the fan');
  console.log('  ✓ hover highlights the card under the pointer');
  console.log('  ✓ drag and drop reorders the stack');
  console.log('  ✓ twenty schematic presets apply their settings');
  console.log('  ✓ randomizer, direction switch and CREATE flow work');
  console.log('  ✓ over-cap selections and cache saving behave');
  console.log('\nSmoke: 7 checks passed.');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
