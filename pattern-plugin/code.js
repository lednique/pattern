/* Patternique — Figma document sandbox. */
'use strict';

/* Patternique shared placement math. Runs in Figma, the plugin UI and Node tests. */
'use strict';

var PatternCore = (function () {
  function clamp(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = min;
    return Math.min(max, Math.max(min, number));
  }

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function evenAtLeast(value, min, max) {
    var number = Math.round(clamp(value, min, max));
    if (number % 2) number += 1;
    return Math.min(max, number);
  }

  function normalizeSettings(input) {
    var source = input || {};
    var mode = ['grid', 'rotate', 'checker'].indexOf(source.mode) >= 0 ? source.mode : 'grid';
    var shiftMode = ['none', 'rows', 'columns', 'both'].indexOf(source.shiftMode) >= 0 ? source.shiftMode : 'none';
    var columns = Math.round(clamp(source.columns, 2, 20));
    var rows = Math.round(clamp(source.rows, 2, 20));

    // Alternating rows/columns and checkerboards need an even tile period so that
    // the generated frame can be duplicated edge-to-edge without a phase jump.
    if (mode === 'checker' || shiftMode === 'columns' || shiftMode === 'both') {
      columns = evenAtLeast(columns, 2, 20);
    }
    if (mode === 'checker' || shiftMode === 'rows' || shiftMode === 'both') {
      rows = evenAtLeast(rows, 2, 20);
    }

    var decoration = ['none', 'cross', 'star', 'circle', 'symbol', 'line'].indexOf(source.decoration) >= 0
      ? source.decoration : 'none';
    if (mode !== 'grid' || shiftMode !== 'none') decoration = 'none';

    return {
      mode: mode,
      checkerBehavior: source.checkerBehavior === 'variant' ? 'variant' : 'skip',
      columns: columns,
      rows: rows,
      cellWidth: Math.round(clamp(source.cellWidth, 32, 400)),
      cellHeight: Math.round(clamp(source.cellHeight, 32, 400)),
      size1: clamp(source.size1, 10, 180),
      size2: clamp(source.size2, 10, 180),
      rotation1: clamp(source.rotation1, -180, 180),
      rotation2: clamp(source.rotation2, -180, 180),
      rotationStep: clamp(source.rotationStep, -180, 180),
      color1: validHex(source.color1, '#11A5CA'),
      color2: validHex(source.color2, '#FF4F9A'),
      background: validHex(source.background, '#F4F8FB'),
      shiftMode: shiftMode,
      shiftX: clamp(source.shiftX, -100, 100),
      shiftY: clamp(source.shiftY, -100, 100),
      decoration: decoration,
      decorationColor: validHex(source.decorationColor, '#12202D'),
      decorationSize: clamp(source.decorationSize, 4, 100),
      symbol: String(source.symbol || '✦').slice(0, 8)
    };
  }

  function validHex(value, fallback) {
    var text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : fallback;
  }

  function variantAt(settings, row, column, objectCount) {
    var s = settings;
    var parity = mod(row + column, 2);
    var sourceIndex = 0;
    var visible = true;
    var useSecondStyle = false;

    if (s.mode === 'checker') {
      if (objectCount > 1) {
        sourceIndex = parity;
        useSecondStyle = parity === 1;
      } else if (s.checkerBehavior === 'skip') {
        visible = parity === 0;
      } else {
        useSecondStyle = parity === 1;
      }
    }

    var angle = useSecondStyle ? s.rotation2 : s.rotation1;
    if (s.mode === 'rotate') angle = s.rotation1 + (row + column) * s.rotationStep;

    return {
      visible: visible,
      sourceIndex: sourceIndex,
      second: useSecondStyle,
      size: useSecondStyle ? s.size2 : s.size1,
      color: useSecondStyle ? s.color2 : s.color1,
      angle: angle
    };
  }

  function placementAt(settings, row, column, objectCount) {
    var x = (column + 0.5) * settings.cellWidth;
    var y = (row + 0.5) * settings.cellHeight;
    if ((settings.shiftMode === 'rows' || settings.shiftMode === 'both') && mod(row, 2) === 1) {
      x += settings.cellWidth * settings.shiftX / 100;
    }
    if ((settings.shiftMode === 'columns' || settings.shiftMode === 'both') && mod(column, 2) === 1) {
      y += settings.cellHeight * settings.shiftY / 100;
    }
    // Overscan copies that cross a tile edge must use the style of the cell on
    // the opposite edge. This is especially important for rotation mode: the
    // two clipped halves then have exactly the same angle in adjacent tiles.
    var styleRow = mod(row, settings.rows);
    var styleColumn = mod(column, settings.columns);
    var variant = variantAt(settings, styleRow, styleColumn, objectCount);
    variant.x = x;
    variant.y = y;
    variant.row = row;
    variant.column = column;
    variant.styleRow = styleRow;
    variant.styleColumn = styleColumn;
    return variant;
  }

  function buildPlacements(input, objectCount) {
    var settings = normalizeSettings(input);
    var overscanX = settings.shiftMode === 'rows' || settings.shiftMode === 'both' ? 2 : 1;
    var overscanY = settings.shiftMode === 'columns' || settings.shiftMode === 'both' ? 2 : 1;
    var out = [];
    for (var row = -overscanY; row < settings.rows + overscanY; row++) {
      for (var column = -overscanX; column < settings.columns + overscanX; column++) {
        var item = placementAt(settings, row, column, objectCount || 1);
        if (item.visible) out.push(item);
      }
    }
    return { settings: settings, placements: out };
  }

  function hexToRgb(hex) {
    var safe = validHex(hex, '#000000');
    return {
      r: parseInt(safe.slice(1, 3), 16) / 255,
      g: parseInt(safe.slice(3, 5), 16) / 255,
      b: parseInt(safe.slice(5, 7), 16) / 255
    };
  }

  return {
    clamp: clamp,
    mod: mod,
    normalizeSettings: normalizeSettings,
    variantAt: variantAt,
    placementAt: placementAt,
    buildPlacements: buildPlacements,
    hexToRgb: hexToRgb
  };
})();

if (typeof module === 'object' && module.exports) module.exports = PatternCore;


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
