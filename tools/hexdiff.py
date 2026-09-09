import re, subprocess, sys

rx = re.compile(r"#[0-9a-fA-F]{6}")
base = "C:/xampp/htdocs/dhani-laundry"


def sh(cmd):
    return subprocess.run(cmd, shell=True, cwd=base, capture_output=True, text=True).stdout


def count(text):
    lines = text.splitlines()
    return sum(1 for l in lines if rx.search(l)), len(rx.findall(text))


head = sh("git show HEAD:public/index.html")
with open(base + "/public/index.html", encoding="utf-8") as f:
    cur = f.read()

hl, ho = count(head)
cl, co = count(cur)
print(f"HEAD  baris={hl} kemunculan={ho}")
print(f"KERJA baris={cl} kemunculan={co}")

diff = sh("git diff -U0 -- public/index.html")
added = [l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++")]
print(f"baris_baru={len(added)} hex_pada_baris_baru={len(rx.findall(chr(10).join(added)))}")
