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
    var columns = Math.round(clamp(source.columns === undefined ? 4 : source.columns, 1, 20));
    var rows = Math.round(clamp(source.rows === undefined ? 4 : source.rows, 1, 20));
    var shiftEnabled = source.shiftEnabled === undefined
      ? (source.shiftMode ? source.shiftMode === 'both' : true)
      : (source.shiftEnabled === true || source.shiftEnabled === 'true' || source.shiftMode === 'both');
    var shiftX = clamp(source.shiftX === undefined ? 50 : source.shiftX, -100, 100);
    var shiftY = clamp(source.shiftY === undefined ? 0 : source.shiftY, -100, 100);
    var halfEligible = columns >= 3 || rows >= 3;
    var halfGrid = halfEligible && (source.halfGrid === true || source.halfGrid === 'true');
    var decorationChoice = ['none', 'cross', 'star', 'circle', 'symbol', 'line'].indexOf(source.decoration) >= 0
      ? source.decoration : 'star';
    var decoration = mode === 'checker' ? decorationChoice : 'none';

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
      size1: clamp(source.size1 === undefined ? 70 : source.size1, 10, 150),
      size2: clamp(source.size2 === undefined ? 40 : source.size2, 10, 150),
      rotation1: clamp(source.rotation1 === undefined ? 0 : source.rotation1, -180, 180),
      rotation2: clamp(source.rotation2 === undefined ? 180 : source.rotation2, -180, 180),
      rotationStep: clamp(source.rotationStep === undefined ? -15 : source.rotationStep, -180, 180),
      color1: validHex(source.color1, '#DEDD74'),
      color2: validHex(source.color2, '#A9A84C'),
      background: validHex(source.background, '#F8F8ED'),
      shiftEnabled: shiftEnabled,
      shiftMode: shiftEnabled ? 'both' : 'none',
      shiftX: shiftX,
      shiftY: shiftY,
      halfGrid: halfGrid,
      halfEligible: halfEligible,
      halfHorizontal: halfGrid && columns >= 3 && source.halfHorizontal !== false && source.halfHorizontal !== 'false',
      halfVertical: halfGrid && rows >= 3 && source.halfVertical !== false && source.halfVertical !== 'false',
      decoration: decoration,
      decorationChoice: decorationChoice,
      decorationColor: validHex(source.decorationColor, '#5E5D22'),
      decorationSize: clamp(source.decorationSize === undefined ? 25 : source.decorationSize, 4, 100),
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

    // Half-size grid behaves like negative padding for every container. The
    // complete existing grid is compressed to 50% around the tile center;
    // figure dimensions stay controlled by the regular cell and may overlap.
    if (settings.halfGrid && settings.halfHorizontal) x = TILE_SIZE / 2 + (x - TILE_SIZE / 2) * 0.5;
    if (settings.halfGrid && settings.halfVertical) y = TILE_SIZE / 2 + (y - TILE_SIZE / 2) * 0.5;
    if (settings.shiftEnabled && mod(row, 2) === 1) x += settings.cellWidth * settings.shiftX / 100;
    if (settings.shiftEnabled && mod(column, 2) === 1) y += settings.cellHeight * settings.shiftY / 100;

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
    var rowStart = settings.halfGrid && settings.halfVertical ? 0 : -overscan;
    var rowEnd = settings.halfGrid && settings.halfVertical ? settings.rows : settings.rows + overscan;
    var columnStart = settings.halfGrid && settings.halfHorizontal ? 0 : -overscan;
    var columnEnd = settings.halfGrid && settings.halfHorizontal ? settings.columns : settings.columns + overscan;
    var placements = [];
    for (var row = rowStart; row < rowEnd; row++) {
      for (var column = columnStart; column < columnEnd; column++) {
        var item = placementAt(settings, row, column, objectCount || 1);
        if (item.visible) placements.push(item);
      }
    }
    return { settings: settings, placements: placements };
  }

  function fitDimensions(sourceWidth, sourceHeight, settings, percent) {
    var safeWidth = Math.max(0.001, Number(sourceWidth) || 1);
    var safeHeight = Math.max(0.001, Number(sourceHeight) || 1);
    // Half-size grid changes placement density only. Every original and
    // midpoint repeat keeps the same figure dimensions as the regular grid.
    var maxWidth = settings.cellWidth * percent / 100;
    var maxHeight = settings.cellHeight * percent / 100;
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
