// public/assets/qrcode.js — QR Code generator (Mode 2, byte mode), zero dependency.
// Output: SVG string. Correctness targets Model 2 QR with auto mask selection
// and Reed-Solomon block interleaving. ~200 lines, no external lib.
//
// Ponytail: tidak mendukung ECI / structured append / kanji. Cukup untuk
// encode order_code, URL, dan teks pendek. Upgrade: ganti ke `qrcode` npm.

(function (global) {
  'use strict';

  // TABLE columns are ordered [L, M, Q, H] (index 0..3).
  // QR format-info indicator differs: L=1, M=0, Q=3, H=2 (per QR spec).
  const ECC = { L: 0, M: 1, Q: 2, H: 3 };
  const FMT_INDICATOR = { L: 1, M: 0, Q: 3, H: 2 };

  // GF(256) tables
  const EXP = new Array(256), LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    EXP[255] = EXP[0];
  })();
  const gfMul = (a, b) => (a && b) ? EXP[(LOG[a] + LOG[b]) % 255] : 0;

  // Generator polynomial for `n` ecc codewords
  function rsGen(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  // RS encode matching qrcode lib's Polynomial division (little-endian).
  // eccLen codewords returned in transmission order (high power first).
  function rsEncode(data, eccLen) {
    const gen = rsGen(eccLen);
    // Little-endian buffer: data padded to data.length + eccLen slots.
    const buf = data.concat(new Array(eccLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      const factor = buf[i];
      if (factor !== 0) {
        for (let j = 1; j < gen.length; j++) {
          buf[i + j] ^= gfMul(gen[j], factor);
        }
      }
    }
    return buf.slice(data.length);
  }

  // --- QR table (version 1..10, byte mode, ECC L/M/Q/H) ---
  // [totalCodewords, ecPerBlock, blocksGroup1, dataPerBlockG1, blocksGroup2, dataPerBlockG2]
  const TABLE = {
    1: [[26, 7, 1, 19, 0, 0], [26, 10, 1, 16, 0, 0], [26, 13, 1, 13, 0, 0], [26, 17, 1, 9, 0, 0]],
    2: [[44, 10, 1, 34, 0, 0], [44, 16, 1, 28, 0, 0], [44, 22, 1, 22, 0, 0], [44, 28, 1, 16, 0, 0]],
    3: [[70, 15, 1, 55, 0, 0], [70, 26, 1, 44, 0, 0], [70, 18, 2, 17, 0, 0], [70, 22, 2, 13, 0, 0]],
    4: [[100, 20, 1, 80, 0, 0], [100, 18, 2, 32, 0, 0], [100, 26, 2, 24, 0, 0], [100, 16, 4, 9, 0, 0]],
    5: [[134, 26, 1, 108, 0, 0], [134, 24, 2, 43, 0, 0], [134, 18, 2, 15, 2, 16], [134, 22, 2, 11, 2, 12]],
    6: [[172, 18, 2, 68, 0, 0], [172, 16, 4, 27, 0, 0], [172, 24, 4, 19, 0, 0], [172, 28, 4, 15, 0, 0]],
    7: [[196, 20, 2, 78, 0, 0], [196, 18, 4, 31, 0, 0], [196, 18, 2, 14, 4, 15], [196, 26, 4, 13, 1, 14]],
    8: [[242, 24, 2, 97, 0, 0], [242, 22, 2, 38, 2, 39], [242, 22, 4, 18, 2, 19], [242, 26, 4, 14, 2, 15]],
    9: [[292, 30, 2, 116, 0, 0], [292, 22, 3, 36, 2, 37], [292, 20, 4, 16, 4, 17], [292, 24, 4, 12, 4, 13]],
    10: [[346, 18, 2, 68, 2, 69], [346, 26, 4, 43, 1, 44], [346, 24, 6, 19, 2, 20], [346, 28, 6, 15, 2, 16]]
  };

  const ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

  // Usable byte capacity: total data codewords minus mode+count header.
  // Byte-mode header = 4 bits + 8 bits length for v1-9, 16 bits for v10+.
  function capacity(ver, level) {
    const c = TABLE[ver][ECC[level]];
    const total = c[2] * c[3] + c[4] * c[5];
    const headerBytes = ver < 10 ? 2 : 3;
    return total - headerBytes;
  }

  function pickVersion(byteLen, level) {
    for (let v = 1; v <= 10; v++) {
      if (capacity(v, level) >= byteLen) return v;
    }
    return null;
  }

  function maskPenalty(matrix, size) {
    let p = 0;
    // rule 1: runs of 5+
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (matrix[i * size + j] === matrix[i * size + j - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
    }
    for (let j = 0; j < size; j++) {
      let run = 1;
      for (let i = 1; i < size; i++) {
        if (matrix[i * size + j] === matrix[(i - 1) * size + j]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
    }
    // rule 2: 2x2 blocks
    for (let i = 0; i < size - 1; i++) for (let j = 0; j < size - 1; j++) {
      const a = matrix[i * size + j];
      if (a === matrix[i * size + j + 1] && a === matrix[(i + 1) * size + j] && a === matrix[(i + 1) * size + j + 1]) p += 3;
    }
    // rule 3: finder-like pattern
    const pat = [[1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1], [0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1]];
    for (let i = 0; i < size; i++) for (let j = 0; j + 11 <= size; j++) {
      for (const pp of pat) {
        let ok = true;
        for (let k = 0; k < 11; k++) if (matrix[i * size + j + k] !== pp[k]) { ok = false; break; }
        if (ok) p += 40;
      }
    }
    for (let j = 0; j < size; j++) for (let i = 0; i + 11 <= size; i++) {
      for (const pp of pat) {
        let ok = true;
        for (let k = 0; k < 11; k++) if (matrix[(i + k) * size + j] !== pp[k]) { ok = false; break; }
        if (ok) p += 40;
      }
    }
    // rule 4: dark module ratio
    let dark = 0;
    for (let i = 0; i < size * size; i++) if (matrix[i] === 1) dark++;
    const pct = (dark * 100) / (size * size);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  const MASKS = [
    (i, j) => (i + j) % 2 === 0,
    (i, j) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
  ];

  function placeFinder(m, size) {
    const draw = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inH = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6));
        const inC = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[rr * size + cc] = (inH || inC) ? 1 : 0;
      }
    };
    draw(0, 0); draw(0, size - 7); draw(size - 7, 0);
  }

  function placeTiming(m, size) {
    for (let i = 8; i < size - 8; i++) {
      m[6 * size + i] = i % 2 === 0 ? 1 : 0;
      m[i * size + 6] = i % 2 === 0 ? 1 : 0;
    }
  }

  function placeAlignment(m, size, ver) {
    const pos = ALIGN[ver];
    if (!pos) return;
    for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      const r = pos[i], c = pos[j];
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const val = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
        m[(r + dr) * size + (c + dc)] = val;
      }
    }
  }

  function isReserved(m, size, ver) {
    const reserved = new Array(size * size).fill(false);
    const mark = (r, c) => { if (r >= 0 && r < size && c >= 0 && c < size) reserved[r * size + c] = true; };
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      mark(i, j); mark(i, size - 7 + j); mark(size - 7 + i, j);
    }
    for (let i = 8; i < size - 8; i++) { mark(6, i); mark(i, 6); }
    const pos = ALIGN[ver] || [];
    for (const r of pos) for (const c of pos) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
    // format info areas
    for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
    mark(8, size - 8); mark(size - 8, 8);
    for (let i = size - 7; i < size; i++) mark(8, i);
    for (let i = size - 7; i < size; i++) mark(i, 8);
    // version info (v>=7)
    if (ver >= 7) {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        marked: { }
        mark(i, size - 11 + j); mark(size - 11 + j, i);
      }
    }
    return reserved;
  }

  // BCH(15,5) format encoding
  function formatBits(level, mask) {
    let data = (FMT_INDICATOR[level] << 3) | mask;
    let d = data << 10;
    for (let i = 4; i >= 0; i--) if ((d >> (i + 10)) & 1) d ^= 0x537 << i;
    return ((data << 10) | d) ^ 0x5412;
  }

  function versionBits(ver) {
    if (ver < 7) return null;
    let d = ver << 12;
    for (let i = 5; i >= 0; i--) if ((d >> (i + 12)) & 1) d ^= 0x1f25 << i;
    return (ver << 12) | d;
  }

  function bitStream(bytes, ver, level) {
    const c = TABLE[ver][ECC[level]];
    const totalData = c[2] * c[3] + c[4] * c[5];
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4);               // byte mode
    push(bytes.length, ver < 10 ? 8 : 16);
    for (const b of bytes) push(b, 8);
    const total = totalData * 8;
    push(0, Math.min(4, total - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    for (let i = 0; bits.length < total; i++) bits.push((i & 1) ? 0b00010001 : 0b11101100);
    // to codewords
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      cw.push(v);
    }
    // split into blocks
    const blocks = [];
    let idx = 0;
    for (let g = 0; g < c[2]; g++) { blocks.push(cw.slice(idx, idx + c[3])); idx += c[3]; }
    for (let g = 0; g < c[4]; g++) { blocks.push(cw.slice(idx, idx + c[5])); idx += c[5]; }
    // ecc per block
    const eccBlocks = blocks.map(b => rsEncode(b, c[1]));
    // interleave
    const out = [];
    const maxLen = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < c[1]; i++) for (const b of eccBlocks) out.push(b[i]);
    return out;
  }

  function encode(text, level) {
    level = level || 'M';
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 0x80) bytes.push(code);
      else {
        const enc = unescape(encodeURIComponent(text.charAt(i)));
        for (let k = 0; k < enc.length; k++) bytes.push(enc.charCodeAt(k));
      }
    }
    const ver = pickVersion(bytes.length, level);
    if (!ver) return null;
    const size = ver * 4 + 17;
    const codewords = bitStream(bytes, ver, level);

    const reserved = isReserved(null, size, ver);
    // build base matrix with function patterns
    const base = new Array(size * size).fill(0);
    placeFinder(base, size);
    placeTiming(base, size);
    placeAlignment(base, size, ver);

    // try all masks, pick lowest penalty
    let best = null, bestPen = Infinity;
    for (let m = 0; m < 8; m++) {
      const mat = base.slice();
      const fmt = formatBits(level, m);
      const res = reserved;
      // place data zigzag
      let ci = 0, bit = 7, dir = -1;
      let col = size - 1;
      while (col > 0) {
        if (col === 6) col--;
        for (let row = dir === -1 ? size - 1 : 0; row >= 0 && row < size; row += dir) {
          for (let c = 0; c < 2; c++) {
            const cc = col - c;
            if (res[row * size + cc]) continue;
            const byte = codewords[ci];
            const v = (byte >> bit) & 1;
            if (MASKS[m](row, cc)) mat[row * size + cc] = v ^ 1;
            else mat[row * size + cc] = v;
            bit--;
            if (bit < 0) { bit = 7; ci++; }
          }
        }
        col -= 2;
        dir = -dir;
      }
      // place format bits — 15 bits (bit0 = LSB), written vertically in
      // column 8 and horizontally in row 8, per QR spec.
      const fb = fmt;
      for (let i = 0; i < 15; i++) {
        const b = (fb >> i) & 1;
        // vertical, column 8
        if (i < 6) mat[i * size + 8] = b;
        else if (i < 8) mat[(i + 1) * size + 8] = b;
        else mat[(size - 15 + i) * size + 8] = b;
        // horizontal, row 8
        if (i < 8) mat[8 * size + (size - i - 1)] = b;
        else if (i === 8) mat[8 * size + 7] = b;
        else mat[8 * size + (15 - i - 1)] = b;
      }
      // fixed dark module
      mat[(size - 8) * size + 8] = 1;
      // version info
      const vb = versionBits(ver);
      if (vb !== null) {
        for (let i = 0; i < 18; i++) {
          const b = (vb >> i) & 1;
          const r = Math.floor(i / 3), c = i % 3;
          mat[r * size + (size - 11 + c)] = b;
          mat[(size - 11 + c) * size + r] = b;
        }
      }
      const pen = maskPenalty(mat, size);
      if (pen < bestPen) { bestPen = pen; best = mat; }
    }
    return { size, matrix: best };
  }

  function svg(text, opts) {
    opts = opts || {};
    const level = opts.level || 'M';
    const border = opts.border !== undefined ? opts.border : 2;
    const scale = opts.scale || 1;
    const dark = opts.dark || '#0f172a';
    const light = opts.light || '#ffffff';
    const r = encode(text, level);
    if (!r) return '';
    const s = r.size;
    const dim = (s + border * 2) * scale;
    let rects = '';
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
      if (r.matrix[i * s + j]) rects += `<rect x="${j * scale}" y="${i * scale}" width="${scale}" height="${scale}" fill="${dark}"/>`;
    }
    return `<svg width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" style="display:block;margin:0 auto;"><rect width="${dim}" height="${dim}" fill="${light}"/><g transform="translate(${border * scale},${border * scale})">${rects}</g></svg>`;
  }

  global.QRCode = { encode, svg };
})(typeof window !== 'undefined' ? window : this);
