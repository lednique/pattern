/* Patternique — Figma document sandbox. */
'use strict';

/*__PATTERN_CORE__*/

figma.showUI(__html__, { width: 400, height: 720, themeColors: false });

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
  try {
    return await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'WIDTH', value: 160 }
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
  var valid = selected.length >= 1 && selected.length <= 2 && selected.every(eligible);
  selectionSnapshot = valid ? selected.slice(0, 2) : [];

  if (!valid) {
    figma.ui.postMessage({
      type: 'selection',
      valid: false,
      count: selected.length,
      reason: selected.length > 2 ? 'too-many' : (selected.length ? 'unsupported' : 'empty'),
      items: []
    });
    return;
  }

  figma.ui.postMessage({
    type: 'selection', valid: true,
    items: selected.map(function (node) {
      return { id: node.id, name: node.name, type: node.type, width: node.width, height: node.height };
    })
  });

  var thumbs = await Promise.all(selected.map(exportThumb));
  if (revision !== selectionRevision) return;
  figma.ui.postMessage({
    type: 'selection-thumbs',
    items: selected.map(function (node, index) {
      return { id: node.id, bytes: thumbs[index] };
    })
  });
}

function getUserId() {
  return (async function () {
    try {
      if (figma.currentUser && figma.currentUser.id) return figma.currentUser.id;
    } catch (error) { /* currentUser can be unavailable in private plugins */ }
    var id = await figma.clientStorage.getAsync('patternique_anon_id');
    if (!id) {
      id = 'anon-' + Math.random().toString(36).slice(2, 12);
      await figma.clientStorage.setAsync('patternique_anon_id', id);
    }
    return id;
  })();
}

function copyPaintAsSolid(paints, rgb) {
  if (!Array.isArray(paints) || paints.length === 0) return paints;
  return paints.map(function (paint) {
    if (paint.visible === false) return paint;
    return { type: 'SOLID', color: rgb, opacity: paint.opacity === undefined ? 1 : paint.opacity, visible: true };
  });
}

function recolorTree(node, rgb) {
  try {
    if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills) && node.fills.length) {
      node.fills = copyPaintAsSolid(node.fills, rgb);
    }
  } catch (error) { /* readonly child in an instance */ }
  try {
    if ('strokes' in node && node.strokes !== figma.mixed && Array.isArray(node.strokes) && node.strokes.length) {
      node.strokes = copyPaintAsSolid(node.strokes, rgb);
    }
  } catch (error) { /* readonly child in an instance */ }
  if ('children' in node && node.children) {
    Array.prototype.slice.call(node.children).forEach(function (child) { recolorTree(child, rgb); });
  }
}

function cloneForPattern(source, parent) {
  var clone = source.clone();
  if (clone.type === 'INSTANCE' && typeof clone.detachInstance === 'function') {
    try { clone = clone.detachInstance(); } catch (error) { /* keep the instance */ }
  }
  parent.appendChild(clone);
  return clone;
}

function resizeProportionally(node, source, cellWidth, cellHeight, percent) {
  var available = Math.min(cellWidth, cellHeight) * percent / 100;
  var longest = Math.max(source.width, source.height);
  var factor = longest > 0 ? available / longest : 1;
  var width = Math.max(0.5, source.width * factor);
  var height = Math.max(0.5, source.height * factor);
  try {
    node.resizeWithoutConstraints(width, height);
  } catch (error) {
    try { node.resize(width, height); } catch (nested) { /* non-resizable nodes are filtered earlier */ }
  }
  return { width: Number(node.width) || width, height: Number(node.height) || height };
}

