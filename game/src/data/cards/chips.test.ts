import { describe, expect, it } from 'vitest';
import { xpForLevel } from '../constants';
import { newSaveData } from '../../save/save';
import {
  CARD_CHIPS,
  chipById,
  chipOffersForSlot,
  healSlot2Offers,
} from './chips';
import { canOfferSlot, offersForNextSlot } from './draft';
import { applyChipPurchase, loadoutFromCardSave } from './resolve';
import { CARD_SLOTS, SLOT_2_MIN_LEVEL } from './unlocks';

describe('CARD_CHIPS catalog (Wave 7a)', () => {
  it('ships 25 chips — heal 7 (3+4), others 6 each', () => {
    expect(CARD_CHIPS).toHaveLength(25);
    expect(CARD_CHIPS.filter((c) => c.spellId === 'heal')).toHaveLength(7);
    expect(CARD_CHIPS.filter((c) => c.spellId === 'heal' && c.slotIndex === 0)).toHaveLength(3);
    expect(CARD_CHIPS.filter((c) => c.spellId === 'heal' && c.slotIndex === 1)).toHaveLength(4);
    for (const spellId of ['mend', 'bonk', 'vowstrike'] as const) {
      const chips = CARD_CHIPS.filter((c) => c.spellId === spellId);
      expect(chips).toHaveLength(6);
      expect(chips.filter((c) => c.slotIndex === 0)).toHaveLength(3);
      expect(chips.filter((c) => c.slotIndex === 1)).toHaveLength(3);
    }
    expect(chipById('heal-steady')).toBeUndefined();
  });

  it('chipById resolves every catalog id', () => {
    for (const chip of CARD_CHIPS) {
      expect(chipById(chip.id)).toBe(chip);
    }
    expect(chipById('nope')).toBeUndefined();
  });
});

describe('chipOffersForSlot exact trios', () => {
  it('returns heal slot-1 authored ids; refuses naive heal slot-2', () => {
    expect(chipOffersForSlot('heal', 0)).toEqual([
      'heal-mend-link',
      'heal-graven',
      'heal-surge',
    ]);
    expect(() => chipOffersForSlot('heal', 1)).toThrow(/heal slot 2 is gated/);
  });

  it('returns mend slot-1 / slot-2 authored ids', () => {
    expect(chipOffersForSlot('mend', 0)).toEqual([
      'mend-arming',
      'mend-battle',
      'mend-surge',
    ]);
    expect(chipOffersForSlot('mend', 1)).toEqual([
      'mend-penny',
      'mend-graven',
      'mend-fullbloom',
    ]);
  });

  it('returns bonk slot-1 / slot-2 authored ids', () => {
    expect(chipOffersForSlot('bonk', 0)).toEqual([
      'bonk-battle',
      'bonk-blessed',
      'bonk-mana',
    ]);
    expect(chipOffersForSlot('bonk', 1)).toEqual([
      'bonk-vow-link',
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
      'vs-harrow',
      'vs-wellspring',
      'vs-weight',
    ]);
  });
});

describe('healSlot2Offers (J25b / M7)', () => {
  it('offers Heavy Cast trio when chip1 is Graven Light', () => {
    expect(healSlot2Offers('heal-graven')).toEqual([
      'heal-heavy',
      'heal-crest',
      'heal-tempo',
    ]);
  });

  it('offers Vigor trio when chip1 is not Graven', () => {
    expect(healSlot2Offers('heal-mend-link')).toEqual([
      'heal-vigor',
      'heal-crest',
      'heal-tempo',
    ]);
    expect(healSlot2Offers('heal-surge')).toEqual([
      'heal-vigor',
      'heal-crest',
      'heal-tempo',
    ]);
    expect(healSlot2Offers(undefined)).toEqual([
      'heal-vigor',
      'heal-crest',
      'heal-tempo',
    ]);
  });
});

describe('canOfferSlot / offersForNextSlot (J24 + J25b)', () => {
  it('gates slot 2 behind level 5', () => {
    expect(canOfferSlot(0, 1)).toBe(true);
    expect(canOfferSlot(1, 4)).toBe(false);
    expect(canOfferSlot(1, SLOT_2_MIN_LEVEL)).toBe(true);
    expect(SLOT_2_MIN_LEVEL).toBe(5);
  });

  it('returns slot-0 trio regardless of level; null when full', () => {
    expect(offersForNextSlot('heal', [], 1)).toEqual(chipOffersForSlot('heal', 0));
    expect(offersForNextSlot('heal', ['heal-graven', 'heal-heavy'], 5)).toBeNull();
    expect(CARD_SLOTS).toBe(2);
  });

  it('returns null for slot 2 under level 5 even with chip1 filled', () => {
    expect(offersForNextSlot('heal', ['heal-graven'], 4)).toBeNull();
    expect(offersForNextSlot('mend', ['mend-arming'], 2)).toBeNull();
  });

  it('returns heal gated trios at level 5+', () => {
    expect(offersForNextSlot('heal', ['heal-graven'], 5)).toEqual([
      'heal-heavy',
      'heal-crest',
      'heal-tempo',
    ]);
    expect(offersForNextSlot('heal', ['heal-surge'], 5)).toEqual([
      'heal-vigor',
      'heal-crest',
      'heal-tempo',
    ]);
  });

  it('returns naive slot-2 trio for non-heal spells at level 5+', () => {
    expect(offersForNextSlot('mend', ['mend-arming'], 5)).toEqual(chipOffersForSlot('mend', 1));
  });
});

