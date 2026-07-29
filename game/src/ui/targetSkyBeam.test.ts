import { describe, expect, it } from 'vitest';
import {
  SKY_BEAM_COLOR,
  SKY_BEAM_CROWN_CLEARANCE,
  SKY_BEAM_RING_STROKE,
  drawTargetSkyBeam,
  skyBeamLayout,
  skyBeamYOrderOk,
  type SkyBeamGraphics,
} from './targetSkyBeam';

/** Typical party body — matches UnitSprite meter stack (hpY = -h/2 - 10). */
const BODY_HEIGHT = 64;
const BODY_WIDTH = 64;
const HP_BAR_OFFSET_Y = 10;
const hpBarY = -BODY_HEIGHT / 2 - HP_BAR_OFFSET_Y;
const crownY = -BODY_HEIGHT / 2;

describe('skyBeamLayout', () => {
  it('places the ring at ≈ 2× hpBarY (twice the HP-bar elevation)', () => {
    const layout = skyBeamLayout({ hpBarY, crownY, bodyWidth: BODY_WIDTH });
    expect(layout.ringY).toBe(2 * hpBarY);
    // More elevated than the HP bar (up is negative).
    expect(layout.ringY).toBeLessThan(hpBarY);
    expect(layout.ringY).toBeCloseTo(2 * hpBarY, 5);
  });

  it('ends the shaft fade before the sprite crown', () => {
    const layout = skyBeamLayout({ hpBarY, crownY, bodyWidth: BODY_WIDTH });
    expect(layout.shaftBottomY).toBe(crownY - SKY_BEAM_CROWN_CLEARANCE);
    expect(layout.shaftBottomY).toBeLessThan(crownY);
    // Shaft still hangs below the ring.
    expect(layout.shaftBottomY).toBeGreaterThan(layout.ringY);
  });

  it('keeps ring → shaft → crown Y order for meter-friendly stacking', () => {
    const layout = skyBeamLayout({ hpBarY, crownY, bodyWidth: BODY_WIDTH });
    expect(skyBeamYOrderOk(layout, hpBarY, crownY)).toBe(true);
    // Ring is above meters; shaft dies before body so meters/sprite stay clear.
    expect(layout.ringY).toBeLessThan(hpBarY);
    expect(hpBarY).toBeLessThan(layout.shaftBottomY);
    expect(layout.shaftBottomY).toBeLessThan(crownY);
  });

  it('scales ring width with wider bodies but keeps a floor', () => {
    const narrow = skyBeamLayout({ hpBarY, crownY, bodyWidth: 40 });
    const wide = skyBeamLayout({ hpBarY, crownY, bodyWidth: 112 });
    expect(wide.ringWidth).toBeGreaterThan(narrow.ringWidth);
    expect(narrow.ringWidth).toBeGreaterThanOrEqual(36);
  });
});

describe('drawTargetSkyBeam', () => {
  it('paints a gold ring and fading shaft without throwing', () => {
    const layout = skyBeamLayout({ hpBarY, crownY, bodyWidth: BODY_WIDTH });
    let cleared = 0;
    const ellipses: Array<{ x: number; y: number; w: number; h: number }> = [];
    const triangles: Array<{ y1: number; y3: number }> = [];
    let lastFillColor = 0;
    const g: SkyBeamGraphics = {
      clear() {
        cleared += 1;
        return g;
      },
      lineStyle() {
        return g;
      },
      strokeEllipse(x, y, width, height) {
        ellipses.push({ x, y, w: width, h: height });
        return g;
      },
      fillStyle(color) {
        lastFillColor = color;
        return g;
      },
      fillEllipse(x, y, width, height) {
        ellipses.push({ x, y, w: width, h: height });
        return g;
      },
      fillTriangle(_x1, y1, _x2, _y2, _x3, y3) {
        triangles.push({ y1, y3 });
        return g;
      },
    };

    drawTargetSkyBeam(g, layout);

    expect(cleared).toBe(1);
    expect(ellipses.some((e) => e.y === layout.ringY && e.w === layout.ringWidth)).toBe(
      true,
    );
    expect(triangles.length).toBeGreaterThan(0);
    // Shaft strips and ring use the holy gold (not crimson boss-focus).
    expect(lastFillColor).toBe(SKY_BEAM_COLOR);
    expect(SKY_BEAM_RING_STROKE).not.toBe(0xc23b22);
  });
});
