// Compare our QR matrix against the Python `qrcode` reference for the same input.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'qrcode.js'), 'utf8');
const sb = {};
eval(src.replace('typeof window !== \'undefined\' ? window : this', 'sb'));
const Q = sb.QRCode;

const text = 'EMBUN-LND-2026-0917-0042';
const ours = Q.encode(text, 'M');
fs.writeFileSync(path.join(__dirname, '..', '.tmp', 'ours_matrix.txt'),
  ours.size + '\n' + Array.from({ length: ours.size }, (_, i) =>
    Array.from({ length: ours.size }, (_, j) => ours.matrix[i * ours.size + j] ? '1' : '0').join('')
  ).join('\n'));
console.log('ours:', ours.size, 'x', ours.size, 'written');
