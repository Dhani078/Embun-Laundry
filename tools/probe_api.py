#!/usr/bin/env python3
"""
tools/probe_api.py — A4 baseline probe terhadap PRODUKSI / lokal.

Mengukur 4 hal yang menjadi definisi A4:
  1. Setiap endpoint mengembalikan JSON (Content-Type aplikasi/json)
  2. Setiap body JSON punya field `ok`
  3. Tidak ada HTTP 500 pada input yang valid
  4. Preflight OPTIONS tidak mengembalikan 405

Cara pakai:
  python tools/probe_api.py https://embun-laundry.dhanisepeda.workers.dev
  python tools/probe_api.py http://127.0.0.1:8787
"""
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1
        else "https://embun-laundry.dhanisepeda.workers.dev").rstrip("/")

PUBLIC_GET = ["/api/health", "/api/services", "/api/me"]
AUTH_GET = ["/api/dashboard", "/api/orders", "/api/customers",
            "/api/promos", "/api/vouchers", "/api/reports",
            "/api/delivery", "/api/profile"]
ALL_API = ["/api/health", "/api/services", "/api/me", "/api/dashboard",
           "/api/orders", "/api/customers", "/api/promos", "/api/vouchers",
           "/api/reports", "/api/delivery", "/api/profile", "/api/checkin",
           "/api/pay", "/api/auth/login", "/api/auth/register",
           "/api/auth/logout"]


def req(method, path, body=None, cookie=None, timeout=25):
    url = BASE + path
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        else:
            data = body.encode() if isinstance(body, str) else body
            headers["Content-Type"] = "application/json"
    if cookie:
        headers["Cookie"] = cookie
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, resp.headers.get("Content-Type", ""), raw, \
                resp.headers.get_all("Set-Cookie") or []
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        return e.code, e.headers.get("Content-Type", ""), raw, \
            e.headers.get_all("Set-Cookie") or []


def is_json(ct):
    return "application/json" in ct.lower()


def body_ok(raw, ct):
    if not is_json(ct):
        return False, "BUKAN_JSON"
    try:
        obj = json.loads(raw)
    except Exception:
        return False, "JSON_PARSE_GAGAL"
    if not isinstance(obj, dict) or "ok" not in obj:
        return False, "TANPA_FIELD_ok"
    return True, ("ok=%s" % obj["ok"])


def main():
    problems = []
    print("=" * 78)
    print("PROBE A4 —", BASE)
    print("=" * 78)

    # --- 1. Login untuk dapat cookie ---
    print("\n[1] LOGIN")
    st, ct, raw, sc = req("POST", "/api/auth/login",
                          {"identity": "admin@gmail.com", "password": "admin123"})
    cookie = None
    for c in sc:
        cookie = c.split(";")[0]
    ok, note = body_ok(raw, ct)
    print(f"  POST /api/auth/login -> {st} {ct.split(';')[0]} {note}")
    if not ok:
        problems.append(("login", st, note))
    if cookie:
        print(f"  cookie: {cookie[:28]}...")
    else:
        print("  cookie: TIDAK DIDAPAT (semua probe auth akan 401)")

    # --- 2. GET publik & terautentikasi ---
    print("\n[2] GET — kontrak JSON + field ok")
    print(f"  {'path':22} {'st':>4} {'content-type':18} {'ok?':22}")
    for p in PUBLIC_GET:
        st, ct, raw, _ = req("GET", p)
        ok, note = body_ok(raw, ct)
        print(f"  {p:22} {st:>4} {ct.split(';')[0]:18} {note:22}")
        if not ok:
            problems.append((p, st, note))
    for p in AUTH_GET:
        st, ct, raw, _ = req("GET", p, cookie=cookie)
        ok, note = body_ok(raw, ct)
        print(f"  {p:22} {st:>4} {ct.split(';')[0]:18} {note:22}")
        if not ok:
            problems.append((p, st, note))

    # --- 3. Preflight OPTIONS ---
    print("\n[3] OPTIONS (preflight CORS) — tidak boleh 405")
    print(f"  {'path':22} {'st':>4}  status")
    for p in ALL_API:
        st, ct, raw, _ = req("OPTIONS", p)
        flag = "OK" if st in (200, 204) else ">>> 405/PREFLIGHT GAGAL"
        print(f"  {p:22} {st:>4}  {flag}")
        if st not in (200, 204):
            problems.append((f"OPTIONS {p}", st, "preflight gagal"))

    # --- 4. Body JSON rusak ---
    print("\n[4] BODY JSON RUSAK — harus JSON {ok:false}, bukan HTML 500")
    for p in ["/api/auth/login", "/api/orders", "/api/promos"]:
        st, ct, raw, _ = req("POST", p, body="{ ini-bukan-json", cookie=cookie)
        ok, note = body_ok(raw, ct)
        print(f"  POST {p:20} -> {st} {ct.split(';')[0]:18} {note}")
        if not ok:
            problems.append((f"POST {p} (bad json)", st, note))

    # --- 5. Method tidak diizinkan ---
    print("\n[5] METHOD TIDAK DIDUKUNG — harus JSON, bukan HTML")
    st, ct, raw, _ = req("DELETE", "/api/health")
    ok, note = body_ok(raw, ct)
    print(f"  DELETE /api/health -> {st} {ct.split(';')[0]:18} {note}")
    if not ok:
        problems.append(("DELETE /api/health", st, note))
    st, ct, raw, _ = req("PATCH", "/api/services")
    ok, note = body_ok(raw, ct)
    print(f"  PATCH  /api/services -> {st} {ct.split(';')[0]:18} {note}")
    if not ok:
        problems.append(("PATCH /api/services", st, note))

    # --- 6. Endpoint tidak ada ---
    print("\n[6] ENDPOINT TIDAK ADA — harus JSON 404")
    st, ct, raw, _ = req("GET", "/api/tidak-ada")
    ok, note = body_ok(raw, ct)
    print(f"  GET /api/tidak-ada -> {st} {ct.split(';')[0]:18} {note}")
    if not ok:
        problems.append(("/api/tidak-ada", st, note))

    print("\n" + "=" * 78)
    if problems:
        print(f"TEMUAN: {len(problems)} pelanggaran kontrak")
        for p, st, note in problems:
            print(f"  - {p:34} HTTP {st}  {note}")
    else:
        print("TEMUAN: nol — semua endpoint patuh kontrak {ok}")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
