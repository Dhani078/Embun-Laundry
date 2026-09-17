// Decisive isolation: feed PYTHON's reference codewords into OUR placement engine.
// If some mask matches the reference matrix exactly -> placement correct, bug is in
// our codeword stream. If none matches -> placement itself is wrong.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'qrcode.js'), 'utf8');
const sb = {};
eval(src.replace('typeof window !== \'undefined\' ? window : this', 'sb'));
const body = src.slice(src.indexOf('use strict') + 12, src.lastIndexOf('})(typeof'));
const fn = {};
eval('(function(global){' + body + '\nObject.assign(fn,{placeFinder,placeTiming,placeAlignment,isReserved,formatBits,versionBits,maskPenalty,MASKS});})(fn);');

const t = 'EMBUN-LND-2026-0917-0042', lvl = 'M';
const refRaw = fs.readFileSync(path.join(__dirname, '..', '.tmp', 'ref_0_M_matrix.txt'), 'utf8').trim().split('\n');
const n = +refRaw[0].split(' ')[0];
const ref = refRaw.slice(1).join('').split('').map(Number);
const data = fs.readFileSync(path.join(__dirname, '..', '.tmp', 'ref_0_M_data.txt'), 'utf8').split(',').map(Number);
const size = n;

const reserved = fn.isReserved(size, 2);
console.log('reserved cells:', reserved.filter(Boolean).length, ' data codewords:', data.length, ' bits:', data.length * 8);

for (let m = 0; m < 8; m++) {
  const mat = new Array(size * size).fill(0);
  fn.placeFinder(mat, size);
  fn.placeAlignment(mat, size, 2);
  fn.placeTiming(mat, size);
  const fmt = fn.formatBits(lvl, m);
  for (let i = 0; i < 15; i++) {
    const b = ((fmt >> i) & 1) ? 1 : 0;
    if (i < 6) mat[i * size + 8] = b;
    else if (i < 8) mat[(i + 1) * size + 8] = b;
    else mat[(size - 15 + i) * size + 8] = b;
    if (i < 8) mat[8 * size + (size - i - 1)] = b;
    else if (i < 9) mat[8 * size + (15 - i)] = b;
    else mat[8 * size + (15 - i - 1)] = b;
  }
  mat[(size - 8) * size + 8] = 1;
  // map_data with python data
  let inc = -1, row = size - 1, bit = 7, ci = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col <= 6) col--;
    while (true) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (!reserved[row * size + cc]) {
          let dark = false;
          if (ci < data.length) dark = ((data[ci] >> bit) & 1) === 1;
          if (fn.MASKS[m](row, cc)) dark = !dark;
          mat[row * size + cc] = dark ? 1 : 0;
          bit--;
          if (bit === -1) { ci++; bit = 7; }
        }
      }
      row += inc;
      if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
    }
  }
  let d = 0, first = -1;
  for (let i = 0; i < size * size; i++) if (mat[i] !== ref[i]) { d++; if (first < 0) first = i; }
  console.log(`mask ${m}: ${d} diffs` + (d ? ` first @ row ${Math.floor(first / size)} col ${first % size}` : ' EXACT MATCH'));
}
