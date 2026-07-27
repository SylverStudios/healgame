import { describe, expect, it } from 'vitest';
import {
  FOCUS_EYE_OFFSET_Y,
  FOCUS_EYE_RADIUS,
  FOCUS_EYE_SPACING,
  FOCUS_RETICLE_ARM,
  FOCUS_RETICLE_RADIUS,
  drawBossFocusReticle,
  focusEyeCenters,
  type FocusReticleGraphics,
} from './bossFocusReticle';

describe('focusEyeCenters', () => {
  it('places two eyes symmetrically about the origin', () => {
    const eyes = focusEyeCenters();
    expect(eyes.leftX).toBe(-FOCUS_EYE_SPACING / 2);
    expect(eyes.rightX).toBe(FOCUS_EYE_SPACING / 2);
    expect(eyes.y).toBe(FOCUS_EYE_OFFSET_Y);
    expect(eyes.leftX).toBe(-eyes.rightX);
  });

  it('keeps eyes inside the outer reticle ring', () => {
    const eyes = focusEyeCenters();
    const leftExtent = Math.hypot(eyes.leftX - FOCUS_EYE_RADIUS, eyes.y);
    const rightExtent = Math.hypot(eyes.rightX + FOCUS_EYE_RADIUS, eyes.y);
    expect(leftExtent).toBeLessThan(FOCUS_RETICLE_RADIUS);
    expect(rightExtent).toBeLessThan(FOCUS_RETICLE_RADIUS);
  });
});

describe('drawBossFocusReticle', () => {
  it('paints rings, arms, and two filled eyes without throwing', () => {
    const strokes: Array<{ x: number; y: number; r: number }> = [];
    const fills: Array<{ x: number; y: number; r: number; color: number }> = [];
    let cleared = 0;
    const g: FocusReticleGraphics = {
      clear() {
        cleared += 1;
        return g;
      },
      lineStyle() {
        return g;
      },
      strokeCircle(x, y, r) {
        strokes.push({ x, y, r });
        return g;
      },
      lineBetween() {
        return g;
      },
      fillStyle(color) {
        (g as { _color?: number })._color = color;
        return g;
      },
      fillCircle(x, y, r) {
        fills.push({ x, y, r, color: (g as { _color?: number })._color ?? 0 });
        return g;
      },
    };

    drawBossFocusReticle(g);

    expect(cleared).toBe(1);
    expect(strokes.some((s) => s.r === FOCUS_RETICLE_RADIUS)).toBe(true);
    expect(FOCUS_RETICLE_ARM).toBeGreaterThan(FOCUS_RETICLE_RADIUS);

    const eyes = focusEyeCenters();
    const eyeFills = fills.filter(
      (f) =>
        (f.x === eyes.leftX || f.x === eyes.rightX) &&
        f.y === eyes.y &&
        f.r === FOCUS_EYE_RADIUS,
    );
    expect(eyeFills).toHaveLength(2);
  });
});
