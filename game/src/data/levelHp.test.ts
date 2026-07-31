import { describe, expect, it } from 'vitest';
import { partyHpBonusesForLevel } from './levelHp';
import { PARTY_LEVEL_HP } from './constants';

describe('partyHpBonusesForLevel (J26)', () => {
  it('is zero at level 1 (and below/non-integer floors)', () => {
    expect(partyHpBonusesForLevel(1)).toEqual({ tank: 0, dps: 0, healer: 0 });
    expect(partyHpBonusesForLevel(0)).toEqual({ tank: 0, dps: 0, healer: 0 });
    expect(partyHpBonusesForLevel(1.9)).toEqual({ tank: 0, dps: 0, healer: 0 });
  });

  it('grants the per-role bonus for each level above 1', () => {
    expect(partyHpBonusesForLevel(2)).toEqual({
      tank: PARTY_LEVEL_HP.tankPerLevel,
      dps: PARTY_LEVEL_HP.dpsPerLevel,
      healer: PARTY_LEVEL_HP.healerPerLevel,
    });
    expect(partyHpBonusesForLevel(14)).toEqual({
      tank: PARTY_LEVEL_HP.tankPerLevel * 13,
      dps: PARTY_LEVEL_HP.dpsPerLevel * 13,
      healer: PARTY_LEVEL_HP.healerPerLevel * 13,
    });
  });
});
