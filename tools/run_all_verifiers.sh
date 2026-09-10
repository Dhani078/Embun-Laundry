#!/usr/bin/env bash
# Jalankan semua verifier yang sudah ada dan ringkas hasilnya.
# Dipakai setiap tick untuk membuktikan tidak ada regresi.
cd "$(dirname "$0")/.." || exit 1
for f in tools/verify_b1.mjs tools/verify_b2_run.mjs tools/verify_b5_run.mjs \
         tools/verify_b7_run.mjs tools/verify_b8_run.mjs tools/verify_b9.mjs \
         tools/verify_b10_run.mjs tools/verify_b11_run.mjs tools/verify_b12_run.mjs \
         tools/verify_b13_run.mjs tools/verify_b14_run.mjs tools/verify_c2_run.mjs; do
  out=$(node "$f" 2>&1); rc=$?
  last=$(printf '%s' "$out" | grep -oE '[0-9]+/[0-9]+' | tail -1)
  if [ $rc -eq 0 ]; then
    printf '%-28s HIJAU  %s\n' "$f" "${last:-ok}"
  else
    printf '%-28s MERAH  rc=%s\n' "$f" "$rc"
    printf '%s\n' "$out" | grep -E "MERAH|HASIL" | head -8
  fi
done
