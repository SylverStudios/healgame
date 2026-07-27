import { describe, expect, it } from 'vitest';
import { gcdWipeProgress } from './gcdWipe';

describe('gcdWipeProgress', () => {
  it('is 1 at full remaining and 0 when clear', () => {
    expect(gcdWipeProgress(1000, 1000)).toBe(1);
    expect(gcdWipeProgress(0, 1000)).toBe(0);
    expect(gcdWipeProgress(-1, 1000)).toBe(0);
  });

  it('scales linearly and clamps above gcdMs', () => {
    expect(gcdWipeProgress(500, 1000)).toBe(0.5);
    expect(gcdWipeProgress(250, 1000)).toBe(0.25);
    expect(gcdWipeProgress(2000, 1000)).toBe(1);
  });

  it('returns 0 for non-positive gcdMs', () => {
    expect(gcdWipeProgress(500, 0)).toBe(0);
    expect(gcdWipeProgress(500, -10)).toBe(0);
  });
});
