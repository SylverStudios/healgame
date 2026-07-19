/**
 * Browser smoke test: builds are not enough — this boots the real game in
 * headless Chromium and fails on any console error / pageerror.
 *
 * Usage: node scripts/smoke.mjs [--screenshot out.png] [--wait ms]
 * Serves the production build via `vite preview` on a free port.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { freePort } from './lib/freePort.mjs';

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const screenshotPath = argValue('--screenshot', null);
const waitMs = Number(argValue('--wait', '3000'));

const PORT = await freePort();

function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: new URL('..', import.meta.url).pathname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    proc.stdout.on('data', (d) => {
      if (!settled && String(d).includes('http')) {
        settled = true;
        resolve(proc);
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('exit', (code) => {
      if (!settled) reject(new Error(`vite preview exited early (code ${code})`));
    });
    setTimeout(() => {
      if (!settled) {
        proc.kill();
        reject(new Error('vite preview did not start within 15s'));
      }
    }, 15_000);
  });
}

const preview = await startPreview();
const errors = [];
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 980, height: 560 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(waitMs);

  const hasCanvas = await page.evaluate(() => document.querySelector('canvas') !== null);
  if (!hasCanvas) errors.push('no <canvas> element found — Phaser did not boot');

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
    console.log(`screenshot: ${screenshotPath}`);
  }
} finally {
  await browser?.close();
  if (preview) {
    preview.stdout?.destroy();
    preview.stderr?.destroy();
    preview.kill('SIGKILL');
  }
}

if (errors.length > 0) {
  console.error('SMOKE FAIL:');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('SMOKE PASS: game boots headless with zero console errors');
