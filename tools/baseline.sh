#!/usr/bin/env bash
# Baseline produksi cepat — dipanggil setiap tick.
B=https://embun-laundry.dhanisepeda.workers.dev
for p in / /dashboard /api/health /api/services /assets/design-tokens.css; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$B$p")
  printf '%-30s %s\n' "$p" "$code"
done
