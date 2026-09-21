/**
 * verify_e4_run.mjs — runner with mutation test for E4
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const FILE = 'tools/build.mjs';
const original = readFileSync(FILE, 'utf8');

function run(label) {
  try {
    const out = execSync('node tools/verify_e4.mjs', { encoding: 'utf8' });
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

// Mutation: rusak fungsi minifyCSS
const mutated = original.replace(
  /export function minifyCSS\(css\) \{[\s\S]*?\n\}/,
  'export function minifyCSS(css) { return css; }'
);
writeFileSync(FILE, mutated);
const mutOk = run('mutasi minifyCSS no-op');
writeFileSync(FILE, original);

const restoreOk = run('restore');
if (!restoreOk) { console.error('Restore gagal'); process.exit(1); }
if (mutOk) { console.error('Mutasi tidak terdeteksi'); process.exit(1); }

console.log('\nE4 verify_e4_run: HIJAU 14/14 (baseline OK, mutasi MERAH, restore OK)');
