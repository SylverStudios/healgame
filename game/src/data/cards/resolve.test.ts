import { describe, expect, it } from 'vitest';
import { levelForXp, xpForLevel } from '../constants';
import { newSaveData } from '../../save/save';
import { applyCardsLevelUps, loadoutFromCardSave } from './resolve';

describe('applyCardsLevelUps', () => {
  it('J26: level-ups never bank upgrade points (points come from clears)', () => {
    const save = newSaveData('cards');
    expect(save.upgradePoints).toBe(0);
    applyCardsLevelUps(save, 1, 1);
    expect(save.upgradePoints).toBe(0);
    applyCardsLevelUps(save, 1, 3);
    expect(save.upgradePoints).toBe(0);
    applyCardsLevelUps(save, 3, 4);
    expect(save.upgradePoints).toBe(0);
    applyCardsLevelUps(save, 7, 8);
    expect(save.upgradePoints).toBe(0);
  });

  it('grants mend at level 2 and auto-equips into the first free bar slot (no point)', () => {
    const save = newSaveData('cards');
    expect(save.actionBar.slice(0, 2)).toEqual(['bonk', 'heal']);
    applyCardsLevelUps(save, 1, 2);
    expect(save.unlockedSpells).toContain('mend');
    expect(save.unlockedSpells.filter((id) => id === 'mend')).toHaveLength(1);
    expect(save.actionBar[2]).toBe('mend');
    expect(save.upgradePoints).toBe(0);
  });

  it('grants vowstrike at level 5 beside bonk (does not replace)', () => {
    const save = newSaveData('cards');
    applyCardsLevelUps(save, 1, 5);
    expect(save.unlockedSpells).toEqual(
      expect.arrayContaining(['heal', 'bonk', 'mend', 'vowstrike']),
    );
    expect(save.actionBar).toContain('vowstrike');
    expect(save.actionBar).toContain('bonk');
    expect(save.upgradePoints).toBe(0);
  });

  it('does not push cooldown ids into unlockedSpells; loadout discovers them', () => {
    const save = newSaveData('cards');
    applyCardsLevelUps(save, 5, 6);
    expect(save.unlockedSpells).not.toContain('still-waters');
    expect(save.upgradePoints).toBe(0);
    const mods = loadoutFromCardSave({
      xp: xpForLevel(6),
      actionBar: save.actionBar,
      unlockedSpells: save.unlockedSpells,
    });
    expect(mods.cooldowns.map((c) => c.id)).toContain('still-waters');
  });

  it('skips re-adding a spell already on the save', () => {
    const save = newSaveData('cards');
    save.unlockedSpells.push('mend');
    applyCardsLevelUps(save, 1, 2);
    expect(save.unlockedSpells.filter((id) => id === 'mend')).toHaveLength(1);
  });
});

describe('loadoutFromCardSave cooldowns', () => {
  it('includes still-waters / wrath / liturgy at the matching levels', () => {
    const base = {
      actionBar: ['heal', 'bonk', '', ''] as string[],
      unlockedSpells: ['heal', 'bonk', 'mend', 'vowstrike'],
    };
    expect(
      loadoutFromCardSave({ ...base, xp: xpForLevel(5) }).cooldowns.map((c) => c.id),
    ).toEqual([]);
    expect(
      loadoutFromCardSave({ ...base, xp: xpForLevel(6) }).cooldowns.map((c) => c.id),
    ).toEqual(['still-waters']);
    expect(
      loadoutFromCardSave({ ...base, xp: xpForLevel(7) }).cooldowns.map((c) => c.id),
    ).toEqual(['still-waters', 'wrath-ascendant']);
    expect(
      loadoutFromCardSave({ ...base, xp: xpForLevel(8) }).cooldowns.map((c) => c.id),
    ).toEqual(['still-waters', 'wrath-ascendant', 'frenzied-liturgy']);
    expect(levelForXp(xpForLevel(8))).toBe(8);
  });
});
