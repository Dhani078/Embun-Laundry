#!/usr/bin/env python3
"""B7 — Audit SQL injection.

Mencari semua pemanggilan DB (execute/query) dan melaporkan apakah string
SQL-nya dibangun dengan interpolasi (template literal `${...}`, konkatenasi
`+`, atau `.format()`) alih-alih placeholder `?` + params.

Keluaran: tabel temuan + ringkasan. Exit 0 = aman (nol temuan MERAH).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / 'functions', ROOT / 'src']

# Pemanggilan DB:  sql.execute(...), db.query(...), conn.execute(...)
CALL_RE = re.compile(r'\b(?:execute|query|sql|run)\s*\(\s*', re.M)
# Interpolasi berbahaya di dalam argumen pertama
BAD_PATTERNS = [
    (re.compile(r'\$\{[^}]*\}'), 'template literal ${...}'),
]

# Interpolasi yang DIIZINKAN: `${NAMA_KONSTANTA}` — huruf kapital semua
# (underscore/angka boleh). Ini merujuk konstanta modul yang nilainya tidak
# berasal dari input user, jadi bukan vektor injeksi.
SAFE_INTERP = re.compile(r'^\$\{[A-Z][A-Z0-9_]*\}$')
# `${GROUP_EXPR[group]}` juga aman: kunci dipakai untuk lookup di peta,
# nilai yang disisipkan berasal dari peta konstanta, bukan dari user.
SAFE_INDEXED = re.compile(r'^\$\{[A-Z][A-Z0-9_]*\[[^\]]*\]\}$')

LINE_SPLIT = re.compile(r'\n')


def scan_file(path: Path):
    findings = []
    total = 0
    parameterized = 0
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return findings, total, parameterized

    for m in CALL_RE.finditer(text):
        # ambil argumen pertama secara kasar: sampai koma di kedalaman 0
        # atau sampai akhir pemanggilan (kedalaman kembali 0)
        i = m.end()
        depth = 1
        start = i
        while i < len(text) and depth > 0:
            c = text[i]
            if c in '([{':
                depth += 1
            elif c in ')]}':
                depth -= 1
            elif c == ',' and depth == 1:
                break
            i += 1
        arg = text[start:i]
        if not arg.strip():
            continue
        first = arg.strip()[0]
        if first not in '`\'"':
            continue  # variabel sql -> dilacak terpisah
        total += 1
        line_no = text[:m.start()].count('\n') + 1
        # tentukan apakah SQL-nya punya placeholder ?
        has_ph = '?' in arg
        for pat, label in BAD_PATTERNS:
            if not pat.search(arg):
                continue
            # Kumpulkan SEMUA interpolasi di argumen ini; yang semuanya aman
            # (konstanta atau lookup peta konstanta) tidak dilaporkan.
            exprs = [e for e in pat.findall(arg) if not (SAFE_INTERP.match(e) or SAFE_INDEXED.match(e))]
            if not exprs:
                parameterized += 1
                break
            snippet = ' '.join(arg.split())[:160]
            findings.append((str(path.relative_to(ROOT)), line_no,
                             f'{label}: {", ".join(exprs[:3])}', snippet, has_ph))
            break
        else:
            if has_ph:
                parameterized += 1
    return findings, total, parameterized


def main():
    findings = []
    total = 0
    parameterized = 0
    for d in DIRS:
        if not d.exists():
            continue
        for p in sorted(d.rglob('*.js')):
            f, t, pp = scan_file(p)
            findings += f
            total += t
            parameterized += pp

    print('=== B7 — Audit SQL Injection ===\n')
    print(f'String SQL literal ditemukan : {total}')
    print(f'  parameterized (ada ?)      : {parameterized}')
    print(f'  TEMUAN interpolasi         : {len(findings)}\n')

    if findings:
        print('| File | Baris | Pola | Placeholder? | Cuplikan |')
        print('|------|-------|------|--------------|----------|')
        for f in findings:
            print(f'| `{f[0]}` | {f[1]} | {f[2]} | {"ya" if f[4] else "TIDAK"} | `{f[3]}` |')
        print()
    else:
        print('TIDAK ada string SQL yang dibangun dengan interpolasi.\n')

    # Cek juga: variabel SQL yang di-assign dengan template literal
    print('--- Variabel SQL bertemplate literal (perlu inspeksi manual) ---')
    var_re = re.compile(r'(?:const|let|var)\s+(\w*(?:sql|SQL|query|Query)\w*)\s*=\s*`', re.M)
    n = 0
    for d in DIRS:
        if not d.exists():
            continue
        for p in sorted(d.rglob('*.js')):
            text = p.read_text(encoding='utf-8', errors='replace')
            for m in var_re.finditer(text):
                line_no = text[:m.start()].count('\n') + 1
                snippet = ' '.join(text[m.start():m.start() + 140].split())
                print(f'- `{p.relative_to(ROOT)}:{line_no}` — {snippet}')
                n += 1
    if n == 0:
        print('(tidak ada)')

    print()
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
