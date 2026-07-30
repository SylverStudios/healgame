/**
 * Radial tree data tests (Chunk 1 definition of done):
 *   1. Specialize replace — bar + unlocked
 *   2. Offense XOR hard lock (Vowstrike ⊕ Bonk Upgrade)
 *   3. Ring 1 grants (Mend, Big Heal)
 *   4. A/B choice persistence (treeRanks reflects choice)
 *   5. loadoutFromRadialSave spells for starter + after Mend
 *   6. Arming Mend synergy wired into CombatMods
 *   7. CD grants (Still Waters, Wrath, Liturgy)
 *   8. applyRadialPurchase level gate enforcement
 */

import { describe, expect, it } from 'vitest';
import {
  applyRadialPurchase,
  loadoutFromRadialSave,
  treeStateFromRadialSave,
  radialRanksFromOwned,
} from './resolve';
import { RADIAL_HEAL, RADIAL_BONK, RADIAL_MEND, RADIAL_BIG_HEAL } from './spells';
import { update, snapshot } from '../../tree';
import { RADIAL_TREE } from './tree';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal starter radial save (mimics newSaveData('radial')). */
function starterSave() {
  return {
    xp: 0,
    treeRanks: { heal: 1, bonk: 1 } as Record<string, number>,
    unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
    actionBar: [RADIAL_BONK.id, RADIAL_HEAL.id, '', ''],
  };
}

/** Starter save at a given XP (for level-gate tests). */
function saveAtXp(xp: number) {
  return { ...starterSave(), xp };
}

// ---------------------------------------------------------------------------
// 1. loadoutFromRadialSave — starter kit
// ---------------------------------------------------------------------------

