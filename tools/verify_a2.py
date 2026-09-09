"""Post-deploy production verification for A2 (hero canvas)."""
import urllib.request

B = "https://embun-laundry.dhanisepeda.workers.dev"


def get(path):
    req = urllib.request.Request(B + path, headers={"User-Agent": "agent24-verify/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return getattr(e, "code", 0), ""


def status(path):
    return get(path)[0]


print("=== Status endpoint ===")
for p in ["/", "/api/health", "/api/services", "/assets/hero-canvas.js", "/dashboard"]:
    print(f"  {p} -> {status(p)}")

code, html = get("/")
print("\n=== Markup hero (produksi) ===")
for i, line in enumerate(html.splitlines(), 1):
    if "hero-canvas-container" in line or "p5.min.js" in line or "integrity=" in line:
        print(f"  {i}: {line.strip()[:110]}")

print("\n=== CSS container (produksi) ===")
lines = html.splitlines()
for i, line in enumerate(lines, 1):
    if "#hero-canvas-container" in line:
        for j in range(i - 1, min(i + 9, len(lines))):
            print(f"  {j+1}: {lines[j].strip()}")

print("\n=== <script> setelah </html> ===")
tail = html.split("</html>")[-1] if "</html>" in html else ""
print(f"  script setelah </html>: {tail.lower().count('<script')}")

print("\n=== Struktur (Gate 2 / Gate 7) ===")
for token in ["</html>", "<h1", "<footer", "orderModal", "pricesGrid", "authModal"]:
    print(f"  {token}: {html.count(token)}")

print("\n=== Isolasi: hero-canvas.js hanya di landing ===")
for p in ["/dashboard", "/pay"]:
    print(f"  {p}: {get(p)[1].count('hero-canvas.js')} referensi")
