"""Audit API handlers: try/catch coverage + {ok} contract. Temporary tool."""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.path.join(ROOT, "functions", "api")

files = []
for root, _dirs, fs in os.walk(API):
    for f in sorted(fs):
        if f.endswith(".js"):
            files.append(os.path.join(root, f))
files.sort()

print(f"{'file':40} {'ln':>4} {'try':>4} {'catch':>5} {'json()':>6} {'ok:':>4}")
print("-" * 72)
bad = []
for p in files:
    src = open(p, encoding="utf-8", errors="replace").read()
    rel = os.path.relpath(p, ROOT).replace("\\", "/")
    ntry = len(re.findall(r"\btry\s*\{", src))
    ncatch = len(re.findall(r"catch\s*\(", src))
    njson = len(re.findall(r"\.json\(", src)) + len(re.findall(r"jsonResponse|json\((?!)", src))
    njson = len(re.findall(r"\.json\(", src))
    nok = len(re.findall(r"ok:\s*(?:true|false)", src))
    print(f"{rel:40} {len(src.splitlines()):>4} {ntry:>4} {ncatch:>5} {njson:>6} {nok:>4}")
    if ntry == 0 or ncatch == 0:
        bad.append(rel)

print()
print("HANDLERS TANPA try/catch:", bad if bad else "tidak ada")
