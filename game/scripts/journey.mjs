/**
 * End-to-end player journey test (poc-spec §1 + phase-2-handoff +
 * alpha-0.1-handoff) in headless Chromium.
 *
 * Drives the real game with mouse/keyboard, asserts on the localStorage save
 * between stages, screenshots every scene, and fails on any console error.
 *
 * Stages:
 *   A  fresh save → tutorial → learn Solemn Mend → Ash Gate → naive-heal to a
 *      wipe → hub applies kill XP (save is v7 from birth)
 *   A2 seeded 8 XP → one more run crosses level 2 (Zealous auto-grant ribbon)
 *   M  seeded stale v4 payload → boot discards it and starts fresh
 *   Relic  seeded post-first-clear save with a pending three-card offer
 *      → Hub redirects straight to RelicScene → pick card 2 → relic persists,
 *      never re-offered on a later hub visit
 *   D2 seeded Ash-Gate-cleared save → hub shows Iron Pass (Dungeon 2), NOT
 *      The Maw (alpha-0.1-handoff §D1) → enter Iron Pass → return unwon
 *   B  seeded post-first-clear save → tree graph: buy Deep Reserves ranks,
 *      arm + swear the Vigil oath in-tree (talent placed, Zealot locked), buy a
 *      follow-up node → hub shows the oath
 *   B3 v0.3 lattice (fits the fixed canvas, no scroll): sworn Vigil + Patient
 *      Vow → Still Waters, shared mid (mend potency), Virtue Vowstrike, Wrath
 *      Ascendant crown (level-gated); second seed proves Steady Hands still
 *      purchasable on Zealot path
 *   B2 combat with the Vigil kit → hover the Solemn Vigil button → tooltip
 *      screenshot (modifier lines from the tree) + mid-fight feedback shot
 *   C  Maw gating (§D1): Ash-Gate-only save → Maw absent; Ash Gate + Iron
 *      Pass cleared → Maw present → enter → unwinnable sandbox → wipe → hub
 *   Settings  v0.3 chunk H: hubSettings → SettingsScene (slider + Back
 *      visible) → click slider center (~50%) → click track's left edge via a
 *      relative offset from the located center (0%) → settingsBack → hub
 *
 * Ash Gate / Iron Pass victory itself is proven deterministically at engine
 * level (src/combat/balance.test.ts); stages B/B3/D2 seed the relevant save
 * states directly rather than replaying an already-proven live win — a live
 * heal-rotation would need to react to per-tick HP, which isn't observable
 * from outside the canvas, so scripting one blind would trade a real gate
 * for wall-clock-timing guesswork (the thing this project's gates exist to
 * avoid). The Relic stage seeds `pendingRelicOffers` (the exact state
 * `applyCombatResult` leaves after a first clear) so it can
 * exercise the actual RelicScene routing/pick/persistence live instead.
 *
 * Usage: node scripts/journey.mjs [--shots DIR]
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { freePort } from './lib/freePort.mjs';

const args = process.argv.slice(2);
const shotsDir = (() => {
  const i = args.indexOf('--shots');
  return i >= 0 && args[i + 1] ? args[i + 1] : 'journey-shots';
})();
mkdirSync(shotsDir, { recursive: true });

const PORT = await freePort();
const SAVE_KEY = 'healgame-save-v8';

/** Resolve a semantic GameObject name via window.__healgame (src/debug/testHooks.ts). */
const locate = (page, name) =>
  page.evaluate((n) => window.__healgame?.locate(n) ?? null, name);

async function clickNamed(page, name) {
  const pos = await locate(page, name);
  if (!pos) {
    const names = await page.evaluate(() => window.__healgame?.list() ?? []);
    throw new Error(`no visible target "${name}"; visible: ${names.join(', ')}`);
  }
  await page.mouse.click(pos.x, pos.y);
}