function placeAroundCenter(node, centerX, centerY, width, height, angle) {
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

function createRect(parent, x, y, width, height, color, angle) {
  var rect = figma.createRectangle();
  parent.appendChild(rect);
  rect.resize(Math.max(0.5, width), Math.max(0.5, height));
  rect.fills = [{ type: 'SOLID', color: color }];
  rect.strokes = [];
  placeAroundCenter(rect, x, y, rect.width, rect.height, angle || 0);
  rect.name = 'Intersection detail';
  return rect;
}

async function addDecoration(parent, kind, x, y, size, color, symbol, fontName) {
  if (kind === 'circle') {
    var ellipse = figma.createEllipse();
    parent.appendChild(ellipse);
    ellipse.resize(size, size);
    ellipse.fills = [{ type: 'SOLID', color: color }];
    ellipse.strokes = [];
    ellipse.x = x - size / 2;
    ellipse.y = y - size / 2;
    ellipse.name = 'Intersection · circle';
    return;
  }
  if (kind === 'star') {
    var star = figma.createStar();
    parent.appendChild(star);
    star.pointCount = 4;
    star.innerRadius = 0.2;
    star.resize(size, size);
    star.fills = [{ type: 'SOLID', color: color }];
    star.strokes = [];
    placeAroundCenter(star, x, y, star.width, star.height, 45);
    star.name = 'Intersection · four-point star';
    return;
  }
  if (kind === 'cross') {
    var thickness = Math.max(1, size * 0.16);
    createRect(parent, x, y, size, thickness, color, 45);
    createRect(parent, x, y, size, thickness, color, -45);
    return;
  }
  if (kind === 'line') {
    createRect(parent, x, y, size, Math.max(1, size * 0.12), color, -45);
    return;
  }
  if (kind === 'symbol') {
    var text = figma.createText();
    parent.appendChild(text);
    text.fontName = fontName;
    text.characters = symbol || '✦';
    text.fontSize = size;
    text.fills = [{ type: 'SOLID', color: color }];
    text.textAutoResize = 'WIDTH_AND_HEIGHT';
    text.x = x - text.width / 2;
    text.y = y - text.height / 2;
    text.name = 'Intersection · symbol';
  }
}

async function loadDecorationFont() {
  var preferred = { family: 'Inter', style: 'Regular' };
  try {
    await figma.loadFontAsync(preferred);
    return preferred;
  } catch (error) {
    var fonts = await figma.listAvailableFontsAsync();
    if (!fonts || !fonts.length) throw error;
    await figma.loadFontAsync(fonts[0].fontName);
    return fonts[0].fontName;
  }
}

async function createPattern(rawSettings) {
  await ensurePage();
  if (!selectionSnapshot.length || selectionSnapshot.length > 2 || !selectionSnapshot.every(eligible)) {
    throw new Error('selection-changed');
  }

  var sourceNodes = selectionSnapshot.slice();
  var built = PatternCore.buildPlacements(rawSettings, sourceNodes.length);
  var settings = built.settings;
  var width = settings.columns * settings.cellWidth;
  var height = settings.rows * settings.cellHeight;
  var frame = figma.createFrame();
  frame.name = 'Patternique · ' + (settings.mode === 'checker' ? 'checkerboard' : settings.mode === 'rotate' ? 'rotation' : 'grid');
  frame.resize(width, height);
  frame.layoutMode = 'NONE';
  frame.clipsContent = true;
  frame.fills = [{ type: 'SOLID', color: PatternCore.hexToRgb(settings.background) }];
  frame.strokes = [];
  frame.setPluginData('patterniqueSettings', JSON.stringify(settings));
  frame.setPluginData('patterniqueVersion', '1');

  var sourcePosition = absolutePosition(sourceNodes[0]);
  var right = sourceNodes.reduce(function (max, node) {
    var pos = absolutePosition(node);
    return Math.max(max, pos.x + node.width);
  }, sourcePosition.x + sourceNodes[0].width);
  frame.x = right + 80;
  frame.y = sourcePosition.y;

  try {
    built.placements.forEach(function (placement) {
      var source = sourceNodes[Math.min(placement.sourceIndex, sourceNodes.length - 1)];
      var clone = cloneForPattern(source, frame);
      clone.name = source.name + ' · repeat';
      recolorTree(clone, PatternCore.hexToRgb(placement.color));
      var dimensions = resizeProportionally(clone, source, settings.cellWidth, settings.cellHeight, placement.size);
      placeAroundCenter(clone, placement.x, placement.y, dimensions.width, dimensions.height, placement.angle);
    });

    if (settings.decoration !== 'none') {
      var fontName = null;
      if (settings.decoration === 'symbol') fontName = await loadDecorationFont();
      var color = PatternCore.hexToRgb(settings.decorationColor);
      for (var row = 0; row <= settings.rows; row++) {
        for (var column = 0; column <= settings.columns; column++) {
          await addDecoration(frame, settings.decoration, column * settings.cellWidth, row * settings.cellHeight,
            settings.decorationSize, color, settings.symbol, fontName);
        }
      }
    }
  } catch (error) {
    frame.remove();
    throw error;
  }

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  return { name: frame.name, width: width, height: height, settings: settings };
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
    try { stored = await figma.clientStorage.getAsync('patternique_' + message.key); } catch (error) { /* ignore */ }
    figma.ui.postMessage({ type: 'cache-get', key: message.key, value: stored || null });
    return;
  }
  if (message.type === 'cache-set') {
    try { await figma.clientStorage.setAsync('patternique_' + message.key, message.value); } catch (error) { /* ignore */ }
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
  if (message.type === 'create-pattern') {
    try {
      var result = await createPattern(message.settings || {});
      figma.ui.postMessage({ type: 'pattern-created', result: result });
      figma.notify('Patternique: узор создан');
    } catch (error) {
      figma.ui.postMessage({ type: 'pattern-error', error: String(error && error.message || error) });
    }
  }
};

sendSelection();
