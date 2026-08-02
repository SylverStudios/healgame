import { describe, expect, it } from 'vitest';
import {
  applyUpgradePick,
  blockThreshold,
  bumpSecondaryRank,
  critThreshold,
  fightModsFromSecondaryRanks,
  hastePermille,
  manaRegenFromRank,
  CRIT_BONUS_PERMILLE,
} from './secondaryStats';
import { SAVE_SCHEMA, type SaveData } from '../save/save';

describe('secondaryStats', () => {
  it('rank 0 disables block / crit / manaRegen and zeros haste', () => {
    const mods = fightModsFromSecondaryRanks({});
    expect(mods.blockThresholdN).toBeNull();
    expect(mods.critThresholdN).toBeNull();
    expect(mods.manaRegen).toBeNull();
    expect(mods.hastePermille).toBe(0);
    expect(mods.critBonusPermille).toBe(CRIT_BONUS_PERMILLE);
  });

  it('higher block rank reduces N (blocks more often)', () => {
    expect(blockThreshold(0)).toBeNull();
    expect(blockThreshold(1)).toBe(20);
    expect(blockThreshold(2)).toBe(18);
    expect(blockThreshold(10)).toBe(5); // floor
  });

  it('higher crit rank reduces N (crits more often)', () => {
    expect(critThreshold(0)).toBeNull();
    expect(critThreshold(1)).toBe(8);
    expect(critThreshold(2)).toBe(7);
    expect(critThreshold(10)).toBe(3); // floor
  });

  it('stub haste / manaRegen scale with rank', () => {
    expect(hastePermille(1)).toBe(15);
    expect(manaRegenFromRank(2)).toEqual({ amount: 2, intervalMs: 10_000 });
  });

  it('bumpSecondaryRank increments one id', () => {
    expect(bumpSecondaryRank({}, 'haste')).toEqual({ haste: 1 });
    expect(bumpSecondaryRank({ haste: 2 }, 'haste')).toEqual({ haste: 3 });
  });

  it('applyUpgradePick drains a pick and bumps rank', () => {
    const save = {
      pendingUpgradePicks: 2,
      secondaryRanks: {} as SaveData['secondaryRanks'],
    };
    expect(applyUpgradePick(save, 'crit')).toBe(true);
    expect(save.pendingUpgradePicks).toBe(1);
    expect(save.secondaryRanks).toEqual({ crit: 1 });
    expect(applyUpgradePick(save, 'crit')).toBe(true);
    expect(save.secondaryRanks).toEqual({ crit: 2 });
    expect(save.pendingUpgradePicks).toBe(0);
    expect(applyUpgradePick(save, 'haste')).toBe(false);
  });

  it('applyUpgradePick rejects unknown ids without mutating', () => {
    const save = { pendingUpgradePicks: 1, secondaryRanks: {} };
    expect(applyUpgradePick(save, 'nope' as 'block')).toBe(false);
    expect(save.pendingUpgradePicks).toBe(1);
    expect(save.secondaryRanks).toEqual({});
    void SAVE_SCHEMA;
  });
});