async function hoverNamed(page, name) {
  const pos = await locate(page, name);
  if (!pos) {
    const names = await page.evaluate(() => window.__healgame?.list() ?? []);
    throw new Error(`no visible target "${name}"; visible: ${names.join(', ')}`);
  }
  await page.mouse.move(pos.x, pos.y);
}

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
    version: 8,
    tutorialDone: true,
    xp: 0,
    unlockedSpells: ['bonk', 'solemn-mend'],
    actionBar: ['bonk', 'solemn-mend', '', ''],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicIds: [],
    pendingRelicOffers: [],
    musicVolumePct: 50,
    recentRuns: [],
    ...overrides,
  };
}

/**
 * Naive combat loop: target the tank, then every 2s cast Solemn Mend (by
 * semantic name so Bonk-on-Q loadouts still heal) and click Return when the
 * result overlay exists. Ends when `until(save)` first holds.
 *
 * `resultShotName`, if given: the first time combatReturn is located (the
 * result object exists immediately, alpha-staged — see CombatScene), wait
 * for the wipe/victory transition + summary panel (outcome, XP, build glyph;
 * v0.3 chunk E, ~0.5-1.0s transition + staggered reveals, Return last around
 * ~1s) to fully settle before screenshotting, then click through as usual.
 *
 * `castShotNames`, if given ({ castPose, healLand }): no pre-loop shot ever
 * catches the healer casting — every earlier wait in this file has no spell
 * click near it, so the healer is always idle at those frames. The very
 * first Solemn Mend click this loop already makes is reused (no new click)
 * to grab a mid-cast frame (~700ms into Solemn Mend's 2000ms cast bar, v0.3
 * chunk F healer cast pose) and a heal-landed frame shortly after
 * completion (heal-vfx sparkle).
 *
 * `bubbleShotName`, if given: v0.3 chunk G fires the wipe/victory banter bubble at the very
 * start of showResultOverlay(), depth-below the summary panel (so the panel stays readable
 * once it's fully in) — the panel's own slide-in tween (~120-620ms) can end up covering the
 * tank's on-screen slot well before this loop's normal 2000ms poll cadence would even notice
 * combatReturn exists. While a bubble shot is still pending, the loop tightens its poll to
 * 100ms (reverting to the normal cadence right after) so it catches combatReturn — and takes
 * the shot — within ~100-250ms of the transition actually starting, comfortably inside the
 * bubble's fade-in and well before the panel finishes covering that screen position.
 */
