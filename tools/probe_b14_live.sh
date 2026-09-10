#!/usr/bin/env bash
# Verifikasi B14 terhadap PRODUKSI (bukan harness).
# Jalankan setelah deploy:  bash tools/probe_b14_live.sh
#
# Yang diukur:
#   1. Pesan 500 tidak pernah memuat penanda rahasia (tidak bisa dipicu
#      langsung di produksi, jadi yang diukur adalah kontrak: setiap
#      endpoint menjawab JSON {ok:...} dan tidak pernah 500 pada input valid).
#   2. /api/pay menolak amount/method/order_code yang tidak valid -> 400.
#   3. Jalur sukses tidak mati: login + services + pay page tetap hidup.
B=https://embun-laundry.dhanisepeda.workers.dev
JAR=$(mktemp)

say() { printf '%-52s %s\n' "$1" "$2"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# --- 1. baseline -----------------------------------------------------------
for p in / /dashboard /api/health /api/services; do
  say "$p" "$(code "$B$p")"
done

# --- 2. tanpa sesi -> 401 --------------------------------------------------
for p in /api/me /api/orders /api/customers /api/pay /api/reports; do
  say "tanpa sesi $p" "$(code "$B$p")"
done

# --- 3. /api/pay: validasi HARUS 400 ---------------------------------------
say "pay GET tanpa order_code"     "$(code "$B/api/pay")"
say "pay GET order_code raksasa"   "$(code "$B/api/pay?order_code=$(printf 'X%.0s' $(seq 1 200))")"

BODY="$B/api/pay"
say "pay POST body JSON rusak"     "$(code -X POST -H 'Content-Type: application/json' -d 'not-json' "$BODY")"
say "pay POST amount array"        "$(code -X POST -H 'Content-Type: application/json' -d '{"order_code":"ORD-1","amount":[1,2]}' "$BODY")"
say "pay POST amount 2e9"          "$(code -X POST -H 'Content-Type: application/json' -d '{"order_code":"ORD-1","amount":2000000000}' "$BODY")"
say "pay POST amount negatif"      "$(code -X POST -H 'Content-Type: application/json' -d '{"order_code":"ORD-1","amount":-1000}' "$BODY")"
say "pay POST method asing"        "$(code -X POST -H 'Content-Type: application/json' -d '{"order_code":"ORD-1","amount":50000,"method":"WUZZ;DROP"}' "$BODY")"
say "pay POST order_code raksasa"  "$(code -X POST -H 'Content-Type: application/json' -d "{\"order_code\":\"$(printf 'X%.0s' $(seq 1 5000))\",\"amount\":50000}" "$BODY")"

# --- 4. login admin -> jalur sukses ---------------------------------------
LOGIN=$(curl -s -c "$JAR" -X POST "$B/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"identity":"admin@gmail.com","password":"admin123"}')
say "login admin" "$(printf '%s' "$LOGIN" | head -c 90)"

say "GET /api/me (bersesi)"        "$(code -b "$JAR" "$B/api/me")"
say "GET /api/orders (bersesi)"    "$(code -b "$JAR" "$B/api/orders")"
say "GET /api/dashboard (bersesi)" "$(code -b "$JAR" "$B/api/dashboard")"
say "GET /api/checkin (bersesi)"   "$(code -b "$JAR" "$B/api/checkin")"
say "GET /api/vouchers (bersesi)"  "$(code -b "$JAR" "$B/api/vouchers")"
say "GET /api/pay (bersesi, sah)"  "$(code -b "$JAR" "$B/api/pay?order_code=ORD-TIDAKADA")"

# --- 5. header keamanan B4 tetap ada --------------------------------------
H=$(curl -s -D - -o /dev/null "$B/api/health")
for h in X-Content-Type-Options X-Frame-Options Referrer-Policy; do
  say "header $h" "$(printf '%s' "$H" | grep -i "^$h:" | tr -d '\r')"
done

rm -f "$JAR"
