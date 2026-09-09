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
      // Baris sembarang bisa disuntikkan lewat `globalThis.__MOCK_ROWS`
      // supaya harness bisa menguji jalur SUKSES (misal login berhasil),
      // bukan cuma jalur kosong. Kalau tidak diset, [] seperti driver asli
      // ketika tidak ada baris cocok.
      return Array.isArray(globalThis.__MOCK_ROWS) ? globalThis.__MOCK_ROWS : [];
    }
  };
}

export function reset() {
  __calls.length = 0;
}
