/* Patternique shared placement math. Runs in Figma, the plugin UI and Node tests. */
'use strict';

var PatternCore = (function () {
  var TILE_SIZE = 256;

  function clamp(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = min;
    return Math.min(max, Math.max(min, number));
  }

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function validHex(value, fallback) {
    var text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : fallback;
  }

  function normalizeSettings(input) {
    var source = input || {};
    var mode = ['grid', 'rotate', 'checker'].indexOf(source.mode) >= 0 ? source.mode : 'grid';
    var columns = Math.round(clamp(source.columns, 1, 20));
    var rows = Math.round(clamp(source.rows, 1, 20));
    var shiftEnabled = source.shiftEnabled === true || source.shiftEnabled === 'true' || source.shiftMode === 'both';
    var shiftX = clamp(source.shiftX, -100, 100);
    var shiftY = clamp(source.shiftY, -100, 100);
    var halfEligible = columns >= 3 || rows >= 3;
    var halfGrid = halfEligible && (source.halfGrid === true || source.halfGrid === 'true');
    var decoration = ['none', 'cross', 'star', 'circle', 'symbol', 'line'].indexOf(source.decoration) >= 0
      ? source.decoration : 'none';

    // Intersection elements remain available in rotation and checker modes. They
    // are disabled only while a real alternating offset is applied. A checked
    // offset with both values at zero is still an ordinary intersecting grid.
    if (shiftEnabled && (Math.abs(shiftX) > 0.0001 || Math.abs(shiftY) > 0.0001)) decoration = 'none';

    var checkerLayout = Number(source.checkerLayout || (source.checkerBehavior === 'variant' ? 2 : 1)) === 2 ? 2 : 1;
    return {
      tileSize: TILE_SIZE,
      mode: mode,
      checkerLayout: checkerLayout,
      checkerBehavior: checkerLayout === 2 ? 'variant' : 'skip',
      columns: columns,
      rows: rows,
      cellWidth: TILE_SIZE / columns,
      cellHeight: TILE_SIZE / rows,
      size1: clamp(source.size1, 10, 180),
      size2: clamp(source.size2, 10, 180),
      rotation1: clamp(source.rotation1, -180, 180),
      rotation2: clamp(source.rotation2, -180, 180),
      rotationStep: clamp(source.rotationStep, -180, 180),
      color1: validHex(source.color1, '#DEDD74'),
      color2: validHex(source.color2, '#A9A84C'),
      background: validHex(source.background, '#F8F8ED'),
      shiftEnabled: shiftEnabled,
      shiftMode: shiftEnabled ? 'both' : 'none',
      shiftX: shiftX,
      shiftY: shiftY,
      halfGrid: halfGrid,
      halfEligible: halfEligible,
      halfHorizontal: halfGrid && source.halfHorizontal !== false && source.halfHorizontal !== 'false',
      halfVertical: halfGrid && source.halfVertical !== false && source.halfVertical !== 'false',
      decoration: decoration,
      decorationColor: validHex(source.decorationColor, '#5E5D22'),
      decorationSize: clamp(source.decorationSize, 4, 100),
      symbol: String(source.symbol || '✦').slice(0, 8)
    };
  }

  function variantAt(settings, row, column, objectCount) {
    var parity = mod(row + column, 2);
    var sourceIndex = 0;
    var visible = true;
    var useSecondStyle = false;

    if (settings.mode === 'checker') {
      if (settings.checkerLayout === 1) {
        visible = parity === 0;
      } else {
        sourceIndex = objectCount > 1 ? parity : 0;
        useSecondStyle = parity === 1;
      }
    }

    var angle = useSecondStyle ? settings.rotation2 : settings.rotation1;
    if (settings.mode === 'rotate') angle = settings.rotation1 + (row + column) * settings.rotationStep;

    return {
      visible: visible,
      sourceIndex: sourceIndex,
      second: useSecondStyle,
      size: useSecondStyle ? settings.size2 : settings.size1,
      color: useSecondStyle ? settings.color2 : settings.color1,
      angle: angle
    };
  }

  function placementAt(settings, row, column, objectCount) {
    var x = (column + 0.5) * settings.cellWidth;
    var y = (row + 0.5) * settings.cellHeight;
    if (settings.shiftEnabled && mod(row, 2) === 1) x += settings.cellWidth * settings.shiftX / 100;
    if (settings.shiftEnabled && mod(column, 2) === 1) y += settings.cellHeight * settings.shiftY / 100;

    // Overscan copies use the style of the opposite edge, so both clipped halves
    // of a rotated or checkerboard object remain identical in adjacent tiles.
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
    var overscan = settings.shiftEnabled ? 2 : 1;
    var placements = [];
    for (var row = -overscan; row < settings.rows + overscan; row++) {
      for (var column = -overscan; column < settings.columns + overscan; column++) {
        var item = placementAt(settings, row, column, objectCount || 1);
        if (item.visible) placements.push(item);
      }
    }
    return { settings: settings, placements: placements };
  }

  function fitDimensions(sourceWidth, sourceHeight, settings, percent) {
    var safeWidth = Math.max(0.001, Number(sourceWidth) || 1);
    var safeHeight = Math.max(0.001, Number(sourceHeight) || 1);
    var effectivePercent = settings.halfGrid ? Math.min(Number(percent) || 100, 100) : percent;
    var maxWidth = settings.cellWidth * (settings.halfHorizontal ? 2 / 3 : 1) * effectivePercent / 100;
    var maxHeight = settings.cellHeight * (settings.halfVertical ? 2 / 3 : 1) * effectivePercent / 100;
    var factor = Math.min(maxWidth / safeWidth, maxHeight / safeHeight);
    return {
      width: Math.max(0.5, safeWidth * factor),
      height: Math.max(0.5, safeHeight * factor),
      factor: factor
    };
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
    TILE_SIZE: TILE_SIZE,
    clamp: clamp,
    mod: mod,
    normalizeSettings: normalizeSettings,
    variantAt: variantAt,
    placementAt: placementAt,
    buildPlacements: buildPlacements,
    fitDimensions: fitDimensions,
    hexToRgb: hexToRgb
  };
})();

if (typeof module === 'object' && module.exports) module.exports = PatternCore;
