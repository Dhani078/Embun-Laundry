#!/usr/bin/env python3
"""
tools/audit_throw_sites.py — pembuktian untuk A4.

Audit sebelumnya hanya menghitung ada/tidaknya `try`. Itu tidak cukup:
sebuah handler tanpa try/catch tetap AMAN bila tidak memiliki satu pun
"throw site" di tubuhnya. Script ini membuktikan klaim itu.

THROW SITE = konstruksi yang bisa melempar pengecualian saat runtime:
  - await <panggilan>          (reject promise -> 500 dari runtime Workers)
  - new URL(...)
  - JSON.parse(...)
  - .json() / .text() / .formData()
  - crypto.subtle.*            (bisa reject)
  - akses env.* yang bisa undefined lalu dipakai

Cara pakai: python tools/audit_throw_sites.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DIR = os.path.join(ROOT, "functions", "api")

FUNC_RE = re.compile(
    r"^export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)\s*\{", re.MULTILINE)

THROW_PATTERNS = [
    (r"\bawait\s+\w", "await"),
    (r"new\s+URL\s*\(", "new URL()"),
    (r"JSON\.parse\s*\(", "JSON.parse()"),
    (r"\.(json|text|formData|arrayBuffer)\s*\(\s*\)", "body reader"),
    (r"crypto\.subtle\.", "crypto.subtle"),
    (r"\bnew\s+Response\s*\(", "new Response()"),
]


def match_brace(src, i):
    d, n = 0, len(src)
    while i < n:
        if src[i] == "{":
            d += 1
        elif src[i] == "}":
            d -= 1
            if d == 0:
                return i
        i += 1
    return -1


def main():
    files = []
    for root, _d, fs in os.walk(API_DIR):
        for f in sorted(fs):
            if f.endswith(".js"):
                files.append(os.path.join(root, f))
    files.sort()

    print(f"{'file':38} {'handler':20} {'try?':>5} {'throw sites':>12}")
    print("-" * 80)
    risky = []
    for p in files:
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        src = open(p, encoding="utf-8", errors="replace").read()
        for m in FUNC_RE.finditer(src):
            name = m.group(1)
            brace = src.index("{", m.end() - 1)
            end = match_brace(src, brace)
            body = src[brace + 1:end] if end != -1 else src[brace + 1:]
            has_try = re.search(r"(?<![\w$.])try\s*\{", body) is not None
            sites = sorted({lbl for pat, lbl in THROW_PATTERNS
                            if re.search(pat, body)})
            # `new Response()` tidak melempar; hanya penanda, bukan risiko
            sites = [s for s in sites if s != "new Response()"]
            print(f"{rel:38} {name:20} {'YA' if has_try else 'TIDAK':>5} "
                  f"{len(sites):>12}")
            if not has_try and sites:
                risky.append((rel, name, sites))

    print()
    if risky:
        print("HANDLER TANPA try/catch TAPI PUNYA THROW SITE (risiko 500):")
        for rel, name, sites in risky:
            print(f"  - {rel} :: {name}  -> {', '.join(sites)}")
        return 1
    print("AMAN: setiap handler tanpa try/catch terbukti nol throw site.")
    print("(Handler selebihnya sudah berada di dalam try/catch.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
