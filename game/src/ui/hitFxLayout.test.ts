import { describe, expect, it } from 'vitest';
import {
  DAMAGE_FLOAT_TOP_INSET_PX,
  DAMAGE_FLOAT_X_JITTER_PX,
  HIT_JITTER_MAX_PX,
  damageFloatSpawnOffsetY,
  damageFloatXOffset,
  hitJitterOffset,
} from './hitFxLayout';

describe('hitJitterOffset', () => {
  it('centers at zero (0.5, 0.5) and reaches the symmetric extremes', () => {
    expect(hitJitterOffset(0.5, 0.5)).toEqual({ dx: 0, dy: 0 });
    expect(hitJitterOffset(0, 0)).toEqual({ dx: -HIT_JITTER_MAX_PX, dy: -HIT_JITTER_MAX_PX });
    // r → 1 approaches +max (never quite reaches it since Math.random is [0, 1)).
    expect(hitJitterOffset(1, 1)).toEqual({ dx: HIT_JITTER_MAX_PX, dy: HIT_JITTER_MAX_PX });
  });

  it('never exceeds max amplitude for any sample in range', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const { dx, dy } = hitJitterOffset(r, 1 - r);
      expect(Math.abs(dx)).toBeLessThanOrEqual(HIT_JITTER_MAX_PX);
      expect(Math.abs(dy)).toBeLessThanOrEqual(HIT_JITTER_MAX_PX);
    }
  });

  it('honors a custom max', () => {
    expect(hitJitterOffset(1, 0, 8)).toEqual({ dx: 8, dy: -8 });
  });
});

describe('damageFloatSpawnOffsetY', () => {
  it('spawns just inside the top of the body (below the HP bar at -height/2 - 10)', () => {
    const height = 64;
    const offsetY = damageFloatSpawnOffsetY(height);
    expect(offsetY).toBe(-height / 2 + DAMAGE_FLOAT_TOP_INSET_PX);
    // Sits below (greater Y than) the HP bar, which is at -height/2 - 10.
    const hpBarY = -height / 2 - 10;
    expect(offsetY).toBeGreaterThan(hpBarY);
  });
});

describe('damageFloatXOffset', () => {
  it('is symmetric around 0 and bounded by the jitter width', () => {
    expect(damageFloatXOffset(0.5)).toBe(0);
    expect(damageFloatXOffset(0)).toBe(-DAMAGE_FLOAT_X_JITTER_PX);
    for (let r = 0; r < 1; r += 0.05) {
      expect(Math.abs(damageFloatXOffset(r))).toBeLessThanOrEqual(DAMAGE_FLOAT_X_JITTER_PX);
    }
  });
});
