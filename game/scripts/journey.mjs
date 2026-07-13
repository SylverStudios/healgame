/**
 * End-to-end player journey test (poc-spec §1 + phase-2-handoff +
 * alpha-0.1-handoff) in headless Chromium.
 *
 * Drives the real game with mouse/keyboard, asserts on the localStorage save
 * between stages, screenshots every scene, and fails on any console error.
 *
 * Stages:
 *   A  fresh save → tutorial → learn Solemn Mend → Ash Gate → naive-heal to a
 *      wipe → hub applies gold/XP (save is v4 from birth)
 *   A2 seeded 8 XP → one more run crosses level 2 (Zealous auto-grant ribbon)
 *   M  seeded RAW v1 payload → boot migrates to v4 (deep-reserves rank,
 *      retired-node refund, subclass → oath node, relicId/relicPickPending
 *      added) with no progress lost
 *   M2 seeded v3 payload → boot migrates to v4 (relicId: null,
 *      relicPickPending: false added, all v3 fields preserved)
 *   Relic  seeded post-first-Ash-Gate-clear save with relicPickPending true
 *      (alpha-0.1-handoff §D7) → Hub redirects straight to RelicScene → pick
 *      card 2 → relicId persists, pending clears, hub shows the relic icon,
 *      never re-offered on a later hub visit
 *   D2 seeded Ash-Gate-cleared save → hub shows Iron Pass (Dungeon 2), NOT
 *      The Maw (alpha-0.1-handoff §D1) → enter Iron Pass → return unwon
 *   B  seeded post-first-clear v4 save → tree graph: buy Deep Reserves ranks,
 *      arm + swear the Vigil oath in-tree (ruby spent, Zealot locked), buy a
 *      follow-up node → hub shows the oath
 *   B3 seeded sworn-oath + prereq-node saves → tree layer 2 (§D5): scroll to
 *      the new row, buy a Vigil mana passive + the Still Waters CD node; a
 *      second seed proves the §D4 rebalance (Steady Hands purchasable at the
 *      old Desperate Zeal slot on a Zealot save)
 *   B2 combat with the Vigil kit → hover the Solemn Vigil button → tooltip
 *      screenshot (modifier lines from the tree) + mid-fight feedback shot
 *   C  Maw gating (§D1): Ash-Gate-only save → Maw absent; Ash Gate + Iron
 *      Pass cleared → Maw present → enter → unwinnable sandbox → wipe → hub
 *
 * Ash Gate / Iron Pass victory itself is proven deterministically at engine
 * level (src/combat/balance.test.ts); stages B/B3/D2 seed the relevant save
 * states directly rather than replaying an already-proven live win — a live
 * heal-rotation would need to react to per-tick HP, which isn't observable
 * from outside the canvas, so scripting one blind would trade a real gate
 * for wall-clock-timing guesswork (the thing this project's gates exist to
 * avoid). The Relic stage seeds `relicPickPending: true` (the exact state
 * `applyCombatResult` leaves right after a real first clear) so it can
 * exercise the actual RelicScene routing/pick/persistence live instead.
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
  // Side-view facing line: tank is the rightmost party unit; 64px body is
  // bottom-aligned to GROUND_Y=340 (body spans y 276-340, centered on x 380).
  combatTank: { x: 380, y: 308 },
  combatReturn: { x: 480, y: 330 },
  // Spell bar: buttons 160w + 14 gap centered on 480, y 502; slot i of n.
  combatSpellSlot: (i, n) => ({ x: 480 - ((n - 1) * 174) / 2 + i * 174, y: 502 }),
  hubAshGate: { x: 480, y: 255 },
  hubTree: { x: 480, y: 320 },
  // With two unlocked dungeons, Iron Pass keeps the old Maw slot. Once all
  // three unlock, HubScene reflows them into a centered three-column row:
  // Ash x180, Iron x480, Maw x780, all y240.
  hubIronPass: { x: 480, y: 450 },
  hubMaw: { x: 780, y: 240 },
  // Alpha 0.1 §D7: top-right relic icon (24px diamond/circle), margin 30.
  hubRelicIcon: { x: 930, y: 30 },
  // TreeScene node graph (NODE_POSITIONS in TreeScene.ts)
  treeDeepReserves: { x: 480, y: 130 },
  treeVigilOath: { x: 260, y: 260 },
  treeZealotOath: { x: 700, y: 260 },
  treePatientVow: { x: 150, y: 400 },
  // Alpha 0.1 §D4 rebalance: zealot-steady-hands takes the retired
  // zealot-desperate-zeal slot — same position, no scroll needed.
  treeZealotSteadyHands: { x: 820, y: 400 },
  treeBack: { x: 120, y: 504 },
  // Alpha 0.1 §D5 tree layer 2: world y 650/800, below the 540-tall
  // viewport. TreeScene scrolls (WHEEL_SCROLL_SCALE 0.5, max scroll
  // 360 at WORLD_HEIGHT 900); `page.mouse.wheel(0, 720)` while hovering
  // the canvas saturates scrollY at 360. Screen coords below = world y − 360.
  treeCanvasCenter: { x: 480, y: 270 },
  treeVigilDeepWell: { x: 150, y: 290 }, // world (150, 650)
  treeVigilStillWaters: { x: 265, y: 440 }, // world (265, 800)
  // CombatScene pace toggle (bottom-left; PaceToggle origin bottom-left at 20,532).
  combatPaceToggle: { x: 48, y: 516 },
  // RelicScene: 3 cards centered at (180,290) / (480,290) / (780,290).
  relicCard: (i) => ({ x: 180 + i * 300, y: 290 }),
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
    version: 4,
    tutorialDone: true,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: ['solemn-mend'],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicId: null,
    relicPickPending: false,
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
  check(save?.version === 4, 'new saves are written as v4');
  check(save?.tutorialDone === true, 'tutorial click sets tutorialDone');
  check(save?.unlockedSpells.includes('solemn-mend') === true, 'Solemn Mend unlocked via tutorial');
  check(save?.relicId === null && save?.relicPickPending === false, 'fresh save has no relic pick pending');
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

  // ---- Stage M: v1 save migrates to v4 with no progress lost -----------------
  console.log('Stage M: raw v1 payload → boot → migrated v4 save');
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
  check(save?.version === 4, 'v1 payload migrated to version 4 on boot');
  check(save?.combatPaceTenths === 10, 'migration: default combat pace is 1×');
  check(save?.treeRanks?.['deep-reserves'] === 1, "migration: 'max-mana-1' → deep-reserves rank 1");
  check(save?.gold === 8, `migration: retired vigil-deep-focus refunded 5g (gold=${save?.gold}, expected 8)`);
  check(save?.treeRanks?.['vigil-oath'] === 1, 'migration: existing subclass owns vigil-oath at rank 1');
  check(save?.subclass === 'vigil' && save?.rubies === 0, 'migration: subclass kept, no ruby charged');
  check(save?.xp === 12 && save?.clearedDungeons?.includes('ash-gate'), 'migration: xp + clears carried over');
  check(save?.relicId === null, 'migration: v1→v4 adds relicId: null');
  check(save?.relicPickPending === false, 'migration: v1→v4 adds relicPickPending: false');
  await shot(page, 'hub-after-migration');

  // ---- Stage M2: v3 save migrates to v4 (relic fields added) -----------------
  console.log('Stage M2: v3 payload → boot → migrated v4 save (relic fields added)');
  await seedSave(page, {
    version: 3,
    tutorialDone: true,
    gold: 12,
    xp: 20,
    rubies: 1,
    unlockedSpells: ['solemn-mend', 'zealous-mending'],
    treeRanks: { 'deep-reserves': 2 },
    subclass: null,
    clearedDungeons: ['ash-gate'],
    combatPaceTenths: 15,
  });
  save = await readSave(page);
  check(save?.version === 4, 'v3 payload migrated to version 4 on boot (no fresh-save wipe)');
  check(save?.relicId === null, 'migration: v3→v4 adds relicId: null');
  check(save?.relicPickPending === false, 'migration: v3→v4 adds relicPickPending: false');
  check(save?.gold === 12 && save?.xp === 20 && save?.rubies === 1, 'migration: v3 currencies preserved');
  check(save?.combatPaceTenths === 15, 'migration: v3 combat pace preserved (not reset to default)');
  check(save?.treeRanks?.['deep-reserves'] === 2, 'migration: v3 treeRanks preserved');
  await shot(page, 'hub-after-v3-migration');

  // ---- Stage Relic: first Ash Gate clear → pick 1 of 3 → persists -----------
  console.log('Stage Relic: relicPickPending routes Hub → RelicScene → pick → persists, never re-offered');
  await seedSave(page, baseSave({ clearedDungeons: ['ash-gate'], relicPickPending: true }));
  save = await readSave(page);
  check(save?.relicPickPending === true && save?.relicId === null, 'seeded state: pick pending, nothing chosen yet');
  await shot(page, 'relic-scene-cards');

  const card2 = UI.relicCard(1); // pick the 2nd of 3 cards (Triage Bell — see data/relics.ts RELICS order)
  await page.mouse.click(card2.x, card2.y);
  await page.waitForTimeout(500);
  save = await readSave(page);
  check(save?.relicId === 'triage-bell', `picking card 2 sets relicId (relicId=${save?.relicId}, expected triage-bell)`);
  check(save?.relicPickPending === false, 'relic pick clears relicPickPending');
  await shot(page, 'hub-with-relic-icon');

  // Second hub visit (real scene nav, not just a reload): still hub, never re-offered.
  await page.mouse.click(UI.hubTree.x, UI.hubTree.y);
  await page.waitForTimeout(500);
  await page.mouse.click(UI.treeBack.x, UI.treeBack.y);
  await page.waitForTimeout(500);
  save = await readSave(page);
  check(save?.relicId === 'triage-bell' && save?.relicPickPending === false, 'relic choice persists across a second hub visit');
  await shot(page, 'hub-relic-not-reoffered');

  // A fresh boot (full reload) also lands on the normal Hub, not RelicScene, again.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  save = await readSave(page);
  check(save?.relicId === 'triage-bell', 'relic choice survives a full reload without being re-offered');
  await shot(page, 'hub-relic-after-reload');

  // ---- Stage D2: Ash Gate clear unlocks Iron Pass (not yet The Maw) --------
  console.log('Stage D2: Ash-Gate-cleared save → Iron Pass unlocked on hub, The Maw still gated');
  await seedSave(page, baseSave({ clearedDungeons: ['ash-gate'] }));
  await shot(page, 'hub-iron-pass-unlocked'); // visual: Iron Pass button present, no Maw button below it

  // Clicking where The Maw would sit is a no-op — nothing is registered there yet.
  await page.mouse.click(UI.hubMaw.x, UI.hubMaw.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(
    save?.clearedDungeons?.length === 1 && save.gold === 0 && save.xp === 0,
    'The Maw slot is inert before Iron Pass is cleared (save unchanged)',
  );

  await page.mouse.click(UI.hubIronPass.x, UI.hubIronPass.y);
  await page.waitForTimeout(1200);
  await shot(page, 'iron-pass-combat-entered'); // visual: Iron Pass encounter running (Iron Husk wave)
  // No need to play this out live — Iron Pass's clearability is an engine-level
  // gate (balance.test.ts gates 6/7). Reload to bail out without winning/wiping.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  save = await readSave(page);
  check(
    save?.clearedDungeons?.length === 1 && !save.clearedDungeons.includes('iron-pass'),
    'leaving Iron Pass mid-fight records neither a clear nor a wipe',
  );

  // ---- Stage B: post-first-clear → tree graph → oath in-tree -----------------
  console.log('Stage B: seeded post-first-clear → Deep Reserves ranks → Vigil oath in-tree');
  await seedSave(
    page,
    baseSave({
      gold: 17,
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
  check(save.gold === 7, `gold spent per rank (gold=${save.gold}, expected 7)`);

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
  await shot(page, 'tree-zealot-forsaken');

  // Rival spot offers forsaken-path Warped Tempo (not the Zealot oath).
  await page.mouse.click(UI.treeZealotOath.x, UI.treeZealotOath.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(!save.treeRanks['zealot-oath'], 'rival oath node was not purchased');
  check(save.treeRanks['warped-tempo-via-zealot'] === 1, 'bought Warped Tempo on the forsaken rival spot');
  check(save.gold === 3, `gold after tempo (gold=${save.gold}, expected 3)`);
  await shot(page, 'tree-warped-tempo-owned');

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

  // ---- Stage B3: tree layer 2 (mana focus) + §D4 rebalance ------------------
  console.log('Stage B3: sworn oath + prereq node → scroll → buy a layer-2 passive + its CD node');
  await seedSave(
    page,
    baseSave({
      gold: 13,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      subclass: 'vigil',
      treeRanks: { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
    }),
  );
  await page.mouse.click(UI.hubTree.x, UI.hubTree.y);
  await page.waitForTimeout(600);

  // Scroll to layer 2 (world y 650/800, past the 540-tall viewport): hover the
  // canvas, then wheel down enough to saturate the clamp (max scroll 360).
  await page.mouse.move(UI.treeCanvasCenter.x, UI.treeCanvasCenter.y);
  await page.mouse.wheel(0, 720);
  await page.waitForTimeout(400);
  await shot(page, 'tree-layer2-scrolled');

  await page.mouse.click(UI.treeVigilDeepWell.x, UI.treeVigilDeepWell.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-deep-well'] === 1, 'bought Deep Well (layer-2 mana passive)');
  check(save.gold === 8, `gold after Deep Well (gold=${save.gold}, expected 8)`);

  await page.mouse.click(UI.treeVigilStillWaters.x, UI.treeVigilStillWaters.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-still-waters'] === 1, 'bought Still Waters (layer-2 CD grant node)');
  check(save.gold === 0, `gold after Still Waters (gold=${save.gold}, expected 0)`);
  await shot(page, 'tree-layer2-bought');

  await page.mouse.click(UI.treeBack.x, UI.treeBack.y);
  await page.waitForTimeout(400);

  // §D4 rebalance: zealot-steady-hands takes the retired zealot-desperate-zeal
  // slot (same position, no scroll) — separate lean seed, own branch is enough.
  await seedSave(
    page,
    baseSave({
      gold: 6,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      subclass: 'zealot',
      treeRanks: { 'deep-reserves': 1, 'zealot-oath': 1 },
    }),
  );
  await page.mouse.click(UI.hubTree.x, UI.hubTree.y);
  await page.waitForTimeout(600);
  await page.mouse.click(UI.treeZealotSteadyHands.x, UI.treeZealotSteadyHands.y);
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['zealot-steady-hands'] === 1, 'Steady Hands purchasable at the retired Desperate Zeal slot');
  check(save.gold === 1, `gold after Steady Hands (gold=${save.gold}, expected 1)`);
  await shot(page, 'tree-zealot-steady-hands-rebalance');

  // ---- Stage B2: Vigil kit in combat — tooltip reflects tree modifiers -------
  console.log('Stage B2: combat with the Vigil kit → pace toggle + tooltip + feedback');
  await seedSave(
    page,
    baseSave({
      gold: 0,
      xp: 12,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      subclass: 'vigil',
      treeRanks: { 'deep-reserves': 2, 'vigil-oath': 1, 'vigil-patient-vow': 1, 'warped-tempo-via-zealot': 1 },
      clearedDungeons: ['ash-gate'],
    }),
  );
  await page.mouse.click(UI.hubAshGate.x, UI.hubAshGate.y);
  await page.waitForTimeout(1200);
  await page.mouse.click(UI.combatPaceToggle.x, UI.combatPaceToggle.y);
  await page.waitForTimeout(300);
  save = await readSave(page);
  check(save.combatPaceTenths === 15, 'pace toggle persisted 1.5× selection');
  await shot(page, 'combat-pace-15x');
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

  // ---- Stage C: Maw gating (§D1) — gated on Iron Pass, still unwinnable -----
  console.log('Stage C: Maw gating — absent after Ash Gate alone, present + unwinnable after Iron Pass too');
  await seedSave(page, baseSave({ clearedDungeons: ['ash-gate', 'iron-pass'] }));
  save = await readSave(page);
  const xpBeforeMaw = save.xp;
  await shot(page, 'hub-maw-unlocked'); // visual: The Maw button now present below Iron Pass
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
  if (preview) {
    preview.stdout?.destroy();
    preview.stderr?.destroy();
    preview.kill('SIGKILL');
  }
}

for (const e of consoleErrors) failures.push(`console error: ${e}`);
if (failures.length > 0) {
  console.error(`\nJOURNEY FAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nJOURNEY PASS: full Alpha 0.1 player journey verified in-browser');
