import { describe, expect, it } from 'vitest';
import {
  MANA_BLUE_CSS,
  MANA_OOM_CSS,
  manaCostColorCss,
  manaCostDigits,
} from './manaAffordance';
import { PALETTE } from './theme';

describe('manaCostDigits', () => {
  it('returns digits only (no m / (m) suffix)', () => {
    expect(manaCostDigits(5)).toBe('5');
    expect(manaCostDigits(0)).toBe('0');
    expect(manaCostDigits(12)).toBe('12');
  });

  it('floors and clamps negative to 0', () => {
    expect(manaCostDigits(3.9)).toBe('3');
    expect(manaCostDigits(-2)).toBe('0');
  });
});

describe('manaCostColorCss', () => {
  it('uses theme mana blue when affordable', () => {
    expect(manaCostColorCss(true)).toBe(PALETTE.mana);
    expect(manaCostColorCss(true)).toBe(MANA_BLUE_CSS);
  });

  it('uses danger when OOM', () => {
    expect(manaCostColorCss(false)).toBe(PALETTE.danger);
    expect(manaCostColorCss(false)).toBe(MANA_OOM_CSS);
  });
});
