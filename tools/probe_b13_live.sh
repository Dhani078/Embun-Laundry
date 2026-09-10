#!/usr/bin/env bash
# Post-verifikasi produksi B13: /api/me, /api/auth/logout, /api/profile.
# Catatan implementasi (keduanya bikin skrip ini diam-diam gagal):
#  1. Pakai path RELATIF, bukan "$(pwd)/.tmp". curl bawaan mingw tidak
#     mengerti bentuk "/c/xampp/..." dan menulis ke tempat lain → file
#     tidak ketemu. .tmp/ sudah ada di .gitignore, jadi aman.
#  2. Payload raksasa dikirim lewat --data-binary @file, bukan -d, karena
#     argv punya batas panjang ("Argument list too long" di 100.000 char).
BASE=https://embun-laundry.dhanisepeda.workers.dev
W=.tmp
mkdir -p "$W"
J=$W/ck.txt; OUT=$W/out.txt
rm -f "$J" "$OUT"

code() { curl -s -o "$OUT" -w '%{http_code}' "$@"; }
body() { head -c 220 "$OUT" 2>/dev/null; }

echo "== tanpa sesi =="
printf '%-40s %s  ' "GET /api/me" "$(code "$BASE/api/me")"; body; echo
printf '%-40s %s  ' "GET /api/profile" "$(code "$BASE/api/profile")"; body; echo
printf '%-40s %s  ' "POST /api/profile" "$(code -X POST -H 'Content-Type: application/json' -d '{"action":"update_profile","full_name":"X"}' "$BASE/api/profile")"; body; echo

echo "== login admin =="
code -c "$J" -X POST -H 'Content-Type: application/json' \
  -d '{"identity":"admin@gmail.com","password":"admin123"}' "$BASE/api/auth/login" > /dev/null
body; echo
grep -q '"ok":true' "$OUT" || { echo "LOGIN GAGAL - hentikan"; exit 1; }

echo "== dengan sesi =="
printf '%-40s %s  ' "GET /api/me" "$(code -b "$J" "$BASE/api/me")"; body; echo
printf '%-40s %s  ' "GET /api/profile" "$(code -b "$J" "$BASE/api/profile")"; body; echo
echo "-- apakah password_hash ikut terkirim? --"
grep -c password_hash "$OUT" | sed 's/^/kemunculan password_hash: /'

echo "== update_profile: payload raksasa (harus 400, bukan 500) =="
python -c "
import json
open('$W/big.json','w').write(json.dumps({'action':'update_profile','full_name':'A'*100000}))
" 2>/dev/null || python3 -c "
import json
open('$W/big.json','w').write(json.dumps({'action':'update_profile','full_name':'A'*100000}))
"
printf '%-40s %s  ' "nama 100.000 char" \
  "$(code -b "$J" -X POST -H 'Content-Type: application/json' --data-binary "@$W/big.json" "$BASE/api/profile")"
body; echo

echo "== update_profile: phone berupa objek (dulu 500 TypeError) =="
printf '%-40s %s  ' "phone = {}" \
  "$(code -b "$J" -X POST -H 'Content-Type: application/json' \
     -d '{"action":"update_profile","full_name":"Nama Uji","phone":{"n":1}}' "$BASE/api/profile")"
body; echo

echo "== update_profile: nama 1 char (min 2) =="
printf '%-40s %s  ' "nama = 'A'" \
  "$(code -b "$J" -X POST -H 'Content-Type: application/json' \
     -d '{"action":"update_profile","full_name":"A"}' "$BASE/api/profile")"
body; echo

echo "== update_profile: valid (harus tetap 200) =="
printf '%-40s %s  ' "nama+telepon wajar" \
  "$(code -b "$J" -X POST -H 'Content-Type: application/json' \
     -d '{"action":"update_profile","full_name":"Administrator","phone":"081234567890"}' "$BASE/api/profile")"
body; echo

printf '%-40s %s  ' "GET /api/profile akhir" "$(code -b "$J" "$BASE/api/profile")"; body; echo

echo "== logout =="
printf '%-40s %s  ' "POST /api/auth/logout" "$(code -b "$J" -X POST "$BASE/api/auth/logout")"; body; echo
echo "-- Set-Cookie logout --"
curl -s -D - -o /dev/null -b "$J" -X POST "$BASE/api/auth/logout" | grep -i set-cookie
rm -f "$J" "$OUT" "$W/big.json"
