/**
 * End-to-end player journey test (poc-spec §1 + phase-2-handoff) in headless
 * Chromium.
 *
 * Drives the real game with mouse/keyboard, asserts on the localStorage save
 * between stages, screenshots every scene, and fails on any console error.
 *
 * Stages:
 *   A  fresh save → tutorial → learn Solemn Mend → Ash Gate → naive-heal to a
 *      wipe → hub applies gold/XP (save is v2 from birth)
 *   A2 seeded 8 XP → one more run crosses level 2 (Zealous auto-grant ribbon)
 *   M  seeded RAW v1 payload → boot migrates to v2 (deep-reserves rank,
 *      retired-node refund, subclass → oath node) with no progress lost
 *   B  seeded post-first-clear v2 save → tree graph: buy Deep Reserves ranks,
 *      arm + swear the Vigil oath in-tree (ruby spent, Zealot locked), buy a
 *      follow-up node → hub shows the oath
 *   B2 combat with the Vigil kit → hover the Solemn Vigil button → tooltip
 *      screenshot (modifier lines from the tree) + mid-fight feedback shot
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
  // Spell bar: buttons 160w + 14 gap centered on 480, y 502; slot i of n.
  combatSpellSlot: (i, n) => ({ x: 480 - ((n - 1) * 174) / 2 + i * 174, y: 502 }),
  hubAshGate: { x: 480, y: 255 },
  hubTree: { x: 480, y: 320 },
  hubMaw: { x: 480, y: 450 },
  // TreeScene node graph (NODE_POSITIONS in TreeScene.ts)
  treeDeepReserves: { x: 480, y: 130 },
  treeVigilOath: { x: 260, y: 260 },
  treeZealotOath: { x: 700, y: 260 },
  treePatientVow: { x: 150, y: 400 },
  treeBack: { x: 120, y: 504 },
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
    version: 2,
    tutorialDone: true,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: ['solemn-mend'],
    treeRanks: {},
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
  check(save?.version === 2, 'new saves are written as v2');
  check(save?.tutorialDone === true, 'tutorial click sets tutorialDone');
  check(save?.unlockedSpells.includes('solemn-mend') === true, 'Solemn Mend unlocked via tutorial');
  await page.waitForTimeout(3500); // let autos land so lunge/'*' feedback is in frame
  await shot(page, 'ash-gate-first-run-feedback');

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

  // ---- Stage M: v1 save migrates to v2 with no progress lost -----------------
  console.log('Stage M: raw v1 payload → boot → migrated v2 save');
  await seedSave(page, {
    version: 1,
    tutorialDone: true,
    gold: 3,
    xp: 12,
    rubies: 0,
    unlockedSpells: ['solemn-mend', 'zealous-mending'],
    treeNodes: ['max-mana-1', 'vigil-deep-focus'],
    subclass: 'vigil',
    clearedDungeons: ['ash-gate'],
  });
  save = await readSave(page);
  check(save?.version === 2, 'v1 payload migrated to version 2 on boot');
  check(save?.treeRanks?.['deep-reserves'] === 1, "migration: 'max-mana-1' → deep-reserves rank 1");
  check(save?.gold === 8, `migration: retired vigil-deep-focus refunded 5g (gold=${save?.gold}, expected 8)`);
  check(save?.treeRanks?.['vigil-oath'] === 1, 'migration: existing subclass owns vigil-oath at rank 1');
  check(save?.subclass === 'vigil' && save?.rubies === 0, 'migration: subclass kept, no ruby charged');
  check(save?.xp === 12 && save?.clearedDungeons?.includes('ash-gate'), 'migration: xp + clears carried over');
  await shot(page, 'hub-after-migration');

  // ---- Stage B: post-first-clear → tree graph → oath in-tree -----------------
  console.log('Stage B: seeded post-first-clear → Deep Reserves ranks → Vigil oath in-tree');
  await seedSave(
    page,
    baseSave({
      gold: 13,
      xp: 12,
      rubies: 1,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      clearedDungeons: ['ash-gate'],
    }),
  );
  await shot(page, 'hub-post-first-clear');

  await page.mouse.click(UI.hubTree.x, UI.hubTree.y);
  await page.waitForTimeout(600);
  await shot(page, 'tree-graph-before-buy');

  // Multi-rank root: two ranks of Deep Reserves (5g each).
  await page.mouse.click(UI.treeDeepReserves.x, UI.treeDeepReserves.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['deep-reserves'] === 1, 'bought Deep Reserves rank 1');
  await page.mouse.click(UI.treeDeepReserves.x, UI.treeDeepReserves.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['deep-reserves'] === 2, 'bought Deep Reserves rank 2 (multi-rank node)');
  check(save.gold === 3, `gold spent per rank (gold=${save.gold}, expected 3)`);

  // Oath is two-click: first click only ARMS (no purchase yet).
  await page.mouse.click(UI.treeVigilOath.x, UI.treeVigilOath.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(!save.treeRanks['vigil-oath'] && save.rubies === 1, 'first oath click arms only — nothing bought');
  await shot(page, 'tree-vigil-oath-armed');
  await page.mouse.click(UI.treeVigilOath.x, UI.treeVigilOath.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-oath'] === 1, 'second click swears the Vigil oath in-tree');
  check(save.subclass === 'vigil', 'oath purchase set subclass = vigil');
  check(save.rubies === 0, 'ruby spent on the oath');
  check(save.unlockedSpells.includes('solemn-vigil') === false, 'granted spell comes from the tree, not unlockedSpells');
  await shot(page, 'tree-zealot-locked');

  // Zealot oath must now be permanently locked: clicks do nothing.
  await page.mouse.click(UI.treeZealotOath.x, UI.treeZealotOath.y);
  await page.mouse.click(UI.treeZealotOath.x, UI.treeZealotOath.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(!save.treeRanks['zealot-oath'] && save.subclass === 'vigil', 'rival oath is locked — clicks are inert');

  // Follow-up branch node (3g) unlocked by the oath.
  await page.mouse.click(UI.treePatientVow.x, UI.treePatientVow.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-patient-vow'] === 1, 'bought Patient Vow rank 1 behind the oath');
  check(save.gold === 0, `gold spent on follow-up (gold=${save.gold}, expected 0)`);
  await shot(page, 'tree-vigil-branch-owned');

  await page.mouse.click(UI.treeBack.x, UI.treeBack.y);
  await page.waitForTimeout(600);
  await shot(page, 'hub-with-oath');

  // ---- Stage B2: Vigil kit in combat — tooltip reflects tree modifiers -------
  console.log('Stage B2: combat with the Vigil kit → Solemn Vigil tooltip + feedback');
  await page.mouse.click(UI.hubAshGate.x, UI.hubAshGate.y);
  await page.waitForTimeout(1200);
  const vigilSlot = UI.combatSpellSlot(2, 3); // solemn-mend, zealous-mending, solemn-vigil
  await page.mouse.move(vigilSlot.x, vigilSlot.y);
  await page.waitForTimeout(400);
  await shot(page, 'combat-solemn-vigil-tooltip');
  await page.mouse.move(480, 270); // off the button
  await page.waitForTimeout(4000); // let autos land for feedback frame
  await shot(page, 'combat-feedback-midfight');
  save = await playCombat(page, (s) => s.xp > 12);
  check(save.xp > 12, 'Vigil-kit run banked XP');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);

  // ---- Stage C: The Maw (unwinnable sandbox) --------------------------------
  console.log('Stage C: The Maw — enter, get flattened, return');
  save = await readSave(page);
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
console.log('\nJOURNEY PASS: full Phase-2 player journey verified in-browser');
