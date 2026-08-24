/* Veer — Figma document sandbox. */
'use strict';

/* Veer shared fan math. Runs in the Figma sandbox, the plugin UI and Node tests. */
'use strict';

var VeerCore = (function () {
  var MAX_IMAGES = 12;
  var CHAOS_SHIFT_SPAN = 2.5;    /* random shift lives within ±250% of the card container */
  var CHAOS_SIZE_RANGE = 0.7;    /* ±70% size deviation at full chaos */
  var CHAOS_ROTATE_RANGE = 180;  /* ±180° extra rotation at full chaos */
  var ALTERNATE_OFFSET = 0.5;    /* «через 1» radial offset as a share of the card height */
  var NAME_PREFIX = '_veer_';

  function clamp(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = min;
    return Math.min(max, Math.max(min, number));
  }

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function normalizeOrder(order, count) {
    if (!Array.isArray(order) || !order.length) return null;
    var seen = {}, out = [];
    for (var index = 0; index < order.length && out.length < MAX_IMAGES; index++) {
      var value = Number(order[index]);
      if (!Number.isFinite(value) || value < 0 || value >= MAX_IMAGES || seen[value]) continue;
      if (count !== undefined && value >= count) continue;
      seen[value] = true;
      out.push(Math.round(value));
    }
    return out.length ? out : null;
  }

  function normalizeSettings(input) {
    var source = input || {};
    return {
      direction: source.direction === 'left' ? 'left' : 'right',
      /* Clock convention: 0° = top, 90° = right, 180° = bottom, 270° = left. */
      startAngle: Math.round(clamp(source.startAngle === undefined ? 0 : source.startAngle, 0, 360)),
      /* 0° = straight line of images, 360° = the line curls into a full circle. */
      bend: Math.round(clamp(source.bend === undefined ? 140 : source.bend, 0, 360)),
      overlap: Math.round(clamp(source.overlap === undefined ? 50 : source.overlap, 0, 90)),
      chaosShift: Math.round(clamp(source.chaosShift === undefined ? 0 : source.chaosShift, 0, 100)),
      chaosSize: Math.round(clamp(source.chaosSize === undefined ? 0 : source.chaosSize, 0, 100)),
      chaosRotate: Math.round(clamp(source.chaosRotate === undefined ? 0 : source.chaosRotate, 0, 100)),
      alternate: source.alternate === true || source.alternate === 'true',
      crop: source.crop === undefined ? true : (source.crop === true || source.crop === 'true'),
      seed: Math.round(clamp(source.seed === undefined ? 1 : source.seed, 1, 999999)),
      order: normalizeOrder(source.order)
    };
  }

  /* Deterministic PRNG so a given seed always paints the same «chaotic» fan. */
  function mulberry32(seed) {
    var a = (Math.floor(seed) || 1) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function averageSize(items) {
    var width = 0, height = 0, count = 0;
    for (var index = 0; index < items.length; index++) {
      width += Number(items[index].width) || 0;
      height += Number(items[index].height) || 0;
      count++;
    }
    if (!count) return { width: 0, height: 0 };
    return { width: width / count, height: height / count };
  }

  /* Card container for every source image.
     crop = true  → one uniform card average width × average height, image cover-cropped in the centre;
     crop = false → the image keeps its aspect ratio fitted into the average card box. */
  function cardLayout(items, settings) {
    var average = averageSize(items);
    var cards = [];
    for (var index = 0; index < items.length; index++) {
      var width = Math.max(0.001, Number(items[index].width) || 1);
      var height = Math.max(0.001, Number(items[index].height) || 1);
      if (settings.crop) {
        cards.push({
          width: average.width, height: average.height,
          scale: Math.max(average.width / width, average.height / height),
          crop: true
        });
      } else {
        var fit = Math.min(average.width / width, average.height / height);
        cards.push({ width: width * fit, height: height * fit, scale: fit, crop: false });
      }
    }
    return cards;
  }

  /* Stack order: slot → source image index. Missing sources are appended,
     so a stale order never loses images after the selection changes. */
  function sourceOrder(count, settings) {
    var order = [];
    if (settings.order && settings.order.length) {
      for (var index = 0; index < settings.order.length; index++) {
        var value = Number(settings.order[index]);
        if (Number.isFinite(value) && value >= 0 && value < count && order.indexOf(value) < 0) order.push(value);
      }
    }
    for (var source = 0; source < count; source++) if (order.indexOf(source) < 0) order.push(source);
    return order.slice(0, count);
  }

  function rotatedBbox(cards) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(function (card) {
      var radians = card.angle * Math.PI / 180;
      var cos = Math.cos(radians), sin = Math.sin(radians);
      var halfWidth = card.width / 2, halfHeight = card.height / 2;
      for (var corner = 0; corner < 4; corner++) {
        var lx = (corner % 2 ? -1 : 1) * halfWidth, ly = (corner < 2 ? -1 : 1) * halfHeight;
        var x = card.x + lx * cos - ly * sin;
        var y = card.y + lx * sin + ly * cos;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    });
    if (!cards.length) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /* The fan itself. Coordinates are local design pixels around an implicit
     pivot at (0, 0); the caller re-centres the returned bbox. */
  function buildFan(input, items) {
    var settings = normalizeSettings(input);
    var count = Math.min(items.length, MAX_IMAGES);
    if (!count) {
      return { settings: settings, cards: [], order: [], average: { width: 0, height: 0 }, radius: 0, step: 0, straight: true, bbox: { x: 0, y: 0, width: 0, height: 0 } };
    }
    var used = items.slice(0, count);
    var order = sourceOrder(count, settings);
    var containers = cardLayout(used, settings);
    var average = averageSize(used);
    var step = average.width * (1 - settings.overlap / 100);
    var arcLength = (count - 1) * step;
    var bendRad = settings.bend * Math.PI / 180;
    var straight = settings.bend < 0.5 || count < 2;
    var radius = straight ? 0 : arcLength / bendRad;
    var startRad = (settings.startAngle - 90) * Math.PI / 180;
    var sweep = settings.direction === 'left' ? -1 : 1;
    var tangent = { x: sweep * -Math.sin(startRad), y: sweep * Math.cos(startRad) };

    /* Randomness is tied to the source image, not the slot: reordering images
       in the stack keeps each picture's own drift and jitter. */
    var random = mulberry32(settings.seed);
    var drift = [];
    for (var source = 0; source < count; source++) {
      var r1 = random(), r2 = random(), r3 = random(), r4 = random();
      drift.push({
        dx: (r1 * 2 - 1) * (settings.chaosShift / 100) * CHAOS_SHIFT_SPAN * containers[source].width,
        dy: (r2 * 2 - 1) * (settings.chaosShift / 100) * CHAOS_SHIFT_SPAN * containers[source].height,
        factor: 1 + (r3 * 2 - 1) * (settings.chaosSize / 100) * CHAOS_SIZE_RANGE,
        rotate: (r4 * 2 - 1) * (settings.chaosRotate / 100) * CHAOS_ROTATE_RANGE
      });
    }

    var cards = [];
    for (var slot = 0; slot < count; slot++) {
      var sourceIndex = order[slot];
      var container = containers[sourceIndex];
      var t = count > 1 ? slot / (count - 1) : 0;
      var angleRad = startRad + sweep * bendRad * t;
      var x, y, baseRotation;
      if (straight) {
        x = slot * step * tangent.x;
        y = slot * step * tangent.y;
        baseRotation = startRad;
      } else {
        x = radius * Math.cos(angleRad);
        y = radius * Math.sin(angleRad);
        baseRotation = angleRad;
      }
      /* «Через 1»: every second image of the stack steps away from the pivot. */
      if (settings.alternate && slot % 2 === 1) {
        var outwardX = straight ? Math.cos(startRad) : Math.cos(angleRad);
        var outwardY = straight ? Math.sin(startRad) : Math.sin(angleRad);
        var offset = ALTERNATE_OFFSET * average.height;
        x += outwardX * offset;
        y += outwardY * offset;
      }
      var chaos = drift[sourceIndex];
      x += chaos.dx;
      y += chaos.dy;
      var factor = Math.max(0.05, chaos.factor);
      cards.push({
        slot: slot,
        source: sourceIndex,
        x: x,
        y: y,
        angle: baseRotation * 180 / Math.PI + 90 + chaos.rotate,
        factor: factor,
        width: container.width * factor,   /* visible card (clip) size */
        height: container.height * factor,
        imageWidth: Number(used[sourceIndex].width) * container.scale * factor,
        imageHeight: Number(used[sourceIndex].height) * container.scale * factor,
        crop: container.crop
      });
    }

    return {
      settings: settings,
      cards: cards,
      order: order,
      average: average,
      radius: radius,
      step: step,
      straight: straight,
      bbox: rotatedBbox(cards)
    };
  }

  /* Export name: «01_veer_», «02_veer_» … */
  function namePrefix(index) {
    return String(Math.abs(Math.round(index)) + 1).padStart(2, '0') + NAME_PREFIX;
  }

  /* Ten built-in templates. The preset overlay previews them schematically. */
  var TEMPLATES = [
    { direction: 'right', startAngle: 0, bend: 140, overlap: 55, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* classic fan */
    { direction: 'right', startAngle: 90, bend: 0, overlap: 35, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* straight row */
    { direction: 'right', startAngle: 0, bend: 360, overlap: 62, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* full circle */
    { direction: 'left',  startAngle: 90, bend: 180, overlap: 45, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* left half-arc */
    { direction: 'right', startAngle: 30, bend: 60, overlap: 25, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* gentle arc */
    { direction: 'right', startAngle: 0, bend: 90, overlap: 60, alternate: false, crop: true,  chaosShift: 55, chaosSize: 35, chaosRotate: 45, seed: 7 },  /* chaotic scatter */
    { direction: 'right', startAngle: 270, bend: 210, overlap: 72, alternate: true,  crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* two-row fan */
    { direction: 'right', startAngle: 270, bend: 24, overlap: 86, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* tight stack */
    { direction: 'right', startAngle: 270, bend: 180, overlap: 0, alternate: false, crop: true,  chaosShift: 0,  chaosSize: 0,  chaosRotate: 0,  seed: 1 },  /* open half, no overlap */
    { direction: 'right', startAngle: 45, bend: 360, overlap: 40, alternate: true,  crop: true,  chaosShift: 0,  chaosSize: 15, chaosRotate: 0,  seed: 3 }   /* alternating wreath */
  ];

  return {
    MAX_IMAGES: MAX_IMAGES,
    CHAOS_SHIFT_SPAN: CHAOS_SHIFT_SPAN,
    ALTERNATE_OFFSET: ALTERNATE_OFFSET,
    TEMPLATES: TEMPLATES,
    clamp: clamp,
    mod: mod,
    mulberry32: mulberry32,
    normalizeSettings: normalizeSettings,
    normalizeOrder: normalizeOrder,
    averageSize: averageSize,
    cardLayout: cardLayout,
    sourceOrder: sourceOrder,
    buildFan: buildFan,
    namePrefix: namePrefix
  };
})();

if (typeof module === 'object' && module.exports) module.exports = VeerCore;


figma.showUI(__html__, { width: 600, height: 720, themeColors: false });

var selectionSnapshot = [];
var selectionRevision = 0;

async function ensurePage() {
  var page = figma.currentPage;
  if (page && typeof page.loadAsync === 'function') await page.loadAsync();
}

function eligible(node) {
  return !!node && node.type !== 'SLICE' && node.type !== 'SECTION' &&
    typeof node.clone === 'function' && Number(node.width) > 0 && Number(node.height) > 0;
}

function absolutePosition(node) {
  try {
    var t = node.absoluteTransform;
    return { x: t[0][2], y: t[1][2] };
  } catch (error) {
    return { x: Number(node.x) || 0, y: Number(node.y) || 0 };
  }
}

async function exportThumb(node) {
  /* Preview copies are capped at 256 px on the longer side. */
  try {
    var scale = 256 / Math.max(Number(node.width) || 1, Number(node.height) || 1);
    return await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: Math.max(0.01, Math.min(4, scale)) }
    });
  } catch (error) {
    return null;
  }
}

async function sendSelection() {
  var revision = ++selectionRevision;
  try { await ensurePage(); } catch (error) { /* Figma versions without loadAsync */ }
  var selected = [];
  try { selected = Array.prototype.slice.call(figma.currentPage.selection || []); } catch (error) { selected = []; }
  var eligibleNodes = selected.filter(eligible);
  var capped = eligibleNodes.length > VeerCore.MAX_IMAGES;
  var reason = eligibleNodes.length ? (capped ? 'capped' : null) : (selected.length ? 'unsupported' : 'empty');
  selectionSnapshot = eligibleNodes.slice(0, VeerCore.MAX_IMAGES);

  figma.ui.postMessage({
    type: 'selection',
    valid: eligibleNodes.length >= 1,
    count: eligibleNodes.length,
    capped: capped,
    reason: reason,
    items: selectionSnapshot.map(function (node) {
      return { id: node.id, name: node.name, type: node.type, width: node.width, height: node.height };
    })
  });

  var thumbs = await Promise.all(selectionSnapshot.map(exportThumb));
  if (revision !== selectionRevision) return;
  figma.ui.postMessage({
    type: 'selection-thumbs',
    items: selectionSnapshot.map(function (node, index) {
      return { id: node.id, bytes: thumbs[index] };
    })
  });
}

function getUserId() {
  return (async function () {
    try {
      if (figma.currentUser && figma.currentUser.id) return figma.currentUser.id;
    } catch (error) { /* currentUser can be unavailable in private plugins */ }
    var id = await figma.clientStorage.getAsync('veer_anon_id');
    if (!id) {
      id = 'anon-' + Math.random().toString(36).slice(2, 12);
      await figma.clientStorage.setAsync('veer_anon_id', id);
    }
    return id;
  })();
}

function cloneForFan(source) {
  var clone = source.clone();
  if (clone.type === 'INSTANCE' && typeof clone.detach_instance === 'function') {
    try { clone = clone.detach_instance(); } catch (error) { /* keep the instance */ }
  }
  return clone;
}

/* rescale() scales strokes, corner radii and effects together with geometry,
   matching how the PNG preview is built. */
function scaleClone(clone, factor, fallbackWidth, fallbackHeight) {
  try {
    if (typeof clone.rescale === 'function') { clone.rescale(factor); return; }
    clone.resizeWithoutConstraints(fallbackWidth, fallbackHeight);
  } catch (error) {
    try { clone.resizeWithoutConstraints(fallbackWidth, fallbackHeight); }
    catch (nested) { try { clone.resize(fallbackWidth, fallbackHeight); } catch (ignored) { /* unsupported node */ } }
  }
}

/* Places the node centre at (centerX, centerY) inside the parent and rotates it. */
function placeRotated(node, centerX, centerY, width, height, angle) {
  var radians = angle * Math.PI / 180;
  var cos = Math.cos(radians), sin = Math.sin(radians);
  try {
    node.relativeTransform = [
      [cos, -sin, centerX - cos * width / 2 + sin * height / 2],
      [sin, cos, centerY - sin * width / 2 - cos * height / 2]
    ];
  } catch (error) {
    node.x = centerX - width / 2;
    node.y = centerY - height / 2;
    try { node.rotation = angle; } catch (nested) { /* ignore */ }
  }
}

async function createFan(rawSettings) {
  await ensurePage();
  if (!selectionSnapshot.length || !selectionSnapshot.every(eligible)) {
    throw new Error('selection-changed');
  }

  var sources = selectionSnapshot.slice();
  var built = VeerCore.buildFan(rawSettings, sources);
  var settings = built.settings;

  var frame = figma.createFrame();
  frame.name = 'Veer · fan';
  frame.resize(Math.max(1, Math.ceil(built.bbox.width)), Math.max(1, Math.ceil(built.bbox.height)));
  frame.layoutMode = 'NONE';
  frame.clipsContent = false;
  frame.fills = [];
  frame.strokes = [];
  frame.setPluginData('veerSettings', JSON.stringify(settings));
  frame.setPluginData('veerVersion', '1');

  var sourcePosition = absolutePosition(sources[0]);
  var right = sources.reduce(function (max, node) {
    var pos = absolutePosition(node);
    return Math.max(max, pos.x + node.width);
  }, sourcePosition.x + sources[0].width);
  frame.x = right + 80;
  frame.y = sourcePosition.y;

  try {
    built.cards.forEach(function (card) {
      var source = sources[card.source];
      var sourceWidth = Number(source.width) || 1;
      var clone = cloneForFan(source);
      /* card.imageWidth is the source width × card scale × chaos factor. */
      var scale = card.imageWidth / sourceWidth;
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      scaleClone(clone, scale, sourceWidth * scale, (Number(source.height) || 1) * scale);
      clone.name = source.name;
      var centerX = card.x - built.bbox.x, centerY = card.y - built.bbox.y;

      if (card.crop) {
        /* A uniform card crops the clone with a frame of exactly the card size. */
        var cardFrame = figma.createFrame();
        frame.appendChild(cardFrame);
        cardFrame.resize(Math.max(0.5, card.width), Math.max(0.5, card.height));
        cardFrame.fills = [];
        cardFrame.strokes = [];
        cardFrame.clipsContent = true;
        cardFrame.name = VeerCore.namePrefix(card.slot) + source.name;
        cardFrame.appendChild(clone);
        clone.x = (cardFrame.width - clone.width) / 2;
        clone.y = (cardFrame.height - clone.height) / 2;
        placeRotated(cardFrame, centerX, centerY, cardFrame.width, cardFrame.height, card.angle);
      } else {
        frame.appendChild(clone);
        clone.name = VeerCore.namePrefix(card.slot) + source.name;
        placeRotated(clone, centerX, centerY, clone.width, clone.height, card.angle);
      }
    });
  } catch (error) {
    frame.remove();
    throw error;
  }

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  return { name: frame.name, width: frame.width, height: frame.height, settings: settings, count: built.cards.length };
}

figma.on('selectionchange', sendSelection);

figma.ui.onmessage = async function (message) {
  if (!message || !message.type) return;
  if (message.type === 'get-user') {
    figma.ui.postMessage({ type: 'user', id: await getUserId() });
    return;
  }
  if (message.type === 'cache-get') {
    var stored = null;
    try { stored = await figma.clientStorage.getAsync('veer_' + message.key); } catch (error) { /* ignore */ }
    figma.ui.postMessage({ type: 'cache-get', key: message.key, value: stored || null });
    return;
  }
  if (message.type === 'cache-set') {
    try { await figma.clientStorage.setAsync('veer_' + message.key, message.value); } catch (error) { /* ignore */ }
    return;
  }
  if (message.type === 'open-url') {
    try { figma.openExternal(message.url); } catch (error) { /* ignore */ }
    return;
  }
  if (message.type === 'refresh-selection') {
    await sendSelection();
    return;
  }
  if (message.type === 'create-fan') {
    try {
      var result = await createFan(message.settings || {});
      figma.ui.postMessage({ type: 'fan-created', result: result });
      figma.notify('Veer: веер создан');
    } catch (error) {
      figma.ui.postMessage({ type: 'fan-error', error: String(error && error.message || error) });
    }
  }
};

sendSelection();
