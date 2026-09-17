import { execSync } from 'child_process';
import path from 'path';

const files = [
  'tools/verify_a6_run.mjs', 'tools/verify_fase0_2_run.mjs', 'tools/verify_fase0_3_run.mjs',
  'tools/verify_fase0_4_run.mjs', 'tools/verify_fase0_5_run.mjs', 'tools/verify_fase0_6_run.mjs',
  'tools/verify_fase0_7_run.mjs', 'tools/verify_fase0_8_run.mjs', 'tools/verify_fase0_9_run.mjs',
  'tools/verify_b1.mjs', 'tools/verify_b2_run.mjs', 'tools/verify_b3_run.mjs', 'tools/verify_b5_run.mjs',
  'tools/verify_b7_run.mjs', 'tools/verify_b8_run.mjs', 'tools/verify_b9.mjs',
  'tools/verify_b10_run.mjs', 'tools/verify_b11_run.mjs', 'tools/verify_b12_run.mjs',
  'tools/verify_b13_run.mjs', 'tools/verify_b14_run.mjs', 'tools/verify_b15_run.mjs',
  'tools/verify_b16_run.mjs', 'tools/verify_b17_run.mjs',
  'tools/verify_b18_run.mjs', 'tools/verify_b19_run.mjs', 'tools/verify_b20_run.mjs',
  'tools/verify_c1_run.mjs', 'tools/verify_c2_run.mjs', 'tools/verify_c3_run.mjs',
  'tools/verify_c4_run.mjs', 'tools/verify_c_pay_sync_run.mjs',
  'tools/verify_c5_run.mjs', 'tools/verify_c6.mjs', 'tools/verify_c7_run.mjs', 'tools/verify_c8_run.mjs',
  'tools/verify_c9.mjs',
  'tools/verify_d1_run.mjs', 'tools/verify_d2_run.mjs', 'tools/verify_d3_run.mjs',
  'tools/verify_d6_run.mjs', 'tools/verify_d7_run.mjs', 'tools/verify_d8_run.mjs', 'tools/verify_d9_run.mjs',
  'tools/verify_e5_run.mjs', 'tools/verify_e6_run.mjs'
];

let failed = 0;
let passed = 0;

for (const f of files) {
  try {
    const out = execSync(`node ${f}`, { stdio: 'pipe' }).toString();
    const match = out.match(/[0-9]+\/[0-9]+/g);
    const score = match ? match[match.length - 1] : 'ok';
    console.log(`${f.padEnd(32)} HIJAU  ${score}`);
    passed++;
  } catch (err) {
    console.error(`${f.padEnd(32)} MERAH`);
    const out = err.stdout ? err.stdout.toString() : err.message;
    console.error(out.split('\n').filter(l => l.includes('MERAH') || l.includes('HASIL')).slice(0, 8).join('\n'));
    failed++;
  }
}

console.log(`\nRingkasan: ${passed} HIJAU, ${failed} MERAH dari total ${files.length} suites.`);
if (failed > 0) process.exit(1);
