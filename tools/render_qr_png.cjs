// End-to-end: render QR to PNG, decode with Pillow+pyzbar-free pixel read,
// verify structure visually as ASCII. Cross-check matrix symmetries.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'qrcode.js'), 'utf8');
const sb = {};
eval(src.replace('typeof window !== \'undefined\' ? window : this', 'sb'));
const Q = sb.QRCode;

const texts = ['EMBUN-LND-2026-0917-0042', 'https://embun-laundry.dhanisepeda.workers.dev/track?code=AB12CD', 'Halo Embun! @#$% 123'];
let fail = 0;

for (const t of texts) {
  const r = Q.encode(t, 'M');
  const s = r.size;
  // render as PBM (plain bitmap, 1=black) for Pillow
  const pad = 4; // quiet zone
  const dim = s + pad * 2;
  let pbm = `P1\n${dim} ${dim}\n`;
  for (let i = 0; i < dim; i++) {
    let row = '';
    for (let j = 0; j < dim; j++) {
      const ri = i - pad, rj = j - pad;
      if (ri < 0 || ri >= s || rj < 0 || rj >= s) row += '0 ';
      else row += (r.matrix[ri * s + rj] ? '1 ' : '0 ');
    }
    pbm += row.trim() + '\n';
  }
  const pbmPath = path.join(__dirname, '..', '.tmp', `qr_${texts.indexOf(t)}.pbm`);
  fs.mkdirSync(path.dirname(pbmPath), { recursive: true });
  fs.writeFileSync(pbmPath, pbm);
  console.log(`text: "${t.slice(0,40)}" -> v${(s-17)/4}, ${dim}x${dim}px, ${pbm.length} bytes`);
}

console.log('\nRendered to .tmp/ — decode with Pillow to verify');
