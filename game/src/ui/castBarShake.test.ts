import { describe, expect, it } from 'vitest';
import {
  CAST_BAR_SHAKE_MAX_PX,
  castBarShakeIntensity,
  castBarShakeOffset,
} from './castBarShake';

describe('castBarShakeIntensity', () => {
  it('is 0 at empty and 1 at full, squared in between', () => {
    expect(castBarShakeIntensity(0)).toBe(0);
    expect(castBarShakeIntensity(1)).toBe(1);
    expect(castBarShakeIntensity(0.5)).toBe(0.25);
    expect(castBarShakeIntensity(0.25)).toBe(0.0625);
  });

  it('clamps out-of-range progress', () => {
    expect(castBarShakeIntensity(-1)).toBe(0);
    expect(castBarShakeIntensity(2)).toBe(1);
  });

  it('stays subtle early and grows aggressively late', () => {
    const early = castBarShakeIntensity(0.2);
    const mid = castBarShakeIntensity(0.5);
    const late = castBarShakeIntensity(0.9);
    expect(early).toBeLessThan(mid);
    expect(mid).toBeLessThan(late);
    // Late ramp is steeper than early: 0.5→0.9 adds more than 0.1→0.5.
    expect(late - mid).toBeGreaterThan(mid - castBarShakeIntensity(0.1));
  });
});

describe('castBarShakeOffset', () => {
  it('returns zero offset when the bar is empty', () => {
    expect(castBarShakeOffset(0, 1234)).toEqual({ dx: 0, dy: 0 });
  });

  it('stays within max amplitude at full fill', () => {
    for (let phase = 0; phase < 2000; phase += 37) {
      const { dx, dy } = castBarShakeOffset(1, phase);
      expect(Math.abs(dx)).toBeLessThanOrEqual(CAST_BAR_SHAKE_MAX_PX);
      expect(Math.abs(dy)).toBeLessThanOrEqual(CAST_BAR_SHAKE_MAX_PX);
    }
  });

  it('grows in magnitude as fill approaches full (same phase)', () => {
    const phase = 900;
    const early = castBarShakeOffset(0.2, phase);
    const late = castBarShakeOffset(0.95, phase);
    const earlyMag = Math.abs(early.dx) + Math.abs(early.dy);
    const lateMag = Math.abs(late.dx) + Math.abs(late.dy);
    expect(lateMag).toBeGreaterThan(earlyMag);
  });
});
