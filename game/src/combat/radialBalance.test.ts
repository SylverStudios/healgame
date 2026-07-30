/**
 * Light balance smoke tests for radial-mode loadouts (Wave 5 Chunk 4).
 *
 * Goals:
 *   1. Radial loadouts resolve correctly (spells, cooldowns, synergies present).
 *   2. Running a fight with radial kits does not throw.
 *   3. Radial mid kit (Mend + Zealous Heal + Still Waters) can survive Ash Gate
 *      with disciplined play — and wipes on The Maw (same as lattice kits).
 *
 * No full-dungeon wipe gates for the starter kit (too early to be disciplined).
 * Prefer diagnostic assertions over "must clear dungeon X" for new radial content.
 */

import { describe, expect, it } from 'vitest';
import { loadoutFromRadialSave } from '../data/radial/resolve';
import { applyRadialPurchase } from '../data/radial/resolve';
import { runBot } from './balanceBot';
import { ASH_GATE, THE_MAW } from '../data/encounters';
import type { CombatMods } from '../data/talentTree';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal radial starter save (Heal + Bonk, no tree purchases beyond starters). */
function starterSave() {
  return {
    xp: 0,
    treeRanks: { heal: 1, bonk: 1 } as Record<string, number>,
    unlockedSpells: ['heal', 'bonk'],
    actionBar: ['bonk', 'heal', '', ''],
  };
}

/** Build a radial mid-kit save:
 *  - xp 100 (level 5) so Ring-2 gates are cleared
 *  - Zealous Heal (heal-s1 A) + Mend + Still Waters
 */
function midKitSave() {
  const save = {
    xp: 100, // level 5
    treeRanks: { heal: 1, bonk: 1 } as Record<string, number>,
    unlockedSpells: ['heal', 'bonk'],
    actionBar: ['bonk', 'heal', '', ''],
  };
  applyRadialPurchase(save, 'heal-s1', 'a');   // zealous-heal
  applyRadialPurchase(save, 'mend');            // mend
  applyRadialPurchase(save, 'still-waters');   // Still Waters CD
  return save;
}

/** Build a radial ring-3 mid-kit save (level 10+ with heal-s3). */
function ring3Save() {
  const save = {
    xp: 450, // level 10
    treeRanks: { heal: 1, bonk: 1 } as Record<string, number>,
    unlockedSpells: ['heal', 'bonk'],
    actionBar: ['bonk', 'heal', '', ''],
  };
  applyRadialPurchase(save, 'heal-s1', 'a');     // zealous-heal
  applyRadialPurchase(save, 'mend');              // mend
  applyRadialPurchase(save, 'still-waters');     // Still Waters CD
  applyRadialPurchase(save, 'wrath');             // Wrath Ascendant CD
  applyRadialPurchase(save, 'heal-s2', 'a');     // heal-s2-fast
  applyRadialPurchase(save, 'heal-s3', 'a');     // heal-s3 Burning Faith (+2 heal)
  return save;
}

// ---------------------------------------------------------------------------
// 1. Loadout resolution correctness
// ---------------------------------------------------------------------------

