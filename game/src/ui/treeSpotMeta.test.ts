import { describe, expect, it } from 'vitest';
import { costLabel, grantSpellEyebrow, spotMetaSuffix } from './treeSpotMeta';

describe('spotMetaSuffix', () => {
  it('always shows owned/max capacity and drops redundant 1-talent cost', () => {
    expect(
      spotMetaSuffix({
        chainLength: 3,
        ownedCount: 1,
        nextCost: { currency: 'talent', amount: 1 },
      }),
    ).toBe(' (1/3)');
    expect(
      spotMetaSuffix({
        chainLength: 1,
        ownedCount: 0,
        nextCost: { currency: 'talent', amount: 1 },
      }),
    ).toBe(' (0/1)');
    expect(spotMetaSuffix({ chainLength: 1, ownedCount: 1 })).toBe(' (1/1)');
  });

  it('keeps non-talent or multi-point costs', () => {
    expect(
      spotMetaSuffix({
        chainLength: 1,
        ownedCount: 0,
        nextCost: { currency: 'gold', amount: 5 },
      }),
    ).toBe(' (0/1) — 5 gold');
    expect(
      spotMetaSuffix({
        chainLength: 1,
        ownedCount: 0,
        nextCost: { currency: 'talent', amount: 2 },
      }),
    ).toBe(' (0/1) — 2 points');
  });
});

describe('grantSpellEyebrow', () => {
  it('pairs talent name with capacity, not "1 point"', () => {
    expect(
      grantSpellEyebrow(
        { chainLength: 1, ownedCount: 0, nextCost: { currency: 'talent', amount: 1 } },
        'Path of the Vigil',
        'Solemn Vigil',
      ),
    ).toBe('Path of the Vigil (0/1)');
  });
});

describe('costLabel', () => {
  it('pluralizes talent points for affordance feedback', () => {
    expect(costLabel('talent', 1)).toBe('1 point');
    expect(costLabel('talent', 2)).toBe('2 points');
  });
});
