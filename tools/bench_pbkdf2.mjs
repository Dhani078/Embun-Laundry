// Ukur biaya PBKDF2 di runtime Node (proksi untuk Workers) sebelum memilih
// jumlah iterasi. Dipakai SEKALI untuk menentukan konstanta B8.
import { webcrypto } from 'node:crypto';

const enc = new TextEncoder();

async function bench(iters, reps = 5) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey(
    'raw', enc.encode('Str0ngPass!2026'), 'PBKDF2', false, ['deriveBits']
  );
  await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256);
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) {
    await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256);
  }
  const t1 = performance.now();
  console.log(String(iters).padStart(7), 'iterations ->', ((t1 - t0) / reps).toFixed(2), 'ms');
}

for (const it of [10000, 20000, 50000, 100000, 200000, 600000]) await bench(it);
