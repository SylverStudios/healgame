import { describe, it, expect } from 'vitest';
import { blockValueLine, critValueLine, hasteValueLine, manaRegenValueLine } from './upgradePickCopy';

describe('blockValueLine', () => {
  it('rank 0 → Off prefix, first threshold value', () => {
    expect(blockValueLine(0)).toBe('Off → Every 20 dmg');
  });

  it('rank 1 → current and next threshold', () => {
    expect(blockValueLine(1)).toBe('Every 20 dmg → Every 18 dmg');
  });

  it('rank 8 → floors at minimum threshold (5)', () => {
    // blockThreshold(8) = max(5, 20 - 7*2) = max(5, 6) = 6
    // blockThreshold(9) = max(5, 20 - 8*2) = max(5, 4) = 5
    expect(blockValueLine(8)).toBe('Every 6 dmg → Every 5 dmg');
  });

  it('rank at floor → stays at min for both sides', () => {
    // blockThreshold(9) = 5, blockThreshold(10) = 5 (floor)
    expect(blockValueLine(9)).toBe('Every 5 dmg → Every 5 dmg');
  });
});

describe('critValueLine', () => {
  it('rank 0 → Off prefix, first threshold value', () => {
    expect(critValueLine(0)).toBe('Off → Every 8 casts');
  });

  it('rank 1 → current and next threshold', () => {
    expect(critValueLine(1)).toBe('Every 8 casts → Every 7 casts');
  });

  it('rank 5 → floors at minimum threshold (3)', () => {
    // critThreshold(5) = max(3, 8 - 4) = 4
    // critThreshold(6) = max(3, 8 - 5) = 3
    expect(critValueLine(5)).toBe('Every 4 casts → Every 3 casts');
  });
});

describe('hasteValueLine', () => {
  it('rank 0 → 0% to 1.5%', () => {
    expect(hasteValueLine(0)).toBe('0% → 1.5%');
  });

  it('rank 1 → 1.5% to 3%', () => {
    // hastePermille(1) = 15 → 1.5%; hastePermille(2) = 30 → 3%
    expect(hasteValueLine(1)).toBe('1.5% → 3%');
  });

  it('rank 2 → 3% to 4.5%', () => {
    // hastePermille(2) = 30 → 3%; hastePermille(3) = 45 → 4.5%
    expect(hasteValueLine(2)).toBe('3% → 4.5%');
  });

  it('formats whole-number percentages without decimal', () => {
    // hastePermille(6) = 90 → 9%; hastePermille(7) = 105 → 10.5%
    expect(hasteValueLine(6)).toBe('9% → 10.5%');
  });
});

describe('manaRegenValueLine', () => {
  it('rank 0 → Off prefix, first regen value', () => {
    expect(manaRegenValueLine(0)).toBe('Off → +1 / 10s');
  });

  it('rank 1 → current and next regen', () => {
    expect(manaRegenValueLine(1)).toBe('+1 / 10s → +2 / 10s');
  });

  it('rank 3 → scales amount linearly', () => {
    expect(manaRegenValueLine(3)).toBe('+3 / 10s → +4 / 10s');
  });
});
