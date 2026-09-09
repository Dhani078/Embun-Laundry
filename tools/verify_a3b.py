#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""A3b verifier — bukti, bukan keyakinan.

Memastikan:
  1. Setiap token BARU di design-tokens.css punya nilai persis sama dengan
     hex yang digantikan (value-identical -> nol regresi visual).
  2. Tidak ada token baru yang menimpa nama token lama (tabrakan nama).
  3. Semua var() yang dipakai index.html terdefinisi dan bisa di-resolve
     sampai nilai akhir (bukan var() menggantung / undefined).
  4. Sisa hex di index.html hanya di blok :root inline + <meta theme-color>.

Pakai:  python tools/verify_a3b.py     (exit 0 = HIJAU, 1 = MERAH)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOK = ROOT / "public" / "assets" / "design-tokens.css"
IDX = ROOT / "public" / "index.html"

fails = []
oks = []


def check(cond, msg):
    (oks if cond else fails).append(msg)


# ---------------------------------------------------------------- parsing
def parse_root_decls(text):
    """Ambil deklarasi --foo: bar dari SELURUH blok :root di file."""
    decls = {}
    order = []
    # semua blok ':root { ... }'
    for m in re.finditer(r":root\s*\{([^}]*)\}", text, re.S):
        body = m.group(1)
        # buang komentar
        body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
        for d in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+);", body):
            name, val = d.group(1), d.group(2).strip()
            decls[name] = val
            order.append(name)
    return decls, order


def resolve(name, decls, seen=None, depth=0):
    """Resolve rantai alias var() -> nilai akhir hex / literal."""
    seen = seen or set()
    if depth > 10 or name in seen:
        return None
    seen.add(name)
    raw = decls.get(name)
    if raw is None:
        return None
    m = re.match(r"^var\(\s*(--[\w-]+)\s*\)$", raw)
    if m:
        return resolve(m.group(1), decls, seen, depth + 1)
    return raw


tok_text = TOK.read_text(encoding="utf-8")
idx_text = IDX.read_text(encoding="utf-8")
decls, _order = parse_root_decls(tok_text)

# ------------------------------------------------- 1. nilai persis identik
EXPECTED = {
    "--color-bg-inverse":              "#090d16",
    "--color-border-inverse":          "#1e293b",
    "--color-text-on-inverse":         "#f8fafc",
    "--color-text-on-inverse-muted":   "#94a3b8",
    "--color-text-on-inverse-subtle":  "#64748b",
    "--color-rating":                  "#f59e0b",
    "--color-error-500":               "#ef4444",
    "--color-slate-50":                "#f8fafc",
    "--color-slate-400":               "#94a3b8",
    "--color-slate-500":               "#64748b",
    "--color-slate-800":               "#1e293b",
    "--color-slate-950":               "#090d16",
}
print("== 1. Nilai token baru (harus persis = hex yang digantikan) ==")
for name, want in EXPECTED.items():
    got = resolve(name, decls)
    ok = got is not None and got.lower().replace(" ", "") == want.lower()
    check(ok, "%-34s = %-10s (harus %s)" % (name, got, want))
    print("   %-34s %s  %s" % (name, got, "OK" if ok else "SALAH"))

# ------------------------------------------------ 2. tidak menimpa token lama
print("\n== 2. Tabrakan nama (token baru tidak boleh menimpa token lama) ==")
dupes = []
seen_names = {}
for m in re.finditer(r"(--[\w-]+)\s*:", re.sub(r"/\*.*?\*/", "", tok_text, flags=re.S)):
    n = m.group(1)
    seen_names[n] = seen_names.get(n, 0) + 1
for n, c in seen_names.items():
    if c > 1:
        dupes.append("%s x%d" % (n, c))
check(not dupes, "Tidak ada nama token ganda" if not dupes
      else "NAMA GANDA: " + ", ".join(dupes))
print("   %s" % (", ".join(dupes) if dupes else "tidak ada (0 tabrakan)"))

# ------------------------------- 3. semua var() index.html bisa di-resolve
# gabungkan dengan :root inline index.html (menang karena link sebelum <style>)
inline_decls, _ = parse_root_decls(idx_text)
merged = dict(decls)
merged.update(inline_decls)

print("\n== 3. var() di index.html terdefinisi & ter-resolve ==")
used = sorted(set(re.findall(r"var\(\s*(--[\w-]+)", idx_text)))
unresolved = []
fallback_only = []
for v in used:
    r = resolve(v, merged)
    if r is None:
        # aman hanya jika SEMUA pemakaian punya fallback var(--x, default)
        uses = re.findall(r"var\(\s*" + re.escape(v) + r"\s*,([^)]*)\)", idx_text)
        total = len(re.findall(r"var\(\s*" + re.escape(v) + r"\s*[,)]", idx_text))
        if uses and len(uses) == total:
            fallback_only.append("%s (fallback: %s)" % (v, uses[0].strip()))
        else:
            unresolved.append(v)
    elif "var(" in r:
        unresolved.append(v + " -> " + r)
check(not unresolved, "Semua var() resolve" if not unresolved
      else "TAK TER-RESOLVE: " + ", ".join(unresolved))
print("   %d var() unik dipakai; tak ter-resolve: %s"
      % (len(used), ", ".join(unresolved) if unresolved else "0"))
if fallback_only:
    print("   CATATAN: tanpa deklarasi tapi punya fallback -> %s"
          % "; ".join(fallback_only))

# --------------------------------------------- 4. sisa hex di index.html
print("\n== 4. Sisa hardcoded hex di index.html ==")
root_spans = [m.span() for m in re.finditer(r":root\s*\{[^}]*\}", idx_text, re.S)]
meta_spans = [m.span() for m in
              re.finditer(r'<meta[^>]*theme-color[^>]*>', idx_text, re.I)]


def in_span(pos, spans):
    return any(a <= pos < b for a, b in spans)


leftover = []
for m in re.finditer(r"#[0-9a-fA-F]{6}\b", idx_text):
    if in_span(m.start(), root_spans) or in_span(m.start(), meta_spans):
        continue
    line = idx_text[:m.start()].count("\n") + 1
    leftover.append("L%d %s" % (line, m.group(0)))
check(not leftover, "Nol hex di luar :root/theme-color" if not leftover
      else "SISA: " + ", ".join(leftover))
print("   di luar :root/theme-color: %s"
      % (", ".join(leftover) if leftover else "0 (bersih)"))
print("   di dalam :root inline: %d, <meta theme-color>: %d (keduanya wajar)"
      % (sum(1 for m in re.finditer(r"#[0-9a-fA-F]{6}\b", idx_text)
             if in_span(m.start(), root_spans)),
         sum(1 for m in re.finditer(r"#[0-9a-fA-F]{6}\b", idx_text)
             if in_span(m.start(), meta_spans))))

# ----------------------------------------------------------------- hasil
print("\n" + "=" * 60)
if fails:
    print("HASIL: MERAH  (%d gagal)" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("HASIL: HIJAU  (%s)" % ("semua %d cek lolos" % len(oks) if oks else "ok"))
sys.exit(0)
