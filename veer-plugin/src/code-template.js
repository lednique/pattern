/* Veer — Figma document sandbox. */
'use strict';

/*__VEER_CORE__*/

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
