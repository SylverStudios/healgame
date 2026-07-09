/**
 * End-to-end PoC journey test (poc-spec §1) in headless Chromium.
 *
 * Drives the real game with mouse/keyboard, asserts on the localStorage save
 * between stages, screenshots every scene, and fails on any console error.
 *
 * Stages:
 *   A  fresh save → tutorial → learn Solemn Mend → Ash Gate → naive-heal to a
 *      wipe → hub applies gold/XP
 *   A2 seeded 8 XP → one more run crosses level 2 (Zealous auto-grant ribbon)
 *   B  seeded post-first-clear save → buy tree node → choose Vigil subclass
 *      (blind, 1 ruby) → oath shown, branch node visible
 *   C  enter The Maw → unwinnable sandbox → wipe → back to hub
 *
 * Ash Gate victory itself is proven deterministically at engine level
 * (src/combat/balance.test.ts); stage B seeds the post-clear save state.
 *
 * Usage: node scripts/journey.mjs [--shots DIR]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const shotsDir = (() => {
  const i = args.indexOf('--shots');
  return i >= 0 && args[i + 1] ? args[i + 1] : 'journey-shots';
})();
mkdirSync(shotsDir, { recursive: true });

const PORT = 4174;
const SAVE_KEY = 'healgame-save-v1';

// Scene layout constants (must match the scenes' layout constants; 960x540 viewport = 1:1 mapping)
const UI = {
  tutorialLearn: { x: 480, y: 430 },
  combatTank: { x: 170, y: 95 },
  combatReturn: { x: 480, y: 330 },
  hubAshGate: { x: 480, y: 255 },
  hubTree: { x: 480, y: 320 },
  hubSubclass: { x: 480, y: 385 },
  hubMaw: { x: 480, y: 450 },
  treeFirstNode: { x: 480, y: 150 },
  treeBack: { x: 480, y: 504 },
  subclassVigil: { x: 260, y: 280 },
};

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

const failures = [];
const consoleErrors = [];
let shotIndex = 0;

function check(cond, label) {
  if (cond) {
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.error(`  FAIL: ${label}`);
  }
}

async function shot(page, name) {
  shotIndex += 1;
  const path = `${shotsDir}/${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path });
  console.log(`  shot: ${path}`);
}

async function readSave(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function seedSave(page, save) {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(save)],
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
}

function baseSave(overrides) {
  return {
    version: 1,
    tutorialDone: true,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: ['solemn-mend'],
    treeNodes: [],
    subclass: null,
    clearedDungeons: [],
    ...overrides,
  };
}

/**
 * Naive combat loop: target the tank, then every 2s press "1" (cast) and
 * blind-click where the result overlay's Return button will appear (inert
 * during the fight). Ends when `until(save)` first holds; the loop's blind
 * Return click is what moves wipe → hub, where the result gets applied.
 */
async function playCombat(page, until, timeoutMs = 180_000) {
  await page.mouse.click(UI.combatTank.x, UI.combatTank.y);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page.keyboard.press('1');
    await page.mouse.click(UI.combatReturn.x, UI.combatReturn.y);
    await page.waitForTimeout(2000);
    const save = await readSave(page);
    if (save && until(save)) return save;
  }
  throw new Error('playCombat timed out before the until() condition held');
}

