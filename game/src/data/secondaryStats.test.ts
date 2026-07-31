import { describe, expect, it } from 'vitest';
import {
  applyUpgradePick,
  blockThreshold,
  bumpSecondaryRank,
  critChancePermille,
  fightModsFromSecondaryRanks,
  hastePermille,
  manaRegenFromRank,
  CRIT_BONUS_PERMILLE,
  type SecondaryRanks,
} from './secondaryStats';

describe('secondaryStats', () => {
  it('rank 0 disables block / manaRegen and zeros haste/crit chance', () => {
    const mods = fightModsFromSecondaryRanks({});
    expect(mods.blockThresholdN).toBeNull();
    expect(mods.manaRegen).toBeNull();
    expect(mods.hastePermille).toBe(0);
    expect(mods.critChancePermille).toBe(0);
    expect(mods.critBonusPermille).toBe(CRIT_BONUS_PERMILLE);
  });

  it('higher block rank reduces N (blocks more often)', () => {
    expect(blockThreshold(0)).toBeNull();
    expect(blockThreshold(1)).toBe(20);
    expect(blockThreshold(2)).toBe(18);
    expect(blockThreshold(10)).toBe(5); // floor
  });

  it('stub haste / crit / manaRegen scale with rank', () => {
    expect(hastePermille(1)).toBe(15);
    expect(critChancePermille(1)).toBe(20);
    expect(manaRegenFromRank(2)).toEqual({ amount: 2, intervalMs: 10_000 });
  });

  it('bumpSecondaryRank increments one id', () => {
    expect(bumpSecondaryRank({}, 'haste')).toEqual({ haste: 1 });
    expect(bumpSecondaryRank({ haste: 2 }, 'haste')).toEqual({ haste: 3 });
  });
});

describe('applyUpgradePick', () => {
  it('returns false and does not mutate when pendingUpgradePicks is 0', () => {
    const save = { pendingUpgradePicks: 0, secondaryRanks: {} };
    expect(applyUpgradePick(save, 'haste')).toBe(false);
    expect(save.pendingUpgradePicks).toBe(0);
    expect(save.secondaryRanks).toEqual({});
  });

  it('decrements pendingUpgradePicks and bumps the chosen rank', () => {
    const save = { pendingUpgradePicks: 3, secondaryRanks: {} };
    expect(applyUpgradePick(save, 'crit')).toBe(true);
    expect(save.pendingUpgradePicks).toBe(2);
    expect(save.secondaryRanks).toEqual({ crit: 1 });
  });

  it('stacks ranks across multiple picks', () => {
    const save = { pendingUpgradePicks: 2, secondaryRanks: { haste: 1 } };
    applyUpgradePick(save, 'haste');
    applyUpgradePick(save, 'block');
    expect(save.pendingUpgradePicks).toBe(0);
    expect(save.secondaryRanks).toEqual({ haste: 2, block: 1 });
  });

  it('handles all four secondary ids', () => {
    for (const id of ['block', 'crit', 'haste', 'manaRegen'] as const) {
      const save = { pendingUpgradePicks: 1, secondaryRanks: {} as SecondaryRanks };
      expect(applyUpgradePick(save, id)).toBe(true);
      expect(save.secondaryRanks[id]).toBe(1);
    }
  });

  it('returns false when picks are exhausted', () => {
    const save = { pendingUpgradePicks: 1, secondaryRanks: {} };
    applyUpgradePick(save, 'manaRegen');
    expect(applyUpgradePick(save, 'manaRegen')).toBe(false);
  });
});
