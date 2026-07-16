import { describe, expect, it } from 'vitest';
import {
  MANA_AURA_FULL_SPEND,
  MANA_AURA_WINDOW_MS,
  manaAuraIntensity,
  manaSpentInWindow,
  pruneManaSpends,
} from './manaSpendTracker';

describe('manaSpentInWindow', () => {
  it('sums amounts inside the window', () => {
    const spends = [
      { atMs: 1000, amount: 3 },
      { atMs: 5000, amount: 4 },
      { atMs: 10_000, amount: 5 },
    ];
    expect(manaSpentInWindow(spends, 10_000, MANA_AURA_WINDOW_MS)).toBe(12);
  });

  it('excludes spends older than the window', () => {
    const spends = [
      { atMs: 0, amount: 10 },
      { atMs: 25_000, amount: 3 },
      { atMs: 30_001, amount: 2 },
    ];
    expect(manaSpentInWindow(spends, 30_001, MANA_AURA_WINDOW_MS)).toBe(5);
  });

  it('returns 0 for an empty list', () => {
    expect(manaSpentInWindow([], 1000)).toBe(0);
  });
});

describe('pruneManaSpends', () => {
  it('drops entries outside the window', () => {
    const spends = [
      { atMs: 0, amount: 1 },
      { atMs: 1000, amount: 2 },
      { atMs: 40_000, amount: 3 },
    ];
    expect(pruneManaSpends(spends, 40_000)).toEqual([{ atMs: 40_000, amount: 3 }]);
  });
});

describe('manaAuraIntensity', () => {
  it('is 0 at no spend and 1 at the soft ceiling', () => {
    expect(manaAuraIntensity(0)).toBe(0);
    expect(manaAuraIntensity(MANA_AURA_FULL_SPEND)).toBe(1);
    expect(manaAuraIntensity(MANA_AURA_FULL_SPEND * 2)).toBe(1);
  });

  it('scales linearly below the ceiling', () => {
    expect(manaAuraIntensity(12)).toBe(0.5);
  });
});
