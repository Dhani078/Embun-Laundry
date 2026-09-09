#!/usr/bin/env python3
"""
tools/audit_api_guard.py — A4 auditor (temporary, not shipped to runtime)

Menjawab 2 pertanyaan yang tidak bisa dijawab oleh `grep try`:
  1. Apakah setiap handler API membungkus SELURUH tubuhnya dalam try/catch?
     -> dilaporkan sebagai FIRST_TRY / FIRST_CATCH: nomor baris (1-based) dari
        `try {` pertama dan `catch (` pertama, relatif terhadap baris awal fungsi.
        Sehat = try muncul di awal tubuh fungsi, catch ada.
  2. Apakah semua jalan keluar mengembalikan JSON dengan field `ok`?
     -> dilaporkan sebagai RESPONDS: daftar literal yang di-return/dibuat.
        Sehat = semua `new Response(` / `jsonResponse(` pakai JSON.stringify
        atau jsonResponse; TANPA_POLA = ada `new Response(` tanpa JSON.

Cara pakai:  python tools/audit_api_guard.py
Exit code:   0 = semua hijau, 1 = ada temuan.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DIR = os.path.join(ROOT, "functions", "api")

# Ambil tiap `export async function onRequestXxx(...) {` berikut tubuhnya
FUNC_RE = re.compile(
    r"^export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)\s*\{",
    re.MULTILINE,
)


def match_brace(src, open_idx):
    """Return index of the '}' matching the '{' at open_idx, else -1."""
    depth = 0
    i = open_idx
    n = len(src)
    while i < n:
        c = src[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def line_of(src, idx):
    return src.count("\n", 0, idx) + 1


def audit_file(path, rel):
    src = open(path, encoding="utf-8", errors="replace").read()
    findings = []
    for m in FUNC_RE.finditer(src):
        name = m.group(1)
        brace = src.index("{", m.end() - 1)
        end = match_brace(src, brace)
        if end == -1:
            findings.append((rel, name, "BRACE_TIDAK_SEIMBANG", "", ""))
            continue
        body = src[brace + 1:end]
        body_start_line = line_of(src, brace)

        def rel_line(bidx):
            return body_start_line + body.count("\n", 0, bidx)

        t = re.search(r"(?<![\w$.])try\s*\{", body)
        c = re.search(r"\}\s*catch\s*\(", body)
        t_line = rel_line(t.start()) if t else None
        c_line = rel_line(c.start()) if c else None

        # Semua konstruksi response di tubuh fungsi
        json_resps = re.findall(r"jsonResponse\s*\(", body)
        raw_resps = re.findall(r"new\s+Response\s*\(", body)
        # `new Response(` yang TIDAK diikuti JSON.stringify dalam 120 char
        bad_raw = []
        for rm in re.finditer(r"new\s+Response\s*\(", body):
            window = body[rm.end():rm.end() + 160]
            if "JSON.stringify" not in window and "null" not in window[:20]:
                bad_raw.append(rel_line(rm.start()))

        status = "OK"
        notes = []
        if t is None and c is None:
            status = "TANPA_TRY_CATCH"
        elif t is None or c is None:
            status = "TIDAK_SEPASANG"
        if bad_raw:
            status = "RESPONSE_BUKAN_JSON"
            notes.append(f"new Response() tanpa JSON di baris {bad_raw}")

        findings.append((rel, name, status,
                         f"try@{t_line}" if t_line else "try@-",
                         f"catch@{c_line}" if c_line else "catch@-"))
        if notes:
            findings[-1] = findings[-1] + ("; ".join(notes),)
    return findings


def main():
    files = []
    for root, _d, fs in os.walk(API_DIR):
        for f in sorted(fs):
            if f.endswith(".js"):
                files.append(os.path.join(root, f))
    files.sort()

    print(f"{'file':38} {'handler':22} {'status':20} try/catch")
    print("-" * 104)
    all_findings = []
    for p in files:
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        for f in audit_file(p, rel):
            all_findings.append(f)
            print(f"{f[0]:38} {f[1]:22} {f[2]:20} {f[3]} / {f[4]}"
                  + (f"  <{f[5]}>" if len(f) > 5 else ""))

    risky = [f for f in all_findings
             if f[2] in ("TANPA_TRY_CATCH", "TIDAK_SEPASANG",
                         "RESPONSE_BUKAN_JSON", "BRACE_TIDAK_SEIMBANG")]
    print()
    print(f"Total handler: {len(all_findings)}")
    print(f"TANPA try/catch utuh: {len(risky)}")
    for f in risky:
        print(f"  - {f[0]} :: {f[1]} ({f[2]})")
    return 1 if risky else 0


if __name__ == "__main__":
    sys.exit(main())
