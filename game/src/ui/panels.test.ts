import { describe, expect, it } from 'vitest';
import { alphaForState, edgeDisplayLength, fillColorForState, outlineColorForState, showsAccentOutline } from './panels';
import { PALETTE_NUM } from './theme';

describe('fillColorForState', () => {
  it('keeps the base color for normal/disabled/current', () => {
    expect(fillColorForState('normal', 0x123456)).toBe(0x123456);
    expect(fillColorForState('disabled', 0x123456)).toBe(0x123456);
    expect(fillColorForState('current', 0x123456)).toBe(0x123456);
  });

  it('swaps to the lighter panel color on hover regardless of base', () => {
    expect(fillColorForState('hover', 0x123456)).toBe(PALETTE_NUM.panelLight);
    expect(fillColorForState('hover', PALETTE_NUM.panel)).toBe(PALETTE_NUM.panelLight);
  });
});

describe('alphaForState', () => {
  it('dims only disabled', () => {
    expect(alphaForState('normal')).toBe(1);
    expect(alphaForState('hover')).toBe(1);
    expect(alphaForState('current')).toBe(1);
    expect(alphaForState('disabled')).toBeLessThan(1);
    expect(alphaForState('disabled')).toBeGreaterThan(0);
  });
});

describe('showsAccentOutline', () => {
  it('is true for current and hover, false for normal/disabled', () => {
    expect(showsAccentOutline('current')).toBe(true);
    expect(showsAccentOutline('hover')).toBe(true);
    expect(showsAccentOutline('normal')).toBe(false);
    expect(showsAccentOutline('disabled')).toBe(false);
  });
});

describe('outlineColorForState', () => {
  it('current is always gold regardless of the caller-supplied accent', () => {
    expect(outlineColorForState('current', 0x123456)).toBe(PALETTE_NUM.gold);
  });

  it('hover uses the caller-supplied accent color', () => {
    expect(outlineColorForState('hover', 0x123456)).toBe(0x123456);
  });
});

describe('edgeDisplayLength', () => {
  it('subtracts both corners from the total length', () => {
    expect(edgeDisplayLength(100, 12)).toBe(76);
    expect(edgeDisplayLength(280, 24)).toBe(232);
  });

  it('clamps at zero instead of going negative when corners exceed the total', () => {
    expect(edgeDisplayLength(10, 12)).toBe(0);
  });
});
