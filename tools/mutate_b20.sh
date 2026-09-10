#!/usr/bin/env bash
# Uji mutasi B20 — buktikan harness tools/verify_b20.mjs punya GIGI.
#
# Cara: rusak kode produksi dengan satu perubahan kecil, jalankan harness,
# catat hasilnya, lalu PULIHKAN. Bila sebuah mutasi tetap HIJAU 37/37,
# berarti harness itu tidak mengukur apa-apa.
#
# Dipakai sekali pada tick 28. Kode dipulihkan dengan `git checkout`.
cd "$(dirname "$0")/.." || exit 1

PAY=functions/api/pay.js
cp "$PAY" .tmp/pay_b20_orig.js

run() {
  echo "--- $1"
  node tools/verify_b20_run.mjs 2>&1 | tail -1
  # PULIHKAN DARI CADANGAN, bukan `git checkout`: perbaikan B20 belum
  # pernah di-commit saat skrip ini dijalankan, jadi `git checkout` akan
  # mengembalikan ke keadaan SEBELUM B20 dan seluruh mutasi berikutnya
  # mengukur kode yang sudah usang (angka MERAH identik 20/37 — jebakan
  # yang nyata, pernah terjadi pada tick ini).
  cp .tmp/pay_b20_orig.js "$PAY"
}

# 1. B20 dibalik: hapus penolakan (kembali ke keadaan sebelum tick 28).
python - <<'EOF'
import re
p='functions/api/pay.js'
s=open(p,encoding='utf-8').read()
s=s.replace("if (amount > remaining) {","if (false) {")
open(p,'w',encoding='utf-8').write(s)
EOF
run "MUTASI 1: penolakan dihapus (B20 dibalik)"

# 2. Sisa hanya dari total_amount — paid_amount diabaikan.
python - <<'EOF'
p='functions/api/pay.js'
s=open(p,encoding='utf-8').read()
s=s.replace("- (Number(order.paid_amount) || 0)\n        - outstanding);","- outstanding);")
open(p,'w',encoding='utf-8').write(s)
EOF
run "MUTASI 2: paid_amount tidak dihitung"

# 3. Sisa TIDAK mengurangi baris pending (lubang pada pengulangan).
python - <<'EOF'
p='functions/api/pay.js'
s=open(p,encoding='utf-8').read()
s=s.replace("\n        - outstanding);", ");")
open(p,'w',encoding='utf-8').write(s)
EOF
run "MUTASI 3: baris pending tidak dihitung"

# 4. Riwayat gagal dibaca tapi penulisan dilanjutkan (gagal terbuka).
python - <<'EOF'
p='functions/api/pay.js'
s=open(p,encoding='utf-8').read()
s=s.replace("""      } catch (e) {
        return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
      }

      const remaining = Math.max(0, (Number(order.total_amount) || 0)""","""      } catch (e) {
        outstanding = 0;
      }

      const remaining = Math.max(0, (Number(order.total_amount) || 0)""")
open(p,'w',encoding='utf-8').write(s)
EOF
run "MUTASI 4: gagal baca riwayat -> gagal terbuka"

# 5. Pengetatan BERLEBIHAN: cicilan ikut dilarang (bayar 20000 dari 60000).
python - <<'EOF'
p='functions/api/pay.js'
s=open(p,encoding='utf-8').read()
s=s.replace("if (amount > remaining) {","if (amount !== remaining) {")
open(p,'w',encoding='utf-8').write(s)
EOF
run "MUTASI 5: hanya boleh bayar lunas sekaligus"

echo "--- KODE DIPULIHKAN (dari cadangan)"
node tools/verify_b20_run.mjs 2>&1 | tail -1