async function playCombat(page, until, timeoutMs = 180_000, resultShotName, castShotNames, bubbleShotName) {
  await clickNamed(page, 'combatAlly:tank');
  const start = Date.now();
  let resultShot = false;
  let castShotDone = false;
  let bubbleShot = false;
  while (Date.now() - start < timeoutMs) {
    if (await locate(page, 'combatSpell:solemn-mend')) {
      await clickNamed(page, 'combatSpell:solemn-mend');
      if (castShotNames && !castShotDone) {
        castShotDone = true;
        await page.waitForTimeout(700);
        await shot(page, castShotNames.castPose);
        await page.waitForTimeout(1500);
        await shot(page, castShotNames.healLand);
      }
    } else {
      await page.keyboard.press('q');
    }
    if (await locate(page, 'combatReturn')) {
      if (bubbleShotName && !bubbleShot) {
        bubbleShot = true;
        await page.waitForTimeout(150);
        await shot(page, bubbleShotName);
      }
      if (resultShotName && !resultShot) {
        resultShot = true;
        await page.waitForTimeout(1300);
        await shot(page, resultShotName);
      }
      await clickNamed(page, 'combatReturn');
    }
    const tickWaitMs = bubbleShotName && !bubbleShot ? 100 : 2000;
    await page.waitForTimeout(tickWaitMs);
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

  await clickNamed(page, 'tutorialLearn');
  await page.waitForTimeout(800);
  let save = await readSave(page);
  check(save?.version === 8, 'new saves are written as v8');
  check(save?.tutorialDone === true, 'tutorial click sets tutorialDone');
  check(save?.unlockedSpells.includes('solemn-mend') === true, 'Solemn Mend unlocked via tutorial');
  check(save?.unlockedSpells.includes('bonk') === true, 'Bonk is unlocked from the start');
  check(save?.actionBar?.[0] === 'bonk', 'Bonk sits on Q by default');
  check(save?.actionBar?.[1] === 'solemn-mend', 'Solemn Mend sits on W after tutorial');
  check(save?.relicIds.length === 0 && save?.pendingRelicOffers.length === 0, 'fresh save has no relic pick pending');
  await page.waitForTimeout(3500); // let autos land so lunge/'*' feedback is in frame
  await shot(page, 'ash-gate-first-run-feedback');

  save = await playCombat(
    page,
    (s) => s.xp > 0,
    180_000,
    'combat-wipe-summary',
    { castPose: 'combat-healer-cast-pose', healLand: 'combat-heal-sparkle' },
    'combat-wipe-banter', // v0.3 chunk G: tank's wipe speech bubble, caught just as the transition starts
  );
  check(save.xp > 0, `first run banked kill XP through the wipe (xp=${save.xp})`);
  check(save.clearedDungeons.length === 0, 'Ash Gate not marked cleared by a wipe');
  check(
    save.recentRuns.length === 1 && save.recentRuns[0].outcome === 'wipe',
    'wipe pushed exactly one RunRecord onto recentRuns',
  );
  check(save.recentRuns[0].dungeonId === 'ash-gate', 'RunRecord records the dungeon id');
  check(save.recentRuns[0].xpGained === save.xp, 'RunRecord xpGained matches the banked run XP (no prior runs)');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  await shot(page, 'hub-after-first-wipe');

  // ---- Stage A2: level ding auto-grants Zealous Mending ----------------------
  console.log('Stage A2: run that crosses 10 XP → Zealous Mending auto-grant');
  await seedSave(page, baseSave({ xp: 8 }));
  await clickNamed(page, 'hubDungeon:ash-gate');
  await page.waitForTimeout(1000);
  save = await playCombat(page, (s) => s.xp >= 10);
  check(save.unlockedSpells.includes('zealous-mending'), 'level 2 auto-granted Zealous Mending (no spend UI)');
  await shot(page, 'hub-level-up-ribbon');

  // ---- Stage M: stale development save is discarded --------------------------
  console.log('Stage M: stale v4 payload → boot → fresh tutorial');
  await seedSave(page, {
    version: 4,
    tutorialDone: true,
    xp: 999,
    unlockedSpells: ['solemn-mend', 'zealous-mending'],
    treeRanks: { 'deep-reserves': 5, 'vigil-oath': 1 },
    subclass: 'vigil',
    clearedDungeons: ['ash-gate'],
    combatPaceTenths: 15,
    relicIds: ['triage-bell'],
    pendingRelicOffers: [],
  });
  save = await readSave(page);
  check(save === null, 'stale save payload was deleted instead of migrated');
  check((await locate(page, 'tutorialLearn')) !== null, 'stale save returns to the fresh tutorial');
  await shot(page, 'tutorial-after-stale-save-wipe');

  // ---- Stage Relic: first Ash Gate clear → pick 1 of 3 → persists -----------
  console.log('Stage Relic: pending offer routes Hub → RelicScene → pick → persists');
  await seedSave(page, baseSave({
    clearedDungeons: ['ash-gate'],
    pendingRelicOffers: ['ember-ledger', 'triage-bell', 'still-reservoir'],
  }));
  save = await readSave(page);
  check(save?.pendingRelicOffers.length === 3 && save?.relicIds.length === 0, 'seeded state: pick pending, nothing chosen yet');
  await shot(page, 'relic-scene-cards');

  const card2 = await locate(page, 'relicCard:triage-bell'); // 2nd of 3 — see data/relics.ts RELICS order
  check(card2 !== null, 'RelicScene exposes relicCard:triage-bell');
  await clickNamed(page, 'relicCard:triage-bell');
  await page.waitForTimeout(500);
  save = await readSave(page);
  check(save?.relicIds.includes('triage-bell'), 'picking card 2 appends the relic');
  check(save?.pendingRelicOffers.length === 0, 'relic pick clears the pending offer');
  check((await locate(page, 'runMod:triage-bell')) !== null, 'hub run-mods bar shows chosen relic');
  await shot(page, 'hub-with-relic-icon');

  // Second hub visit (real scene nav, not just a reload): still hub, never re-offered.
  await clickNamed(page, 'hubTree');
  await page.waitForTimeout(500);
  await clickNamed(page, 'treeBack');
  await page.waitForTimeout(500);
  save = await readSave(page);
  check(save?.relicIds.includes('triage-bell') && save?.pendingRelicOffers.length === 0, 'relic choice persists across a second hub visit');
  await shot(page, 'hub-relic-not-reoffered');

  // A fresh boot (full reload) also lands on the normal Hub, not RelicScene, again.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  save = await readSave(page);
  check(save?.relicIds.includes('triage-bell'), 'relic choice survives a full reload without being re-offered');
  await shot(page, 'hub-relic-after-reload');

  // ---- Stage D2: Ash Gate clear unlocks Iron Pass (not yet Cinder Vault / Maw) --------
  console.log('Stage D2: Ash-Gate-cleared save → Iron Pass unlocked on hub, later dungeons still gated');
  await seedSave(page, baseSave({ clearedDungeons: ['ash-gate'] }));
  await shot(page, 'hub-iron-pass-unlocked'); // visual: Iron Pass button present, no Maw button below it

  // Later dungeon buttons must not exist yet — locate is null (not an inert pixel click).
  check((await locate(page, 'hubDungeon:the-maw')) === null, 'The Maw button absent before Black Choir is cleared');
  check((await locate(page, 'hubDungeon:cinder-vault')) === null, 'Cinder Vault absent before Iron Pass is cleared');
  check((await locate(page, 'hubDungeon:iron-pass')) !== null, 'Iron Pass button present after Ash Gate clear');

  await clickNamed(page, 'hubDungeon:iron-pass');
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
      xp: 100,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      clearedDungeons: ['ash-gate'],
    }),
  );
  await shot(page, 'hub-post-first-clear');

  await clickNamed(page, 'hubTree');
  await page.waitForTimeout(600);
  await shot(page, 'tree-graph-before-buy');

  // Multi-rank root: two one-point ranks of Deep Reserves.
  await clickNamed(page, 'treeNode:deep-reserves');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['deep-reserves'] === 1, 'bought Deep Reserves rank 1');
  await clickNamed(page, 'treeNode:deep-reserves');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['deep-reserves'] === 2, 'bought Deep Reserves rank 2 (multi-rank node)');

  // Oath is two-click: first click only ARMS (no purchase yet).
  await clickNamed(page, 'treeNode:vigil-oath');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(!save.treeRanks['vigil-oath'], 'first oath click arms only — no talent point placed');
  await shot(page, 'tree-vigil-oath-armed');
  await clickNamed(page, 'treeNode:vigil-oath');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-oath'] === 1, 'second click swears the Vigil oath in-tree');
  check(save.subclass === 'vigil', 'oath purchase set subclass = vigil');
  check(save.unlockedSpells.includes('solemn-vigil') === false, 'granted spell comes from the tree, not unlockedSpells');
  await shot(page, 'tree-zealot-forsaken');

  // Rival spot offers forsaken-path Warped Tempo (not the Zealot oath).
  await clickNamed(page, 'treeNode:zealot-oath');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(!save.treeRanks['zealot-oath'], 'rival oath node was not purchased');
  check(save.treeRanks['warped-tempo-via-zealot'] === 1, 'bought Warped Tempo on the forsaken rival spot');
  await shot(page, 'tree-warped-tempo-owned');

  // Follow-up branch node unlocked by the oath.
  await clickNamed(page, 'treeNode:vigil-patient-vow');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-patient-vow'] === 1, 'bought Patient Vow rank 1 behind the oath');
  await shot(page, 'tree-vigil-branch-owned');

  await clickNamed(page, 'treeBack');
  await page.waitForTimeout(600);
  check((await locate(page, 'runMod:vigil-oath')) !== null, 'hub run-mods bar shows sworn oath');
  await shot(page, 'hub-with-oath');

  // ---- Stage B3: v0.3 lattice (shared mid → Vowstrike → level-gated crown) ---
  console.log('Stage B3: lattice → Still Waters → shared mid → Vowstrike → crown');
  // Level 12 (xp 660) → 12 talent points; seed spends 3, leaving room for the
  // branch CD + shared mid + aspect + Wings + crown amp. Level 12 also clears
  // both crowns' minLevel gates (wrath-ascendant 10, vowbound-crown 12).
  await seedSave(
    page,
    baseSave({
      xp: 660,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      subclass: 'vigil',
      treeRanks: { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
    }),
  );
  await clickNamed(page, 'hubTree');
  await page.waitForTimeout(600);

  // Whole lattice fits the fixed 960×540 canvas (chunk D) — no scroll needed
  // to reach the crown row.
  await hoverNamed(page, 'treeBack');
  await shot(page, 'tree-lattice-vigil-branch');

  await clickNamed(page, 'treeNode:vigil-still-waters');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vigil-still-waters'] === 1, 'bought Still Waters (oath-branch CD)');

  await clickNamed(page, 'treeNode:shared-mend-potency');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['shared-mend-potency'] === 1, 'bought shared-mid Solemn Mend potency');

  await clickNamed(page, 'treeNode:vowstrike-virtue');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vowstrike-virtue'] === 1, 'bought Vowstrike: Absolution (Virtue aspect)');
  check(!save.treeRanks['vowstrike-vengeance'], 'Vengeance aspect remains locked/unowned');

  await clickNamed(page, 'treeNode:wrath-ascendant');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['wrath-ascendant'] === 1, 'bought Wrath Ascendant (crown Wings CD)');

  await clickNamed(page, 'treeNode:vowbound-crown');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['vowbound-crown'] === 1, 'bought Vowbound crown amp');
  await shot(page, 'tree-crown-owned');

  await clickNamed(page, 'treeBack');
  await page.waitForTimeout(400);

  // Zealot Steady Hands remains purchasable on a lean seed (no scroll needed).
  await seedSave(
    page,
    baseSave({
      xp: 30,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      subclass: 'zealot',
      treeRanks: { 'deep-reserves': 1, 'zealot-oath': 1 },
    }),
  );
  await clickNamed(page, 'hubTree');
  await page.waitForTimeout(600);
  await clickNamed(page, 'treeNode:zealot-steady-hands');
  await page.waitForTimeout(400);
  save = await readSave(page);
  check(save.treeRanks['zealot-steady-hands'] === 1, 'Steady Hands purchasable on Zealot path');
  await shot(page, 'tree-zealot-steady-hands-rebalance');

  // ---- Stage B2: Vigil kit in combat — tooltip reflects tree modifiers -------
  console.log('Stage B2: combat with the Vigil kit → pace toggle + tooltip + feedback');
  await seedSave(
    page,
    baseSave({
      xp: 150,
      unlockedSpells: ['bonk', 'solemn-mend', 'zealous-mending'],
      actionBar: ['bonk', 'solemn-mend', 'solemn-vigil', ''],
      subclass: 'vigil',
      treeRanks: {
        'deep-reserves': 2,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'vigil-still-waters': 1,
        'warped-tempo-via-zealot': 1,
      },
      clearedDungeons: ['ash-gate'],
    }),
  );
  await clickNamed(page, 'hubDungeon:ash-gate');
  await page.waitForTimeout(1200);
  await clickNamed(page, 'combatPaceToggle');
  await page.waitForTimeout(300);
  save = await readSave(page);
  check(save.combatPaceTenths === 15, 'pace toggle persisted 1.5× selection');
  await shot(page, 'combat-pace-15x');
  await hoverNamed(page, 'combatSpell:solemn-vigil');
  await page.waitForTimeout(400);
  await shot(page, 'combat-solemn-vigil-tooltip');
  check((await locate(page, 'combatCooldown:still-waters')) !== null, 'Still Waters has a semantic combat target');
  await hoverNamed(page, 'combatCooldown:still-waters');
  await page.waitForTimeout(400);
  await shot(page, 'combat-still-waters-tooltip');
  await page.keyboard.down('Shift');
  await page.keyboard.press('q');
  await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
  await shot(page, 'combat-still-waters-hotkey-armed');
  await page.mouse.move(480, 270); // off the button (viewport center; not a layout target)
  await page.waitForTimeout(4000); // let autos land for feedback frame
  await shot(page, 'combat-feedback-midfight');
  // xp banks per kill DURING the fight, so gate on the RunRecord too — it's only
  // pushed by HubScene.create() after Return, i.e. once the run truly ended.
  save = await playCombat(
    page,
    (s) => s.xp > 12 && s.recentRuns.length > 0,
    180_000,
    'combat-result-summary-lit-glyph',
  );
  check(save.xp > 12, 'Vigil-kit run banked XP');
  check(
    save.recentRuns[0]?.glyph.segments.length > 0,
    "Vigil-kit run's RunRecord glyph reflects the owned oath→patient-vow→still-waters path",
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);

  // ---- Stage C: Maw gating — gated on Black Choir, still unwinnable -----
  console.log('Stage C: Maw gating — absent after Iron Pass alone, present + unwinnable after Black Choir');
  await seedSave(page, baseSave({ clearedDungeons: ['ash-gate', 'iron-pass'] }));
  check((await locate(page, 'hubDungeon:cinder-vault')) !== null, 'Cinder Vault present after Iron Pass clear');
  check((await locate(page, 'hubDungeon:the-maw')) === null, 'The Maw still gated after Iron Pass alone');
  await seedSave(
    page,
    baseSave({
      clearedDungeons: ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'],
    }),
  );
  save = await readSave(page);
  const xpBeforeMaw = save.xp;
  await shot(page, 'hub-maw-unlocked'); // visual: The Maw button now present
  check((await locate(page, 'hubDungeon:the-maw')) !== null, 'The Maw button present after Black Choir clear');
  await clickNamed(page, 'hubDungeon:the-maw');
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

  // ---- Stage Settings: Hub → Settings volume slider → Back (v0.3 chunk H) ----
  console.log('Stage Settings: hubSettings → drag/click volume slider → settingsBack');
  await seedSave(page, baseSave({}));
  save = await readSave(page);
  check(save.musicVolumePct === 50, 'seeded save starts at the default 50% music volume');

  await clickNamed(page, 'hubSettings');
  await page.waitForTimeout(400);
  check((await locate(page, 'settingsVolumeSlider')) !== null, 'Settings scene shows the volume slider track');
  check((await locate(page, 'settingsBack')) !== null, 'Settings scene shows Back');
  await shot(page, 'settings-scene');

  // Clicking the track's located center sets ~50% (already the seeded value —
  // this proves the click-to-set path itself, not just the seed).
  await clickNamed(page, 'settingsVolumeSlider');
  await page.waitForTimeout(300);
  save = await readSave(page);
  check(
    Math.abs(save.musicVolumePct - 50) <= 5,
    `clicking the slider center sets ~50% (musicVolumePct=${save.musicVolumePct})`,
  );

  // Half the track width is a relative offset from the *located* center, not
  // a hard-coded layout coordinate — it must match SettingsScene.ts's
  // TRACK_WIDTH/2 (400/2) so the click lands on the track's left edge (0%).
  const SETTINGS_TRACK_HALF_WIDTH = 200;
  const sliderPos = await locate(page, 'settingsVolumeSlider');
  await page.mouse.click(sliderPos.x - SETTINGS_TRACK_HALF_WIDTH, sliderPos.y);
  await page.waitForTimeout(300);
  save = await readSave(page);
  check(save.musicVolumePct === 0, `clicking the track's left edge sets musicVolumePct to 0 (got ${save.musicVolumePct})`);

  await clickNamed(page, 'settingsBack');
  await page.waitForTimeout(400);
  check((await locate(page, 'hubSettings')) !== null, 'settingsBack returns to Hub (hubSettings visible again)');
  await shot(page, 'hub-after-settings');
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
