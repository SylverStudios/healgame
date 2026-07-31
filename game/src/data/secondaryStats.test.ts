import { describe, expect, it } from 'vitest';
import {
  blockThreshold,
  bumpSecondaryRank,
  critChancePermille,
  fightModsFromSecondaryRanks,
  hastePermille,
  manaRegenFromRank,
  CRIT_BONUS_PERMILLE,
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
