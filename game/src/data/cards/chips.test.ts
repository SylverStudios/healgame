import { describe, expect, it } from 'vitest';
import { xpForLevel } from '../constants';
import { newSaveData } from '../../save/save';
import { CARD_CHIPS, chipById, chipOffersForSlot } from './chips';
import { offersForNextSlot } from './draft';
import { applyChipPurchase, loadoutFromCardSave } from './resolve';
import { CARD_SLOTS } from './unlocks';

const UPGRADABLE = ['heal', 'mend', 'bonk', 'vowstrike'] as const;

describe('CARD_CHIPS catalog (§8)', () => {
  it('ships exactly 24 chips — 6 per upgradable spell', () => {
    expect(CARD_CHIPS).toHaveLength(24);
    for (const spellId of UPGRADABLE) {
      const chips = CARD_CHIPS.filter((c) => c.spellId === spellId);
      expect(chips).toHaveLength(6);
      expect(chips.filter((c) => c.slotIndex === 0)).toHaveLength(3);
      expect(chips.filter((c) => c.slotIndex === 1)).toHaveLength(3);
    }
  });

  it('chipById resolves every catalog id', () => {
    for (const chip of CARD_CHIPS) {
      expect(chipById(chip.id)).toBe(chip);
    }
    expect(chipById('nope')).toBeUndefined();
  });
});

describe('chipOffersForSlot exact trios', () => {
  it('returns heal slot-1 / slot-2 authored ids in catalog order', () => {
    expect(chipOffersForSlot('heal', 0)).toEqual([
      'heal-mend-link',
      'heal-power',
      'heal-cost',
    ]);
    expect(chipOffersForSlot('heal', 1)).toEqual([
      'heal-graven',
      'heal-heavy',
      'heal-steady',
    ]);
  });

  it('returns mend slot-1 / slot-2 authored ids', () => {
    expect(chipOffersForSlot('mend', 0)).toEqual([
      'mend-arming',
      'mend-battle',
      'mend-quick',
    ]);
    expect(chipOffersForSlot('mend', 1)).toEqual([
      'mend-penny',
      'mend-graven',
      'mend-spark',
    ]);
  });

  it('returns bonk slot-1 / slot-2 authored ids', () => {
    expect(chipOffersForSlot('bonk', 0)).toEqual([
      'bonk-battle',
      'bonk-blessed',
      'bonk-mana',
    ]);
    expect(chipOffersForSlot('bonk', 1)).toEqual([
      'bonk-crush',
      'bonk-reckoning',
      'bonk-quicksteel',
    ]);
  });

  it('returns vowstrike slot-1 / slot-2 authored ids', () => {
    expect(chipOffersForSlot('vowstrike', 0)).toEqual([
      'vs-battle',
      'vs-absolution',
      'vs-reckoning',
    ]);
    expect(chipOffersForSlot('vowstrike', 1)).toEqual([
      'vs-ready',
      'vs-crush',
      'vs-weight',
    ]);
  });
});

describe('offersForNextSlot', () => {
  it('returns slot-0 trio when empty, slot-1 after one owned, null when full', () => {
    expect(offersForNextSlot('heal', [])).toEqual(chipOffersForSlot('heal', 0));
    expect(offersForNextSlot('heal', ['heal-power'])).toEqual(chipOffersForSlot('heal', 1));
    expect(offersForNextSlot('heal', ['heal-power', 'heal-graven'])).toBeNull();
    expect(CARD_SLOTS).toBe(2);
  });
});

describe('applyChipPurchase', () => {
  it('spends a point and appends an offered slot-0 chip', () => {
    const save = newSaveData('cards');
    expect(save.upgradePoints).toBe(1);
    expect(applyChipPurchase(save, 'heal', 'heal-power')).toBe(true);
    expect(save.upgradePoints).toBe(0);
    expect(save.spellChips.heal).toEqual(['heal-power']);
  });

  it('rejects wrong-slot chips (slot-1 while slot-0 empty)', () => {
    const save = newSaveData('cards');
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(false);
    expect(save.upgradePoints).toBe(1);
    expect(save.spellChips.heal).toBeUndefined();
  });

  it('rejects chip for a different spell', () => {
    const save = newSaveData('cards');
    expect(applyChipPurchase(save, 'heal', 'mend-arming')).toBe(false);
    expect(save.upgradePoints).toBe(1);
  });

  it('rejects unknown spell / insufficient points / full slots', () => {
    const save = newSaveData('cards');
    expect(applyChipPurchase(save, 'mend', 'mend-arming')).toBe(false); // not unlocked
    expect(applyChipPurchase(save, 'heal', 'heal-power')).toBe(true);
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(false); // no points left
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(true);
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(false); // full
    expect(save.spellChips.heal).toEqual(['heal-power', 'heal-graven']);
  });
});

