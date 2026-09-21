/**
 * verify_c10_run.mjs — runner with mutation test for C10
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const FILE = 'public/app.js';
const original = readFileSync(FILE, 'utf8');

function run(label) {
  try {
    const out = execSync('node tools/verify_c10.mjs', { encoding: 'utf8' });
    const m = out.match(/(\d+)\/(\d+)/g);
    const score = m ? m[m.length - 1] : '?';
    console.log(`[${label}] ${score}`);
    const [pass, total] = score.split('/').map(Number);
    return pass === total;
  } catch (e) {
    const out = e.stdout || e.message || '';
    const m = out.match(/(\d+)\/(\d+)/g);
    const score = m ? m[m.length - 1] : '?';
    console.log(`[${label}] MERAH ${score}`);
    return false;
  }
}

// Baseline
const baseOk = run('baseline');
if (!baseOk) { console.error('Baseline MERAH'); process.exit(1); }

// Mutation: rusak toggleLang pada public/app.js
const mutated = original.replace(
  /toggleLang\(\) \{[\s\S]*?\n  \},/,
  '/* toggleLang removed */'
);
writeFileSync(FILE, mutated);
const mutOk = run('mutasi toggleLang dihapus');
writeFileSync(FILE, original);

const restoreOk = run('restore');
if (!restoreOk) { console.error('Restore gagal'); process.exit(1); }
if (mutOk) { console.error('Mutasi tidak terdeteksi'); process.exit(1); }

console.log('\nC10 verify_c10_run: HIJAU 13/13 (baseline OK, mutasi MERAH, restore OK)');