describe('applyChipPurchase', () => {
  it('spends a point and appends an offered slot-0 chip', () => {
    const save = newSaveData('cards');
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(true);
    expect(save.upgradePoints).toBe(0);
    expect(save.spellChips.heal).toEqual(['heal-graven']);
  });

  it('rejects wrong-slot chips (slot-1 while slot-0 empty)', () => {
    const save = newSaveData('cards');
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(false);
    expect(applyChipPurchase(save, 'heal', 'heal-power')).toBe(false);
    expect(save.upgradePoints).toBe(1);
    expect(save.spellChips.heal).toBeUndefined();
  });

  it('rejects chip for a different spell', () => {
    const save = newSaveData('cards');
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'mend-arming')).toBe(false);
    expect(save.upgradePoints).toBe(1);
  });

  it('rejects slot-2 purchase under level 5 even when called directly (J24)', () => {
    const save = newSaveData('cards');
    save.xp = xpForLevel(4);
    save.upgradePoints = 2;
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(true);
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(false);
    expect(applyChipPurchase(save, 'heal', 'heal-quick')).toBe(false);
    expect(save.spellChips.heal).toEqual(['heal-graven']);
    expect(save.upgradePoints).toBe(1);
  });

  it('allows slot-2 purchase at level 5+ (J24)', () => {
    const save = newSaveData('cards');
    save.xp = xpForLevel(5);
    save.upgradePoints = 2;
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(true);
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(true);
    expect(save.spellChips.heal).toEqual(['heal-graven', 'heal-heavy']);
    expect(save.upgradePoints).toBe(0);
  });

  it('rejects heal-heavy without graven chip1 (J25b)', () => {
    const save = newSaveData('cards');
    save.xp = xpForLevel(5);
    save.upgradePoints = 2;
    expect(applyChipPurchase(save, 'heal', 'heal-surge')).toBe(true);
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(false);
    expect(applyChipPurchase(save, 'heal', 'heal-vigor')).toBe(true);
    expect(save.spellChips.heal).toEqual(['heal-surge', 'heal-vigor']);
  });

  it('rejects unknown spell / insufficient points / full slots', () => {
    const save = newSaveData('cards');
    save.xp = xpForLevel(5);
    expect(applyChipPurchase(save, 'mend', 'mend-arming')).toBe(false); // not unlocked
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(false); // no points
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-graven')).toBe(true);
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(false); // no points left
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-heavy')).toBe(true);
    save.upgradePoints = 1;
    expect(applyChipPurchase(save, 'heal', 'heal-crest')).toBe(false); // full
    expect(save.spellChips.heal).toEqual(['heal-graven', 'heal-heavy']);
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

  it('Graven lands in missing-HP pct list; heal-heavy modifies castMs and heal', () => {
    const graven = modsWithChips({ heal: ['heal-graven'] });
    expect(graven.missingHealthPctBonuses).toEqual([
      { spellId: 'heal', pctPer10PctMissing: 10 },
    ]);

    const heavy = modsWithChips({ heal: ['heal-graven', 'heal-heavy'] });
    const heal = heavy.spells.find((s) => s.id === 'heal');
    expect(heal?.castMs).toBe(2500); // 2000 + 500 (heal-heavy)
    expect(heal?.heal).toBe(7); // 4 + 3 (heal-heavy)

    const brink = modsWithChips({ mend: ['mend-arming', 'mend-graven'] });
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
      heal: ['heal-graven', 'heal-heavy'],
      mend: ['mend-penny'],
      bonk: ['bonk-mana'],
      vowstrike: ['vs-absolution', 'vs-weight'],
    });
    expect(mods.spells.find((s) => s.id === 'heal')?.heal).toBe(7); // 4+3 (heal-heavy)
    expect(mods.spells.find((s) => s.id === 'heal')?.castMs).toBe(2500); // 2000+500 (heal-heavy)
    expect(mods.spells.find((s) => s.id === 'mend')?.mana).toBe(0); // 1-1 (mend-penny)
    expect(mods.spells.find((s) => s.id === 'bonk')?.manaOnHit).toBe(1); // bonk-mana
    expect(mods.spells.find((s) => s.id === 'vowstrike')?.damage).toBe(5); // 4+1 (vs-weight)
  });
});