describe('loadoutFromCardSave chip application', () => {
  function modsWithChips(spellChips: Record<string, string[]>) {
    return loadoutFromCardSave({
      xp: xpForLevel(5),
      actionBar: ['bonk', 'heal', 'mend', 'vowstrike'],
      unlockedSpells: ['heal', 'bonk', 'mend', 'vowstrike'],
      spellChips,
    });
  }

  it('Arming Mend + Battle Mend → synergies and manaSynergies', () => {
    // Slot-1 exclusive on Mend — resolve each alone, then both via mend+bonk.
    const arming = modsWithChips({ mend: ['mend-arming'] });
    expect(arming.synergies).toEqual([
      { triggerSpellId: 'mend', buffedSpellId: 'heal', bonusHeal: 2 },
    ]);

    const battle = modsWithChips({ mend: ['mend-battle'] });
    expect(battle.manaSynergies).toEqual(
      expect.arrayContaining([
        { triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 },
        { triggerSpellId: 'vowstrike', targetSpellId: 'mend', manaDelta: -1 },
      ]),
    );
    expect(battle.manaSynergies).toHaveLength(2);

    const both = modsWithChips({
      mend: ['mend-arming'],
      bonk: ['bonk-battle'],
    });
    expect(both.synergies).toEqual([
      { triggerSpellId: 'mend', buffedSpellId: 'heal', bonusHeal: 2 },
    ]);
    expect(both.manaSynergies).toEqual([
      { triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 },
    ]);
  });

  it('Graven / Steady land in missing / full HP lists', () => {
    const graven = modsWithChips({ heal: ['heal-power', 'heal-graven'] });
    expect(graven.missingHealthPctBonuses).toEqual([
      { spellId: 'heal', pctPer10PctMissing: 10 },
    ]);

    const steady = modsWithChips({ heal: ['heal-cost', 'heal-steady'] });
    expect(steady.fullHealthBonuses).toEqual([
      { spellId: 'heal', hpPctAtLeast: 80, bonusHeal: 2 },
    ]);

    const brink = modsWithChips({ mend: ['mend-quick', 'mend-graven'] });
    expect(brink.missingHealthBonuses).toEqual([
      { spellId: 'mend', healPer10PctMissing: 1 },
    ]);
  });

  it('later castBuff chip overwrites earlier (Blessed then Reckoning)', () => {
    const blessed = modsWithChips({ bonk: ['bonk-blessed'] });
    expect(blessed.spells.find((s) => s.id === 'bonk')?.castBuff).toEqual({
      kind: 'stackNextHealPotencyPct',
      pct: 10,
      cap: 3,
    });

    const overwritten = modsWithChips({
      bonk: ['bonk-blessed', 'bonk-reckoning'],
    });
    expect(overwritten.spells.find((s) => s.id === 'bonk')?.castBuff).toEqual({
      kind: 'stackNextHealPotencyPct',
      pct: 15,
      cap: 3,
    });

    const quicksteel = modsWithChips({
      bonk: ['bonk-blessed', 'bonk-quicksteel'],
    });
    expect(quicksteel.spells.find((s) => s.id === 'bonk')?.castBuff).toEqual({
      kind: 'nextHealPotencyPct',
      pct: 25,
    });
  });

  it('bakes castMod / manaOnHit onto cloned spell defs', () => {
    const mods = modsWithChips({
      heal: ['heal-power'],
      bonk: ['bonk-mana', 'bonk-crush'],
      vowstrike: ['vs-battle', 'vs-ready'],
    });
    expect(mods.spells.find((s) => s.id === 'heal')?.heal).toBe(6); // 4+2
    expect(mods.spells.find((s) => s.id === 'bonk')?.manaOnHit).toBe(1);
    expect(mods.spells.find((s) => s.id === 'bonk')?.damage).toBe(3); // 1+2
    expect(mods.spells.find((s) => s.id === 'vowstrike')?.cooldownMs).toBe(8000);
  });
});
