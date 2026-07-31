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

  it('M5: does not push cooldown ids into unlockedSpells and does not auto-grant them', () => {
    const save = newSaveData('cards');
    applyCardsLevelUps(save, 5, 8);
    expect(save.unlockedSpells).not.toContain('still-waters');
    expect(save.unlockedSpells).not.toContain('wrath-ascendant');
    expect(save.unlockedSpells).not.toContain('frenzied-liturgy');
    expect(save.upgradePoints).toBe(0);
    // loadout has no CDs without an explicit choice
    const mods = loadoutFromCardSave({
      xp: xpForLevel(6),
      actionBar: save.actionBar,
      unlockedSpells: save.unlockedSpells,
      chosenCooldownIds: [],
    });
    expect(mods.cooldowns).toEqual([]);
  });

  it('skips re-adding a spell already on the save', () => {
    const save = newSaveData('cards');
    save.unlockedSpells.push('mend');
    applyCardsLevelUps(save, 1, 2);
    expect(save.unlockedSpells.filter((id) => id === 'mend')).toHaveLength(1);
  });
});

describe('loadoutFromCardSave cooldowns (M5: from chosenCooldownIds only)', () => {
  const base = {
    actionBar: ['heal', 'bonk', '', ''] as string[],
    unlockedSpells: ['heal', 'bonk', 'mend', 'vowstrike'],
  };

  it('no chosen CDs → empty cooldowns regardless of level', () => {
    expect(
      loadoutFromCardSave({ ...base, xp: xpForLevel(8), chosenCooldownIds: [] }).cooldowns,
    ).toEqual([]);
    expect(
      loadoutFromCardSave({ ...base, xp: xpForLevel(6) }).cooldowns,
    ).toEqual([]);
  });

  it('chosenCooldownIds drives the loadout cooldowns', () => {
    expect(
      loadoutFromCardSave({
        ...base,
        xp: xpForLevel(6),
        chosenCooldownIds: ['still-waters'],
      }).cooldowns.map((c) => c.id),
    ).toEqual(['still-waters']);
    expect(
      loadoutFromCardSave({
        ...base,
        xp: xpForLevel(8),
        chosenCooldownIds: ['wrath-ascendant', 'iron-canticle'],
      }).cooldowns.map((c) => c.id),
    ).toEqual(['wrath-ascendant', 'iron-canticle']);
  });

  it('unknown chosen CD ids are silently dropped', () => {
    expect(
      loadoutFromCardSave({
        ...base,
        xp: xpForLevel(8),
        chosenCooldownIds: ['not-a-cd', 'still-waters'],
      }).cooldowns.map((c) => c.id),
    ).toEqual(['still-waters']);
  });

  it('level 8+ with two chosen CDs includes both', () => {
    expect(levelForXp(xpForLevel(8))).toBe(8);
    expect(
      loadoutFromCardSave({
        ...base,
        xp: xpForLevel(8),
        chosenCooldownIds: ['still-waters', 'iron-canticle'],
      }).cooldowns.map((c) => c.id),
    ).toEqual(['still-waters', 'iron-canticle']);
  });
});
