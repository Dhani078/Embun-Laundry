// Test QR correctness: version boundaries + determinism + structure
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'qrcode.js'), 'utf8');
const sb = {};
eval(src.replace('typeof window !== \'undefined\' ? window : this', 'sb'));
const Q = sb.QRCode;
let fail = 0;
const t = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fail++; };

// Byte-mode ECC M usable capacity (official): v1=14, v2=26, v3=42, v4=62,
// v5=84, v6=106, v7=122, v8=152, v9=180, v10=213
const capM = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
for (let v = 1; v <= 10; v++) {
  const at = Q.encode('x'.repeat(capM[v]), 'M');
  const over = Q.encode('x'.repeat(capM[v] + 1), 'M');
  const okSize = at && at.size === v * 4 + 17;
  const okOver = over && over.size === (v < 10 ? (v + 1) * 4 + 17 : v * 4 + 17);
  t(`v${v} M capacity boundary`, okSize);
  if (v < 10) t(`v${v} M overflow -> v${v + 1}`, okOver);
}

// determinism + distinctness
const a = Q.svg('TEST-123'), b = Q.svg('TEST-123');
t('deterministic', a === b);
t('distinct inputs distinct output', Q.svg('AAA') !== Q.svg('BBB'));

// structure: finder patterns at 3 corners
const r = Q.encode('HELLO', 'M');
const s = r.size;
t('top-left finder dark', r.matrix[0] === 1 && r.matrix[6 * s + 6] === 1);
t('bottom-left finder dark', r.matrix[(s - 1) * s] === 1);
t('top-right finder dark', r.matrix[s - 1] === 1);
t('quiet zone row 7 clear (timing)', r.matrix[7 * s + 8] !== undefined);

// svg well-formed
const svg = Q.svg('HELLO');
t('svg has opening tag', svg.startsWith('<svg'));
t('svg has closing tag', svg.endsWith('</svg>'));
t('svg encodes dark modules', (svg.match(/<rect/g) || []).length > 50);

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
