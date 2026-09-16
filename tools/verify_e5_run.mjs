/**
 * verify_e5_run.mjs — runner with mutation test for E5
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const FILE = 'functions/_logger.js';
const original = readFileSync(FILE, 'utf8');

function run(label) {
  try {
    const out = execSync('node tools/verify_e5.mjs', { encoding: 'utf8' });
    const m = out.match(/(\d+)\/(\d+)/);
    const score = m ? `${m[1]}/${m[2]}` : '?';
    console.log(`[${label}] ${score}`);
    return parseInt(m?.[1] ?? 0) === parseInt(m?.[2] ?? 1);
  } catch (e) {
    const m = (e.stdout || '').match(/(\d+)\/(\d+)/);
    console.log(`[${label}] MERAH ${m ? m[1]+'/'+m[2] : ''}`);
    return false;
  }
}

const baseOk = run('baseline');
if (!baseOk) { console.error('Baseline MERAH'); process.exit(1); }

// Mutation: hapus noop methods body
const mutated = original.replace(
  /const NOOP_LOGGER = \{[\s\S]*?\};/,
  'const NOOP_LOGGER = {};'
);
writeFileSync(FILE, mutated);
const mutOk = run('mutasi NOOP dihapus');
writeFileSync(FILE, original);

const restoreOk = run('restore');
if (!restoreOk) { console.error('Restore gagal'); process.exit(1); }
if (mutOk) { console.error('Mutasi tidak terdeteksi'); process.exit(1); }

console.log('\nE5 verify_e5_run: HIJAU (baseline OK, mutasi MERAH, restore OK)');
