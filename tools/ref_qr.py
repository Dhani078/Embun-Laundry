"""Reference matrix dump (byte-mode forced) + bitstream for diffing against qrcode.js."""
import sys, os
import qrcode
from qrcode.util import MODE_8BIT_BYTE, create_data
from qrcode.main import QRCode

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

LEVELS = {'L': qrcode.ERROR_CORRECT_L, 'M': qrcode.ERROR_CORRECT_M,
          'Q': qrcode.ERROR_CORRECT_Q, 'H': qrcode.ERROR_CORRECT_H}

def ref(text, level='M'):
    qr = QRCode(version=None, error_correction=LEVELS[level], border=0)
    qr.add_data(text, mode=MODE_8BIT_BYTE)   # force byte mode -> match JS byte encoder
    qr.make(fit=True)
    mod = qr.modules
    n = len(mod)
    matrix = [1 if mod[i][j] else 0 for i in range(n) for j in range(n)]
    return {'size': n, 'matrix': matrix, 'version': qr.version,
            'mask': qr.mask_pattern, 'data': create_data(qr.version, LEVELS[level], qr.data_list)}

if __name__ == '__main__':
    os.makedirs('.tmp', exist_ok=True)
    for k, t in enumerate(['EMBUN-LND-2026-0917-0042',
                           'https://embun-laundry.dhanisepeda.workers.dev/track?code=AB12CD',
                           'Halo Embun! @#$% 123']):
        for lvl in ['M', 'L', 'Q', 'H']:
            r = ref(t, lvl)
            tag = f'.tmp/ref_{k}_{lvl}'
            with open(tag + '_matrix.txt', 'w') as f:
                f.write(f"{r['size']} v{r['version']} mask{r['mask']}\n")
                for i in range(r['size']):
                    f.write(''.join(str(r['matrix'][i * r['size'] + j]) for j in range(r['size'])) + '\n')
            with open(tag + '_data.txt', 'w') as f:
                f.write(','.join(str(b) for b in r['data']))
            print(f"[{k}] '{t[:32]}' level={lvl} -> v{r['version']} size={r['size']} mask={r['mask']} codewords={len(r['data'])}")
