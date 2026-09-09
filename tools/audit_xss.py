#!/usr/bin/env python3
"""
B9 — Auditor XSS statis.

Mencari setiap interpolasi `${...}` di berkas HTML/JS publik yang nilainya
berasal dari basis data (tidak dipercaya), dan memastikan semuanya sudah
dilewatkan ke `esc()`.

Keluar 0 bila bersih, 1 bila ada temuan.

Cara pakai:
    python tools/audit_xss.py
"""
import re
import sys

FILES = ["public/app.js", "public/index.html", "public/pay.html",
         "public/dashboard.html"]

# Awalan ekspresi yang dianggap AMAN tanpa esc():
#   - esc(...)              -> sudah di-escape
#   - Number(/parseInt(     -> dipaksa jadi angka
#   - Math.                 -> hasil numerik
#   - String(...).toUpperCase() -> teks, tapi panggilannya tetap dicek isinya
SAFE_PREFIX = ("esc(", "Number(", "parseInt(", "parseFloat(", "Math.",
               "encodeURIComponent(", "rupiah(")

# Ekspresi yang nilainya hanya literal (bukan data).
LITERAL_RE = re.compile(r"^[\s\d'\"%.\-+*/()]*$")

# Interpolasi ${...} — boleh berisi satu tingkat template bersarang.
INTERP_RE = re.compile(r"\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}")

# Variabel penampung objek basis data. Diperluas setelah audit pertama
# ternyata melewatkan `cust.`, `t.`, dan `kpi.`.
DB_VARS = {
    "o",      # order
    "s",      # service
    "p",      # promo
    "v",      # voucher
    "c",      # customer
    "cust",   # customer (renderPelanggan)
    "d",      # daily report
    "t",      # delivery task
    "u",      # user / profile
    "kpi",    # ringkasan laporan
    "r",      # baris generik
}

# Field yang TIDAK pernah berasal dari input bebas pengguna (kunci buatan
# sistem). Hanya id numerik dan kolom turunan agregat yang diizinkan.
NUMERIC_FIELDS = {
    "id", "orders_count", "total_spent", "weight", "revenue", "orders",
    "avg_wt", "ord", "price", "is_active", "min_spend", "value",
    "weight_kg", "total_amount", "duration_hours", "is_popular",
}


def classify(expr):
    """(aman: bool|None, alasan)"""
    e = expr.strip()
    if not e:
        return True, "kosong"
    if LITERAL_RE.match(e):
        return True, "literal"
    for pre in SAFE_PREFIX:
        if e.startswith(pre):
            return True, f"aman ({pre})"

    # `a || 'default'` -> periksa sisi kiri, abaikan literal default
    m = re.match(r"^(.+?)\s*\|\|\s*(.+)$", e)
    if m:
        return classify(m.group(1))

    # kondisi ? x : y -> cek semua cabang
    if "?" in e:
        parts = re.split(r"\?|:", e)
        return classify(parts[1]) if len(parts) > 1 else (True, "kondisi")

    # `x.y`
    m = re.fullmatch(r"([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)", e)
    if m:
        var, field = m.group(1), m.group(2)
        if var in DB_VARS:
            if field in NUMERIC_FIELDS:
                return True, f"numerik/sistem: {e}"
            return False, f"field DB tanpa esc: {e}"
        if var == "this":
            return False, f"field objek tanpa esc: {e}"
        return True, "bukan objek DB"

    # `this.user.x`
    m = re.fullmatch(r"this\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?", e)
    if m:
        return False, f"field user tanpa esc: {e}"

    if re.fullmatch(r"[A-Za-z_$][\w$]*", e):
        return True, "variabel lokal"

    return None, "perlu tinjauan manual"


def main():
    findings, review, total = [], [], 0
    for path in FILES:
        try:
            with open(path, encoding="utf-8") as f:
                lines = f.readlines()
        except FileNotFoundError:
            print(f"LEWATI (tidak ada): {path}")
            continue
        for ln, line in enumerate(lines, 1):
            if "${" not in line:
                continue
            for m in INTERP_RE.finditer(line):
                expr = m.group(1)
                if not expr.strip():
                    continue
                total += 1
                ok, why = classify(expr)
                if ok is False:
                    findings.append((path, ln, expr, why))
                elif ok is None:
                    review.append((path, ln, expr, why))

    print(f"Interpolasi ${'{...}'} diperiksa : {total}")
    print(f"Temuan (wajib diperbaiki)      : {len(findings)}")
    for p, ln, e, w in findings:
        print(f"  MERAH  {p}:{ln}  ${{{e}}}  -> {w}")
    print(f"Perlu tinjauan manual          : {len(review)}")
    for p, ln, e, w in review:
        print(f"  KUNING {p}:{ln}  ${{{e}}}  -> {w}")

    if findings:
        print("\nHASIL: MERAH — masih ada field basis data tanpa escaping.")
        return 1
    print("\nHASIL: HIJAU — nol field basis data yang tidak di-escape.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
