#!/usr/bin/env bash
# Jalankan semua verifier yang sudah ada dan ringkas hasilnya.
# Dipakai setiap tick untuk membuktikan tidak ada regresi.
cd "$(dirname "$0")/.." || exit 1
for f in tools/verify_a6_run.mjs tools/verify_fase0_2_run.mjs tools/verify_fase0_3_run.mjs tools/verify_fase0_4_run.mjs tools/verify_fase0_5_run.mjs tools/verify_fase0_6_run.mjs tools/verify_fase0_7_run.mjs tools/verify_fase0_8_run.mjs tools/verify_fase0_9_run.mjs tools/verify_b1.mjs tools/verify_b2_run.mjs tools/verify_b3_run.mjs tools/verify_b5_run.mjs \
         tools/verify_b7_run.mjs tools/verify_b8_run.mjs tools/verify_b9.mjs \
         tools/verify_b10_run.mjs tools/verify_b11_run.mjs tools/verify_b12_run.mjs \
         tools/verify_b13_run.mjs tools/verify_b14_run.mjs tools/verify_b15_run.mjs \
         tools/verify_b16_run.mjs tools/verify_b17_run.mjs \
         tools/verify_b18_run.mjs tools/verify_b19_run.mjs tools/verify_b20_run.mjs \
         tools/verify_c1_run.mjs tools/verify_c2_run.mjs tools/verify_c3_run.mjs tools/verify_c4_run.mjs tools/verify_c_pay_sync_run.mjs \
         tools/verify_c5_run.mjs tools/verify_c6.mjs tools/verify_c7_run.mjs tools/verify_c8_run.mjs \
         tools/verify_d2_run.mjs; do
  out=$(node "$f" 2>&1); rc=$?
  last=$(printf '%s' "$out" | grep -oE '[0-9]+/[0-9]+' | tail -1)
  if [ $rc -eq 0 ]; then
    printf '%-28s HIJAU  %s\n' "$f" "${last:-ok}"
  else
    printf '%-28s MERAH  rc=%s\n' "$f" "$rc"
    printf '%s\n' "$out" | grep -E "MERAH|HASIL" | head -8
  fi
done
