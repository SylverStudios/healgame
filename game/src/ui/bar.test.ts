import { describe, expect, it } from 'vitest';
import { framedFillSize } from './barGeometry';
import { CAST_BAR_FRAME_FILL_INSET, CAST_BAR_FRAME_NATIVE_SIZE } from './spellSprites';

describe('framedFillSize', () => {
  it('keeps unframed bars at full outer size (zero inset)', () => {
    expect(framedFillSize(320, 20)).toEqual({
      width: 320,
      height: 20,
      offsetX: 0,
      offsetY: 0,
    });
    expect(framedFillSize(80, 6, { left: 0, right: 0, top: 0, bottom: 0 })).toEqual({
      width: 80,
      height: 6,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('pins player cast fill inside the measured cast-bar-frame window at 2×', () => {
    const outerW = CAST_BAR_FRAME_NATIVE_SIZE.width * 2;
    const outerH = CAST_BAR_FRAME_NATIVE_SIZE.height * 2;
    expect(outerW).toBe(320);
    expect(outerH).toBe(20);

    const fill = framedFillSize(outerW, outerH, CAST_BAR_FRAME_FILL_INSET);
    // Native clear band cols 14..145 (132) × rows 2..7 (6) → display 264×12.
    expect(fill).toEqual({ width: 264, height: 12, offsetX: 28, offsetY: 0 });
    // Full fill (ratio=1) ends behind the right end cap, not past the outer edge.
    expect(fill.offsetX + fill.width).toBe(outerW - CAST_BAR_FRAME_FILL_INSET.right);
    expect(fill.offsetX).toBe(CAST_BAR_FRAME_FILL_INSET.left);
    // Vertical window stays centered in the 20px outer bar.
    expect(fill.height).toBe(outerH - CAST_BAR_FRAME_FILL_INSET.top - CAST_BAR_FRAME_FILL_INSET.bottom);
  });

  it('left-anchors fill growth: ratio scales fill width only', () => {
    const { width: fullW, offsetX } = framedFillSize(320, 20, CAST_BAR_FRAME_FILL_INSET);
    expect(offsetX).toBe(28);
    expect(Math.floor(fullW * 0)).toBe(0);
    expect(Math.floor(fullW * 0.5)).toBe(132);
    expect(Math.floor(fullW * 1)).toBe(264);
  });
});
