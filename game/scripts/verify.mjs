/**
 * Single quality gate: typecheck → save-compat → lint → test → build → smoke → journey.
 * Pass stages print one line; failures dump captured output.
 *
 * save-compat: on local incompat, runs bump-save-version once then rechecks.
 * On CI (CI=true) or SAVE_BUMP=0, incompat fails closed without writing.
 *
 * Usage (from game/):
 *   node scripts/verify.mjs            # full suite (includes ~5 min journey)
 *   node scripts/verify.mjs --fast     # check + smoke only (no journey)
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fast = process.argv.includes('--fast');

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

function dumpOutput(stdout, stderr) {
  const output = [stdout, stderr].filter(Boolean).join('\n').trimEnd();
  if (output) console.error(output);
}

function readSchema() {
  const p = path.join(gameRoot, 'src/save/save-version.json');
  return JSON.parse(readFileSync(p, 'utf8')).schema;
}

/**
 * @returns {Promise<{ ok: boolean, bumped?: boolean }>}
 */
async function runSaveCompatStage() {
  const before = readSchema();
  const first = await runStage({
    name: 'save-compat',
    cmd: 'node',
    args: ['scripts/save-compat.mjs'],
  });

  if (first.code === 0) {
    console.log('✓ save-compat');
    return { ok: true };
  }

  if (first.code !== 2) {
    console.error(`✗ save-compat (exit ${first.code})`);
    dumpOutput(first.stdout, first.stderr);
    return { ok: false };
  }

  const ciLocked = process.env.CI === 'true' || process.env.SAVE_BUMP === '0';
  if (ciLocked) {
    console.error('✗ save-compat');
    dumpOutput(first.stdout, first.stderr);
    console.error('save schema incompatible; run npm run save:bump locally and commit');
    return { ok: false };
  }

  const bump = await runStage({
    name: 'save:bump',
    cmd: 'node',
    args: ['scripts/bump-save-version.mjs'],
  });
  if (bump.code !== 0) {
    console.error(`✗ save-compat (bump failed, exit ${bump.code})`);
    dumpOutput(bump.stdout, bump.stderr);
    dumpOutput(first.stdout, first.stderr);
    return { ok: false };
  }
  dumpOutput(bump.stdout, bump.stderr);

  const recheck = await runStage({
    name: 'save-compat',
    cmd: 'node',
    args: ['scripts/save-compat.mjs'],
  });
  if (recheck.code !== 0) {
    console.error(`✗ save-compat (recheck after bump, exit ${recheck.code})`);
    dumpOutput(recheck.stdout, recheck.stderr);
    return { ok: false };
  }

  const after = readSchema();
  console.log(`✓ save-compat (bumped schema ${before}→${after})`);
  return { ok: true, bumped: true };
}

const stages = [
  { name: 'typecheck', cmd: 'npm', args: ['run', 'typecheck'] },
  { name: 'save-compat', kind: 'save-compat' },
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'test', cmd: 'npm', args: ['run', 'test'] },
  { name: 'build', cmd: 'npx', args: ['vite', 'build'] },
  { name: 'smoke', cmd: 'node', args: ['scripts/smoke.mjs'] },
  ...(fast ? [] : [{ name: 'journey', cmd: 'node', args: ['scripts/journey.mjs'] }]),
];

let failed = false;

for (const stage of stages) {
  if (stage.kind === 'save-compat') {
    const { ok } = await runSaveCompatStage();
    if (!ok) {
      failed = true;
      break;
    }
    continue;
  }

  const { code, stdout, stderr } = await runStage(stage);
  if (code === 0) {
    console.log(`✓ ${stage.name}`);
  } else {
    failed = true;
    console.error(`✗ ${stage.name} (exit ${code})`);
    dumpOutput(stdout, stderr);
    break;
  }
}

if (failed) {
  process.exit(1);
}

const suffix = fast ? ' (fast — journey skipped)' : '';
console.log(`verify: all ${stages.length} stages passed${suffix}`);
process.exit(0);