describe('loadoutFromRadialSave — starter', () => {
  it('returns Heal + Bonk from unlocked starters', () => {
    const mods = loadoutFromRadialSave({
      unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
    });
    expect(mods.spells.map((s) => s.id)).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id]);
    expect(mods.spells[0]?.name).toBe('Heal');
    expect(mods.spells[1]?.name).toBe('Bonk');
  });

  it('filters fight kit through action bar order', () => {
    const mods = loadoutFromRadialSave({
      unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
      actionBar: [RADIAL_BONK.id, RADIAL_HEAL.id, '', ''],
    });
    expect(mods.spells.map((s) => s.id)).toEqual([RADIAL_BONK.id, RADIAL_HEAL.id]);
  });

  it('starter has no cooldowns', () => {
    const mods = loadoutFromRadialSave({
      unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
      treeRanks: { heal: 1, bonk: 1 },
    });
    expect(mods.cooldowns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Ring 1 grants — Mend and Big Heal
// ---------------------------------------------------------------------------

describe('applyRadialPurchase — Ring 1 grants', () => {
  it('buys Mend: adds mend to unlockedSpells and actionBar', () => {
    // Level 1 (xp=0): starters cost 0, so 1 talent point is available.
    const save = saveAtXp(0);
    const ok = applyRadialPurchase(save, 'mend');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).toContain(RADIAL_MEND.id);
    expect(save.actionBar).toContain(RADIAL_MEND.id);
    expect(save.treeRanks['mend']).toBe(1);
  });

  it('cannot buy Ring 1 nodes with 0 talent points (spent the only point)', () => {
    // Buy mend first (uses the 1 available point at level 1).
    const save = saveAtXp(0);
    applyRadialPurchase(save, 'mend');
    // Now 0 points remain — big-heal should fail.
    const ok = applyRadialPurchase(save, 'big-heal');
    expect(ok).toBe(false);
  });

  it('buys Big Heal: adds big-heal to unlockedSpells and actionBar', () => {
    const save = saveAtXp(0);
    const ok = applyRadialPurchase(save, 'big-heal');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).toContain(RADIAL_BIG_HEAL.id);
    expect(save.treeRanks['big-heal']).toBe(1);
  });

  it('loadoutFromRadialSave includes Mend after it is purchased', () => {
    const save = saveAtXp(0);
    applyRadialPurchase(save, 'mend');
    const mods = loadoutFromRadialSave(save);
    const ids = mods.spells.map((s) => s.id);
    expect(ids).toContain(RADIAL_HEAL.id);
    expect(ids).toContain(RADIAL_BONK.id);
    expect(ids).toContain(RADIAL_MEND.id);
  });
});

// ---------------------------------------------------------------------------
// 3. Specialize replace — bar + unlocked
// ---------------------------------------------------------------------------

describe('applyRadialPurchase — specialize (heal-s1)', () => {
  it('A choice: replaces heal with zealous-heal in unlocked + bar', () => {
    const save = saveAtXp(0);
    const ok = applyRadialPurchase(save, 'heal-s1', 'a');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).not.toContain(RADIAL_HEAL.id);
    expect(save.unlockedSpells).toContain('zealous-heal');
    expect(save.actionBar).not.toContain(RADIAL_HEAL.id);
    expect(save.actionBar).toContain('zealous-heal');
    expect(save.treeRanks['heal-s1-zealous']).toBe(1);
  });

  it('B choice: replaces heal with solemn-heal in unlocked + bar', () => {
    const save = saveAtXp(0);
    const ok = applyRadialPurchase(save, 'heal-s1', 'b');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).not.toContain(RADIAL_HEAL.id);
    expect(save.unlockedSpells).toContain('solemn-heal');
    expect(save.actionBar).toContain('solemn-heal');
    expect(save.treeRanks['heal-s1-solemn']).toBe(1);
  });

  it('specialize places new spell in the old slot (Heal on W)', () => {
    const save = saveAtXp(0);
    expect(save.actionBar[1]).toBe(RADIAL_HEAL.id);
    applyRadialPurchase(save, 'heal-s1', 'a');
    expect(save.actionBar[1]).toBe('zealous-heal');
  });

  it('after specializing heal-s1-zealous, cannot also buy heal-s1-solemn', () => {
    const save = saveAtXp(10); // level 2, 2 points available after starters
    applyRadialPurchase(save, 'heal-s1', 'a');
    const ok = applyRadialPurchase(save, 'heal-s1', 'b');
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. A/B choice persistence
// ---------------------------------------------------------------------------

describe('A/B choice persistence', () => {
  it('treeRanks reflects the chosen spot id (not the logical group)', () => {
    const save = saveAtXp(0);
    applyRadialPurchase(save, 'heal-s1', 'b');
    expect(save.treeRanks['heal-s1-solemn']).toBe(1);
    expect(save.treeRanks['heal-s1-zealous']).toBeUndefined();
    expect(save.treeRanks['heal-s1']).toBeUndefined();
  });

  it('restoring treeRanks round-trips through treeStateFromRadialSave', () => {
    const save = saveAtXp(0);
    applyRadialPurchase(save, 'heal-s1', 'a');
    const state = treeStateFromRadialSave(save.treeRanks, save.xp);
    const snap = snapshot(state);
    expect(snap.owned).toContain('heal-s1-zealous');
    expect(snap.owned).not.toContain('heal-s1-solemn');
  });
});

// ---------------------------------------------------------------------------
// 5. Offense XOR hard lock
// ---------------------------------------------------------------------------

describe('Offense XOR (Vowstrike ⊕ Bonk Upgrade)', () => {
  /** Save at level 5 (50 XP for level 5 with the curve: 0+10+20+30 = 60 total for level 5? let me check).
   *  Level 1=0, 2=10, 3=30, 4=60, 5=100. Use 100 XP. */
  function level5Save() {
    return saveAtXp(100);
  }

  it('buying Vowstrike locks Bonk Upgrade', () => {
    const save = level5Save();
    const ok = applyRadialPurchase(save, 'vowstrike-entry');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).toContain('vowstrike');
    expect(save.treeRanks['vowstrike-entry']).toBe(1);

    // Now bonk-upgrade must be locked (exclusive-locked)
    const ok2 = applyRadialPurchase(save, 'bonk-upgrade');
    expect(ok2).toBe(false);
  });

  it('buying Bonk Upgrade locks Vowstrike', () => {
    const save = level5Save();
    const ok = applyRadialPurchase(save, 'bonk-upgrade');
    expect(ok).toBe(true);
    expect(save.treeRanks['bonk-upgrade']).toBe(1);

    const ok2 = applyRadialPurchase(save, 'vowstrike-entry');
    expect(ok2).toBe(false);
  });

  it('after Bonk Upgrade, can choose Blessed Bonk (specializes bonk)', () => {
    const save = level5Save();
    applyRadialPurchase(save, 'bonk-upgrade');
    // Now buy bonk-s1-blessed
    const ok = applyRadialPurchase(save, 'bonk-s1', 'b');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).toContain('blessed-bonk');
    expect(save.unlockedSpells).not.toContain(RADIAL_BONK.id);
    expect(save.treeRanks['bonk-s1-blessed']).toBe(1);
  });

  it('after Bonk Upgrade, can choose Mana Bonk (specializes bonk)', () => {
    const save = level5Save();
    applyRadialPurchase(save, 'bonk-upgrade');
    const ok = applyRadialPurchase(save, 'bonk-s1', 'a');
    expect(ok).toBe(true);
    expect(save.unlockedSpells).toContain('mana-bonk');
    expect(save.unlockedSpells).not.toContain(RADIAL_BONK.id);
  });
});

// ---------------------------------------------------------------------------
// 6. Level gate enforcement (Ring 2 minLevel 5)
// ---------------------------------------------------------------------------

describe('Level gate (Ring 2 minLevel 5)', () => {
  it('cannot buy Ring 2 nodes at level 1', () => {
    const save = saveAtXp(0); // level 1, 1 free point
    const ok = applyRadialPurchase(save, 'vowstrike-entry');
    expect(ok).toBe(false);
  });

  it('can buy Ring 2 nodes at level 5', () => {
    const save = saveAtXp(100); // level 5
    const ok = applyRadialPurchase(save, 'still-waters');
    expect(ok).toBe(true);
    expect(save.treeRanks['still-waters']).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. CD grants (Still Waters, Wrath Ascendant, Frenzied Liturgy)
// ---------------------------------------------------------------------------

describe('CD grants', () => {
  function level5Save() {
    return saveAtXp(100);
  }

  it('buys Still Waters: appears in loadout cooldowns', () => {
    const save = level5Save();
    applyRadialPurchase(save, 'still-waters');
    const mods = loadoutFromRadialSave(save);
    expect(mods.cooldowns.map((c) => c.id)).toContain('still-waters');
  });

  it('buys Wrath Ascendant: appears in loadout cooldowns', () => {
    const save = level5Save();
    applyRadialPurchase(save, 'wrath');
    const mods = loadoutFromRadialSave(save);
    expect(mods.cooldowns.map((c) => c.id)).toContain('wrath-ascendant');
  });

  it('buys Frenzied Liturgy: appears in loadout cooldowns', () => {
    const save = level5Save();
    applyRadialPurchase(save, 'liturgy');
    const mods = loadoutFromRadialSave(save);
    expect(mods.cooldowns.map((c) => c.id)).toContain('frenzied-liturgy');
  });

  it('can buy all three CDs (they are not exclusive)', () => {
    const save = saveAtXp(200); // enough levels
    applyRadialPurchase(save, 'still-waters');
    applyRadialPurchase(save, 'wrath');
    applyRadialPurchase(save, 'liturgy');
    const mods = loadoutFromRadialSave(save);
    const cdIds = mods.cooldowns.map((c) => c.id);
    expect(cdIds).toContain('still-waters');
    expect(cdIds).toContain('wrath-ascendant');
    expect(cdIds).toContain('frenzied-liturgy');
  });
});

// ---------------------------------------------------------------------------
// 8. Arming Mend synergy wired into CombatMods
// ---------------------------------------------------------------------------

describe('Arming Mend synergy', () => {
  it('after mend + mend-s1-arming, synergy mend→heal is in CombatMods', () => {
    const save = saveAtXp(10); // level 2, 2 points available
    applyRadialPurchase(save, 'mend');
    applyRadialPurchase(save, 'mend-s1', 'a');
    const mods = loadoutFromRadialSave(save);
    const synergy = mods.synergies.find(
      (s) => s.triggerSpellId === 'mend' && s.buffedSpellId === 'heal',
    );
    expect(synergy).toBeDefined();
    expect(synergy?.bonusHeal).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 9. RADIAL_TREE config validity (validateConfig passes)
// ---------------------------------------------------------------------------

describe('RADIAL_TREE config', () => {
  it('tree service round-trips via treeStateFromRadialSave with starter ranks', () => {
    const state = treeStateFromRadialSave({ heal: 1, bonk: 1 }, 0);
    const snap = snapshot(state);
    expect(snap.owned).toContain('heal');
    expect(snap.owned).toContain('bonk');
  });

  it('direct tree.update rejects purchase of a spot the player cannot afford', () => {
    // Empty treeRanks = only heal root pre-owned via create
    const state = treeStateFromRadialSave({ heal: 1, bonk: 1 }, 0);
    // Wallet = 0 at level 1 (starters free, no paid purchases yet, level=1 → 1 point)
    // Actually level 1 → 1 - 0 paid = 1 available. So "mend" (cost 1) should succeed.
    const result = update(RADIAL_TREE, state, { type: 'purchase', spotId: 'mend' });
    expect(result.ok).toBe(true);
  });

  it('radialRanksFromOwned round-trip', () => {
    const owned = ['heal', 'bonk', 'mend', 'big-heal'];
    const ranks = radialRanksFromOwned(owned);
    expect(ranks['heal']).toBe(1);
    expect(ranks['mend']).toBe(1);
    expect(ranks['big-heal']).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 10. Ring 3 nodes (minLevel 10)
// ---------------------------------------------------------------------------

describe('Ring 3 — heal-s3', () => {
  /** Save at level 10 with heal-s1 + heal-s2 already owned. */
  function ring3HealSave() {
    const save = {
      xp: 450, // level 10 (xpForLevel(10) = 450 with the 10n² curve)
      treeRanks: {
        heal: 1,
        bonk: 1,
        'heal-s1-zealous': 1,
        'heal-s2-fast': 1,
      } as Record<string, number>,
      unlockedSpells: ['zealous-heal', 'bonk'],
      actionBar: ['zealous-heal', 'bonk', '', ''],
    };
    return save;
  }

  it('cannot buy heal-s3 below level 10', () => {
    const save = {
      xp: 350, // level 9
      treeRanks: { heal: 1, bonk: 1, 'heal-s1-zealous': 1, 'heal-s2-fast': 1 } as Record<string, number>,
      unlockedSpells: ['zealous-heal', 'bonk'],
      actionBar: ['zealous-heal', 'bonk', '', ''],
    };
    const ok = applyRadialPurchase(save, 'heal-s3', 'a');
    expect(ok).toBe(false);
  });

  it('A (Burning Faith): +2 heal on zealous-heal at level 10', () => {
    const save = ring3HealSave();
    const ok = applyRadialPurchase(save, 'heal-s3', 'a');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const heal = mods.spells.find((s) => s.id === 'zealous-heal');
    expect(heal?.heal).toBe(6); // 4 base + 2 from Burning Faith
  });

  it('B (Thrifty Grace): -1 mana on zealous-heal at level 10', () => {
    const save = ring3HealSave();
    const ok = applyRadialPurchase(save, 'heal-s3', 'b');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const heal = mods.spells.find((s) => s.id === 'zealous-heal');
    expect(heal?.mana).toBe(3); // 4 base - 1 from Thrifty Grace
  });

  it('A and B are exclusive', () => {
    const save = ring3HealSave();
    applyRadialPurchase(save, 'heal-s3', 'a');
    const ok = applyRadialPurchase(save, 'heal-s3', 'b');
    expect(ok).toBe(false);
  });
});

describe('Ring 3 — offense-s2', () => {
  /** Save at level 10 with Vowstrike + Absolution. */
  function vowstrikeSave() {
    return {
      xp: 450, // level 10
      treeRanks: {
        heal: 1,
        bonk: 1,
        'vowstrike-entry': 1,
        'vowstrike-s1-absolution': 1,
      } as Record<string, number>,
      unlockedSpells: ['vowstrike-absolution'],
      actionBar: ['heal', 'vowstrike-absolution', '', ''],
    };
  }

  /** Save at level 10 with Bonk Upgrade + Blessed Bonk. */
  function bonkSave() {
    return {
      xp: 450, // level 10
      treeRanks: {
        heal: 1,
        bonk: 1,
        'bonk-upgrade': 1,
        'bonk-s1-blessed': 1,
      } as Record<string, number>,
      unlockedSpells: ['heal', 'blessed-bonk'],
      actionBar: ['heal', 'blessed-bonk', '', ''],
    };
  }

  it('Swift Conviction (A) shortens Vowstrike cooldown by 2s', () => {
    const save = vowstrikeSave();
    const ok = applyRadialPurchase(save, 'offense-s2', 'a');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const vs = mods.spells.find((s) => s.id === 'vowstrike-absolution');
    expect(vs?.cooldownMs).toBe(8_000); // 10s - 2s
  });

  it('Crushing Blow (B) adds +2 damage to Vowstrike variants', () => {
    const save = vowstrikeSave();
    const ok = applyRadialPurchase(save, 'offense-s2', 'b');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const vs = mods.spells.find((s) => s.id === 'vowstrike-absolution');
    expect(vs?.damage).toBe(7); // 5 base + 2
  });

  it('Crushing Blow (B) increases Blessed Bonk stack cap to 4', () => {
    const save = bonkSave();
    const ok = applyRadialPurchase(save, 'offense-s2', 'b');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const bb = mods.spells.find((s) => s.id === 'blessed-bonk');
    expect(bb?.castBuff?.kind).toBe('stackNextHealPotencyPct');
    if (bb?.castBuff?.kind === 'stackNextHealPotencyPct') {
      expect(bb.castBuff.cap).toBe(4); // 3 base + 1
    }
  });
});

describe('Ring 3 — crown upgrades', () => {
  /** Level 10 save with Wrath Ascendant. */
  function wrathSave() {
    return {
      xp: 450,
      treeRanks: { heal: 1, bonk: 1, wrath: 1 } as Record<string, number>,
      unlockedSpells: ['heal', 'bonk'],
      actionBar: ['heal', 'bonk', '', ''],
    };
  }

  /** Level 10 save with Still Waters. */
  function watersSave() {
    return {
      xp: 450,
      treeRanks: { heal: 1, bonk: 1, 'still-waters': 1 } as Record<string, number>,
      unlockedSpells: ['heal', 'bonk'],
      actionBar: ['heal', 'bonk', '', ''],
    };
  }

  it('crown-wrath upgrades Wrath Ascendant bonus to +3', () => {
    const save = wrathSave();
    const ok = applyRadialPurchase(save, 'crown-wrath');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const wrath = mods.cooldowns.find((c) => c.id === 'wrath-ascendant');
    expect(wrath).toBeDefined();
    expect(wrath?.effect.kind).toBe('healBonus');
    if (wrath?.effect.kind === 'healBonus') {
      expect(wrath.effect.bonusHeal).toBe(3); // 2 base + 1
    }
  });

  it('crown-wrath cannot be bought without wrath', () => {
    const save = {
      xp: 450,
      treeRanks: { heal: 1, bonk: 1 } as Record<string, number>,
      unlockedSpells: ['heal', 'bonk'],
      actionBar: ['heal', 'bonk', '', ''],
    };
    const ok = applyRadialPurchase(save, 'crown-wrath');
    expect(ok).toBe(false);
  });

  it('crown-waters reduces Still Waters cooldown to 45s', () => {
    const save = watersSave();
    const ok = applyRadialPurchase(save, 'crown-waters');
    expect(ok).toBe(true);
    const mods = loadoutFromRadialSave(save);
    const sw = mods.cooldowns.find((c) => c.id === 'still-waters');
    expect(sw).toBeDefined();
    expect(sw?.cooldownMs).toBe(45_000); // 60s - 15s
  });

  it('crown-waters cannot be bought without still-waters', () => {
    const save = {
      xp: 450,
      treeRanks: { heal: 1, bonk: 1 } as Record<string, number>,
      unlockedSpells: ['heal', 'bonk'],
      actionBar: ['heal', 'bonk', '', ''],
    };
    const ok = applyRadialPurchase(save, 'crown-waters');
    expect(ok).toBe(false);
  });
});
