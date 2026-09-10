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
      // `__MOCK_ROWS` boleh berupa ARRAY (baris yang sama untuk semua query,
      // dipakai harness lama) ATAU FUNGSI `(sql, params) => rows` bila sebuah
      // harness perlu membedakan jawaban per query — mis. check-in, yang
      // menjalankan SELECT "sudah ada?" lalu SELECT COUNT(*).
      const injected = globalThis.__MOCK_ROWS;
      if (typeof injected === 'function') return injected(String(sql), params) || [];
      return Array.isArray(injected) ? injected : [];
    }
  };
}

export function reset() {
  __calls.length = 0;
}
