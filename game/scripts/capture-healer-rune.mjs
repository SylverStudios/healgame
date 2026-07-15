/**
 * One-shot: capture combat with the armed healer rune visible.
 * Usage: node scripts/capture-healer-rune.mjs [output.png]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4175;
const SAVE_KEY = 'healgame-save-v1';
const outPath = resolve(
  process.argv[2] ?? resolve(__dirname, '../../artifacts/screenshots/healer-rune-armed.png'),
);
mkdirSync(dirname(outPath), { recursive: true });

const UI = {
  hubAshGate: { x: 480, y: 255 },
  combatTank: { x: 380, y: 308 },
};

const VIGIL_SAVE = {
  version: 3,
  tutorialDone: true,
  gold: 0,
  xp: 12,
  rubies: 0,
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 2,
    'vigil-oath': 1,
    'vigil-patient-vow': 1,
  },
  subclass: 'vigil',
  clearedDungeons: ['ash-gate'],
  combatPaceTenths: 10,
};

function startPreview() {
  return new Promise((resolvePreview, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    proc.stdout.on('data', (d) => {
      if (!settled && String(d).includes('http')) {
        settled = true;
        resolvePreview(proc);
      }
    });
    proc.on('exit', (code) => {
      if (!settled) reject(new Error(`vite preview exited (code ${code})`));
    });
    setTimeout(() => {
      if (!settled) {
        proc.kill();
        reject(new Error('preview timeout'));
      }
    }, 15_000);
  });
}

const preview = await startPreview();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(VIGIL_SAVE)],
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);

  await page.mouse.click(UI.hubAshGate.x, UI.hubAshGate.y);
  await page.waitForTimeout(1000);
  await page.mouse.click(UI.combatTank.x, UI.combatTank.y);
  await page.waitForTimeout(200);
  await page.keyboard.press('1');
  // Solemn Mend cast (2s) completes → Patient Vow synergy arms Solemn Vigil + rune.
  await page.waitForTimeout(2600);
  await page.screenshot({ path: outPath });
  console.log(`Saved: ${outPath}`);
} finally {
  await browser?.close();
  preview.kill();
}
