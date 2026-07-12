/**
 * Single quality gate: typecheck → lint → test → build → smoke → journey.
 * Pass stages print one line; failures dump captured output.
 *
 * Usage (from game/):
 *   node scripts/verify.mjs            # full suite (includes ~5 min journey)
 *   node scripts/verify.mjs --fast     # check + smoke only (no journey)
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fast = process.argv.includes('--fast');

const stages = [
  { name: 'typecheck', cmd: 'npm', args: ['run', 'typecheck'] },
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'test', cmd: 'npm', args: ['run', 'test'] },
  { name: 'build', cmd: 'npx', args: ['vite', 'build'] },
  { name: 'smoke', cmd: 'node', args: ['scripts/smoke.mjs'] },
  ...(fast ? [] : [{ name: 'journey', cmd: 'node', args: ['scripts/journey.mjs'] }]),
];

function runStage(stage) {
  return new Promise((resolve) => {
    const proc = spawn(stage.cmd, stage.args, {
      cwd: gameRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

let failed = false;

for (const stage of stages) {
  const { code, stdout, stderr } = await runStage(stage);
  if (code === 0) {
    console.log(`✓ ${stage.name}`);
  } else {
    failed = true;
    console.error(`✗ ${stage.name} (exit ${code})`);
    const output = [stdout, stderr].filter(Boolean).join('\n').trimEnd();
    if (output) console.error(output);
    break;
  }
}

if (failed) {
  process.exit(1);
}

const suffix = fast ? ' (fast — journey skipped)' : '';
console.log(`verify: all ${stages.length} stages passed${suffix}`);
process.exit(0);
