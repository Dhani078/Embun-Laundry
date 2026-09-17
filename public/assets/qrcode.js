// public/assets/qrcode.js — SVG wrapper around qrcode-lib.js (Kazuhiko Arase, public domain).
// Hosted locally (no external request, service-worker friendly).
// API: QRCode.svg(text, { level='M', scale=4, border=2 }) -> SVG string
//       QRCode.encode(text, level) -> { size, matrix:Int8Array }  (for tooling)
(function (global) {
  'use strict';
  var LEVEL = { L: 1, M: 0, Q: 3, H: 2 };

  var QRLib = global.QRCode; // lib constructor (set by qrcode-lib.js)

  function makeModel(text, level) {
    // Internal model (minified as two-arg constructor); driven via a DOM-less
    // SVG renderer so it works in Workers/browsers without canvas.
    var q;
    global.__qrCapture = null;
    try {
      var holder = {
        appendChild: function (c) { if (c && c.tagName === 'svg') global.__qrCapture = c; },
        hasChildNodes: function () { return false; },
        removeChild: function () {}
      };
      var realCreate = global.document.createElementNS;
      global.document.createElementNS = function (ns, tag) {
        return { tagName: tag, _attrs: {}, _children: [],
          setAttribute: function (k, v) { this._attrs[k] = v; },
          setAttributeNS: function (n, k, v) { this._attrs[k] = v; },
          appendChild: function (c) { this._children.push(c); },
          hasChildNodes: function () { return this._children.length > 0; },
          removeChild: function () { this._children.pop(); } };
      };
      new QRLib(holder, { text: String(text), width: 1, height: 1, correctLevel: LEVEL[level] || 0 });
      q = global.__qrCapture;
    } finally {
      if (realCreate) global.document.createElementNS = realCreate;
      delete global.__qrCapture;
    }
    if (!q) return null;
    // rebuild matrix from the renderer's <use> children
    var n = parseInt(q._attrs.viewBox.split(' ')[2], 10);
    var matrix = new Array(n * n).fill(0);
    (q._children || []).forEach(function (ch) {
      if (ch.tagName === 'use') {
        var x = parseInt(ch._attrs.x, 10), y = parseInt(ch._attrs.y, 10);
        if (x >= 0 && y >= 0 && x < n && y < n) matrix[y * n + x] = 1;
      }
    });
    return { size: n, matrix: matrix };
  }

  function svg(text, opts) {
    opts = opts || {};
    var scale = opts.scale || 4;
    var border = (typeof opts.border === 'number') ? opts.border : 2;
    var m = makeModel(text, opts.level || 'M');
    if (!m) return '';
    var n = m.size, dim = (n + border * 2) * scale;
    var rects = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (m.matrix[r * n + c]) {
          rects += '<rect x="' + ((c + border) * scale) + '" y="' + ((r + border) * scale) +
                   '" width="' + scale + '" height="' + scale + '"/>';
        }
      }
    }
    return '<svg width="' + dim + '" height="' + dim + '" viewBox="0 0 ' + dim + ' ' + dim +
           '" shape-rendering="crispEdges" style="display:block;margin:0 auto;background:#fff">' +
           '<g fill="#0f172a">' + rects + '</g></svg>';
  }

  function encode(text, level) {
    return makeModel(text, level || 'M');
  }

  global.QRCode = { svg: svg, encode: encode };
})(typeof window !== 'undefined' ? window : this);
