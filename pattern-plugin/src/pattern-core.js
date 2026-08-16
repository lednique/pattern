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