const preview = await startPreview();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  // ---- Stage A: fresh save → tutorial → wipe run → hub -----------------------
  console.log('Stage A: tutorial → Ash Gate first run (expected wipe) → hub');
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  await shot(page, 'tutorial');
  check((await readSave(page)) === null, 'fresh boot has no save');

  await page.mouse.click(UI.tutorialLearn.x, UI.tutorialLearn.y);
  await page.waitForTimeout(800);
  let save = await readSave(page);
  check(save?.tutorialDone === true, 'tutorial click sets tutorialDone');
  check(save?.unlockedSpells.includes('solemn-mend') === true, 'Solemn Mend unlocked via tutorial');
  await shot(page, 'ash-gate-first-run');

  save = await playCombat(page, (s) => s.xp > 0);
  check(save.gold > 0 && save.xp > 0, `first run banked gold+XP through the wipe (gold=${save.gold}, xp=${save.xp})`);
  check(save.rubies === 0, 'no ruby without a clear');
  check(save.clearedDungeons.length === 0, 'Ash Gate not marked cleared by a wipe');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  await shot(page, 'hub-after-first-wipe');

  // ---- Stage A2: level ding auto-grants Zealous Mending ----------------------
  console.log('Stage A2: run that crosses 10 XP → Zealous Mending auto-grant');
  await seedSave(page, baseSave({ gold: 3, xp: 8 }));
  await page.mouse.click(UI.hubAshGate.x, UI.hubAshGate.y);
  await page.waitForTimeout(1000);
  save = await playCombat(page, (s) => s.xp >= 10);
  check(save.unlockedSpells.includes('zealous-mending'), 'level 2 auto-granted Zealous Mending (no spend UI)');
  await shot(page, 'hub-level-up-ribbon');

  // ---- Stage B: post-first-clear → tree buy → subclass split -----------------
  console.log('Stage B: seeded post-first-clear → tree node → Vigil oath');
  await seedSave(
    page,
    baseSave({
      gold: 9,
      xp: 12,
      rubies: 1,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      clearedDungeons: ['ash-gate'],
    }),
  );
  await shot(page, 'hub-post-first-clear');

  await page.mouse.click(UI.hubTree.x, UI.hubTree.y);
  await page.waitForTimeout(600);
  await shot(page, 'tree-before-buy');
  await page.mouse.click(UI.treeFirstNode.x, UI.treeFirstNode.y);
  await page.waitForTimeout(600);
  save = await readSave(page);
  check(save.treeNodes.includes('max-mana-1'), 'bought Deep Reserves (gold tree node)');
  check(save.gold === 4, `gold spent on node (gold=${save.gold}, expected 4)`);
  await shot(page, 'tree-after-buy');
  await page.mouse.click(UI.treeBack.x, UI.treeBack.y);
  await page.waitForTimeout(600);

  await page.mouse.click(UI.hubSubclass.x, UI.hubSubclass.y);
  await page.waitForTimeout(600);
  await shot(page, 'subclass-cards-blind');
  await page.mouse.click(UI.subclassVigil.x, UI.subclassVigil.y);
  await page.waitForTimeout(400);
  await shot(page, 'subclass-vigil-armed');
  await page.mouse.click(UI.subclassVigil.x, UI.subclassVigil.y);
  await page.waitForTimeout(2000); // sealed confirmation auto-returns to hub
  save = await readSave(page);
  check(save.subclass === 'vigil', 'oath sealed: subclass = vigil');
  check(save.rubies === 0, 'ruby spent on the oath');
  await shot(page, 'hub-with-oath');

  await page.mouse.click(UI.hubTree.x, UI.hubTree.y);
  await page.waitForTimeout(600);
  await shot(page, 'tree-vigil-branch-visible');
  await page.mouse.click(UI.treeBack.x, UI.treeBack.y);
  await page.waitForTimeout(600);

  // ---- Stage C: The Maw (unwinnable sandbox) --------------------------------
  console.log('Stage C: The Maw — enter, get flattened, return');
  const xpBeforeMaw = save.xp;
  await page.mouse.click(UI.hubMaw.x, UI.hubMaw.y);
  await page.waitForTimeout(1000);
  await shot(page, 'maw-combat-start');
  await page.waitForTimeout(24_000);
  await shot(page, 'maw-mid-fight');
  save = await playCombat(page, (s) => s.xp > xpBeforeMaw, 240_000);
  check(save.clearedDungeons.includes('the-maw') === false, 'The Maw was not cleared (sandbox)');
  check(save.xp > xpBeforeMaw, 'Maw trash still paid XP through the wipe');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  await shot(page, 'hub-after-maw');
} finally {
  await browser?.close();
  preview.kill();
}

for (const e of consoleErrors) failures.push(`console error: ${e}`);
if (failures.length > 0) {
  console.error(`\nJOURNEY FAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nJOURNEY PASS: full PoC player journey verified in-browser');
