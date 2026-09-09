// Mock untuk driver @tidbcloud/serverless — dipakai HANYA oleh harness uji B7.
// Tidak ikut ter-deploy (folder tools/ tidak masuk bundel Worker).
//
// Tujuan: merekam SETIAP string SQL yang benar-benar dikirim ke driver,
// lengkap dengan params-nya, supaya kita bisa membuktikan (bukan menebak)
// bahwa teks dari user tidak pernah menyusup ke dalam SQL.

export const __calls = [];

export function connect(config) {
  return {
    async execute(sql, params) {
      __calls.push({ sql: String(sql), params, ts: Date.now() });
      // Kembalikan bentuk yang sama dengan driver asli untuk SELECT:
      // array of row. Kosong cukup untuk jalur sukses handler.
      return [];
    }
  };
}

export function reset() {
  __calls.length = 0;
}