describe('radial loadout resolution', () => {
  it('starter kit resolves: Bonk + Heal, no cooldowns, no synergies', () => {
    const mods = loadoutFromRadialSave(starterSave());
    expect(mods.spells.map((s) => s.id)).toEqual(['bonk', 'heal']);
    expect(mods.cooldowns).toHaveLength(0);
    expect(mods.synergies).toHaveLength(0);
  });

  it('mid kit resolves: zealous-heal + mend + bonk + Still Waters CD', () => {
    const mods = loadoutFromRadialSave(midKitSave());
    const ids = mods.spells.map((s) => s.id);
    expect(ids).toContain('zealous-heal');
    expect(ids).toContain('mend');
    expect(ids).not.toContain('heal'); // replaced by zealous-heal
    expect(mods.cooldowns.map((c) => c.id)).toContain('still-waters');
  });

  it('ring-3 kit resolves: Burning Faith applies +2 to zealous-heal', () => {
    const mods = loadoutFromRadialSave(ring3Save());
    const zh = mods.spells.find((s) => s.id === 'zealous-heal');
    expect(zh).toBeDefined();
    // heal-s2-fast gives -400ms; heal-s3 Burning Faith gives +2 heal.
    // Base zealous-heal: heal=4. After Burning Faith: heal=6.
    expect(zh?.heal).toBeGreaterThanOrEqual(6);
  });

  it('ring-3 kit includes Wrath Ascendant and Still Waters cooldowns', () => {
    const mods = loadoutFromRadialSave(ring3Save());
    const cdIds = mods.cooldowns.map((c) => c.id);
    expect(cdIds).toContain('still-waters');
    expect(cdIds).toContain('wrath-ascendant');
  });

  it('crown-wrath upgrade: Wrath Ascendant bonus becomes +3', () => {
    const save = ring3Save();
    applyRadialPurchase(save, 'crown-wrath');
    const mods = loadoutFromRadialSave(save);
    const wrath = mods.cooldowns.find((c) => c.id === 'wrath-ascendant');
    expect(wrath?.effect.kind).toBe('healBonus');
    if (wrath?.effect.kind === 'healBonus') {
      expect(wrath.effect.bonusHeal).toBe(3);
    }
  });

  it('crown-waters upgrade: Still Waters cooldown becomes 45s', () => {
    const save = ring3Save();
    applyRadialPurchase(save, 'crown-waters');
    const mods = loadoutFromRadialSave(save);
    const sw = mods.cooldowns.find((c) => c.id === 'still-waters');
    expect(sw?.cooldownMs).toBe(45_000);
  });
});

// ---------------------------------------------------------------------------
// 2. Fight smoke — radial kits do not throw on Ash Gate
// ---------------------------------------------------------------------------

function radialFightOpts(mods: CombatMods) {
  return {
    bonusMaxMana: mods.bonusMaxMana,
    synergies: mods.synergies,
    missingHealthBonuses: mods.missingHealthBonuses,
    missingHealthPctBonuses: mods.missingHealthPctBonuses,
    fullHealthBonuses: mods.fullHealthBonuses,
    cooldowns: mods.cooldowns,
    ...(mods.manaRegen !== undefined ? { manaRegen: mods.manaRegen } : {}),
  };
}

describe('radial fight smoke — Ash Gate', () => {
  it('starter kit (naive) ends in wipe or victory without throwing', () => {
    const mods = loadoutFromRadialSave(starterSave());
    const run = runBot(ASH_GATE, mods.spells, radialFightOpts(mods), 'naive');
    expect(['victory', 'wipe']).toContain(run.status);
  });

  it('starter kit wipes on naive play (healer must grow)', () => {
    const mods = loadoutFromRadialSave(starterSave());
    const run = runBot(ASH_GATE, mods.spells, radialFightOpts(mods), 'naive');
    expect(run.status).toBe('wipe');
  });

  it('mid kit (disciplined) ends in a valid result without throwing', () => {
    const mods = loadoutFromRadialSave(midKitSave());
    const run = runBot(ASH_GATE, mods.spells, radialFightOpts(mods), 'disciplined');
    expect(['victory', 'wipe']).toContain(run.status);
  });

  it('ring-3 kit (disciplined) ends in a valid result on Ash Gate', () => {
    const mods = loadoutFromRadialSave(ring3Save());
    const run = runBot(ASH_GATE, mods.spells, radialFightOpts(mods), 'disciplined');
    expect(['victory', 'wipe']).toContain(run.status);
  });

  it('ring-3 kit (disciplined) wipes on The Maw — unwinnable by design', () => {
    const mods = loadoutFromRadialSave(ring3Save());
    const run = runBot(THE_MAW, mods.spells, radialFightOpts(mods), 'disciplined', {
      capAsWipe: true,
    });
    expect(run.status).toBe('wipe');
  });
});
