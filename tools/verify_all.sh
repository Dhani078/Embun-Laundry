#!/usr/bin/env bash
# Preflight runner: pastikan dependensi lokal terpasang sebelum verifier
# dijalankan. Tanpa ini, verifier MERAH palsu dengan ERR_MODULE_NOT_FOUND
# (kegagalan resolve, bukan kegagalan tes) — pernah menyebabkan deteksi
# regresi yang menyesatkan.
cd "$(dirname "$0")/.." || exit 1

if [ ! -d node_modules/@tidbcloud ] || [ ! -d node_modules/bcryptjs ]; then
  echo "[preflight] node_modules hilang -> memasang dependensi (npm ci)"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || {
    echo "[preflight] GAGAL memasang dependensi; verifier akan MERAH palsu."
    exit 1
  }
fi

exec bash "$(dirname "$0")/run_all_verifiers.sh" "$@"
