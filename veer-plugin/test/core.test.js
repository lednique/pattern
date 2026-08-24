#!/usr/bin/env node
'use strict';
const assert = require('assert');
const core = require('../src/veer-core');
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (error) { console.error('  ✗ ' + name); throw error; } }
const items = [
  { width: 100, height: 60 },
  { width: 200, height: 100 },
  { width: 150, height: 90 },
  { width: 120, height: 120 }
];
const base = { direction: 'right', startAngle: 0, bend: 140, overlap: 50, alternate: false, crop: true, chaosShift: 0, chaosSize: 0, chaosRotate: 0, seed: 1, order: null };

test('defaults match the product specification', () => {
  const s = core.normalizeSettings({});
  assert.equal(s.direction, 'right');
  assert.equal(s.startAngle, 0);
  assert.equal(s.bend, 140);
  assert.equal(s.overlap, 50);
  assert.equal(s.alternate, false);
  assert.equal(s.crop, true);
  assert.equal(s.seed, 1);
});
test('settings are clamped to their ranges', () => {
  const s = core.normalizeSettings({ startAngle: 999, bend: -40, overlap: 120, chaosShift: 500, chaosRotate: -5, seed: 0 });
  assert.equal(s.startAngle, 360);
  assert.equal(s.bend, 0);
  assert.equal(s.overlap, 90);
  assert.equal(s.chaosShift, 100);
  assert.equal(s.chaosRotate, 0);
  assert.equal(s.seed, 1);
});
test('no more than 12 images join the fan', () => {
  assert.equal(core.MAX_IMAGES, 12);
  const many = Array.from({ length: 20 }, () => ({ width: 100, height: 100 }));
  assert.equal(core.buildFan(base, many).cards.length, 12);
});
test('a straight line keeps one spacing for every neighbour', () => {
  const built = core.buildFan({ ...base, bend: 0, overlap: 0 }, items);
  assert(built.straight);
  const ys = built.cards.map(c => c.y);
  assert(ys.every(y => Math.abs(y) < 1e-9), 'the line is horizontal at start angle 0 (top)');
  for (let i = 1; i < built.cards.length; i++) assert(Math.abs((built.cards[i].x - built.cards[i - 1].x) - built.step) < 1e-9);
  assert(Math.abs(built.step - 142.5) < 1e-9, 'step is the average card width at 0% overlap');
});
test('direction left mirrors the stack to the left', () => {
  const right = core.buildFan({ ...base, bend: 0, overlap: 0 }, items);
  const left = core.buildFan({ ...base, direction: 'left', bend: 0, overlap: 0 }, items);
  assert(right.cards[3].x > 0);
  assert(left.cards[3].x < 0);
});
test('overlap shrinks the arc step between card centres', () => {
  const loose = core.buildFan({ ...base, bend: 180, overlap: 0 }, items);
  const tight = core.buildFan({ ...base, bend: 180, overlap: 90 }, items);
  assert(loose.radius > tight.radius * 5, '90% overlap curls the fan much tighter');
  assert(Math.abs(tight.step - loose.step * 0.1) < 1e-9);
});
test('a full 360° bend closes the line into a circle', () => {
  const built = core.buildFan({ ...base, bend: 360, overlap: 0 }, items);
  const first = built.cards[0], last = built.cards[built.cards.length - 1];
  const spread = Math.hypot(first.x - last.x, first.y - last.y);
  assert(spread < built.step, 'first and last card meet on the closed circle');
  built.cards.forEach(card => {
    assert(Math.abs(Math.hypot(card.x, card.y) - built.radius) < 1e-6, 'every card sits on the circle');
  });
});
test('cards rotate along the arc tangent', () => {
  const built = core.buildFan({ ...base, bend: 180, startAngle: 0 }, items);
  built.cards.forEach(card => {
    const angleToCentre = Math.atan2(card.y, card.x) * 180 / Math.PI;
    const expected = (angleToCentre + 90 + 360) % 360;
    const actual = ((card.angle % 360) + 360) % 360;
    assert(Math.abs(actual - expected) < 1e-6 || Math.abs(actual - expected - 360) < 1e-6);
  });
});
test('crop mode builds one uniform card of the average size', () => {
  const built = core.buildFan({ ...base, crop: true, alternate: false }, items);
  built.cards.forEach(card => {
    assert(Math.abs(card.width - 142.5) < 1e-9);
    assert(Math.abs(card.height - 92.5) < 1e-9);
    assert(card.crop);
  });
  const cover = Math.max(142.5 / 200, 92.5 / 100);
  assert(Math.abs(built.cards[1].imageWidth - 200 * cover) < 1e-9, 'images are cover-cropped, never letterboxed');
});
test('without crop every card keeps its aspect ratio', () => {
  const built = core.buildFan({ ...base, crop: false }, items);
  built.cards.forEach((card, i) => {
    assert(!card.crop);
    assert(Math.abs(card.width / card.height - items[i].width / items[i].height) < 1e-9);
    assert(Math.abs(card.imageWidth - card.width) < 1e-9);
  });
});
test('«через 1» shifts every second stack slot away from the pivot', () => {
  const plain = core.buildFan({ ...base, bend: 180 }, items);
  const alt = core.buildFan({ ...base, bend: 180, alternate: true }, items);
  alt.cards.forEach((card, slot) => {
    const base1 = plain.cards[slot];
    const grew = Math.hypot(card.x, card.y) - Math.hypot(base1.x, base1.y);
    if (slot % 2 === 1) assert(grew > 1, 'odd slots step outward');
    else assert(Math.abs(grew) < 1e-9, 'even slots stay on the arc');
  });
});
test('chaos shift stays within ±250% of the card container', () => {
  const built = core.buildFan({ ...base, chaosShift: 100, chaosRotate: 0, chaosSize: 0 }, items);
  const zero = core.buildFan({ ...base, chaosShift: 0, chaosRotate: 0, chaosSize: 0 }, items);
  built.cards.forEach((card, slot) => {
    const dx = card.x - zero.cards[slot].x, dy = card.y - zero.cards[slot].y;
    assert(Math.abs(dx) <= 2.5 * 142.5 + 1e-6, 'dx within ±250% of the card width');
    assert(Math.abs(dy) <= 2.5 * 92.5 + 1e-6, 'dy within ±250% of the card height');
  });
});
test('the same seed always paints the same chaos', () => {
  const a = core.buildFan({ ...base, chaosShift: 80, chaosRotate: 60, chaosSize: 50 }, items);
  const b = core.buildFan({ ...base, chaosShift: 80, chaosRotate: 60, chaosSize: 50 }, items);
  a.cards.forEach((card, i) => {
    assert.equal(card.x, b.cards[i].x);
    assert.equal(card.angle, b.cards[i].angle);
    assert.equal(card.width, b.cards[i].width);
  });
});
test('chaos follows the source image when the stack is reordered', () => {
  const identity = core.buildFan({ ...base, chaosShift: 100, chaosSize: 40 }, items);
  const flipped = core.buildFan({ ...base, chaosShift: 100, chaosSize: 40, order: [3, 2, 1, 0] }, items);
  const bySource = {};
  identity.cards.forEach(card => { bySource[card.source] = card; });
  flipped.cards.forEach(card => {
    assert.equal(card.width, bySource[card.source].width, 'size jitter is tied to the image, not the slot');
  });
});
test('order rewrites the stack and never loses images', () => {
  const built = core.buildFan({ ...base, order: [2, 0, 3] }, items);
  assert.deepEqual(built.order, [2, 0, 3, 1], 'missing sources are appended');
  assert.equal(built.cards[0].source, 2);
  assert.equal(built.cards[3].source, 1);
  const bad = core.normalizeSettings({ order: [0, 0, 99, -1] });
  assert.deepEqual(core.normalizeOrder(bad.order, 4), [0]);
});
test('start angle places the first card at the requested clock position', () => {
  const built = core.buildFan({ ...base, bend: 180, startAngle: 90 }, items);
  const first = built.cards[0];
  assert(first.x > 0 && Math.abs(first.y) < 1e-6, '90° puts the first card at 3 o’clock');
  const top = core.buildFan({ ...base, bend: 180, startAngle: 0 }, items);
  assert(Math.abs(top.cards[0].x) < 1e-6 && top.cards[0].y < 0, '0° puts the first card at 12 o’clock');
});
test('the bbox covers every rotated card', () => {
  const built = core.buildFan({ ...base, bend: 200, chaosRotate: 40 }, items);
  built.cards.forEach(card => {
    assert(card.x >= built.bbox.x - 1e-6 && card.x <= built.bbox.x + built.bbox.width + 1e-6);
    assert(card.y >= built.bbox.y - 1e-6 && card.y <= built.bbox.y + built.bbox.height + 1e-6);
  });
  assert(built.bbox.width > 0 && built.bbox.height > 0);
});
test('export names carry the ordered _veer_ prefix', () => {
  assert.equal(core.namePrefix(0), '01_veer_');
  assert.equal(core.namePrefix(11), '12_veer_');
});
test('ten built-in templates are defined', () => {
  assert.equal(core.TEMPLATES.length, 10);
  core.TEMPLATES.forEach(template => {
    const s = core.normalizeSettings(template);
    assert(['left', 'right'].includes(s.direction));
    assert(s.bend >= 0 && s.bend <= 360);
  });
});
test('a single image still builds a fan', () => {
  const built = core.buildFan(base, [{ width: 300, height: 100 }]);
  assert.equal(built.cards.length, 1);
  assert.equal(built.cards[0].angle, 0, 'start angle 0 keeps the single card upright');
  assert(built.bbox.width > 0);
});

console.log('\nVeerCore: ' + passed + ' checks passed.');
