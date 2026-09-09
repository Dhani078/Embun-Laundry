"""One-off analysis: compare index.html inline :root tokens vs design-tokens.css."""
import re, pathlib

root = pathlib.Path(__file__).resolve().parents[1]
raw = (root / "public" / "index.html").read_text(encoding="utf-8")
tok = (root / "public" / "assets" / "design-tokens.css").read_text(encoding="utf-8")

tok_defs = set(re.findall(r"^\s*(--[a-z0-9-]+)\s*:", tok, re.M))
m = re.search(r":root\s*\{(.*?)\}", raw, re.S)
inline_src = m.group(1) if m else ""
inline_defs = set(re.findall(r"(--[a-z0-9-]+)\s*:", inline_src))

collisions = sorted(inline_defs & tok_defs)
print(f"COLLISIONS ({len(collisions)}):")
for c in collisions:
    a = re.search(re.escape(c) + r"\s*:\s*([^;]+);", inline_src)
    b = re.search(re.escape(c) + r"\s*:\s*([^;]+);", tok)
    print(f"  {c}\n     index  = {a.group(1).strip() if a else '?'}\n     tokens = {b.group(1).strip() if b else '?'}")

used = set(re.findall(r"var\((--[a-z0-9-]+)", raw))
print(f"\nvars used: {len(used)}; defined inline: {len(inline_defs)}")
missing = sorted(used - inline_defs)
print(f"used-but-not-defined-inline ({len(missing)}):")
for u in missing:
    print(f"  {u} -> in design-tokens? {u in tok_defs}")

hexes = re.findall(r"#[0-9a-fA-F]{3,8}\b", raw)
print(f"\nhardcoded hex occurrences: {len(hexes)}")
from collections import Counter
for h, n in Counter(hexes).most_common(40):
    print(f"  {h}  x{n}")
